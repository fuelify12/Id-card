-- Phase 28 recovery control: restore the current custom RLS-enforcement event trigger.
-- Source catalog: Production read-only pg_event_trigger entry "ensure_rls".
-- This function automatically enables RLS on subsequently created public tables.
-- Apply only to isolated project zzecjgauhkaxyptsurlw; never run on Production as a test.
begin;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
commit;
