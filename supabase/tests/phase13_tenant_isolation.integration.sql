-- Cross-tenant RLS integration test for a DISPOSABLE / ISOLATED Supabase project only.
-- Requires a privileged database connection. All fixtures are synthetic and rolled back.
-- Never run this against production. Example:
-- psql "$ISOLATED_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase13_tenant_isolation.integration.sql

begin;

select set_config('phase13.user_a', gen_random_uuid()::text, true);
select set_config('phase13.user_b', gen_random_uuid()::text, true);
select set_config('phase13.project_a', gen_random_uuid()::text, true);
select set_config('phase13.project_b', gen_random_uuid()::text, true);
select set_config('phase13.student_a', gen_random_uuid()::text, true);
select set_config('phase13.template_a', gen_random_uuid()::text, true);
select set_config('phase13.template_field_a', gen_random_uuid()::text, true);
select set_config('phase13.photo_a', gen_random_uuid()::text, true);
select set_config('phase13.batch_a', gen_random_uuid()::text, true);
select set_config('phase13.job_a', gen_random_uuid()::text, true);
select set_config('phase13.card_a', gen_random_uuid()::text, true);
select set_config('phase13.validation_a', gen_random_uuid()::text, true);
select set_config('phase13.finding_a', gen_random_uuid()::text, true);
select set_config('phase13.batch_item_a', gen_random_uuid()::text, true);
select set_config('phase13.export_a', gen_random_uuid()::text, true);
select set_config('phase13.object_a', gen_random_uuid()::text, true);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  (current_setting('phase13.user_a')::uuid, 'authenticated', 'authenticated',
   current_setting('phase13.user_a') || '@phase13.invalid', 'test-only-not-a-password', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (current_setting('phase13.user_b')::uuid, 'authenticated', 'authenticated',
   current_setting('phase13.user_b') || '@phase13.invalid', 'test-only-not-a-password', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into public.school_projects (id, owner_id, name, school_name)
values
  (current_setting('phase13.project_a')::uuid, current_setting('phase13.user_a')::uuid, 'Synthetic tenant A', 'Synthetic School A'),
  (current_setting('phase13.project_b')::uuid, current_setting('phase13.user_b')::uuid, 'Synthetic tenant B', 'Synthetic School B');

insert into public.students (id, project_id, owner_id, serial_number, data)
values (current_setting('phase13.student_a')::uuid, current_setting('phase13.project_a')::uuid,
        current_setting('phase13.user_a')::uuid, 1, '{"test_fixture":true}'::jsonb);

insert into public.templates (id, project_id, owner_id, name, source_type)
values (current_setting('phase13.template_a')::uuid, current_setting('phase13.project_a')::uuid,
        current_setting('phase13.user_a')::uuid, 'Synthetic template A', 'image');

insert into public.template_fields (id, template_id, owner_id, key, label)
values (current_setting('phase13.template_field_a')::uuid, current_setting('phase13.template_a')::uuid,
        current_setting('phase13.user_a')::uuid, 'synthetic_field', 'Synthetic field');

insert into public.student_photos (id, project_id, owner_id, storage_path, original_filename, mime_type, student_id)
values (current_setting('phase13.photo_a')::uuid, current_setting('phase13.project_a')::uuid,
        current_setting('phase13.user_a')::uuid,
        current_setting('phase13.user_a') || '/' || current_setting('phase13.project_a') || '/synthetic.png',
        'synthetic.png', 'image/png', current_setting('phase13.student_a')::uuid);

insert into public.batches (id, project_id, owner_id, name, template_id)
values (current_setting('phase13.batch_a')::uuid, current_setting('phase13.project_a')::uuid,
        current_setting('phase13.user_a')::uuid, 'Synthetic batch A', current_setting('phase13.template_a')::uuid);

insert into public.processing_jobs (id, batch_id, project_id, owner_id, serial_number)
values (current_setting('phase13.job_a')::uuid, current_setting('phase13.batch_a')::uuid,
        current_setting('phase13.project_a')::uuid, current_setting('phase13.user_a')::uuid, 1);

insert into public.generated_cards (id, project_id, owner_id, student_id, template_id, batch_id, photo_id, serial_number, filename)
values (current_setting('phase13.card_a')::uuid, current_setting('phase13.project_a')::uuid,
        current_setting('phase13.user_a')::uuid, current_setting('phase13.student_a')::uuid,
        current_setting('phase13.template_a')::uuid, current_setting('phase13.batch_a')::uuid,
        current_setting('phase13.photo_a')::uuid, 1, 'synthetic-card.png');

insert into public.validation_results (id, generated_card_id, owner_id, status)
values (current_setting('phase13.validation_a')::uuid, current_setting('phase13.card_a')::uuid,
        current_setting('phase13.user_a')::uuid, 'PASS');

insert into public.card_validation_findings
  (id, finding_key, project_id, owner_id, student_id, batch_id, generated_card_id, rule_id, severity, message, corrective_action, input_fingerprint)
values
  (current_setting('phase13.finding_a')::uuid, current_setting('phase13.finding_a'),
   current_setting('phase13.project_a')::uuid, current_setting('phase13.user_a')::uuid,
   current_setting('phase13.student_a')::uuid, current_setting('phase13.batch_a')::uuid,
   current_setting('phase13.card_a')::uuid, 'synthetic_rule', 'warning',
   'Synthetic test finding', 'No action; fixture only', 'phase13-synthetic-fingerprint');

insert into public.batch_generation_items
  (id, batch_id, project_id, owner_id, student_id, serial_number, output_card_id)
values
  (current_setting('phase13.batch_item_a')::uuid, current_setting('phase13.batch_a')::uuid,
   current_setting('phase13.project_a')::uuid, current_setting('phase13.user_a')::uuid,
   current_setting('phase13.student_a')::uuid, 1, current_setting('phase13.card_a')::uuid);

insert into public.exports (id, batch_id, project_id, owner_id, filename)
values (current_setting('phase13.export_a')::uuid, current_setting('phase13.batch_a')::uuid,
        current_setting('phase13.project_a')::uuid, current_setting('phase13.user_a')::uuid, 'synthetic-export.zip');

insert into storage.objects (id, bucket_id, name, owner_id, metadata)
values (current_setting('phase13.object_a')::uuid, 'printforge-student-photos',
        current_setting('phase13.user_a') || '/' || current_setting('phase13.project_a') || '/synthetic.png',
        current_setting('phase13.user_a'), '{"mimetype":"image/png","size":1}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('phase13.user_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('phase13.user_a'), 'role', 'authenticated')::text, true);

do $tenant_a_checks$
begin
  if not exists (select 1 from public.school_projects where id = current_setting('phase13.project_a')::uuid)
     or not exists (select 1 from public.students where id = current_setting('phase13.student_a')::uuid)
     or not exists (select 1 from public.templates where id = current_setting('phase13.template_a')::uuid)
     or not exists (select 1 from public.student_photos where id = current_setting('phase13.photo_a')::uuid)
     or not exists (select 1 from public.batches where id = current_setting('phase13.batch_a')::uuid)
     or not exists (select 1 from public.generated_cards where id = current_setting('phase13.card_a')::uuid)
     or not exists (select 1 from public.exports where id = current_setting('phase13.export_a')::uuid)
     or not exists (select 1 from storage.objects where id = current_setting('phase13.object_a')::uuid) then
    raise exception 'Tenant A cannot read its own synthetic fixture; a legitimate workflow is blocked';
  end if;
end
$tenant_a_checks$;

select set_config('request.jwt.claim.sub', current_setting('phase13.user_b'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('phase13.user_b'), 'role', 'authenticated')::text, true);

do $tenant_b_checks$
declare
  n bigint;
  changed bigint;
begin
  if exists (select 1 from public.school_projects where id = current_setting('phase13.project_a')::uuid)
     or exists (select 1 from public.students where id = current_setting('phase13.student_a')::uuid)
     or exists (select 1 from public.templates where id = current_setting('phase13.template_a')::uuid)
     or exists (select 1 from public.template_fields where id = current_setting('phase13.template_field_a')::uuid)
     or exists (select 1 from public.student_photos where id = current_setting('phase13.photo_a')::uuid)
     or exists (select 1 from public.batches where id = current_setting('phase13.batch_a')::uuid)
     or exists (select 1 from public.processing_jobs where id = current_setting('phase13.job_a')::uuid)
     or exists (select 1 from public.generated_cards where id = current_setting('phase13.card_a')::uuid)
     or exists (select 1 from public.validation_results where id = current_setting('phase13.validation_a')::uuid)
     or exists (select 1 from public.card_validation_findings where id = current_setting('phase13.finding_a')::uuid)
     or exists (select 1 from public.batch_generation_items where id = current_setting('phase13.batch_item_a')::uuid)
     or exists (select 1 from public.exports where id = current_setting('phase13.export_a')::uuid)
     or exists (select 1 from storage.objects where id = current_setting('phase13.object_a')::uuid) then
    raise exception 'Tenant B can read a Tenant A project/resource';
  end if;

  update public.students set serial_number = 99 where id = current_setting('phase13.student_a')::uuid;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Tenant B modified Tenant A student'; end if;

  delete from public.generated_cards where id = current_setting('phase13.card_a')::uuid;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Tenant B deleted Tenant A generated card'; end if;

  delete from public.exports where id = current_setting('phase13.export_a')::uuid;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Tenant B deleted Tenant A export'; end if;

  delete from storage.objects where id = current_setting('phase13.object_a')::uuid;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Tenant B deleted Tenant A storage object'; end if;

  begin
    insert into public.students (project_id, owner_id, serial_number, data)
    values (current_setting('phase13.project_a')::uuid, current_setting('phase13.user_b')::uuid, 999, '{"test_fixture":true}'::jsonb);
    raise exception 'Tenant B inserted a student into Tenant A project';
  exception when insufficient_privilege then
    null; -- Expected RLS denial.
  end;

  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values ('printforge-student-photos',
      current_setting('phase13.user_b') || '/' || current_setting('phase13.project_a') || '/forbidden.png',
      current_setting('phase13.user_b'), '{"mimetype":"image/png","size":1}'::jsonb);
    raise exception 'Tenant B uploaded an object into Tenant A project path';
  exception when insufficient_privilege then
    null; -- Expected storage RLS denial.
  end;

  if has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') then
    raise exception 'Tenant B has direct audit-log mutation privileges';
  end if;
end
$tenant_b_checks$;

rollback;
