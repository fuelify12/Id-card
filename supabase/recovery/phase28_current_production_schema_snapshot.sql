-- PRINTFORGE Phase 28 isolated schema-recovery snapshot.

-- Generated from read-only PostgreSQL catalog metadata on 2026-10-14.

-- Source project ref: xdoenkusrakuyyxnnkff. Schema metadata only; no table rows, auth users, photos, or exports were copied.

-- The original historical 20261008173336_phase1_foundation.sql was not present in reachable repository history.

-- This is a separate current-schema snapshot; it is NOT represented as the original Phase 1 migration.

-- Apply only to a clean, isolated Supabase acceptance project. Never apply to Production.

begin;

create table public."audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "project_id" uuid,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);

create table public."batch_generation_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "serial_number" integer NOT NULL,
  "student_name" text,
  "status" text DEFAULT 'PENDING'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "input_fingerprint" text,
  "output_card_id" uuid,
  "output_storage_path" text,
  "error_category" text,
  "error_summary" text,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "claimed_at" timestamp with time zone,
  "claimed_by" text,
  "heartbeat_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "batch_generation_items_attempts_check" CHECK (attempts >= 0),
  CONSTRAINT "batch_generation_items_error_category_check" CHECK (error_category IS NULL OR (error_category = ANY (ARRAY['validation'::text, 'rendering'::text, 'storage'::text, 'authorization'::text, 'resource_limit'::text, 'unknown'::text]))),
  CONSTRAINT "batch_generation_items_max_attempts_check" CHECK (max_attempts >= 1 AND max_attempts <= 10),
  CONSTRAINT "batch_generation_items_output_storage_path_check" CHECK (output_storage_path IS NULL OR output_storage_path !~~ '/%'::text AND output_storage_path !~~ '%..%'::text),
  CONSTRAINT "batch_generation_items_status_check" CHECK (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'SKIPPED'::text, 'NEEDS_REVIEW'::text])),
  CONSTRAINT "batch_generation_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "batch_generation_items_batch_id_serial_number_key" UNIQUE (batch_id, serial_number),
  CONSTRAINT "batch_generation_items_batch_id_student_id_key" UNIQUE (batch_id, student_id)
);

create table public."batches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "total_count" integer DEFAULT 0 NOT NULL,
  "completed_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "review_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "total_bytes" bigint DEFAULT 0 NOT NULL,
  "photo_reservations" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "template_id" uuid,
  "template_version" integer,
  "requested_by" uuid,
  "idempotency_key" text,
  "eligible_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "reused_count" integer DEFAULT 0 NOT NULL,
  "processing_count" integer DEFAULT 0 NOT NULL,
  "heartbeat_at" timestamp with time zone,
  "last_error" text,
  "config_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "paused_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  CONSTRAINT "batches_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'queued'::text, 'running'::text, 'processing'::text, 'pausing'::text, 'paused'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text, 'needs_review'::text, 'cancelled'::text])),
  CONSTRAINT "batches_pkey" PRIMARY KEY (id)
);

create table public."card_validation_findings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "finding_key" text NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "student_id" uuid,
  "batch_id" uuid,
  "generated_card_id" uuid,
  "rule_id" text NOT NULL,
  "rule_version" integer DEFAULT 1 NOT NULL,
  "severity" text NOT NULL,
  "status" text DEFAULT 'OPEN'::text NOT NULL,
  "message" text NOT NULL,
  "corrective_action" text NOT NULL,
  "field_ref" text,
  "asset_ref" text,
  "input_fingerprint" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "resolution_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "card_validation_findings_rule_version_check" CHECK (rule_version > 0),
  CONSTRAINT "card_validation_findings_severity_check" CHECK (severity = ANY (ARRAY['CRITICAL'::text, 'ERROR'::text, 'WARNING'::text, 'INFO'::text])),
  CONSTRAINT "card_validation_findings_status_check" CHECK (status = ANY (ARRAY['OPEN'::text, 'IN_REVIEW'::text, 'RESOLVED'::text, 'WAIVED'::text])),
  CONSTRAINT "card_validation_findings_pkey" PRIMARY KEY (id),
  CONSTRAINT "card_validation_findings_finding_key_key" UNIQUE (finding_key)
);

create table public."exports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "storage_path" text,
  "filename" text NOT NULL,
  "status" text DEFAULT 'ready'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "options" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "selected_count" integer DEFAULT 0 NOT NULL,
  "eligible_count" integer DEFAULT 0 NOT NULL,
  "excluded_count" integer DEFAULT 0 NOT NULL,
  "packaged_file_count" integer DEFAULT 0 NOT NULL,
  "failed_item_count" integer DEFAULT 0 NOT NULL,
  "archive_bytes" bigint,
  "archive_sha256" text,
  "error_summary" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "item_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "excluded_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "retryable" boolean DEFAULT false NOT NULL,
  CONSTRAINT "exports_archive_bytes_check" CHECK (archive_bytes IS NULL OR archive_bytes >= 0),
  CONSTRAINT "exports_eligible_count_check" CHECK (eligible_count >= 0),
  CONSTRAINT "exports_excluded_count_check" CHECK (excluded_count >= 0),
  CONSTRAINT "exports_failed_item_count_check" CHECK (failed_item_count >= 0),
  CONSTRAINT "exports_packaged_file_count_check" CHECK (packaged_file_count >= 0),
  CONSTRAINT "exports_phase11_status_check" CHECK (status = ANY (ARRAY['ready'::text, 'pending'::text, 'queued'::text, 'running'::text, 'verifying'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text, 'cancelled'::text, 'expired'::text])),
  CONSTRAINT "exports_retry_count_check" CHECK (retry_count >= 0 AND retry_count <= 3),
  CONSTRAINT "exports_selected_count_check" CHECK (selected_count >= 0),
  CONSTRAINT "exports_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'ready'::text, 'failed'::text])),
  CONSTRAINT "exports_pkey" PRIMARY KEY (id)
);

create table public."generated_cards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "student_id" uuid,
  "serial_number" integer NOT NULL,
  "storage_path" text,
  "filename" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "validation_status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "template_id" uuid,
  "template_version" integer,
  "renderer_version" text,
  "input_hash" text,
  "output_hash" text,
  "output_format" text,
  "output_width_px" integer,
  "output_height_px" integer,
  "output_dpi" integer,
  "render_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "render_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "rendered_at" timestamp with time zone,
  "front_storage_path" text,
  "back_storage_path" text,
  "render_key" text,
  "render_input_hash" text,
  "output_sha256" text,
  "output_width_mm" numeric(8,3),
  "output_height_mm" numeric(8,3),
  "render_config_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "validation_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "generated_at" timestamp with time zone,
  "card_side" text DEFAULT 'front'::text NOT NULL,
  "approval_status" text DEFAULT 'pending'::text NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "validation_fingerprint" text,
  "photo_id" uuid,
  "photo_version" integer,
  CONSTRAINT "generated_cards_approval_status_check" CHECK (approval_status = ANY (ARRAY['pending'::text, 'review_required'::text, 'approved'::text, 'rejected'::text])),
  CONSTRAINT "generated_cards_card_side_check" CHECK (card_side = ANY (ARRAY['front'::text, 'back'::text])),
  CONSTRAINT "generated_cards_output_dimensions_check" CHECK ((output_width_px IS NULL OR output_width_px >= 1 AND output_width_px <= 24000) AND (output_height_px IS NULL OR output_height_px >= 1 AND output_height_px <= 24000) AND (output_dpi IS NULL OR output_dpi >= 72 AND output_dpi <= 1200)),
  CONSTRAINT "generated_cards_output_format_check" CHECK (output_format IS NULL OR (output_format = ANY (ARRAY['png'::text, 'jpeg'::text, 'pdf'::text]))),
  CONSTRAINT "generated_cards_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'generated'::text, 'failed'::text, 'needs_review'::text])),
  CONSTRAINT "generated_cards_validation_status_check" CHECK (validation_status = ANY (ARRAY['pending'::text, 'passed'::text, 'warning'::text, 'failed'::text])),
  CONSTRAINT "generated_cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "generated_cards_batch_id_filename_key" UNIQUE (batch_id, filename),
  CONSTRAINT "generated_cards_batch_id_serial_number_key" UNIQUE (batch_id, serial_number)
);

create table public."processing_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "student_id" uuid,
  "serial_number" integer NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "confidence" numeric,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "processing_jobs_confidence_check" CHECK (confidence IS NULL OR confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "processing_jobs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'needs_review'::text])),
  CONSTRAINT "processing_jobs_pkey" PRIMARY KEY (id),
  CONSTRAINT "processing_jobs_batch_id_serial_number_key" UNIQUE (batch_id, serial_number)
);

create table public."profiles" (
  "id" uuid NOT NULL,
  "full_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

create table public."school_projects" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "school_name" text NOT NULL,
  "school_address" text,
  "academic_session" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "photo_serial_prefix" text,
  "photo_processing_settings" jsonb DEFAULT '{"dpi": 300, "output_format": "jpeg", "output_quality": 92, "target_width_px": 600, "target_height_px": 800, "background_policy": "preserve", "confirmed_by_user": false, "top_padding_ratio": 0.10, "min_source_width_px": 600, "min_source_height_px": 800, "face_vertical_position": 0.38}'::jsonb NOT NULL,
  "validation_settings" jsonb DEFAULT '{"required_fields": [], "min_photo_width_px": 600, "min_photo_height_px": 800, "admission_number_unique": true, "allow_warnings_for_approval": false}'::jsonb NOT NULL,
  CONSTRAINT "school_projects_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'processing'::text, 'completed'::text, 'archived'::text])),
  CONSTRAINT "school_projects_pkey" PRIMARY KEY (id)
);

create table public."security_rate_limits" (
  "owner_id" uuid NOT NULL,
  "action" text NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "security_rate_limits_action_check" CHECK (action = ANY (ARRAY['project_create'::text, 'template_upload'::text, 'student_import'::text, 'photo_upload_ticket'::text, 'photo_processing'::text, 'batch_generate'::text, 'zip_export'::text])),
  CONSTRAINT "security_rate_limits_request_count_check" CHECK (request_count >= 0),
  CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY (owner_id, action)
);

create table public."student_photos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "student_id" uuid,
  "serial_number" integer,
  "storage_path" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "width_px" integer,
  "height_px" integer,
  "match_status" text DEFAULT 'needs_review'::text NOT NULL,
  "match_confidence" numeric,
  "crop_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "original_serial_number" text,
  "normalized_serial_number" text,
  "file_size_bytes" bigint,
  "content_sha256" text,
  "matching_method" text,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "duplicate_of_id" uuid,
  "batch_id" uuid,
  "approved_at" timestamp with time zone,
  "approved_by" uuid,
  "image_version" integer DEFAULT 1 NOT NULL,
  "processed_storage_path" text,
  "processing_status" text DEFAULT 'PENDING_PROCESSING'::text NOT NULL,
  "face_count" integer,
  "detection_confidence" numeric,
  "crop_coordinates" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_width_px" integer,
  "output_height_px" integer,
  "output_aspect_ratio" numeric,
  "processing_error_code" text,
  "processing_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "processing_version" integer DEFAULT 1 NOT NULL,
  "processing_attempts" integer DEFAULT 0 NOT NULL,
  "crop_approved_at" timestamp with time zone,
  "crop_approved_by" uuid,
  "original_width_px" integer,
  "original_height_px" integer,
  "original_orientation" integer,
  CONSTRAINT "student_photos_detection_confidence_check" CHECK (detection_confidence IS NULL OR detection_confidence >= 0::numeric AND detection_confidence <= 1::numeric),
  CONSTRAINT "student_photos_match_confidence_check" CHECK (match_confidence IS NULL OR match_confidence >= 0::numeric AND match_confidence <= 1::numeric),
  CONSTRAINT "student_photos_match_status_check" CHECK (match_status = ANY (ARRAY['UPLOADED'::text, 'MATCHED'::text, 'NEEDS_REVIEW'::text, 'UNMATCHED'::text, 'DUPLICATE'::text, 'UPLOAD_FAILED'::text, 'INVALID_FILE'::text, 'APPROVED'::text])) NOT VALID,
  CONSTRAINT "student_photos_processing_status_check" CHECK (processing_status = ANY (ARRAY['PENDING_PROCESSING'::text, 'PROCESSING'::text, 'READY_FOR_REVIEW'::text, 'APPROVED'::text, 'NEEDS_REVIEW'::text, 'PROCESSING_FAILED'::text])),
  CONSTRAINT "student_photos_pkey" PRIMARY KEY (id)
);

create table public."students" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "serial_number" integer NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_row" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "students_pkey" PRIMARY KEY (id),
  CONSTRAINT "students_project_id_serial_number_key" UNIQUE (project_id, serial_number)
);

create table public."template_fields" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "field_type" text DEFAULT 'text'::text NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "x" numeric DEFAULT 0 NOT NULL,
  "y" numeric DEFAULT 0 NOT NULL,
  "width" numeric DEFAULT 0 NOT NULL,
  "height" numeric DEFAULT 0 NOT NULL,
  "font_family" text,
  "font_size" numeric,
  "font_weight" text,
  "color" text,
  "alignment" text,
  "fit_mode" text,
  "source_column" text,
  "confidence" numeric,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "static_value" text,
  "max_lines" integer DEFAULT 1 NOT NULL,
  "overflow_policy" text DEFAULT 'warn'::text NOT NULL,
  "auto_shrink" boolean DEFAULT true NOT NULL,
  "min_font_size" numeric DEFAULT 8 NOT NULL,
  "line_height" numeric DEFAULT 1.15 NOT NULL,
  "vertical_alignment" text DEFAULT 'middle'::text NOT NULL,
  "rotation" numeric DEFAULT 0 NOT NULL,
  "visible" boolean DEFAULT true NOT NULL,
  "field_format" text,
  "render_options" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "template_fields_confidence_check" CHECK (confidence IS NULL OR confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "template_fields_field_type_check" CHECK (field_type = ANY (ARRAY['text'::text, 'photo'::text, 'qr'::text, 'barcode'::text, 'static'::text])),
  CONSTRAINT "template_fields_line_height_check" CHECK (line_height >= 0.8 AND line_height <= 2.5),
  CONSTRAINT "template_fields_max_lines_check" CHECK (max_lines >= 1 AND max_lines <= 12),
  CONSTRAINT "template_fields_min_font_size_check" CHECK (min_font_size >= 6::numeric AND min_font_size <= 96::numeric),
  CONSTRAINT "template_fields_overflow_policy_check" CHECK (overflow_policy = ANY (ARRAY['warn'::text, 'block'::text, 'clip'::text])),
  CONSTRAINT "template_fields_rotation_check" CHECK (rotation >= '-360'::integer::numeric AND rotation <= 360::numeric),
  CONSTRAINT "template_fields_vertical_alignment_check" CHECK (vertical_alignment = ANY (ARRAY['top'::text, 'middle'::text, 'bottom'::text])),
  CONSTRAINT "template_fields_pkey" PRIMARY KEY (id)
);

create table public."templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "source_path" text,
  "source_type" text NOT NULL,
  "width_px" integer,
  "height_px" integer,
  "analysis_status" text DEFAULT 'pending'::text NOT NULL,
  "analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version_number" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "render_config" jsonb DEFAULT '{"side": "front", "defaultDpi": 300, "outputFormat": "png", "coordinateMode": "template-pixels"}'::jsonb NOT NULL,
  CONSTRAINT "templates_analysis_status_check" CHECK (analysis_status = ANY (ARRAY['pending'::text, 'analyzing'::text, 'needs_review'::text, 'confirmed'::text, 'failed'::text])),
  CONSTRAINT "templates_source_type_check" CHECK (source_type = ANY (ARRAY['png'::text, 'jpg'::text, 'jpeg'::text, 'pdf'::text, 'svg'::text])),
  CONSTRAINT "templates_pkey" PRIMARY KEY (id)
);

create table public."validation_results" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "generated_card_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "status" text NOT NULL,
  "checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "validation_results_status_check" CHECK (status = ANY (ARRAY['passed'::text, 'warning'::text, 'failed'::text])),
  CONSTRAINT "validation_results_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_audit_owner_created ON public.audit_logs USING btree (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch_status ON public.batch_generation_items USING btree (batch_id, status, serial_number);
CREATE INDEX IF NOT EXISTS idx_batch_items_claim ON public.batch_generation_items USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['PENDING'::text, 'FAILED'::text]));
CREATE INDEX IF NOT EXISTS idx_batch_items_output_card_id ON public.batch_generation_items USING btree (output_card_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_owner_project ON public.batch_generation_items USING btree (owner_id, project_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_project_id ON public.batch_generation_items USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_student_id ON public.batch_generation_items USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS batches_id_project_owner_security_uidx ON public.batches USING btree (id, project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_batches_project ON public.batches USING btree (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_project_status_created ON public.batches USING btree (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_requested_by ON public.batches USING btree (requested_by);
CREATE INDEX IF NOT EXISTS idx_batches_template_id ON public.batches USING btree (template_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batches_id_project_owner ON public.batches USING btree (id, project_id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batches_owner_idempotency ON public.batches USING btree (owner_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_validation_findings_card ON public.card_validation_findings USING btree (generated_card_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_findings_project_status ON public.card_validation_findings USING btree (project_id, status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_findings_student ON public.card_validation_findings USING btree (project_id, student_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_batch_project_owner ON public.exports USING btree (batch_id, project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_exports_batch_status ON public.exports USING btree (batch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_expiry ON public.exports USING btree (expires_at) WHERE (status = ANY (ARRAY['completed'::text, 'completed_with_errors'::text]));
CREATE INDEX IF NOT EXISTS idx_exports_owner_project ON public.exports USING btree (owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_exports_project_created ON public.exports USING btree (project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS generated_cards_id_owner_security_uidx ON public.generated_cards USING btree (id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS generated_cards_id_project_owner_security_uidx ON public.generated_cards USING btree (id, project_id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS generated_cards_idempotency_idx ON public.generated_cards USING btree (project_id, student_id, template_id, input_hash, output_format) WHERE ((student_id IS NOT NULL) AND (template_id IS NOT NULL) AND (input_hash IS NOT NULL) AND (output_format IS NOT NULL));
CREATE INDEX IF NOT EXISTS generated_cards_render_lookup_idx ON public.generated_cards USING btree (project_id, student_id, template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generated_cards_render_status_idx ON public.generated_cards USING btree (project_id, status, validation_status);
CREATE INDEX IF NOT EXISTS idx_cards_batch_serial ON public.generated_cards USING btree (batch_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_cards_project_status ON public.generated_cards USING btree (project_id, status);
CREATE INDEX IF NOT EXISTS idx_generated_cards_approval_status ON public.generated_cards USING btree (project_id, approval_status, status);
CREATE INDEX IF NOT EXISTS idx_generated_cards_project_status_created ON public.generated_cards USING btree (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_cards_student_template ON public.generated_cards USING btree (project_id, student_id, template_id);
CREATE INDEX IF NOT EXISTS idx_generated_cards_template_id ON public.generated_cards USING btree (template_id) WHERE (template_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_generated_cards_project_render_key ON public.generated_cards USING btree (project_id, render_key);
CREATE INDEX IF NOT EXISTS idx_jobs_batch_status ON public.processing_jobs USING btree (batch_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_owner_status ON public.processing_jobs USING btree (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.school_projects USING btree (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS school_projects_id_owner_id_security_uidx ON public.school_projects USING btree (id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_projects_id_owner ON public.school_projects USING btree (id, owner_id);
CREATE INDEX IF NOT EXISTS idx_photos_owner_project ON public.student_photos USING btree (owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_photos_project_serial ON public.student_photos USING btree (project_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_student_photos_approved_by ON public.student_photos USING btree (approved_by);
CREATE INDEX IF NOT EXISTS idx_student_photos_batch ON public.student_photos USING btree (batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_student_photos_content_hash ON public.student_photos USING btree (project_id, content_sha256) WHERE (content_sha256 IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_student_photos_duplicate_of ON public.student_photos USING btree (duplicate_of_id);
CREATE INDEX IF NOT EXISTS idx_student_photos_normalized_serial ON public.student_photos USING btree (project_id, normalized_serial_number);
CREATE INDEX IF NOT EXISTS idx_student_photos_processed_approved ON public.student_photos USING btree (project_id, student_id, processing_status) WHERE (processing_status = 'APPROVED'::text);
CREATE INDEX IF NOT EXISTS idx_student_photos_processing_queue ON public.student_photos USING btree (project_id, processing_status, created_at);
CREATE INDEX IF NOT EXISTS idx_student_photos_project_owner_fk ON public.student_photos USING btree (project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_student_photos_project_status ON public.student_photos USING btree (project_id, match_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_photos_student_project_fk ON public.student_photos USING btree (student_id, project_id);
CREATE INDEX IF NOT EXISTS idx_student_photos_student_status ON public.student_photos USING btree (project_id, student_id, match_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_photos_storage_path ON public.student_photos USING btree (storage_path);
CREATE INDEX IF NOT EXISTS idx_students_project_serial ON public.students USING btree (project_id, serial_number);
CREATE UNIQUE INDEX IF NOT EXISTS students_id_project_security_uidx ON public.students USING btree (id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_id_project ON public.students USING btree (id, project_id);
CREATE INDEX IF NOT EXISTS idx_fields_template ON public.template_fields USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_template_order ON public.template_fields USING btree (template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_template_fields_template_sort ON public.template_fields USING btree (template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_templates_project ON public.templates USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_templates_project_status ON public.templates USING btree (project_id, analysis_status);
CREATE INDEX IF NOT EXISTS idx_templates_project_version ON public.templates USING btree (project_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS templates_id_owner_security_uidx ON public.templates USING btree (id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS templates_id_project_owner_security_uidx ON public.templates USING btree (id, project_id, owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS templates_one_active_per_side_idx ON public.templates USING btree (project_id, COALESCE((render_config ->> 'side'::text), 'front'::text)) WHERE (is_active = true);
CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_active_project ON public.templates USING btree (project_id) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_validation_card_created ON public.validation_results USING btree (generated_card_id, created_at DESC);

alter table public."audit_logs" add constraint "audit_logs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."audit_logs" add constraint "audit_logs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."batch_generation_items" add constraint "batch_generation_items_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
alter table public."batch_generation_items" add constraint "batch_generation_items_output_card_id_fkey" FOREIGN KEY (output_card_id) REFERENCES generated_cards(id) ON DELETE SET NULL;
alter table public."batch_generation_items" add constraint "batch_generation_items_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."batch_generation_items" add constraint "batch_generation_items_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."batch_generation_items" add constraint "batch_generation_items_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
alter table public."batch_generation_items" add constraint "batch_items_batch_project_owner_security_fkey" FOREIGN KEY (batch_id, project_id, owner_id) REFERENCES batches(id, project_id, owner_id) ON DELETE CASCADE;
alter table public."batch_generation_items" add constraint "batch_items_student_project_security_fkey" FOREIGN KEY (student_id, project_id) REFERENCES students(id, project_id);
alter table public."batches" add constraint "batches_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."batches" add constraint "batches_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."batches" add constraint "batches_project_owner_security_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id) ON DELETE CASCADE;
alter table public."batches" add constraint "batches_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."batches" add constraint "batches_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE RESTRICT;
alter table public."batches" add constraint "batches_template_project_owner_security_fkey" FOREIGN KEY (template_id, project_id, owner_id) REFERENCES templates(id, project_id, owner_id);
alter table public."card_validation_findings" add constraint "card_validation_findings_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;
alter table public."card_validation_findings" add constraint "card_validation_findings_generated_card_id_fkey" FOREIGN KEY (generated_card_id) REFERENCES generated_cards(id) ON DELETE SET NULL;
alter table public."card_validation_findings" add constraint "card_validation_findings_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."card_validation_findings" add constraint "card_validation_findings_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."card_validation_findings" add constraint "card_validation_findings_project_owner_security_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id);
alter table public."card_validation_findings" add constraint "card_validation_findings_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."card_validation_findings" add constraint "card_validation_findings_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
alter table public."exports" add constraint "exports_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
alter table public."exports" add constraint "exports_batch_project_owner_fkey" FOREIGN KEY (batch_id, project_id, owner_id) REFERENCES batches(id, project_id, owner_id) ON DELETE CASCADE;
alter table public."exports" add constraint "exports_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."exports" add constraint "exports_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."generated_cards" add constraint "generated_cards_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."generated_cards" add constraint "generated_cards_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
alter table public."generated_cards" add constraint "generated_cards_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."generated_cards" add constraint "generated_cards_photo_id_fkey" FOREIGN KEY (photo_id) REFERENCES student_photos(id) ON DELETE SET NULL;
alter table public."generated_cards" add constraint "generated_cards_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."generated_cards" add constraint "generated_cards_project_owner_security_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id) ON DELETE CASCADE;
alter table public."generated_cards" add constraint "generated_cards_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
alter table public."generated_cards" add constraint "generated_cards_student_project_security_fkey" FOREIGN KEY (student_id, project_id) REFERENCES students(id, project_id);
alter table public."generated_cards" add constraint "generated_cards_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL;
alter table public."generated_cards" add constraint "generated_cards_template_project_owner_security_fkey" FOREIGN KEY (template_id, project_id, owner_id) REFERENCES templates(id, project_id, owner_id);
alter table public."processing_jobs" add constraint "processing_jobs_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
alter table public."processing_jobs" add constraint "processing_jobs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."processing_jobs" add constraint "processing_jobs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."processing_jobs" add constraint "processing_jobs_project_owner_security_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id) ON DELETE CASCADE;
alter table public."processing_jobs" add constraint "processing_jobs_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."school_projects" add constraint "school_projects_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."security_rate_limits" add constraint "security_rate_limits_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."student_photos" add constraint "student_photos_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."student_photos" add constraint "student_photos_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;
alter table public."student_photos" add constraint "student_photos_crop_approved_by_fkey" FOREIGN KEY (crop_approved_by) REFERENCES auth.users(id);
alter table public."student_photos" add constraint "student_photos_duplicate_of_id_fkey" FOREIGN KEY (duplicate_of_id) REFERENCES student_photos(id) ON DELETE SET NULL;
alter table public."student_photos" add constraint "student_photos_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."student_photos" add constraint "student_photos_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."student_photos" add constraint "student_photos_project_owner_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id) ON DELETE CASCADE NOT VALID NOT VALID;
alter table public."student_photos" add constraint "student_photos_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
alter table public."student_photos" add constraint "student_photos_student_project_fkey" FOREIGN KEY (student_id, project_id) REFERENCES students(id, project_id) ON DELETE SET NULL (student_id) NOT VALID NOT VALID;
alter table public."students" add constraint "students_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."students" add constraint "students_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."students" add constraint "students_project_owner_security_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id) ON DELETE CASCADE;
alter table public."template_fields" add constraint "template_fields_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."template_fields" add constraint "template_fields_template_id_fkey" FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE;
alter table public."templates" add constraint "templates_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."templates" add constraint "templates_project_id_fkey" FOREIGN KEY (project_id) REFERENCES school_projects(id) ON DELETE CASCADE;
alter table public."templates" add constraint "templates_project_owner_security_fkey" FOREIGN KEY (project_id, owner_id) REFERENCES school_projects(id, owner_id) ON DELETE CASCADE;
alter table public."validation_results" add constraint "validation_results_card_owner_security_fkey" FOREIGN KEY (generated_card_id, owner_id) REFERENCES generated_cards(id, owner_id);
alter table public."validation_results" add constraint "validation_results_generated_card_id_fkey" FOREIGN KEY (generated_card_id) REFERENCES generated_cards(id) ON DELETE CASCADE;
alter table public."validation_results" add constraint "validation_results_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.bump_template_version_for_field_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='INSERT' then
   update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   return new;
 elsif tg_op='DELETE' then
   update public.templates set version_number=version_number+1,updated_at=now() where id=old.template_id;
   return old;
 else
   if old.template_id=new.template_id then
     update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   else
     update public.templates set version_number=version_number+1,updated_at=now() where id=old.template_id;
     update public.templates set version_number=version_number+1,updated_at=now() where id=new.template_id;
   end if;
   return new;
 end if;
end $function$;


CREATE OR REPLACE FUNCTION public.capture_security_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_row jsonb;
  v_owner uuid;
  v_project uuid;
  v_entity uuid;
  v_actor uuid;
  v_old jsonb;
  v_metadata jsonb;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_owner := nullif(v_row ->> 'owner_id', '')::uuid;
  v_entity := nullif(v_row ->> 'id', '')::uuid;
  v_actor := auth.uid();
  if tg_table_name = 'school_projects' then
    v_project := v_entity;
  else
    v_project := nullif(v_row ->> 'project_id', '')::uuid;
  end if;
  if v_owner is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- During account deletion, auth.users may already be cascading away.
  if not exists (select 1 from auth.users u where u.id = v_owner) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- Null the project reference on deletes so the audit survives project deletion/cascades.
  if tg_op = 'DELETE' then v_project := null; end if;
  v_metadata := jsonb_build_object('actor_id', v_actor, 'source', 'database_trigger');
  -- Keep state-only metadata; never copy student fields, filenames, images, tokens or raw errors.
  if v_row ? 'status' then
    v_metadata := v_metadata || jsonb_build_object('status', left(coalesce(v_row ->> 'status',''), 40));
  end if;
  if v_row ? 'approval_status' then
    v_metadata := v_metadata || jsonb_build_object('approval_status', left(coalesce(v_row ->> 'approval_status',''), 40));
  end if;
  if v_row ? 'validation_status' then
    v_metadata := v_metadata || jsonb_build_object('validation_status', left(coalesce(v_row ->> 'validation_status',''), 40));
  end if;
  if v_row ? 'match_status' then
    v_metadata := v_metadata || jsonb_build_object('match_status', left(coalesce(v_row ->> 'match_status',''), 40));
  end if;
  if v_row ? 'processing_status' then
    v_metadata := v_metadata || jsonb_build_object('processing_status', left(coalesce(v_row ->> 'processing_status',''), 40));
  end if;
  if tg_op = 'UPDATE' then
    if v_old ? 'status' and v_row ? 'status' then
      v_metadata := v_metadata || jsonb_build_object('previous_status', left(coalesce(v_old ->> 'status',''),40));
    end if;
    if v_old ? 'retry_count' and v_row ? 'retry_count' then
      v_metadata := v_metadata || jsonb_build_object('retry_count', greatest(0, least(3, coalesce((v_row ->> 'retry_count')::integer,0))));
    end if;
  end if;
  insert into public.audit_logs(owner_id, project_id, action, entity_type, entity_id, metadata)
  values (v_owner, v_project, lower(tg_op), left(tg_table_name, 80), v_entity, v_metadata);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.claim_batch_generation_items(p_batch_id uuid, p_worker_id text, p_limit integer DEFAULT 3)
 RETURNS SETOF batch_generation_items
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_batch_status text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select b.owner_id, lower(b.status)
    into v_owner_id, v_batch_status
  from public.batches b
  join public.school_projects p on p.id = b.project_id
  where b.id = p_batch_id
    and b.owner_id = auth.uid()
    and p.owner_id = auth.uid()
  for update of b;

  if not found or v_owner_id is distinct from auth.uid() then
    raise exception 'batch access denied';
  end if;

  if v_batch_status not in ('queued', 'running') then
    raise exception 'batch is not claimable';
  end if;

  update public.batch_generation_items i
  set status = case when i.attempts >= i.max_attempts then 'FAILED' else 'PENDING' end,
      error_category = case when i.attempts >= i.max_attempts then 'unknown' else i.error_category end,
      error_summary = case
        when i.attempts >= i.max_attempts then 'Worker lease expired after maximum attempts.'
        else 'Recovered an expired worker lease; retry is scheduled.'
      end,
      available_at = case when i.attempts >= i.max_attempts then i.available_at else now() end,
      completed_at = case when i.attempts >= i.max_attempts then now() else null end,
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.project_id = (select b.project_id from public.batches b where b.id = p_batch_id)
    and i.owner_id = auth.uid()
    and i.status = 'PROCESSING'
    and coalesce(i.heartbeat_at, i.claimed_at, i.updated_at) < now() - interval '5 minutes';

  update public.batch_generation_items i
  set status = 'FAILED',
      error_category = coalesce(i.error_category, 'unknown'),
      error_summary = coalesce(i.error_summary, 'Maximum worker attempts exhausted.'),
      completed_at = now(),
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.owner_id = auth.uid()
    and i.status = 'PENDING'
    and i.attempts >= i.max_attempts;

  return query
  with eligible as (
    select i.id
    from public.batch_generation_items i
    where i.batch_id = p_batch_id
      and i.owner_id = auth.uid()
      and i.status = 'PENDING'
      and i.attempts < i.max_attempts
      and i.available_at <= now()
    order by i.serial_number
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 8))
  )
  update public.batch_generation_items i
  set status = 'PROCESSING',
      claimed_at = now(),
      claimed_by = left(coalesce(p_worker_id, 'worker'), 100),
      heartbeat_at = now(),
      attempts = i.attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  from eligible e
  where i.id = e.id
  returning i.*;
end;
$function$;


CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(p_action text, p_limit integer, p_window_seconds integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_uid uuid;
  v_count integer;
  v_limit integer;
  v_window_seconds integer;
begin
  v_uid := auth.uid();
  if v_uid is null then return false; end if;

  case p_action
    when 'project_create' then v_limit := 10; v_window_seconds := 3600;
    when 'template_upload' then v_limit := 10; v_window_seconds := 3600;
    when 'student_import' then v_limit := 20; v_window_seconds := 3600;
    when 'photo_upload_ticket' then v_limit := 300; v_window_seconds := 60;
    when 'photo_processing' then v_limit := 10; v_window_seconds := 60;
    when 'batch_generate' then v_limit := 5; v_window_seconds := 60;
    when 'zip_export' then v_limit := 3; v_window_seconds := 60;
    else return false;
  end case;

  -- Parameters remain for API compatibility, but must exactly match the trusted
  -- server-side quota for this action. A client cannot reset a window or raise a limit.
  if p_limit is distinct from v_limit
     or p_window_seconds is distinct from v_window_seconds then
    return false;
  end if;

  insert into public.security_rate_limits(owner_id, action, window_started_at, request_count)
  values (v_uid, p_action, now(), 1)
  on conflict (owner_id, action) do update
  set window_started_at = case
        when public.security_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then now()
        else public.security_rate_limits.window_started_at
      end,
      request_count = case
        when public.security_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds)
          then 1
        else public.security_rate_limits.request_count + 1
      end
  returning request_count into v_count;

  return v_count <= v_limit;
end;
$function$;


CREATE OR REPLACE FUNCTION public.finalize_photo_upload(p_batch_id uuid, p_project_id uuid, p_path text, p_actual_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null or p_actual_size<=0 or p_actual_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes-reserved_size+p_actual_size,photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading'
   and total_bytes-reserved_size+p_actual_size<=524288000;
 return found;
end; $function$;


CREATE OR REPLACE FUNCTION public.guard_card_validation_finding_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='INSERT' then
   if new.status in ('RESOLVED','WAIVED') and coalesce(trim(new.resolution_note),'')='' then
     raise exception 'A corrective-action note or waiver justification is required.';
   end if;
   if new.severity='CRITICAL' and new.status in ('RESOLVED','WAIVED') then
     raise exception 'Critical findings must be created open and may only close after server-side revalidation.';
   end if;
   return new;
 end if;
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
end $function$;


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.release_photo_batch_bytes(p_batch_id uuid, p_project_id uuid, p_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if p_size<=0 then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $function$;


CREATE OR REPLACE FUNCTION public.release_photo_upload(p_batch_id uuid, p_project_id uuid, p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare reserved_size bigint;
begin
 select (photo_reservations->>p_path)::bigint into reserved_size from public.batches
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading' for update;
 if reserved_size is null then return false; end if;
 update public.batches set total_bytes=greatest(0,total_bytes-reserved_size),photo_reservations=photo_reservations-p_path
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading';
 return found;
end; $function$;


CREATE OR REPLACE FUNCTION public.reserve_photo_batch_bytes(p_batch_id uuid, p_project_id uuid, p_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if p_size<=0 or p_size>10485760 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid())
   and status='uploading' and total_bytes+p_size<=524288000;
 return found;
end; $function$;


CREATE OR REPLACE FUNCTION public.reserve_photo_upload(p_batch_id uuid, p_project_id uuid, p_path text, p_size bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if p_size<=0 or p_size>10485760 or p_path is null or length(p_path)>512 then return false; end if;
 update public.batches set total_bytes=total_bytes+p_size,photo_reservations=photo_reservations||jsonb_build_object(p_path,p_size)
 where id=p_batch_id and project_id=p_project_id and owner_id=(select auth.uid()) and status='uploading'
   and not(photo_reservations ? p_path) and total_bytes+p_size<=524288000;
 return found;
end; $function$;


CREATE OR REPLACE FUNCTION public.retry_failed_batch_items(p_batch_id uuid, p_item_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select lower(b.status)
    into v_status
  from public.batches b
  join public.school_projects p on p.id = b.project_id
  where b.id = p_batch_id
    and b.owner_id = auth.uid()
    and p.owner_id = auth.uid()
  for update of b;

  if not found then
    raise exception 'batch access denied';
  end if;

  if v_status not in ('failed', 'completed_with_errors') then
    raise exception 'batch is not eligible for manual retry';
  end if;

  update public.batch_generation_items i
  set status = 'PENDING',
      attempts = 0,
      error_summary = null,
      error_category = null,
      completed_at = null,
      claimed_at = null,
      claimed_by = null,
      heartbeat_at = null,
      available_at = now(),
      updated_at = now()
  where i.batch_id = p_batch_id
    and i.owner_id = auth.uid()
    and i.status = 'FAILED'
    and (p_item_ids is null or i.id = any(p_item_ids));

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no failed items are eligible for retry';
  end if;

  update public.batches b
  set status = 'queued',
      completed_at = null,
      cancelled_at = null,
      paused_at = null,
      last_error = null,
      heartbeat_at = now()
  where b.id = p_batch_id
    and b.owner_id = auth.uid();

  return v_count;
end;
$function$;


CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;


CREATE OR REPLACE FUNCTION public.set_active_template_version(p_project_id uuid, p_template_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.templates
    set is_active = false, updated_at = now()
  where project_id = p_project_id
    and owner_id = (select auth.uid())
    and is_active = true;

  update public.templates
    set is_active = true, updated_at = now()
  where id = p_template_id
    and project_id = p_project_id
    and owner_id = (select auth.uid());
end;
$function$;


revoke all on function public."bump_template_version_for_field_change"() from public, anon, authenticated, service_role;

grant execute on function public."bump_template_version_for_field_change"() to "authenticated";

grant execute on function public."bump_template_version_for_field_change"() to "service_role";

revoke all on function public."capture_security_audit_event"() from public, anon, authenticated, service_role;

grant execute on function public."capture_security_audit_event"() to "service_role";

revoke all on function public."claim_batch_generation_items"(uuid, text, integer) from public, anon, authenticated, service_role;

grant execute on function public."claim_batch_generation_items"(uuid, text, integer) to "authenticated";

grant execute on function public."claim_batch_generation_items"(uuid, text, integer) to "service_role";

revoke all on function public."consume_security_rate_limit"(text, integer, integer) from public, anon, authenticated, service_role;

grant execute on function public."consume_security_rate_limit"(text, integer, integer) to "authenticated";

grant execute on function public."consume_security_rate_limit"(text, integer, integer) to "service_role";

revoke all on function public."finalize_photo_upload"(uuid, uuid, text, bigint) from public, anon, authenticated, service_role;

grant execute on function public."finalize_photo_upload"(uuid, uuid, text, bigint) to "authenticated";

grant execute on function public."finalize_photo_upload"(uuid, uuid, text, bigint) to "service_role";

revoke all on function public."guard_card_validation_finding_transition"() from public, anon, authenticated, service_role;

grant execute on function public."guard_card_validation_finding_transition"() to "authenticated";

grant execute on function public."guard_card_validation_finding_transition"() to "service_role";

revoke all on function public."handle_new_user"() from public, anon, authenticated, service_role;

grant execute on function public."handle_new_user"() to "authenticated";

grant execute on function public."handle_new_user"() to "service_role";

revoke all on function public."release_photo_batch_bytes"(uuid, uuid, bigint) from public, anon, authenticated, service_role;

grant execute on function public."release_photo_batch_bytes"(uuid, uuid, bigint) to "authenticated";

grant execute on function public."release_photo_batch_bytes"(uuid, uuid, bigint) to "service_role";

revoke all on function public."release_photo_upload"(uuid, uuid, text) from public, anon, authenticated, service_role;

grant execute on function public."release_photo_upload"(uuid, uuid, text) to "authenticated";

grant execute on function public."release_photo_upload"(uuid, uuid, text) to "service_role";

revoke all on function public."reserve_photo_batch_bytes"(uuid, uuid, bigint) from public, anon, authenticated, service_role;

grant execute on function public."reserve_photo_batch_bytes"(uuid, uuid, bigint) to "authenticated";

grant execute on function public."reserve_photo_batch_bytes"(uuid, uuid, bigint) to "service_role";

revoke all on function public."reserve_photo_upload"(uuid, uuid, text, bigint) from public, anon, authenticated, service_role;

grant execute on function public."reserve_photo_upload"(uuid, uuid, text, bigint) to "authenticated";

grant execute on function public."reserve_photo_upload"(uuid, uuid, text, bigint) to "service_role";

revoke all on function public."retry_failed_batch_items"(uuid, uuid[]) from public, anon, authenticated, service_role;

grant execute on function public."retry_failed_batch_items"(uuid, uuid[]) to "authenticated";

grant execute on function public."retry_failed_batch_items"(uuid, uuid[]) to "service_role";

revoke all on function public."rls_auto_enable"() from public, anon, authenticated, service_role;

grant execute on function public."rls_auto_enable"() to "service_role";

revoke all on function public."set_active_template_version"(uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function public."set_active_template_version"(uuid, uuid) to "authenticated";

grant execute on function public."set_active_template_version"(uuid, uuid) to "service_role";

revoke all privileges on table public."audit_logs" from public, anon, authenticated, service_role;

grant SELECT on table public."audit_logs" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."audit_logs" to "service_role";

revoke all privileges on table public."batch_generation_items" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."batch_generation_items" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."batch_generation_items" to "service_role";

revoke all privileges on table public."batches" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."batches" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."batches" to "service_role";

revoke all privileges on table public."card_validation_findings" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."card_validation_findings" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."card_validation_findings" to "service_role";

revoke all privileges on table public."exports" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."exports" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."exports" to "service_role";

revoke all privileges on table public."generated_cards" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."generated_cards" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."generated_cards" to "service_role";

revoke all privileges on table public."processing_jobs" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."processing_jobs" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."processing_jobs" to "service_role";

revoke all privileges on table public."profiles" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."profiles" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."profiles" to "service_role";

revoke all privileges on table public."school_projects" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."school_projects" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."school_projects" to "service_role";

revoke all privileges on table public."security_rate_limits" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."security_rate_limits" to "service_role";

revoke all privileges on table public."student_photos" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."student_photos" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."student_photos" to "service_role";

revoke all privileges on table public."students" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."students" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."students" to "service_role";

revoke all privileges on table public."template_fields" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."template_fields" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."template_fields" to "service_role";

revoke all privileges on table public."templates" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."templates" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."templates" to "service_role";

revoke all privileges on table public."validation_results" from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public."validation_results" to "authenticated";

grant SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table public."validation_results" to "service_role";

grant usage on schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

alter table public."audit_logs" enable row level security;

alter table public."batch_generation_items" enable row level security;

alter table public."batches" enable row level security;

alter table public."card_validation_findings" enable row level security;

alter table public."exports" enable row level security;

alter table public."generated_cards" enable row level security;

alter table public."processing_jobs" enable row level security;

alter table public."profiles" enable row level security;

alter table public."school_projects" enable row level security;

alter table public."security_rate_limits" enable row level security;

alter table public."student_photos" enable row level security;

alter table public."students" enable row level security;

alter table public."template_fields" enable row level security;

alter table public."templates" enable row level security;

alter table public."validation_results" enable row level security;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-exports','printforge-exports',false,104857600,array['application/zip', 'application/pdf']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-generated-cards','printforge-generated-cards',false,20971520,array['image/png', 'image/jpeg', 'application/pdf']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-private','printforge-private',false,null,null) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-student-photos','printforge-student-photos',false,10485760,array['image/jpeg', 'image/png', 'image/webp']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('printforge-templates','printforge-templates',false,20971520,array['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']::text[]) on conflict (id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

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
