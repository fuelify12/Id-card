import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { renderIdCard, validatePhysicalSize } from "@/lib/rendering/engine";
import type { RenderField, RenderStudent } from "@/lib/rendering/types";

const CARD = { widthMm: 85.6, heightMm: 54, dpi: 300 };
const student: RenderStudent = {
  id: "synthetic-student-001",
  serial_number: null,
  student_identifier: "001",
  data: { student_name: "आरव शर्मा", address: "विद्यालय मार्ग, फिरोजाबाद", admission_no: "STU-001" },
};
const fields: RenderField[] = [
  {
    id: "student-name", key: "student_name", label: "Student name", field_type: "text", required: true,
    x: 80, y: 120, width: 700, height: 100, font_family: "Noto Sans Devanagari", font_size: 36,
    font_weight: "bold", color: "#17365d", alignment: "left", fit_mode: null, source_column: "student_name",
    render_options: { maxLines: 2, wrap: true, overflowPolicy: "warn" },
  },
  {
    id: "student-identifier", key: "serial_number", label: "Student identifier", field_type: "text", required: true,
    x: 80, y: 250, width: 500, height: 70, font_family: "Noto Sans", font_size: 28,
    font_weight: "bold", color: "#202020", alignment: "left", fit_mode: null, source_column: "serial_number",
    render_options: { maxLines: 1, wrap: false, overflowPolicy: "warn" },
  },
];
const templatePromise = sharp({ create: { width: 1012, height: 638, channels: 4, background: { r: 250, g: 250, b: 246, alpha: 1 } } }).png().toBuffer();
async function render(format: "png" | "pdf", renderFields: RenderField[]) {
  return renderIdCard({
    template: await templatePromise, templateType: "image/png", templateId: "synthetic-visual-fixture",
    templateVersion: 3, fields: renderFields, student, schoolName: "विद्यालय नमूना स्कूल",
    photo: null, photoApproved: false, options: { ...CARD, format },
  });
}
async function differenceRatio(a: Buffer, b: Buffer) {
  const aa = await sharp(a).ensureAlpha().raw().toBuffer();
  const bb = await sharp(b).ensureAlpha().raw().toBuffer();
  expect(aa.length).toBe(bb.length);
  let changed = 0;
  for (let i = 0; i < aa.length; i += 4) {
    if (Math.abs(aa[i] - bb[i]) > 12 || Math.abs(aa[i + 1] - bb[i + 1]) > 12 || Math.abs(aa[i + 2] - bb[i + 2]) > 12) changed++;
  }
  return changed / (aa.length / 4);
}


async function saveVisualArtifact(name: string, bytes: Buffer) {
  const directory = process.env.PRINTFORGE_VISUAL_ARTIFACT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name), bytes);
}

describe("Phase 27 visual and print acceptance fixtures", () => {
  it("computes standard ID-card raster geometry at 300 DPI", () => {
    expect(validatePhysicalSize(CARD.widthMm, CARD.heightMm, CARD.dpi)).toEqual({ widthPx: 1011, heightPx: 638 });
  });

  it("renders a non-blank, repeatable Devanagari/leading-zero card and stays within visual-diff bounds", async () => {
    const baseline = await render("png", []);
    const first = await render("png", fields);
    const second = await render("png", fields);
    await saveVisualArtifact("phase27-card-baseline.png", baseline.bytes);
    await saveVisualArtifact("phase27-card-rendered.png", first.bytes);
    expect(first.mimeType).toBe("image/png");
    expect(first.widthPx).toBe(1011);
    expect(first.heightPx).toBe(638);
    expect(first.errors).toEqual([]);
    expect(first.outputHash).toBe(second.outputHash);
    const metadata = await sharp(first.bytes).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1011);
    expect(metadata.height).toBe(638);
    const diff = await differenceRatio(baseline.bytes, first.bytes);
    // The synthetic template is intentionally static; only mapped text should change.
    // Bounds catch blank rendering (<0.02%) and unexpectedly broad output changes (>20%).
    expect(diff).toBeGreaterThan(0.0002);
    expect(diff).toBeLessThan(0.2);
  });

  it("embeds the requested physical page size in PDF output", async () => {
    const result = await render("pdf", fields);
    await saveVisualArtifact("phase27-card-print.pdf", result.bytes);
    expect(result.mimeType).toBe("application/pdf");
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    const page = pdf.getPage(0);
    expect(page.getWidth()).toBeCloseTo((CARD.widthMm * 72) / 25.4, 2);
    expect(page.getHeight()).toBeCloseTo((CARD.heightMm * 72) / 25.4, 2);
    expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
