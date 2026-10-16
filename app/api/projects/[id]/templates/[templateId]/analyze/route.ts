import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { templateAnalysisSchema, normalizeAnalysis, refineValueBoxes } from "@/lib/ai/template-schema";
import sharp from "sharp";
import { sanitizeSvg } from "@/lib/rendering/engine";

const MODEL = process.env.GEMINI_TEMPLATE_MODEL || "gemini-3.8-flash";
const PROMPT = `Analyze this school/student ID-card template as a precise print-layout engineer. Return JSON only.

GOAL: create a usable field map, not just an OCR transcript. Inspect the entire card, including Hindi/English text, labels, blank lines, underlines, boxes, photo placeholders, and small text.

1) DETECT EVERY variable student-specific field that a human would otherwise map or fill: student full name, father's name, mother's name, guardian name, class, section, roll number, admission number, date of birth, address, blood group, phone, academic session, gender, student ID, and any other visible variable field. Include a photo field separately when there is a photo placeholder.
2) SEPARATE PRINTED LABELS FROM VALUE AREAS. For a layout such as "Father's Name: __________", keep "Father's Name:" in detectedText and set the father_name field box ONLY over the blank line/empty value area after the label. Never place the value box over the printed label. If a label is above its blank area, box only the area where the value should print. If the card already has an empty outlined box for a value, use that box.
3) Return every printed/static label and school/header text in detectedText with tight normalized boxes. Do not treat static label text as a student value field.
4) Each variable field must have a stable snake_case key and a meaningful label. Use canonical keys such as student_name, father_name, mother_name, guardian_name, class, section, roll_number, admission_number, date_of_birth, address, blood_group, phone, session, gender, student_id, student_photo. For father/mother fields use fieldType "parent"; use other appropriate enum values for the remaining fields.
5) Set suggestedSourceColumn to the most likely spreadsheet header name, e.g. "Father's Name" for father_name or "Student Name" for student_name. This is a semantic suggestion, not a claim that the spreadsheet has that exact column. Never leave it blank when the field identity is clear.
6) Boxes are [ymin,xmin,ymax,xmax] normalized 0–1000, relative to the complete card image. Coordinates must be ordered, inside the card, and tight around the actual value-printing region. Do not use the whole card as a box. Estimate image width and height in pixels from the supplied file.
7) Infer alignment, font family, approximate font-size ratio, text color, and whether the field is required. Use Noto Sans for Indian scripts. Use confidence honestly; low confidence is preferable to invented certainty.
8) Do not invent unseen fields or student values. Do not remove important fields because the value area is blank. Keep photo placeholder separate from text fields. If a field is genuinely ambiguous, add a note.
9) Before returning JSON, perform a visual self-check: for each field, compare its box against detectedText; if the printed label is inside or overlaps the value box, move the value box to the blank area after the label. Keep fields for different rows separate, avoid covering borders/photo/signatures, and ensure every box is ordered [ymin,xmin,ymax,xmax] within 0–1000.
10) For a session printed as \"SESSION: ____ - ____\", create two separate fields with keys session_start and session_end and boxes over only the two blank year areas. If the spreadsheet has one combined session value such as 2025-2026, the app can split it; do not create a box over the printed word SESSION.
11) Check that all required student fields are included exactly once; do not duplicate a field to represent its printed label.
`;
const responseSchema = {
  type: "OBJECT",
  properties: {
    width: { type: "INTEGER" },
    height: { type: "INTEGER" },
    detectedText: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          box: { type: "ARRAY", items: { type: "NUMBER" } }
        },
        "required": ["text", "box"]
      }
    },
    fields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          key: { type: "STRING" },
          fieldType: { type: "STRING", enum: ["text", "photo", "school_name", "student_name", "class", "section", "roll_number", "admission_number", "dob", "parent", "address", "session", "other"] },
          confidence: { type: "NUMBER" },
          box: { type: "ARRAY", items: { type: "NUMBER" } },
          detectedText: { type: "STRING" },
          "required": { type: "BOOLEAN" },
          suggestedSourceColumn: { type: "STRING" },
          alignment: { type: "STRING", enum: ["left", "center", "right"] },
          fontFamily: { type: "STRING" },
          fontSizeRatio: { type: "NUMBER" },
          color: { type: "STRING" },
          fitMode: { type: "STRING", enum: ["cover", "contain", "fill"] }
        },
        "required": ["label", "key", "fieldType", "confidence", "box", "required", "alignment", "fontFamily", "fontSizeRatio", "color", "fitMode"]
      }
    },
    notes: { type: "ARRAY", items: { type: "STRING" } }
  },
  "required": ["width", "height", "detectedText", "fields", "notes"]
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const { id, templateId } = await params;
    const s = await createClient();
    const { data: claims } = await s.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return NextResponse.json({ error: "Unauthorized. Please sign in again." }, { status: 401 });
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Gemini API key is missing from this deployment. Configure GEMINI_API_KEY in Vercel and redeploy." }, { status: 503 });

    const { data: t, error } = await s.from("templates").select("id,project_id,owner_id,source_path,source_type,width_px,height_px").eq("id", templateId).eq("project_id", id).maybeSingle();
    if (error) return NextResponse.json({ error: "Could not load template metadata.", details: error.message }, { status: 500 });
    if (!t) return NextResponse.json({ error: "Template not found in this project." }, { status: 404 });
    if (t.owner_id !== uid) return NextResponse.json({ error: "You do not have access to this template." }, { status: 403 });
    if (!t.source_path) return NextResponse.json({ error: "The template image is missing from storage." }, { status: 422 });
    const { data: file, error: fe } = await s.storage.from("printforge-templates").download(t.source_path);
    if (fe || !file) return NextResponse.json({ error: "Could not download the template image.", details: fe?.message }, { status: 500 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Template is too large for analysis (20 MB maximum)." }, { status: 413 });

    const originalBytes = Buffer.from(await file.arrayBuffer());
    const sourceType = String(t.source_type || "").toLowerCase();
    const sourcePath = String(t.source_path || "").toLowerCase();
    let bytes = originalBytes;
    let mimeType: string;
    if (sourceType === "svg" || sourceType === "image/svg+xml" || sourcePath.endsWith(".svg")) {
      bytes = await sharp(sanitizeSvg(originalBytes), { limitInputPixels: 24_000_000, density: 144 }).png().toBuffer();
      mimeType = "image/png";
    } else if (sourceType === "pdf" || sourceType === "application/pdf" || sourcePath.endsWith(".pdf")) {
      // Gemini accepts PDF documents directly. Do not mislabel PDF bytes as JPEG.
      mimeType = "application/pdf";
    } else if (sourceType === "png" || sourceType === "image/png" || sourcePath.endsWith(".png")) {
      mimeType = "image/png";
    } else if (["jpg", "jpeg", "image/jpeg"].includes(sourceType) || /\.(jpe?g)$/.test(sourcePath)) {
      mimeType = "image/jpeg";
    } else {
      return NextResponse.json({ error: "Unsupported template format for Gemini analysis.", details: "Use PNG, JPEG, SVG, or a single-page PDF template." }, { status: 415 });
    }
    if (bytes.length > 20 * 1024 * 1024) return NextResponse.json({ error: "Prepared template is too large for analysis.", details: "The image prepared for Gemini exceeds 20 MB." }, { status: 413 });
    const models = [...new Set([MODEL, "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"].filter(Boolean))];
    let gj: any = null;
    let selectedModel = MODEL;
    let lastFailure = { status: 502, detail: "Gemini did not return a response." };
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      let gr: Response;
      try {
        gr = await fetch(url, {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.1 }
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(60000)
        });
      } catch (err) {
        lastFailure = { status: 502, detail: err instanceof Error ? err.message : "Network request to Gemini failed." };
        continue;
      }
      if (gr.ok) { gj = await gr.json(); selectedModel = model; break; }
      const providerBody = await gr.text();
      let detail = `Gemini API returned HTTP ${gr.status}.`;
      try { detail = JSON.parse(providerBody)?.error?.message || detail; } catch {}
      lastFailure = { status: gr.status, detail: detail.slice(0, 700) };
      // Only retry another model for model/schema/unsupported-request failures or transient rate/server errors.
      if (![400, 403, 404, 429, 500, 502, 503].includes(gr.status)) break;
    }
    if (!gj) {
      const status = lastFailure.status === 429 ? 429 : lastFailure.status === 401 || lastFailure.status === 403 ? 502 : 502;
      return NextResponse.json({
        error: "Gemini analysis failed.",
        details: lastFailure.detail,
        modelTried: models,
        hint: /api key|permission|unauthorized|billing|quota/i.test(lastFailure.detail)
          ? "Check that GEMINI_API_KEY is valid, enabled for the Generative Language API, and has available quota."
          : /mime|media type|file type|unsupported/i.test(lastFailure.detail)
            ? "The template format could not be accepted by Gemini. Try exporting the card as PNG or JPEG."
            : "Open the detailed error, then retry. The app now attempts compatible Gemini models automatically."
      }, { status });
    }
    const output = gj.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("").trim();
    if (!output) return NextResponse.json({ error: "Gemini returned no structured output.", details: gj.promptFeedback?.blockReason || "Empty model response." }, { status: 502 });
    let raw: unknown;
    try { raw = JSON.parse(output); } catch { return NextResponse.json({ error: "Gemini returned invalid JSON. Retry analysis." }, { status: 502 }); }
    // Normalize model-estimated numeric values before strict schema validation.
    // Gemini occasionally returns normalized coordinates as 0..1 or image-pixel
    // coordinates instead of the documented 0..1000 coordinate system.
    if (raw && typeof raw === "object") {
      const obj = raw as any;
      const normalizeBox = (box: unknown) => {
        if (!Array.isArray(box) || box.length !== 4 || !box.every((v) => Number.isFinite(Number(v)))) return box;
        let values = box.map(Number);
        if (values.every((v) => v >= 0 && v <= 1) && values.some((v) => v > 0)) {
          values = values.map((v) => v * 1000);
        } else if (values.some((v) => v > 1000) && Number(t.width_px) > 0 && Number(t.height_px) > 0) {
          values = values.map((v, i) => v / (i % 2 === 0 ? Number(t.height_px) : Number(t.width_px)) * 1000);
        }
        return values.map((v) => Math.max(0, Math.min(1000, v)));
      };
      if (Array.isArray(obj.fields)) {
        obj.fields = obj.fields.map((field: any) => {
          if (!field || typeof field !== "object") return field;
          const ratio = Number(field.fontSizeRatio), confidence = Number(field.confidence);
          return {
            ...field,
            box: normalizeBox(field.box),
            confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
            fontSizeRatio: Number.isFinite(ratio) ? Math.max(0.005, Math.min(0.25, ratio)) : 0.04
          };
        });
      }
      if (Array.isArray(obj.detectedText)) {
        obj.detectedText = obj.detectedText.map((item: any) => item && typeof item === "object" ? { ...item, box: normalizeBox(item.box) } : item);
      }
    }
    const parsed = templateAnalysisSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Gemini output failed validation.", details: parsed.error.issues.slice(0, 5) }, { status: 502 });
    // Coordinates must use the uploaded template's real pixel basis, not dimensions guessed by the model.
    const analysisData = refineValueBoxes({
      ...parsed.data,
      width: Number(t.width_px) > 0 ? Number(t.width_px) : parsed.data.width,
      height: Number(t.height_px) > 0 ? Number(t.height_px) : parsed.data.height
    });
    const normalized = normalizeAnalysis(analysisData);
    const { error: del } = await s.from("template_fields").delete().eq("template_id", templateId);
    if (del) return NextResponse.json({ error: "Analysis succeeded but old field map could not be replaced.", details: del.message }, { status: 500 });
    const rows = normalized.fields.map(f => ({ ...f, template_id: templateId, owner_id: uid }));
    if (rows.length) {
      const { error: ie } = await s.from("template_fields").insert(rows);
      if (ie) return NextResponse.json({ error: "Analysis succeeded but detected fields could not be saved.", details: ie.message }, { status: 500 });
    }
    const analysis = { engine: "gemini", model: selectedModel, version: 2, analyzed_at: new Date().toISOString(), raw: analysisData, normalized_count: normalized.fields.length };
    const { error: ue } = await s.from("templates").update({ analysis_status: "needs_review", analysis, updated_at: new Date().toISOString() }).eq("id", templateId).eq("project_id", id);
    if (ue) return NextResponse.json({ error: "Analysis succeeded but template status could not be updated.", details: ue.message }, { status: 500 });
    return NextResponse.json({ analysis: analysisData, fields: normalized.fields, message: "Detected template fields. Please review low-confidence boxes and source-column matches before generating cards." });
  } catch (e) {
    const details = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: "Template analysis could not be completed.", details: details.slice(0, 500) }, { status: 500 });
  }
}
