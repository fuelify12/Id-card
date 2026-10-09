-- Phase 8: additive rendering metadata. Existing templates and generated records are preserved.
alter table public.template_fields
  add column if not exists static_value text,
  add column if not exists max_lines integer not null default 1 check (max_lines between 1 and 12),
  add column if not exists overflow_policy text not null default 'warn' check (overflow_policy in ('warn','block','clip')),
  add column if not exists auto_shrink boolean not null default true,
  add column if not exists min_font_size numeric not null default 8 check (min_font_size between 6 and 96),
  add column if not exists line_height numeric not null default 1.15 check (line_height between 0.8 and 2.5),
  add column if not exists vertical_alignment text not null default 'middle' check (vertical_alignment in ('top','middle','bottom')),
  add column if not exists rotation numeric not null default 0 check (rotation between -360 and 360),
  add column if not exists visible boolean not null default true,
  add column if not exists field_format text;
alter table public.generated_cards
  add column if not exists template_id uuid references public.templates(id) on delete set null,
  add column if not exists template_version integer,
  add column if not exists renderer_version text,
  add column if not exists input_hash text,
  add column if not exists output_hash text,
  add column if not exists output_format text check (output_format is null or output_format in ('png','jpeg')),
  add column if not exists output_width_px integer,
  add column if not exists output_height_px integer,
  add column if not exists output_dpi integer,
  add column if not exists render_warnings jsonb not null default '[]'::jsonb,
  add column if not exists render_errors jsonb not null default '[]'::jsonb,
  add column if not exists rendered_at timestamptz,
  add column if not exists front_storage_path text,
  add column if not exists back_storage_path text;
create index if not exists generated_cards_render_lookup_idx on public.generated_cards(project_id, student_id, template_id, created_at desc);
create index if not exists generated_cards_render_status_idx on public.generated_cards(project_id, status, validation_status);
create unique index if not exists generated_cards_idempotency_idx on public.generated_cards(project_id, student_id, template_id, input_hash, output_format) where student_id is not null and template_id is not null and input_hash is not null and output_format is not null;

create index if not exists idx_generated_cards_template_id on public.generated_cards(template_id) where template_id is not null;
