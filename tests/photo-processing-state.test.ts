import { describe, expect, it } from "vitest";
import {
  failedPhotoProcessingUpdate,
  invalidCropReviewUpdate,
  isSupportedPhotoAction,
} from "@/lib/photos/processing-state";

describe("photo processing action and failure states", () => {
  it("accepts the actions used by the crop-review UI, including reprocess", () => {
    for (const action of ["process", "reprocess", "adjust", "approve"]) {
      expect(isSupportedPhotoAction(action)).toBe(true);
    }
    for (const action of ["delete", "upload", null, {}]) {
      expect(isSupportedPhotoAction(action)).toBe(false);
    }
  });

  it("records an explicit retryable failure instead of leaving a photo stuck processing", () => {
    expect(failedPhotoProcessingUpdate("CORRUPT_IMAGE", "CORRUPT_OR_UNSUPPORTED_IMAGE", 2, "2026-10-13T00:00:00.000Z")).toEqual({
      processing_status: "PROCESSING_FAILED",
      processing_error_code: "CORRUPT_IMAGE",
      processing_warnings: ["CORRUPT_OR_UNSUPPORTED_IMAGE"],
      processing_attempts: 3,
      processed_at: "2026-10-13T00:00:00.000Z",
    });
  });

  it("handles null and malformed attempt counts without writing NaN", () => {
    expect(failedPhotoProcessingUpdate("INVALID_FILE", "EMPTY_IMAGE", null, "now").processing_attempts).toBe(1);
  });

  it("keeps invalid manual crops in review and deduplicates warnings", () => {
    expect(invalidCropReviewUpdate(["LOW_SHARPNESS_REVIEW", "INVALID_CROP_SETTINGS"], "now")).toEqual({
      processing_status: "NEEDS_REVIEW",
      processing_error_code: "INVALID_CROP_SETTINGS",
      processing_warnings: ["LOW_SHARPNESS_REVIEW", "INVALID_CROP_SETTINGS"],
      processed_at: "now",
    });
  });
});
