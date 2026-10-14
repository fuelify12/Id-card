
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  school_name text not null,
  school_address text,
  academic_session text,
  status text not null default 'draft' check (status in ('draft','ready','processing','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_path text,
  source_type text not null check (source_type in ('png','jpg','jpeg','pdf')),
  width_px integer,
  height_px integer,
  analysis_status text not null default 'pending' check (analysis_status in ('pending','analyzing','needs_review','confirmed','failed')),
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text','photo','qr','barcode','static')),
  required boolean not null default true,
  x numeric not null default 0,
  y numeric not null default 0,
  width numeric not null default 0,
  height numeric not null default 0,
  font_family text,
  font_size numeric,
  font_weight text,
  color text,
  alignment text,
  fit_mode text,
  source_column text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  serial_number integer not null,
  data jsonb not null default '{}'::jsonb,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, serial_number)
);

create table public.student_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  serial_number integer not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  width_px integer,
  height_px integer,
  match_status text not null default 'needs_review' check (match_status in ('matched','needs_review','missing','duplicate','invalid')),
  match_confidence numeric check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  crop_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','needs_review')),
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  serial_number integer not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','needs_review')),
  attempts integer not null default 0,
  error_message text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, serial_number)
);

create table public.generated_cards (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  serial_number integer not null,
  storage_path text,
  filename text not null,
  status text not null default 'pending' check (status in ('pending','generated','failed','needs_review')),
  validation_status text not null default 'pending' check (validation_status in ('pending','passed','warning','failed')),
  created_at timestamptz not null default now(),
  unique(batch_id, serial_number),
  unique(batch_id, filename)
);

create table public.validation_results (
  id uuid primary key default gen_random_uuid(),
  generated_card_id uuid not null references public.generated_cards(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('passed','warning','failed')),
  checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  project_id uuid not null references public.school_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text,
  filename text not null,
  status text not null default 'ready' check (status in ('queued','ready','failed')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.school_projects(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_projects_owner on public.school_projects(owner_id);
create index idx_templates_project on public.templates(project_id);
create index idx_fields_template on public.template_fields(template_id);
create index idx_students_project_serial on public.students(project_id, serial_number);
create index idx_photos_project_serial on public.student_photos(project_id, serial_number);
create index idx_batches_project on public.batches(project_id, created_at desc);
create index idx_jobs_batch_status on public.processing_jobs(batch_id, status);
create index idx_cards_batch_serial on public.generated_cards(batch_id, serial_number);
create index idx_audit_owner_created on public.audit_logs(owner_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.school_projects enable row level security;
alter table public.templates enable row level security;
alter table public.template_fields enable row level security;
alter table public.students enable row level security;
alter table public.student_photos enable row level security;
alter table public.batches enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.generated_cards enable row level security;
alter table public.validation_results enable row level security;
alter table public.exports enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles own rows" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "projects own rows" on public.school_projects for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "templates own rows" on public.templates for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "fields own rows" on public.template_fields for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "students own rows" on public.students for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "photos own rows" on public.student_photos for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "batches own rows" on public.batches for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "jobs own rows" on public.processing_jobs for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "cards own rows" on public.generated_cards for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "validation own rows" on public.validation_results for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "exports own rows" on public.exports for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "audit own rows" on public.audit_logs for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('printforge-private', 'printforge-private', false)
on conflict (id) do nothing;

create policy "private storage select own folder"
on storage.objects for select to authenticated
using (bucket_id = 'printforge-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "private storage insert own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'printforge-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "private storage update own folder"
on storage.objects for update to authenticated
using (bucket_id = 'printforge-private' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'printforge-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "private storage delete own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'printforge-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
