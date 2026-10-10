import { describe, expect, it } from "vitest";
import { reconcileBatchItemStatuses, retryDelayMs } from "./recovery";

describe("reconcileBatchItemStatuses", () => {
  it("reconciles all successful outcomes to completed", () => {
    expect(reconcileBatchItemStatuses(["SUCCEEDED", "SUCCEEDED"], "running")).toMatchObject({
      total_count: 2,
      eligible_count: 2,
      completed_count: 2,
      failed_count: 0,
      status: "completed",
    });
  });

  it("does not report a batch complete while work is pending or processing", () => {
    expect(reconcileBatchItemStatuses(["SUCCEEDED", "PROCESSING", "PENDING"], "running")).toMatchObject({
      total_count: 3,
      completed_count: 1,
      processing_count: 1,
      status: "running",
    });
    expect(reconcileBatchItemStatuses(["PENDING", "PENDING"], "queued").status).toBe("queued");
  });

  it("marks terminal failures, review items, and skipped items as completed with errors", () => {
    expect(reconcileBatchItemStatuses(["SUCCEEDED", "FAILED"], "running").status).toBe("completed_with_errors");
    expect(reconcileBatchItemStatuses(["NEEDS_REVIEW"], "running").status).toBe("completed_with_errors");
    expect(reconcileBatchItemStatuses(["SKIPPED"], "running")).toMatchObject({
      eligible_count: 0,
      skipped_count: 1,
      status: "completed_with_errors",
    });
  });

  it("preserves operator-controlled and terminal states during stale status refreshes", () => {
    expect(reconcileBatchItemStatuses(["PENDING", "PROCESSING"], "paused").status).toBe("paused");
    expect(reconcileBatchItemStatuses(["PENDING"], "pausing").status).toBe("pausing");
    expect(reconcileBatchItemStatuses(["PENDING", "PROCESSING"], "cancelled").status).toBe("cancelled");
    expect(reconcileBatchItemStatuses(["PENDING"], "completed").status).toBe("completed");
  });

  it("reconciles a 300-item batch without losing outcome counts", () => {
    const statuses = [
      ...Array.from({ length: 270 }, () => "SUCCEEDED"),
      ...Array.from({ length: 10 }, () => "FAILED"),
      ...Array.from({ length: 5 }, () => "NEEDS_REVIEW"),
      ...Array.from({ length: 5 }, () => "SKIPPED"),
      ...Array.from({ length: 10 }, () => "PENDING"),
    ];
    expect(reconcileBatchItemStatuses(statuses, "running")).toMatchObject({
      total_count: 300,
      eligible_count: 295,
      completed_count: 270,
      failed_count: 10,
      review_count: 5,
      skipped_count: 5,
      status: "queued",
    });
  });
});

describe("retryDelayMs", () => {
  it("uses bounded exponential backoff", () => {
    expect(retryDelayMs(1)).toBe(1_000);
    expect(retryDelayMs(2)).toBe(2_000);
    expect(retryDelayMs(3)).toBe(4_000);
    expect(retryDelayMs(99)).toBe(60_000);
    expect(retryDelayMs(Number.NaN)).toBe(1_000);
  });
});
