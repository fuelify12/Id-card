-- Read-only post-migration assertions. Run against a Supabase test branch first.
-- This verifies configuration, not cross-account CRUD; that requires synthetic auth users.
do $$
declare
  v_tables integer;
  v_rls integer;
  v_bad_storage integer;
  v_bad_audit integer;
  v_triggers integer;
  v_constraints integer;
  v_public_buckets integer;
  v_unvalidated_constraints integer;
  v_public_function_exec integer;
begin
  select count(*), count(*) filter (where c.relrowsecurity)
    into v_tables, v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
  if v_tables = 0 or v_tables <> v_rls then
    raise exception 'RLS assertion failed: % of % public tables have RLS enabled', v_rls, v_tables;
  end if;

  select count(*) into v_bad_storage
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'printforge tenant object %'
     and (coalesce(qual, '') || coalesce(with_check, '')) not like '%storage.foldername(objects.name)%';
  if v_bad_storage <> 0 then
    raise exception 'Storage path assertion failed: % tenant policies do not qualify the object path', v_bad_storage;
  end if;

  select count(*) into v_bad_audit
    from pg_policies
   where schemaname = 'public' and tablename = 'audit_logs'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if v_bad_audit <> 0 then
    raise exception 'Audit policy assertion failed: client write policies remain';
  end if;

  select count(*) into v_triggers from pg_trigger
   where not tgisinternal and tgname like 'security_audit_%';
  if v_triggers < 10 then
    raise exception 'Audit trigger assertion failed: expected at least 10, found %', v_triggers;
  end if;

  select count(*) into v_constraints from pg_constraint
   where conname like '%security_fkey' and connamespace = 'public'::regnamespace;
  if v_constraints < 10 then
    raise exception 'Tenant integrity assertion failed: expected at least 10 composite constraints, found %', v_constraints;
  end if;

  if not exists (select 1 from pg_class where oid = 'public.security_rate_limits'::regclass and relrowsecurity) then
    raise exception 'Rate-limit table assertion failed: RLS is not enabled';
  end if;
  if has_table_privilege('authenticated', 'public.security_rate_limits', 'SELECT')
     or has_table_privilege('authenticated', 'public.security_rate_limits', 'INSERT')
     or has_table_privilege('authenticated', 'public.security_rate_limits', 'UPDATE')
     or has_table_privilege('authenticated', 'public.security_rate_limits', 'DELETE') then
    raise exception 'Rate-limit table assertion failed: client table privileges remain';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'consume_security_rate_limit'
      and p.prosecdef
      and array_to_string(p.proconfig, ',') like '%search_path=pg_catalog, public%'
  ) then
    raise exception 'Rate-limit function assertion failed: SECURITY DEFINER or safe search_path is missing';
  end if;

  if position('p_limit is distinct from v_limit' in pg_get_functiondef('public.consume_security_rate_limit(text,integer,integer)'::regprocedure)) = 0
     or position('p_window_seconds is distinct from v_window_seconds' in pg_get_functiondef('public.consume_security_rate_limit(text,integer,integer)'::regprocedure)) = 0
     or position('photo_processing' in pg_get_functiondef('public.consume_security_rate_limit(text,integer,integer)'::regprocedure)) = 0 then
    raise exception 'Rate-limit function assertion failed: caller-supplied quotas are not pinned to trusted limits';
  end if;

  select count(*) into v_public_function_exec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_public_function_exec <> 0 then
    raise exception 'Function privilege assertion failed: anonymous role can execute % public functions', v_public_function_exec;
  end if;

  select count(*) into v_unvalidated_constraints
    from pg_constraint
   where connamespace = 'public'::regnamespace
     and conname like '%security_fkey' and not convalidated;
  if v_unvalidated_constraints <> 0 then
    raise exception 'Tenant integrity assertion failed: % constraints remain unvalidated', v_unvalidated_constraints;
  end if;

  select count(*) into v_public_buckets from storage.buckets
   where name in ('printforge-templates','printforge-student-photos','printforge-generated-cards','printforge-exports')
     and public = true;
  if v_public_buckets <> 0 then
    raise exception 'Private bucket assertion failed: a student asset bucket is public';
  end if;
end $$;
