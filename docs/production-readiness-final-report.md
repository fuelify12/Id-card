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

## Phase 32 — final checkpoint (2026-10-15)

This checkpoint supplements the earlier Phase 32 addendum with completed results observed afterward. The code implementation remains `3321aa0459fe16d5dadabee845bb462b26b8bf2f`; the report-only branch head before this checkpoint was `b5a27f1d69ce00145d36430fa90b28646866338b`.

### Exact-SHA regression and replay

- [Full regression run 38698456823](https://github.com/fuelify12/Id-card/actions/runs/38698456823) **PASS** on report-only head `b5a27f1d69ce00145d36430fa90b28646866338b`. All steps passed: dependency vulnerability gate, repository security, migration contracts/checksums, 127 tests across 21 files, TypeScript, lint (0 errors; 8 existing warnings), production build, client-bundle secret scan, and synthetic visual/print artifact upload.
- [Clean-room replay run 38698456686](https://github.com/fuelify12/Id-card/actions/runs/38698456686) **FAIL** before migration replay: the disposable local Supabase stack startup failed; replay/history/catalog tests were skipped. Its sanitized summary artifact is [available here](https://github.com/fuelify12/Id-card/actions/runs/38698456686/artifacts/11954889092). This is an environment/startup failure, not evidence that replay passed. The completed earlier run [38692847698](https://github.com/fuelify12/Id-card/actions/runs/38692847698) remains the confirmed migration failure at Phase 8 (`is_active` missing).
- The branch's current report update is documentation-only; the application implementation code is unchanged from the regression-tested SHA. Do not treat a passing application build as a passing migration replay.

### Private Storage catalog (read-only Production queries)

- The five `printforge-*` buckets (`printforge-exports`, `printforge-generated-cards`, `printforge-private`, `printforge-student-photos`, `printforge-templates`) all report `public = false`: **PASS** for bucket privacy metadata.
- `storage.objects` reports RLS enabled: **PASS** for the catalog flag.
- Four named authenticated Storage policies (SELECT/INSERT/UPDATE/DELETE) cover templates, student photos, generated cards, and exports; they require the first object path segment to equal `auth.uid()` and the second to identify a project owned by that user. This is **NOT VERIFIED** for actual cross-tenant Storage requests because no authorized signed-in two-tenant browser/API session was available.
- The private `printforge-private` bucket is not included in those four named policy bucket lists. Its intended access pattern and any additional policy/edge-function access should be reviewed before release; no policy was changed.

### Vercel Preview result

- After adding only branch-scoped Preview environment entries for the isolated synthetic Supabase project, deployment [`dpl_9mwsZmutH9TpYPrV2LoAtiXYQYgk`](https://vercel.com/yash-6966/printforge-phase27-acceptance/9mwsZmutH9TpYPrV2LoAtiXYQYgk) reached **READY**.
- Deployment metadata reports application SHA `3321aa0459fe16d5dadabee845bb462b26b8bf2f`, branch `phase-31-provenance-analysis`, and target `null` (Preview). The Vercel project reports `live=false` and SSO protection enabled. This is a successful non-production build, not authenticated application acceptance. Exact backend alignment is configured to the isolated URL/key but end-to-end backend reachability and data-flow remain **NOT VERIFIED** until authenticated acceptance.

### Updated release gates

| Gate | Status | Evidence |
|---|---|---|
| Regression / types / lint / build / security checks | PASS | Run 38698456823 on `b5a27f1...` |
| Migration inventory and checksum contract | PASS | Run 38698456686 completed these steps before local-stack failure |
| Fresh canonical replay | FAIL | Run 38698456686 failed starting local Supabase; run 38692847698 confirmed missing `is_active` |
| Production table RLS catalog | PASS | Read-only query found RLS enabled on all 15 public tables |
| Named private Storage bucket metadata | PASS | Five PrintForge buckets are private |
| Actual cross-tenant Storage denial | NOT VERIFIED | No authorized signed-in negative request |
| Preview build | PASS | Deployment `dpl_9mwsZmutH9TpYPrV2LoAtiXYQYgk` READY |
| Authenticated browser workflow | BLOCKED | Available browser profile has no recorded signed-in sites |
| 300-student persisted batch, worker recovery, ZIP verification | NOT VERIFIED | No authenticated end-to-end run |
| Backup/restore | BLOCKED | No authorized disposable restore target/drill |
| Migration-history reconciliation | BLOCKED | Requires authoritative Phase 3 deployment record or explicit database-owner approval |

**Verdict remains NOT PRODUCTION-READY.** No Production schema/data was mutated, no migration history was rewritten, no PR was merged, and no Production deployment was made.



## Final Ship-It Mission — live checkpoint (2026-10-15)

**Verdict: NOT READY — BLOCKED.** This checkpoint reflects live GitHub Actions, Vercel, Supabase project inventory, and a real unauthenticated browser visit. It does not reinterpret a green build as proof of the complete workflow.

### Current exact-head results

- Current branch report head at inspection: `3e1d91aec5d8d21286db41ef9c2e6405274f84ef`; the application implementation remains `3321aa0459fe16d5dadabee845bb462b26b8bf2f`.
- Full regression [run 38698743457](https://github.com/fuelify12/Id-card/actions/runs/38698743457) **PASS** on report head `3e1d91a...`: dependency gate, repository security checks, migration contracts/checksum, full regression tests, TypeScript, lint, production build, client bundle secret scan, and synthetic visual/print artifact upload all passed.
- Clean-room migration replay [run 38698744079](https://github.com/fuelify12/Id-card/actions/runs/38698744079) **FAIL** at “Start disposable local Supabase stack.” The canonical replay and migration history/catalog assertions were skipped. The replay is therefore not proven; earlier run 38692847698 remains evidence of the actual Phase 8 missing-`is_active` error.
- Vercel deployment [dpl_FJtPMpjsiUp4ZDjswdEF2QegUXPJ](https://vercel.com/yash-6966/printforge-phase27-acceptance/FJtPMpjsiUp4ZDjswdEF2QegUXPJ) is **READY** for report SHA `3e1d91aec5d8d21286db41ef9c2e6405274f84ef`, branch `phase-31-provenance-analysis`, Preview target (not Production). Project is marked `live=false`; SSO protection is enabled for all deployment URLs except custom domains.
- A real browser visit to [the deployed Preview URL](https://printforge-phase27-acceptance-9fdb23xfz-yash-6966.vercel.app) was performed without credentials. **FAIL for unauthenticated reachability:** Vercel SSO redirected to the Vercel login portal before the PrintForge page or its own sign-in screen could render. This is an intentional access barrier, not evidence that application sign-in itself works or fails. No SSO bypass was attempted.
- Supabase project inventory confirms both the existing `Id-card` project (`xdoenkusrakuyyxnnkff`) and the isolated synthetic acceptance project (`zzecjgauhkaxyptsurlw`) are active/healthy. The Preview environment was configured for the isolated synthetic project; authenticated end-to-end backend data flow remains **NOT VERIFIED**.

### Ship-it acceptance status

| Gate | Status | Evidence |
|---|---|---|
| Exact-head regression, types, lint, build, dependency/security gates | PASS | [Run 38698743457](https://github.com/fuelify12/Id-card/actions/runs/38698743457) |
| Vercel deployment build | PASS | [Deployment metadata](https://vercel.com/yash-6966/printforge-phase27-acceptance/FJtPMpjsiUp4ZDjswdEF2QegUXPJ), READY, Preview |
| Public/unauthed browser reachability | BLOCKED | Vercel SSO redirects to Vercel login; app page not reached |
| Application sign-in tested | NOT VERIFIED | No authorized signed-in browser session or test account |
| Spreadsheet import against persisted database | NOT VERIFIED | No authenticated end-to-end run |
| Exact serial-number photo matching against persisted student rows | NOT VERIFIED | No authenticated end-to-end run |
| Per-record rendered identity/photo/template verification | NOT VERIFIED | No real persisted batch/output set |
| Actual ZIP generation, extraction, and content/hash verification | NOT VERIFIED | No authenticated end-to-end export |
| Approx. 300-student acceptance batch | NOT VERIFIED | No persisted authenticated batch; no accuracy counts can honestly be reported |
| Cross-project API and Storage denial | NOT VERIFIED | Catalog/RLS metadata exists, but no two-tenant adversarial request test |
| Fresh canonical migration replay | FAIL / BLOCKED | Latest replay job fails starting local Supabase stack; confirmed earlier missing-column replay failure remains unresolved |
| Migration provenance / approved reconciliation | BLOCKED | No authoritative Phase 3 deployment record or explicit database-owner approval for reconciliation |
| Production safety | PASS | No Production schema/data change, PR merge, or Production deployment performed |

### Exact remaining actions to unblock a genuinely usable instance

1. **Vercel access:** sign in to the authorized Vercel team in the browser to pass the existing Preview SSO gate. Do not disable SSO just to make a link appear usable. After access, an authorized application test account/session is still needed to verify the app's own authentication.
2. **Migration:** the database owner must provide the authoritative Phase 3 deployment record or explicitly approve a documented migration-ledger reconciliation strategy. Then fix the canonical chain with a reviewable forward-only migration and prove a fresh replay on an empty disposable database. The local Supabase startup failure also needs a working runner/stack before that replay can complete.
3. **Core workflow:** execute the real authenticated flow on the isolated project with synthetic records, starting with a smaller batch if needed and scaling toward 300; verify each expected student/photo/field/template association and inspect the extracted ZIP. Record actual correct/mismatch/rejected/review-required counts only after that run.
4. **Tenant/storage security:** execute authenticated negative tests using two synthetic accounts/projects and inspect access to each private bucket, including the currently unaccounted-for `printforge-private` bucket.
5. Keep PR #14 in draft and keep Production untouched until those gates pass.

No real student data was used for acceptance, no credentials were printed, and no migration history or checksum was fabricated.
