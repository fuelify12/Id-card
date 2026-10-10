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

/** Exponential retry delay, capped at one minute. Attempt 1 waits one second. */
export function retryDelayMs(attempts: number): number {
  const normalized = Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 1;
  return Math.min(60_000, 1_000 * 2 ** Math.min(6, normalized - 1));
}
