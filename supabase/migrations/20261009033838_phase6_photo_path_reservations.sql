alter table public.batches add column if not exists photo_reservations jsonb not null default '{}'::jsonb;
create or replace function public.reserve_photo_upload(p_batch_id uuid,p_project_id uuid,p_path text,p_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_size<=0 or p_size>10485760 or p_path is null or length(p_path)>512 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size,photo_reservations=photo_reservations||jsonb_build_object(p_path,p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading'
   and not(photo_reservations ? p_path) and total_bytes+p_size<=524288000;
 return found;
end; $$;
create or replace function public.finalize_photo_upload(p_batch_id uuid,p_project_id uuid,p_path text,p_actual_size bigint)
returns boolean language plpgsql security invoker set search_path=public as $$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null or p_actual_size<=0 or p_actual_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes-reserved_size+p_actual_size,photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading'
   and total_bytes-reserved_size+p_actual_size<=524288000;
 return found;
end; $$;
create or replace function public.release_photo_upload(p_batch_id uuid,p_project_id uuid,p_path text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-reserved_size),photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $$;
revoke all on function public.reserve_photo_upload(uuid,uuid,text,bigint) from public;
revoke all on function public.finalize_photo_upload(uuid,uuid,text,bigint) from public;
revoke all on function public.release_photo_upload(uuid,uuid,text) from public;
grant execute on function public.reserve_photo_upload(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.finalize_photo_upload(uuid,uuid,text,bigint) to authenticated;
grant execute on function public.release_photo_upload(uuid,uuid,text) to authenticated;
