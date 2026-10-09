import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { zipSync, strToU8 } from "fflate";
import { parsePhotoFilename, proposePhotoMatch } from "@/lib/photos/matching";
import { mapConcurrent } from "@/lib/photos/cropping";
import { parseWorkbook } from "@/lib/imports/student-spreadsheet";
import { renderIdCard } from "@/lib/rendering/engine";
import type { RenderField, RenderStudent } from "@/lib/rendering/types";
import { buildManifests, sha256, verifyZipDirectory } from "@/lib/exports/archive";
import * as XLSX from "xlsx";

function makeWorkbook(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Synthetic Students");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const field: RenderField = {
  id: "field-name", key: "student_name", label: "Student name", field_type: "text",
  required: true, x: 5, y: 5, width: 90, height: 30, font_family: "Noto Sans",
  font_size: 8, font_weight: "bold", color: "#111111", alignment: "center",
  fit_mode: "contain", source_column: "student_name",
  render_options: { maxLines: 2, wrap: true, overflowPolicy: "warn" },
};

describe("Phase 14 synthetic workflow integration", () => {
  it("imports records, refuses ambiguous matching, renders a real card and verifies its ZIP", async () => {
    const parsed = parseWorkbook(makeWorkbook([
      ["Serial", "Student Name"], ["001", "आरव शर्मा"], ["2", "Asha"],
    ]), "synthetic.xlsx");
    expect(parsed.summary.total).toBe(2);
    expect(parsed.rows[0].serialNumber).toBe("001");

    const match = proposePhotoMatch(parsePhotoFilename("001_Aarav.jpg"), [
      { id: "student-1", serial_number: 1 }, { id: "student-duplicate", serial_number: 1 },
    ]);
    expect(match.status).toBe("NEEDS_REVIEW");
    expect(match.studentId).toBeNull();

    const template = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#eeeeee" } }).png().toBuffer();
    const student: RenderStudent = { id: "synthetic-student-1", serial_number: 1, data: { student_name: "आरव शर्मा" } };
    const rendered = await renderIdCard({
      template, templateType: "image/png", templateId: "synthetic-template", templateVersion: 1,
      fields: [field], student, schoolName: "Synthetic School", photo: null, photoApproved: false,
      options: { widthMm: 25.4, heightMm: 25.4, dpi: 100, format: "png" },
    });
    const metadata = await sharp(rendered.bytes).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
    expect(rendered.outputHash).toBe(sha256(rendered.bytes));
    const names = ["cards/001.png", "manifest.json"];
    const manifest = buildManifests([{ serial_number: "001", filename: names[0], side: "front", format: "png" }], "synthetic-export", "2026-10-09T00:00:00Z");
    const archive = zipSync({ [names[0]]: rendered.bytes, [names[1]]: strToU8(manifest.json) });
    expect(verifyZipDirectory(archive, names)).toMatchObject({ ok: true, names });
  }, 30_000);

  it("renders 300 synthetic cards with bounded concurrency and reconciles outputs and archive entries", async () => {
    const template = await sharp({ create: { width: 100, height: 100, channels: 4, background: "#f5f5f5" } }).png().toBuffer();
    const students: RenderStudent[] = Array.from({ length: 300 }, (_, i) => ({
      id: `synthetic-student-${i + 1}`, serial_number: i + 1,
      data: { student_name: `Student ${String(i + 1).padStart(3, "0")}` },
    }));
    const outputs: Buffer[] = new Array(students.length);
    const started = Date.now();
    const result = await mapConcurrent(students, 3, async (student, index) => {
      const rendered = await renderIdCard({
        template, templateType: "image/png", templateId: "synthetic-template", templateVersion: 1,
        fields: [field], student, schoolName: "Synthetic School", photo: null, photoApproved: false,
        options: { widthMm: 25.4, heightMm: 25.4, dpi: 100, format: "png" },
      });
      outputs[index] = rendered.bytes;
    });
    const elapsedMs = Date.now() - started;
    expect(result).toMatchObject({ total: 300, failed: 0 });
    expect(outputs.filter(Boolean)).toHaveLength(300);
    expect(elapsedMs).toBeGreaterThan(0);

    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < outputs.length; i++) files[`cards/${String(i + 1).padStart(3, "0")}.png`] = outputs[i];
    files["manifest.json"] = strToU8(JSON.stringify({ item_count: outputs.length, elapsed_ms: elapsedMs }));
    const expected = Object.keys(files);
    const archive = zipSync(files);
    expect(verifyZipDirectory(archive, expected)).toMatchObject({ ok: true });
    expect(verifyZipDirectory(archive, expected.slice(1)).ok).toBe(false);
  }, 120_000);
});
