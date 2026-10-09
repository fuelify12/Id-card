-- Qualify outer work-item columns explicitly in RLS predicates to avoid ambiguous references.
drop policy if exists batch_items_owner_insert on public.batch_generation_items;
create policy batch_items_owner_insert on public.batch_generation_items for insert to authenticated
with check (owner_id=(select auth.uid())
 and exists(select 1 from public.school_projects p where p.id=batch_generation_items.project_id and p.owner_id=(select auth.uid()))
 and exists(select 1 from public.batches b where b.id=batch_generation_items.batch_id and b.project_id=batch_generation_items.project_id and b.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_update on public.batch_generation_items;
create policy batch_items_owner_update on public.batch_generation_items for update to authenticated
using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=batch_generation_items.project_id and p.owner_id=(select auth.uid())))
with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=batch_generation_items.project_id and p.owner_id=(select auth.uid())));
drop policy if exists batch_items_owner_delete on public.batch_generation_items;
create policy batch_items_owner_delete on public.batch_generation_items for delete to authenticated
using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=batch_generation_items.project_id and p.owner_id=(select auth.uid())));