import { createHash } from "node:crypto";

/**
 * Scope client-provided idempotency keys to a single project while keeping
 * the stored key bounded and opaque. The database's existing uniqueness
 * constraint is (owner_id, idempotency_key), so the project scope must be
 * part of the digest until that constraint is reconciled by a migration.
 */
export function scopedBatchIdempotencyKey(projectId: string, clientKey: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    throw new Error("A valid project ID is required.");
  }
  const normalized = clientKey.trim();
  if (!normalized) throw new Error("An idempotency key is required.");
  if (normalized.length > 128) {
    throw new Error("Idempotency key must be 128 characters or fewer.");
  }
  return createHash("sha256")
    .update("printforge-batch-idempotency-v1")
    .update("\0")
    .update(projectId)
    .update("\0")
    .update(normalized)
    .digest("hex");
}
