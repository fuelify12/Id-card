-- Keep Phase 18's claim/recovery logic and invoker permissions intact; only make ordering stable for text IDs.
begin;

create or replace function public.claim_batch_generation_items(
  p_batch_id uuid,
  p_worker_id text,
  p_limit integer default 3
)
returns setof public.batch_generation_items
language plpgsql
security invoker
set search_path=public
as $phase24worker$
declare
  v_owner_id uuid;
  v_batch_status text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;

  select b.owner_id,lower(b.status) into v_owner_id,v_batch_status
  from public.batches b join public.school_projects p on p.id=b.project_id
  where b.id=p_batch_id and b.owner_id=auth.uid() and p.owner_id=auth.uid()
  for update of b;

  if not found or v_owner_id is distinct from auth.uid() then raise exception 'batch access denied'; end if;
  if v_batch_status not in ('queued','running') then raise exception 'batch is not claimable'; end if;

  update public.batch_generation_items i
  set status=case when i.attempts>=i.max_attempts then 'FAILED' else 'PENDING' end,
      error_category=case when i.attempts>=i.max_attempts then 'unknown' else i.error_category end,
      error_summary=case when i.attempts>=i.max_attempts then 'Worker lease expired after maximum attempts.'
        else 'Recovered an expired worker lease; retry is scheduled.' end,
      available_at=case when i.attempts>=i.max_attempts then i.available_at else now() end,
      completed_at=case when i.attempts>=i.max_attempts then now() else null end,
      claimed_at=null,claimed_by=null,heartbeat_at=now(),updated_at=now()
  where i.batch_id=p_batch_id
    and i.project_id=(select b.project_id from public.batches b where b.id=p_batch_id)
    and i.owner_id=auth.uid() and i.status='PROCESSING'
    and coalesce(i.heartbeat_at,i.claimed_at,i.updated_at)<now()-interval '5 minutes';

  update public.batch_generation_items i
  set status='FAILED',error_category=coalesce(i.error_category,'unknown'),
      error_summary=coalesce(i.error_summary,'Maximum worker attempts exhausted.'),
      completed_at=now(),claimed_at=null,claimed_by=null,heartbeat_at=now(),updated_at=now()
  where i.batch_id=p_batch_id and i.owner_id=auth.uid()
    and i.status='PENDING' and i.attempts>=i.max_attempts;

  return query
  with eligible as (
    select i.id from public.batch_generation_items i
    where i.batch_id=p_batch_id and i.owner_id=auth.uid()
      and i.status='PENDING' and i.attempts<i.max_attempts and i.available_at<=now()
    order by coalesce(i.student_identifier,i.serial_number::text),i.id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,3),8))
  )
  update public.batch_generation_items i
  set status='PROCESSING',claimed_at=now(),claimed_by=left(coalesce(p_worker_id,'worker'),100),
      heartbeat_at=now(),attempts=i.attempts+1,last_attempt_at=now(),updated_at=now()
  from eligible e where i.id=e.id returning i.*;
end;
$phase24worker$;

revoke all on function public.claim_batch_generation_items(uuid,text,integer) from public,anon;
grant execute on function public.claim_batch_generation_items(uuid,text,integer) to authenticated;

commit;
