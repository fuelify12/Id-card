import { describe, expect, it } from "vitest";
import { validatePersistedBatchArtifact } from "@/lib/batch/recovery";

const item = { student_id: "student-001", serial_number: null, student_identifier: "001" };
const batch = { template_id: "template-v2", template_version: 2 };
const card = {
  student_id: "student-001",
  serial_number: null,
  student_identifier: "001",
  storage_path: "owner/project/cards/card-001.png",
  render_input_hash: "a".repeat(64),
  status: "generated",
  output_sha256: "b".repeat(64),
  output_width_px: 1012,
  output_height_px: 638,
  template_id: "template-v2",
  template_version: 2,
  photo_id: "photo-001",
  photo_version: 3,
};

describe("persisted batch artifact integrity", () => {
  it("accepts a complete artifact with the exact canonical identifier and template snapshot", () => {
    expect(validatePersistedBatchArtifact(item, card, batch)).toEqual([]);
  });

  it("blocks leading-zero identifier mismatches rather than treating numeric IDs as equal", () => {
    expect(validatePersistedBatchArtifact(item, { ...card, student_identifier: "1" }, batch))
      .toContain("The persisted card identifier does not exactly match the batch item.");
  });

  it("blocks an artifact associated with another student", () => {
    expect(validatePersistedBatchArtifact(item, { ...card, student_id: "student-002" }, batch))
      .toContain("The persisted card is not associated with the expected student.");
  });

  it("blocks a stale or different template version", () => {
    expect(validatePersistedBatchArtifact(item, { ...card, template_version: 1 }, batch))
      .toContain("The persisted card does not match the selected template version.");
  });

  it("blocks missing or malformed integrity hashes and dimensions", () => {
    const reasons = validatePersistedBatchArtifact(item, {
      ...card, output_sha256: "bad", render_input_hash: "", output_width_px: 0, output_height_px: -1,
    }, batch);
    expect(reasons).toContain("The persisted render-input fingerprint is missing or invalid.");
    expect(reasons).toContain("The persisted output SHA-256 is missing or invalid.");
    expect(reasons).toContain("The persisted card dimensions are missing or invalid.");
  });

  it.each(["../outside.png", "/absolute/card.png", "https://example.invalid/card.png", "owner\\project\\card.png"])(
    "blocks unsafe storage path %s",
    (storage_path) => {
      expect(validatePersistedBatchArtifact(item, { ...card, storage_path }, batch))
        .toContain("The persisted card storage path is missing or unsafe.");
    },
  );

  it("blocks inconsistent photo snapshots but permits a template with no photo association", () => {
    expect(validatePersistedBatchArtifact(item, { ...card, photo_id: "photo-001", photo_version: null }, batch))
      .toContain("The persisted photo association has no valid photo version.");
    expect(validatePersistedBatchArtifact(item, { ...card, photo_id: null, photo_version: null }, batch)).toEqual([]);
  });

  it("does not treat a missing generated-card row as success", () => {
    expect(validatePersistedBatchArtifact(item, null, batch))
      .toContain("The renderer did not persist a generated-card record.");
  });
});
