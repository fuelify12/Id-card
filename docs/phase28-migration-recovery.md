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

**Status: PASS WITH WARNINGS (isolated schema), PARTIAL (complete acceptance setup).**

Target was verified before remote writes: ref zzecjgauhkaxyptsurlw, project PrintForge Phase 25 Synthetic Acceptance, region ap-south-1, status ACTIVE_HEALTHY. Its initial state had zero public application tables and zero migration-ledger rows. The known Production ref xdoenkusrakuyyxnnkff was not used as a write target.

Eight catalog-derived bootstrap chunks plus the tracked Phase 19/24 SQL and one new Phase 28 forward migration have been applied only to the isolated project. Its ledger contains 13 entries. This validates the separate snapshot-bootstrap path, not a clean replay of the incomplete canonical Phase 1–24 migration directory.

Read-only catalog evidence now shows 15 public tables, 294 columns, 136 constraints, 95 indexes, 19 public routines, 23 public policies, and four Storage object policies. All 15 public tables have RLS enabled; the custom ensure_rls DDL event trigger is enabled; all five PrintForge buckets are private. Direct COUNT queries after test rollback confirmed zero rows in all 15 public application tables, no synthetic test Auth users, and no Phase 28 probe tables. The generated Supabase TypeScript schema was refreshed because the checked-in types lacked batch_generation_items and newer Phase 24/rendering columns.

Tracked isolated SQL checks passed: Tenant A/B RLS simulation, anonymous-role denial, and the ensure_rls event-trigger test. All test fixtures are rolled back. These are real PostgreSQL role/JWT-claim simulations, not real GoTrue authentication or authenticated HTTP/browser tests.

## Task E — Vercel Preview

**Status: PASS WITH WARNINGS for configuration/build; authenticated app acceptance remains BLOCKED.**

Branch-scoped Preview variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are configured for phase-28-authoritative-schema-recovery and point at the isolated project. No Production URL or service-role key was added. The READY non-Production Preview for tested code/test SHA 10df395c2bfe9d1df53c5f57a02b2de2964d594c is https://printforge-phase27-acceptance-icr2f1ioi-yash-6966.vercel.app. Its Vercel deployment target is null and SSO remains enabled.

The TinyFish Default browser profile has zero signed-in sites. The latest anonymous fetch timed out; that is not proof of authenticated access. No credentials were submitted and no SSO bypass was attempted.

## Task F/G — browser acceptance and 300-record persisted batch

**Status: BLOCKED.**

The protected Preview could not be accessed through an authorized signed-in browser profile. No authenticated project/template creation, spreadsheet import, photo association/crop review, persisted 300-student batch, reload persistence, worker retry/resume/cancel test, or application-created export download is claimed. Phase 27's in-process 300-card render remains renderer evidence only, not persisted batch acceptance.

## Additional schema compatibility defect discovered during Phase 28

The isolated schema exposed a real export-pipeline mismatch: public.exports_status_check initially allowed only queued, ready, and failed, while the current route also transitions exports through running, verifying, completed, completed_with_errors, and expired. That would reject valid export-worker state transitions.

Added and applied only on the isolated project the forward-only migration supabase/migrations/20261014182500_phase28_export_status_transitions.sql. It accepts the ten states exercised by the current route/worker: pending, queued, running, verifying, ready, completed, completed_with_errors, failed, cancelled, and expired. The migration was successfully re-applied to verify its repeatable constraint replacement, then recorded in the isolated ledger as version 20261014182500. It does not impersonate or reconstruct the missing original Phase 1 migration. Production schema was not changed.

## Task H — export/tenant authorization

**Status: PASS WITH WARNINGS for database-level policy tests; live HTTP/API authorization remains BLOCKED.**

The expanded tracked SQL test supabase/recovery/tests/phase28_tenant_isolation.sql returned PASS on the isolated project with all fixtures rolled back. Simulated authenticated tenants A and B saw only their own project, student, template/field, batch/item, photo, generated card, processing job, and export rows. Cross-tenant reads returned no rows; cross-tenant public-table updates/deletes affected zero rows; forged cross-tenant project/export insertion was rejected. Cross-tenant private photo/export object metadata reads and updates were denied, and cross-tenant object insertion was denied. Supabase's storage.protect_delete() requires object deletion through Storage API, so no direct SQL DELETE against storage.objects was attempted.

The test loop exercised all ten export statuses through the newly corrected constraint and restored the synthetic export to completed. Tenant A could not forge Tenant B's export or invoke Tenant B's owner-checked download-audit RPC. Tenant B could invoke its own audit RPC but not Tenant A's. phase28_anonymous_access.sql passed, and phase28_ensure_rls_event_trigger.sql passed. Direct post-test COUNT queries confirmed zero rows in all 15 public tables; no synthetic Auth users, fixture objects, or probe table remained.

These are database-role/JWT-claim simulations, not real GoTrue sign-in, authenticated REST requests, Storage API requests, signed-URL expiry checks, or an actual ZIP download through the browser. Those live gates remain blocked by the lack of an authorized signed-in Preview profile.

## Task I — dependencies and current Supabase advisors

**Status: PARTIAL / warnings remain.**

No `package-lock.json` or `npm-shrinkwrap.json` is tracked, so dependency resolution is not fully reproducible. Phase 27's high-severity-only production audit gate passed, but the prior audit reported three moderate `sprintf-js`/`argparse` findings. The September 2026 advisory for `sprintf-js` (CVE-2026-97058) states that versions through 1.1.3 are affected and no fixed release was listed when checked. See [GitHub Advisory: sprintf-js CVE-2026-97058](https://github.com/advisories/ghsa-hp3w-g68c-fv3c). The current tree could not be independently installed/audited locally in this connector session, so the complete, current advisory dependency paths remain unresolved.

The current Supabase security advisor shows two SECURITY DEFINER warnings:
- `consume_security_rate_limit(...)`: code checks `auth.uid()`, a fixed allowlist, hard-coded per-action limits and windows, and caller parameter equality; it only increments the current caller's own quota. An authenticated user could still exhaust their own budget by invoking it directly. Its execution grant has not been blindly removed because the existing app uses this RPC for shared throttling.
- `record_export_download_link_issued(...)`: intended to be SECURITY DEFINER so an authenticated owner can append a verified download-link audit event while direct audit-table INSERT remains denied. Its implementation checks `auth.uid()`, project and export ownership and terminal export status. Keep the advisor warning visible and review the function under an explicit, documented privileged-RPC policy.

The performance advisor reports 28 foreign keys without covering indexes. These were not blindly bulk-indexed; query patterns and table volumes must justify index choices. The inspected application tables were empty in the isolated project, so it provides no representative query-volume evidence for selecting those indexes.

## Task K — backup, restore and regression

**Status: PASS WITH WARNINGS for automated CI; NOT VERIFIED for backup/restore and physical hardware.**

Latest completed push CI on code/test SHA 10df395c2bfe9d1df53c5f57a02b2de2964d594c: https://github.com/fuelify12/Id-card/actions/runs/38616256233. Latest completed PR CI on the same SHA: https://github.com/fuelify12/Id-card/actions/runs/38616266253. Both passed the Phase 28 migration contract check, Vitest, TypeScript, lint, production build, dependency gate, repository security check, client-bundle secret scan and synthetic artifact upload. Vitest reported 20 test files / 122 tests passed. Lint had zero errors and eight existing img-optimization warnings. The high-severity-only production audit gate passed, but the audit output still reported three moderate dependency vulnerabilities.

The 300-card in-process renderer passed 300/300 with bounded concurrency four. Across the current push workflow, elapsed measurements were 11.505 seconds in the main test pass and 13.859 seconds in the repeated prebuild pass; this does not measure the persisted worker, database, Storage, ZIP or authenticated download path. No backup/restore drill, physical Android camera test, or physical printer inspection was performed.

## Phase-by-phase / task acceptance matrix

| Gate | Status | Evidence / limitation |
|---|---|---|
| Original historical Phase 1 SQL recovered | BLOCKED | Not available in reachable Git history; not fabricated |
| Separate current-schema recovery snapshot | PASS WITH WARNINGS | Catalog-derived bootstrap, explicitly not original Phase 1 |
| Canonical migration-dir replay from empty database | BLOCKED | Missing baseline and earlier migration files |
| Isolated snapshot bootstrap | PASS WITH WARNINGS | 15 tables, 294 columns, 136 constraints, 95 indexes, 19 routines; RLS on all tables |
| Isolated migration ledger | PASS WITH WARNINGS | 13 entries including Phase 28 export-status correction; canonical historical chain still incomplete |
| Export status constraint and migration replay | PASS | All ten states accepted; forward migration re-applied and recorded on isolated project |
| Preview configuration/deployment | PASS WITH WARNINGS | READY Preview on code/test SHA 10df395c; branch-scoped isolated Supabase settings; SSO enabled |
| Authenticated browser workflow | BLOCKED | No authorized signed-in TinyFish profile for Preview |
| Tenant A/B database RLS tests | PASS WITH WARNINGS | Expanded simulated claims test passes across application rows and private object metadata; authenticated API denial remains unverified |
| Anonymous project/storage metadata denial | PASS | Isolated SQL assertion passed |
| ensure_rls DDL event trigger | PASS | Probe table acquired RLS; all probe changes rolled back |
| Persisted 300-student batch and worker recovery | BLOCKED | Requires authenticated application workflow; renderer-only load is not equivalent |
| Actual application ZIP/download/hash verification | BLOCKED | No export created/downloaded through authenticated app route |
| Dependency audit/reproducibility | PARTIAL | No package lock; three moderate findings remain |
| Supabase advisor remediation | PARTIAL | Two SECURITY DEFINER warnings and 28 unindexed FKs need reviewed remediation |
| Backup/restore drill | NOT VERIFIED | No restore operation performed |
| Physical Android and print inspection | NOT VERIFIED | Hardware was not tested |
| Production release | NOT CERTIFIED | Historical chain, authenticated app workflow, live export and operational gates remain incomplete |

## Exact safety boundary

No Production table data was copied, no Production SQL was executed to apply or test schema changes, no Production deployment was promoted, and no pull request was merged. The isolated snapshot was read-only sourced from Production catalog metadata; all writes described in this report were applied only to `zzecjgauhkaxyptsurlw`.

## Required next actions

1. Recover the original Phase 1 SQL from an authoritative backup or developer-controlled local Git object database if one exists; keep the schema snapshot separate from the historical chain.
2. Obtain an authorized signed-in browser profile for the SSO-protected Preview; keep credentials out of chat and do not bypass SSO.
3. Run real authenticated Tenant A/B API and Storage denials, photo matching, a persisted 300-student worker batch, and the real ZIP download/manifest/hash path.
4. Restore a lockfile and resolve/contain dependency advisories when a compatible remediation is available.
5. Complete a backup/restore drill and physical printer/Android inspection before production review.
