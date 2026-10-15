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
