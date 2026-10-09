-- Prevent newly created postgres-owned public-schema functions from
-- inheriting EXECUTE for PUBLIC. Existing functions were already revoked.
begin;
alter default privileges for role postgres
  revoke execute on functions from public;
commit;
