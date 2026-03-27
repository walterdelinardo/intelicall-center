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
      appointment_materials: {
        Row: {
          appointment_id: string
          clinic_id: string
          created_at: string
          id: string
          name: string
          quantity: number
          stock_item_id: string
          unit: string | null
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          quantity?: number
          stock_item_id: string
          unit?: string | null
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          stock_item_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_materials_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_materials_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_materials_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string
          clinic_id: string
          created_at: string
          date: string
          duration_minutes: number
          estimated_price: number | null
          google_event_id: string | null
          id: string
          notes: string | null
          parent_appointment_id: string | null
          procedure_id: string | null
          professional_id: string | null
          seq_number: number
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
          google_event_id?: string | null
          id?: string
          notes?: string | null
          parent_appointment_id?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          seq_number?: number
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
          google_event_id?: string | null
          id?: string
          notes?: string | null
          parent_appointment_id?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          seq_number?: number
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
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
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
      assessment_types: {
        Row: {
          clinic_id: string
          created_at: string | null
          fields: Json
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type_id: string
          clinic_id: string
          created_at: string | null
          data: Json
          id: string
          professional_id: string
          record_id: string
        }
        Insert: {
          assessment_type_id: string
          clinic_id: string
          created_at?: string | null
          data?: Json
          id?: string
          professional_id: string
          record_id: string
        }
        Update: {
          assessment_type_id?: string
          clinic_id?: string
          created_at?: string | null
          data?: Json
          id?: string
          professional_id?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessment_type_id_fkey"
            columns: ["assessment_type_id"]
            isOneToOne: false
            referencedRelation: "assessment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_notifications: {
        Row: {
          account_id: string | null
          action: string
          actor_name: string | null
          clinic_id: string
          created_at: string
          details: string | null
          event_id: string | null
          event_title: string | null
          id: string
          is_important: boolean
          is_read: boolean
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_name?: string | null
          clinic_id: string
          created_at?: string
          details?: string | null
          event_id?: string | null
          event_title?: string | null
          id?: string
          is_important?: boolean
          is_read?: boolean
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_name?: string | null
          clinic_id?: string
          created_at?: string
          details?: string | null
          event_id?: string | null
          event_title?: string | null
          id?: string
          is_important?: boolean
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_accounts"
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
          address_complement: string | null
          address_number: string | null
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
          neighborhood: string | null
          notes: string | null
          phone: string | null
          preferred_professional_id: string | null
          state: string | null
          total_visits: number
          updated_at: string
          whatsapp: string | null
          whatsapp_inbox_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
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
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          preferred_professional_id?: string | null
          state?: string | null
          total_visits?: number
          updated_at?: string
          whatsapp?: string | null
          whatsapp_inbox_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
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
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          preferred_professional_id?: string | null
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
            foreignKeyName: "clients_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          address_complement: string | null
          address_number: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          google_maps_api_key: string | null
          id: string
          is_active: boolean
          location_url: string | null
          logo_url: string | null
          name: string
          neighborhood: string | null
          phone: string | null
          state: string | null
          theme_color: string | null
          updated_at: string
          working_hours: Json | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          google_maps_api_key?: string | null
          id?: string
          is_active?: boolean
          location_url?: string | null
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          theme_color?: string | null
          updated_at?: string
          working_hours?: Json | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          google_maps_api_key?: string | null
          id?: string
          is_active?: boolean
          location_url?: string | null
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
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
      google_calendar_sync_state: {
        Row: {
          account_id: string
          id: string
          last_synced_at: string | null
          sync_token: string
        }
        Insert: {
          account_id: string
          id?: string
          last_synced_at?: string | null
          sync_token: string
        }
        Update: {
          account_id?: string
          id?: string
          last_synced_at?: string | null
          sync_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_state_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_accounts"
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
      instance_downtime_logs: {
        Row: {
          clinic_id: string
          created_at: string
          down_at: string
          duration_seconds: number | null
          id: string
          inbox_id: string
          instance_name: string
          up_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          down_at?: string
          duration_seconds?: number | null
          id?: string
          inbox_id: string
          instance_name: string
          up_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          down_at?: string
          duration_seconds?: number | null
          id?: string
          inbox_id?: string
          instance_name?: string
          up_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instance_downtime_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_downtime_logs_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes"
            referencedColumns: ["id"]
          },
        ]
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
      prescriptions: {
        Row: {
          ai_safety_check: string | null
          appointment_id: string | null
          clinic_id: string
          created_at: string
          id: string
          observations: string | null
          orientations: string | null
          patient_name: string
          prescription: string | null
          procedure_name: string | null
          professional_id: string
          professional_name: string
          record_id: string
        }
        Insert: {
          ai_safety_check?: string | null
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          observations?: string | null
          orientations?: string | null
          patient_name: string
          prescription?: string | null
          procedure_name?: string | null
          professional_id: string
          professional_name: string
          record_id: string
        }
        Update: {
          ai_safety_check?: string | null
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          observations?: string | null
          orientations?: string | null
          patient_name?: string
          prescription?: string | null
          procedure_name?: string | null
          professional_id?: string
          professional_name?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_materials: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          procedure_id: string
          quantity: number
          stock_item_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          procedure_id: string
          quantity?: number
          stock_item_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          procedure_id?: string
          quantity?: number
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_materials_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_materials_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
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
      record_audit_log: {
        Row: {
          action: string
          clinic_id: string
          created_at: string | null
          details: Json | null
          id: string
          record_id: string
          summary: string
          tab: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id: string
          summary: string
          tab: string
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          record_id?: string
          summary?: string
          tab?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_audit_log_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      record_documents: {
        Row: {
          ai_analysis: string | null
          ai_analyzed_at: string | null
          clinic_id: string
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          record_id: string
          title: string
        }
        Insert: {
          ai_analysis?: string | null
          ai_analyzed_at?: string | null
          clinic_id: string
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          record_id: string
          title?: string
        }
        Update: {
          ai_analysis?: string | null
          ai_analyzed_at?: string | null
          clinic_id?: string
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          record_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
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
      role_definitions: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          is_super_admin: boolean
          is_system: boolean
          name: string
          slug: string
        }
        Insert: {
          clinic_id: string
          color?: string
          created_at?: string
          id?: string
          is_super_admin?: boolean
          is_system?: boolean
          name: string
          slug: string
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_super_admin?: boolean
          is_system?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed_tabs: string[] | null
          can_delete: boolean
          can_edit: boolean
          can_read: boolean
          id: string
          module_key: string
          role_definition_id: string
        }
        Insert: {
          allowed_tabs?: string[] | null
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          id?: string
          module_key: string
          role_definition_id: string
        }
        Update: {
          allowed_tabs?: string[] | null
          can_delete?: boolean
          can_edit?: boolean
          can_read?: boolean
          id?: string
          module_key?: string
          role_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
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
          sale_price: number | null
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
          sale_price?: number | null
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
          sale_price?: number | null
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
      telegram_bots: {
        Row: {
          bot_token: string
          chat_id: string
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_update_offset: number | null
          updated_at: string
          webhook_financial_reports: boolean
          webhook_receive_messages: boolean
          webhook_stock_alerts: boolean
        }
        Insert: {
          bot_token: string
          chat_id: string
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          last_update_offset?: number | null
          updated_at?: string
          webhook_financial_reports?: boolean
          webhook_receive_messages?: boolean
          webhook_stock_alerts?: boolean
        }
        Update: {
          bot_token?: string
          chat_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_update_offset?: number | null
          updated_at?: string
          webhook_financial_reports?: boolean
          webhook_receive_messages?: boolean
          webhook_stock_alerts?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bots_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_labels: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          clinic_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_labels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notification_labels: {
        Row: {
          created_at: string
          id: string
          label_id: string
          notification_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          notification_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          notification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notification_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "telegram_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_notification_labels_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "telegram_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_notifications: {
        Row: {
          bot_id: string
          clinic_id: string
          created_at: string
          direction: string
          id: string
          is_ok: boolean
          is_read: boolean
          message: string
          metadata: Json | null
          notification_type: string
        }
        Insert: {
          bot_id: string
          clinic_id: string
          created_at?: string
          direction?: string
          id?: string
          is_ok?: boolean
          is_read?: boolean
          message: string
          metadata?: Json | null
          notification_type?: string
        }
        Update: {
          bot_id?: string
          clinic_id?: string
          created_at?: string
          direction?: string
          id?: string
          is_ok?: boolean
          is_read?: boolean
          message?: string
          metadata?: Json | null
          notification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notifications_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role_definition_id: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role_definition_id: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role_definition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
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
      waiting_list: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string | null
          clinic_id: string
          created_at: string
          desired_date: string | null
          distance_km: number | null
          driving_time_min: number | null
          flexibility: string | null
          google_calendar_account_id: string | null
          id: string
          notes: string | null
          notified_at: string | null
          origin: string | null
          priority: string
          procedure_id: string | null
          professional_id: string | null
          status: string
          time_range_end: string | null
          time_range_start: string | null
          transit_time_min: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          clinic_id: string
          created_at?: string
          desired_date?: string | null
          distance_km?: number | null
          driving_time_min?: number | null
          flexibility?: string | null
          google_calendar_account_id?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          origin?: string | null
          priority?: string
          procedure_id?: string | null
          professional_id?: string | null
          status?: string
          time_range_end?: string | null
          time_range_start?: string | null
          transit_time_min?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          clinic_id?: string
          created_at?: string
          desired_date?: string | null
          distance_km?: number | null
          driving_time_min?: number | null
          flexibility?: string | null
          google_calendar_account_id?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          origin?: string | null
          priority?: string
          procedure_id?: string | null
          professional_id?: string | null
          status?: string
          time_range_end?: string | null
          time_range_start?: string | null
          transit_time_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_google_calendar_account_id_fkey"
            columns: ["google_calendar_account_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list_history: {
        Row: {
          action: string
          clinic_id: string
          created_at: string
          details: string | null
          id: string
          performed_by: string | null
          waiting_list_id: string
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          waiting_list_id: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string | null
          waiting_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_history_waiting_list_id_fkey"
            columns: ["waiting_list_id"]
            isOneToOne: false
            referencedRelation: "waiting_list"
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
          google_calendar_account_id: string | null
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
          google_calendar_account_id?: string | null
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
          google_calendar_account_id?: string | null
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
          {
            foreignKeyName: "whatsapp_inboxes_google_calendar_account_id_fkey"
            columns: ["google_calendar_account_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_accounts"
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
          is_internal_note: boolean
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
          is_internal_note?: boolean
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
          is_internal_note?: boolean
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
      has_module_access: {
        Args: { _action?: string; _module_key: string; _user_id: string }
        Returns: boolean
      }
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
