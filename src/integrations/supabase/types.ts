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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          contact_id: string | null
          count: number | null
          created_at: string
          id: string
          profile_id: string | null
          service_id: string
          status: string
        }
        Insert: {
          contact_id?: string | null
          count?: number | null
          created_at?: string
          id?: string
          profile_id?: string | null
          service_id: string
          status?: string
        }
        Update: {
          contact_id?: string | null
          count?: number | null
          created_at?: string
          id?: string
          profile_id?: string | null
          service_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          allocated_amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          fiscal_year: number
          id: string
          notes: string | null
          remaining_amount: number | null
          service_id: string | null
          spent_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          fiscal_year: number
          id?: string
          notes?: string | null
          remaining_amount?: number | null
          service_id?: string | null
          spent_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          fiscal_year?: number
          id?: string
          notes?: string | null
          remaining_amount?: number | null
          service_id?: string | null
          spent_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_type: string
          created_at: string
          email: string
          first_visit_date: string | null
          full_name: string
          id: string
          is_active: boolean
          last_visit_date: string | null
          member_code: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          visit_count: number | null
        }
        Insert: {
          contact_type?: string
          created_at?: string
          email: string
          first_visit_date?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          last_visit_date?: string | null
          member_code?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          visit_count?: number | null
        }
        Update: {
          contact_type?: string
          created_at?: string
          email?: string
          first_visit_date?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_visit_date?: string | null
          member_code?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          visit_count?: number | null
        }
        Relationships: []
      }
      event_reminders: {
        Row: {
          created_at: string
          id: string
          message: string | null
          reminder_type: string
          send_before_hours: number
          sent_at: string | null
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          reminder_type: string
          send_before_hours: number
          sent_at?: string | null
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          reminder_type?: string
          send_before_hours?: number
          sent_at?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_approvals: {
        Row: {
          action: string
          approver_id: string
          comments: string | null
          created_at: string
          expense_request_id: string
          id: string
        }
        Insert: {
          action: string
          approver_id: string
          comments?: string | null
          created_at?: string
          expense_request_id: string
          id?: string
        }
        Update: {
          action?: string
          approver_id?: string
          comments?: string | null
          created_at?: string
          expense_request_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_approvals_expense_request_id_fkey"
            columns: ["expense_request_id"]
            isOneToOne: false
            referencedRelation: "expense_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_receipts: {
        Row: {
          expense_request_id: string
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          expense_request_id: string
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          expense_request_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_expense_request_id_fkey"
            columns: ["expense_request_id"]
            isOneToOne: false
            referencedRelation: "expense_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_requests: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          currency: string
          description: string
          due_date: string | null
          id: string
          justification: string
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_reference: string | null
          priority: string
          rejection_reason: string | null
          request_number: string | null
          requester_id: string
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          currency?: string
          description: string
          due_date?: string | null
          id?: string
          justification: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          priority?: string
          rejection_reason?: string | null
          request_number?: string | null
          requester_id: string
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          currency?: string
          description?: string
          due_date?: string | null
          id?: string
          justification?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          priority?: string
          rejection_reason?: string | null
          request_number?: string | null
          requester_id?: string
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      giving_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      givings: {
        Row: {
          amount: number
          created_at: string
          currency: string
          giving_type_id: string
          id: string
          is_anonymous: boolean
          note: string | null
          payment_method: string
          payment_reference: string | null
          profile_id: string
          service_id: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          giving_type_id: string
          id?: string
          is_anonymous?: boolean
          note?: string | null
          payment_method: string
          payment_reference?: string | null
          profile_id: string
          service_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          giving_type_id?: string
          id?: string
          is_anonymous?: boolean
          note?: string | null
          payment_method?: string
          payment_reference?: string | null
          profile_id?: string
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "givings_giving_type_id_fkey"
            columns: ["giving_type_id"]
            isOneToOne: false
            referencedRelation: "giving_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "givings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "givings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          email: string
          id: string
          ip_address: unknown
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          email: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          email?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
        }
        Relationships: []
      }
      member_invitations: {
        Row: {
          attended_at: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          invitation_method: string | null
          invited_at: string | null
          invitee_email: string | null
          invitee_name: string
          invitee_phone: string
          member_id: string
          notes: string | null
          status: string
          target_service_id: string | null
          updated_at: string
        }
        Insert: {
          attended_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          invitation_method?: string | null
          invited_at?: string | null
          invitee_email?: string | null
          invitee_name: string
          invitee_phone: string
          member_id: string
          notes?: string | null
          status?: string
          target_service_id?: string | null
          updated_at?: string
        }
        Update: {
          attended_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          invitation_method?: string | null
          invited_at?: string | null
          invitee_email?: string | null
          invitee_name?: string
          invitee_phone?: string
          member_id?: string
          notes?: string | null
          status?: string
          target_service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invitations_target_service_id_fkey"
            columns: ["target_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      mobilization_targets: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          service_id: string
          set_by: string | null
          target_confirmations: number
          target_invitations: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          service_id: string
          set_by?: string | null
          target_confirmations: number
          target_invitations: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          service_id?: string
          set_by?: string | null
          target_confirmations?: number
          target_invitations?: number
        }
        Relationships: [
          {
            foreignKeyName: "mobilization_targets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          answered: boolean
          body: string
          created_at: string
          follow_up_notes: string | null
          id: string
          is_anonymous_to_congregation: boolean
          profile_id: string
          service_id: string | null
          title: string | null
          visibility: string
        }
        Insert: {
          answered?: boolean
          body: string
          created_at?: string
          follow_up_notes?: string | null
          id?: string
          is_anonymous_to_congregation?: boolean
          profile_id: string
          service_id?: string | null
          title?: string | null
          visibility?: string
        }
        Update: {
          answered?: boolean
          body?: string
          created_at?: string
          follow_up_notes?: string | null
          id?: string
          is_anonymous_to_congregation?: boolean
          profile_id?: string
          service_id?: string | null
          title?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          member_code: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          member_code?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          member_code?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          giving_id: string
          id: string
          parse_status: string
          parsed_amount: number | null
          parsed_currency: string | null
          parsed_date: string | null
          parsed_reference: string | null
          raw_ocr_text: string | null
          storage_path: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          giving_id: string
          id?: string
          parse_status?: string
          parsed_amount?: number | null
          parsed_currency?: string | null
          parsed_date?: string | null
          parsed_reference?: string | null
          raw_ocr_text?: string | null
          storage_path: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          giving_id?: string
          id?: string
          parse_status?: string
          parsed_amount?: number | null
          parsed_currency?: string | null
          parsed_date?: string | null
          parsed_reference?: string | null
          raw_ocr_text?: string | null
          storage_path?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_giving_id_fkey"
            columns: ["giving_id"]
            isOneToOne: false
            referencedRelation: "givings"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean | null
          is_published: boolean | null
          location: string | null
          name: string
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"] | null
          start_time: string | null
          total_attendance: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_published?: boolean | null
          location?: string | null
          name: string
          service_date: string
          service_type?: Database["public"]["Enums"]["service_type"] | null
          start_time?: string | null
          total_attendance?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_published?: boolean | null
          location?: string | null
          name?: string
          service_date?: string
          service_type?: Database["public"]["Enums"]["service_type"] | null
          start_time?: string | null
          total_attendance?: number | null
        }
        Relationships: []
      }
      testimonies: {
        Row: {
          body: string
          created_at: string
          id: string
          is_anonymous_to_congregation: boolean
          profile_id: string
          service_id: string | null
          title: string | null
          visibility: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_anonymous_to_congregation?: boolean
          profile_id: string
          service_id?: string | null
          title?: string | null
          visibility?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_anonymous_to_congregation?: boolean
          profile_id?: string
          service_id?: string | null
          title?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_followups: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          contact_id: string
          created_at: string
          follow_up_type: string
          id: string
          notes: string | null
          scheduled_date: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          contact_id: string
          created_at?: string
          follow_up_type: string
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          contact_id?: string
          created_at?: string
          follow_up_type?: string
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_followups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_followups_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_rate_limited: {
        Args: { check_email: string; check_ip: unknown }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_record_id?: string
          p_table_name?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "member" | "finance" | "pastor" | "admin"
      service_type:
        | "tuesday_fellowship"
        | "thursday_livestream"
        | "ltc"
        | "sunday_service"
        | "gic"
        | "nop"
        | "men_gather"
        | "mgp"
        | "other"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "finance", "pastor", "admin"],
      service_type: [
        "tuesday_fellowship",
        "thursday_livestream",
        "ltc",
        "sunday_service",
        "gic",
        "nop",
        "men_gather",
        "mgp",
        "other",
      ],
    },
  },
} as const
