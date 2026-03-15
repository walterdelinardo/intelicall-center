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
      appointments: {
        Row: {
          client_id: string
          clinic_id: string
          created_at: string
          date: string
          duration_minutes: number
          estimated_price: number | null
          id: string
          notes: string | null
          procedure_id: string | null
          professional_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          clinic_id: string
          created_at?: string
          date: string
          duration_minutes?: number
          estimated_price?: number | null
          id?: string
          notes?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          clinic_id?: string
          created_at?: string
          date?: string
          duration_minutes?: number
          estimated_price?: number | null
          id?: string
          notes?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      chatwoot_conversations: {
        Row: {
          account_id: string
          assignee_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          conversation_id: string
          created_at: string | null
          id: string
          inbox_id: string | null
          last_message: string | null
          last_message_at: string | null
          metadata: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          assignee_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          inbox_id?: string | null
          last_message?: string | null
          last_message_at?: string | null
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          assignee_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          inbox_id?: string | null
          last_message?: string | null
          last_message_at?: string | null
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chatwoot_messages: {
        Row: {
          attachments: Json | null
          content: string | null
          conversation_id: string
          created_at: string | null
          id: string
          message_id: string
          message_type: string | null
          sender_name: string | null
          sender_type: string | null
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          message_id: string
          message_type?: string | null
          sender_name?: string | null
          sender_type?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          message_type?: string | null
          sender_name?: string | null
          sender_type?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          average_ticket: number | null
          birth_date: string | null
          city: string | null
          clinic_id: string
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          last_visit_at: string | null
          lead_source: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          total_visits: number
          updated_at: string
          whatsapp: string | null
          whatsapp_inbox_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          average_ticket?: number | null
          birth_date?: string | null
          city?: string | null
          clinic_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_visit_at?: string | null
          lead_source?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          total_visits?: number
          updated_at?: string
          whatsapp?: string | null
          whatsapp_inbox_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          average_ticket?: number | null
          birth_date?: string | null
          city?: string | null
          clinic_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_visit_at?: string | null
          lead_source?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          total_visits?: number
          updated_at?: string
          whatsapp?: string | null
          whatsapp_inbox_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_whatsapp_inbox_id_fkey"
            columns: ["whatsapp_inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          theme_color: string | null
          updated_at: string
          working_hours: Json | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          theme_color?: string | null
          updated_at?: string
          working_hours?: Json | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          theme_color?: string | null
          updated_at?: string
          working_hours?: Json | null
          zip_code?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          appointment_id: string | null
          clinic_id: string
          created_at: string
          date: string
          id: string
          percentage: number
          professional_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          date?: string
          id?: string
          percentage?: number
          professional_id: string
          status?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          date?: string
          id?: string
          percentage?: number
          professional_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string
          client_id: string | null
          clinic_id: string
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          professional_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          category?: string
          client_id?: string | null
          clinic_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          professional_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string
          client_id?: string | null
          clinic_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          professional_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foot_assessments: {
        Row: {
          circulation: string | null
          created_at: string
          deformities: string | null
          foot: string
          id: string
          nail_condition: string | null
          observations: string | null
          pain_level: number | null
          record_id: string
          sensitivity: string | null
          skin_condition: string | null
        }
        Insert: {
          circulation?: string | null
          created_at?: string
          deformities?: string | null
          foot?: string
          id?: string
          nail_condition?: string | null
          observations?: string | null
          pain_level?: number | null
          record_id: string
          sensitivity?: string | null
          skin_condition?: string | null
        }
        Update: {
          circulation?: string | null
          created_at?: string
          deformities?: string | null
          foot?: string
          id?: string
          nail_condition?: string | null
          observations?: string | null
          pain_level?: number | null
          record_id?: string
          sensitivity?: string | null
          skin_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foot_assessments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_accounts: {
        Row: {
          access_token: string | null
          calendar_id: string
          clinic_id: string
          color: string | null
          created_at: string
          expires_at: string | null
          ical_url: string | null
          id: string
          is_active: boolean
          label: string
          refresh_token: string | null
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string
          clinic_id: string
          color?: string | null
          created_at?: string
          expires_at?: string | null
          ical_url?: string | null
          id?: string
          is_active?: boolean
          label?: string
          refresh_token?: string | null
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string
          clinic_id?: string
          color?: string | null
          created_at?: string
          expires_at?: string | null
          ical_url?: string | null
          id?: string
          is_active?: boolean
          label?: string
          refresh_token?: string | null
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_config: {
        Row: {
          client_id: string
          client_secret: string
          clinic_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret: string
          clinic_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          clinic_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_config_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          clinic_id: string
          converted_client_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          stage: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          client_id: string
          clinic_id: string
          clinical_notes: string | null
          created_at: string
          date: string
          diagnosis: string | null
          id: string
          professional_id: string | null
          recommendations: string | null
          treatment_performed: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          client_id: string
          clinic_id: string
          clinical_notes?: string | null
          created_at?: string
          date?: string
          diagnosis?: string | null
          id?: string
          professional_id?: string | null
          recommendations?: string | null
          treatment_performed?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          client_id?: string
          clinic_id?: string
          clinical_notes?: string | null
          created_at?: string
          date?: string
          diagnosis?: string | null
          id?: string
          professional_id?: string | null
          recommendations?: string | null
          treatment_performed?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clinic_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      record_photos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          photo_type: string | null
          photo_url: string
          record_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          photo_type?: string | null
          photo_url: string
          record_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          photo_type?: string | null
          photo_url?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_photos_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      record_products: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_name: string
          quantity: string | null
          record_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_name: string
          quantity?: string | null
          record_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_name?: string
          quantity?: string | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_products_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: string | null
          clinic_id: string
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          min_quantity: number
          name: string
          quantity: number
          supplier: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name: string
          quantity?: number
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name?: string
          quantity?: number
          supplier?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          base64_length: number | null
          base64_source: string | null
          created_at: string
          event: string | null
          has_base64: boolean | null
          has_media_url: boolean | null
          id: string
          instance_name: string | null
          is_duplicate: boolean | null
          media_url: string | null
          merge_error: string | null
          merge_result: string | null
          message_id: string | null
          message_type: string | null
          mime_type: string | null
          normalized_data: Json | null
          payload_format: string | null
          raw_payload: Json | null
          remote_jid: string | null
        }
        Insert: {
          base64_length?: number | null
          base64_source?: string | null
          created_at?: string
          event?: string | null
          has_base64?: boolean | null
          has_media_url?: boolean | null
          id?: string
          instance_name?: string | null
          is_duplicate?: boolean | null
          media_url?: string | null
          merge_error?: string | null
          merge_result?: string | null
          message_id?: string | null
          message_type?: string | null
          mime_type?: string | null
          normalized_data?: Json | null
          payload_format?: string | null
          raw_payload?: Json | null
          remote_jid?: string | null
        }
        Update: {
          base64_length?: number | null
          base64_source?: string | null
          created_at?: string
          event?: string | null
          has_base64?: boolean | null
          has_media_url?: boolean | null
          id?: string
          instance_name?: string | null
          is_duplicate?: boolean | null
          media_url?: string | null
          merge_error?: string | null
          merge_result?: string | null
          message_id?: string | null
          message_type?: string | null
          mime_type?: string | null
          normalized_data?: Json | null
          payload_format?: string | null
          raw_payload?: Json | null
          remote_jid?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          clinic_id: string
          contact_name: string | null
          contact_phone: string | null
          contact_photo_url: string | null
          conversation_status: string
          created_at: string | null
          id: string
          inbox_id: string | null
          is_group: boolean | null
          last_message: string | null
          last_message_at: string | null
          remote_jid: string
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_photo_url?: string | null
          conversation_status?: string
          created_at?: string | null
          id?: string
          inbox_id?: string | null
          is_group?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          remote_jid: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_photo_url?: string | null
          conversation_status?: string
          created_at?: string | null
          id?: string
          inbox_id?: string | null
          is_group?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          remote_jid?: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inboxes: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          instance_name: string
          is_active: boolean
          label: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean
          label?: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          label?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inboxes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          base64: string | null
          caption: string | null
          content: string | null
          conversation_id: string
          created_at: string | null
          file_name: string | null
          id: string
          is_from_me: boolean | null
          media_height: number | null
          media_seconds: number | null
          media_type: string | null
          media_url: string | null
          media_width: number | null
          message_id: string
          message_type: string | null
          mime_type: string | null
          sender_name: string | null
          status: string | null
          thumbnail_base64: string | null
          timestamp: string
        }
        Insert: {
          base64?: string | null
          caption?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          file_name?: string | null
          id?: string
          is_from_me?: boolean | null
          media_height?: number | null
          media_seconds?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          message_id: string
          message_type?: string | null
          mime_type?: string | null
          sender_name?: string | null
          status?: string | null
          thumbnail_base64?: string | null
          timestamp?: string
        }
        Update: {
          base64?: string | null
          caption?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          file_name?: string | null
          id?: string
          is_from_me?: boolean | null
          media_height?: number | null
          media_seconds?: number | null
          media_type?: string | null
          media_url?: string | null
          media_width?: number | null
          message_id?: string
          message_type?: string | null
          mime_type?: string | null
          sender_name?: string | null
          status?: string | null
          thumbnail_base64?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_clinic_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      setup_clinic: {
        Args: {
          _clinic_address?: string
          _clinic_name: string
          _clinic_phone?: string
        }
        Returns: string
      }
      user_belongs_to_clinic: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "recepcao" | "podologo" | "financeiro"
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
      app_role: ["admin", "recepcao", "podologo", "financeiro"],
    },
  },
} as const
