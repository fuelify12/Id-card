-- PRINTFORGE ID CARD STUDIO — PHASE 3
-- School project + template versioning additions applied to production Supabase.
alter table public.templates
  add column if not exists version_number integer not null default 1,
  add column if not exists is_active boolean not null default true;

create index if not exists idx_templates_project_version
  on public.templates(project_id, version_number desc);

create unique index if not exists uq_templates_active_project
  on public.templates(project_id)
  where is_active = true;

create or replace function public.set_active_template_version(
  p_project_id uuid,
  p_template_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
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
$$;

revoke all on function public.set_active_template_version(uuid, uuid) from public;
grant execute on function public.set_active_template_version(uuid, uuid) to authenticated;

-- Template uploads are restricted by the existing private
-- printforge-templates storage policies. Application-level validation
-- additionally checks MIME type, file size, image magic bytes, and dimensions.
