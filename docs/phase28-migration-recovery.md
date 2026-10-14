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
- Six ordered chunks under `supabase/recovery/phase28_snapshot/`

The snapshot is sourced from current read-only catalogs: 15 public tables, 285 pre-Phase-24 columns, 130 constraints, 67 non-constraint index definitions, 14 public routines, 15 table triggers, the custom `ensure_rls` DDL event trigger, 23 public policies and four PrintForge storage-object policies, five private PrintForge buckets and their allow-lists. The original schema's current state is a justified starting point for the isolated clone, but it cannot reconstruct the exact historical order, intent, comments, or one-time data transformations of the missing original migration.

## Task B — canonical migration-chain validation

**Status: PARTIAL.**

- All tracked files under `supabase/migrations` have a timestamped `YYYYMMDDHHMMSS_name.sql` form and are checked for strictly increasing, unique versions by `scripts/phase28-migration-contract-check.mjs`.
- The authoritative Phase 1 baseline is absent.
- Several foundational changes exist as `supabase/phase*.sql` files outside the canonical migration directory, so a fresh `supabase migration up` from an empty database is not a complete replay of historical Phases 1–24.
- The isolated clone was made usable from the current-schema snapshot rather than pretending the historical migration chain had been replayed.
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

Seven snapshot steps and four source migrations were applied successfully after two initial artifact failures were diagnosed and fixed in the isolated project. The failures were in the first proposed recovery artifact, not in application code: unique indexes referenced by composite foreign keys were missing from the initial index ordering, and policy extraction truncated multiline RLS predicates. The chunk SQL was corrected before retrying. No Production mutation was used for retries.

Post-bootstrap read-only integrity checks:
- 15 public tables / 294 columns
- 136 constraints / 95 indexes / 19 public routines
- 23 public policies; 0 public tables with RLS disabled
- 5 PrintForge buckets, all `public=false`
- 0 rows in every application table, including projects, students, templates, photos, batches, generated cards, validation findings, audit logs and exports
- Auth user creation and tenant seeding were not performed because no authorized signed-in test profile or dedicated secure Auth-user setup tool was available

## Task E — Vercel Preview

**Status: PARTIAL / current deployment rebuild required.**

Branch-scoped Preview-only variables were created for:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Their source is the isolated project `zzecjgauhkaxyptsurlw`; no Production ref or service-role key was added. The acceptance project's SSO protection remains enabled. A deployment launched before the Preview environment variables existed failed at Next.js prerender with `Supabase URL and publishable key must be configured in the deployment environment.` This does not prove the corrected branch configuration fails; a fresh deployment on the latest Phase 28 head is required and will be checked separately.

## Task F/G — browser acceptance and 300-record persisted batch

**Status: BLOCKED.**

The TinyFish default profile has no signed-in sites, and unauthenticated Preview access previously returned `login_required`. No credentials were requested or entered, and no SSO bypass was attempted. Therefore no actual project/template/import/photo workflow, 300-row persisted batch, photo-association check, reload persistence, worker restart/retry/cancel fault injection, or authenticated browser export has been claimed.

Phase 27's 300-card render timing is in-process renderer evidence only and is not reused as evidence of a persisted Supabase worker batch.

## Task H — export/tenant authorization

**Status: PARTIAL.**

The isolated schema contains owner-scoped RLS policies, private object policies, the Phase 19 owner-checked download-link audit RPC and the Phase 24 identifier rules. Catalog checks confirm RLS is enabled on all 15 public tables and buckets are private. These are policy/schema checks—not negative live queries from authenticated Tenant A against Tenant B. No authenticated download, short-lived signed URL, byte hash or audit event was exercised through the browser because the required signed-in test session is unavailable.

## Task I — dependencies and current Supabase advisors

**Status: PARTIAL / warnings remain.**

No `package-lock.json` or `npm-shrinkwrap.json` is tracked, so dependency resolution is not fully reproducible. Phase 27's high-severity-only production audit gate passed, but the prior audit reported three moderate `sprintf-js`/`argparse` findings. The September 2026 advisory for `sprintf-js` (CVE-2026-97058) states that versions through 1.1.3 are affected and no fixed release was listed when checked. See [GitHub Advisory: sprintf-js CVE-2026-97058](https://github.com/advisories/ghsa-hp3w-g68c-fv3c). The current tree could not be independently installed/audited locally in this connector session, so the complete, current advisory dependency paths remain unresolved.

The current Supabase security advisor shows two SECURITY DEFINER warnings:
- `consume_security_rate_limit(...)`: code checks `auth.uid()`, a fixed allowlist, hard-coded per-action limits and windows, and caller parameter equality; it only increments the current caller's own quota. An authenticated user could still exhaust their own budget by invoking it directly. Its execution grant has not been blindly removed because the existing app uses this RPC for shared throttling.
- `record_export_download_link_issued(...)`: intended to be SECURITY DEFINER so an authenticated owner can append a verified download-link audit event while direct audit-table INSERT remains denied. Its implementation checks `auth.uid()`, project and export ownership and terminal export status. Keep the advisor warning visible and review the function under an explicit, documented privileged-RPC policy.

The performance advisor reports 28 foreign keys without covering indexes. These were not blindly bulk-indexed; query patterns and table volumes must justify index choices. The inspected application tables were empty in the isolated project, so it provides no representative query-volume evidence for selecting those indexes.

## Task K — backup, restore and regression

**Status: PARTIAL / NOT VERIFIED.**

The full Phase 27 CI previously passed on SHA `108586cccdf8a8b606dc3073e8859849d11f7d24` (19 Vitest files, 115 tests, TypeScript, lint, build and security steps). Phase 28 adds migration contract coverage; its results must be taken from the workflow on the final Phase 28 head. No backup or restore operation was performed, no physical Android camera test was run, and no physical printer was available. Do not interpret schema bootstrap or a successful Preview build as those acceptance checks.

## Phase-by-phase / task acceptance matrix

| Gate | Status | Evidence / limitation |
|---|---|---|
| Original historical Phase 1 SQL recovered | BLOCKED | No reachable historical copy; no fabrication |
| Separate current-schema snapshot generated | PASS WITH WARNINGS | Catalog-derived, explicitly not original, no row data |
| Canonical migration-dir replay from empty DB | BLOCKED | Missing baseline and several early-phase migration files |
| Isolated snapshot bootstrap | PASS WITH WARNINGS | 6 snapshot chunks applied; schema verification passed |
| Existing Phase 19 and Phase 24 migrations | PASS | Four tracked migration files applied on isolated project |
| Migration order/count contract in CI | PARTIAL until final run | New script/test added; final-head CI evidence required |
| Preview URL/publishable-key alignment | PARTIAL | Branch vars set; fresh deployment after vars required |
| Authenticated browser workflow | BLOCKED | No pre-authorized TinyFish session; SSO maintained |
| Synthetic tenant A/B and RLS denial tests | BLOCKED | No authorized test accounts/seed yet |
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
