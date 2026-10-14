import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderIdCard } from "@/lib/rendering/engine";
import type { RenderField, RenderStudent } from "@/lib/rendering/types";

const CARD_TEMPLATE = sharp({
  create: { width: 320, height: 202, channels: 4, background: { r: 248, g: 249, b: 252, alpha: 1 } },
}).png().toBuffer();
const fields: RenderField[] = [{
  id: "student-name", key: "student_name", label: "Student name", field_type: "text", required: true,
  x: 18, y: 36, width: 280, height: 58, font_family: "Noto Sans", font_size: 18, font_weight: "bold",
  color: "#15233b", alignment: "left", fit_mode: null, source_column: "student_name",
  render_options: { maxLines: 2, wrap: true, overflowPolicy: "warn" },
}, {
  id: "student-id", key: "serial_number", label: "Student identifier", field_type: "text", required: true,
  x: 18, y: 110, width: 250, height: 40, font_family: "Noto Sans", font_size: 14, font_weight: "bold",
  color: "#27364b", alignment: "left", fit_mode: null, source_column: "serial_number",
  render_options: { maxLines: 1, wrap: false, overflowPolicy: "warn" },
}];

async function renderStudent(index: number) {
  const identifier = String(index + 1).padStart(3, "0");
  const student: RenderStudent = {
    id: `synthetic-${identifier}`,
    serial_number: null,
    student_identifier: identifier,
    data: {
      student_name: index % 3 === 0 ? `आरव शर्मा ${identifier}` : index % 3 === 1 ? `Student ${identifier}` : `Priyanshu LongSurname ${identifier}`,
      address: `Synthetic Road ${identifier}`,
    },
  };
  return renderIdCard({
    template: await CARD_TEMPLATE, templateType: "image/png", templateId: "synthetic-300-batch",
    templateVersion: 1, fields, student, schoolName: "Synthetic School",
    photo: null, photoApproved: false,
    options: { widthMm: 85.6, heightMm: 54, dpi: 300, format: "png" },
  });
}

describe("Phase 27 synthetic 300-card render load", () => {
  it("renders 300 unique synthetic students with valid physical dimensions and no silent loss", async () => {
    const started = Date.now();
    const outputs: Awaited<ReturnType<typeof renderStudent>>[] = [];
    // Four concurrent renders mimic a bounded worker pool without creating an unbounded fan-out.
    for (let start = 0; start < 300; start += 4) {
      const end = Math.min(start + 4, 300);
      outputs.push(...await Promise.all(Array.from({ length: end - start }, (_, offset) => renderStudent(start + offset))));
    }
    const elapsedMs = Date.now() - started;
    expect(outputs).toHaveLength(300);
    expect(outputs.every((item) => item.mimeType === "image/png" && item.widthPx === 1011 && item.heightPx === 638)).toBe(true);
    expect(outputs.every((item) => item.bytes.length > 1000 && item.errors.length === 0)).toBe(true);
    expect(new Set(outputs.map((item) => item.outputHash)).size).toBe(300);
    // Timing is evidence only; no unsupported throughput SLA is imposed by this test.
    console.info(`Phase 27 synthetic renderer: 300/300 cards, bounded concurrency=4, elapsedMs=${elapsedMs}`);
  }, 180000);
});
