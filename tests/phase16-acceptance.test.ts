import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import sharp from "sharp";
import { parseWorkbook } from "@/lib/imports/student-spreadsheet";
import { inspectPhotoBuffer } from "@/lib/photos/image-validation";
import { parsePhotoFilename, proposePhotoMatch } from "@/lib/photos/matching";
import { auditStudentCardIntegrity, type IntegrityChainRecord, type IntegrityManifestEntry } from "@/lib/acceptance/integrity-audit";

function syntheticWorkbook() {
  const rows: unknown[][] = [[
    "Serial Number", "Student Name", "Class", "Section", "Father Name", "Optional Note",
  ]];
  const names = ["आरव शर्मा", "Asha Patel", "प्रयांशु वर्मा", "Mohammed Aariz", "Zoë Fernandes", "A very long fictional student name for overflow testing"];
  for (let i = 1; i <= 300; i++) {
    const serial = i === 43 ? "42" : i === 100 ? "" : String(i).padStart(3, "0");
    const name = i === 101 ? "" : names[(i - 1) % names.length];
    rows.push([serial, name, String(((i - 1) % 12) + 1), ["A", "B", "C"][i % 3], i % 7 ? "Fictional Parent" : "", i % 4 ? "" : "optional"]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Synthetic School");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function record(overrides: Partial<IntegrityChainRecord> = {}): IntegrityChainRecord {
  return {
    sourceRowId: "row-1", studentId: "student-1", sourceSerial: "001", normalizedSerial: "1",
    requiredFieldsPresent: true, matchedPhotoStudentId: "student-1", matchedPhotoSha256: "photo-hash",
    approvedPhotoSha256: "photo-hash", renderedStudentId: "student-1", renderedSerial: "001",
    renderedPhotoSha256: "photo-hash", renderedTemplateVersion: 2, expectedTemplateVersion: 2,
    status: "SUCCEEDED", outputFilename: "front/001.png", outputSha256: "card-hash", ...overrides,
  };
}

describe("Phase 16 synthetic final-acceptance fixtures", () => {
  it("parses 300 fictional student rows and exposes duplicate, missing and Unicode cases", () => {
    const parsed = parseWorkbook(syntheticWorkbook(), "phase16-synthetic-students.xlsx");
    expect(parsed.summary.total).toBe(300);
    expect(parsed.rows.some(row => String(row.values["Student Name"] ?? "").includes("आरव"))).toBe(true);
    expect(parsed.rows.some(row => String(row.values["Student Name"] ?? "").includes("प्रयांशु"))).toBe(true);
    expect(parsed.summary.duplicates).toBeGreaterThan(0);
    expect(parsed.summary.missingSerial).toBeGreaterThan(0);
    expect(parsed.rows.some(row => row.values["Optional Note"] === "optional")).toBe(true);
  }, 30_000);

  it("requires review for ambiguous photo names and detects invalid, low-resolution and duplicate image content", async () => {
    expect(parsePhotoFilename("photo.jpg").status).toBe("NEEDS_REVIEW");
    const ambiguous = proposePhotoMatch(parsePhotoFilename("042_Rahul.jpg"), [
      { id: "student-a", serial_number: 42 }, { id: "student-b", serial_number: 42 },
    ]);
    expect(ambiguous.status).toBe("NEEDS_REVIEW");
    expect(ambiguous.studentId).toBeNull();

    const valid = await sharp({ create: { width: 80, height: 100, channels: 3, background: "#456789" } }).jpeg().toBuffer();
    const first = await inspectPhotoBuffer(valid);
    const duplicate = await inspectPhotoBuffer(Buffer.from(valid));
    expect(first.errors).toHaveLength(0);
    expect(first.width).toBe(80);
    expect(duplicate.sha256).toBe(first.sha256);
    const lowRes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#fff" } }).png().toBuffer();
    const low = await inspectPhotoBuffer(lowRes);
    expect(low.width).toBe(16);
    const corrupt = await inspectPhotoBuffer(Buffer.from([0, 1, 2, 3, 4, 5]));
    expect(corrupt.errors.length).toBeGreaterThan(0);
  }, 30_000);

  it("audits the full metadata/hash chain and rejects mismatched photos, stale templates and false successes", () => {
    const good = record();
    const manifest: IntegrityManifestEntry[] = [{ studentId: "student-1", serialNumber: "001", filename: "front/001.png", sha256: "card-hash" }];
    expect(auditStudentCardIntegrity([good], manifest, { "front/001.png": "card-hash" })).toMatchObject({
      ok: true, total: 1, succeeded: 1, failed: 0, skipped: 0, needsReview: 0, humanReviewRequired: ["student-1"],
    });

    const bad = record({ matchedPhotoStudentId: "student-2", renderedTemplateVersion: 1, expectedTemplateVersion: 2 });
    const result = auditStudentCardIntegrity([bad], manifest, { "front/001.png": "wrong-hash" });
    expect(result.ok).toBe(false);
    expect(result.issues.map(item => item.code)).toEqual(expect.arrayContaining([
      "PHOTO_STUDENT_MISMATCH", "STALE_TEMPLATE_VERSION", "ARCHIVE_HASH_MISMATCH",
    ]));

    const falseSuccess = record({ status: "NEEDS_REVIEW" });
    const rejected = auditStudentCardIntegrity([falseSuccess], manifest, { "front/001.png": "card-hash" });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues.map(item => item.code)).toContain("INELIGIBLE_IN_MANIFEST");
  }, 30_000);

  it("detects missing archive files, orphan manifest entries and duplicate output filenames", () => {
    const a = record();
    const b = record({ sourceRowId: "row-2", studentId: "student-2", sourceSerial: "002", normalizedSerial: "2" });
    const manifest: IntegrityManifestEntry[] = [
      { studentId: "student-1", serialNumber: "001", filename: "front/shared.png", sha256: "card-hash" },
      { studentId: "student-2", serialNumber: "002", filename: "front/shared.png", sha256: "card-hash" },
      { studentId: "ghost", serialNumber: "999", filename: "front/ghost.png", sha256: "ghost-hash" },
    ];
    const result = auditStudentCardIntegrity([
      { ...a, outputFilename: "front/shared.png" },
      { ...b, outputFilename: "front/shared.png", outputSha256: "card-hash" },
    ], manifest, { "front/shared.png": "card-hash" });
    expect(result.ok).toBe(false);
    expect(result.issues.map(item => item.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_OUTPUT_NAME", "DUPLICATE_MANIFEST_NAME", "ORPHAN_MANIFEST_ENTRY", "MANIFEST_MISMATCH",
    ]));
  });
});
