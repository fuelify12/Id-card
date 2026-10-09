-- Phase 13: shared database-backed rate limiting for expensive authenticated actions.
-- Atomic per-account fixed windows work across serverless instances; no client table access.
create table if not exists public.security_rate_limits (
  owner_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('project_create','template_upload','student_import','photo_upload_ticket','batch_generate','zip_export')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (owner_id, action)
);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_security_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid;
  v_count integer;
  v_reset boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;
  if p_action not in ('project_create','template_upload','student_import','photo_upload_ticket','batch_generate','zip_export')
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.security_rate_limits(owner_id, action, window_started_at, request_count)
  values (v_uid, p_action, now(), 1)
  on conflict (owner_id, action) do update
  set window_started_at = case
        when public.security_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now()
        else public.security_rate_limits.window_started_at
      end,
      request_count = case
        when public.security_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1
        else public.security_rate_limits.request_count + 1
      end
  returning request_count, window_started_at = now() into v_count, v_reset;

  return v_count <= p_limit;
end;
$$;
revoke all on function public.consume_security_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_security_rate_limit(text, integer, integer) to authenticated;
