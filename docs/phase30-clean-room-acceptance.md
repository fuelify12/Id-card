# Phase 30 — Clean-Room Replay and Acceptance

**Status at branch creation:** migration checksum evidence exists, but clean-room replay, authenticated end-to-end acceptance, backup/restore, and Preview environment alignment were not yet verified.

## Baseline verified from live services

- Repository head on `phase-28-authoritative-schema-recovery`: `630d69b46c16b761ecb9ae6cc3a843f334506e96`.
- Phase 29 full regression run: [38675867308](https://github.com/fuelify12/Id-card/actions/runs/38675867308), completed **success** on `2d304afb0f0c9d5d05ec23fbe4ae192bccb7f32a`.
- Documentation-head run: [38676179682](https://github.com/fuelify12/Id-card/actions/runs/38676179682), completed **success** on `630d69b46c16b761ecb9ae6cc3a843f334506e96`.
- PR #11 and #12 remain open, draft, and unmerged.
- The tested-code Preview and documentation-head Preview were reported READY; the latter's deployment metadata matches `630d69b46c16b761ecb9ae6cc3a843f334506e96`, target `null` (Preview).
- The isolated Supabase project is currently `ACTIVE_HEALTHY`; its migration ledger includes eight `phase28_snapshot_*` entries and five additional migrations. It has existing application tables, so it is **not** treated as an empty database and was not reset.
- TinyFish's only available browser profile has no recorded signed-in sites.
- Local runtime discovery found Node.js and npm, but no `psql`, `postgres`, `docker`, or Supabase CLI.

## Phase 30 automation added

- `scripts/phase30-migration-inventory-check.mjs` checks canonical filename syntax, strictly increasing and unique versions, manifest ordering, missing manifest files, and prevents snapshot-like SQL from silently being treated as ordinary canonical migrations.
- `.github/workflows/phase30-clean-room-migration-replay.yml` runs the existing authoritative checksum check, the new inventory check, initializes a default local Supabase configuration only inside the disposable CI workspace if absent, starts a local Supabase stack, runs `supabase db reset --local` against that local disposable stack, lists the resulting migration history, and runs SQL database tests when present. It uploads only a small sanitized summary.
- A green checksum job is not replay proof. Only a completed successful run of the clean-room workflow on the exact SHA can establish replay success.

## Still not verified

1. Preview environment variables' project relationship: Vercel project configuration access returned 403. No environment values were read or disclosed.
2. Authenticated UI/API workflow: no authorized signed-in browser profile exists.
3. Persisted 300-student batch, worker recovery, actual ZIP integrity/download, live cross-tenant denial, and backup/restore.
4. SQL chain compatibility: this must be determined by the new clean-room replay. A failure is evidence of a real blocker and must not be bypassed by skipping migrations or importing a final schema snapshot.

## Safety

No Production schema/data mutation, existing isolated-project reset, Production deployment, or PR merge was performed. Phase 30 work remains on a dedicated branch.

## Clean-room replay attempt — failed with a reproducible historical-chain gap

Workflow: [run 38687519743](https://github.com/fuelify12/Id-card/actions/runs/38687519743), tested SHA `3bae77f25e31653c288741c58638491262ef9353`.

- The authoritative checksum check passed (39 ledger entries; 44 canonical SQL files).
- The inventory check passed.
- GitHub Actions initialized a fresh, disposable local Supabase stack. Supabase CLI downloaded the required containers and began applying canonical migrations.
- Replay stopped at `20261009054041_phase8_template_sides.sql` with PostgreSQL SQLSTATE `42703`: column `is_active` does not exist, at the partial unique index predicate `where is_active = true`.
- Earlier Phase 1 migration creates `public.templates` without `is_active`. The legacy `supabase/phase3_project_templates.sql` file adds `version_number` and `is_active`, but it is not in `supabase/migrations` and has no row in the 39-entry authoritative Production ledger. This is direct evidence of a gap between the canonical replay chain and the historically documented schema path.
- Read-only `information_schema.columns` checks show `public.templates.is_active` exists in both current Production and the existing isolated project. Neither database was changed by this failed replay.
- The legacy Phase 3 SQL must not simply be copied into the chain or the failing historical SQL edited without reviewing its complete provenance, dependencies, and idempotence. The replay is therefore **FAIL** for the current canonical chain; a provenance-backed migration-chain repair and a new fresh replay are required.

Docker registry returned transient `toomanyrequests` errors while pulling images, but the pull eventually progressed. The terminal blocker was the PostgreSQL missing-column error, not the registry throttling.

## Gate status after this run

- Authoritative source checksum: **PASS**.
- Migration inventory/order: **PASS** for the checks implemented.
- Clean-room migration replay: **FAIL** on `20261009054041_phase8_template_sides.sql`.
- Authenticated E2E: **BLOCKED** because the only browser profile has no recorded signed-in sites.
- Preview environment alignment: **NOT VERIFIED** because authorized Vercel project configuration inspection returned 403.
- Persisted 300-student batch, worker fault recovery, actual ZIP/download authorization, live cross-tenant denial, and backup/restore: **NOT VERIFIED**.
