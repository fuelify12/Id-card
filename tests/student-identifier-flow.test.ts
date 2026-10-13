import { describe, expect, it } from "vitest";
import { canonicalizeStudentIdentifier } from "@/lib/identifiers/student-identifier";
import { parsePhotoFilename, proposePhotoMatch } from "@/lib/photos/matching";
import { resolveFieldValue } from "@/lib/rendering/engine";
import { buildManifests } from "@/lib/exports/archive";

describe("canonical identifier end-to-end contract", () => {
  it("keeps a zero-padded identifier consistent from import through photo match, render field and ZIP manifest", () => {
    const imported = canonicalizeStudentIdentifier("001");
    expect(imported).toMatchObject({ ok: true, value: "001" });
    const student = { id: "synthetic-student-1", serial_number: null, student_identifier: imported.ok ? imported.value : null, data: { name: "Synthetic Student" } };
    const proposal = proposePhotoMatch(parsePhotoFilename("001_Synthetic_Student.jpg"), [student]);
    expect(proposal).toMatchObject({ status: "MATCHED", studentId: "synthetic-student-1", studentIdentifier: "001" });
    expect(resolveFieldValue({ source_column: "serial_number", key: "serial_number" } as any, student as any, "Synthetic School")).toBe("001");
    const manifest = buildManifests([{ item_number: 1, student_identifier: "001", serial_number: null, student_ref: "synthetic-ref", filename: "001.png", side: "front", format: "png", sha256: "a".repeat(64), validation_status: "passed", template_version: 1, batch_id: "synthetic-batch", exported_at: "2026-10-13T00:00:00Z" }], "synthetic-export", "2026-10-13T00:00:00Z");
    expect(manifest.csv).toContain('"001"');
    expect(JSON.parse(manifest.json).items[0].student_identifier).toBe("001");
  });

  it("requires explicit prefix configuration and then preserves the complete alphanumeric identifier", () => {
    const student = { id: "synthetic-student-2", serial_number: null, student_identifier: "STU-001", data: {} };
    expect(parsePhotoFilename("STU-001.jpg").status).toBe("NEEDS_REVIEW");
    const parsed = parsePhotoFilename("STU-001.jpg", "STU");
    expect(parsed).toMatchObject({ status: "EXACT", originalSerial: "STU-001", normalizedSerial: "STU-001" });
    expect(proposePhotoMatch(parsed, [student])).toMatchObject({ status: "MATCHED", studentId: "synthetic-student-2", studentIdentifier: "STU-001" });
  });

  it("does not equate 001 and 1 unless numeric normalization is explicitly configured", () => {
    expect(proposePhotoMatch(parsePhotoFilename("001.jpg"), [{ id: "one", serial_number: 1, student_identifier: "1" }]).status).toBe("UNMATCHED");
    const policy = { normalization: "numeric" as const, caseSensitive: true, edgeWhitespace: "reject" as const, maxLength: 64 };
    const parsed = parsePhotoFilename("001.jpg", null, policy);
    expect(proposePhotoMatch(parsed, [{ id: "one", serial_number: 1, student_identifier: "1" }])).toMatchObject({ status: "MATCHED", studentId: "one", studentIdentifier: "1" });
  });
});
