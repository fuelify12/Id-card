import { describe, expect, it } from "vitest";
import { canonicalizeStudentIdentifier, DEFAULT_STUDENT_IDENTIFIER_POLICY, findDuplicateIdentifiers, identifierMatches } from "@/lib/identifiers/student-identifier";

describe("canonical student identifiers", () => {
  it("preserves leading zeroes in exact mode", () => {
    const result = canonicalizeStudentIdentifier("001");
    expect(result).toMatchObject({ ok: true, value: "001" });
    expect(identifierMatches("001", "1")).toBe(false);
  });
  it("normalizes numeric IDs only when explicitly configured", () => {
    const policy = { ...DEFAULT_STUDENT_IDENTIFIER_POLICY, normalization: "numeric" as const };
    expect(canonicalizeStudentIdentifier("001", policy)).toMatchObject({ ok: true, value: "1", key: "1", legacySerialNumber: 1 });
    expect(identifierMatches("001", "1", policy)).toBe(true);
  });
  it("supports configured alphanumeric and separators", () => {
    expect(canonicalizeStudentIdentifier("STU-001")).toMatchObject({ ok: true, value: "STU-001" });
    expect(canonicalizeStudentIdentifier("2026/10.A")).toMatchObject({ ok: true, value: "2026/10.A" });
  });
  it("does not silently trim whitespace by default", () => {
    expect(canonicalizeStudentIdentifier(" 001 ")).toMatchObject({ ok: false });
    expect(canonicalizeStudentIdentifier(" 001 ", { ...DEFAULT_STUDENT_IDENTIFIER_POLICY, edgeWhitespace: "trim" })).toMatchObject({ ok: true, value: "001" });
  });
  it("rejects blank, control, and unsupported characters", () => {
    expect(canonicalizeStudentIdentifier("")).toMatchObject({ ok: false });
    expect(canonicalizeStudentIdentifier("001
")).toMatchObject({ ok: false });
    expect(canonicalizeStudentIdentifier("STU 001")).toMatchObject({ ok: false });
  });
  it("keeps exact identifiers separate in duplicate detection", () => {
    expect(findDuplicateIdentifiers(["001", "1", "001"])).toEqual(new Set(["001"]));
  });
  it("does not invent zero padding during legacy backfill semantics", () => {
    const one = canonicalizeStudentIdentifier("1");
    const padded = canonicalizeStudentIdentifier("001");
    expect(one).toMatchObject({ ok: true, value: "1" });
    expect(padded).toMatchObject({ ok: true, value: "001" });
  });
});
