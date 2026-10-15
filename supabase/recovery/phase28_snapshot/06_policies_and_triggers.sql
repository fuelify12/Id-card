-- Phase 28 schema snapshot part: policies_triggers
-- Derived from read-only Production catalog metadata on 2026-10-14.
-- Apply only after verifying project ref zzecjgauhkaxyptsurlw is isolated and empty.
-- Not the original Phase 1 migration; no Production data is copied.
begin;
create policy "audit_logs_owner_select" on public."audit_logs" as permissive for SELECT to "authenticated" using ((owner_id = ( SELECT auth.uid() AS uid)));

create policy "batch items tenant delete" on public."batch_generation_items" as permissive for DELETE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batch_generation_items.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "batch items tenant insert" on public."batch_generation_items" as permissive for INSERT to "authenticated" with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batch_generation_items.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = batch_generation_items.batch_id) AND (b.project_id = batch_generation_items.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = batch_generation_items.student_id) AND (s.project_id = batch_generation_items.project_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "batch items tenant select" on public."batch_generation_items" as permissive for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batch_generation_items.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "batch items tenant update" on public."batch_generation_items" as permissive for UPDATE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batch_generation_items.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batch_generation_items.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = batch_generation_items.batch_id) AND (b.project_id = batch_generation_items.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = batch_generation_items.student_id) AND (s.project_id = batch_generation_items.project_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "batches own rows" on public."batches" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batches.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = batches.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1
   FROM templates t
  WHERE ((t.id = batches.template_id) AND (t.project_id = batches.project_id) AND (t.owner_id = ( SELECT auth.uid() AS uid))))))));

create policy "findings tenant insert" on public."card_validation_findings" as permissive for INSERT to "authenticated" with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = card_validation_findings.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = card_validation_findings.student_id) AND (s.project_id = card_validation_findings.project_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((batch_id IS NULL) OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = card_validation_findings.batch_id) AND (b.project_id = card_validation_findings.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((generated_card_id IS NULL) OR (EXISTS ( SELECT 1
   FROM generated_cards g
  WHERE ((g.id = card_validation_findings.generated_card_id) AND (g.project_id = card_validation_findings.project_id) AND (g.owner_id = ( SELECT auth.uid() AS uid))))))));

create policy "findings tenant select" on public."card_validation_findings" as permissive for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = card_validation_findings.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "findings tenant update" on public."card_validation_findings" as permissive for UPDATE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = card_validation_findings.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = card_validation_findings.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = card_validation_findings.student_id) AND (s.project_id = card_validation_findings.project_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((batch_id IS NULL) OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = card_validation_findings.batch_id) AND (b.project_id = card_validation_findings.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((generated_card_id IS NULL) OR (EXISTS ( SELECT 1
   FROM generated_cards g
  WHERE ((g.id = card_validation_findings.generated_card_id) AND (g.project_id = card_validation_findings.project_id) AND (g.owner_id = ( SELECT auth.uid() AS uid))))))));

create policy "exports tenant delete" on public."exports" as permissive for DELETE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = exports.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "exports tenant insert" on public."exports" as permissive for INSERT to "authenticated" with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = exports.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = exports.batch_id) AND (b.project_id = exports.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "exports tenant select" on public."exports" as permissive for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = exports.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "exports tenant update" on public."exports" as permissive for UPDATE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = exports.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = exports.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = exports.batch_id) AND (b.project_id = exports.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "cards own rows" on public."generated_cards" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = generated_cards.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = generated_cards.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = generated_cards.student_id) AND (s.project_id = generated_cards.project_id) AND (s.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((template_id IS NULL) OR (EXISTS ( SELECT 1
   FROM templates t
  WHERE ((t.id = generated_cards.template_id) AND (t.project_id = generated_cards.project_id) AND (t.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((batch_id IS NULL) OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = generated_cards.batch_id) AND (b.project_id = generated_cards.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((photo_id IS NULL) OR (EXISTS ( SELECT 1
   FROM student_photos sp
  WHERE ((sp.id = generated_cards.photo_id) AND (sp.project_id = generated_cards.project_id) AND (sp.owner_id = ( SELECT auth.uid() AS uid))))))));

create policy "jobs own rows" on public."processing_jobs" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = processing_jobs.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = processing_jobs.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND ((batch_id IS NULL) OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = processing_jobs.batch_id) AND (b.project_id = processing_jobs.project_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = processing_jobs.student_id) AND (s.project_id = processing_jobs.project_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))))));

create policy "profiles own rows" on public."profiles" as permissive for ALL to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));

create policy "projects own rows" on public."school_projects" as permissive for ALL to "authenticated" using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));

create policy "security_rate_limits_deny_client" on public."security_rate_limits" as permissive for ALL to "anon", "authenticated" using (false) with check (false);

create policy "photos own project rows" on public."student_photos" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = student_photos.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = student_photos.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "students own rows" on public."students" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = students.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = students.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "fields own rows" on public."template_fields" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (templates t
     JOIN school_projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = template_fields.template_id) AND (t.owner_id = ( SELECT auth.uid() AS uid)) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (templates t
     JOIN school_projects p ON ((p.id = t.project_id)))
  WHERE ((t.id = template_fields.template_id) AND (t.owner_id = ( SELECT auth.uid() AS uid)) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "templates own rows" on public."templates" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = templates.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE ((p.id = templates.project_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "validation own rows" on public."validation_results" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (generated_cards g
     JOIN school_projects p ON ((p.id = g.project_id)))
  WHERE ((g.id = validation_results.generated_card_id) AND (g.owner_id = ( SELECT auth.uid() AS uid)) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (generated_cards g
     JOIN school_projects p ON ((p.id = g.project_id)))
  WHERE ((g.id = validation_results.generated_card_id) AND (g.owner_id = ( SELECT auth.uid() AS uid)) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "printforge tenant object delete" on storage.objects as permissive for DELETE to "authenticated" using (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[2]) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "printforge tenant object insert" on storage.objects as permissive for INSERT to "authenticated" with check (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[2]) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "printforge tenant object select" on storage.objects as permissive for SELECT to "authenticated" using (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[2]) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));

create policy "printforge tenant object update" on storage.objects as permissive for UPDATE to "authenticated" using (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[2]) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM school_projects p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[2]) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))));
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER security_audit_batch_items AFTER INSERT OR DELETE OR UPDATE ON batch_generation_items FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_batches AFTER INSERT OR DELETE OR UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_validation_findings AFTER INSERT OR DELETE OR UPDATE ON card_validation_findings FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER trg_guard_validation_finding_transition BEFORE INSERT OR UPDATE ON card_validation_findings FOR EACH ROW EXECUTE FUNCTION guard_card_validation_finding_transition();
CREATE TRIGGER security_audit_exports AFTER INSERT OR DELETE OR UPDATE ON exports FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_generated_cards AFTER INSERT OR DELETE OR UPDATE ON generated_cards FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_processing_jobs AFTER INSERT OR DELETE OR UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_school_projects AFTER INSERT OR DELETE OR UPDATE ON school_projects FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_student_photos AFTER INSERT OR DELETE OR UPDATE ON student_photos FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_students AFTER INSERT OR DELETE OR UPDATE ON students FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_template_fields AFTER INSERT OR DELETE OR UPDATE ON template_fields FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER trg_template_fields_version_invalidation AFTER INSERT OR DELETE OR UPDATE ON template_fields FOR EACH ROW EXECUTE FUNCTION bump_template_version_for_field_change();
CREATE TRIGGER security_audit_templates AFTER INSERT OR DELETE OR UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
CREATE TRIGGER security_audit_validation_results AFTER INSERT OR DELETE OR UPDATE ON validation_results FOR EACH ROW EXECUTE FUNCTION capture_security_audit_event();
commit;
