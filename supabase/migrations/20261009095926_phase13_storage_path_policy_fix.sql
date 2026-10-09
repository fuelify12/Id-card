-- Phase 13 follow-up: explicitly qualify the outer storage.objects.name column.
-- The unqualified name can resolve to school_projects.name inside the EXISTS subquery.
drop policy if exists "printforge tenant object select" on storage.objects;
drop policy if exists "printforge tenant object insert" on storage.objects;
drop policy if exists "printforge tenant object update" on storage.objects;
drop policy if exists "printforge tenant object delete" on storage.objects;

create policy "printforge tenant object select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
create policy "printforge tenant object delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
    and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.school_projects p
      where p.id::text = (storage.foldername(storage.objects.name))[2]
        and p.owner_id = (select auth.uid())
    )
  );
