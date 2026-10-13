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
alter table public.batch_generation_items alter column serial_number drop not null;
alter table public.generated_cards alter column serial_number drop not null;

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

-- Preserve filename identifiers on unmatched historical photos when the original token was stored.
update public.student_photos
set student_identifier = coalesce(original_serial_number, normalized_serial_number)
where student_identifier is null and coalesce(original_serial_number, normalized_serial_number) is not null;

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

-- Preserve compatibility for old numeric writers: only fill a missing text snapshot from
-- the numeric value they actually supplied. This cannot and does not invent leading zeroes.
create or replace function public.phase24_fill_legacy_student_identifier()
returns trigger language plpgsql set search_path=public as $
begin
  if new.student_identifier is null and new.serial_number is not null then
    new.student_identifier := new.serial_number::text;
  end if;
  return new;
end $;

drop trigger if exists phase24_students_identifier_compat on public.students;
create trigger phase24_students_identifier_compat
before insert or update of serial_number, student_identifier on public.students
for each row execute function public.phase24_fill_legacy_student_identifier();

drop trigger if exists phase24_batch_items_identifier_compat on public.batch_generation_items;
create trigger phase24_batch_items_identifier_compat
before insert or update of serial_number, student_identifier on public.batch_generation_items
for each row execute function public.phase24_fill_legacy_student_identifier();

drop trigger if exists phase24_generated_cards_identifier_compat on public.generated_cards;
create trigger phase24_generated_cards_identifier_compat
before insert or update of serial_number, student_identifier on public.generated_cards
for each row execute function public.phase24_fill_legacy_student_identifier();

create or replace function public.phase24_fill_photo_student_identifier()
returns trigger language plpgsql set search_path=public as $
begin
  if new.student_identifier is null and new.student_id is not null then
    select s.student_identifier into new.student_identifier
    from public.students s
    where s.id=new.student_id and s.project_id=new.project_id;
  end if;
  if new.student_identifier is null then
    new.student_identifier := coalesce(new.original_serial_number,new.normalized_serial_number);
  end if;
  return new;
end $;

drop trigger if exists phase24_photo_identifier_compat on public.student_photos;
create trigger phase24_photo_identifier_compat
before insert or update of student_id, project_id, student_identifier, original_serial_number, normalized_serial_number
on public.student_photos for each row execute function public.phase24_fill_photo_student_identifier();

-- Batch worker ordering must remain deterministic when text-only identifiers have no legacy integer.
create or replace function public.claim_batch_generation_items(p_batch_id uuid,p_worker_id text,p_limit integer default 3)
returns setof public.batch_generation_items language plpgsql security definer set search_path=public as $
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.batches b join public.school_projects p on p.id=b.project_id where b.id=p_batch_id and b.owner_id=auth.uid() and p.owner_id=auth.uid() and lower(b.status) in ('queued','running')) then raise exception 'batch access denied'; end if;
 return query with eligible as (
  select i.id from public.batch_generation_items i where i.batch_id=p_batch_id and i.owner_id=auth.uid() and i.status='PENDING' and i.available_at<=now()
  order by coalesce(i.student_identifier,i.serial_number::text),i.id for update skip locked limit greatest(1,least(coalesce(p_limit,3),8))
 ) update public.batch_generation_items i set status='PROCESSING',claimed_at=now(),claimed_by=left(p_worker_id,100),heartbeat_at=now(),attempts=i.attempts+1,last_attempt_at=now(),updated_at=now()
 from eligible e where i.id=e.id returning i.*;
end $;
revoke all on function public.claim_batch_generation_items(uuid,text,integer) from public,anon;
grant execute on function public.claim_batch_generation_items(uuid,text,integer) to authenticated,service_role;


commit;
