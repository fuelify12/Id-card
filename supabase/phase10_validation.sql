-- Phase 10: persisted detailed findings and explicit human approval. Additive only.
create table if not exists public.card_validation_findings(
 id uuid primary key default gen_random_uuid(), finding_key text not null unique,
 project_id uuid not null references public.school_projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid references public.students(id) on delete set null,
 batch_id uuid references public.batches(id) on delete set null,
 generated_card_id uuid references public.generated_cards(id) on delete set null,
 rule_id text not null, rule_version integer not null default 1 check(rule_version>0),
 severity text not null check(severity in('CRITICAL','ERROR','WARNING','INFO')),
 status text not null default 'OPEN' check(status in('OPEN','IN_REVIEW','RESOLVED','WAIVED')),
 message text not null, corrective_action text not null, field_ref text, asset_ref text,
 input_fingerprint text not null, details jsonb not null default '{}'::jsonb,
 detected_at timestamptz not null default now(), resolved_at timestamptz,
 resolved_by uuid references auth.users(id) on delete set null, resolution_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_validation_findings_project_status on public.card_validation_findings(project_id,status,severity,detected_at desc);
create index if not exists idx_validation_findings_student on public.card_validation_findings(project_id,student_id,detected_at desc);
create index if not exists idx_validation_findings_card on public.card_validation_findings(generated_card_id,detected_at desc);
alter table public.card_validation_findings enable row level security;
drop policy if exists card_validation_findings_owner_select on public.card_validation_findings;
create policy card_validation_findings_owner_select on public.card_validation_findings for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
drop policy if exists card_validation_findings_owner_insert on public.card_validation_findings;
create policy card_validation_findings_owner_insert on public.card_validation_findings for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
drop policy if exists card_validation_findings_owner_update on public.card_validation_findings;
create policy card_validation_findings_owner_update on public.card_validation_findings for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.school_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
alter table public.generated_cards add column if not exists approval_status text not null default 'pending' check(approval_status in('pending','review_required','approved','rejected'));
alter table public.generated_cards add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.generated_cards add column if not exists approved_at timestamptz;
alter table public.generated_cards add column if not exists validation_fingerprint text;
alter table public.generated_cards add column if not exists photo_id uuid references public.student_photos(id) on delete set null;
alter table public.generated_cards add column if not exists photo_version integer;
create index if not exists idx_generated_cards_approval_status on public.generated_cards(project_id,approval_status,status);
