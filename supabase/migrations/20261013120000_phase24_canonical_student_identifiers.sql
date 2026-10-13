-- Phase 24: canonical text identifiers, compatibility snapshots, and explicit legacy review.
-- Apply and validate in an isolated database before any deployment.
-- Backfill preserves only what was stored; lost leading zeroes are never reconstructed.
begin;

alter table public.school_projects
  add column if not exists student_identifier_settings jsonb not null
  default '{"normalization":"exact","case_sensitive":true,"edge_whitespace":"reject","max_length":64}'::jsonb;

alter table public.students add column if not exists student_identifier text;
alter table public.students add column if not exists student_identifier_unique text;
alter table public.students add column if not exists student_identifier_source text not null default 'legacy_numeric_backfill';
alter table public.students add column if not exists student_identifier_review_required boolean not null default true;
alter table public.student_photos add column if not exists student_identifier text;
alter table public.batch_generation_items add column if not exists student_identifier text;
alter table public.generated_cards add column if not exists student_identifier text;
alter table public.processing_jobs add column if not exists student_identifier text;

-- Legacy integer columns remain as nullable compatibility projections for text-only identifiers.
alter table public.students alter column serial_number drop not null;
alter table public.student_photos alter column serial_number drop not null;
alter table public.batch_generation_items alter column serial_number drop not null;
alter table public.generated_cards alter column serial_number drop not null;
alter table public.processing_jobs alter column serial_number drop not null;

-- Only use values already stored; existing student IDs and all foreign keys remain unchanged.
update public.students
set student_identifier=serial_number::text,
    student_identifier_source='legacy_numeric_backfill',
    student_identifier_review_required=true,
    student_identifier_unique=null
where student_identifier is null and serial_number is not null;

update public.batch_generation_items
set student_identifier=serial_number::text
where student_identifier is null and serial_number is not null;

update public.generated_cards
set student_identifier=serial_number::text
where student_identifier is null and serial_number is not null;

update public.processing_jobs j
set student_identifier=s.student_identifier
from public.students s
where j.student_id=s.id and j.project_id=s.project_id and j.student_identifier is null;

update public.processing_jobs
set student_identifier=serial_number::text
where student_identifier is null and serial_number is not null;

update public.student_photos p
set student_identifier=s.student_identifier
from public.students s
where p.student_id=s.id and p.project_id=s.project_id and p.student_identifier is null;

update public.student_photos
set student_identifier=original_serial_number
where student_identifier is null and original_serial_number is not null;

-- Existing numeric rows require owner review because any original leading zeroes are unknowable.
-- Only already-reviewed rows receive a uniqueness key during a rerun.
update public.students s
set student_identifier_unique=case
  when coalesce(p.student_identifier_settings->>'normalization','exact')='numeric'
       and s.student_identifier ~ '^[0-9]+$'
    then case when coalesce(p.student_identifier_settings->>'case_sensitive','true')='false'
      then lower(coalesce(nullif(regexp_replace(s.student_identifier,'^0+',''),''),'0'))
      else coalesce(nullif(regexp_replace(s.student_identifier,'^0+',''),''),'0') end
  when coalesce(p.student_identifier_settings->>'case_sensitive','true')='false'
    then lower(s.student_identifier)
  else s.student_identifier end
from public.school_projects p
where p.id=s.project_id and s.student_identifier_unique is null
  and s.student_identifier is not null and not s.student_identifier_review_required;

with duplicate_keys as (
  select project_id,student_identifier_unique
  from public.students
  where student_identifier_unique is not null and not student_identifier_review_required
  group by project_id,student_identifier_unique
  having count(*)>1
)
update public.students s
set student_identifier_review_required=true,
    student_identifier_source='legacy_duplicate_review',
    student_identifier_unique=null
from duplicate_keys d
where s.project_id=d.project_id and s.student_identifier_unique=d.student_identifier_unique
  and not s.student_identifier_review_required;

-- Comparison-key uniqueness respects each project's configured canonicalization policy.
create unique index if not exists students_project_student_identifier_key
  on public.students(project_id,student_identifier_unique);
create index if not exists idx_students_project_identifier
  on public.students(project_id,student_identifier);
create index if not exists idx_student_photos_project_identifier
  on public.student_photos(project_id,student_identifier);
-- These are lookup indexes, not unique: card sides and historical snapshots may share a student ID.
create index if not exists idx_batch_items_batch_student_identifier
  on public.batch_generation_items(batch_id,student_identifier);
create index if not exists idx_generated_cards_batch_student_identifier
  on public.generated_cards(batch_id,student_identifier);
create index if not exists idx_processing_jobs_batch_identifier
  on public.processing_jobs(batch_id,student_identifier);

alter table public.students drop constraint if exists students_student_identifier_length_check;
alter table public.students add constraint students_student_identifier_length_check
  check (student_identifier is null or length(student_identifier) between 1 and 64) not valid;
alter table public.students drop constraint if exists students_student_identifier_required;
alter table public.students add constraint students_student_identifier_required
  check (student_identifier is not null) not valid;
alter table public.batch_generation_items drop constraint if exists batch_items_student_identifier_required;
alter table public.batch_generation_items add constraint batch_items_student_identifier_required
  check (student_identifier is not null) not valid;
alter table public.generated_cards drop constraint if exists generated_cards_student_identifier_required;
alter table public.generated_cards add constraint generated_cards_student_identifier_required
  check (student_identifier is not null) not valid;
alter table public.processing_jobs drop constraint if exists processing_jobs_student_identifier_required;
alter table public.processing_jobs add constraint processing_jobs_student_identifier_required
  check (student_identifier is not null) not valid;

alter table public.school_projects drop constraint if exists school_projects_identifier_settings_check;
alter table public.school_projects add constraint school_projects_identifier_settings_check check (
  jsonb_typeof(student_identifier_settings)='object'
  and student_identifier_settings->>'normalization' in ('exact','numeric')
  and student_identifier_settings->>'case_sensitive' in ('true','false')
  and student_identifier_settings->>'edge_whitespace' in ('reject','trim')
  and case
    when coalesce(student_identifier_settings->>'max_length','64') ~ '^[0-9]{1,2}$'
      then (student_identifier_settings->>'max_length')::integer between 1 and 64
    else false
  end
) not valid;

-- Validate new and updated confirmed identifiers at the database boundary. Legacy rows pending review
-- deliberately keep a NULL comparison key so no inferred identity is silently enforced.
create or replace function public.phase24_sync_student_identifier()
returns trigger
language plpgsql
security invoker
set search_path=public
as $phase24$
declare
  v_settings jsonb;
  v_key text;
begin
  if new.student_identifier is null and new.serial_number is not null then
    new.student_identifier:=new.serial_number::text;
  end if;
  if new.student_identifier is null or new.student_identifier_review_required then
    new.student_identifier_unique:=null;
    return new;
  end if;

  select p.student_identifier_settings into v_settings
  from public.school_projects p where p.id=new.project_id;
  if not found then raise exception 'project configuration unavailable for identifier validation'; end if;

  if coalesce(v_settings->>'edge_whitespace','reject')='trim' then
    new.student_identifier:=btrim(new.student_identifier);
  elsif new.student_identifier<>btrim(new.student_identifier) then
    raise exception 'student identifier has leading or trailing whitespace';
  end if;

  if length(new.student_identifier)>coalesce((v_settings->>'max_length')::integer,64)
     or new.student_identifier !~ '^[[:alnum:]][[:alnum:]._/-]{0,63}$'
  then raise exception 'invalid canonical student identifier'; end if;

  if coalesce(v_settings->>'normalization','exact')='numeric'
     and new.student_identifier ~ '^[0-9]+$'
  then
    new.student_identifier:=coalesce(nullif(regexp_replace(new.student_identifier,'^0+',''),''),'0');
  end if;

  v_key:=new.student_identifier;
  if coalesce(v_settings->>'case_sensitive','true')='false' then v_key:=lower(v_key); end if;
  new.student_identifier_unique:=v_key;
  return new;
end;
$phase24$;

drop trigger if exists phase24_students_identifier_sync on public.students;
create trigger phase24_students_identifier_sync
before insert or update on public.students
for each row execute function public.phase24_sync_student_identifier();

create or replace function public.phase24_fill_legacy_student_identifier()
returns trigger
language plpgsql
security invoker
set search_path=public
as $phase24$
begin
  if new.student_identifier is null and new.serial_number is not null then
    new.student_identifier:=new.serial_number::text;
  end if;
  return new;
end;
$phase24$;

drop trigger if exists phase24_batch_items_identifier_compat on public.batch_generation_items;
create trigger phase24_batch_items_identifier_compat
before insert or update on public.batch_generation_items
for each row execute function public.phase24_fill_legacy_student_identifier();

drop trigger if exists phase24_generated_cards_identifier_compat on public.generated_cards;
create trigger phase24_generated_cards_identifier_compat
before insert or update on public.generated_cards
for each row execute function public.phase24_fill_legacy_student_identifier();

drop trigger if exists phase24_processing_jobs_identifier_compat on public.processing_jobs;
create trigger phase24_processing_jobs_identifier_compat
before insert or update on public.processing_jobs
for each row execute function public.phase24_fill_legacy_student_identifier();

create or replace function public.phase24_fill_photo_student_identifier()
returns trigger
language plpgsql
security invoker
set search_path=public
as $phase24$
begin
  if new.student_id is not null then
    select s.student_identifier into new.student_identifier
    from public.students s
    where s.id=new.student_id and s.project_id=new.project_id;
  elsif new.student_identifier is null and new.original_serial_number is not null then
    new.student_identifier:=new.original_serial_number;
  end if;
  return new;
end;
$phase24$;

drop trigger if exists phase24_photo_identifier_compat on public.student_photos;
create trigger phase24_photo_identifier_compat
before insert or update on public.student_photos
for each row execute function public.phase24_fill_photo_student_identifier();

commit;
