# Phase 22 — Spreadsheet preview and mapping safety

This phase adds a reusable, bounded spreadsheet preview and deterministic field-mapping utility at `lib/import/student-spreadsheet.ts`.

## Supported file formats

- CSV, XLSX, and XLS are accepted by the parser through the existing SheetJS dependency.
- XLSM and other formats are rejected. Formula values are treated as cell data; macros are not executed.
- The parser caps input at 15 MiB, 15,000 data rows, and 200 columns.
- Blank rows are skipped and do not count as student records. Nonblank rows retain their original one-based spreadsheet row number for error reporting.
- Duplicate normalized headers are rejected rather than silently overwriting values.
- For numeric Excel identifiers, the parser uses the cell's number format when available (for example, `000` renders the value `1` as `001`). If formatting has been stripped from a numeric cell, original leading zeros are unrecoverable; the operator must correct the source file or explicitly normalize identifiers before import. Text-formatted IDs such as `001` are preserved.

## Mapping safety

`suggestFieldMappings` only proposes a mapping when exactly one header equals the normalized field key or label. Ambiguous matches remain unmapped. `validateMappedRows` returns template-keyed values and row-level required-field errors. Extra columns remain available for preview but are not included in the mapped output unless the user explicitly maps them.

## Integration status and limits

This utility is intended to be called by an authenticated project import workflow. It does not itself persist students, authorize project access, create templates, or provide a UI. The existing `importStudentRows` server action remains the persistence boundary and currently normalizes serial numbers to integers; therefore leading-zero identity preservation is not end-to-end complete until the identifier contract/schema is reconciled. Live database acceptance remains blocked by the Phase 21 isolated Supabase environment issue. No production database or deployment was modified by this change.
