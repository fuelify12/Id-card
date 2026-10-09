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


## Phase 8 — deterministic ID-card rendering

- `lib/rendering/engine.ts` renders individual raster cards with Sharp, using the original uploaded PNG/JPEG as the fixed background and configured template fields as deterministic overlays.
- Field positions are authored in source-template pixel coordinates and converted through the source-to-output transform. Supports mapped student values, the project school name, configured static text, font family/size/weight/color, alignment, line wrapping, bounded font shrink, rotation, visibility, vertical alignment, and overflow warnings/blocking.
- Student photo placement accepts only a Phase 7 processed image associated with the same student and project and marked both match-approved and crop-approved. The default image fit is `contain` to avoid a second crop; `cover` is an explicit template choice.
- Physical dimensions can be entered in millimeters or inches (converted to millimeters for rendering), and output DPI is validated. Output pixel dimensions are capped at 40 megapixels, aspect-ratio mismatch is blocked, and PNG/JPEG output is decoded and dimension-checked before private storage.
- Per-card results are persisted in `generated_cards`, tied to the student, project, template version, renderer version, input hash, output hash, output dimensions, DPI, warnings, and status. Stable input hashes allow successful outputs to be reused; failures remain isolated to the card.
- The project workspace now includes a preflight report and sample-card rendering preview. The sample uses the same server rendering engine as a normal individual card.
- Raster template support is intentionally limited to PNG/JPEG because that is what the existing upload workflow validates. PDF/SVG template import, vector-preserving PDF overlays, a full two-sided template association workflow, and print-sheet imposition are not represented as completed features. Non-Latin text is rendered through the installed SVG/font stack but is flagged for human sample review because server-side glyph availability varies.
- Migration: `phase8_card_rendering` adds field layout settings and render metadata without dropping existing data or weakening existing RLS policies.
