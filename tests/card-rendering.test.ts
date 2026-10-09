import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { physicalPixels, renderIdCard, resolveFieldValue, validateFieldBindings, validatePhysicalSize } from "@/lib/rendering/engine";
import type { RenderField, RenderStudent } from "@/lib/rendering/types";

const student: RenderStudent = {
  id: "00000000-0000-4000-8000-000000000001",
  serial_number: 12,
  data: { student_name: "आरव शर्मा", admission_no: "A-12", class: "VIII" },
};
const field = (overrides: Partial<RenderField> = {}): RenderField => ({
  id: "f1", key: "student_name", label: "Student name", field_type: "text",
  required: true, x: 20, y: 20, width: 260, height: 50, font_family: "Noto Sans",
  font_size: 24, font_weight: "bold", color: "#112233", alignment: "left",
  fit_mode: null, source_column: "student_name", render_options: { maxLines: 2, wrap: true, overflowPolicy: "warn" },
  ...overrides,
});
async function template() {
  return sharp({ create: { width: 300, height: 400, channels: 4, background: { r: 245, g: 245, b: 245, alpha: 1 } } }).png().toBuffer();
}
const options = { widthMm: 76.2, heightMm: 101.6, dpi: 100, format: "png" as const };
async function render(bytes: Buffer, fields: RenderField[], overrides: Partial<Parameters<typeof renderIdCard>[0]> = {}) {
  return renderIdCard({
    template: bytes, templateType: "image/png", templateId: "tpl-fixture", templateVersion: 1,
    fields, student, schoolName: "Fictional School", photo: null, photoApproved: false, options, ...overrides,
  });
}

describe("card rendering compatibility", () => {
  it("converts physical dimensions to DPI pixels with safety bounds", () => {
    expect(physicalPixels(25.4, 300)).toBe(300);
    expect(validatePhysicalSize(54, 72, 300)).toEqual({ widthPx: 638, heightPx: 850 });
    expect(() => validatePhysicalSize(54, 72, 20)).toThrow(/DPI/);
    expect(() => validatePhysicalSize(500, 500, 1200)).toThrow(/24-megapixel/);
  });
  it("blocks missing required data and allows optional missing values", () => {
    expect(validateFieldBindings([field({ source_column: "missing" })], student, "School").some(i => i.severity === "error")).toBe(true);
    expect(validateFieldBindings([field({ required: false, source_column: "missing" })], student, "School").some(i => i.code === "OPTIONAL_FIELD_EMPTY")).toBe(true);
  });
  it("binds school name only through its configured project value", () => {
    const schoolField = field({ key: "school_name", label: "School", source_column: null });
    expect(resolveFieldValue(schoolField, student, "Fictional School")).toBe("Fictional School");
    expect(validateFieldBindings([schoolField], student, "Fictional School")).toEqual([]);
  });
  it("renders PNG at exact requested dimensions and produces stable hashes", async () => {
    const t = await template(), fields = [field()];
    const a = await render(t, fields), b = await render(t, fields);
    expect(a.errors).toEqual([]);
    expect(a.inputHash).toBe(b.inputHash);
    expect(a.outputHash).toBe(b.outputHash);
    const meta = await sharp(a.bytes).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(400);
    expect(meta.format).toBe("png");
  });
  it("renders Indian-language text with the bundled script font", async () => {
    const t = await template();
    const out = await render(t, [field()]);
    expect(out.bytes.length).toBeGreaterThan(100);
    expect(out.errors).toEqual([]);
  });
  it("rejects aspect-ratio mismatch instead of stretching the card", async () => {
    await expect(render(await template(), [field()], { options: { ...options, widthMm: 50, heightMm: 80 } }))
      .rejects.toThrow(/aspect ratio/i);
  });
});
