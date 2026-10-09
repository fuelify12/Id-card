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
create unique index if not exists uq_student_photos_storage_path on public.student_photos(storage_path);
create index if not exists idx_student_photos_project_status on public.student_photos(project_id,match_status,created_at desc);
create index if not exists idx_student_photos_content_hash on public.student_photos(project_id,content_sha256) where content_sha256 is not null;
create index if not exists idx_student_photos_student_status on public.student_photos(project_id,student_id,match_status);
create index if not exists idx_student_photos_batch on public.student_photos(batch_id,created_at);
create index if not exists idx_student_photos_normalized_serial on public.student_photos(project_id,normalized_serial_number);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='student_photos_project_owner_fkey') then
  alter table public.student_photos add constraint student_photos_project_owner_fkey foreign key(project_id,owner_id) references public.school_projects(id,owner_id) on delete cascade not valid;
 end if;
 if not exists(select 1 from pg_constraint where conname='student_photos_student_project_fkey') then
  alter table public.student_photos add constraint student_photos_student_project_fkey foreign key(student_id,project_id) references public.students(id,project_id) on delete set null (student_id) not valid;
 end if;
end $$;
alter table public.student_photos drop constraint if exists student_photos_match_status_check;
alter table public.student_photos add constraint student_photos_match_status_check check (match_status in ('UPLOADED','MATCHED','NEEDS_REVIEW','UNMATCHED','DUPLICATE','UPLOAD_FAILED','INVALID_FILE','APPROVED')) not valid;
drop policy if exists "photos own rows" on public.student_photos;
create policy "photos own project rows" on public.student_photos for all to authenticated
 using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())))
 with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
drop policy if exists "printforge storage select own folder" on storage.objects;
drop policy if exists "printforge storage insert own folder" on storage.objects;
drop policy if exists "printforge storage update own folder" on storage.objects;
drop policy if exists "printforge storage delete own folder" on storage.objects;
create policy "printforge storage select own folder" on storage.objects for select to authenticated using (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))));
create policy "printforge storage insert own folder" on storage.objects for insert to authenticated with check (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))));
create policy "printforge storage update own folder" on storage.objects for update to authenticated using (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))) ) with check (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))));
create policy "printforge storage delete own folder" on storage.objects for delete to authenticated using (bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports') and (storage.foldername(name))[1]=(select auth.uid())::text and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))));

-- Atomic aggregate-size reservation prevents concurrent clients exceeding 500 MB.
create or replace function public.reserve_photo_batch_bytes(p_batch_id uuid,p_project_id uuid,p_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_size<=0 or p_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid())
   and status='uploading' and total_bytes+p_size<=524288000;
 return found;
end; $$;
create or replace function public.release_photo_batch_bytes(p_batch_id uuid,p_project_id uuid,p_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_size<=0 then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $$;
revoke all on function public.reserve_photo_batch_bytes(uuid,uuid,bigint) from public;
revoke all on function public.release_photo_batch_bytes(uuid,uuid,bigint) from public;
grant execute on function public.reserve_photo_batch_bytes(uuid,uuid,bigint) to authenticated;
grant execute on function public.release_photo_batch_bytes(uuid,uuid,bigint) to authenticated;

create index if not exists idx_student_photos_approved_by on public.student_photos(approved_by);
create index if not exists idx_student_photos_duplicate_of on public.student_photos(duplicate_of_id);
create index if not exists idx_student_photos_student_project_fk on public.student_photos(student_id,project_id);
create index if not exists idx_student_photos_project_owner_fk on public.student_photos(project_id,owner_id);

alter table public.batches add column if not exists photo_reservations jsonb not null default '{}'::jsonb;
create or replace function public.reserve_photo_upload(p_batch_id uuid,p_project_id uuid,p_path text,p_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_size<=0 or p_size>10485760 or p_path is null or length(p_path)>512 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size,photo_reservations=photo_reservations||jsonb_build_object(p_path,p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' and not(photo_reservations ? p_path) and total_bytes+p_size<=524288000;
 return found;
end; $$;
create or replace function public.finalize_photo_upload(p_batch_id uuid,p_project_id uuid,p_path text,p_actual_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null or p_actual_size<=0 or p_actual_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes-reserved_size+p_actual_size,photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' and total_bytes-reserved_size+p_actual_size<=524288000;
 return found;
end; $$;
create or replace function public.release_photo_upload(p_batch_id uuid,p_project_id uuid,p_path text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-reserved_size),photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $$;
revoke all on function public.reserve_photo_upload(uuid,uuid,text,bigint) from public;
revoke all on function public.finalize_photo_upload(uuid,uuid,text,bigint) from public;
revoke all on function public.release_photo_upload(uuid,uuid,text) from public;
grant execute on function public.reserve_photo_upload(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.finalize_photo_upload(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.release_photo_upload(uuid,uuid,text) to authenticated;
