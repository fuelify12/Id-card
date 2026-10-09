-- Phase 7: student photo processing metadata. Additive only; originals and matching assignments are preserved.
alter table public.school_projects
  add column if not exists photo_processing_settings jsonb not null default '{"target_width_px":600,"target_height_px":800,"dpi":300,"top_padding_ratio":0.10,"face_vertical_position":0.38,"min_source_width_px":600,"min_source_height_px":800,"output_format":"jpeg","output_quality":92,"background_policy":"preserve","confirmed_by_user":false}'::jsonb;
alter table public.student_photos
  add column if not exists processed_storage_path text,
  add column if not exists processing_status text not null default 'PENDING_PROCESSING',
  add column if not exists face_count integer,
  add column if not exists detection_confidence numeric,
  add column if not exists crop_coordinates jsonb not null default '{}'::jsonb,
  add column if not exists output_width_px integer,
  add column if not exists output_height_px integer,
  add column if not exists output_aspect_ratio numeric,
  add column if not exists processing_error_code text,
  add column if not exists processing_warnings jsonb not null default '[]'::jsonb,
  add column if not exists processed_at timestamptz,
  add column if not exists processing_version integer not null default 1,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists crop_approved_at timestamptz,
  add column if not exists crop_approved_by uuid references auth.users(id),
  add column if not exists original_width_px integer,
  add column if not exists original_height_px integer,
  add column if not exists original_orientation integer;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='student_photos_processing_status_check') then alter table public.student_photos add constraint student_photos_processing_status_check check(processing_status in('PENDING_PROCESSING','PROCESSING','READY_FOR_REVIEW','APPROVED','NEEDS_REVIEW','PROCESSING_FAILED')); end if;
 if not exists(select 1 from pg_constraint where conname='student_photos_detection_confidence_check') then alter table public.student_photos add constraint student_photos_detection_confidence_check check(detection_confidence is null or detection_confidence between 0 and 1); end if;
end $$;
create index if not exists idx_student_photos_processing_queue on public.student_photos(project_id,processing_status,created_at);
create index if not exists idx_student_photos_processed_approved on public.student_photos(project_id,student_id,processing_status) where processing_status='APPROVED';
-- Derivatives use the existing private printforge-student-photos bucket and <uid>/<project-id>/processed/ paths.
-- Existing RLS and storage folder policies remain in force. No service-role access or public bucket is introduced.