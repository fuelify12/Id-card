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
      batches: {
        Row: {
          completed_at: string | null
          completed_count: number
          created_at: string
          failed_count: number
          id: string
          name: string
          owner_id: string
          project_id: string
          review_count: number
          started_at: string | null
          status: string
          total_count: number
        }
        Insert: {
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          failed_count?: number
          id?: string
          name: string
          owner_id: string
          project_id: string
          review_count?: number
          started_at?: string | null
          status?: string
          total_count?: number
        }
        Update: {
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          failed_count?: number
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          review_count?: number
          started_at?: string | null
          status?: string
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
        ]
      }
      exports: {
        Row: {
          batch_id: string
          created_at: string
          filename: string
          id: string
          owner_id: string
          project_id: string
          status: string
          storage_path: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          filename: string
          id?: string
          owner_id: string
          project_id: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          filename?: string
          id?: string
          owner_id?: string
          project_id?: string
          status?: string
          storage_path?: string | null
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
          batch_id: string
          created_at: string
          filename: string
          id: string
          owner_id: string
          project_id: string
          serial_number: number
          status: string
          storage_path: string | null
          student_id: string | null
          validation_status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          filename: string
          id?: string
          owner_id: string
          project_id: string
          serial_number: number
          status?: string
          storage_path?: string | null
          student_id?: string | null
          validation_status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          filename?: string
          id?: string
          owner_id?: string
          project_id?: string
          serial_number?: number
          status?: string
          storage_path?: string | null
          student_id?: string | null
          validation_status?: string
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
            foreignKeyName: "generated_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
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
          serial_number: number
          status: string
          student_id: string | null
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
          serial_number: number
          status?: string
          student_id?: string | null
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
          serial_number?: number
          status?: string
          student_id?: string | null
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
          school_address: string | null
          school_name: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_session?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          school_address?: string | null
          school_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_session?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          school_address?: string | null
          school_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_photos: {
        Row: {
          created_at: string
          crop_settings: Json
          height_px: number | null
          id: string
          match_confidence: number | null
          match_status: string
          mime_type: string
          original_filename: string
          owner_id: string
          project_id: string
          serial_number: number
          storage_path: string
          student_id: string | null
          updated_at: string
          width_px: number | null
        }
        Insert: {
          created_at?: string
          crop_settings?: Json
          height_px?: number | null
          id?: string
          match_confidence?: number | null
          match_status?: string
          mime_type: string
          original_filename: string
          owner_id: string
          project_id: string
          serial_number: number
          storage_path: string
          student_id?: string | null
          updated_at?: string
          width_px?: number | null
        }
        Update: {
          created_at?: string
          crop_settings?: Json
          height_px?: number | null
          id?: string
          match_confidence?: number | null
          match_status?: string
          mime_type?: string
          original_filename?: string
          owner_id?: string
          project_id?: string
          serial_number?: number
          storage_path?: string
          student_id?: string | null
          updated_at?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "school_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_photos_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
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
          serial_number: number
          source_row: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          owner_id: string
          project_id: string
          serial_number: number
          source_row?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string
          project_id?: string
          serial_number?: number
          source_row?: number | null
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
        ]
      }
      template_fields: {
        Row: {
          alignment: string | null
          color: string | null
          confidence: number | null
          created_at: string
          field_type: string
          fit_mode: string | null
          font_family: string | null
          font_size: number | null
          font_weight: string | null
          height: number
          id: string
          key: string
          label: string
          owner_id: string
          required: boolean
          sort_order: number
          source_column: string | null
          template_id: string
          width: number
          x: number
          y: number
        }
        Insert: {
          alignment?: string | null
          color?: string | null
          confidence?: number | null
          created_at?: string
          field_type?: string
          fit_mode?: string | null
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height?: number
          id?: string
          key: string
          label: string
          owner_id: string
          required?: boolean
          sort_order?: number
          source_column?: string | null
          template_id: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          alignment?: string | null
          color?: string | null
          confidence?: number | null
          created_at?: string
          field_type?: string
          fit_mode?: string | null
          font_family?: string | null
          font_size?: number | null
          font_weight?: string | null
          height?: number
          id?: string
          key?: string
          label?: string
          owner_id?: string
          required?: boolean
          sort_order?: number
          source_column?: string | null
          template_id?: string
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
          name: string
          owner_id: string
          project_id: string
          source_path: string | null
          source_type: string
          updated_at: string
          width_px: number | null
        }
        Insert: {
          analysis?: Json
          analysis_status?: string
          created_at?: string
          height_px?: number | null
          id?: string
          name: string
          owner_id: string
          project_id: string
          source_path?: string | null
          source_type: string
          updated_at?: string
          width_px?: number | null
        }
        Update: {
          analysis?: Json
          analysis_status?: string
          created_at?: string
          height_px?: number | null
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          source_path?: string | null
          source_type?: string
          updated_at?: string
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
      [_ in never]: never
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
