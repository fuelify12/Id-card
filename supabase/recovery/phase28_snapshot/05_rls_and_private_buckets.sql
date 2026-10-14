-- Phase 28 schema snapshot part: rls_buckets
-- Derived from read-only Production catalog metadata on 2026-10-14.
-- Apply only after verifying project ref zzecjgauhkaxyptsurlw is isolated and empty.
-- Not the original Phase 1 migration; no Production data is copied.
begin;
alter table public."audit_logs" enable row level security;
alter table public."batch_generation_items" enable row level security;
alter table public."batches" enable row level security;
alter table public."card_validation_findings" enable row level security;
alter table public."exports" enable row level security;
alter table public."generated_cards" enable row level security;
alter table public."processing_jobs" enable row level security;
alter table public."profiles" enable row level security;
alter table public."school_projects" enable row level security;
alter table public."security_rate_limits" enable row level security;
alter table public."student_photos" enable row level security;
alter table public."students" enable row level security;
alter table public."template_fields" enable row level security;
alter table public."templates" enable row level security;
alter table public."validation_results" enable row level security;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-exports','printforge-exports',false,104857600,array['application/zip', 'application/pdf']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-generated-cards','printforge-generated-cards',false,20971520,array['image/png', 'image/jpeg', 'application/pdf']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-private','printforge-private',false,null,null) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-student-photos','printforge-student-photos',false,10485760,array['image/jpeg', 'image/png', 'image/webp']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-templates','printforge-templates',false,20971520,array['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
