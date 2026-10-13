# Phase 24 — canonical student identifiers, integrity, and generation audit

## Starting point and verified status

- Repository: `fuelify12/Id-card`
- Starting branch: `phase-23-student-photo-workflow`
- Starting SHA: `7ab8627fead2c890f1c5fb552cb8abe3f4fe96ce`
- Phase 23 PR #7: open, draft, unmerged.
- Phase 23 latest documentation-only CI run: [38378979452](https://github.com/fuelify12/Id-card/actions/runs/38378979452), successful.
- Phase 23 code test run: [38378545986](https://github.com/fuelify12/Id-card/actions/runs/38378545986), successful (81 tests across 12 test files, TypeScript/build passed, lint passed with 12 warnings).
- Production Supabase project `xdoenkusrakuyyxnnkff` was inspected read-only. `students.serial_number` is `integer NOT NULL`; batch and generated-card snapshots also use integer serial columns. Read-only counts returned zero rows in students, student_photos, batch_generation_items, and generated_cards at inspection time.
- Supabase project listing shows only the production `Id-card` project; branch listing shows only its default `main` branch, not an isolated test branch. No migration or student/photo mutation was run against Production.
- No Phase 21 audit document was found at the expected docs paths. This phase therefore uses the actual source, migrations, schema metadata, and workflow results as evidence.

## Identifier dependency map

1. **Spreadsheet parsing and import:** `lib/imports/student-spreadsheet.ts`, `components/projects/student-import-workspace.tsx`, `app/dashboard/actions.ts`.
2. **Student data model and uniqueness:** `public.students.serial_number` was numeric; new `student_identifier` is canonical text and `student_identifier_settings` stores per-project normalization policy.
3. **Photo filename parsing/matching:** `lib/photos/matching.ts`, `app/dashboard/actions.ts`, `components/projects/student-photo-workspace.tsx`, `public.student_photos`.
4. **Validation and preflight:** `lib/validation/engine.ts`, `app/api/projects/[id]/validation/route.ts`, `app/api/projects/[id]/batch/route.ts`.
5. **Rendering:** `lib/rendering/types.ts`, `lib/rendering/engine.ts`, `app/api/projects/[id]/render/route.ts`.
6. **Batch snapshots and retries:** `public.batch_generation_items`, `public.processing_jobs`, `app/api/projects/[id]/batch/route.ts`, `public.claim_batch_generation_items(...)`.
7. **Card metadata and export:** `public.generated_cards`, `app/api/projects/[id]/exports/route.ts`, `app/api/projects/[id]/exports/card/[cardId]/route.ts`, `lib/exports/archive.ts`.

## Migration design

Migration: `supabase/migrations/20261013120000_phase24_canonical_student_identifiers.sql`

- Additive columns: project identifier settings and text snapshots on students, photos, batch items, and generated cards.
- Backfill from what is actually stored: `serial_number::text`. This does not invent leading zeros; if an old numeric value is 1, the backfilled value is `1`, not `001`.
- Every row present at migration time is tagged `legacy_numeric_backfill` and `student_identifier_review_required=true`. Card/batch validation blocks these rows until the owner explicitly confirms the shown identifier or enters a corrected one in the project workspace.
- Existing student IDs, photo associations, batch item foreign keys, card foreign keys, and storage paths are not deleted or rewritten.
- Legacy integer columns remain as compatibility projections. They become nullable so `001` and alphanumeric IDs can exist without a lossy numeric cast. The application stores a legacy integer projection only when the exact canonical ID is an unpadded integer within the legacy range.
- Unique indexes are scoped to project/batch: `(project_id, student_identifier)`, `(project_id, student_identifier_unique)`, `(batch_id, student_identifier)`. The persisted uniqueness key applies the project policy consistently for case and numeric normalization; the existing integer indexes remain for old readers.
- Compatibility triggers fill missing text snapshots from existing integer values for old numeric writers; they never infer lost zero padding. New spreadsheet imports are tagged `spreadsheet` and do not require legacy review.
- The `correct_student_identifier` RPC runs as the authenticated invoker, checks project ownership, validates uniqueness and normalization, refuses changes during active processing, updates the student and its associated photo identifier snapshots in one transaction, refreshes pending batch/job snapshots, and invalidates previously succeeded batch items for regeneration. Historical generated-card metadata remains a snapshot and is not silently rewritten.
- Batch item, processing-job, and generated-card snapshots carry the canonical text identifier. The existing worker-claim function was intentionally left unchanged to avoid replacing unverified retry/lease logic; its numeric sort order remains a non-identity presentation detail.
- Check constraints are added `NOT VALID` to enforce new writes without forcing a production data rewrite during migration.
- The migration is transactional and rerunnable for columns, indexes, constraints, and triggers. The worker-claim function is not replaced by this phase.

### Rollout and rollback

1. Apply and validate this migration only in an isolated disposable database.
2. Run schema assertions in `supabase/tests/phase24_student_identifier_schema.sql` and the complete automated suite.
3. Deploy the application code only after the schema is present. The current code intentionally expects the new columns; deploying it before migration would cause project-page/import queries to fail.
4. Keep the integer columns during the compatibility window. Before any text-only identifiers are created, an application rollback can retain the additive schema. After text-only identifiers or corrected identifiers are in use, rollback to Phase 23 is not safe for those records because that code expects numeric serials; retain Phase 24 or ship a tested compatibility hotfix. Do not drop the text columns or rewrite identifiers during rollback.
5. Before any eventual Production migration, take/verify a backup and perform a dry-run on an isolated clone. No Production migration is authorized by this PR.

## Canonical semantics

- Default: exact, case-sensitive text identifiers; no implicit trimming; maximum 64 characters; supported letters, digits, dot, underscore, slash, and hyphen.
- `001` and `1` remain distinct by default.
- Numeric normalization is opt-in and turns digit-only strings into a canonical decimal string using BigInt, not Number-based identity matching.
- Identifier settings are locked after the first student import to prevent existing photo, batch, and export relationships from being reinterpreted.
- Case-insensitive mode is supported through the persisted `student_identifier_unique` comparison key; default configuration remains case-sensitive.
- Prefix-style filename IDs such as `STU-001.jpg` require the project prefix configuration. Ambiguous and generic names are routed to manual review.
- Student UUID remains the authoritative foreign-key association. Text identifiers are scoped lookup/display keys, never a replacement for project authorization or the student UUID.

## Tests added or updated

- `lib/identifiers/student-identifier.ts` and `tests/student-identifier.test.ts`: canonical parser, whitespace policy, leading zeros, alphanumeric values, opt-in numeric normalization, duplicate keys.
- `tests/student-identifier-flow.test.ts`: import → photo matching → render-field value → ZIP manifest consistency.
- `tests/student-identifier-migration.test.ts`: migration safety contract and idempotency guards.
- `supabase/tests/phase24_student_identifier_schema.sql`: read-only schema assertions to run after the migration in an isolated database.
- `tests/student-spreadsheet.test.ts` and `tests/photo-matching.test.ts`: exact default matching and configured prefix/numeric-normalization regressions.
- Phase 24 CI workflow: `.github/workflows/phase24-identifiers.yml`.

## Acceptance limitations

- Migration has **not** been applied to Production.
- No isolated Supabase development/test branch is currently available through the connected project listing; the only listed branch is the default `main`. Migration execution and live RLS/unique-constraint tests therefore remain blocked until an isolated database is provisioned under an already authorized plan.
- Vercel preview is protected by SSO; no authenticated browser session was available in the prior Phase 23 acceptance attempt. Phase 24 does not bypass SSO or perform live data writes.
- Physical Android camera acceptance remains a Phase 23 limitation, independent of the identifier migration.
- Historical leading zeros lost before this migration cannot be recovered automatically. Any corrected identifier must be supplied and explicitly reviewed by the project owner.
