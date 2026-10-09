-- Defense in depth: make critical finding waivers/resolutions and finding identity edits impossible via direct table updates.
create or replace function public.guard_card_validation_finding_transition()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.finding_key is distinct from old.finding_key
    or new.project_id is distinct from old.project_id
    or new.owner_id is distinct from old.owner_id
    or new.student_id is distinct from old.student_id
    or new.batch_id is distinct from old.batch_id
    or new.generated_card_id is distinct from old.generated_card_id
    or new.rule_id is distinct from old.rule_id
    or new.rule_version is distinct from old.rule_version
    or new.severity is distinct from old.severity
    or new.input_fingerprint is distinct from old.input_fingerprint then
   raise exception 'Validation finding identity and severity are immutable; create a new fingerprinted finding instead.';
 end if;
 if new.status in ('RESOLVED','WAIVED') and coalesce(trim(new.resolution_note),'')='' then
   raise exception 'A corrective-action note or waiver justification is required.';
 end if;
 if old.severity='CRITICAL' and new.status='WAIVED' then
   raise exception 'Critical validation findings cannot be waived.';
 end if;
 if old.severity='CRITICAL' and new.status='RESOLVED' and new.resolution_note not like 'Automatically resolved by revalidation%' then
   raise exception 'Critical findings close only when server-side revalidation confirms the issue no longer reproduces.';
 end if;
 return new;
end $$;
drop trigger if exists trg_guard_validation_finding_transition on public.card_validation_findings;
create trigger trg_guard_validation_finding_transition before update on public.card_validation_findings for each row execute function public.guard_card_validation_finding_transition();
