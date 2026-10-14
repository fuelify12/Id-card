export type BatchItemStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED"
  | "NEEDS_REVIEW"
  | string;

export type BatchStatus =
  | "queued"
  | "running"
  | "pausing"
  | "paused"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled"
  | string;

export type BatchOutcomeCounts = {
  total_count: number;
  eligible_count: number;
  completed_count: number;
  failed_count: number;
  review_count: number;
  skipped_count: number;
  processing_count: number;
};

/**
 * Reconcile persisted item states into display counters and a safe batch state.
 * Terminal and operator-controlled states are preserved so a stale status poll
 * cannot undo cancellation, pause, or an already-final batch.
 */
export function reconcileBatchItemStatuses(
  statuses: readonly BatchItemStatus[],
  existingStatus: BatchStatus | null | undefined,
): BatchOutcomeCounts & { status: BatchStatus } {
  const counts: BatchOutcomeCounts = {
    total_count: statuses.length,
    eligible_count: 0,
    completed_count: 0,
    failed_count: 0,
    review_count: 0,
    skipped_count: 0,
    processing_count: 0,
  };

  for (const status of statuses) {
    if (status === "SUCCEEDED") counts.completed_count += 1;
    else if (status === "FAILED") counts.failed_count += 1;
    else if (status === "NEEDS_REVIEW") counts.review_count += 1;
    else if (status === "SKIPPED") counts.skipped_count += 1;
    else if (status === "PROCESSING") counts.processing_count += 1;
  }

  counts.eligible_count = counts.total_count - counts.skipped_count;

  // An empty/corrupt batch is never a successful generation. Creation preflight
  // rejects zero eligible students; reconciliation remains fail-closed if an
  // empty item set appears because of a partial write or unexpected deletion.
  if (counts.total_count === 0) {
    const current = String(existingStatus ?? "").toLowerCase();
    const preserved = new Set(["completed", "completed_with_errors", "failed", "cancelled", "paused", "pausing"]);
    return { ...counts, status: preserved.has(current) ? current : "queued" };
  }

  const terminalCount =
    counts.completed_count +
    counts.failed_count +
    counts.review_count +
    counts.skipped_count;
  const current = String(existingStatus ?? "").toLowerCase();
  const terminalStates = new Set([
    "completed",
    "completed_with_errors",
    "failed",
    "cancelled",
  ]);

  let status: BatchStatus;
  if (terminalStates.has(current)) {
    status = current;
  } else if (current === "paused" || current === "pausing") {
    status = current;
  } else if (terminalCount === counts.total_count) {
    status =
      counts.failed_count > 0 ||
      counts.review_count > 0 ||
      counts.skipped_count > 0
        ? "completed_with_errors"
        : "completed";
  } else if (counts.processing_count > 0) {
    status = "running";
  } else {
    status = "queued";
  }

  return { ...counts, status };
}

export type PersistedBatchArtifact = {
  student_id?: string | null;
  serial_number?: number | string | null;
  student_identifier?: string | null;
  storage_path?: string | null;
  render_input_hash?: string | null;
  status?: string | null;
  output_sha256?: string | null;
  output_width_px?: number | null;
  output_height_px?: number | null;
  template_id?: string | null;
  template_version?: number | string | null;
  photo_id?: string | null;
  photo_version?: number | null;
};
export type BatchArtifactExpectation = {
  student_id: string;
  serial_number?: number | string | null;
  student_identifier?: string | null;
};
export type BatchTemplateExpectation = { template_id: string; template_version: number | string };

/**
 * Validate the persisted renderer result before marking a work item successful.
 * This is intentionally strict: an identity/template/hash mismatch is a review
 * outcome, not a success that can leak into an export.
 */
export function validatePersistedBatchArtifact(
  item: BatchArtifactExpectation,
  card: PersistedBatchArtifact | null | undefined,
  batch: BatchTemplateExpectation,
): string[] {
  const reasons: string[] = [];
  if (!card) return ["The renderer did not persist a generated-card record."];
  const expectedIdentifier = String(item.student_identifier ?? item.serial_number ?? "");
  const actualIdentifier = String(card.student_identifier ?? card.serial_number ?? "");
  if (!expectedIdentifier || actualIdentifier !== expectedIdentifier) {
    reasons.push("The persisted card identifier does not exactly match the batch item.");
  }
  if (!card.student_id || card.student_id !== item.student_id) {
    reasons.push("The persisted card is not associated with the expected student.");
  }
  if (card.status !== "generated") reasons.push("The persisted card is not in generated state.");
  if (!card.storage_path || card.storage_path.startsWith("/") || card.storage_path.includes("\\") ||
      card.storage_path.split("/").some((part) => part === "." || part === "..") ||
      /^[a-z]+:\/\//i.test(card.storage_path)) {
    reasons.push("The persisted card storage path is missing or unsafe.");
  }
  if (!card.render_input_hash || !/^[a-f0-9]{64}$/i.test(card.render_input_hash)) {
    reasons.push("The persisted render-input fingerprint is missing or invalid.");
  }
  if (!card.output_sha256 || !/^[a-f0-9]{64}$/i.test(card.output_sha256)) {
    reasons.push("The persisted output SHA-256 is missing or invalid.");
  }
  if (!Number.isFinite(Number(card.output_width_px)) || Number(card.output_width_px) <= 0 ||
      !Number.isFinite(Number(card.output_height_px)) || Number(card.output_height_px) <= 0) {
    reasons.push("The persisted card dimensions are missing or invalid.");
  }
  if (card.template_id !== batch.template_id ||
      Number(card.template_version) !== Number(batch.template_version)) {
    reasons.push("The persisted card does not match the selected template version.");
  }
  if (card.photo_id && (!Number.isInteger(Number(card.photo_version)) || Number(card.photo_version) < 1)) {
    reasons.push("The persisted photo association has no valid photo version.");
  }
  if (!card.photo_id && card.photo_version != null) {
    reasons.push("A photo version exists without a persisted photo association.");
  }
  return reasons;
}

/** Exponential retry delay, capped at one minute. Attempt 1 waits one second. */
export function retryDelayMs(attempts: number): number {
  const normalized = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
  return Math.min(60_000, 1_000 * 2 ** Math.min(6, normalized - 1));
}
