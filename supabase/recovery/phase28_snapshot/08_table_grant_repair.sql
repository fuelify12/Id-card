-- Phase 28 isolated bootstrap repair: restore source table grants omitted by the first chunk filter.
-- Statement list is copied from the reviewed catalog-derived schema snapshot.
-- This repairs the isolated project only; do not apply as an unreviewed Production change.
begin;
grant SELECT on table public."audit_logs" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."audit_logs" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."batch_generation_items" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."batch_generation_items" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."batches" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."batches" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."card_validation_findings" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."card_validation_findings" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."exports" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."exports" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."generated_cards" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."generated_cards" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."processing_jobs" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."processing_jobs" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."profiles" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."profiles" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."school_projects" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."school_projects" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."security_rate_limits" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."student_photos" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."student_photos" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."students" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."students" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."template_fields" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."template_fields" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."templates" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."templates" to "service_role";
grant SELECT, INSERT, UPDATE, DELETE on table public."validation_results" to "authenticated";
grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."validation_results" to "service_role";
commit;
