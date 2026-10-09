-- Phase 10: per-school validation policy, with conservative defaults.
alter table public.school_projects add column if not exists validation_settings jsonb not null default '{"required_fields":[],"admission_number_unique":true,"allow_warnings_for_approval":false,"min_photo_width_px":600,"min_photo_height_px":800}'::jsonb;
