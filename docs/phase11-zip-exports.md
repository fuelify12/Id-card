# Phase 11 — ZIP export

## Runtime and limits
- Uses the existing private `printforge-exports` Supabase Storage bucket and `exports` table.
- Node.js API packages one source output at a time with the installed `fflate` streaming ZIP writer. It never rerenders student cards.
- Limits: 1,000 card-side outputs per archive, 90 MiB maximum archive size, seven-day retention, and three manual retry attempts for transient failures with a five-second minimum retry delay.
- The API declares a 300-second Node route budget. Confirm the deployed Vercel plan supports this duration. If it does not, a durable external worker is required before larger exports are considered production-ready; no paid service is added here.
- PNG/JPEG conversions use installed `sharp`; PDF is offered only when source generated outputs are PDFs. Raster-to-PDF and PDF-to-image conversion are not silently attempted.
- Export checks require explicit card approval, fresh validation findings, current template/photo versions, student-data freshness, matching source hashes, readable stored files and expected dimensions. Checks use bounded concurrency and package one card at a time.

## ZIP contents
- Folder layout on: `front/` and, for front/back exports, `back/`; flat layout is available. With folder layout enabled, a sanitized school/session root folder is used.
- Optional `manifest.csv`, `manifest.json`, and `exclusions.csv`. The CSV and JSON manifests include a SHA-256 hash of each final packaged card file; JSON lists exclusions separately.
- Student names are omitted from filenames by default and can be explicitly enabled. Serial numbers are padded to at least three digits. Duplicate filenames are deterministically disambiguated.

## Security and retention
- Archives remain private under `<user-id>/<project-id>/<export-id>/archive.zip`; the bucket is never public.
- Download endpoints recheck project/export ownership, completion state, expiry, object existence, and the exact canonical storage key; they re-download the private object and verify the archive SHA-256, recorded byte length, ZIP directory, and stored expected entry list before issuing a signed URL valid for 60 seconds. New exports also verify each item hash against the JSON manifest.
- Expiration is enforced lazily on history refresh/download. Expired objects are removed; no scheduled cleanup job is configured in this phase.
- Export creation, completion, failure, deletion, retry requests and download-link issuance are audited. Student names are not logged in audit metadata.
- Temporary files are deleted in a `finally` cleanup path. Interrupted workers older than ten minutes are marked failed and may be retried after fresh eligibility checks.
- Code-level integrity checks do not replace a real browser download test. Run the gated Prompt 19 acceptance only against an independently verified isolated Supabase project and matching preview; never use the production project for mutating tests.

## Operations
Apply `supabase/phase11_zip_exports.sql` through the existing Supabase migration workflow. No new environment variables or paid services are required.
