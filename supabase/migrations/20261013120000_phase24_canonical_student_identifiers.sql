-- Phase 24: additive canonical text identifiers and compatibility snapshots.
-- Apply only in an isolated database first. Existing identifiers are backfilled from stored
-- integer values only; this migration cannot infer leading zeroes that were already lost.
begin;

alter table public.school_projects
  add column if not exists student_identifier_settings jsonb not null
  default '{"normalization":"exact","case_sensitive":true,"edge_whitespace":"reject","max_length":64}'::jsonb;

alter table public.students add column if not exists student_identifier text;
alter table public.students add column if not exists student_identifier_source text not null default 'legacy_numeric_backfill';
alter table public.students add column if not exists student_identifier_review_required boolean not null default true;
alter table public.students add column if not exists student_identifier_unique text
  generated always as (case when student_identifier_review_required then null else student_identifier end) stored;
alter table public.student_photos add column if not exists student_identifier text;
alter table public.batch_generation_items add column if not exists student_identifier text;
alter table public.generated_cards add column if not exists student_identifier text;
alter table public.processing_jobs add column if not exists student_identifier text;

-- Retain integer compatibility columns, but allow lossless text-only identifiers.
alter table public.students alter column serial_number drop not null;
alter table public.batch_generation_items alter column serial_number drop not null;
alter table public.generated_cards alter column serial_number drop not null;
alter table public.processing_jobs alter column serial_number drop not null;

-- Backfill only from known values. Student UUID/FK associations and storage paths are unchanged.
update public.students set student_identifier=serial_number::text where student_identifier is null;
update public.batch_generation_items set student_identifier=serial_number::text where student_identifier is null and serial_number is not null;
update public.generated_cards set student_identifier=serial_number::text where student_identifier is null and serial_number is not null;
update public.processing_jobs j set student_identifier=s.student_identifier
from public.students s where j.student_id=s.id and j.project_id=s.project_id and j.student_identifier is null;
update public.processing_jobs set student_identifier=serial_number::text where student_identifier is null and serial_number is not null;
update public.student_photos p set student_identifier=s.student_identifier
from public.students s where p.student_id=s.id and p.project_id=s.project_id and p.student_identifier is null;
update public.student_photos
set student_identifier=coalesce(original_serial_number,normalized_serial_number)
where student_identifier is null and coalesce(original_serial_number,normalized_serial_number) is not null;

-- Generated uniqueness key excludes unresolved legacy rows, allowing their duplicates to be reviewed explicitly.
create unique index if not exists students_project_student_identifier_key
  on public.students(project_id,student_identifier_unique);
create index if not exists idx_students_project_identifier
  on public.students(project_id,student_identifier);
create index if not exists idx_student_photos_project_identifier
  on public.student_photos(project_id,student_identifier);
create index if not exists idx_batch_items_batch_student_identifier
  on public.batch_generation_items(batch_id,student_identifier);
-- A student can have separate front/back card rows, so this is intentionally not unique.
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
alter table public.school_projects add constraint school_projects_identifier_settings_check
  check (
    jsonb_typeof(student_identifier_settings)='object'
    and student_identifier_settings->>'normalization' in ('exact','numeric')
    and student_identifier_settings->>'case_sensitive' in ('true','false')
    and student_identifier_settings->>'edge_whitespace' in ('reject','trim')
    and coalesce((student_identifier_settings->>'max_length')::integer,64) between 1 and 64
  ) not valid;

-- Compatibility triggers: legacy numeric writes get their actual integer spelling; no padding is guessed.
create or replace function public.phase24_fill_legacy_student_identifier()
returns trigger language plpgsql set search_path=public as $phase24$
begin
  if new.student_identifier is null and new.serial_number is not null then
    new.student_identifier:=new.serial_number::text;
  end if;
  return new;
end;
$phase24$;

drop trigger if exists phase24_students_identifier_compat on public.students;
create trigger phase24_students_identifier_compat before insert or update on public.students
for each row execute function public.phase24_fill_legacy_student_identifier();
drop trigger if exists phase24_batch_items_identifier_compat on public.batch_generation_items;
create trigger phase24_batch_items_identifier_compat before insert or update on public.batch_generation_items
for each row execute function public.phase24_fill_legacy_student_identifier();
drop trigger if exists phase24_generated_cards_identifier_compat on public.generated_cards;
create trigger phase24_generated_cards_identifier_compat before insert or update on public.generated_cards
for each row execute function public.phase24_fill_legacy_student_identifier();
drop trigger if exists phase24_processing_jobs_identifier_compat on public.processing_jobs;
create trigger phase24_processing_jobs_identifier_compat before insert or update on public.processing_jobs
for each row execute function public.phase24_fill_legacy_student_identifier();

create or replace function public.phase24_fill_photo_student_identifier()
returns trigger language plpgsql set search_path=public as $phase24$
begin
  if new.student_identifier is null and new.student_id is not null then
    select s.student_identifier into new.student_identifier from public.students s
    where s.id=new.student_id and s.project_id=new.project_id;
  end if;
  if new.student_identifier is null then
    new.student_identifier:=coalesce(new.original_serial_number,new.normalized_serial_number);
  end if;
  return new;
end;
$phase24$;

drop trigger if exists phase24_photo_identifier_compat on public.student_photos;
create trigger phase24_photo_identifier_compat
before insert or update on public.student_photos
for each row execute function public.phase24_fill_photo_student_identifier();

commit;
