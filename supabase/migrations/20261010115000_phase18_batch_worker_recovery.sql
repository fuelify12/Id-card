-- Prompt 18: recover stale worker leases and make explicit retries atomic.
-- Apply only to a dedicated isolated Supabase test/development branch first.
-- Do not apply this migration to production as part of acceptance testing.

create or replace function public.claim_batch_generation_items(
  p_batch_id uuid,
  p_worker_id text,
  p_limit integer default 3
)
returns setof public.batch_generation_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_batch_status text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  -- Serialize claim decisions for this batch and reject stale/foreign callers.
  select b.owner_id, lower(b.status)
    into v_owner_id, v_batch_status
  from public.batches b
  join public.school_projects p on p.id = b.project_id
  where b.id = p_batch_id
    and b.owner_id = auth.uid()
    and p.owner_id = auth.uid()
  for update of b;

  if not found or v_owner_id is distinct from auth.uid() then
    raise exception 'batch access denied';
  end if;

  if v_batch_status not in ('queued', 'running') then
    raise exception 'batch is not claimable';
  end if;

  -- Request-triggered workers can die after claiming an item. Once the lease
  -- is older than five minutes, make the item recoverable. The worker endpoint
  -- has a 60-second maximum duration, so the lease exceeds one invocation.
  update public.batch_generation_items i
  set status = case when i.attempts >= i.max_attempts then 'FAILED' else 'PENDING' end,
      error_category = case when i.attempts >= i.max_attempts then 'unknown' else i.error_category end,
      error_summary = case
        when i.attempts >= i.max_attempts then 'Worker lease expired after maximum attempts.'
        else 'Recovered an expired worker lease; retry is scheduled.'
      end,
      available_at = case when i.attempts >= i.max_attempts then i.available_at else now() end,
      completed_at = case when i.attempts >= i.max_attempts then now() else null end,
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.project_id = (select b.project_id from public.batches b where b.id = p_batch_id)
    and i.owner_id = auth.uid()
    and i.status = 'PROCESSING'
    and coalesce(i.heartbeat_at, i.claimed_at, i.updated_at) < now() - interval '5 minutes';

  -- A crash at the last allowed attempt must not leave work permanently pending.
  update public.batch_generation_items i
  set status = 'FAILED',
      error_category = coalesce(i.error_category, 'unknown'),
      error_summary = coalesce(i.error_summary, 'Maximum worker attempts exhausted.'),
      completed_at = now(),
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.owner_id = auth.uid()
    and i.status = 'PENDING'
    and i.attempts >= i.max_attempts;

  return query
  with eligible as (
    select i.id
    from public.batch_generation_items i
    where i.batch_id = p_batch_id
      and i.owner_id = auth.uid()
      and i.status = 'PENDING'
      and i.attempts < i.max_attempts
      and i.available_at <= now()
    order by i.serial_number
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 8))
  )
  update public.batch_generation_items i
  set status = 'PROCESSING',
      claimed_at = now(),
      claimed_by = left(coalesce(p_worker_id, 'worker'), 100),
      heartbeat_at = now(),
      attempts = i.attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  from eligible e
  where i.id = e.id
  returning i.*;
end;
$$;

revoke all on function public.claim_batch_generation_items(uuid, text, integer) from public, anon;
grant execute on function public.claim_batch_generation_items(uuid, text, integer) to authenticated;

create or replace function public.retry_failed_batch_items(
  p_batch_id uuid,
  p_item_ids uuid[] default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select lower(b.status)
    into v_status
  from public.batches b
  join public.school_projects p on p.id = b.project_id
  where b.id = p_batch_id
    and b.owner_id = auth.uid()
    and p.owner_id = auth.uid()
  for update of b;

  if not found then
    raise exception 'batch access denied';
  end if;

  if v_status not in ('failed', 'completed_with_errors') then
    raise exception 'batch is not eligible for manual retry';
  end if;

  update public.batch_generation_items i
  set status = 'PENDING',
      attempts = 0,
      error_summary = null,
      error_category = null,
      completed_at = null,
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = null,
      available_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.owner_id = auth.uid()
    and i.status = 'FAILED'
    and (p_item_ids is null or i.id = any(p_item_ids));

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no failed items are eligible for retry';
  end if;

  update public.batches b
  set status = 'queued',
      completed_at = null,
      cancelled_at = null,
      paused_at = null,
      last_error = null,
      heartbeat_at = now()
  where b.id = p_batch_id
    and b.owner_id = auth.uid();

  return v_count;
end;
$$;

revoke all on function public.retry_failed_batch_items(uuid, uuid[]) from public, anon;
grant execute on function public.retry_failed_batch_items(uuid, uuid[]) to authenticated;
