-- Phase 28 isolated custom RLS DDL event-trigger smoke test.
-- The probe table and all DDL roll back; run only on isolated project zzecjgauhkaxyptsurlw.

begin;
create table public.phase28_rls_event_trigger_probe (id uuid primary key);
do $phase28$
begin
  if not exists (
    select 1 from pg_class
    where oid='public.phase28_rls_event_trigger_probe'::regclass and relrowsecurity
  ) then
    raise exception 'ensure_rls event trigger did not enable RLS on a newly created public table';
  end if;
end;
$phase28$;
rollback;
select 'PASS: ensure_rls automatically enabled RLS; probe table rolled back' as result;
