export const PHOTO_PROCESSING_ACTIONS = ["process", "reprocess", "adjust", "approve"] as const;

export type PhotoProcessingAction = (typeof PHOTO_PROCESSING_ACTIONS)[number];

export function isSupportedPhotoAction(value: unknown): value is PhotoProcessingAction {
  return typeof value === "string" && (PHOTO_PROCESSING_ACTIONS as readonly string[]).includes(value);
}

export function failedPhotoProcessingUpdate(
  code: string,
  warning: string,
  attempts: number | null | undefined,
  now = new Date().toISOString(),
) {
  const previousAttempts = Number.isFinite(attempts) ? Math.max(0, Math.trunc(Number(attempts))) : 0;
  return {
    processing_status: "PROCESSING_FAILED" as const,
    processing_error_code: code,
    processing_warnings: [warning],
    processing_attempts: previousAttempts + 1,
    processed_at: now,
  };
}

export function invalidCropReviewUpdate(warnings: string[], now = new Date().toISOString()) {
  return {
    processing_status: "NEEDS_REVIEW" as const,
    processing_error_code: "INVALID_CROP_SETTINGS",
    processing_warnings: [...new Set([...warnings, "INVALID_CROP_SETTINGS"])],
    processed_at: now,
  };
}
