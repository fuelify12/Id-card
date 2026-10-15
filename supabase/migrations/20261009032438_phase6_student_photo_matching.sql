-- PRINTFORGE Phase 6: student photo ingestion, matching and review.
-- Additive/backwards-compatible changes. Existing photo rows remain valid.
alter table public.student_photos alter column serial_number drop not null;
alter table public.student_photos
  add column if not exists original_serial_number text,
  add column if not exists normalized_serial_number text,
  add column if not exists file_size_bytes bigint,
  add column if not exists content_sha256 text,
  add column if not exists matching_method text,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists duplicate_of_id uuid references public.student_photos(id) on delete set null,
  add column if not exists batch_id uuid references public.batches(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists image_version integer not null default 1;
alter table public.school_projects add column if not exists photo_serial_prefix text;
create unique index if not exists uq_school_projects_id_owner on public.school_projects(id,owner_id);
create unique index if not exists uq_students_id_project on public.students(id,project_id);
create index if not exists idx_student_photos_project_status on public.student_photos(project_id,match_status,created_at desc);
create index if not exists idx_student_photos_content_hash on public.student_photos(project_id,content_sha256) where content_sha256 is not null;
create index if not exists idx_student_photos_student_status on public.student_photos(project_id,student_id,match_status);
create index if not exists idx_student_photos_batch on public.student_photos(batch_id,created_at);
create index if not exists idx_student_photos_normalized_serial on public.student_photos(project_id,normalized_serial_number);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='student_photos_project_owner_fkey') then
    alter table public.student_photos add constraint student_photos_project_owner_fkey
      foreign key(project_id,owner_id) references public.school_projects(id,owner_id) on delete cascade not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='student_photos_student_project_fkey') then
    alter table public.student_photos add constraint student_photos_student_project_fkey
      foreign key(student_id,project_id) references public.students(id,project_id) on delete set null (student_id) not valid;
  end if;
end $$;
alter table public.student_photos drop constraint if exists student_photos_match_status_check;
alter table public.student_photos add constraint student_photos_match_status_check
  check (match_status in ('UPLOADED','MATCHED','NEEDS_REVIEW','UNMATCHED','DUPLICATE','UPLOAD_FAILED','INVALID_FILE','APPROVED')) not valid;
drop policy if exists "photos own rows" on public.student_photos;
create policy "photos own project rows" on public.student_photos
  for all to authenticated
  using (owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())))
  with check (owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
-- Tighten the existing private photo bucket policies to verify the second path
-- segment is a project actually owned by the authenticated user.
drop policy if exists "printforge photo select owned project" on storage.objects;
drop policy if exists "printforge photo insert owned project" on storage.objects;
drop policy if exists "printforge photo update owned project" on storage.objects;
drop policy if exists "printforge photo delete owned project" on storage.objects;
create policy "printforge photo select owned project" on storage.objects for select to authenticated
 using(bucket_id='printforge-student-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())));
create policy "printforge photo insert owned project" on storage.objects for insert to authenticated
 with check(bucket_id='printforge-student-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())));
create policy "printforge photo update owned project" on storage.objects for update to authenticated
 using(bucket_id='printforge-student-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())))
 with check(bucket_id='printforge-student-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())));
create policy "printforge photo delete owned project" on storage.objects for delete to authenticated
 using(bucket_id='printforge-student-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())));
