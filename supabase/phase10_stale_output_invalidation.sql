-- Phase 10: input edits invalidate pinned templates and versioned photo derivatives.
create or replace function public.bump_template_version_for_field_change()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='INSERT' then
   update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   return new;
 elsif tg_op='DELETE' then
   update public.templates set version_number=version_number+1,updated_at=now() where id=old.template_id;
   return old;
 else
   if old.template_id=new.template_id then
     update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   else
     update public.templates set version_number=version_number+1,updated_at=now() where id=old.template_id;
     update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   end if;
   return new;
 end if;
end $$;
drop trigger if exists trg_template_fields_version_invalidation on public.template_fields;
create trigger trg_template_fields_version_invalidation after insert or update or delete on public.template_fields for each row execute function public.bump_template_version_for_field_change();
