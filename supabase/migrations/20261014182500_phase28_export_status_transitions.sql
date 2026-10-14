-- Phase 28: make export status validation match the existing export worker lifecycle.
-- Snapshot inspection found the historical check allowed only queued/ready/failed, while the
-- current route transitions exports through running/verifying/completed/completed_with_errors/expired.
-- This is a forward-only schema correction; do not rewrite historical migration files.
begin;
alter table public.exports drop constraint if exists exports_status_check;
alter table public.exports add constraint exports_status_check check (
  status in (
    'pending','queued','running','verifying','ready',
    'completed','completed_with_errors','failed','cancelled','expired'
  )
);
commit;
