-- Phase 28 isolated database-only RLS acceptance test.
-- This script uses short-lived synthetic fixtures and rolls every write back.
-- Run only on verified isolated project zzecjgauhkaxyptsurlw; never Production.
-- The request JWT subject is simulated through request.jwt.claim.sub under the authenticated DB role.
-- This proves PostgreSQL RLS behavior, not a real GoTrue login or browser session.

begin;
insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','phase28-tenant-a@example.invalid',null,now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Phase28 Synthetic Tenant A"}'::jsonb,now(),now(),false,false),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','phase28-tenant-b@example.invalid',null,now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Phase28 Synthetic Tenant B"}'::jsonb,now(),now(),false,false);

insert into public.school_projects (id,owner_id,name,school_name,status)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Phase28 synthetic tenant A project','Phase28 Synthetic School A','draft'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Phase28 synthetic tenant B project','Phase28 Synthetic School B','draft');

insert into public.students
 (id,project_id,owner_id,serial_number,data,student_identifier,student_identifier_unique,student_identifier_source,student_identifier_review_required)
values
 ('aaaa0001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',1,'{"student_name":"Synthetic Student A"}'::jsonb,'001','001','explicit_import',false),
 ('bbbb0001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',1,'{"student_name":"Synthetic Student B"}'::jsonb,'001','001','explicit_import',false);

insert into storage.objects (bucket_id,name,owner_id,metadata)
values
 ('printforge-student-photos','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/001.jpg','11111111-1111-4111-8111-111111111111','{"mimetype":"image/jpeg","size":1}'::jsonb),
 ('printforge-student-photos','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/001.jpg','22222222-2222-4222-8222-222222222222','{"mimetype":"image/jpeg","size":1}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $phase28$
declare n integer; blocked boolean := false;
begin
  if auth.uid() <> '11111111-1111-4111-8111-111111111111'::uuid then raise exception 'Tenant A subject simulation failed'; end if;
  select count(*) into n from public.school_projects;
  if n <> 1 then raise exception 'Tenant A saw % projects; expected 1',n; end if;
  select count(*) into n from public.school_projects where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if n <> 0 then raise exception 'Tenant A can see Tenant B project'; end if;
  select count(*) into n from public.students;
  if n <> 1 then raise exception 'Tenant A saw % students; expected 1',n; end if;
  select count(*) into n from public.students where id='bbbb0001-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'Tenant A can see Tenant B student'; end if;
  update public.students set data=data || '{"tampered_by":"tenant-a"}'::jsonb where id='bbbb0001-2222-4222-8222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Tenant A modified Tenant B student'; end if;
  delete from public.students where id='bbbb0001-2222-4222-8222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Tenant A deleted Tenant B student'; end if;
  begin
    insert into public.school_projects(id,owner_id,name,school_name,status)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','forged by A','Forged tenant','draft');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Tenant A inserted a project owned by Tenant B'; end if;
  select count(*) into n from storage.objects where name like '22222222-2222-4222-8222-222222222222/%';
  if n <> 0 then raise exception 'Tenant A can see Tenant B private photo metadata'; end if;
  update storage.objects set metadata='{"tampered":true}'::jsonb where name like '22222222-2222-4222-8222-222222222222/%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Tenant A modified Tenant B private photo metadata'; end if;
  blocked := false;
  begin
    insert into storage.objects (bucket_id,name,owner_id,metadata)
    values ('printforge-student-photos','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/forged.jpg',
      '22222222-2222-4222-8222-222222222222','{"mimetype":"image/jpeg","size":1}'::jsonb);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Tenant A inserted cross-tenant private photo metadata'; end if;
end;
$phase28$;

reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $phase28$
declare n integer;
begin
  if auth.uid() <> '22222222-2222-4222-8222-222222222222'::uuid then raise exception 'Tenant B subject simulation failed'; end if;
  select count(*) into n from public.school_projects;
  if n <> 1 then raise exception 'Tenant B saw % projects; expected 1',n; end if;
  select count(*) into n from public.students;
  if n <> 1 then raise exception 'Tenant B saw % students; expected 1',n; end if;
  select count(*) into n from storage.objects where name like '22222222-2222-4222-8222-222222222222/%';
  if n <> 1 then raise exception 'Tenant B cannot see its own private photo metadata'; end if;
  select count(*) into n from storage.objects where name like '11111111-1111-4111-8111-111111111111/%';
  if n <> 0 then raise exception 'Tenant B can see Tenant A private photo metadata'; end if;
end;
$phase28$;
reset role;
rollback;
select 'PASS: synthetic Tenant A/B RLS assertions passed; all fixtures rolled back' as result;
