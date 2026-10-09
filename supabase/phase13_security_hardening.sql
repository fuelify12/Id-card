-- Phase 13: incremental security hardening. Safe to re-run; no table or user data is dropped.
-- The existing application stores object paths as <auth-user-uuid>/<project-uuid>/<opaque-file-name>.

-- Enforce tenant consistency at the database boundary, not only in client-supplied owner_id fields.
create unique index if not exists school_projects_id_owner_id_security_uidx
  on public.school_projects (id, owner_id);
create unique index if not exists students_id_project_security_uidx
  on public.students (id, project_id);
create unique index if not exists templates_id_owner_security_uidx
  on public.templates (id, owner_id);
create unique index if not exists templates_id_project_owner_security_uidx
  on public.templates (id, project_id, owner_id);
create unique index if not exists batches_id_project_owner_security_uidx
  on public.batches (id, project_id, owner_id);
create unique index if not exists generated_cards_id_owner_security_uidx
  on public.generated_cards (id, owner_id);
create unique index if not exists generated_cards_id_project_owner_security_uidx
  on public.generated_cards (id, project_id, owner_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_project_owner_security_fkey' and conrelid = 'public.students'::regclass) then
    alter table public.students add constraint students_project_owner_security_fkey
      foreign key (project_id, owner_id) references public.school_projects(id, owner_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'templates_project_owner_security_fkey' and conrelid = 'public.templates'::regclass) then
    alter table public.templates add constraint templates_project_owner_security_fkey
      foreign key (project_id, owner_id) references public.school_projects(id, owner_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'batches_project_owner_security_fkey' and conrelid = 'public.batches'::regclass) then
    alter table public.batches add constraint batches_project_owner_security_fkey
      foreign key (project_id, owner_id) references public.school_projects(id, owner_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'batches_template_project_owner_security_fkey' and conrelid = 'public.batches'::regclass) then
    alter table public.batches add constraint batches_template_project_owner_security_fkey
      foreign key (template_id, project_id, owner_id) references public.templates(id, project_id, owner_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'processing_jobs_project_owner_security_fkey' and conrelid = 'public.processing_jobs'::regclass) then
    alter table public.processing_jobs add constraint processing_jobs_project_owner_security_fkey
      foreign key (project_id, owner_id) references public.school_projects(id, owner_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generated_cards_project_owner_security_fkey' and conrelid = 'public.generated_cards'::regclass) then
    alter table public.generated_cards add constraint generated_cards_project_owner_security_fkey
      foreign key (project_id, owner_id) references public.school_projects(id, owner_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generated_cards_student_project_security_fkey' and conrelid = 'public.generated_cards'::regclass) then
    alter table public.generated_cards add constraint generated_cards_student_project_security_fkey
      foreign key (student_id, project_id) references public.students(id, project_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generated_cards_template_project_owner_security_fkey' and conrelid = 'public.generated_cards'::regclass) then
    alter table public.generated_cards add constraint generated_cards_template_project_owner_security_fkey
      foreign key (template_id, project_id, owner_id) references public.templates(id, project_id, owner_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'validation_results_card_owner_security_fkey' and conrelid = 'public.validation_results'::regclass) then
    alter table public.validation_results add constraint validation_results_card_owner_security_fkey
      foreign key (generated_card_id, owner_id) references public.generated_cards(id, owner_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'card_validation_findings_project_owner_security_fkey' and conrelid = 'public.card_validation_findings'::regclass) then
    alter table public.card_validation_findings add constraint card_validation_findings_project_owner_security_fkey
      foreign key (project_id, owner_id) references public.school_projects(id, owner_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'batch_items_student_project_security_fkey' and conrelid = 'public.batch_generation_items'::regclass) then
    alter table public.batch_generation_items add constraint batch_items_student_project_security_fkey
      foreign key (student_id, project_id) references public.students(id, project_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'batch_items_batch_project_owner_security_fkey' and conrelid = 'public.batch_generation_items'::regclass) then
    alter table public.batch_generation_items add constraint batch_items_batch_project_owner_security_fkey
      foreign key (batch_id, project_id, owner_id) references public.batches(id, project_id, owner_id) on delete cascade not valid;
  end if;
end $$;

-- Existing objects are private. Enforce both the authenticated owner folder and the project
-- folder for every user-facing PrintForge bucket. This also replaces an earlier predicate
-- that accidentally inspected school_projects.name instead of the requested object path.
drop policy if exists "printforge photo delete owned project" on storage.objects;
drop policy if exists "printforge photo insert owned project" on storage.objects;
drop policy if exists "printforge photo select owned project" on storage.objects;
drop policy if exists "printforge photo update owned project" on storage.objects;
drop policy if exists "printforge storage delete own folder" on storage.objects;
drop policy if exists "printforge storage insert own folder" on storage.objects;
drop policy if exists "printforge storage select own folder" on storage.objects;
drop policy if exists "printforge storage update own folder" on storage.objects;

create policy "printforge tenant object select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.owner_id = (select auth.uid())
    )
  );

-- Security audit history is readable by its owner but cannot be forged, changed, or deleted
-- through the public client API. Trusted database triggers below write safe metadata only.
drop policy if exists "audit own rows" on public.audit_logs;
drop policy if exists audit_logs_owner_select on public.audit_logs;
drop policy if exists audit_logs_owner_insert on public.audit_logs;
drop policy if exists audit_logs_owner_update on public.audit_logs;
drop policy if exists audit_logs_owner_delete on public.audit_logs;
create policy audit_logs_owner_select on public.audit_logs
  for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.capture_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb;
  v_owner uuid;
  v_project uuid;
  v_entity uuid;
  v_actor uuid;
begin
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
  insert into public.audit_logs(owner_id, project_id, action, entity_type, entity_id, metadata)
  values (
    v_owner,
    v_project,
    lower(tg_op),
    left(tg_table_name, 80),
    v_entity,
    jsonb_build_object('actor_id', v_actor, 'source', 'database_trigger')
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.capture_security_audit_event() from public, anon, authenticated;

drop trigger if exists security_audit_school_projects on public.school_projects;
create trigger security_audit_school_projects after insert or update or delete on public.school_projects
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_students on public.students;
create trigger security_audit_students after insert or update or delete on public.students
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_student_photos on public.student_photos;
create trigger security_audit_student_photos after insert or update or delete on public.student_photos
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_templates on public.templates;
create trigger security_audit_templates after insert or update or delete on public.templates
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_template_fields on public.template_fields;
create trigger security_audit_template_fields after insert or update or delete on public.template_fields
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_batches on public.batches;
create trigger security_audit_batches after insert or update or delete on public.batches
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_generated_cards on public.generated_cards;
create trigger security_audit_generated_cards after insert or update or delete on public.generated_cards
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_validation_results on public.validation_results;
create trigger security_audit_validation_results after insert or update or delete on public.validation_results
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_exports on public.exports;
create trigger security_audit_exports after insert or update or delete on public.exports
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_batch_items on public.batch_generation_items;
create trigger security_audit_batch_items after insert or update or delete on public.batch_generation_items
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_processing_jobs on public.processing_jobs;
create trigger security_audit_processing_jobs after insert or update or delete on public.processing_jobs
  for each row execute function public.capture_security_audit_event();
drop trigger if exists security_audit_validation_findings on public.card_validation_findings;
create trigger security_audit_validation_findings after insert or update or delete on public.card_validation_findings
  for each row execute function public.capture_security_audit_event();

-- Never allow the application role to mutate audit history directly, including via grants
-- that may have been added separately from RLS.
revoke insert, update, delete, truncate, references, trigger on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
