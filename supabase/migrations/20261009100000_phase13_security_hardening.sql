-- Phase 13: least-privilege grants, tenant-qualified RLS, private storage paths.
-- Safe for existing data: policies and grants only; no rows or objects are deleted.

begin;

-- RLS does not protect TRUNCATE and is not a substitute for SQL privileges.
revoke all privileges on all tables in schema public from anon;
revoke references, trigger, truncate on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

-- Anonymous clients must not call application RPCs. Authenticated RPC grants are
-- preserved; privileged worker/maintenance functions remain explicitly restricted.
revoke execute on all functions in schema public from anon;

-- A user-owned row must also point only at a project owned by that same user.
drop policy if exists "projects own rows" on public.school_projects;
create policy "projects own rows" on public.school_projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "students own rows" on public.students;
create policy "students own rows" on public.students
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = students.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = students.project_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "templates own rows" on public.templates;
create policy "templates own rows" on public.templates
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = templates.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = templates.project_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "fields own rows" on public.template_fields;
create policy "fields own rows" on public.template_fields
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1
      from public.templates t
      join public.school_projects p on p.id = t.project_id
      where t.id = template_fields.template_id
        and t.owner_id = (select auth.uid())
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1
      from public.templates t
      join public.school_projects p on p.id = t.project_id
      where t.id = template_fields.template_id
        and t.owner_id = (select auth.uid())
        and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "batches own rows" on public.batches;
create policy "batches own rows" on public.batches
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batches.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batches.project_id and p.owner_id = (select auth.uid())
    )
    and (template_id is null or exists (
      select 1 from public.templates t
      where t.id = batches.template_id and t.project_id = batches.project_id
        and t.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "jobs own rows" on public.processing_jobs;
create policy "jobs own rows" on public.processing_jobs
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = processing_jobs.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = processing_jobs.project_id and p.owner_id = (select auth.uid())
    )
    and (batch_id is null or exists (
      select 1 from public.batches b
      where b.id = processing_jobs.batch_id and b.project_id = processing_jobs.project_id
        and b.owner_id = (select auth.uid())
    ))
    and (student_id is null or exists (
      select 1 from public.students s
      where s.id = processing_jobs.student_id and s.project_id = processing_jobs.project_id
        and s.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "cards own rows" on public.generated_cards;
create policy "cards own rows" on public.generated_cards
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = generated_cards.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = generated_cards.project_id and p.owner_id = (select auth.uid())
    )
    and (student_id is null or exists (
      select 1 from public.students s
      where s.id = generated_cards.student_id and s.project_id = generated_cards.project_id
        and s.owner_id = (select auth.uid())
    ))
    and (template_id is null or exists (
      select 1 from public.templates t
      where t.id = generated_cards.template_id and t.project_id = generated_cards.project_id
        and t.owner_id = (select auth.uid())
    ))
    and (batch_id is null or exists (
      select 1 from public.batches b
      where b.id = generated_cards.batch_id and b.project_id = generated_cards.project_id
        and b.owner_id = (select auth.uid())
    ))
    and (photo_id is null or exists (
      select 1 from public.student_photos sp
      where sp.id = generated_cards.photo_id and sp.project_id = generated_cards.project_id
        and sp.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "batch_items_owner_select" on public.batch_generation_items;
drop policy if exists "batch_items_owner_insert" on public.batch_generation_items;
drop policy if exists "batch_items_owner_update" on public.batch_generation_items;
drop policy if exists "batch_items_owner_delete" on public.batch_generation_items;
create policy "batch items tenant select" on public.batch_generation_items
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batch_generation_items.project_id and p.owner_id = (select auth.uid())
    )
  );
create policy "batch items tenant insert" on public.batch_generation_items
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batch_generation_items.project_id and p.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.batches b where b.id = batch_generation_items.batch_id
        and b.project_id = batch_generation_items.project_id and b.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.students s where s.id = batch_generation_items.student_id
        and s.project_id = batch_generation_items.project_id and s.owner_id = (select auth.uid())
    )
  );
create policy "batch items tenant update" on public.batch_generation_items
  for update to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batch_generation_items.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batch_generation_items.project_id and p.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.batches b where b.id = batch_generation_items.batch_id
        and b.project_id = batch_generation_items.project_id and b.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.students s where s.id = batch_generation_items.student_id
        and s.project_id = batch_generation_items.project_id and s.owner_id = (select auth.uid())
    )
  );
create policy "batch items tenant delete" on public.batch_generation_items
  for delete to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = batch_generation_items.project_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "validation own rows" on public.validation_results;
create policy "validation own rows" on public.validation_results
  for all to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.generated_cards g
      join public.school_projects p on p.id = g.project_id
      where g.id = validation_results.generated_card_id
        and g.owner_id = (select auth.uid()) and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.generated_cards g
      join public.school_projects p on p.id = g.project_id
      where g.id = validation_results.generated_card_id
        and g.owner_id = (select auth.uid()) and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "card_validation_findings_owner_select" on public.card_validation_findings;
drop policy if exists "card_validation_findings_owner_insert" on public.card_validation_findings;
drop policy if exists "card_validation_findings_owner_update" on public.card_validation_findings;
create policy "findings tenant select" on public.card_validation_findings
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = card_validation_findings.project_id and p.owner_id = (select auth.uid())
    )
  );
create policy "findings tenant insert" on public.card_validation_findings
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = card_validation_findings.project_id and p.owner_id = (select auth.uid())
    )
    and (student_id is null or exists (
      select 1 from public.students s where s.id = card_validation_findings.student_id
        and s.project_id = card_validation_findings.project_id and s.owner_id = (select auth.uid())
    ))
    and (batch_id is null or exists (
      select 1 from public.batches b where b.id = card_validation_findings.batch_id
        and b.project_id = card_validation_findings.project_id and b.owner_id = (select auth.uid())
    ))
    and (generated_card_id is null or exists (
      select 1 from public.generated_cards g where g.id = card_validation_findings.generated_card_id
        and g.project_id = card_validation_findings.project_id and g.owner_id = (select auth.uid())
    ))
  );
create policy "findings tenant update" on public.card_validation_findings
  for update to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = card_validation_findings.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = card_validation_findings.project_id and p.owner_id = (select auth.uid())
    )
    and (student_id is null or exists (
      select 1 from public.students s where s.id = card_validation_findings.student_id
        and s.project_id = card_validation_findings.project_id and s.owner_id = (select auth.uid())
    ))
    and (batch_id is null or exists (
      select 1 from public.batches b where b.id = card_validation_findings.batch_id
        and b.project_id = card_validation_findings.project_id and b.owner_id = (select auth.uid())
    ))
    and (generated_card_id is null or exists (
      select 1 from public.generated_cards g where g.id = card_validation_findings.generated_card_id
        and g.project_id = card_validation_findings.project_id and g.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "exports_owner_select" on public.exports;
drop policy if exists "exports_owner_insert" on public.exports;
drop policy if exists "exports_owner_update" on public.exports;
drop policy if exists "exports_owner_delete" on public.exports;
create policy "exports tenant select" on public.exports
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = exports.project_id and p.owner_id = (select auth.uid())
    )
  );
create policy "exports tenant insert" on public.exports
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = exports.project_id and p.owner_id = (select auth.uid())
    ) and exists (
      select 1 from public.batches b where b.id = exports.batch_id
        and b.project_id = exports.project_id and b.owner_id = (select auth.uid())
    )
  );
create policy "exports tenant update" on public.exports
  for update to authenticated
  using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = exports.project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = exports.project_id and p.owner_id = (select auth.uid())
    ) and exists (
      select 1 from public.batches b where b.id = exports.batch_id
        and b.project_id = exports.project_id and b.owner_id = (select auth.uid())
    )
  );
create policy "exports tenant delete" on public.exports
  for delete to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.school_projects p
      where p.id = exports.project_id and p.owner_id = (select auth.uid())
    )
  );

-- Append-only audit history for application users. Admin/maintenance access is
-- separate; users cannot rewrite or erase their own historical security events.
drop policy if exists "audit own rows" on public.audit_logs;
create policy "audit tenant select" on public.audit_logs
  for select to authenticated using (
    owner_id = (select auth.uid()) and (
      project_id is null or exists (
        select 1 from public.school_projects p
        where p.id = audit_logs.project_id and p.owner_id = (select auth.uid())
      )
    )
  );
create policy "audit tenant insert" on public.audit_logs
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and (
      project_id is null or exists (
        select 1 from public.school_projects p
        where p.id = audit_logs.project_id and p.owner_id = (select auth.uid())
      )
    )
  );

-- Private object names follow <user UUID>/<project UUID>/<object path>.
-- Qualify the outer objects.name: unqualified name previously resolved to
-- school_projects.name inside the EXISTS subquery.
drop policy if exists "printforge photo delete owned project" on storage.objects;
drop policy if exists "printforge photo insert owned project" on storage.objects;
drop policy if exists "printforge photo select owned project" on storage.objects;
drop policy if exists "printforge photo update owned project" on storage.objects;
drop policy if exists "printforge storage delete own folder" on storage.objects;
drop policy if exists "printforge storage insert own folder" on storage.objects;
drop policy if exists "printforge storage select own folder" on storage.objects;
drop policy if exists "printforge storage update own folder" on storage.objects;

create policy "printforge tenant object select" on storage.objects
  for select to authenticated using (
    bucket_id = any (array[
      'printforge-templates','printforge-student-photos',
      'printforge-generated-cards','printforge-exports'
    ]::text[])
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = any (array[
      'printforge-templates','printforge-student-photos',
      'printforge-generated-cards','printforge-exports'
    ]::text[])
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object update" on storage.objects
  for update to authenticated
  using (
    bucket_id = any (array[
      'printforge-templates','printforge-student-photos',
      'printforge-generated-cards','printforge-exports'
    ]::text[])
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = any (array[
      'printforge-templates','printforge-student-photos',
      'printforge-generated-cards','printforge-exports'
    ]::text[])
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object delete" on storage.objects
  for delete to authenticated using (
    bucket_id = any (array[
      'printforge-templates','printforge-student-photos',
      'printforge-generated-cards','printforge-exports'
    ]::text[])
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );

commit;
