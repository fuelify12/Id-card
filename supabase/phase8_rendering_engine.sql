-- Phase 8: deterministic rendering metadata. Additive and safe for existing rows.
alter table public.templates
  add column if not exists render_config jsonb not null default '{"coordinateMode":"template-pixels","defaultDpi":300,"outputFormat":"png","side":"front"}'::jsonb;

alter table public.template_fields
  add column if not exists render_options jsonb not null default '{}'::jsonb;

alter table public.generated_cards
  add column if not exists template_id uuid references public.templates(id) on delete set null,
  add column if not exists template_version integer,
  add column if not exists render_key text,
  add column if not exists render_input_hash text,
  add column if not exists output_sha256 text,
  add column if not exists output_format text,
  add column if not exists output_width_px integer,
  add column if not exists output_height_px integer,
  add column if not exists output_width_mm numeric(8,3),
  add column if not exists output_height_mm numeric(8,3),
  add column if not exists output_dpi integer,
  add column if not exists renderer_version text,
  add column if not exists render_config_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists validation_warnings jsonb not null default '[]'::jsonb,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists generated_at timestamptz,
  add column if not exists card_side text not null default 'front';

alter table public.generated_cards
  drop constraint if exists generated_cards_card_side_check;
alter table public.generated_cards
  add constraint generated_cards_card_side_check check (card_side in ('front','back'));
alter table public.generated_cards
  drop constraint if exists generated_cards_output_format_check;
alter table public.generated_cards
  add constraint generated_cards_output_format_check check (output_format is null or output_format in ('png','jpeg','pdf'));
alter table public.generated_cards
  drop constraint if exists generated_cards_output_dimensions_check;
alter table public.generated_cards
  add constraint generated_cards_output_dimensions_check check (
    (output_width_px is null or output_width_px between 1 and 24000)
    and (output_height_px is null or output_height_px between 1 and 24000)
    and (output_dpi is null or output_dpi between 72 and 1200)
  );

alter table public.generated_cards alter column batch_id drop not null;

create unique index if not exists uq_generated_cards_project_render_key
  on public.generated_cards(project_id, render_key);
create index if not exists idx_generated_cards_project_status_created
  on public.generated_cards(project_id, status, created_at desc);
create index if not exists idx_generated_cards_student_template
  on public.generated_cards(project_id, student_id, template_id);

-- Extend the existing private template bucket's allow-list; do not change public/private visibility.
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/svg+xml','application/pdf']
where id = 'printforge-templates';

-- The generated-card bucket remains private and existing owner/project policies remain in force.

-- Canonical source_type values are kept short for compatibility with the existing templates table.
alter table public.templates drop constraint if exists templates_source_type_check;
alter table public.templates add constraint templates_source_type_check check (source_type = any (array['png','jpg','jpeg','pdf','svg']::text[]));
