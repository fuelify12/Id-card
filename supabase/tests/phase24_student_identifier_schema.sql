-- Run only against an isolated database after applying the Phase 24 migration.
-- Read-only assertions; no student or storage data is inserted or modified.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='students' and column_name='student_identifier' and data_type='text'
  ) then raise exception 'students.student_identifier must exist as text'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='school_projects' and column_name='student_identifier_settings' and data_type='jsonb'
  ) then raise exception 'school_projects.student_identifier_settings must exist'; end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name='student_identifier_review_required' and data_type='boolean'
  ) then raise exception 'legacy identifier review flag must exist'; end if;
  if not exists (
    select 1 from information_schema.routines where routine_schema='public' and routine_name='correct_student_identifier'
  ) then raise exception 'transactional identifier correction RPC is missing'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='students_project_student_identifier_key'
      and replace(indexdef,' ','') like '%(project_id,student_identifier)%'
  ) then raise exception 'project-scoped canonical identifier unique index is missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='batch_items_batch_student_identifier_key') then
    raise exception 'batch item canonical identifier unique index is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='generated_cards_batch_student_identifier_key') then
    raise exception 'generated card canonical identifier unique index is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='processing_jobs' and column_name='student_identifier' and data_type='text'
  ) then raise exception 'processing_jobs.student_identifier must exist'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='idx_processing_jobs_batch_identifier') then
    raise exception 'processing job canonical identifier lookup index is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='students' and c.relrowsecurity
  ) then raise exception 'student row-level security must remain enabled'; end if;
  if exists (select 1 from public.students where student_identifier is null) then
    raise exception 'backfill left student rows without a canonical identifier';
  end if;
end $$;
