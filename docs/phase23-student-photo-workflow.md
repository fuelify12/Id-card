# Phase 23 — student photo workflow audit and implementation report

## Starting point

- Repository: `fuelify12/Id-card`
- Starting branch: `phase-22-school-import-mapping`
- Starting commit: `f5e1bd496378fb385159c8ee63ce2ad27e231795`
- Phase 22 PR: [#6](https://github.com/fuelify12/Id-card/pull/6), open and unmerged.
- Phase 22 CI at the starting commit: [run 38375952786](https://github.com/fuelify12/Id-card/actions/runs/38375952786), successful.
- No Phase 21 audit document was found at the expected `docs/phase21*` or `docs/PHASE_21*` paths. This report therefore treats the current source and migrations as the audit evidence, not an assumed prior pass.

## Existing functionality verified in source

- `components/projects/student-photo-workspace.tsx`: multi-file and ZIP queue, four-worker upload concurrency, retry of failed/cancelled queue items, cancel handling, filename prefix configuration, matching review, manual assignment and confirmation.
- `components/projects/camera-capture.tsx`: user-initiated camera access, front/rear selection, capture preview, retake, device-file fallback, and track cleanup.
- `lib/photos/matching.ts`: deterministic filename parsing, configured prefix, unknown/duplicate student handling, content-hash duplicate flags, ZIP path checks, and file/batch bounds.
- `lib/photos/image-validation.ts`: SHA-256, JPEG/PNG/WebP signature detection, Sharp metadata/decode checks, and pixel limits.
- `components/projects/photo-crop-review-workspace.tsx` and `app/api/projects/[id]/photos/[photoId]/process/route.ts`: crop controls, optional face-crop suggestions, warning states, derivative generation, persisted crop metadata, and private signed previews.
- `app/dashboard/actions.ts`: authenticated project checks, private storage upload tickets, server-side content validation, matching proposals, manual reassignment checks, signed preview URLs, and explicit photo approval.
- `app/api/projects/[id]/batch/route.ts` and `app/api/projects/[id]/render/route.ts`: generation preflight requires an approved student association and an approved processed derivative when a required photo field is configured.
- Existing photo migration `supabase/phase6_student_photo_matching.sql` uses private project-scoped storage paths and owner/project policies; Phase 7 adds processing/crop metadata.

## Phase 23 changes on this branch

- Fixed the crop-review UI's `reprocess` action being rejected by the processing endpoint's action allowlist.
- Invalid/empty/oversized source images, corrupt images, and invalid dimensions now persist a failed processing state with a reason and incremented attempt count rather than leaving the record in `PROCESSING`.
- Invalid manual crop requests now leave an explicit `NEEDS_REVIEW` state and warning code.
- Extracted processing action validation and failure-state builders into `lib/photos/processing-state.ts`, with unit tests in `tests/photo-processing-state.test.ts`.
- Added a searchable, project-local student selector before mobile camera capture. The selected student travels with that queue item; after upload the app saves a manual association proposal, but it remains unapproved until the existing review/approval step. Assignment errors do not turn an already saved upload into a false upload-failure state.
- Added a Phase 23 CI workflow to run the photo/regression suite, typecheck, lint, and production build.

## Read-only Supabase schema/security metadata check

A read-only metadata query confirmed the configured project has the existing `printforge-student-photos` bucket set to private (`public=false`), the expected photo/project ownership columns, an authenticated-only `student_photos` RLS policy qualified by `auth.uid()` and project ownership, and storage object policies qualified by the authenticated user folder plus owned project. This is metadata/policy inspection only: no student rows, photo objects, policies, or production data were changed. Policy inspection is not a substitute for live cross-tenant deny tests using separate authorized test accounts.

## Identifier safety limitation (not silently changed)

The current `students.serial_number` is numeric, and the existing import action persists `Number(serialNumber)`. The project has a configurable filename prefix, but it does not yet have a complete textual identifier model or an explicit leading-zero policy. Consequently, numeric canonicalization treats `001` and `1` as the same identifier. It is not safe to claim that this schema can represent schools where those values are distinct.

A safe full fix requires a planned, backward-compatible student identifier migration and coordinated updates to spreadsheet import, unique constraints, photo matching, card output naming, batch preflight, exports, and existing records. Until that migration is implemented and regression-tested, imports that collide under numeric normalization must remain blocked/reviewed. No destructive schema change was made in this phase.

## Test and acceptance status

The new tests and CI workflow are committed to the feature branch; the results must be read from the actual Phase 23 Actions run after GitHub finishes it. Do not interpret a source edit or a created test as a passing test.

Live authenticated upload, persistence after reload, cross-tenant storage denial, and private-bucket verification remain blocked unless an isolated Supabase test environment and authorized browser session are available. The known Vercel preview is protected by SSO, and no bypass was attempted. Physical Android camera capture is not claimed as verified by repository CI; browser/device verification remains required.

No production database was modified, no PR was merged, and no Production deployment was requested or performed.
