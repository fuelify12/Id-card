# PrintForge ID Card Studio


## Phase 2 backend

Supabase now contains the production project/template/student/batch/processing/card/validation/export/audit data model with owner-scoped RLS, indexes and constraints. Four private storage buckets are configured for templates, student photos, generated cards and exports. Server-only actions in `app/dashboard/actions.ts` validate authenticated ownership, bucket, MIME type and file size before upload and create bounded signed URLs for retrieval. No service-role credential is used by the application.


## Phase 6 — student photo upload and serial matching

- Photos are stored in the existing private `printforge-student-photos` bucket under `<user-id>/<project-id>/<generated-name>`.
- Per-image server limits: 10 MB, JPEG/PNG/WebP, at least 64×64 pixels, maximum 12,000 pixels per dimension and 40 megapixels total.
- Per-batch limits: 500 images, 500 MB expanded; ZIP compressed size is limited to 100 MB. Upload workers are bounded to four concurrent files.
- Numeric filename patterns include `1.jpg`, `001.jpg`, `1_Rahul.jpg`, and `001_Rahul_Sharma.png`. Configure an optional prefix (for example `STU`) in the project Photos section before `STU-001.jpg` is eligible for automatic matching.
- The current canonical student serial schema is integer-valued. Original filename serials (including zero padding) are retained; matching normalizes leading zeros to the existing integer canonical value.
- Unsupported, ambiguous, missing, duplicate, and conflicting matches are never automatically approved. Matching is proposed only from exact supported filename serials. The user must approve each selected photo.
- ZIP paths are checked for absolute paths and traversal before extraction. Archive entries are streamed with per-file and aggregate expansion limits.
- Photos are validated server-side from file signatures and decoded with Sharp. SHA-256 duplicate detection preserves the duplicate record and links it to the original record.
- Database changes are recorded in `supabase/phase6_student_photo_matching.sql`. The production Supabase migration history contains `phase6_student_photo_matching`, `phase6_storage_policy_hardening`, `phase6_photo_batch_byte_limits`, and `phase6_photo_fk_indexes`, and `phase6_photo_path_reservations`.
- Photo readiness counts only approved photos. Unresolved duplicate/review states keep the project from being considered ready for the next phase.


## Phase 7 — Automatic student photo cropping

- Keeps uploaded originals immutable and writes each processed derivative to a unique versioned path under the existing private student-photo bucket.
- Uses Sharp to decode, normalize EXIF orientation, crop, resize without source-image stretching beyond the crop's target ratio, preserve background, and embed configured DPI metadata.
- Uses server-side TensorFlow.js + BlazeFace face detection. Only one sufficiently confident detected face is eligible for automatic framing. Missing, multiple, low-confidence, edge-risk, low-resolution, and detector-unavailable cases are flagged for review.
- Project-level photo settings are stored in `school_projects.photo_processing_settings`; the initial 600×800 px / 300 DPI defaults are illustrative and are not production-confirmed until saved by the user.
- `student_photos` stores a separate processed path, processing status, face count/confidence, crop coordinates, warnings, dimensions, version, attempts, and approval metadata.
- Photos remain in the private `printforge-student-photos` bucket, with existing owner-folder storage policies. Server routes verify the authenticated owner and project before reading/writing images.
- Batch processing uses three concurrent per-photo requests so failures remain isolated and refreshes can resume from persisted statuses.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before release.

## Phase 8 — deterministic ID card rendering

The Phase 8 renderer lives in lib/rendering/engine.ts and is exposed through the authenticated project API at POST /api/projects/:id/render. The project workspace provides physical-size/DPI/format settings, a student preflight report, and a sample-card preview rendered by the same service used for individual outputs.

- Supported template inputs: PNG/JPEG, sanitized SVG, and single-page PDF. PDF templates preserve their vector page artwork in PDF output; variable text is shaped into deterministic glyph paths and rasterized at the requested output DPI, and approved photographs are overlaid separately. PDF-to-PNG/JPEG conversion is intentionally rejected rather than silently rasterizing the original artwork.
- Output: PNG, high-quality JPEG, or PDF. Dimensions are specified explicitly in millimeters and DPI; aspect-ratio mismatches and resource-limit violations are blocked.
- Field coordinates are stored in the uploaded template's pixel coordinate basis and scaled to output dimensions. Text uses glyph paths with script-specific Noto Sans fonts for Latin, Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, and Malayalam. Required fields with unsupported glyphs block the card. QR codes and common Code 128/EAN/UPC/Code 39/ITF-14 barcodes are generated as graphics when mapped QR/barcode fields are configured.
- Photo fields read only the matching student's Phase 7 processed image and require approval when the field is required. Original uploaded templates and source photos are not modified.
- The renderer fingerprints the template bytes, field configuration, student data, approved photo bytes, output settings, and renderer version. Repeated inputs are idempotent; changed inputs update the same student/template/side result record and store a hash-versioned private output.
- Supabase migration: supabase/phase8_rendering_engine.sql. It adds rendering configuration/metadata and expands the existing private template bucket allow-list without making it public.

Limitations: batch queue orchestration, ZIP export, and print-sheet imposition remain later-phase work. A dedicated back-side template/field-map workflow is not yet configured by the Phase 8 workspace; requests for a back side are explicitly rejected instead of rendering the front artwork as a false back. Actual authenticated storage/ownership integration tests and real-school sample-card visual approval still require a configured project and representative fictional/synthetic assets.
