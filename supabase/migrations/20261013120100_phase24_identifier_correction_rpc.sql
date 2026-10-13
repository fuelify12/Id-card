-- Transactional owner-reviewed correction for identifiers backfilled from legacy integers.
-- Security stays SECURITY INVOKER; RLS and explicit project ownership checks remain in force.
begin;

create or replace function public.correct_student_identifier(
  p_project_id uuid,
  p_student_id uuid,
  p_student_identifier text,
  p_legacy_serial_number integer,
  p_data jsonb
)
returns text
language plpgsql
security invoker
set search_path=public
as $phase24corr$
declare
  v_settings jsonb;
  v_old_identifier text;
  v_review_required boolean;
  v_identifier_unique text;
  v_expected_legacy integer := null;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;

  select p.student_identifier_settings into v_settings
  from public.school_projects p
  where p.id=p_project_id and p.owner_id=auth.uid()
  for update;
  if not found then raise exception 'project access denied'; end if;

  select s.student_identifier,s.student_identifier_review_required
  into v_old_identifier,v_review_required
  from public.students s
  where s.id=p_student_id and s.project_id=p_project_id and s.owner_id=auth.uid()
  for update;
  if not found then raise exception 'student access denied'; end if;
  if not v_review_required then raise exception 'student identifier is not pending review'; end if;

  if p_student_identifier is null or p_student_identifier='' or length(p_student_identifier)>64
     or p_student_identifier<>btrim(p_student_identifier)
     or p_student_identifier !~ '^[[:alnum:]][[:alnum:]._/-]{0,63}$'
  then raise exception 'invalid canonical student identifier'; end if;

  if v_settings->>'normalization'='numeric' and p_student_identifier ~ '^[0-9]+$'
     and p_student_identifier<>coalesce(nullif(regexp_replace(p_student_identifier,'^0+',''),''),'0')
  then raise exception 'numeric identifier must already be normalized under project policy'; end if;

  if p_student_identifier ~ '^[0-9]+$' then
    if p_student_identifier=coalesce(nullif(regexp_replace(p_student_identifier,'^0+',''),''),'0') then
      if p_student_identifier::numeric<=2147483647 then
        v_expected_legacy:=p_student_identifier::integer;
      end if;
    end if;
  end if;
  v_identifier_unique:=case when coalesce(v_settings->>'case_sensitive','true')='false' then lower(p_student_identifier) else p_student_identifier end;
  if p_legacy_serial_number is distinct from v_expected_legacy
  then raise exception 'legacy integer projection does not match canonical identifier'; end if;

  if exists (
    select 1 from public.students other
    where other.project_id=p_project_id and other.owner_id=auth.uid()
      and other.id<>p_student_id and other.student_identifier_unique=v_identifier_unique
  ) then raise exception 'student identifier already exists in this project'; end if;

  if exists (
    select 1 from public.batch_generation_items i
    join public.batches b on b.id=i.batch_id and b.project_id=i.project_id
    where i.student_id=p_student_id and i.project_id=p_project_id and i.owner_id=auth.uid()
      and i.status in ('PENDING','PROCESSING')
      and lower(b.status) in ('queued','running','processing','paused','pausing')
  ) or exists (
    select 1 from public.processing_jobs j
    where j.student_id=p_student_id and j.project_id=p_project_id and j.owner_id=auth.uid()
      and lower(j.status) in ('pending','processing','queued','running')
  ) then raise exception 'cannot correct an identifier while processing is active'; end if;

  update public.students s
  set student_identifier=p_student_identifier,
      student_identifier_unique=v_identifier_unique,
      serial_number=p_legacy_serial_number,
      data=coalesce(p_data,s.data),
      student_identifier_source=case when v_old_identifier is distinct from p_student_identifier then 'owner_corrected' else 'owner_confirmed' end,
      student_identifier_review_required=false,
      updated_at=now()
  where s.id=p_student_id and s.project_id=p_project_id and s.owner_id=auth.uid();

  update public.student_photos p
  set student_identifier=p_student_identifier,
      normalized_serial_number=p_student_identifier,
      serial_number=p_legacy_serial_number,
      updated_at=now()
  where p.student_id=p_student_id and p.project_id=p_project_id and p.owner_id=auth.uid();

  update public.batch_generation_items i
  set student_identifier=p_student_identifier,
      serial_number=p_legacy_serial_number,
      status=case when i.status='SUCCEEDED' then 'NEEDS_REVIEW' else i.status end,
      error_category=case when i.status='SUCCEEDED' then 'validation' else i.error_category end,
      error_summary=case when i.status='SUCCEEDED' then 'Student identifier was corrected after rendering; regenerate and revalidate this card.' else i.error_summary end,
      output_card_id=case when i.status='SUCCEEDED' then null else i.output_card_id end,
      output_storage_path=case when i.status='SUCCEEDED' then null else i.output_storage_path end,
      input_fingerprint=case when i.status='SUCCEEDED' then null else i.input_fingerprint end,
      completed_at=case when i.status='SUCCEEDED' then null else i.completed_at end,
      updated_at=now()
  where i.student_id=p_student_id and i.project_id=p_project_id and i.owner_id=auth.uid();

  update public.processing_jobs j
  set student_identifier=p_student_identifier, serial_number=p_legacy_serial_number, updated_at=now()
  where j.student_id=p_student_id and j.project_id=p_project_id and j.owner_id=auth.uid()
    and lower(j.status) not in ('succeeded','completed','done');

  return p_student_identifier;
end;
$phase24corr$;

revoke all on function public.correct_student_identifier(uuid,uuid,text,integer,jsonb) from public,anon;
grant execute on function public.correct_student_identifier(uuid,uuid,text,integer,jsonb) to authenticated;

commit;
