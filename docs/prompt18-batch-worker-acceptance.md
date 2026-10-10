# Prompt 18 — Persistent batch worker recovery

**Status: CODE IMPLEMENTATION PRESENT; LIVE ACCEPTANCE BLOCKED BY SUPABASE PLAN RESTRICTION AND PREVIEW ACCESS.**

## Verified baseline

- Repository: fuelify12/Id-card
- Draft PR: #3, branch `prompt-18-batch-worker-recovery`, stacked on Prompt 17 draft PR #2.
- Prompt 17 browser acceptance remains blocked.
- Supabase project Id-card is active in the Guru organization.
- The existing worker is request-triggered by the authenticated batch API and uses `public.claim_batch_generation_items`.
- Existing SQL claim logic selected PENDING rows but did not reclaim stale PROCESSING claims after a worker interruption.
- The API needed stronger conditional state transitions and atomic retry semantics.

## Changes in this branch

- Added pure batch outcome reconciliation and bounded retry-backoff helpers with Vitest coverage.
- Added a forward SQL migration to recover stale PROCESSING items after five minutes, terminalize exhausted work, enforce max_attempts, serialize claims against the batch row, and add an owner-scoped atomic retry RPC.
- Updated the API to use conditional state transitions and the retry RPC.
- Added authenticated latest-batch lookup and UI restoration after reload.
- No migration has been applied to production. No student, batch, photo, or export data was created or modified.

## Lease/retry semantics

- Worker endpoint max duration is 60 seconds; the stale lease is five minutes.
- Recovery is request-triggered, not a continuously running worker. Stale work is recovered on the next claim attempt.
- A stale item with attempts remaining returns to PENDING; exhausted work becomes FAILED.
- Manual retry is allowed only for FAILED items in failed/completed_with_errors batches and resets their attempt budget.
- Retry delay is exponential from one second, capped at one minute.
- In-flight items may finish after cancellation; pending items are marked skipped and the batch remains cancelled.

## Isolated acceptance — currently blocked

The owner approved a development branch at the quoted cost of USD 0.01344/hour. The Supabase create-branch API then returned:

`PaymentRequiredException: Branching is supported only on the Pro plan or above`

The branch `prompt-18-isolated-acceptance` was **not created**. The current Supabase project has no development branches. Cost confirmation does not override the Pro-plan requirement. No plan upgrade or separate paid project was authorized or attempted.

Prompt 18 must not be marked live-accepted until an isolated database/storage/auth environment and a matching, accessible preview are available. Do not apply this migration to production as a workaround.

## Required isolated integration run

1. Provide an isolated Supabase branch after the project has a plan that supports branching, or separately authorize an isolated test project and its cost.
2. Configure an inspected Vercel preview to use only that isolated database, storage and auth environment; keep the production project ref distinct and verify runtime configuration.
3. Use two synthetic test users/tenants and synthetic projects/template/student/photo records.
4. Apply the migration only to the isolated database and inspect migration output.
5. Interrupt a worker after claim, wait five minutes or inject a test-controlled stale heartbeat in the isolated DB, then verify the next process request reclaims the item.
6. Verify an item at max_attempts becomes FAILED rather than remaining PROCESSING.
7. Run concurrent claim requests and verify there are no duplicate live claims.
8. Test pause, resume, cancel and manual retry using the real UI/API and persisted rows.
9. Run the 300-record synthetic batch and reconcile each item against persisted counters.
10. Verify tenant B cannot read, retry, cancel, resume or process tenant A's batch.
11. Save sanitized SQL assertions, API responses, worker logs, test outputs and reproduction steps.

## Browser access block

The previously inspected Vercel preview was behind Vercel SSO and configured to use the same Supabase project ref as production. It is not safe for mutating acceptance. The read-only browser visit reached the Vercel login page, not the PrintForge application. No sign-in or mutating workflow was run. A fresh preview from the current branch, isolated runtime configuration, and an authorized test account are required.

## Automated repository checks (GitHub Actions)

Checked on 2026-10-10 against latest head `e2cc480a77a73a3cdeed064b9e0da39b5be6d28e`:

- Main CI: https://github.com/fuelify12/Id-card/actions/runs/38049605342 — completed successfully.
- Phase 8 rendering checks: https://github.com/fuelify12/Id-card/actions/runs/38049605329 — completed successfully.
- These repository checks do not execute the SQL migration against Supabase, exercise an interrupted persisted worker, prove tenant isolation, or substitute for a real browser acceptance run.
- PR #3 remains a draft; do not treat CI success as launch approval.

## Evidence labels

- Pure reconciliation/backoff unit tests: covered by repository CI.
- SQL migration execution and behavior: **NOT VERIFIED** in a database.
- Worker interruption/recovery, concurrency, RLS, authenticated browser acceptance, and 300-record persisted batch: **BLOCKED** by lack of isolated Supabase environment and authorized preview access.
- Production deployment, production migration, and production data mutation: **NOT PERFORMED**.

## Final decision

**NOT READY FOR LAUNCH.** The code implementation and current automated repository checks are present, but Prompt 18 live acceptance is blocked. The next environment step requires a Supabase plan supporting branching or explicit authorization for a separate isolated project. Do not merge or deploy this PR as proof of live acceptance.
