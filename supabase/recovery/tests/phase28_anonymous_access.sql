-- Phase 28 isolated anonymous-access denial test.
-- Synthetic test fixtures exist only inside this transaction; all writes roll back.
-- Run only on verified isolated project zzecjgauhkaxyptsurlw; never Production.

begin;
insert into auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
values
 ('33333333-3333-4333-8333-333333333333','authenticated','authenticated','phase28-anon-probe@example.invalid',null,now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Phase28 Anonymous Probe"}'::jsonb,now(),now(),false,false);
insert into public.school_projects (id,owner_id,name,school_name,status)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','33333333-3333-4333-8333-333333333333','Phase28 anonymous RLS probe','Phase28 anonymous probe','draft');
insert into storage.objects (bucket_id,name,owner_id,metadata)
values ('printforge-exports','33333333-3333-4333-8333-333333333333/dddddddd-dddd-4ddd-8ddd-dddddddddddd/probe.zip',
        '33333333-3333-4333-8333-333333333333','{"mimetype":"application/zip","size":1}'::jsonb);
set local role anon;
do $phase28$
declare n integer; blocked boolean := false;
begin
  begin
    execute 'select count(*) from public.school_projects' into n;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous role unexpectedly has SQL SELECT privilege on school_projects'; end if;
  select count(*) into n from storage.objects where name like '33333333-3333-4333-8333-333333333333/%';
  if n <> 0 then raise exception 'Anonymous role can see private PrintForge storage object metadata'; end if;
end;
$phase28$;
reset role;
rollback;
select 'PASS: anon denied project table privilege and private object metadata; fixture rolled back' as result;
