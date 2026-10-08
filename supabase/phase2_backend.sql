-- PRINTFORGE ID CARD STUDIO — Phase 2 backend hardening
-- Applied to Supabase project xdoenkusrakuyyxnnkff.
-- This file documents the Phase 2 SQL applied after phase1_foundation.
-- Four private buckets: templates, student photos, generated cards, exports.
-- Storage paths are: <user-id>/<project-id>/<generated-id>-<filename>.
-- All public tables have RLS and owner-scoped authenticated policies.
-- Storage permits authenticated users only inside their own first path segment.

insert into storage.buckets (id,name,public,allowed_mime_types,file_size_limit)
values
 ('printforge-templates','printforge-templates',false,array['image/png','image/jpeg','application/pdf'],20971520),
 ('printforge-student-photos','printforge-student-photos',false,array['image/jpeg','image/png','image/webp'],10485760),
 ('printforge-generated-cards','printforge-generated-cards',false,array['image/png','image/jpeg','application/pdf'],20971520),
 ('printforge-exports','printforge-exports',false,array['application/zip','application/pdf'],104857600)
on conflict (id) do update set public=false,allowed_mime_types=excluded.allowed_mime_types,file_size_limit=excluded.file_size_limit;

drop policy if exists "private storage delete own folder" on storage.objects;
drop policy if exists "private storage insert own folder" on storage.objects;
drop policy if exists "private storage select own folder" on storage.objects;
drop policy if exists "private storage update own folder" on storage.objects;
drop policy if exists "printforge storage select own project" on storage.objects;
drop policy if exists "printforge storage insert own project" on storage.objects;
drop policy if exists "printforge storage update own project" on storage.objects;
drop policy if exists "printforge storage delete own project" on storage.objects;

create policy "printforge storage select own folder" on storage.objects for select to authenticated using (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "printforge storage insert own folder" on storage.objects for insert to authenticated with check (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "printforge storage update own folder" on storage.objects for update to authenticated using (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "printforge storage delete own folder" on storage.objects for delete to authenticated using (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text);

create index if not exists idx_templates_project_status on public.templates(project_id,analysis_status);
create index if not exists idx_template_fields_template_order on public.template_fields(template_id,sort_order);
create index if not exists idx_photos_owner_project on public.student_photos(owner_id,project_id);
create index if not exists idx_jobs_owner_status on public.processing_jobs(owner_id,status,created_at desc);
create index if not exists idx_cards_project_status on public.generated_cards(project_id,status);
create index if not exists idx_validation_card_created on public.validation_results(generated_card_id,created_at desc);
create index if not exists idx_exports_project_created on public.exports(project_id,created_at desc);