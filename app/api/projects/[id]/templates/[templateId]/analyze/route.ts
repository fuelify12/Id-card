import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { templateAnalysisSchema, normalizeAnalysis } from "@/lib/ai/template-schema";

const MODEL = process.env.GEMINI_TEMPLATE_MODEL || "gemini-2.5-flash";
const PROMPT = `Analyze this school ID-card template image. Detect visible text and likely variable fields, including school name, student name, class, section, roll number, admission number, DOB, parent information, address, academic session, photo placeholder, and other data regions. Return ONLY JSON matching the supplied schema. Coordinates must be [ymin,xmin,ymax,xmax] normalized 0-1000. Never invent a field when there is no visual evidence. A photo region should be fieldType photo and confidence should reflect visual certainty. Keep static decorative text in detectedText and do not turn it into a variable field unless evidence suggests it is data-driven.`;
const responseSchema = {
  type: "OBJECT",
  properties: {
    width: { type: "INTEGER" },
    height: { type: "INTEGER" },
    detectedText: { type: "ARRAY", items: { type: "OBJECT", properties: { text: { type: "STRING" }, box: { type: "ARRAY", items: { type: "NUMBER" }, minItems: 4, maxItems: 4 } }, required: ["text", "box"] } },
    fields: { type: "ARRAY", items: { type: "OBJECT", properties: {
      label: { type: "STRING" }, key: { type: "STRING" }, fieldType: { type: "STRING", enum: ["text", "photo", "school_name", "student_name", "class", "section", "roll_number", "admission_number", "dob", "parent", "address", "session", "other"] },
      confidence: { type: "NUMBER" }, box: { type: "ARRAY", items: { type: "NUMBER" }, minItems: 4, maxItems: 4 }, detectedText: { type: "STRING" }, required: { type: "BOOLEAN" },
      suggestedSourceColumn: { type: "STRING" }, alignment: { type: "STRING", enum: ["left", "center", "right"] }, fontFamily: { type: "STRING" }, fontSizeRatio: { type: "NUMBER" },
      color: { type: "STRING" }, fitMode: { type: "STRING", enum: ["cover", "contain", "fill"] }
    }, required: ["label", "key", "fieldType", "confidence", "box", "required", "alignment", "fontFamily", "fontSizeRatio", "color", "fitMode"] } },
    notes: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["width", "height", "detectedText", "fields", "notes"]
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const { id, templateId } = await params;
    const s = await createClient();
    const { data: claims } = await s.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    if (!process.env.GEMINI_API_KEY?.trim()) return NextResponse.json({ error: "Gemini API key is missing from this deployment. Add GEMINI_API_KEY in Vercel and redeploy." }, { status: 503 });

    const { data: t, error } = await s.from("templates").select("id,project_id,owner_id,source_path,source_type,width_px,height_px").eq("id", templateId).eq("project_id", id).maybeSingle();
    if (error) return NextResponse.json({ error: "Could not load template metadata.", details: error.message }, { status: 500 });
    if (!t) return NextResponse.json({ error: "Template not found in this project." }, { status: 404 });
    if (t.owner_id !== uid) return NextResponse.json({ error: "You do not have access to this template." }, { status: 403 });
    if (!["png", "jpeg"].includes(t.source_type)) return NextResponse.json({ error: "AI analysis currently supports PNG and JPG/JPEG templates. Convert this template to PNG or JPG and upload again." }, { status: 415 });

    const { data: file, error: fe } = await s.storage.from("printforge-templates").download(t.source_path);
    if (fe || !file) return NextResponse.json({ error: "Could not download the template for analysis.", details: fe?.message }, { status: 500 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Template is too large for analysis (20 MB maximum)." }, { status: 413 });

    const mimeType = t.source_type === "png" ? "image/png" : "image/jpeg";
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const gr = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: bytes.toString("base64") } }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.1 }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000)
    });
    if (!gr.ok) {
      const providerBody = await gr.text();
      let providerMessage = `Gemini API returned HTTP ${gr.status}.`;
      try { providerMessage = JSON.parse(providerBody)?.error?.message || providerMessage; } catch {}
      const status = gr.status === 401 || gr.status === 403 ? 502 : gr.status === 429 ? 429 : 502;
      return NextResponse.json({ error: "Gemini analysis failed.", details: providerMessage.slice(0, 700), model: MODEL }, { status });
    }

    const gj = await gr.json();
    const text = gj.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("").trim();
    if (typeof text !== "string" || !text) return NextResponse.json({ error: "Gemini returned no structured output.", details: gj.promptFeedback?.blockReason || "Empty model response." }, { status: 502 });
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return NextResponse.json({ error: "Gemini returned invalid JSON. Please retry the analysis." }, { status: 502 }); }
    const parsed = templateAnalysisSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Gemini output failed schema validation.", details: parsed.error.issues.slice(0, 5) }, { status: 502 });

    const normalized = normalizeAnalysis(parsed.data);
    const { error: del } = await s.from("template_fields").delete().eq("template_id", templateId);
    if (del) return NextResponse.json({ error: "Analysis succeeded but existing field map could not be replaced.", details: del.message }, { status: 500 });
    const rows = normalized.fields.map(f => ({ ...f, template_id: templateId, owner_id: uid }));
    if (rows.length) {
      const { error: ie } = await s.from("template_fields").insert(rows);
      if (ie) return NextResponse.json({ error: "Analysis succeeded but mapped fields could not be saved.", details: ie.message }, { status: 500 });
    }
    const analysis = { engine: "gemini", model: MODEL, version: 1, analyzed_at: new Date().toISOString(), raw: parsed.data, normalized_count: normalized.fields.length };
    const { error: ue } = await s.from("templates").update({ analysis_status: "ready", analysis, updated_at: new Date().toISOString() }).eq("id", templateId).eq("project_id", id);
    if (ue) return NextResponse.json({ error: "Analysis succeeded but template status could not be updated.", details: ue.message }, { status: 500 });
    return NextResponse.json({ analysis: parsed.data, fields: normalized.fields });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: "Template analysis could not be completed.", details: message.slice(0, 500) }, { status: 500 });
  }
}
