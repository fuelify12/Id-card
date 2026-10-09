-- Owner-scoped work-item writes and atomic authenticated worker claims.
drop policy if exists batch_items_owner_insert on public.batch_generation_items;
create policy batch_items_owner_insert on public.batch_generation_items for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())) and exists(select 1 from public.batches b where b.id=batch_id and b.project_id=project_id and b.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_update on public.batch_generation_items;
create policy batch_items_owner_update on public.batch_generation_items for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_delete on public.batch_generation_items;
create policy batch_items_owner_delete on public.batch_generation_items for delete to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create or replace function public.claim_batch_generation_items(p_batch_id uuid,p_worker_id text,p_limit integer default 3)
returns setof public.batch_generation_items language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.batches b join public.school_projects p on p.id=b.project_id where b.id=p_batch_id and b.owner_id=auth.uid() and p.owner_id=auth.uid() and lower(b.status) in ('queued','running')) then raise exception 'batch access denied'; end if;
 return query with eligible as (
  select i.id from public.batch_generation_items i where i.batch_id=p_batch_id and i.owner_id=auth.uid() and i.status='PENDING' and i.available_at<=now()
  order by i.serial_number for update skip locked limit greatest(1,least(coalesce(p_limit,3),8))
 ) update public.batch_generation_items i set status='PROCESSING',claimed_at=now(),claimed_by=left(p_worker_id,100),heartbeat_at=now(),attempts=i.attempts+1,last_attempt_at=now(),updated_at=now()
 from eligible e where i.id=e.id returning i.*;
end $$;
revoke all on function public.claim_batch_generation_items(uuid,text,integer) from public,anon;
grant execute on function public.claim_batch_generation_items(uuid,text,integer) to authenticated,service_role;