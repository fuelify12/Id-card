import { describe, expect, it } from "vitest";
import { scopedBatchIdempotencyKey } from "../lib/batch/idempotency";

const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("scopedBatchIdempotencyKey", () => {
  it("is stable for the same project and client key", () => {
    expect(scopedBatchIdempotencyKey(PROJECT_A, "request-123"))
      .toBe(scopedBatchIdempotencyKey(PROJECT_A, "request-123"));
  });

  it("separates the same client key across projects", () => {
    expect(scopedBatchIdempotencyKey(PROJECT_A, "request-123"))
      .not.toBe(scopedBatchIdempotencyKey(PROJECT_B, "request-123"));
  });

  it("trims surrounding whitespace without changing project scope", () => {
    expect(scopedBatchIdempotencyKey(PROJECT_A, " request-123 "))
      .toBe(scopedBatchIdempotencyKey(PROJECT_A, "request-123"));
  });

  it("rejects overlong keys rather than silently truncating them", () => {
    expect(() => scopedBatchIdempotencyKey(PROJECT_A, "x".repeat(129)))
      .toThrow(/128 characters or fewer/);
  });

  it("rejects invalid project identifiers", () => {
    expect(() => scopedBatchIdempotencyKey("not-a-uuid", "request-123"))
      .toThrow(/valid project ID/);
  });
});
