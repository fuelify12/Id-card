import { describe, expect, it } from "vitest";
import { validateStudents } from "@/lib/validation/engine";

describe("legacy identifier review gate", () => {
  it("blocks a backfilled numeric identifier until the owner explicitly reviews it", () => {
    const findings = validateStudents([{
      id: "synthetic-student",
      serial_number: 1,
      student_identifier: "1",
      student_identifier_source: "legacy_numeric_backfill",
      student_identifier_review_required: true,
      data: { name: "Synthetic Student" },
    }], []);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "STUDENT_IDENTIFIER_REVIEW_REQUIRED", severity: "CRITICAL", studentId: "synthetic-student" }),
    ]));
  });
  it("does not block a newly imported or explicitly corrected identifier", () => {
    const findings = validateStudents([{
      id: "synthetic-student",
      serial_number: null,
      student_identifier: "STU-001",
      student_identifier_source: "spreadsheet",
      student_identifier_review_required: false,
      data: { name: "Synthetic Student" },
    }], []);
    expect(findings.some(f => f.ruleId === "STUDENT_IDENTIFIER_REVIEW_REQUIRED")).toBe(false);
  });
});
