-- Phase 9: durable batch orchestration, additive to the existing Phase 2/8 schema.
-- The same migration has been applied to Supabase project xdoenkusrakuyyxnnkff.
alter table public.batches
  add column if not exists template_id uuid references public.templates(id) on delete restrict,
  add column if not exists template_version integer,
  add column if not exists requested_by uuid references auth.users(id) on delete set null,
  add column if not exists idempotency_key text,
  add column if not exists eligible_count integer not null default 0,
  add column if not exists skipped_count integer not null default 0,
  add column if not exists reused_count integer not null default 0,
  add column if not exists processing_count integer not null default 0,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists last_error text,
  add column if not exists config_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists paused_at timestamptz,
  add column if not exists cancelled_at timestamptz;
alter table public.batches drop constraint if exists batches_phase9_status_check;
alter table public.batches add constraint batches_phase9_status_check check (status in ('pending','queued','running','pausing','paused','completed','completed_with_errors','failed','cancelled','PENDING','QUEUED','RUNNING','PAUSING','PAUSED','COMPLETED','COMPLETED_WITH_ERRORS','FAILED','CANCELLED'));
create unique index if not exists uq_batches_owner_idempotency on public.batches(owner_id,idempotency_key) where idempotency_key is not null;
create index if not exists idx_batches_project_status_created on public.batches(project_id,status,created_at desc);
create table if not exists public.batch_generation_items (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.batches(id) on delete cascade,
 project_id uuid not null references public.school_projects(id) on delete cascade, owner_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete restrict, serial_number integer not null, student_name text,
 status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SUCCEEDED','FAILED','SKIPPED','NEEDS_REVIEW')),
 attempts integer not null default 0 check(attempts>=0), max_attempts integer not null default 3 check(max_attempts between 1 and 10),
 input_fingerprint text, output_card_id uuid references public.generated_cards(id) on delete set null, output_storage_path text,
 error_category text check(error_category is null or error_category in ('validation','rendering','storage','authorization','resource_limit','unknown')),
 error_summary text, available_at timestamptz not null default now(), claimed_at timestamptz, claimed_by text, heartbeat_at timestamptz,
 completed_at timestamptz, last_attempt_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(batch_id,student_id), unique(batch_id,serial_number),
 check(output_storage_path is null or (output_storage_path not like '/%' and output_storage_path not like '%..%'))
);
create index if not exists idx_batch_items_claim on public.batch_generation_items(status,available_at,created_at) where status in ('PENDING','FAILED');
create index if not exists idx_batch_items_batch_status on public.batch_generation_items(batch_id,status,serial_number);
create index if not exists idx_batch_items_owner_project on public.batch_generation_items(owner_id,project_id,batch_id);
alter table public.batch_generation_items enable row level security;
drop policy if exists batch_items_owner_select on public.batch_generation_items;
create policy batch_items_owner_select on public.batch_generation_items for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_insert on public.batch_generation_items;
create policy batch_items_owner_insert on public.batch_generation_items for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())) and exists(select 1 from public.batches b where b.id=batch_id and b.project_id=project_id and b.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_update on public.batch_generation_items;
create policy batch_items_owner_update on public.batch_generation_items for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_delete on public.batch_generation_items;
create policy batch_items_owner_delete on public.batch_generation_items for delete to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create or replace function public.claim_batch_generation_items(p_batch_id uuid,p_worker_id text,p_limit integer default 3)
returns setof public.batch_generation_items language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.batches b join public.school_projects p on p.id=b.project_id where b.id=p_batch_id and b.owner_id=auth.uid() and p.owner_id=auth.uid() and lower(b.status) in ('queued','running')) then raise exception 'batch access denied'; end if;
 return query with eligible as (
  select i.id from public.batch_generation_items i where i.batch_id=p_batch_id and i.owner_id=auth.uid() and i.status='PENDING' and i.available_at<=now()
  order by i.serial_number for update skip locked limit greatest(1,least(coalesce(p_limit,3),8))
 ) update public.batch_generation_items i set status='PROCESSING',claimed_at=now(),claimed_by=left(p_worker_id,100),heartbeat_at=now(),attempts=i.attempts+1,last_attempt_at=now(),updated_at=now()
 from eligible e where i.id=e.id returning i.*;
end $$;
revoke all on function public.claim_batch_generation_items(uuid,text,integer) from public,anon;
grant execute on function public.claim_batch_generation_items(uuid,text,integer) to authenticated,service_role;
