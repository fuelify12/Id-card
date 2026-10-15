# Phase 29 — Migration Chain Reconciliation

**Evidence date:** 15 October 2026  
**Repository branch:** `phase-28-authoritative-schema-recovery`  
**Phase 29 baseline:** Phase 27 commit `108586cccdf8a8b606dc3073e8859849d11f7d24` as recorded by the Phase 28 report  
**Branch head before this report commit:** `173e38f374380cd4d831bcaff77222f73f0e9126`  
**Production decision:** NOT CERTIFIED. No Production writes, PR merges, or Production deployments were performed.

## Executive result

- **PASS WITH WARNINGS — historical Phase 1 source recovered:** the tracked Phase 1 file was compared byte-for-byte with the read-only Production migration-ledger SQL. Both are 12,142 characters and identical; PostgreSQL ledger MD5 is `12ce32c68a90886c1673eee121218451`. This is authoritative ledger evidence, not a recovered Git commit: GitHub commit history for that file path returned an empty array.
- **PARTIAL — canonical historical migration inventory restored:** 39 historical migration rows are present in the read-only Production ledger. Phase 29 restored 17 missing Phase 8–11 migration files from the exact SQL stored in that ledger. The previously tracked Phase 18 file used version `20261010115000` and differed (5,682 characters) from the authoritative ledger SQL (5,285 characters at `20261010125420`); its candidate is preserved outside `supabase/migrations`. The Phase 13 audit-metadata file was also a normalized schema-function dump (3,010 characters), not the original 2,890-character migration SQL; it was replaced with the exact ledger SQL and the prior candidate preserved outside the canonical directory.
- **NOT VERIFIED — checksum contract:** `scripts/phase29-authoritative-ledger-check.mjs` and the ledger manifest are added so CI can verify all 39 source-ledger files by exact MD5 and character count. This execution environment could not run the repository locally because `psql`, `postgres`, and `docker` are unavailable and network access prevented cloning the repo. The new check must run in CI before declaring checksum reconciliation passed.
- **BLOCKED — clean-room replay:** no empty disposable PostgreSQL/Supabase runtime is available. The existing isolated project is not reset because its disposable-reset status has not been explicitly re-authorized. No migration was applied to either Supabase project in Phase 29.

## Authoritative migration matrix

The source inventory below is generated from a read-only query of Production's `supabase_migrations.schema_migrations`. `md5` is calculated by PostgreSQL over the exact SQL string; `characters` is PostgreSQL `length()` of that same string. The companion manifest is the executable check input.

| Version | Name | Canonical file | Characters | MD5 |
|---|---|---|---:|---|
| `20261008173336` | `phase1_foundation` | `supabase/migrations/20261008173336_phase1_foundation.sql` | 12142 | `12ce32c68a90886c1673eee121218451` |
| `20261009032438` | `phase6_student_photo_matching` | `supabase/migrations/20261009032438_phase6_student_photo_matching.sql` | 5430 | `02a05b4425de04d6d8386d47ebce7d40` |
| `20261009032635` | `phase6_storage_policy_hardening` | `supabase/migrations/20261009032635_phase6_storage_policy_hardening.sql` | 2673 | `728ea8d9cf530707c40e1fbcef953cfa` |
| `20261009032855` | `phase6_photo_batch_byte_limits` | `supabase/migrations/20261009032855_phase6_photo_batch_byte_limits.sql` | 1369 | `37f1543b9118ba3fdd635f98792c79e4` |
| `20261009033031` | `phase6_photo_fk_indexes` | `supabase/migrations/20261009033031_phase6_photo_fk_indexes.sql` | 423 | `26bc112f2cc19ce586fd307752bf3e45` |
| `20261009033838` | `phase6_photo_path_reservations` | `supabase/migrations/20261009033838_phase6_photo_path_reservations.sql` | 2853 | `ebfc2b05efa04b56e04205b5f8433880` |
| `20261009041524` | `phase7_photo_processing` | `supabase/migrations/20261009041524_phase7_photo_processing.sql` | 2437 | `108cc28f4700a705f8b1aa67a92c6a94` |
| `20261009043227` | `phase8_card_rendering` | `supabase/migrations/20261009043227_phase8_card_rendering.sql` | 2475 | `cf7130071edd2fe750a202cfc1587cff` |
| `20261009043836` | `phase8_rendering_engine` | `supabase/migrations/20261009043836_phase8_rendering_engine.sql` | 2839 | `c8f67c00df825d6e7d5b4aabd5bcff44` |
| `20261009043900` | `phase8_render_template_index` | `supabase/migrations/20261009043900_phase8_render_template_index.sql` | 128 | `14ab792ffab57cb53c47badedfcbacef` |
| `20261009045334` | `phase8_svg_template_type` | `supabase/migrations/20261009045334_phase8_svg_template_type.sql` | 230 | `0d9dad990d04e25b024e5eb5c89f8802` |
| `20261009045509` | `phase8_rendering_engine` | `supabase/migrations/20261009045509_phase8_rendering_engine.sql` | 3165 | `47e6594aa65282191faaa5f8a36612f8` |
| `20261009054041` | `phase8_template_sides` | `supabase/migrations/20261009054041_phase8_template_sides.sql` | 251 | `9697d043b213f44d23e6d2042d0ec6be` |
| `20261009055657` | `phase9_batch_generation_engine` | `supabase/migrations/20261009055657_phase9_batch_generation_engine.sql` | 5618 | `07697a255db890f0e1f76cfa79c02500` |
| `20261009055811` | `phase9_batch_status_transitions` | `supabase/migrations/20261009055811_phase9_batch_status_transitions.sql` | 373 | `4eb1520eb4a1c213e40a57d4008ed411` |
| `20261009055901` | `phase9_batch_worker_authorization` | `supabase/migrations/20261009055901_phase9_batch_worker_authorization.sql` | 2573 | `79bada05756f3c606fc69334307e7cb7` |
| `20261009055932` | `phase9_qualify_item_rls` | `supabase/migrations/20261009055932_phase9_qualify_item_rls.sql` | 1398 | `ce0137db08aac335e0b349776de70cd1` |
| `20261009061659` | `phase10_validation` | `supabase/migrations/20261009061659_phase10_validation.sql` | 3805 | `6bda46f13bfbee75510d6fb603774fb3` |
| `20261009062045` | `phase10_stale_output_invalidation` | `supabase/migrations/20261009062045_phase10_stale_output_invalidation.sql` | 1247 | `e6817f4eab8e531beb212691511a3393` |
| `20261009063018` | `phase10_validation_settings` | `supabase/migrations/20261009063018_phase10_validation_settings.sql` | 324 | `225b94bf055d70ac7944eb539567a8e2` |
| `20261009063718` | `phase10_critical_finding_guard` | `supabase/migrations/20261009063718_phase10_critical_finding_guard.sql` | 1866 | `29a93eb24a5cfab77002540bf5bd459a` |
| `20261009064158` | `phase10_finding_insert_guard` | `supabase/migrations/20261009064158_phase10_finding_insert_guard.sql` | 2280 | `980cdb3dbba3bda4b9b519c8438ae1f9` |
| `20261009070649` | `phase11_zip_exports` | `supabase/migrations/20261009070649_phase11_zip_exports.sql` | 4173 | `7d5102062b3de44b804dee1fb75067b1` |
| `20261009070909` | `phase11_exports_policy_qualification` | `supabase/migrations/20261009070909_phase11_exports_policy_qualification.sql` | 474 | `2c89a12c337affe180cfb68bc7681bd3` |
| `20261009071118` | `phase11_export_retry_limits` | `supabase/migrations/20261009071118_phase11_export_retry_limits.sql` | 220 | `985851d64398d0dc68766a6643029be6` |
| `20261009071434` | `phase11_export_fk_index` | `supabase/migrations/20261009071434_phase11_export_fk_index.sql` | 107 | `80c1b5939b9ceaaa0896fc2fa17a3bd9` |
| `20261009095425` | `phase13_security_hardening` | `supabase/migrations/20261009095425_phase13_security_hardening.sql` | 18743 | `5483daa08cf8d3c23ad4a91a2f360d45` |
| `20261009095538` | `phase13_function_privileges` | `supabase/migrations/20261009095538_phase13_function_privileges.sql` | 326 | `49d88c1bfa39416d50e2f4d740bcd0cb` |
| `20261009095800` | `phase13_security_hardening_v2` | `supabase/migrations/20261009095800_phase13_security_hardening_v2.sql` | 14838 | `cd13eb833c54d3edcbd0a8722d263ff6` |
| `20261009095926` | `phase13_storage_path_policy_fix` | `supabase/migrations/20261009095926_phase13_storage_path_policy_fix.sql` | 2876 | `bb4dc342d03a8f912e46f4e2cab97cb0` |
| `20261009095940` | `phase13_default_function_privileges` | `supabase/migrations/20261009095940_phase13_default_function_privileges.sql` | 245 | `24f94b1a16fa386e36d4a94bfe368566` |
| `20261009100225` | `phase13_audit_status_metadata` | `supabase/migrations/20261009100225_phase13_audit_status_metadata.sql` | 2890 | `ae9d3a1c0d681fc1d001abe565e63567` |
| `20261009100320` | `phase13_rate_limits` | `supabase/migrations/20261009100320_phase13_rate_limits.sql` | 2334 | `a496b994c57fc0dfaba1fdcc73898c65` |
| `20261009100339` | `phase13_validate_tenant_constraints` | `supabase/migrations/20261009100339_phase13_validate_tenant_constraints.sql` | 1359 | `efe02fc40657eb960ff995e3f24f38dd` |
| `20261009100605` | `phase13_fixed_rate_limit_quotas` | `supabase/migrations/20261009100605_phase13_fixed_rate_limit_quotas.sql` | 2250 | `4ebed15fd5a1ed2deb792723c82229b6` |
| `20261009100837` | `phase13_rate_limit_deny_policy` | `supabase/migrations/20261009100837_phase13_rate_limit_deny_policy.sql` | 329 | `3d1d70dab73897c9b156bf723e47fca7` |
| `20261009101327` | `phase13_photo_processing_rate_limit` | `supabase/migrations/20261009101327_phase13_photo_processing_rate_limit.sql` | 2178 | `3458c481bfee29a9bbe8d9d3138b549d` |
| `20261009101414` | `phase13_photo_processing_quota` | `supabase/migrations/20261009101414_phase13_photo_processing_quota.sql` | 2659 | `989bb0059da2db60748bfbb911acce0c` |
| `20261010125420` | `phase18_batch_worker_recovery` | `supabase/migrations/20261010125420_phase18_batch_worker_recovery.sql` | 5285 | `19002bee3f5b1a9e4f9bc6f8ae906339` |

## Isolated ledger reconciliation matrix

The isolated project's 13 ledger rows were re-read read-only and reconciled to their recorded SQL/file provenance:

| Isolated ledger version | Ledger name | Source file / canonical mapping | SQL comparison | Interpretation |
|---|---|---|---|---|
| `20261014173555` | `phase28_snapshot_01_tables` | `supabase/recovery/phase28_snapshot/01_create_tables.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014173759` | `phase28_snapshot_02_constraints_indexes` | `supabase/recovery/phase28_snapshot/02_constraints_indexes.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014173808` | `phase28_snapshot_03_functions` | `supabase/recovery/phase28_snapshot/03_create_functions.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014173817` | `phase28_snapshot_04_privileges` | `supabase/recovery/phase28_snapshot/04_function_table_privileges.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014173821` | `phase28_snapshot_05_rls_buckets` | `supabase/recovery/phase28_snapshot/05_rls_and_private_buckets.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014173910` | `phase28_snapshot_06_policies_triggers` | `supabase/recovery/phase28_snapshot/06_policies_and_triggers.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014174007` | `phase19_export_download_audit_rpc` | `supabase/migrations/20261010140000_phase19_export_download_audit_rpc.sql` | **Exact match**, 1,906 characters | Applied to snapshot bootstrap under a different ledger version |
| `20261014174011` | `phase24_canonical_student_identifiers` | `supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql` | **Exact match**, 11,519 characters | Applied to snapshot bootstrap under a different ledger version |
| `20261014174016` | `phase24_identifier_correction_rpc` | `supabase/migrations/20261013120100_phase24_identifier_correction_rpc.sql` | **Exact match**, 8,205 characters | Applied to snapshot bootstrap under a different ledger version |
| `20261014174019` | `phase24_worker_identifier_ordering` | `supabase/migrations/20261013120200_phase24_worker_identifier_ordering.sql` | **Exact match**, 3,142 characters | Applied to snapshot bootstrap under a different ledger version |
| `20261014174920` | `phase28_snapshot_07_rls_event_trigger` | `supabase/recovery/phase28_snapshot/07_rls_event_trigger.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014175843` | `phase28_snapshot_08_table_grant_repair` | `supabase/recovery/phase28_snapshot/08_table_grant_repair.sql` | Snapshot chunk; not a historical migration | Bootstrap snapshot only |
| `20261014182500` | `phase28_export_status_transitions` | `supabase/migrations/20261014182500_phase28_export_status_transitions.sql` | **Exact match**, 680 characters | Isolated-only forward migration |

This confirms all five non-snapshot SQL files in the isolated ledger match their tracked migration file byte-for-byte. The six snapshot chunks plus the two later snapshot-repair chunks are not part of the 39-row Production historical ledger and must not be treated as original chronological migrations.

## Legacy SQL scripts outside the canonical migration directory

The following tracked SQL files remain outside `supabase/migrations/`. They are preserved, but are **not automatically replayed** by the canonical Supabase migration runner; some overlap with the newly restored canonical migrations. Do not apply them as additional steps without dependency and duplicate-DDL review:

- `supabase/phase2_backend.sql`
- `supabase/phase3_project_templates.sql`
- `supabase/phase6_student_photo_matching.sql`
- `supabase/phase7_photo_processing.sql`
- `supabase/phase8_card_rendering.sql`
- `supabase/phase8_rendering_engine.sql`
- `supabase/phase9_batch_generation_engine.sql`
- `supabase/phase9_batch_status_transitions.sql`
- `supabase/phase9_batch_worker_authorization.sql`
- `supabase/phase9_qualify_item_rls.sql`
- `supabase/phase9_worker_invoker_and_indexes.sql`
- `supabase/phase10_validation.sql`
- `supabase/phase10_validation_settings.sql`
- `supabase/phase10_stale_output_invalidation.sql`
- `supabase/phase10_critical_finding_guard.sql`
- `supabase/phase10_finding_insert_guard.sql`
- `supabase/phase11_zip_exports.sql`
- `supabase/phase13_rate_limits.sql`
- `supabase/phase13_security_hardening.sql`
- `supabase/phase13_storage_path_policy_fix.sql`

## Current Supabase advisor findings (15 October 2026)

These checks were read-only. No advisor-driven DDL or privilege changes were applied.

| Project | Advisor | Current finding |
|---|---|---|
| Isolated `zzecjgauhkaxyptsurlw` | Security | 2 warnings: authenticated execution of SECURITY DEFINER RPCs `consume_security_rate_limit` and `record_export_download_link_issued` |
| Production `xdoenkusrakuyyxnnkff` | Security | 1 warning: authenticated execution of SECURITY DEFINER RPC `consume_security_rate_limit` |
| Isolated | Performance | 28 unindexed foreign keys; 47 unused-index notices; 4 duplicate-index warnings |
| Production | Performance | 28 unindexed foreign keys; 50 unused-index notices; 4 duplicate-index warnings |

Security advisor guidance: [Supabase database linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Foreign-key index guidance: [Supabase database linter 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). Duplicate/unused indexes should be reviewed with real query plans and representative workload before removing or adding indexes. The two isolated SECURITY DEFINER RPCs are used by application flows and need a privilege/authorization review rather than a blind revoke. Production was not changed.

**Dependency audit:** the latest previous CI evidence reports three moderate `sprintf-js`/`argparse` transitive findings and no committed npm lockfile. The Phase 29 CI audit is in progress; no forced downgrade was applied because the previously proposed TensorFlow downgrade was breaking.

## Additional tracked migrations outside Production's recorded history

| Version | File | Status / interpretation |
|---|---|---|
| `20261010140000` | `supabase/migrations/20261010140000_phase19_export_download_audit_rpc.sql` | Not in Production ledger; recorded in isolated snapshot history under a different version. Requires replay and SQL checksum verification before being treated as part of a clean historical chain. |
| `20261013120000` | `supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql` | Not in Production ledger; isolated snapshot history used a later synthetic ledger version. |
| `20261013120100` | `supabase/migrations/20261013120100_phase24_identifier_correction_rpc.sql` | Not in Production ledger; isolated snapshot history used a later synthetic ledger version. |
| `20261013120200` | `supabase/migrations/20261013120200_phase24_worker_identifier_ordering.sql` | Not in Production ledger; isolated snapshot history used a later synthetic ledger version. |
| `20261014182500` | `supabase/migrations/20261014182500_phase28_export_status_transitions.sql` | Isolated-only forward migration; recorded in isolated ledger, not in Production ledger. |

These five files are intentionally kept as later migrations, not misrepresented as Production-applied history. Their compatibility with a fresh historical replay remains unverified until clean-room execution.

## Existing isolated database

- Target checked read-only: `zzecjgauhkaxyptsurlw`, name `PrintForge Phase 25 Synthetic Acceptance`, region `ap-south-1`, status `ACTIVE_HEALTHY`.
- Its current ledger has 13 entries: eight schema-snapshot/bootstrap chunks, the Phase 19/24 SQL recorded with snapshot-era versions, and the Phase 28 export-status migration.
- The isolated project has application tables and RLS enabled, but that state was created through snapshot bootstrap, not by replaying all 39 historical migrations from empty.
- No reset, destructive DDL, ledger rewrite, or migration application was performed in Phase 29.

## Clean-room and live acceptance

- **Clean-room replay: BLOCKED.** No local PostgreSQL binaries or Docker runtime are available; external network is unavailable for obtaining a runtime. The current isolated project is not used as a reset target without explicit authorization.
- **Authenticated browser: BLOCKED.** TinyFish has only a default profile with no recorded signed-in sites. Preview SSO remains enabled; no bypass or credential collection was attempted.
- **Preview alignment: PARTIAL.** Vercel confirmed a READY non-production Preview for commit `173e38f374380cd4d831bcaff77222f73f0e9126` (`https://printforge-phase27-acceptance-ehf3pftlh-yash-6966.vercel.app`, target `null`). The current branch head `78dffadd5d90def1c6e610b6df6a8a2ed37091f4` had a queued Preview at last inspection, so the exact current commit did not yet have a READY deployment. Reading project configuration/environment metadata was denied by Vercel team-scope authorization (403); no environment values were accessed. Exact branch-scoped database configuration therefore remains NOT VERIFIED.
- **Persisted 300-record batch, worker recovery, real ZIP/download hashes, HTTP/storage tenant denial, backup/restore, physical camera/print: NOT VERIFIED.** No live authenticated app workflow was run.

## Safety and remediation

1. Run `node scripts/phase29-authoritative-ledger-check.mjs` in CI; resolve any checksum/length mismatch against the read-only source manifest before proceeding.
2. Reconcile the five post-Production migrations and all legacy SQL files against a genuinely empty disposable PostgreSQL environment; capture actual failures and fix root causes without skipping migrations.
3. Inspect current Vercel Preview deployment by project ID, verify the exact commit SHA and isolated database configuration without printing environment-variable values.
4. Set up an authorized TinyFish sign-in profile through the official setup flow, then run real authenticated API/Storage/browser acceptance.
5. Complete persisted batch/worker fault-injection, real ZIP manifest/hash checks, cross-tenant denials, backup/restore and hardware checks.
6. Keep PR #11 unmerged and do not deploy Production until all blockers have evidence-backed resolution.

## Phase 29 file changes

- Restored 17 missing historical migration SQL files directly from Production's read-only migration ledger.
- Replaced the incorrect Phase 18 timestamp/content and the drifted Phase 13 audit-metadata SQL in the canonical directory with the exact ledger versions/content; preserved both superseded candidates under `supabase/recovery/phase29_superseded_migration_candidates/`.
- Added `supabase/recovery/phase29-authoritative-migration-ledger.json`, an executable checksum checker, this report, and a CI step.

**Final Phase 29 decision: PARTIAL. Production remains NOT CERTIFIED.**