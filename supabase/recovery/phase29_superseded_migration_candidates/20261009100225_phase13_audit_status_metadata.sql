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
$function$

revoke all on function public.capture_security_audit_event() from public, anon, authenticated;
