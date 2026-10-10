# Prompt 19 — Export integrity and private-download verification

## Implementation status

**Repository implementation added; live authenticated download acceptance remains blocked.** This prompt builds on the existing export pipeline and does not deploy or apply migrations.

## What changed

- Each packaged card output gets a SHA-256 hash computed over the final bytes written to the ZIP (after any requested PNG/JPEG conversion).
- The CSV manifest now contains a `sha256` column; the JSON manifest contains the same hash on every item.
- Added `lib/exports/integrity.ts` to verify the ZIP central directory and CRCs, exact expected entry names, safe paths, every packaged file's SHA-256, and consistency between the JSON manifest and the expected item list.
- Export creation verifies the local archive before upload, verifies the uploaded private object after download-back, checks its archive-level SHA-256, and persists expected names plus manifest items with the export row.
- Download-link issuance now re-reads the private object and checks the stored archive SHA-256, optional recorded byte length, expected ZIP entry list, and (for new exports) per-item hashes and JSON manifest before issuing a 60-second signed URL.
- Export objects must use exactly `<user-id>/<project-id>/<export-id>/archive.zip`; prefix-only path matches are rejected.
- Added synthetic unit coverage for valid archives, changed bytes, mismatched manifest hashes, unexpected/unsafe entries, corrupt ZIPs, and cross-tenant/canonical storage path cases.

## Verification

Automated tests live in `lib/exports/integrity.test.ts` and `lib/exports/archive.test.ts`. CI should run the repository's existing test, typecheck, lint, and build gates on the Prompt 19 branch.

The integrity verifier checks the bytes read by the authenticated server from private storage before it creates the signed URL. A real browser GET of that signed URL still needs the gated isolated E2E run.

## Backward compatibility

Older completed exports may have archive-level hashes and expected entry names but lack per-file hashes in the persisted database manifest. For these legacy exports, the download route still verifies archive SHA-256, optional byte length, ZIP structure, and the stored expected entry list. Newly generated exports receive the stronger per-item and JSON-manifest verification. If integrity metadata is absent or invalid, download fails closed and asks the user to create a fresh export.

## Safety and outstanding acceptance

- No production Supabase data, storage objects, settings, or traffic were changed.
- No migration was applied and no deployment was performed.
- Supabase could not create the approved isolated free project because of the account's active free-project limit. The existing Id-card project must not be paused as a workaround.
- The current Vercel preview was previously SSO-protected and pointed to the production Supabase project. Do not run mutating E2E tests against it.
- A real authenticated export and signed-URL browser download, two-tenant storage authorization, and full export workflow remain **BLOCKED** until an isolated Supabase environment and matching preview/test account are available.

**Release decision: NOT READY FOR LIVE ACCEPTANCE.** Passing repository CI demonstrates code-level checks only; it does not prove an authenticated production-like download or authorize merging/deploying.
