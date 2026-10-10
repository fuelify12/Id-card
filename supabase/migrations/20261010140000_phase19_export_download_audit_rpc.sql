-- Prompt 19: allow the authenticated export owner to record a verified download-link event
-- without granting direct INSERT privileges on the append-only audit_logs table.
begin;

create or replace function public.record_export_download_link_issued(
  p_project_id uuid,
  p_export_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.school_projects p
    join public.exports e
      on e.project_id = p.id
     and e.owner_id = p.owner_id
    where p.id = p_project_id
      and p.owner_id = v_uid
      and e.id = p_export_id
      and e.owner_id = v_uid
      and e.status in ('completed', 'completed_with_errors')
  ) then
    raise exception 'Export not found or access denied' using errcode = '42501';
  end if;

  -- Bound audit spam if a client invokes this owner-scoped RPC directly.
  if not exists (
    select 1
    from public.audit_logs a
    where a.owner_id = v_uid
      and a.project_id = p_project_id
      and a.entity_type = 'export'
      and a.entity_id = p_export_id
      and a.action = 'export_download_link_issued'
      and a.created_at >= now() - interval '60 seconds'
  ) then
    insert into public.audit_logs (
      owner_id, project_id, action, entity_type, entity_id, metadata
    ) values (
      v_uid, p_project_id, 'export_download_link_issued', 'export', p_export_id,
      jsonb_build_object('expires_in_seconds', 60, 'source', 'verified_download_route')
    );
  end if;

  return true;
end;
$function$;

revoke all on function public.record_export_download_link_issued(uuid, uuid) from public, anon;
grant execute on function public.record_export_download_link_issued(uuid, uuid) to authenticated;

commit;
