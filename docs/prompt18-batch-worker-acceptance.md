# Prompt 18 — Persistent batch worker recovery

**Status: IMPLEMENTATION IN PROGRESS; live recovery acceptance BLOCKED.**

## Verified baseline

- Repository: fuelify12/Id-card
- Base: Prompt 17 draft PR #2, branch prompt-17-browser-acceptance, commit 3f78405da793a78b815a67e46bc8ca538dfb5d88
- Prompt 17 remains a draft and reports browser acceptance blocked.
- Supabase project Id-card is active in the Guru organization; no development branch was listed during inspection.
- The existing worker is request-triggered by the authenticated batch API and uses public.claim_batch_generation_items.
- Existing SQL claim logic only selected PENDING rows. It did not reclaim stale PROCESSING claims after a worker interruption.
- The API had direct pause/resume/cancel/retry status updates with insufficient compare-and-set guards, and retry did not reset the exhausted attempt counter.
- The browser workspace polls persisted status and repeatedly invokes the process action while status is queued/running.

## Changes in this branch

- Added pure batch outcome reconciliation and bounded retry-backoff helpers with Vitest coverage.
- Added a forward SQL migration that:
  - recovers PROCESSING items with stale heartbeats/claims after five minutes;
  - terminalizes exhausted work instead of leaving it stuck;
  - prevents claims beyond max_attempts;
  - serializes claims against the batch row;
  - adds an atomic owner-scoped RPC for manually retrying failed items and resetting their retry budget.
- Updated the API to use conditional status transitions and the retry RPC.
- No migration has been applied to the live Supabase project. No student, batch, photo, or export data was created or modified.

## Lease/retry semantics

- Worker endpoint max duration is 60 seconds; a five-minute stale lease is intentionally longer than one request.
- A future claim request performs stale-lease recovery. This is request-triggered recovery, not a continuously running worker; if no further process request arrives, stale work remains until the next claim attempt.
- A stale item with attempts remaining returns to pending and can be claimed again. An item whose attempt budget is exhausted becomes failed.
- Manual retry is allowed only for batches in failed or completed_with_errors, and only persisted FAILED items are reset.
- Retry delay is exponential from one second, capped at one minute.
- In-flight items are allowed to finish after cancellation; pending items are marked skipped. Batch status remains cancelled and no further work may be claimed.

## Required isolated integration run

This phase must not be represented as live acceptance until all of the following have been executed against an isolated Supabase branch/project and a matching Vercel preview:

1. Apply the migration on the isolated database and inspect migration output.
2. Create two synthetic test users/tenants and synthetic projects/template/student/photo records.
3. Start a batch, terminate the worker process after a claim, wait at least five minutes or inject a test-controlled stale heartbeat in the isolated DB, then invoke the process action and verify the item is reclaimed.
4. Verify an item at max_attempts becomes FAILED rather than stuck PROCESSING.
5. Run duplicate claim requests concurrently and verify no item has two simultaneous live claims.
6. Test pause, resume, cancel, and manual retry using the real UI/API and persisted rows.
7. Run the 300-record synthetic batch and reconcile every item status against the batch counters.
8. Verify tenant B cannot read, retry, cancel, resume, or process tenant A's batch.
9. Save sanitized SQL assertions, API responses, worker logs, test outputs and reproduction steps.

## Cost and authorization gate

Supabase reported the development branch cost for the Guru organization as USD 0.01344/hour. No branch was created because owner cost confirmation is required first. No production migration or mutating test was performed.

## Evidence labels

- Unit tests for pure reconciliation/backoff logic can pass without Supabase.
- SQL migration syntax and behavior remain unverified until run on an isolated branch.
- Live interruption/restart, concurrency, RLS, browser recovery, and 300-record batch checks remain BLOCKED until the isolated environment and authorized test access are available.
