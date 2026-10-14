# PRINTFORGE ID CARD STUDIO — Phase 28 migration recovery report

**Evidence date:** 14 October 2026  
**Branch:** `phase-28-authoritative-schema-recovery`  
**Starting commit:** `108586cccdf8a8b606dc3073e8859849d11f7d24`  
**Initial branch head before Phase 28 changes:** `7730f99ca2d636a1667ba877a6adf4de205ee844`

## Executive decision

**Isolated schema bootstrap: PASS WITH WARNINGS. Live acceptance: BLOCKED. Production release: NOT CERTIFIED.**

The original `supabase/migrations/20261008173336_phase1_foundation.sql` could not be recovered from any reachable branch, tag, current recursive tree, commit-history query for that path, or repository code/commit search. The authoritative historical migration must not be fabricated. A separate, explicitly labelled schema snapshot was generated from read-only PostgreSQL catalog metadata on the Production project. The snapshot is **not** called the original Phase 1 migration and includes no table rows, authentication users, student photos, or export data.

That snapshot was applied only to the empty, isolated Supabase project `zzecjgauhkaxyptsurlw`, followed by the tracked Phase 19 and Phase 24 migrations. This created a working schema for isolated schema inspection, but it does not make the original historical migration chain reproducible from the canonical `supabase/migrations` directory.

## Task A — historical migration recovery

**Status: BLOCKED (original file) / PASS WITH WARNINGS (separate recovery snapshot).**

Searched reachable branches including `main`, `phase-20-isolated-acceptance`, Phase 24–27, and Prompt 17–19 branches; inspected recursive Git trees; checked repository commit history for the exact missing path; and searched the repository for `phase1_foundation`. No original migration copy was found. The existing root-level `supabase/phase2_backend.sql` and subsequent `supabase/phase*.sql` files are incremental scripts that assume prior schema objects; they do not establish the exact contents of the missing Phase 1 migration.

Created:
- `supabase/recovery/phase28_current_production_schema_snapshot.sql`
- Eight bootstrap/recovery files under `supabase/recovery/phase28_snapshot/` (chunks 01–08; chunk 08 is the isolated table-grant repair)
- Three repeatable SQL checks under `supabase/recovery/tests/`: Tenant A/B RLS isolation, anonymous-access denial, and `ensure_rls` event-trigger smoke test.

## Task B — canonical migration-chain validation

**Status: PARTIAL.**

- All tracked files under `supabase/migrations` have a timestamped `YYYYMMDDHHMMSS_name.sql` form and are checked for strictly increasing, unique versions by `scripts/phase28-migration-contract-check.mjs`.
- The authoritative Phase 1 baseline is absent.
- Several foundational changes exist as `supabase/phase*.sql` files outside the canonical migration directory, so a fresh `supabase migration up` from an empty database is not a complete replay of historical Phases 1–24.
- The isolated clone was made usable from the current-schema snapshot rather than pretending the historical migration chain had been replayed. The custom `ensure_rls` DDL event trigger was also restored and verified in the isolated project; it enables RLS on future public tables.
- Applied next on the isolated clone: `phase19_export_download_audit_rpc`, `phase24_canonical_student_identifiers`, `phase24_identifier_correction_rpc`, and `phase24_worker_identifier_ordering`. Each individual migration returned success.

CI now checks migration filename/order conventions, schema-snapshot object counts, index-before-FK ordering, RLS/bucket statements, policy/trigger counts, and the snapshot's explicit non-original provenance. Default strict mode fails when the original baseline is missing; CI's documented `--allow-recovery-snapshot` mode permits the alternative path while keeping the warning visible.

## Task C/D — isolated Supabase bootstrap

**Status: PASS WITH WARNINGS (schema), PARTIAL (complete acceptance setup).**

Target identity was rechecked before remote changes:
- Ref: `zzecjgauhkaxyptsurlw`
- Project: `PrintForge Phase 25 Synthetic Acceptance`
- Region: `ap-south-1`
- Status: `ACTIVE_HEALTHY`
- Initial state: 0 public application tables; 0 recorded migrations
- Known Production ref `xdoenkusrakuyyxnnkff` was not the target

Eight schema-snapshot/bootstrap steps and four subsequent tracked migrations were successfully applied only on the verified isolated Supabase project. Early iterations exposed and fixed three generator defects: indexes needed by composite foreign keys were omitted from the first index chunk, multiline RLS expressions were truncated by the first policy extractor, and comma-separated table GRANT statements were dropped by the first ACL filter. The corrected ACL chunk preserves all 29 catalog-derived table GRANTs, and chunk 08 reapplied those grants to the isolated project only. No Production mutation was used for retries.

Post-bootstrap exact read-only verification:
- 15 public tables / 294 columns / 136 constraints / 95 indexes / 19 routines
- 23 public policies plus four PrintForge storage-object policies; zero public tables with RLS disabled
- custom `ensure_rls` event trigger enabled
- all five PrintForge Storage buckets private
- exact dynamic row counts returned zero rows in each of the 15 public application tables
- Regenerated `lib/supabase/database.types.ts` from the isolated schema after detecting drift in the checked-in definitions: the `batch_generation_items` table was missing and newer Phase 24/rendering fields were absent from some tables. The CI TypeScript/build gates will validate application compilation against the refreshed generated contract.
- zero synthetic Auth users, zero fixture-owned Storage objects, and zero RLS probe tables remained after rollback

Three stored SQL security checks under `supabase/recovery/tests/` were executed, each using synthetic fixtures in a transaction followed by `ROLLBACK`:
- Tenant A/B: under PostgreSQL role `authenticated`, simulated `request.jwt.claim.sub` values. Each tenant saw only its own project/student; cross-tenant update/delete affected zero rows; a forged project insert was denied; cross-tenant private-object metadata select/update/insert was denied. **PASS**.
- Anonymous role: project-table SELECT privilege denied, private object metadata invisible. **PASS**.
- `ensure_rls`: a new public table automatically had RLS enabled; probe DDL rolled back. **PASS**.

These tests validate PostgreSQL policies, not a real GoTrue sign-in or authenticated HTTP request. No persistent synthetic account or fixture row was created.

## Task E — Vercel Preview

**Status: PASS WITH WARNINGS for configuration; authenticated application acceptance remains BLOCKED.**

Branch-scoped Preview variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured only for `phase-28-authoritative-schema-recovery`, and source from isolated project `zzecjgauhkaxyptsurlw`. No Production URL or service-role key was added. Vercel project `printforge-phase27-acceptance` is non-production (`live=false`); SSO protection remains enabled.

An early deployment launched before these variables existed failed during prerender with `Supabase URL and publishable key must be configured in the deployment environment.` A READY non-production Preview was verified for tested application-code head `35a747a5a0c3358136ba2d0333acf15f9f5ea89e`: `https://printforge-phase27-acceptance-46cyz4evy-yash-6966.vercel.app` (deployment `dpl_4TM3hdA9T2tHA8eGFS1u7g46CUKg`, target `null`). The project remains `live=false` and SSO is enabled. A fresh unauthenticated TinyFish fetch timed out; that is not evidence of a successful login or a bypass. A READY Preview does not unblock authenticated acceptance without a signed-in browser profile.

## Task F/G — browser acceptance and 300-record persisted batch

**Status: BLOCKED.**

The TinyFish Default profile has no signed-in sites. Earlier non-authenticated Preview access returned `login_required`; a later fetch of the current protected Preview timed out. No credentials were requested or entered, and no SSO bypass was attempted. Therefore no actual project/template/import/photo workflow, 300-row persisted batch, photo-association check, reload persistence, worker restart/retry/cancel fault injection, or authenticated browser export has been claimed.

Phase 27's 300-card render timing is in-process renderer evidence only and is not reused as evidence of a persisted Supabase worker batch.

## Additional schema compatibility defect discovered during Phase 28

The expanded isolated fixture exposed a real mismatch in the actual catalog snapshot: `public.exports_status_check` accepted only `queued`, `ready`, and `failed`, while the current export route transitions rows through `running`, `verifying`, `completed`, `completed_with_errors`, and `expired`. That constraint would reject the normal export worker lifecycle even when authorization and file generation succeed.

Added forward-only migration `supabase/migrations/20261014182500_phase28_export_status_transitions.sql` to preserve existing states and allow the application lifecycle. It does not rewrite or impersonate the missing Phase 1 migration. It is to be applied and exercised only on the isolated Supabase project; Production remains untouched.

## Task H — export/tenant authorization

**Status: PASS WITH WARNINGS for database-level policy simulation; live HTTP/application authorization remains BLOCKED.**

The isolated schema contains owner-scoped RLS policies, private object policies, the Phase 19 owner-checked download-link audit RPC and Phase 24 identifier rules. Catalog checks confirm RLS is enabled across all 15 public tables and PrintForge buckets are private.

Three stored SQL checks under `supabase/recovery/tests/` were executed on the isolated project:
- `phase28_tenant_isolation.sql`: **PASS**. Under PostgreSQL role `authenticated`, simulated JWT subject claims for synthetic A and B. Each tenant saw only its own project/student; cross-tenant SELECT was filtered, UPDATE/DELETE affected zero rows, forged tenant project creation was denied, and foreign private object metadata was not visible or modifiable.
- `phase28_anonymous_access.sql`: **PASS**. The `anon` role lacked project-table SELECT privilege and could not see private object metadata.
- `phase28_ensure_rls_event_trigger.sql`: **PASS**. A newly created public test table had RLS automatically enabled by `ensure_rls`.

All test fixtures were rolled back. A subsequent exact count query confirmed no application rows, no synthetic Auth users, no fixture-owned objects, and no probe tables remain. This was a database-role/JWT-claim simulation, **not** a real GoTrue sign-in, authenticated browser session or API-level denial test. No authenticated export link was issued or downloaded and no export-audit event was exercised, because the TinyFish Default profile has no signed-in sites and SSO was not bypassed.

## Task I — dependencies and current Supabase advisors

**Status: PARTIAL / warnings remain.**

No `package-lock.json` or `npm-shrinkwrap.json` is tracked, so dependency resolution is not fully reproducible. Phase 27's high-severity-only production audit gate passed, but the prior audit reported three moderate `sprintf-js`/`argparse` findings. The September 2026 advisory for `sprintf-js` (CVE-2026-97058) states that versions through 1.1.3 are affected and no fixed release was listed when checked. See [GitHub Advisory: sprintf-js CVE-2026-97058](https://github.com/advisories/ghsa-hp3w-g68c-fv3c). The current tree could not be independently installed/audited locally in this connector session, so the complete, current advisory dependency paths remain unresolved.

The current Supabase security advisor shows two SECURITY DEFINER warnings:
- `consume_security_rate_limit(...)`: code checks `auth.uid()`, a fixed allowlist, hard-coded per-action limits and windows, and caller parameter equality; it only increments the current caller's own quota. An authenticated user could still exhaust their own budget by invoking it directly. Its execution grant has not been blindly removed because the existing app uses this RPC for shared throttling.
- `record_export_download_link_issued(...)`: intended to be SECURITY DEFINER so an authenticated owner can append a verified download-link audit event while direct audit-table INSERT remains denied. Its implementation checks `auth.uid()`, project and export ownership and terminal export status. Keep the advisor warning visible and review the function under an explicit, documented privileged-RPC policy.

The performance advisor reports 28 foreign keys without covering indexes. These were not blindly bulk-indexed; query patterns and table volumes must justify index choices. The inspected application tables were empty in the isolated project, so it provides no representative query-volume evidence for selecting those indexes.

## Task K — backup, restore and regression

**Status: PARTIAL / NOT VERIFIED.**

The latest Phase 28 push and PR workflows passed on code/test head `35a747a5a0c3358136ba2d0333acf15f9f5ea89e`: **20 test files / 121 tests passed**, migration contract check passed, TypeScript passed, lint had zero errors and eight existing `<img>` warnings, production build passed, dependency audit gate and repository security checks passed, client-bundle secret scan passed for 18 static files, and four synthetic visual/print artifacts uploaded successfully. The 300-card in-process renderer ran 300/300 with bounded concurrency 4 in **17.704 seconds**; this does not measure persisted worker/storage/download performance. Earlier runs failed on defects in the contract guard and generated recovery SQL; those were corrected and retested. Push run: `https://github.com/fuelify12/Id-card/actions/runs/38613937430`; PR run: `https://github.com/fuelify12/Id-card/actions/runs/38613948321`. No backup or restore operation was performed, no physical Android camera test was run, and no physical printer was available. Do not interpret schema bootstrap or a successful Preview build as those acceptance checks.

## Phase-by-phase / task acceptance matrix

| Gate | Status | Evidence / limitation |
|---|---|---|
| Original historical Phase 1 SQL recovered | BLOCKED | No reachable historical copy; no fabrication |
| Separate current-schema snapshot generated | PASS WITH WARNINGS | Catalog-derived, explicitly not original, no row data |
| Canonical migration-dir replay from empty DB | BLOCKED | Missing baseline and several early-phase migration files |
| Isolated snapshot bootstrap | PASS WITH WARNINGS | 8 schema/bootstrap steps plus four tracked migrations; 15 tables, 136 constraints, 95 indexes, 19 routines; all 15 tables have RLS |
| Existing Phase 19 and Phase 24 migrations | PASS | Four tracked migration files applied on isolated project |
| Migration order/count contract in CI | PASS WITH WARNINGS | Contract check and all 121 tests passed on code/test head 35a747a; missing historical baseline remains an explicit warning |
| Preview URL/publishable-key alignment | PASS WITH WARNINGS | Branch-scoped Preview variables point to isolated project; READY deployment matches code/test head 35a747a, SSO remains enabled |
| Authenticated browser workflow | BLOCKED | TinyFish Default profile has no signed-in sites; SSO maintained and no bypass used |
| Synthetic tenant A/B database RLS denial | PASS WITH WARNINGS | SQL policy simulation under authenticated DB role passed with rolled-back fixtures; actual authenticated HTTP/API denial remains BLOCKED |
| Persisted 300-student batch & worker recovery | BLOCKED | Requires live authenticated app workflow |
| Actual ZIP download/manifest/hash check | BLOCKED | Requires generated isolated export and authenticated user |
| Dependency audit/reproducibility | PARTIAL | No lockfile; moderate advisories remain |
| Security advisor remediation | PARTIAL | Two deliberate/existing privileged RPC warnings need explicit review |
| 28 unindexed FKs | PARTIAL | Need query-driven prioritization; not blindly indexed |
| Backup/restore | NOT VERIFIED | No restore drill executed |
| Physical Android and print inspection | NOT VERIFIED | Hardware not tested |
| Production release | NOT CERTIFIED | Browser, tenant, export, backup and print gates incomplete |

## Exact safety boundary

No Production table data was copied, no Production SQL was executed to apply or test schema changes, no Production deployment was promoted, and no pull request was merged. The isolated snapshot was read-only sourced from Production catalog metadata; all writes described in this report were applied only to `zzecjgauhkaxyptsurlw`.

## Required next actions

1. Recover the original migration from an authoritative backup or developer-controlled local Git object database if one exists; otherwise retain this schema snapshot as a separately reviewed bootstrap path, never renaming it to impersonate Phase 1.
2. Obtain an authorized sign-in in the SSO-protected Preview and create dedicated synthetic users via the approved Auth admin path; keep credentials out of chat.
3. Run real authenticated Tenant A/B, photo matching, persisted batch/worker and ZIP download tests.
4. Restore a lockfile and resolve/contain dependency advisories when a compatible remediation is available.
5. Complete a restore drill and hardware print/Android inspection before release.
