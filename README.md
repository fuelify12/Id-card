# PrintForge ID Card Studio


## Phase 2 backend

Supabase now contains the production project/template/student/batch/processing/card/validation/export/audit data model with owner-scoped RLS, indexes and constraints. Four private storage buckets are configured for templates, student photos, generated cards and exports. Server-only actions in `app/dashboard/actions.ts` validate authenticated ownership, bucket, MIME type and file size before upload and create bounded signed URLs for retrieval. No service-role credential is used by the application.
