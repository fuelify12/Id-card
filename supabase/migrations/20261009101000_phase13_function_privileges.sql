-- Remove inherited PUBLIC execute grants from application functions.
-- Explicit grants to authenticated/service_role are preserved.
begin;
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
commit;
