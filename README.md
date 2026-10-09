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
- Database changes are recorded in `supabase/phase6_student_photo_matching.sql`. The production Supabase migration history contains `phase6_student_photo_matching`, `phase6_storage_policy_hardening`, `phase6_photo_batch_byte_limits`, and `phase6_photo_fk_indexes`.
- Photo readiness counts only approved photos. Unresolved duplicate/review states keep the project from being considered ready for the next phase.
