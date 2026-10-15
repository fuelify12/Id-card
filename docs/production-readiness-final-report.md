# PrintForge ID Card Studio — Production Readiness Report

**Verdict: NOT PRODUCTION-READY.** This report records the state of the completion branch without treating a successful application build as end-to-end acceptance.

## Repository and release state

- Repository: https://github.com/fuelify12/Id-card
- Working branch: `phase-31-provenance-analysis`
- Starting Phase 31 reference: `cd9101c19bc38bb6debb9bf6fc6699a8ae4f4445`
- Implementation commit for the scoped-idempotency fix: [`ad0c53d`](https://github.com/fuelify12/Id-card/commit/ad0c53dc603d38be81a6c910180d8a90fdb90811)
- Existing draft PR: [#14](https://github.com/fuelify12/Id-card/pull/14) — keep unmerged pending the mandatory gates below.
- Previous Phase 30 draft PR: [#13](https://github.com/fuelify12/Id-card/pull/13).
- No Production deployment, PR merge, Supabase reset, or database mutation was performed by this work.

## Implemented in this completion pass

### Batch idempotency isolation

The batch creation route previously looked up an idempotency key by owner alone, even though batch creation is project-scoped. Reusing the same client key in two school projects could cause the second request to return the first project's batch ID. The database's existing uniqueness index is owner/key scoped, so the route now hashes the normalized client key together with the project ID and also includes the project ID in duplicate lookups.

- Added `lib/batch/idempotency.ts`.
- Added `tests/batch-idempotency.test.ts` covering stable retries, project separation, whitespace normalization, overlong keys, and invalid project IDs.
- Updated `app/api/projects/[id]/batch/route.ts` to reject overlong keys instead of silently truncating them, scope the key, and scope both idempotency lookups by project.
- Implementation commit: [`ad0c53d`](https://github.com/fuelify12/Id-card/commit/ad0c53dc603d38be81a6c910180d8a90fdb90811).

This is a targeted code fix; it does not establish full tenant-isolation acceptance or replace the required live negative tests.

## Migration-chain finding and repair decision

The canonical migration chain still has a confirmed failure:

- Foundation: `supabase/migrations/20261008173336_phase1_foundation.sql` creates `public.templates` without `version_number` or `is_active`.
- Failing migration: `supabase/migrations/20261009054041_phase8_template_sides.sql` uses `is_active = true` in a partial unique index.
- Legacy source: `supabase/phase3_project_templates.sql` adds the two columns, related indexes, `public.set_active_template_version(uuid, uuid)`, and privilege changes, but is outside the canonical migration directory and absent from the 39-entry authoritative Production ledger.
- Existing evidence does not establish the exact mechanism or ledger record for the legacy SQL's historical Production application.

**No migration file was rewritten and no ledger/checksum was fabricated.** A migration timestamp inserted before Phase 8 would be historical-looking but unsupported; a later timestamp cannot repair a fresh replay that fails earlier; changing the recorded Phase 8 migration would violate migration immutability. Production and the existing populated isolated Supabase project remain untouched. The migration defect requires an authoritative deployment record or approved ledger reconciliation before a safe forward-only repair can be selected.

## CI evidence

- Full regression workflow: [run 38692847649](https://github.com/fuelify12/Id-card/actions/runs/38692847649). On implementation commit `ad0c53dc603d38be81a6c910180d8a90fdb90811`, the job reported successful dependency installation, dependency vulnerability gate, repository security checks, Phase 28 migration contract, Phase 29 authoritative-ledger checksum contract, full regression tests, TypeScript, lint, production build, client-bundle secret exposure check, and synthetic visual/print artifact upload. Check the linked run's final conclusion before treating the workflow as completed.
- Clean-room migration replay: [run 38692847698](https://github.com/fuelify12/Id-card/actions/runs/38692847698). The authoritative checksum and inventory steps passed; local Supabase startup eventually proceeded despite ECR throttling, but replay failed at Phase 8 with PostgreSQL SQLSTATE `42703`: column `is_active` does not exist. Database history and SQL tests were skipped after the failure.
- Earlier replay evidence: [run 38687786585](https://github.com/fuelify12/Id-card/actions/runs/38687786585), which also records the missing-column defect.
- The replay workflow uploads a sanitized summary artifact: [artifact for run 38692847698](https://github.com/fuelify12/Id-card/actions/runs/38692847698/artifacts/11952433542).

## Preview and environment

- Vercel project: `printforge-phase27-acceptance`.
- Preview deployment for implementation SHA `ad0c53dc603d38be81a6c910180d8a90fdb90811`: [deployment details](https://vercel.com/yash-6966/printforge-phase27-acceptance/5GsfsfsvUTPeqdNWhoXB6sNwTsuA).
- At inspection, deployment state was `BUILDING`/queued and target was `null` (Preview, not Production).
- Vercel project SSO protection is enabled. Backend-to-Preview alignment remains **NOT VERIFIED** because authorized environment metadata access did not establish the target Supabase project. No secrets were printed or copied.
- No authenticated browser session was available for a real signed-in acceptance run.

## Acceptance matrix

| Gate | Status | Evidence / remaining requirement |
|---|---|---|
| Existing repository and branch preserved | PASS | Changes remain on the dedicated Phase 31 branch; prior draft PR preserved |
| Batch idempotency project scope | PASS | Code change and five focused unit tests in the full regression suite |
| Dependency audit and repository security checks | PASS on implementation SHA | [run 38692847649](https://github.com/fuelify12/Id-card/actions/runs/38692847649); inspect final workflow conclusion |
| TypeScript, lint, production build, client secret scan | PASS on implementation SHA | [run 38692847649](https://github.com/fuelify12/Id-card/actions/runs/38692847649); inspect final workflow conclusion |
| Migration inventory and authoritative checksum | PASS | [run 38692847698](https://github.com/fuelify12/Id-card/actions/runs/38692847698) |
| Fresh canonical migration replay | FAIL | SQLSTATE 42703 at Phase 8; `is_active` absent |
| Final schema/function/grant/RLS catalog assertions after replay | NOT VERIFIED | Replay failed before catalog checks |
| Authoritative legacy Phase 3 deployment provenance | BLOCKED | Exact deployment record or approved ledger reconciliation unavailable |
| Authenticated browser E2E | BLOCKED | Authorized test account/session and verified isolated Preview configuration required |
| Real 300-student persisted batch | NOT VERIFIED | No authenticated synthetic end-to-end batch run |
| Worker recovery after browser close/process crash | FAIL / NOT VERIFIED | Current worker dispatch remains request-driven; independent unattended recovery is not verified |
| Retry/resume/cancel under concurrent worker conditions | NOT VERIFIED | Requires authenticated isolated integration tests |
| Actual app-generated ZIP integrity and download | NOT VERIFIED | Existing Playwright test requires configured synthetic export and authorized Preview |
| Cross-tenant API/Storage denial | NOT VERIFIED | Existing Playwright tests are fail-closed and need two synthetic tenants |
| Backup/restore | BLOCKED | No authorized disposable restore target/evidence |
| Vercel Preview source SHA | PASS for deployment metadata | Deployment reports implementation SHA; deployment was still building/queued |
| Preview-to-Supabase backend alignment | NOT VERIFIED | Available metadata did not prove target project |
| Mobile-device and physical printer acceptance | NOT VERIFIED | No real device or print test performed |
| Production safety | PASS | No Production mutation, merge, reset, or Production deployment |

## Remaining mandatory blockers

1. Obtain the authoritative Phase 3 SQL deployment record or approve a migration-ledger reconciliation with the database owner. Then implement a forward-only repair, catalog tests, and a clean replay without editing recorded historical migrations or fabricating history.
2. Complete authenticated browser acceptance on a verified isolated Preview/Supabase pair, using synthetic data and at least two tenants.
3. Run and retain evidence for a persisted approximately 300-student batch, reload/recovery, retry/resume/cancel, rendered output inspection, and actual ZIP download/hash/content verification.
4. Verify private Storage and cross-tenant negative tests through UI and direct API/Storage paths.
5. Verify backup/restore on an authorized disposable target and perform mobile/physical-print acceptance where required.
6. Re-run the mandatory gate suite on the exact final branch head after all code/documentation changes. Do not merge or deploy Production until the migration and acceptance gates pass.

**Release rule:** The application is not certified production-ready while the migration replay is failing and mandatory authenticated/operational acceptance remains blocked or unverified.

## Phase 32 — live verification addendum (2026-10-15)

**Status: NOT PRODUCTION-READY.** The starting implementation head was re-fetched from GitHub as `3321aa0459fe16d5dadabee845bb462b26b8bf2f`. The working branch remains `phase-31-provenance-analysis`; draft PR [#14](https://github.com/fuelify12/Id-card/pull/14) remains open and unmerged.

### Live GitHub / CI state

- Full regression workflow [38693187976](https://github.com/fuelify12/Id-card/actions/runs/38693187976): **PASS** on exact starting SHA `3321aa0459fe16d5dadabee845bb462b26b8bf2f`. The job steps for dependency gate, repository security, migration contracts/checksums, tests, TypeScript, lint, production build, client bundle scan, and synthetic visual/print artifacts all concluded successfully.
- Clean-room replay [38693188003](https://github.com/fuelify12/Id-card/actions/runs/38693188003): inventory and authoritative checksums **PASS**; its first attempt failed while starting the disposable Supabase stack before replay. A failed-job rerun was initiated; at the time of this addendum its replay job was still running. Therefore replay is **NOT VERIFIED** by that attempt. The earlier completed replay [38692847698](https://github.com/fuelify12/Id-card/actions/runs/38692847698) remains a confirmed **FAIL** at Phase 8 with SQLSTATE `42703`, missing `public.templates.is_active`.
- The authoritative source for migration history is still the read-only Production ledger with 39 recorded migration rows. The legacy Phase 3 SQL is absent from that ledger and the exact deployment mechanism remains **BLOCKED**. No historical migration or checksum was edited and no database was reset.

### Read-only Production catalog checks

The connected Production project was inspected with SELECT-only catalog queries; no schema/data writes were performed.

- The Production migration ledger contains 39 versions, including `20261009054041 / phase8_template_sides` and `20261010125420 / phase18_batch_worker_recovery`; it has no Phase 3 migration entry.
- All 15 listed public application tables have RLS enabled (**PASS** for the catalog flag only; live cross-tenant API and Storage denial remains **NOT VERIFIED**).
- `public.templates.version_number` is `integer NOT NULL DEFAULT 1`; `is_active` is `boolean NOT NULL DEFAULT true`; `render_config` is `jsonb NOT NULL`.
- Template indexes include both `uq_templates_active_project` (unique on `project_id` where `is_active = true`) and `templates_one_active_per_side_idx` (unique on project and side). The older project-wide uniqueness constraint conflicts with the Phase 8 intention to permit one active template per side. A forward-only repair should reconcile this only after the owner approves the migration-history approach; no Production change was made.
- `templates` has an owner/project-qualified RLS policy. Catalog inspection of `set_active_template_version`, `claim_batch_generation_items`, and `retry_failed_batch_items` found `SECURITY INVOKER`, fixed `search_path=public`, execute denied to `anon`, and execute granted to `authenticated`. These metadata checks do not replace adversarial authenticated API tests.

### Preview configuration recovery

- The previous exact-SHA Preview deployment `dpl_FJFnz5eUyGiz8xMQJ9jeJQ5FPs9p` ended **FAIL** during prerender of `/`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` were missing in that branch's Preview environment. SSO remained enabled.
- Added two **Preview-only, branch-scoped** environment entries for `phase-31-provenance-analysis`: the isolated synthetic Supabase URL and its public publishable key for project `zzecjgauhkaxyptsurlw`. No service-role key was used or added; Production environment targets were not changed.
- Triggered a fresh Preview build for exact SHA `3321aa0459fe16d5dadabee845bb462b26b8bf2f`: deployment [`dpl_9mwsZmutH9TpYPrV2LoAtiXYQYgk`](https://vercel.com/yash-6966/printforge-phase27-acceptance/9mwsZmutH9TpYPrV2LoAtiXYQYgk). At the last live inspection it was still **BUILDING**, target metadata was `null`, and successful deployment/backend alignment was **NOT VERIFIED**. Do not treat this as accepted.
- TinyFish browser profiles were rechecked; the only available profile has no recorded signed-in sites. Authenticated browser E2E remains **BLOCKED**; no SSO/MFA bypass was attempted.

### Remaining mandatory gates

| Gate | Status | Evidence / dependency |
|---|---|---|
| Exact-SHA full regression at starting head | PASS | Run 38693187976 on `3321aa0...` |
| Canonical migration inventory and authoritative checksums | PASS | Run 38693188003 steps 5–6 |
| Fresh canonical migration replay | FAIL | Confirmed prior failure in run 38692847698; latest retry was in progress at addendum time |
| Production template schema catalog | PASS | Read-only columns, constraints, indexes and RLS metadata inspected |
| Migration provenance and approved reconciliation | BLOCKED | DB owner must provide authoritative Phase 3 deployment record or approve a documented reconciliation strategy |
| Vercel Preview build | NOT VERIFIED | Exact-SHA Preview build still running at last inspection |
| Preview-to-isolated-Supabase alignment | NOT VERIFIED | Branch-scoped URL/key now configured, but deployment must finish and be verified |
| Authenticated browser acceptance | BLOCKED | No authorized signed-in browser profile |
| Persisted 300-student batch and record-level validation | NOT VERIFIED | Requires authorized isolated authenticated workflow |
| Worker crash recovery / retry / resume / cancellation under concurrency | NOT VERIFIED | No real persisted end-to-end recovery run |
| Actual ZIP integrity and cross-tenant download denial | NOT VERIFIED | No authenticated two-tenant acceptance run |
| Backup/restore | BLOCKED | No authorized disposable restore target/drill |
| Mobile, accessibility and physical printer acceptance | NOT VERIFIED | No real device or physical print acceptance |
| Production safety | PASS | No Production mutation, PR merge or Production deployment |

**Safe next action:** keep PR #14 in draft. Obtain the authoritative Phase 3 deployment record or explicit database-owner approval for a migration-history reconciliation. After that decision, implement a forward-only repair and prove a fresh replay on the exact final SHA; then complete authenticated two-tenant browser, persisted batch/ZIP, recovery, and backup/restore acceptance before any release decision.

