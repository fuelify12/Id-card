create unique index if not exists uq_student_photos_storage_path on public.student_photos(storage_path);
drop policy if exists "printforge storage select own folder" on storage.objects;
drop policy if exists "printforge storage insert own folder" on storage.objects;
drop policy if exists "printforge storage update own folder" on storage.objects;
drop policy if exists "printforge storage delete own folder" on storage.objects;
create policy "printforge storage select own folder" on storage.objects for select to authenticated using (
 bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())))
);
create policy "printforge storage insert own folder" on storage.objects for insert to authenticated with check (
 bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())))
);
create policy "printforge storage update own folder" on storage.objects for update to authenticated using (
 bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())))
) with check (
 bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())))
);
create policy "printforge storage delete own folder" on storage.objects for delete to authenticated using (
 bucket_id in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'printforge-student-photos' or exists(select 1 from public.school_projects p where p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid())))
);
