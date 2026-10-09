-- Phase 11: persistent private ZIP export jobs. Additive, preserves existing exports.
alter table public.exports
 add column if not exists options jsonb not null default '{}'::jsonb,
 add column if not exists selected_count integer not null default 0 check(selected_count>=0),
 add column if not exists eligible_count integer not null default 0 check(eligible_count>=0),
 add column if not exists excluded_count integer not null default 0 check(excluded_count>=0),
 add column if not exists packaged_file_count integer not null default 0 check(packaged_file_count>=0),
 add column if not exists failed_item_count integer not null default 0 check(failed_item_count>=0),
 add column if not exists retry_count integer not null default 0 check(retry_count between 0 and 3),
 add column if not exists retryable boolean not null default false,
 add column if not exists archive_bytes bigint check(archive_bytes is null or archive_bytes>=0),
 add column if not exists archive_sha256 text,
 add column if not exists error_summary text,
 add column if not exists started_at timestamptz,
 add column if not exists completed_at timestamptz,
 add column if not exists expires_at timestamptz,
 add column if not exists updated_at timestamptz not null default now(),
 add column if not exists item_snapshot jsonb not null default '[]'::jsonb,
 add column if not exists excluded_snapshot jsonb not null default '[]'::jsonb,
 add column if not exists manifest jsonb not null default '{}'::jsonb;
alter table public.exports drop constraint if exists exports_phase11_status_check;
alter table public.exports add constraint exports_phase11_status_check check(status in ('ready','pending','queued','running','verifying','completed','completed_with_errors','failed','cancelled','expired'));
create index if not exists idx_exports_project_created on public.exports(project_id,created_at desc);
create index if not exists idx_exports_batch_status on public.exports(batch_id,status,created_at desc);
create index if not exists idx_exports_batch_project_owner on public.exports(batch_id,project_id,owner_id);
create index if not exists idx_exports_expiry on public.exports(expires_at) where status in ('completed','completed_with_errors');
create index if not exists idx_exports_owner_project on public.exports(owner_id,project_id);
create unique index if not exists uq_batches_id_project_owner on public.batches(id,project_id,owner_id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='exports_batch_project_owner_fkey') then
  alter table public.exports add constraint exports_batch_project_owner_fkey foreign key(batch_id,project_id,owner_id) references public.batches(id,project_id,owner_id) on delete cascade;
 end if;
end $$;
alter table public.exports enable row level security;
drop policy if exists "exports own rows" on public.exports;
drop policy if exists exports_owner_select on public.exports;
drop policy if exists exports_owner_insert on public.exports;
drop policy if exists exports_owner_update on public.exports;
drop policy if exists exports_owner_delete on public.exports;
create policy exports_owner_select on public.exports for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=exports.project_id and p.owner_id=(select auth.uid())));
create policy exports_owner_insert on public.exports for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=exports.project_id and p.owner_id=(select auth.uid())) and exists(select 1 from public.batches b where b.id=exports.batch_id and b.project_id=exports.project_id and b.owner_id=exports.owner_id and b.owner_id=(select auth.uid())));
create policy exports_owner_update on public.exports for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=exports.project_id and p.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=exports.project_id and p.owner_id=(select auth.uid())));
create policy exports_owner_delete on public.exports for delete to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=exports.project_id and p.owner_id=(select auth.uid())));
update storage.buckets set public=false,file_size_limit=104857600,allowed_mime_types=array['application/zip','application/pdf'] where id='printforge-exports';