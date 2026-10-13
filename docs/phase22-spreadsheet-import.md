# Phase 22 — Project spreadsheet import, preview, and template mapping

## Implemented in the existing project workflow

The project page's existing `StudentImportWorkspace` now supports CSV, XLSX, and XLS through the repository's existing SheetJS parser. This is integrated into the authenticated project workflow rather than a separate demo screen.

- Select a worksheet explicitly; changing the worksheet reparses the file before any write.
- Detect a likely header row in the first 30 rows and show the source row number for each student.
- Preview all named columns, including extra columns; blank rows are excluded from the student list.
- Reject duplicate normalized headers rather than silently renaming or overwriting them.
- Preserve text identifiers such as `001`; preserve Excel numeric zero-padding when the cell number format is available.
- Flag missing and duplicate identifiers. Numeric identifiers with and without leading zeros are canonicalized for collision detection (so `001` and `1` are not treated as two different students).
- Allow explicit, per-template-field column mapping; only mapped fields are used for rendering.
- Require all required template fields to be mapped and populated on every importable row.
- Require changed mappings to be saved to the active template version before import.
- Preview is paginated at 100 rows, with mobile and desktop presentations.
- Student persistence remains in the existing authenticated `importStudentRows` server action, which validates project access under Supabase RLS, rejects invalid/duplicate serials, enforces a 15,000-row limit, and requires explicit confirmation to replace colliding records.
- Added branch CI to run unit tests, TypeScript, lint, and the production build.

## Identifier contract and known limit

The existing `students.serial_number` database column is numeric. The original spreadsheet values remain in the student's `data` JSON (so a mapped card field can still print a source value like `001`), but the database matching key is numeric and cannot distinguish `001` from `1`. The import preview blocks these as duplicate identifiers. This is deliberately fail-closed rather than silently assigning the same identity to two students. A schema-wide change to textual serial identifiers would affect photo matching, batch generation, exports, and existing records, so it must be handled as a separately planned migration and regression-tested across those systems.

## Validation boundaries

The new CI workflow uses a placeholder Supabase URL/key and does not mutate a real Supabase project. Passing unit/type/lint/build checks does not prove live authenticated persistence, cross-tenant authorization, private-storage behavior, or browser acceptance. The Phase 21 isolated Supabase test project was not available due to the Supabase project-limit restriction, so those checks must remain explicitly blocked until an isolated environment and authorized test account are available.

No pull request was merged and no Vercel deployment or production database was modified by Phase 22.
