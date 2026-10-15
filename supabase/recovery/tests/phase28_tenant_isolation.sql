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

insert into public.school_projects (id,owner_id,name,school_name,status,student_identifier_settings)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Phase28 synthetic tenant A project','Phase28 Synthetic School A','draft','{"normalization":"exact","case_sensitive":true,"edge_whitespace":"reject","max_length":64}'::jsonb),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Phase28 synthetic tenant B project','Phase28 Synthetic School B','draft','{"normalization":"exact","case_sensitive":true,"edge_whitespace":"reject","max_length":64}'::jsonb);

insert into public.students
 (id,project_id,owner_id,serial_number,data,student_identifier,student_identifier_unique,student_identifier_source,student_identifier_review_required)
values
 ('aaaa0001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',1,'{"student_name":"Synthetic Student A"}'::jsonb,'001','001','explicit_import',false),
 ('bbbb0001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',1,'{"student_name":"Synthetic Student B"}'::jsonb,'001','001','explicit_import',false);

insert into public.templates (id,project_id,owner_id,name,source_type,analysis_status,version_number)
values
 ('aaaa1001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic template A','png','confirmed',1),
 ('bbbb1001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic template B','png','confirmed',1);

insert into public.template_fields (id,template_id,owner_id,key,label,field_type,required,sort_order)
values
 ('aaaa2001-1111-4111-8111-111111111111','aaaa1001-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','student_name','Student name','text',true,1),
 ('bbbb2001-2222-4222-8222-222222222222','bbbb1001-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','student_name','Student name','text',true,1);

insert into public.batches (id,project_id,owner_id,name,template_id,template_version,requested_by,status,total_count)
values
 ('aaaa3001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic batch A','aaaa1001-1111-4111-8111-111111111111',1,'11111111-1111-4111-8111-111111111111','queued',1),
 ('bbbb3001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic batch B','bbbb1001-2222-4222-8222-222222222222',1,'22222222-2222-4222-8222-222222222222','queued',1);

insert into public.student_photos
 (id,project_id,owner_id,student_id,serial_number,storage_path,original_filename,mime_type,match_status,original_serial_number,normalized_serial_number,student_identifier,processing_status)
values
 ('aaaa5001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaa0001-1111-4111-8111-111111111111',1,'11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/001.jpg','001.jpg','image/jpeg','MATCHED','001','001','001','READY_FOR_REVIEW'),
 ('bbbb5001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbb0001-2222-4222-8222-222222222222',1,'22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/001.jpg','001.jpg','image/jpeg','MATCHED','001','001','001','READY_FOR_REVIEW');

insert into public.batch_generation_items
 (id,batch_id,project_id,owner_id,student_id,serial_number,student_name,status,student_identifier)
values
 ('aaaa4001-1111-4111-8111-111111111111','aaaa3001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaa0001-1111-4111-8111-111111111111',1,'Synthetic Student A','PENDING','001'),
 ('bbbb4001-2222-4222-8222-222222222222','bbbb3001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbb0001-2222-4222-8222-222222222222',1,'Synthetic Student B','PENDING','001');

insert into public.generated_cards
 (id,batch_id,project_id,owner_id,student_id,serial_number,filename,status,validation_status,template_id,template_version,photo_id,student_identifier)
values
 ('aaaa6001-1111-4111-8111-111111111111','aaaa3001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaa0001-1111-4111-8111-111111111111',1,'001.png','generated','passed','aaaa1001-1111-4111-8111-111111111111',1,'aaaa5001-1111-4111-8111-111111111111','001'),
 ('bbbb6001-2222-4222-8222-222222222222','bbbb3001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbb0001-2222-4222-8222-222222222222',1,'001.png','generated','passed','bbbb1001-2222-4222-8222-222222222222',1,'bbbb5001-2222-4222-8222-222222222222','001');

insert into public.processing_jobs
 (id,batch_id,project_id,owner_id,student_id,serial_number,status,student_identifier)
values
 ('aaaa7001-1111-4111-8111-111111111111','aaaa3001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaa0001-1111-4111-8111-111111111111',1,'queued','001'),
 ('bbbb7001-2222-4222-8222-222222222222','bbbb3001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbb0001-2222-4222-8222-222222222222',1,'queued','001');

insert into public.exports (id,batch_id,project_id,owner_id,storage_path,filename,status,selected_count,eligible_count,packaged_file_count)
values
 ('aaaa8001-1111-4111-8111-111111111111','aaaa3001-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaa8001-1111-4111-8111-111111111111/export.zip','synthetic-a.zip','completed',1,1,1),
 ('bbbb8001-2222-4222-8222-222222222222','bbbb3001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbb8001-2222-4222-8222-222222222222/export.zip','synthetic-b.zip','completed',1,1,1);

insert into storage.objects (bucket_id,name,owner_id,metadata)
values
 ('printforge-student-photos','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/001.jpg','11111111-1111-4111-8111-111111111111','{"mimetype":"image/jpeg","size":1}'::jsonb),
 ('printforge-student-photos','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/001.jpg','22222222-2222-4222-8222-222222222222','{"mimetype":"image/jpeg","size":1}'::jsonb),
 ('printforge-exports','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaa8001-1111-4111-8111-111111111111/export.zip','11111111-1111-4111-8111-111111111111','{"mimetype":"application/zip","size":1}'::jsonb),
 ('printforge-exports','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbb8001-2222-4222-8222-222222222222/export.zip','22222222-2222-4222-8222-222222222222','{"mimetype":"application/zip","size":1}'::jsonb);

-- Exercise every documented export lifecycle status. Restore Tenant A's row to completed for the RPC checks.
do $phase28_export_statuses$
declare s text; n integer;
begin
  foreach s in array array['pending','queued','running','verifying','ready','completed','completed_with_errors','failed','cancelled','expired'] loop
    update public.exports set status=s,updated_at=now() where id='aaaa8001-1111-4111-8111-111111111111';
    get diagnostics n = row_count;
    if n<>1 then raise exception 'Could not transition isolated export into status %',s; end if;
  end loop;
  update public.exports set status='completed',updated_at=now() where id='aaaa8001-1111-4111-8111-111111111111';
end;
$phase28_export_statuses$;



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
  select count(*) into n from public.templates; if n <> 1 then raise exception 'Tenant A should see exactly its template'; end if;
  select count(*) into n from public.template_fields; if n <> 1 then raise exception 'Tenant A should see exactly its template field'; end if;
  select count(*) into n from public.batches; if n <> 1 then raise exception 'Tenant A should see exactly its batch'; end if;
  select count(*) into n from public.batch_generation_items; if n <> 1 then raise exception 'Tenant A should see exactly its batch item'; end if;
  select count(*) into n from public.student_photos; if n <> 1 then raise exception 'Tenant A should see exactly its photo row'; end if;
  select count(*) into n from public.generated_cards; if n <> 1 then raise exception 'Tenant A should see exactly its generated card'; end if;
  select count(*) into n from public.processing_jobs; if n <> 1 then raise exception 'Tenant A should see exactly its processing job'; end if;
  select count(*) into n from public.exports; if n <> 1 then raise exception 'Tenant A should see exactly its export'; end if;
  select count(*) into n from storage.objects where bucket_id='printforge-exports' and name like '22222222-2222-4222-8222-222222222222/%';
  if n <> 0 then raise exception 'Tenant A can see Tenant B private export metadata'; end if;
  update public.templates set name='tampered template' where id='bbbb1001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B template'; end if;
  delete from public.templates where id='bbbb1001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B template'; end if;
  update public.template_fields set label='tampered field' where id='bbbb2001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B template field'; end if;
  delete from public.template_fields where id='bbbb2001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B template field'; end if;
  update public.batches set name='tampered batch' where id='bbbb3001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B batch'; end if;
  delete from public.batches where id='bbbb3001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B batch'; end if;
  update public.batch_generation_items set student_name='tampered item' where id='bbbb4001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B batch item'; end if;
  delete from public.batch_generation_items where id='bbbb4001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B batch item'; end if;
  update public.student_photos set original_filename='tampered photo.jpg' where id='bbbb5001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B photo row'; end if;
  delete from public.student_photos where id='bbbb5001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B photo row'; end if;
  update public.generated_cards set filename='tampered.png' where id='bbbb6001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B generated card'; end if;
  delete from public.generated_cards where id='bbbb6001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B generated card'; end if;
  update public.processing_jobs set status='failed' where id='bbbb7001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B processing job'; end if;
  delete from public.processing_jobs where id='bbbb7001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B processing job'; end if;
  update public.exports set filename='tampered.zip' where id='bbbb8001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B export'; end if;
  delete from public.exports where id='bbbb8001-2222-4222-8222-222222222222'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A deleted Tenant B export'; end if;
  update storage.objects set metadata='{"tampered":true}'::jsonb where bucket_id='printforge-exports' and name like '22222222-2222-4222-8222-222222222222/%'; get diagnostics n=row_count; if n<>0 then raise exception 'Tenant A modified Tenant B export object'; end if;
  -- Supabase's storage.protect_delete() requires deletion through the Storage API; do not DELETE storage.objects directly.
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
  blocked := false;
  begin
    insert into public.exports (id,batch_id,project_id,owner_id,filename,status)
    values ('cccc8001-3333-4333-8333-333333333333','bbbb3001-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','forged.zip','completed');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Tenant A forged a Tenant B export'; end if;
  blocked := false;
  begin
    perform public.record_export_download_link_issued('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbb8001-2222-4222-8222-222222222222');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Tenant A invoked Tenant B export download-audit RPC'; end if;
end;
$phase28$;

reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $phase28$
declare n integer; blocked boolean := false;
begin
  if auth.uid() <> '22222222-2222-4222-8222-222222222222'::uuid then raise exception 'Tenant B subject simulation failed'; end if;
  select count(*) into n from public.school_projects;
  if n <> 1 then raise exception 'Tenant B saw % projects; expected 1',n; end if;
  select count(*) into n from public.students;
  if n <> 1 then raise exception 'Tenant B saw % students; expected 1',n; end if;
  select count(*) into n from public.templates; if n <> 1 then raise exception 'Tenant B should see exactly its template'; end if;
  select count(*) into n from public.template_fields; if n <> 1 then raise exception 'Tenant B should see exactly its template field'; end if;
  select count(*) into n from public.batches; if n <> 1 then raise exception 'Tenant B should see exactly its batch'; end if;
  select count(*) into n from public.batch_generation_items; if n <> 1 then raise exception 'Tenant B should see exactly its batch item'; end if;
  select count(*) into n from public.student_photos; if n <> 1 then raise exception 'Tenant B should see exactly its photo row'; end if;
  select count(*) into n from public.generated_cards; if n <> 1 then raise exception 'Tenant B should see exactly its generated card'; end if;
  select count(*) into n from public.processing_jobs; if n <> 1 then raise exception 'Tenant B should see exactly its processing job'; end if;
  select count(*) into n from public.exports; if n <> 1 then raise exception 'Tenant B should see exactly its export'; end if;
  select count(*) into n from storage.objects where bucket_id='printforge-student-photos' and name like '22222222-2222-4222-8222-222222222222/%';
  if n <> 1 then raise exception 'Tenant B cannot see its own private photo metadata'; end if;
  select count(*) into n from storage.objects where name like '11111111-1111-4111-8111-111111111111/%';
  if n <> 0 then raise exception 'Tenant B can see Tenant A private photo metadata'; end if;
  select count(*) into n from storage.objects where bucket_id='printforge-exports' and name like '22222222-2222-4222-8222-222222222222/%';
  if n <> 1 then raise exception 'Tenant B cannot see its own private export metadata'; end if;
  select count(*) into n from storage.objects where bucket_id='printforge-exports' and name like '11111111-1111-4111-8111-111111111111/%';
  if n <> 0 then raise exception 'Tenant B can see Tenant A private export metadata'; end if;
  if not public.record_export_download_link_issued('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbb8001-2222-4222-8222-222222222222') then
    raise exception 'Tenant B could not issue its own export download audit event';
  end if;
  blocked := false;
  begin
    perform public.record_export_download_link_issued('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaa8001-1111-4111-8111-111111111111');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Tenant B invoked Tenant A export download-audit RPC'; end if;
end;
$phase28$;
reset role;
rollback;
select 'PASS: synthetic Tenant A/B RLS assertions passed; all fixtures rolled back' as result;
