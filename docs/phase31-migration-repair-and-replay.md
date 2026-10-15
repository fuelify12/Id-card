# Phase 31 — Migration Provenance and Replay Evidence

**Status: PARTIAL — no schema repair committed.** This report intentionally stops short of a speculative migration change because the repository's authoritative Production migration history conflicts with the only identified source for the missing template columns.

## Verified repository baseline

- Repository: [fuelify12/Id-card](https://github.com/fuelify12/Id-card)
- Starting Phase 30 head: `809e2388a6a522c1d5752e8f13d2fded69efc550`
- Starting branch: `phase-30-clean-room-acceptance`
- Phase 30 PR: [#13](https://github.com/fuelify12/Id-card/pull/13), open, draft, unmerged; base `phase-28-authoritative-schema-recovery`; head SHA above.
- New Phase 31 branch: `phase-31-provenance-analysis`, created directly from the verified Phase 30 head.
- The authoritative manifest at `supabase/recovery/phase29-authoritative-migration-ledger.json` identifies its source as the read-only Production `supabase_migrations.schema_migrations` ledger and contains 39 entries. The canonical directory contains 44 SQL files, according to Phase 30's recorded inventory run.

## Provenance findings

### Directly verified

1. The canonical foundation migration `supabase/migrations/20261008173336_phase1_foundation.sql` creates `public.templates` with `project_id`, `owner_id`, template metadata, `analysis`, timestamps, and related columns, but does **not** define `version_number` or `is_active`.
2. The legacy file `supabase/phase3_project_templates.sql` is outside `supabase/migrations`. Its header says “School project + template versioning additions applied to production Supabase.”
3. That legacy SQL does more than add the two columns. It also creates `idx_templates_project_version`, the partial unique index `uq_templates_active_project`, defines `public.set_active_template_version(uuid, uuid)`, and changes its function privileges (revoke from `public`, grant to `authenticated`). It refers to `project_id`, `owner_id`, and `updated_at`, which are present in the foundation schema.
4. GitHub commit search finds Phase 3 workspace commits on 8 October 2026, including [a0055f9](https://github.com/fuelify12/Id-card/commit/a0055f9ccefd7a6916e0cdd9e86bff8fa9050508), titled “Add Phase 3 project and template workspace.” The search result alone does not prove exactly when or by what mechanism the legacy SQL was applied to Production. The available evidence does not establish whether it was run manually, by a deployment script, or by another process.
5. The authoritative 39-entry Production manifest does not include a migration entry for `supabase/phase3_project_templates.sql` or the Phase 3 schema changes. Its recorded first migration is `20261008173336_phase1_foundation`.
6. `supabase/migrations/20261009054041_phase8_template_sides.sql` creates a unique index whose predicate is `where is_active = true`. A clean-room replay log confirms PostgreSQL SQLSTATE `42703` at this statement because `is_active` has not been created by the preceding canonical migrations.
7. The Phase 30 report records read-only checks showing `is_active` exists in current Production and the existing isolated project. Those live schemas are not evidence that the canonical migration chain can reproduce the same state.

### Repeatability and dependency assessment

The legacy SQL uses `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`; these clauses make some individual operations repeatable, but do not prove the file is safe as a canonical migration. The unique indexes can fail if existing rows violate their uniqueness predicates. Function replacement and grants also have security/behavior implications. Its exact historical execution and the corresponding Production migration-ledger entry remain unproven.

## Repair decision

**No migration repair is justified yet.**

- Editing the historical Phase 8 migration would change a migration already recorded in Production and violate the checksum/immutability evidence.
- Blindly copying the legacy SQL into a new migration with a later timestamp cannot fix a fresh replay that fails at Phase 8 first.
- Inserting a migration timestamp before Phase 8 might make a fresh replay progress, but the authoritative Production ledger does not show that migration as applied. This risks an inconsistent local/remote migration history and cannot be justified without an approved reconciliation of the ledger and the exact deployed SQL.
- Rewriting the authoritative 39-entry manifest or its checksums is not supported by evidence.
- No schema change was made to Production or to the existing isolated Supabase project.

The unresolved question is: **What is the authoritative historical record (deployment log, exact SQL applied, or approved ledger reconciliation) for the Phase 3 template-versioning SQL that is reflected in live schemas but absent from the Production migration ledger?** Obtain that evidence before selecting a compatibility migration strategy.

## Replay and CI evidence

- [Phase 30 clean-room replay run 38687519743](https://github.com/fuelify12/Id-card/actions/runs/38687519743) tested SHA `3bae77f25e31653c288741c58638491262ef9353`: checksum and inventory checks passed; fresh local replay failed at `20261009054041_phase8_template_sides.sql` with SQLSTATE `42703`.
- [Phase 30 workflow run 38687786585](https://github.com/fuelify12/Id-card/actions/runs/38687786585) has a completed failed job. The retrieved job log again shows the foundation and preceding migrations applied, then the same missing-`is_active` SQL error at Phase 8. The checksum and inventory steps passed. Migration history verification and database tests were skipped after replay failure.
- The current combined commit status for `809e2388a6a522c1d5752e8f13d2fded69efc550` reports a failing Vercel status. No passing final-head CI evidence exists for a Phase 31 repair because no schema repair has been made.
- Docker image pulls completed in the inspected failing replay log; the terminal failure was the PostgreSQL schema error, not a registry rate limit.
- No post-replay catalog verification was possible because replay did not complete. Storage, RLS, triggers, grants, indexes, and full migration history on a successfully replayed fresh database remain unverified.

## Preview and other acceptance boundaries

- Vercel Preview-to-Supabase target alignment remains **NOT VERIFIED**; Phase 30 recorded a Vercel configuration permission 403. A deployment target reported as `null` is not proof of database alignment.
- Authenticated browser E2E remains blocked because no authorized signed-in browser session was available.
- 300-student batch persistence/recovery, photo-to-student matching edge cases, ZIP integrity/download authorization, cross-tenant denial, backup/restore, role/grant exploitability, Android device acceptance, and physical printer acceptance remain unverified.
- No Production deployment, PR merge, Supabase reset, or Supabase schema mutation was performed.

## Gate table

| Gate | Status | Evidence |
|---|---|---|
| Phase 30 head/PR inspected | PASS | Live GitHub branch and PR #13 metadata |
| Phase 3 legacy SQL inspected | PASS | Full file read; commit search results |
| Historical execution mechanism proven | PARTIAL | Commit history and file header exist; execution/deployment record missing |
| Canonical replay on current Phase 30 head | FAIL | Run 38687786585; SQLSTATE 42703 at Phase 8 |
| Authoritative checksum/inventory checks | PASS | Both passed in replay workflow |
| Successful fresh replay and post-replay schema verification | FAIL | Replay stops before catalog verification |
| Phase 31 schema fix | NOT VERIFIED | Deliberately not applied without provenance |
| Final-head Phase 31 regression suite | NOT VERIFIED | No repair commit exists |
| Vercel Preview/database alignment | NOT VERIFIED | Configuration access was blocked |
| Authenticated E2E and operational acceptance | BLOCKED | Authorized session and separate acceptance evidence unavailable |
| Production safety (no changes/deploy/merge) | PASS | No Production or populated isolated-project mutation performed |

## Next concrete action

Retrieve the authoritative deployment record or approved schema-ledger reconciliation for the Phase 3 SQL. Then choose a forward-compatible repair that preserves existing Production migration checksums, add catalog-level assertions, and rerun the fresh Supabase workflow against the exact final SHA. Until then, the canonical migration chain remains **FAIL** and Production readiness is not certified.
