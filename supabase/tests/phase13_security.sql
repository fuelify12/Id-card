-- Phase 13 database security regression checks.
-- Run against an isolated Supabase project after applying all migrations:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase13_security.sql
-- This script is read-only and creates no fixtures or student data.
begin;
do $security_checks$
declare
  missing_rls text;
  public_bucket text;
  bad_storage_policy text;
  mutable_audit_policy text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise exception 'Public tables without RLS: %', missing_rls;
  end if;

  if has_table_privilege('anon', 'public.school_projects', 'SELECT')
     or has_table_privilege('anon', 'public.students', 'SELECT')
     or has_table_privilege('anon', 'public.student_photos', 'SELECT') then
    raise exception 'Anonymous role has direct table access';
  end if;

  if has_table_privilege('authenticated', 'public.school_projects', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.school_projects', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.school_projects', 'REFERENCES')
     or has_table_privilege('anon', 'public.school_projects', 'TRUNCATE') then
    raise exception 'Unnecessary high-risk table privileges remain';
  end if;

  if has_function_privilege('anon', 'public.reserve_photo_upload(uuid,uuid,text,bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.finalize_photo_upload(uuid,uuid,text,bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') then
    raise exception 'Anonymous role can execute a protected application function';
  end if;

  select string_agg(b.name, ', ')
    into public_bucket
  from storage.buckets b
  where b.name in (
    'printforge-templates',
    'printforge-student-photos',
    'printforge-generated-cards',
    'printforge-exports'
  ) and b.public;

  if public_bucket is not null then
    raise exception 'Sensitive storage buckets are public: %', public_bucket;
  end if;

  select string_agg(policyname, ', ')
    into bad_storage_policy
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname like 'printforge tenant object %'
    and coalesce(qual, '') || coalesce(with_check, '') like '%foldername(p.name)%';

  if bad_storage_policy is not null then
    raise exception 'Storage policy has an unqualified/wrong project path lookup: %', bad_storage_policy;
  end if;

  select string_agg(policyname, ', ')
    into mutable_audit_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'audit_logs'
    and cmd in ('ALL', 'UPDATE', 'DELETE');

  if mutable_audit_policy is not null then
    raise exception 'Application audit log can be rewritten or deleted: %', mutable_audit_policy;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'students'
      and cmd = 'ALL'
      and qual like '%school_projects%'
      and with_check like '%school_projects%'
  ) then
    raise exception 'Student tenant ownership policy is missing';
  end if;

  raise notice 'Phase 13 catalog security checks passed';
end
$security_checks$;
rollback;
