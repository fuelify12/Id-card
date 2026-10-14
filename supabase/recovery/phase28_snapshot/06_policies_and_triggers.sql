-- Phase 28 schema snapshot part: policies_triggers
-- Derived from read-only Production catalog metadata on 2026-10-14.
-- Apply only after verifying project ref zzecjgauhkaxyptsurlw is isolated and empty.
-- Not the original Phase 1 migration; no Production data is copied.
begin;
create policy "audit_logs_owner_select" on public."audit_logs" as permissive for SELECT to "authenticated" using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "batch items tenant delete" on public."batch_generation_items" as permissive for DELETE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "batch items tenant insert" on public."batch_generation_items" as permissive for INSERT to "authenticated" with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "batch items tenant select" on public."batch_generation_items" as permissive for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "batch items tenant update" on public."batch_generation_items" as permissive for UPDATE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "batches own rows" on public."batches" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "findings tenant insert" on public."card_validation_findings" as permissive for INSERT to "authenticated" with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "findings tenant select" on public."card_validation_findings" as permissive for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "findings tenant update" on public."card_validation_findings" as permissive for UPDATE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "exports tenant delete" on public."exports" as permissive for DELETE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "exports tenant insert" on public."exports" as permissive for INSERT to "authenticated" with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "exports tenant select" on public."exports" as permissive for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "exports tenant update" on public."exports" as permissive for UPDATE to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "cards own rows" on public."generated_cards" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "jobs own rows" on public."processing_jobs" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "profiles own rows" on public."profiles" as permissive for ALL to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy "projects own rows" on public."school_projects" as permissive for ALL to "authenticated" using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "security_rate_limits_deny_client" on public."security_rate_limits" as permissive for ALL to "anon", "authenticated" using (false) with check (false);
create policy "photos own project rows" on public."student_photos" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "students own rows" on public."students" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "fields own rows" on public."template_fields" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "templates own rows" on public."templates" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "validation own rows" on public."validation_results" as permissive for ALL to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
create policy "printforge tenant object delete" on storage.objects as permissive for DELETE to "authenticated" using (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
create policy "printforge tenant object insert" on storage.objects as permissive for INSERT to "authenticated" with check (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
create policy "printforge tenant object select" on storage.objects as permissive for SELECT to "authenticated" using (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
create policy "printforge tenant object update" on storage.objects as permissive for UPDATE to "authenticated" using (((bucket_id = ANY (ARRAY['printforge-templates'::text, 'printforge-student-photos'::text, 'printforge-generated-cards'::text, 'printforge-exports'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
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
