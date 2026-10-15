export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          owner_id: string
          project_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          owner_id: string
          project_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_generation_items: {
        Row: {
          attempts: number
          available_at: string
          batch_id: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          error_category: string | null
          error_summary: string | null
          heartbeat_at: string | null
          id: string
          input_fingerprint: string | null
          last_attempt_at: string | null
          max_attempts: number
          output_card_id: string | null
          output_storage_path: string | null
          owner_id: string
          project_id: string
          serial_number: number | null
          status: string
          student_id: string
          student_identifier: string | null
          student_name: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          batch_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_category?: string | null
          error_summary?: string | null
          heartbeat_at?: string | null
          id?: string
          input_fingerprint?: string | null
          last_attempt_at?: string | null
          max_attempts?: number
          output_card_id?: string | null
          output_storage_path?: string | null
          owner_id: string
          project_id: string
          serial_number?: number | null
          status?: string
          student_id: string
          student_identifier?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          batch_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_category?: string | null
          error_summary?: string | null
          heartbeat_at?: string | null
          id?: string
          input_fingerprint?: string | null
          last_attempt_at?: string | null
          max_attempts?: number
          output_card_id?: string | null
          output_storage_path?: string | null
          owner_id?: string
          project_id?: string
          serial_number?: number | null
          status?: string
          student_id?: string
          student_identifier?: string | null
          student_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_generation_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_generation_items_output_card_id_fkey"
            columns: ["output_card_id"]
            isOneToOne: false
            referencedRelation: "generated_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_generation_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_generation_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_batch_project_owner_security_fkey"
            columns: ["batch_id", "project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id", "project_id", "owner_id"]
          },
          {
            foreignKeyName: "batch_items_student_project_security_fkey"
            columns: ["student_id", "project_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      batches: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          completed_count: number
          config_snapshot: Json
          created_at: string
          eligible_count: number
          failed_count: number
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          name: string
          owner_id: string
          paused_at: string | null
          photo_reservations: Json
          processing_count: number
          project_id: string
          requested_by: string | null
          reused_count: number
          review_count: number
          skipped_count: number
          started_at: string | null
          status: string
          template_id: string | null
          template_version: number | null
          total_bytes: number
          total_count: number
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          completed_count?: number
          config_snapshot?: Json
          created_at?: string
          eligible_count?: number
          failed_count?: number
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          name: string
          owner_id: string
          paused_at?: string | null
          photo_reservations?: Json
          processing_count?: number
          project_id: string
          requested_by?: string | null
          reused_count?: number
          review_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          template_version?: number | null
          total_bytes?: number
          total_count?: number
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          completed_count?: number
          config_snapshot?: Json
          created_at?: string
          eligible_count?: number
          failed_count?: number
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          name?: string
          owner_id?: string
          paused_at?: string | null
          photo_reservations?: Json
          processing_count?: number
          project_id?: string
          requested_by?: string | null
          reused_count?: number
          review_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          template_version?: number | null
          total_bytes?: number
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "batches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_project_owner_security_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_template_project_owner_security_fkey"
            columns: ["template_id", "project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "project_id", "owner_id"]
          },
        ]
      }
      card_validation_findings: {
        Row: {
          asset_ref: string | null
          batch_id: string | null
          corrective_action: string
          created_at: string
          details: Json
          detected_at: string
          field_ref: string | null
          finding_key: string
          generated_card_id: string | null
          id: string
          input_fingerprint: string
          message: string
          owner_id: string
          project_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string
          rule_version: number
          severity: string
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          asset_ref?: string | null
          batch_id?: string | null
          corrective_action: string
          created_at?: string
          details?: Json
          detected_at?: string
          field_ref?: string | null
          finding_key: string
          generated_card_id?: string | null
          id?: string
          input_fingerprint: string
          message: string
          owner_id: string
          project_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id: string
          rule_version?: number
          severity: string
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_ref?: string | null
          batch_id?: string | null
          corrective_action?: string
          created_at?: string
          details?: Json
          detected_at?: string
          field_ref?: string | null
          finding_key?: string
          generated_card_id?: string | null
          id?: string
          input_fingerprint?: string
          message?: string
          owner_id?: string
          project_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string
          rule_version?: number
          severity?: string
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_validation_findings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_validation_findings_generated_card_id_fkey"
            columns: ["generated_card_id"]
            isOneToOne: false
            referencedRelation: "generated_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_validation_findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_validation_findings_project_owner_security_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "card_validation_findings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          archive_bytes: number | null
          archive_sha256: string | null
          batch_id: string
          completed_at: string | null
          created_at: string
          eligible_count: number
          error_summary: string | null
          excluded_count: number
          excluded_snapshot: Json
          expires_at: string | null
          failed_item_count: number
          filename: string
          id: string
          item_snapshot: Json
          manifest: Json
          options: Json
          owner_id: string
          packaged_file_count: number
          project_id: string
          retry_count: number
          retryable: boolean
          selected_count: number
          started_at: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          archive_bytes?: number | null
          archive_sha256?: string | null
          batch_id: string
          completed_at?: string | null
          created_at?: string
          eligible_count?: number
          error_summary?: string | null
          excluded_count?: number
          excluded_snapshot?: Json
          expires_at?: string | null
          failed_item_count?: number
          filename: string
          id?: string
          item_snapshot?: Json
          manifest?: Json
          options?: Json
          owner_id: string
          packaged_file_count?: number
          project_id: string
          retry_count?: number
          retryable?: boolean
          selected_count?: number
          started_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          archive_bytes?: number | null
          archive_sha256?: string | null
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          eligible_count?: number
          error_summary?: string | null
          excluded_count?: number
          excluded_snapshot?: Json
          expires_at?: string | null
          failed_item_count?: number
          filename?: string
          id?: string
          item_snapshot?: Json
          manifest?: Json
          options?: Json
          owner_id?: string
          packaged_file_count?: number
          project_id?: string
          retry_count?: number
          retryable?: boolean
          selected_count?: number
          started_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_batch_project_owner_fkey"
            columns: ["batch_id", "project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id", "project_id", "owner_id"]
          },
          {
            foreignKeyName: "exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_cards: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          back_storage_path: string | null
          batch_id: string | null
          card_side: string
          created_at: string
          filename: string
          front_storage_path: string | null
          generated_at: string | null
          id: string
          input_hash: string | null
          output_dpi: number | null
          output_format: string | null
          output_hash: string | null
          output_height_mm: number | null
          output_height_px: number | null
          output_sha256: string | null
          output_width_mm: number | null
          output_width_px: number | null
          owner_id: string
          photo_id: string | null
          photo_version: number | null
          project_id: string
          render_config_snapshot: Json
          render_errors: Json
          render_input_hash: string | null
          render_key: string | null
          render_warnings: Json
          rendered_at: string | null
          renderer_version: string | null
          serial_number: number | null
          status: string
          storage_path: string | null
          student_id: string | null
          student_identifier: string | null
          template_id: string | null
          template_version: number | null
          validation_errors: Json
          validation_fingerprint: string | null
          validation_status: string
          validation_warnings: Json
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          back_storage_path?: string | null
          batch_id?: string | null
          card_side?: string
          created_at?: string
          filename: string
          front_storage_path?: string | null
          generated_at?: string | null
          id?: string
          input_hash?: string | null
          output_dpi?: number | null
          output_format?: string | null
          output_hash?: string | null
          output_height_mm?: number | null
          output_height_px?: number | null
          output_sha256?: string | null
          output_width_mm?: number | null
          output_width_px?: number | null
          owner_id: string
          photo_id?: string | null
          photo_version?: number | null
          project_id: string
          render_config_snapshot?: Json
          render_errors?: Json
          render_input_hash?: string | null
          render_key?: string | null
          render_warnings?: Json
          rendered_at?: string | null
          renderer_version?: string | null
          serial_number?: number | null
          status?: string
          storage_path?: string | null
          student_id?: string | null
          student_identifier?: string | null
          template_id?: string | null
          template_version?: number | null
          validation_errors?: Json
          validation_fingerprint?: string | null
          validation_status?: string
          validation_warnings?: Json
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          back_storage_path?: string | null
          batch_id?: string | null
          card_side?: string
          created_at?: string
          filename?: string
          front_storage_path?: string | null
          generated_at?: string | null
          id?: string
          input_hash?: string | null
          output_dpi?: number | null
          output_format?: string | null
          output_hash?: string | null
          output_height_mm?: number | null
          output_height_px?: number | null
          output_sha256?: string | null
          output_width_mm?: number | null
          output_width_px?: number | null
          owner_id?: string
          photo_id?: string | null
          photo_version?: number | null
          project_id?: string
          render_config_snapshot?: Json
          render_errors?: Json
          render_input_hash?: string | null
          render_key?: string | null
          render_warnings?: Json
          rendered_at?: string | null
          renderer_version?: string | null
          serial_number?: number | null
          status?: string
          storage_path?: string | null
          student_id?: string | null
          student_identifier?: string | null
          template_id?: string | null
          template_version?: number | null
          validation_errors?: Json
          validation_fingerprint?: string | null
          validation_status?: string
          validation_warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_cards_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_cards_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "student_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_cards_project_owner_security_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "generated_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_cards_student_project_security_fkey"
            columns: ["student_id", "project_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "generated_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_cards_template_project_owner_security_fkey"
            columns: ["template_id", "project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "project_id", "owner_id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempts: number
          batch_id: string
          confidence: number | null
          created_at: string
          error_message: string | null
          id: string
          owner_id: string
          project_id: string
          serial_number: number | null
          status: string
          student_id: string | null
          student_identifier: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_id: string
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id: string
          project_id: string
          serial_number?: number | null
          status?: string
          student_id?: string | null
          student_identifier?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_id?: string
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          owner_id?: string
          project_id?: string
          serial_number?: number | null
          status?: string
          student_id?: string | null
          student_identifier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_project_owner_security_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "processing_jobs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_projects: {
        Row: {
          academic_session: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          photo_processing_settings: Json
          photo_serial_prefix: string | null
          school_address: string | null
          school_name: string
          status: string
          student_identifier_settings: Json
          updated_at: string
          validation_settings: Json
        }
        Insert: {
          academic_session?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          photo_processing_settings?: Json
          photo_serial_prefix?: string | null
          school_address?: string | null
          school_name: string
          status?: string
          student_identifier_settings?: Json
          updated_at?: string
          validation_settings?: Json
        }
        Update: {
          academic_session?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          photo_processing_settings?: Json
          photo_serial_prefix?: string | null
          school_address?: string | null
          school_name?: string
          status?: string
          student_identifier_settings?: Json
          updated_at?: string
          validation_settings?: Json
        }
        Relationships: []
      }
      security_rate_limits: {
        Row: {
          action: string
          owner_id: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          action: string
          owner_id: string
          request_count?: number
          window_started_at?: string
        }
        Update: {
          action?: string
          owner_id?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      student_photos: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          content_sha256: string | null
          created_at: string
          crop_approved_at: string | null
          crop_approved_by: string | null
          crop_coordinates: Json
          crop_settings: Json
          detection_confidence: number | null
          duplicate_of_id: string | null
          face_count: number | null
          file_size_bytes: number | null
          height_px: number | null
          id: string
          image_version: number
          match_confidence: number | null
          match_status: string
          matching_method: string | null
          mime_type: string
          normalized_serial_number: string | null
          original_filename: string
          original_height_px: number | null
          original_orientation: number | null
          original_serial_number: string | null
          original_width_px: number | null
          output_aspect_ratio: number | null
          output_height_px: number | null
          output_width_px: number | null
          owner_id: string
          processed_at: string | null
          processed_storage_path: string | null
          processing_attempts: number
          processing_error_code: string | null
          processing_status: string
          processing_version: number
          processing_warnings: Json
          project_id: string
          serial_number: number | null
          storage_path: string
          student_id: string | null
          student_identifier: string | null
          updated_at: string
          validation_errors: Json
          width_px: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          content_sha256?: string | null
          created_at?: string
          crop_approved_at?: string | null
          crop_approved_by?: string | null
          crop_coordinates?: Json
          crop_settings?: Json
          detection_confidence?: number | null
          duplicate_of_id?: string | null
          face_count?: number | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          image_version?: number
          match_confidence?: number | null
          match_status?: string
          matching_method?: string | null
          mime_type: string
          normalized_serial_number?: string | null
          original_filename: string
          original_height_px?: number | null
          original_orientation?: number | null
          original_serial_number?: string | null
          original_width_px?: number | null
          output_aspect_ratio?: number | null
          output_height_px?: number | null
          output_width_px?: number | null
          owner_id: string
          processed_at?: string | null
          processed_storage_path?: string | null
          processing_attempts?: number
          processing_error_code?: string | null
          processing_status?: string
          processing_version?: number
          processing_warnings?: Json
          project_id: string
          serial_number?: number | null
          storage_path: string
          student_id?: string | null
          student_identifier?: string | null
          updated_at?: string
          validation_errors?: Json
          width_px?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          content_sha256?: string | null
          created_at?: string
          crop_approved_at?: string | null
          crop_approved_by?: string | null
          crop_coordinates?: Json
          crop_settings?: Json
          detection_confidence?: number | null
          duplicate_of_id?: string | null
          face_count?: number | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          image_version?: number
          match_confidence?: number | null
          match_status?: string
          matching_method?: string | null
          mime_type?: string
          normalized_serial_number?: string | null
          original_filename?: string
          original_height_px?: number | null
          original_orientation?: number | null
          original_serial_number?: string | null
          original_width_px?: number | null
          output_aspect_ratio?: number | null
          output_height_px?: number | null
          output_width_px?: number | null
          owner_id?: string
          processed_at?: string | null
          processed_storage_path?: string | null
          processing_attempts?: number
          processing_error_code?: string | null
          processing_status?: string
          processing_version?: number
          processing_warnings?: Json
          project_id?: string
          serial_number?: number | null
          storage_path?: string
          student_id?: string | null
          student_identifier?: string | null
          updated_at?: string
          validation_errors?: Json
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_photos_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "student_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_photos_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "student_photos_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_photos_student_project_fkey"
            columns: ["student_id", "project_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          data: Json
          id: string
          owner_id: string
          project_id: string
          serial_number: number | null
          source_row: number | null
          student_identifier: string | null
          student_identifier_review_required: boolean
          student_identifier_source: string
          student_identifier_unique: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          owner_id: string
          project_id: string
          serial_number?: number | null
          source_row?: number | null
          student_identifier?: string | null
          student_identifier_review_required?: boolean
          student_identifier_source?: string
          student_identifier_unique?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string
          project_id?: string
          serial_number?: number | null
          source_row?: number | null
          student_identifier?: string | null
          student_identifier_review_required?: boolean
          student_identifier_source?: string
          student_identifier_unique?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_project_owner_security_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      template_fields: {
        Row: {
          alignment: string | null
          auto_shrink: boolean
          color: string | null
          confidence: number | null
          created_at: string
          field_format: string | null
          field_type: string
          fit_mode: string | null
          font_family: string | null
          font_size: number | null
          font_weight: string | null
          height: number
          id: string
          key: string
          label: string
          line_height: number
          max_lines: number
          min_font_size: number
          overflow_policy: string
          owner_id: string
          render_options: Json
          required: boolean
          rotation: number
          sort_order: number
          source_column: string | null
          static_value: string | null
          template_id: string
          vertical_alignment: string
          visible: boolean
          width: number
          x: number
          y: number
        }
        Insert: {
          alignment?: string | null
          auto_shrink?: boolean
          color?: string | null
          confidence?: number | null
          created_at?: string
          field_format?: string | null
          field_type?: string
          fit_mode?: string | null
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height?: number
          id?: string
          key: string
          label: string
          line_height?: number
          max_lines?: number
          min_font_size?: number
          overflow_policy?: string
          owner_id: string
          render_options?: Json
          required?: boolean
          rotation?: number
          sort_order?: number
          source_column?: string | null
          static_value?: string | null
          template_id: string
          vertical_alignment?: string
          visible?: boolean
          width?: number
          x?: number
          y?: number
        }
        Update: {
          alignment?: string | null
          auto_shrink?: boolean
          color?: string | null
          confidence?: number | null
          created_at?: string
          field_format?: string | null
          field_type?: string
          fit_mode?: string | null
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height?: number
          id?: string
          key?: string
          label?: string
          line_height?: number
          max_lines?: number
          min_font_size?: number
          overflow_policy?: string
          owner_id?: string
          render_options?: Json
          required?: boolean
          rotation?: number
          sort_order?: number
          source_column?: string | null
          static_value?: string | null
          template_id?: string
          vertical_alignment?: string
          visible?: boolean
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          analysis: Json
          analysis_status: string
          created_at: string
          height_px: number | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          project_id: string
          render_config: Json
          source_path: string | null
          source_type: string
          updated_at: string
          version_number: number
          width_px: number | null
        }
        Insert: {
          analysis?: Json
          analysis_status?: string
          created_at?: string
          height_px?: number | null
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          project_id: string
          render_config?: Json
          source_path?: string | null
          source_type: string
          updated_at?: string
          version_number?: number
          width_px?: number | null
        }
        Update: {
          analysis?: Json
          analysis_status?: string
          created_at?: string
          height_px?: number | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          project_id?: string
          render_config?: Json
          source_path?: string | null
          source_type?: string
          updated_at?: string
          version_number?: number
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_project_owner_security_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      validation_results: {
        Row: {
          checks: Json
          created_at: string
          generated_card_id: string
          id: string
          owner_id: string
          status: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          generated_card_id: string
          id?: string
          owner_id: string
          status: string
        }
        Update: {
          checks?: Json
          created_at?: string
          generated_card_id?: string
          id?: string
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_results_card_owner_security_fkey"
            columns: ["generated_card_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "generated_cards"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "validation_results_generated_card_id_fkey"
            columns: ["generated_card_id"]
            isOneToOne: false
            referencedRelation: "generated_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_batch_generation_items: {
        Args: { p_batch_id: string; p_limit?: number; p_worker_id: string }
        Returns: {
          attempts: number
          available_at: string
          batch_id: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          error_category: string | null
          error_summary: string | null
          heartbeat_at: string | null
          id: string
          input_fingerprint: string | null
          last_attempt_at: string | null
          max_attempts: number
          output_card_id: string | null
          output_storage_path: string | null
          owner_id: string
          project_id: string
          serial_number: number | null
          status: string
          student_id: string
          student_identifier: string | null
          student_name: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "batch_generation_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_security_rate_limit: {
        Args: { p_action: string; p_limit: number; p_window_seconds?: number }
        Returns: boolean
      }
      correct_student_identifier: {
        Args: {
          p_data: Json
          p_legacy_serial_number: number
          p_project_id: string
          p_student_id: string
          p_student_identifier: string
        }
        Returns: string
      }
      finalize_photo_upload: {
        Args: {
          p_actual_size: number
          p_batch_id: string
          p_path: string
          p_project_id: string
        }
        Returns: boolean
      }
      record_export_download_link_issued: {
        Args: { p_export_id: string; p_project_id: string }
        Returns: boolean
      }
      release_photo_batch_bytes: {
        Args: { p_batch_id: string; p_project_id: string; p_size: number }
        Returns: boolean
      }
      release_photo_upload: {
        Args: { p_batch_id: string; p_path: string; p_project_id: string }
        Returns: boolean
      }
      reserve_photo_batch_bytes: {
        Args: { p_batch_id: string; p_project_id: string; p_size: number }
        Returns: boolean
      }
      reserve_photo_upload: {
        Args: {
          p_batch_id: string
          p_path: string
          p_project_id: string
          p_size: number
        }
        Returns: boolean
      }
      retry_failed_batch_items: {
        Args: { p_batch_id: string; p_item_ids?: string[] }
        Returns: number
      }
      set_active_template_version: {
        Args: { p_project_id: string; p_template_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
