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
- Duplicate-content photos require explicit confirmation before manual assignment. Clearing an assignment preserves duplicate status; explicit confirmation records `manual_duplicate_confirmed` and clears the duplicate block only after user review.
- Added regression coverage for upload-order-independent matching and duplicate-confirmation requirements, plus a Phase 23 CI workflow.

## Read-only Supabase schema/security metadata check

A read-only metadata query confirmed the configured project has the existing `printforge-student-photos` bucket set to private (`public=false`), the expected photo/project ownership columns, an authenticated-only `student_photos` RLS policy qualified by `auth.uid()` and project ownership, and storage object policies qualified by the authenticated user folder plus owned project. This is metadata/policy inspection only: no student rows, photo objects, policies, or production data were changed. Policy inspection is not a substitute for live cross-tenant deny tests using separate authorized test accounts.

## Identifier safety limitation (not silently changed)

The current `students.serial_number` is numeric, and the existing import action persists `Number(serialNumber)`. The project has a configurable filename prefix, but it does not yet have a complete textual identifier model or an explicit leading-zero policy. Consequently, numeric canonicalization treats `001` and `1` as the same identifier. It is not safe to claim that this schema can represent schools where those values are distinct.

A safe full fix requires a planned, backward-compatible student identifier migration and coordinated updates to spreadsheet import, unique constraints, photo matching, card output naming, batch preflight, exports, and existing records. Until that migration is implemented and regression-tested, imports that collide under numeric normalization must remain blocked/reviewed. No destructive schema change was made in this phase.

## Test and acceptance status

- GitHub Actions run [38378545986](https://github.com/fuelify12/Id-card/actions/runs/38378545986) passed on commit `c384bf5899d19363abce8e5d644eedbe03daac68`: 12 test files / 81 tests passed, TypeScript passed, lint passed with 12 existing warnings, and production build passed.
- Vercel preview deployment for the same commit is [READY](https://printforge-id-card-studio-gl7dnfyk0-yash-6966.vercel.app).
- Safe anonymous browser acceptance completed, but the page title was `Log in to Vercel`; SSO blocked application access. No credentials were entered and no protection was bypassed.
- Live authenticated upload/persistence, cross-tenant denial, and private-storage access tests remain blocked until an isolated Supabase environment and authorized signed-in browser session are available. Physical Android camera capture is not verified by CI and remains a device-acceptance item.

No student rows or photo objects were changed, no PR was merged, and no Production deployment was performed.
