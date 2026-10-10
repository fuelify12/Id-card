# Prompt 18 — Persistent batch worker recovery

**Status: CODE IMPLEMENTATION PRESENT; LIVE ACCEPTANCE BLOCKED BY SUPABASE PROJECT LIMIT AND PREVIEW ACCESS.**

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
- The Phase 18 migration `phase18_batch_worker_recovery` was applied to the existing production Supabase project on 2026-10-10 under the owner's explicit authorization. It changed database functions only; no student, batch, photo, or export rows were created or modified. The migration has not been behaviorally acceptance-tested against an isolated database.

## Lease/retry semantics

- Worker endpoint max duration is 60 seconds; the stale lease is five minutes.
- Recovery is request-triggered, not a continuously running worker. Stale work is recovered on the next claim attempt.
- A stale item with attempts remaining returns to PENDING; exhausted work becomes FAILED.
- Manual retry is allowed only for FAILED items in failed/completed_with_errors batches and resets their attempt budget.
- Retry delay is exponential from one second, capped at one minute.
- In-flight items may finish after cancellation; pending items are marked skipped and the batch remains cancelled.

## Isolated acceptance — currently blocked

The owner first authorized a development branch at USD 0.01344/hour, but Supabase rejected branch creation because branching requires the Pro plan or above. No branch was created.

The owner then explicitly authorized a separate isolated project at the quoted USD 0/month project cost, in the Guru organization, with synthetic-only testing and no production changes. Supabase rejected project creation with this account/organization limit:

`The following organization members have reached their maximum limits for the number of active free projects within organizations where they are an administrator or owner: fuelify12 (2 project limit). To continue, these users will need to either delete, pause or upgrade one or more of these projects.`

A read-only project listing returned the active production project `xdoenkusrakuyyxnnkff` (Id-card) in Guru. The isolated project `prompt18-isolated-acceptance` was **not created**. No existing project was paused/deleted, no plan was upgraded, and no production configuration or data was changed. We must not pause/delete the production project or create a paid resource without explicit authorization.

Prompt 18 must not be marked live-accepted until an isolated database/storage/auth environment and a matching, accessible preview are available. Do not repeat or reapply this migration as a workaround. Its current production presence does not count as live acceptance.

## Required isolated integration run

1. Resolve the Supabase active-free-project limit safely: the owner can choose to pause/delete a confirmed non-production project or authorize an upgrade/paid isolated project. Do not assume which project may be changed.
2. Create the isolated test project in Guru, with a separate database, storage and auth environment; do not copy production data.
3. Configure an inspected Vercel preview to use only the isolated environment; keep the production project ref distinct and verify runtime configuration.
4. Use two synthetic test users/tenants and synthetic projects/template/student/photo records.
5. Apply the migration only to the isolated database and inspect migration output.
6. Interrupt a worker after claim, wait five minutes or inject a test-controlled stale heartbeat in the isolated DB, then verify the next process request reclaims the item.
7. Verify an item at max_attempts becomes FAILED rather than remaining PROCESSING.
8. Run concurrent claim requests and verify there are no duplicate live claims.
9. Test pause, resume, cancel and manual retry using the real UI/API and persisted rows.
10. Run the 300-record synthetic batch and reconcile each item against persisted counters.
11. Verify tenant B cannot read, retry, cancel, resume or process tenant A's batch.
12. Save sanitized SQL assertions, API responses, worker logs, test outputs and reproduction steps.

## Browser access block

The previously inspected Vercel preview was behind Vercel SSO and configured to use the same Supabase project ref as production. It is not safe for mutating acceptance. The read-only browser visit reached the Vercel login page, not the PrintForge application. No sign-in or mutating workflow was run. A fresh preview from the current branch, isolated runtime configuration, and an authorized test account are required.

## Automated repository checks (GitHub Actions)

Checked on 2026-10-10 against head `e2cc480a77a73a3cdeed064b9e0da39b5be6d28e` before the documentation refresh:

- Main CI: https://github.com/fuelify12/Id-card/actions/runs/38049605342 — completed successfully.
- Phase 8 rendering checks: https://github.com/fuelify12/Id-card/actions/runs/38049605329 — completed successfully.
- The documentation refresh creates a new head; its CI runs were still in progress at the last inspection.
- Repository checks do not execute the SQL migration against Supabase, exercise an interrupted persisted worker, prove tenant isolation, or substitute for a real browser acceptance run.
- PR #3 remains a draft; do not treat CI success as launch approval.

## Evidence labels

- Pure reconciliation/backoff unit tests: covered by repository CI.
- SQL migration execution and behavior: **NOT VERIFIED** in a database.
- Worker interruption/recovery, concurrency, RLS, authenticated browser acceptance, and 300-record persisted batch: **BLOCKED** by lack of isolated Supabase environment and authorized preview access.
- Phase 18 migration on production: **APPLIED under explicit owner authorization; behavior not yet acceptance-tested**.
- Phase 19 deployment and Phase 19 migration on production: **NOT PERFORMED**.
- Production student/batch/photo/export data mutation: **NOT PERFORMED**.

## Final decision

**NOT READY FOR LAUNCH.** Code implementation is present, but Prompt 18 live acceptance is blocked by Supabase's free-project limit and the protected/misconfigured preview. The owner must decide how to resolve the project limit without touching production. Do not merge or deploy this PR as proof of live acceptance.
