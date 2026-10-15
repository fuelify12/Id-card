-- Phase 28 schema snapshot part: create_functions
-- Derived from read-only Production catalog metadata on 2026-10-14.
-- Apply only after verifying project ref zzecjgauhkaxyptsurlw is isolated and empty.
-- Not the original Phase 1 migration; no Production data is copied.
begin;
CREATE OR REPLACE FUNCTION public.bump_template_version_for_field_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='INSERT' then
   update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   return new;
 elsif tg_op='DELETE' then
   update public.templates set version_number=version_number+1,updated_at=now() where id=old.template_id;
   return old;
 else
   if old.template_id=new.template_id then
     update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   else
     update public.templates set version_number=version_number+1,updated_at=now() where id=old.template_id;
     update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   end if;
   return new;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.capture_security_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_row jsonb;
  v_owner uuid;
  v_project uuid;
  v_entity uuid;
  v_actor uuid;
  v_old jsonb;
  v_metadata jsonb;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_owner := nullif(v_row ->> 'owner_id', '')::uuid;
  v_entity := nullif(v_row ->> 'id', '')::uuid;
  v_actor := auth.uid();
  if tg_table_name = 'school_projects' then
    v_project := v_entity;
  else
    v_project := nullif(v_row ->> 'project_id', '')::uuid;
  end if;
  if v_owner is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- During account deletion, auth.users may already be cascading away.
  if not exists (select 1 from auth.users u where u.id = v_owner) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- Null the project reference on deletes so the audit survives project deletion/cascades.
  if tg_op = 'DELETE' then v_project := null; end if;
  v_metadata := jsonb_build_object('actor_id', v_actor, 'source', 'database_trigger');
  -- Keep state-only metadata; never copy student fields, filenames, images, tokens or raw errors.
  if v_row ? 'status' then
    v_metadata := v_metadata || jsonb_build_object('status', left(coalesce(v_row ->> 'status',''), 40));
  end if;
  if v_row ? 'approval_status' then
    v_metadata := v_metadata || jsonb_build_object('approval_status', left(coalesce(v_row ->> 'approval_status',''), 40));
  end if;
  if v_row ? 'validation_status' then
    v_metadata := v_metadata || jsonb_build_object('validation_status', left(coalesce(v_row ->> 'validation_status',''), 40));
  end if;
  if v_row ? 'match_status' then
    v_metadata := v_metadata || jsonb_build_object('match_status', left(coalesce(v_row ->> 'match_status',''), 40));
  end if;
  if v_row ? 'processing_status' then
    v_metadata := v_metadata || jsonb_build_object('processing_status', left(coalesce(v_row ->> 'processing_status',''), 40));
  end if;
  if tg_op = 'UPDATE' then
    if v_old ? 'status' and v_row ? 'status' then
      v_metadata := v_metadata || jsonb_build_object('previous_status', left(coalesce(v_old ->> 'status',''),40));
    end if;
    if v_old ? 'retry_count' and v_row ? 'retry_count' then
      v_metadata := v_metadata || jsonb_build_object('retry_count', greatest(0, least(3, coalesce((v_row ->> 'retry_count')::integer,0))));
    end if;
  end if;
  insert into public.audit_logs(owner_id, project_id, action, entity_type, entity_id, metadata)
  values (v_owner, v_project, lower(tg_op), left(tg_table_name, 80), v_entity, v_metadata);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_batch_generation_items(p_batch_id uuid, p_worker_id text, p_limit integer DEFAULT 3)
 RETURNS SETOF batch_generation_items
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_batch_status text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select b.owner_id, lower(b.status)
    into v_owner_id, v_batch_status
  from public.batches b
  join public.school_projects p on p.id = b.project_id
  where b.id = p_batch_id
    and b.owner_id = auth.uid()
    and p.owner_id = auth.uid()
  for update of b;

  if not found or v_owner_id is distinct from auth.uid() then
    raise exception 'batch access denied';
  end if;

  if v_batch_status not in ('queued', 'running') then
    raise exception 'batch is not claimable';
  end if;

  update public.batch_generation_items i
  set status = case when i.attempts >= i.max_attempts then 'FAILED' else 'PENDING' end,
      error_category = case when i.attempts >= i.max_attempts then 'unknown' else i.error_category end,
      error_summary = case
        when i.attempts >= i.max_attempts then 'Worker lease expired after maximum attempts.'
        else 'Recovered an expired worker lease; retry is scheduled.'
      end,
      available_at = case when i.attempts >= i.max_attempts then i.available_at else now() end,
      completed_at = case when i.attempts >= i.max_attempts then now() else null end,
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.project_id = (select b.project_id from public.batches b where b.id = p_batch_id)
    and i.owner_id = auth.uid()
    and i.status = 'PROCESSING'
    and coalesce(i.heartbeat_at, i.claimed_at, i.updated_at) < now() - interval '5 minutes';

  update public.batch_generation_items i
  set status = 'FAILED',
      error_category = coalesce(i.error_category, 'unknown'),
      error_summary = coalesce(i.error_summary, 'Maximum worker attempts exhausted.'),
      completed_at = now(),
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.owner_id = auth.uid()
    and i.status = 'PENDING'
    and i.attempts >= i.max_attempts;

  return query
  with eligible as (
    select i.id
    from public.batch_generation_items i
    where i.batch_id = p_batch_id
      and i.owner_id = auth.uid()
      and i.status = 'PENDING'
      and i.attempts < i.max_attempts
      and i.available_at <= now()
    order by i.serial_number
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 8))
  )
  update public.batch_generation_items i
  set status = 'PROCESSING',
      claimed_at = now(),
      claimed_by = left(coalesce(p_worker_id, 'worker'), 100),
      heartbeat_at = now(),
      attempts = i.attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  from eligible e
  where i.id = e.id
  returning i.*;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(p_action text, p_limit integer, p_window_seconds integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid;
  v_count integer;
  v_limit integer;
  v_window_seconds integer;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;

  case p_action
    when 'project_create' then v_limit := 10; v_window_seconds := 3600;
    when 'template_upload' then v_limit := 10; v_window_seconds := 3600;
    when 'student_import' then v_limit := 20; v_window_seconds := 3600;
    when 'photo_upload_ticket' then v_limit := 300; v_window_seconds := 60;
    when 'photo_processing' then v_limit := 10; v_window_seconds := 60;
    when 'batch_generate' then v_limit := 5; v_window_seconds := 60;
    when 'zip_export' then v_limit := 3; v_window_seconds := 60;
    else return false;
  end case;

  -- Parameters remain for API compatibility, but must exactly match the trusted
  -- server-side quota for this action. A client cannot reset a window or raise a limit.
  if p_limit is distinct from v_limit
     or p_window_seconds is distinct from v_window_seconds then
    return false;
  end if;

  insert into public.security_rate_limits(owner_id, action, window_started_at, request_count)
  values (v_uid, p_action, now(), 1)
  on conflict (owner_id, action) do update
  set window_started_at = case
        when public.security_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then now()
        else public.security_rate_limits.window_started_at
      end,
      request_count = case
        when public.security_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then 1
        else public.security_rate_limits.request_count + 1
      end
  returning request_count into v_count;

  return v_count <= v_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_photo_upload(p_batch_id uuid, p_project_id uuid, p_path text, p_actual_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null or p_actual_size<=0 or p_actual_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes-reserved_size+p_actual_size,photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading'
   and total_bytes-reserved_size+p_actual_size<=524288000;
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.guard_card_validation_finding_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='INSERT' then
   if new.status in ('RESOLVED','WAIVED') and coalesce(trim(new.resolution_note),'')='' then
     raise exception 'A corrective-action note or waiver justification is required.';
   end if;
   if new.severity='CRITICAL' and new.status in ('RESOLVED','WAIVED') then
     raise exception 'Critical findings must be created open and may only close after server-side revalidation.';
   end if;
   return new;
 end if;
 if new.finding_key is distinct from old.finding_key
    or new.project_id is distinct from old.project_id
    or new.owner_id is distinct from old.owner_id
    or new.student_id is distinct from old.student_id
    or new.batch_id is distinct from old.batch_id
    or new.generated_card_id is distinct from old.generated_card_id
    or new.rule_id is distinct from old.rule_id
    or new.rule_version is distinct from old.rule_version
    or new.severity is distinct from old.severity
    or new.input_fingerprint is distinct from old.input_fingerprint then
   raise exception 'Validation finding identity and severity are immutable; create a new fingerprinted finding instead.';
 end if;
 if new.status in ('RESOLVED','WAIVED') and coalesce(trim(new.resolution_note),'')='' then
   raise exception 'A corrective-action note or waiver justification is required.';
 end if;
 if old.severity='CRITICAL' and new.status='WAIVED' then
   raise exception 'Critical validation findings cannot be waived.';
 end if;
 if old.severity='CRITICAL' and new.status='RESOLVED' and new.resolution_note not like 'Automatically resolved by revalidation%' then
   raise exception 'Critical findings close only when server-side revalidation confirms the issue no longer reproduces.';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_photo_batch_bytes(p_batch_id uuid, p_project_id uuid, p_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if p_size<=0 then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.release_photo_upload(p_batch_id uuid, p_project_id uuid, p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-reserved_size),photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.reserve_photo_batch_bytes(p_batch_id uuid, p_project_id uuid, p_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if p_size<=0 or p_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid())
   and status='uploading' and total_bytes+p_size<=524288000;
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.reserve_photo_upload(p_batch_id uuid, p_project_id uuid, p_path text, p_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if p_size<=0 or p_size>10485760 or p_path is null or length(p_path)>512 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size,photo_reservations=photo_reservations||jsonb_build_object(p_path,p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading'
   and not(photo_reservations ? p_path) and total_bytes+p_size<=524288000;
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.retry_failed_batch_items(p_batch_id uuid, p_item_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select lower(b.status)
    into v_status
  from public.batches b
  join public.school_projects p on p.id = b.project_id
  where b.id = p_batch_id
    and b.owner_id = auth.uid()
    and p.owner_id = auth.uid()
  for update of b;

  if not found then
    raise exception 'batch access denied';
  end if;

  if v_status not in ('failed', 'completed_with_errors') then
    raise exception 'batch is not eligible for manual retry';
  end if;

  update public.batch_generation_items i
  set status = 'PENDING',
      attempts = 0,
      error_summary = null,
      error_category = null,
      completed_at = null,
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = null,
      available_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.owner_id = auth.uid()
    and i.status = 'FAILED'
    and (p_item_ids is null or i.id = any(p_item_ids));

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no failed items are eligible for retry';
  end if;

  update public.batches b
  set status = 'queued',
      completed_at = null,
      cancelled_at = null,
      paused_at = null,
      last_error = null,
      heartbeat_at = now()
  where b.id = p_batch_id
    and b.owner_id = auth.uid();

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_active_template_version(p_project_id uuid, p_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.templates
    set is_active = false, updated_at = now()
  where project_id = p_project_id
    and owner_id = (select auth.uid())
    and is_active = true;

  update public.templates
    set is_active = true, updated_at = now()
  where id = p_template_id
    and project_id = p_project_id
    and owner_id = (select auth.uid());
end;
$function$;
commit;
