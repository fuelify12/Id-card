import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { templateAnalysisSchema, normalizeAnalysis } from "@/lib/ai/template-schema";

const MODEL = process.env.GEMINI_TEMPLATE_MODEL || "gemini-2.5-flash";
const PROMPT = `Inspect the supplied ID card template image carefully and return JSON only. Identify every variable field a human would need to fill for each student: student name, father/mother/guardian name, class, section, roll number, admission number, date of birth, address, blood group, session, phone, and any other visible student-specific value. Identify the photo placeholder separately. Also record static school/logo/header text in detectedText, not as student fields. Do not invent unseen fields. For each variable field give its visible label, a stable snake_case key, source-column suggestion only when supported by visible label, confidence from 0 to 1, and bounding box [ymin,xmin,ymax,xmax] normalized 0-1000. Make boxes tight around the actual print region. Include fields that are blank placeholders even if they have no current value. Do not infer student values from the template; this is field detection, not student data generation.`;
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

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = t.source_type === "png" || t.source_type === "image/png" || t.source_path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const gr = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.1 }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000)
    });
    if (!gr.ok) {
      const providerBody = await gr.text();
      let detail = `Gemini API returned HTTP ${gr.status}.`;
      try { detail = JSON.parse(providerBody)?.error?.message || detail; } catch {}
      return NextResponse.json({ error: "Gemini analysis failed.", details: detail.slice(0, 700), model: MODEL }, { status: gr.status === 429 ? 429 : 502 });
    }
    const gj = await gr.json();
    const output = gj.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("").trim();
    if (!output) return NextResponse.json({ error: "Gemini returned no structured output.", details: gj.promptFeedback?.blockReason || "Empty model response." }, { status: 502 });
    let raw: unknown;
    try { raw = JSON.parse(output); } catch { return NextResponse.json({ error: "Gemini returned invalid JSON. Retry analysis." }, { status: 502 }); }
    const parsed = templateAnalysisSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Gemini output failed validation.", details: parsed.error.issues.slice(0, 5) }, { status: 502 });
    const normalized = normalizeAnalysis(parsed.data);
    const { error: del } = await s.from("template_fields").delete().eq("template_id", templateId);
    if (del) return NextResponse.json({ error: "Analysis succeeded but old field map could not be replaced.", details: del.message }, { status: 500 });
    const rows = normalized.fields.map(f => ({ ...f, template_id: templateId, owner_id: uid }));
    if (rows.length) {
      const { error: ie } = await s.from("template_fields").insert(rows);
      if (ie) return NextResponse.json({ error: "Analysis succeeded but detected fields could not be saved.", details: ie.message }, { status: 500 });
    }
    const analysis = { engine: "gemini", model: MODEL, version: 1, analyzed_at: new Date().toISOString(), raw: parsed.data, normalized_count: normalized.fields.length };
    const { error: ue } = await s.from("templates").update({ analysis_status: "ready", analysis, updated_at: new Date().toISOString() }).eq("id", templateId).eq("project_id", id);
    if (ue) return NextResponse.json({ error: "Analysis succeeded but template status could not be updated.", details: ue.message }, { status: 500 });
    return NextResponse.json({ analysis: parsed.data, fields: normalized.fields, message: "Detected template fields. Please review low-confidence boxes and source-column matches before generating cards." });
  } catch (e) {
    const details = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: "Template analysis could not be completed.", details: details.slice(0, 500) }, { status: 500 });
  }
}
