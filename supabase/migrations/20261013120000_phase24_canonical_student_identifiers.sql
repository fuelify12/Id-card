-- Phase 24: canonical text student identifiers with a backwards-compatible legacy bridge.
-- This migration is additive and deliberately does not rewrite or delete student/photo/card rows.
begin;

alter table public.school_projects
  add column if not exists student_identifier_settings jsonb not null
  default '{"normalization":"exact","case_sensitive":true,"edge_whitespace":"reject","max_length":64}'::jsonb;

alter table public.students
  add column if not exists student_identifier text;

-- Backfill only what the numeric database actually knows. Never invent lost zero padding.
update public.students
set student_identifier = serial_number::text
where student_identifier is null;

-- Keep the legacy integer column for old readers, but allow text-only identifiers to be represented
-- without lossy coercion. Existing values are preserved unchanged.
alter table public.students alter column serial_number drop not null;

alter table public.student_photos
  add column if not exists student_identifier text;

alter table public.batch_generation_items
  add column if not exists student_identifier text;

alter table public.generated_cards
  add column if not exists student_identifier text;

-- Existing batch/card snapshots are backfilled from the existing numeric snapshot, without padding.
update public.batch_generation_items
set student_identifier = serial_number::text
where student_identifier is null;

update public.generated_cards
set student_identifier = serial_number::text
where student_identifier is null;

update public.student_photos p
set student_identifier = s.student_identifier
from public.students s
where p.student_id = s.id and p.project_id = s.project_id
  and p.student_identifier is null;

-- Canonical identifier uniqueness is project-scoped. The old numeric uniqueness remains in place
-- for legacy values, while text-only IDs are protected by this new index.
create unique index if not exists students_project_student_identifier_key
  on public.students(project_id, student_identifier);

create index if not exists idx_students_project_identifier
  on public.students(project_id, student_identifier);

create index if not exists idx_student_photos_project_identifier
  on public.student_photos(project_id, student_identifier);

create unique index if not exists batch_items_batch_student_identifier_key
  on public.batch_generation_items(batch_id, student_identifier);

create unique index if not exists generated_cards_batch_student_identifier_key
  on public.generated_cards(batch_id, student_identifier);

-- Constraints intentionally allow NULL on legacy snapshots while application code rolls forward.
alter table public.students drop constraint if exists students_student_identifier_length_check;
alter table public.students add constraint students_student_identifier_length_check
  check (student_identifier is null or (length(student_identifier) between 1 and 64))
  not valid;

alter table public.school_projects drop constraint if exists school_projects_identifier_settings_check;
alter table public.school_projects add constraint school_projects_identifier_settings_check
  check (
    jsonb_typeof(student_identifier_settings) = 'object'
    and student_identifier_settings->>'normalization' in ('exact','numeric')
    and (student_identifier_settings->>'case_sensitive') in ('true','false')
    and (student_identifier_settings->>'edge_whitespace') in ('reject','trim')
    and coalesce((student_identifier_settings->>'max_length')::integer,64) between 1 and 64
  ) not valid;

commit;
