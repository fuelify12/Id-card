alter table public.batches add column if not exists total_bytes bigint not null default 0;
create or replace function public.reserve_photo_batch_bytes(p_batch_id uuid,p_project_id uuid,p_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_size<=0 or p_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid())
   and status='uploading' and total_bytes+p_size<=524288000;
 return found;
end; $$;
create or replace function public.release_photo_batch_bytes(p_batch_id uuid,p_project_id uuid,p_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_size<=0 then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $$;
revoke all on function public.reserve_photo_batch_bytes(uuid,uuid,bigint) from public;
revoke all on function public.release_photo_batch_bytes(uuid,uuid,bigint) from public;
grant execute on function public.reserve_photo_batch_bytes(uuid,uuid,bigint) to authenticated;
grant execute on function public.release_photo_batch_bytes(uuid,uuid,bigint) to authenticated;
