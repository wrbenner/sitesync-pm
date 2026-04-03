import type { ProjectRole } from './tenant'

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          project_id: string
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_actions: {
        Row: {
          action_type: string | null
          agent_id: string
          applied: boolean | null
          applied_at: string | null
          confidence: number | null
          created_at: string | null
          description: string
          id: string
          input_data: Json | null
          output_data: Json | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          action_type?: string | null
          agent_id: string
          applied?: boolean | null
          applied_at?: string | null
          confidence?: number | null
          created_at?: string | null
          description: string
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          action_type?: string | null
          agent_id?: string
          applied?: boolean | null
          applied_at?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_actions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          actions_approved: number | null
          actions_rejected: number | null
          actions_taken: number | null
          agent_type: string
          configuration: Json | null
          created_at: string | null
          id: string
          last_run: string | null
          next_run: string | null
          project_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actions_approved?: number | null
          actions_rejected?: number | null
          actions_taken?: number | null
          agent_type: string
          configuration?: Json | null
          created_at?: string | null
          id?: string
          last_run?: string | null
          next_run?: string | null
          project_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actions_approved?: number | null
          actions_rejected?: number | null
          actions_taken?: number | null
          agent_type?: string
          configuration?: Json | null
          created_at?: string | null
          id?: string
          last_run?: string | null
          next_run?: string | null
          project_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          id: string
          project_id: string
          user_id: string | null
          conversation_topic: string | null
          started_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id?: string | null
          conversation_topic?: string | null
          started_at?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string | null
          conversation_topic?: string | null
          started_at?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          action_label: string | null
          action_link: string | null
          created_at: string | null
          dismissed: boolean | null
          expanded_content: string | null
          id: string
          message: string
          page: string
          project_id: string
          severity: string | null
        }
        Insert: {
          action_label?: string | null
          action_link?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          expanded_content?: string | null
          id?: string
          message: string
          page: string
          project_id: string
          severity?: string | null
        }
        Update: {
          action_label?: string | null
          action_link?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          expanded_content?: string | null
          id?: string
          message?: string
          page?: string
          project_id?: string
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          metadata?: Json | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_cents: number | null
          created_at: string | null
          function_name: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          project_id: string
          user_id: string
        }
        Insert: {
          cost_cents?: number | null
          created_at?: string | null
          function_name: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          project_id: string
          user_id: string
        }
        Update: {
          cost_cents?: number | null
          created_at?: string | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string | null
          permissions: Json | null
          rate_limit: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id?: string | null
          permissions?: Json | null
          rate_limit?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          permissions?: Json | null
          rate_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_invitations: {
        Row: {
          bid_package_id: string
          company: string | null
          contact_email: string | null
          contact_phone: string | null
          decline_reason: string | null
          id: string
          invited_at: string | null
          status: string | null
          subcontractor_name: string
          submitted_at: string | null
          viewed_at: string | null
        }
        Insert: {
          bid_package_id: string
          company?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          decline_reason?: string | null
          id?: string
          invited_at?: string | null
          status?: string | null
          subcontractor_name: string
          submitted_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          bid_package_id?: string
          company?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          decline_reason?: string | null
          id?: string
          invited_at?: string | null
          status?: string | null
          subcontractor_name?: string
          submitted_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_invitations_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_packages: {
        Row: {
          addenda: Json | null
          created_at: string | null
          created_by: string | null
          documents: Json | null
          due_date: string | null
          id: string
          issue_date: string | null
          name: string
          pre_bid_meeting_date: string | null
          pre_bid_meeting_location: string | null
          project_id: string
          scope_description: string | null
          status: string | null
          trade: string | null
          updated_at: string | null
        }
        Insert: {
          addenda?: Json | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          due_date?: string | null
          id?: string
          issue_date?: string | null
          name: string
          pre_bid_meeting_date?: string | null
          pre_bid_meeting_location?: string | null
          project_id: string
          scope_description?: string | null
          status?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Update: {
          addenda?: Json | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          due_date?: string | null
          id?: string
          issue_date?: string | null
          name?: string
          pre_bid_meeting_date?: string | null
          pre_bid_meeting_location?: string | null
          project_id?: string
          scope_description?: string | null
          status?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_responses: {
        Row: {
          ai_analysis: string | null
          alternate_1: number | null
          alternate_2: number | null
          alternate_3: number | null
          base_bid: number | null
          bid_invitation_id: string | null
          bid_package_id: string
          bond_included: boolean | null
          company: string | null
          created_at: string | null
          document_urls: Json | null
          exclusions: string | null
          id: string
          inclusions: string | null
          notes: string | null
          schedule_days: number | null
          subcontractor_name: string
          unit_prices: Json | null
        }
        Insert: {
          ai_analysis?: string | null
          alternate_1?: number | null
          alternate_2?: number | null
          alternate_3?: number | null
          base_bid?: number | null
          bid_invitation_id?: string | null
          bid_package_id: string
          bond_included?: boolean | null
          company?: string | null
          created_at?: string | null
          document_urls?: Json | null
          exclusions?: string | null
          id?: string
          inclusions?: string | null
          notes?: string | null
          schedule_days?: number | null
          subcontractor_name: string
          unit_prices?: Json | null
        }
        Update: {
          ai_analysis?: string | null
          alternate_1?: number | null
          alternate_2?: number | null
          alternate_3?: number | null
          base_bid?: number | null
          bid_invitation_id?: string | null
          bid_package_id?: string
          bond_included?: boolean | null
          company?: string | null
          created_at?: string | null
          document_urls?: Json | null
          exclusions?: string | null
          id?: string
          inclusions?: string | null
          notes?: string | null
          schedule_days?: number | null
          subcontractor_name?: string
          unit_prices?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_responses_bid_invitation_id_fkey"
            columns: ["bid_invitation_id"]
            isOneToOne: false
            referencedRelation: "bid_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_responses_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number | null
          committed_amount: number | null
          cost_code: string | null
          created_at: string | null
          csi_division: string | null
          description: string | null
          division: string
          forecast_amount: number | null
          id: string
          original_amount: number | null
          percent_complete: number | null
          project_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_amount?: number | null
          committed_amount?: number | null
          cost_code?: string | null
          created_at?: string | null
          csi_division?: string | null
          description?: string | null
          division: string
          forecast_amount?: number | null
          id?: string
          original_amount?: number | null
          percent_complete?: number | null
          project_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_amount?: number | null
          committed_amount?: number | null
          cost_code?: string | null
          created_at?: string | null
          csi_division?: string | null
          description?: string | null
          division?: string
          forecast_amount?: number | null
          id?: string
          original_amount?: number | null
          percent_complete?: number | null
          project_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          amount: number | null
          // approved_amount stores the final negotiated value; populated via migration 00051+
          approved_amount: number | null
          approved_date: string | null
          cost_code: string | null
          created_at: string | null
          description: string
          id: string
          number: number
          parent_co_id: string | null
          project_id: string
          reason: string | null
          requested_by: string | null
          requested_date: string | null
          schedule_impact: string | null
          status: string | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          approved_amount?: number | null
          approved_date?: string | null
          cost_code?: string | null
          created_at?: string | null
          description: string
          id?: string
          number?: number
          parent_co_id?: string | null
          project_id: string
          reason?: string | null
          requested_by?: string | null
          requested_date?: string | null
          schedule_impact?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          approved_amount?: number | null
          approved_date?: string | null
          cost_code?: string | null
          created_at?: string | null
          description?: string
          id?: string
          number?: number
          parent_co_id?: string | null
          project_id?: string
          reason?: string | null
          requested_by?: string | null
          requested_date?: string | null
          schedule_impact?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_parent_co_id_fkey"
            columns: ["parent_co_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      closeout_items: {
        Row: {
          assigned_to: string | null
          category: string | null
          completed_date: string | null
          created_at: string | null
          description: string
          document_url: string | null
          due_date: string | null
          id: string
          notes: string | null
          project_id: string
          status: string | null
          trade: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          description: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          status?: string | null
          trade: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          status?: string | null
          trade?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closeout_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_method: string | null
          contract_number: string | null
          counterparty: string
          counterparty_contact: string | null
          counterparty_email: string | null
          created_at: string | null
          created_by: string | null
          documents: Json | null
          end_date: string | null
          id: string
          original_value: number
          payment_terms: string | null
          project_id: string
          retainage_percent: number | null
          revised_value: number | null
          start_date: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          billing_method?: string | null
          contract_number?: string | null
          counterparty: string
          counterparty_contact?: string | null
          counterparty_email?: string | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          end_date?: string | null
          id?: string
          original_value: number
          payment_terms?: string | null
          project_id: string
          retainage_percent?: number | null
          revised_value?: number | null
          start_date?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_method?: string | null
          contract_number?: string | null
          counterparty?: string
          counterparty_contact?: string | null
          counterparty_email?: string | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          end_date?: string | null
          id?: string
          original_value?: number
          payment_terms?: string | null
          project_id?: string
          retainage_percent?: number | null
          revised_value?: number | null
          start_date?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          notes: string | null
          photos: Json | null
          project_id: string
          severity: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          updated_at: string | null
          verified_by: string | null
          verified_date: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          photos?: Json | null
          project_id: string
          severity?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
          verified_by?: string | null
          verified_date?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          photos?: Json | null
          project_id?: string
          severity?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
          verified_by?: string | null
          verified_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_database: {
        Row: {
          created_at: string | null
          csi_code: string | null
          description: string
          equipment_cost_per_unit: number | null
          id: string
          labor_hours_per_unit: number | null
          labor_rate: number | null
          material_cost_per_unit: number | null
          organization_id: string | null
          region: string | null
          source: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          csi_code?: string | null
          description: string
          equipment_cost_per_unit?: number | null
          id?: string
          labor_hours_per_unit?: number | null
          labor_rate?: number | null
          material_cost_per_unit?: number | null
          organization_id?: string | null
          region?: string | null
          source?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          csi_code?: string | null
          description?: string
          equipment_cost_per_unit?: number | null
          id?: string
          labor_hours_per_unit?: number | null
          labor_rate?: number | null
          material_cost_per_unit?: number | null
          organization_id?: string | null
          region?: string | null
          source?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      crews: {
        Row: {
          certifications: Json | null
          created_at: string | null
          current_task: string | null
          id: string
          lead_id: string | null
          location: string | null
          name: string
          productivity_score: number | null
          project_id: string
          size: number | null
          status: string | null
          trade: string | null
          updated_at: string | null
        }
        Insert: {
          certifications?: Json | null
          created_at?: string | null
          current_task?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          name: string
          productivity_score?: number | null
          project_id: string
          size?: number | null
          status?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Update: {
          certifications?: Json | null
          created_at?: string | null
          current_task?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          name?: string
          productivity_score?: number | null
          project_id?: string
          size?: number | null
          status?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reports: {
        Row: {
          chart_config: Json | null
          chart_type: string | null
          columns: Json | null
          created_at: string | null
          created_by: string | null
          data_source: string | null
          description: string | null
          filters: Json | null
          grouping: Json | null
          id: string
          is_template: boolean | null
          name: string
          organization_id: string | null
          project_id: string | null
          recipients: Json | null
          schedule: string | null
          sorting: Json | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          chart_config?: Json | null
          chart_type?: string | null
          columns?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          description?: string | null
          filters?: Json | null
          grouping?: Json | null
          id?: string
          is_template?: boolean | null
          name: string
          organization_id?: string | null
          project_id?: string | null
          recipients?: Json | null
          schedule?: string | null
          sorting?: Json | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          chart_config?: Json | null
          chart_type?: string | null
          columns?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          description?: string | null
          filters?: Json | null
          grouping?: Json | null
          id?: string
          is_template?: boolean | null
          name?: string
          organization_id?: string | null
          project_id?: string | null
          recipients?: Json | null
          schedule?: string | null
          sorting?: Json | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_log_entries: {
        Row: {
          company: string | null
          condition: string | null
          created_at: string | null
          daily_log_id: string
          delay_cause: string | null
          delay_hours: number | null
          description: string | null
          equipment_hours: number | null
          equipment_name: string | null
          headcount: number | null
          hours: number | null
          id: string
          inspection_result: string | null
          inspector_name: string | null
          location: string | null
          photos: Json | null
          po_number: string | null
          quantity: number | null
          time_in: string | null
          time_out: string | null
          trade: string | null
          type: string | null
          unit: string | null
        }
        Insert: {
          company?: string | null
          condition?: string | null
          created_at?: string | null
          daily_log_id: string
          delay_cause?: string | null
          delay_hours?: number | null
          description?: string | null
          equipment_hours?: number | null
          equipment_name?: string | null
          headcount?: number | null
          hours?: number | null
          id?: string
          inspection_result?: string | null
          inspector_name?: string | null
          location?: string | null
          photos?: Json | null
          po_number?: string | null
          quantity?: number | null
          time_in?: string | null
          time_out?: string | null
          trade?: string | null
          type?: string | null
          unit?: string | null
        }
        Update: {
          company?: string | null
          condition?: string | null
          created_at?: string | null
          daily_log_id?: string
          delay_cause?: string | null
          delay_hours?: number | null
          description?: string | null
          equipment_hours?: number | null
          equipment_name?: string | null
          headcount?: number | null
          hours?: number | null
          id?: string
          inspection_result?: string | null
          inspector_name?: string | null
          location?: string | null
          photos?: Json | null
          po_number?: string | null
          quantity?: number | null
          time_in?: string | null
          time_out?: string | null
          trade?: string | null
          type?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_entries_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          ai_summary: string | null
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          incidents: number | null
          log_date: string
          manager_signature_url: string | null
          precipitation: string | null
          project_id: string
          rejection_comments: string | null
          status: string | null
          summary: string | null
          superintendent_signature_url: string | null
          temperature_high: number | null
          temperature_low: number | null
          total_hours: number | null
          updated_at: string | null
          weather: string | null
          weather_am: string | null
          weather_pm: string | null
          is_submitted: boolean | null
          submitted_at: string | null
          version: number | null
          weather_source: string | null
          wind_speed: string | null
          workers_onsite: number | null
        }
        Insert: {
          ai_summary?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          incidents?: number | null
          is_submitted?: boolean | null
          log_date: string
          manager_signature_url?: string | null
          precipitation?: string | null
          project_id: string
          rejection_comments?: string | null
          status?: string | null
          submitted_at?: string | null
          summary?: string | null
          superintendent_signature_url?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          total_hours?: number | null
          updated_at?: string | null
          version?: number | null
          weather?: string | null
          weather_am?: string | null
          weather_pm?: string | null
          weather_source?: string | null
          wind_speed?: string | null
          workers_onsite?: number | null
        }
        Update: {
          ai_summary?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          incidents?: number | null
          is_submitted?: boolean | null
          log_date?: string
          manager_signature_url?: string | null
          precipitation?: string | null
          project_id?: string
          rejection_comments?: string | null
          status?: string | null
          submitted_at?: string | null
          summary?: string | null
          superintendent_signature_url?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          total_hours?: number | null
          updated_at?: string | null
          version?: number | null
          weather?: string | null
          weather_am?: string | null
          weather_pm?: string | null
          weather_source?: string | null
          wind_speed?: string | null
          workers_onsite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          carrier: string | null
          created_at: string | null
          delivery_date: string | null
          id: string
          inspection_notes: string | null
          packing_slip_url: string | null
          photos: Json | null
          project_id: string
          purchase_order_id: string | null
          received_by: string | null
          status: string | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          inspection_notes?: string | null
          packing_slip_url?: string | null
          photos?: Json | null
          project_id: string
          purchase_order_id?: string | null
          received_by?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          delivery_date?: string | null
          id?: string
          inspection_notes?: string | null
          packing_slip_url?: string | null
          photos?: Json | null
          project_id?: string
          purchase_order_id?: string | null
          received_by?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          condition: string | null
          delivery_id: string
          id: string
          notes: string | null
          photo_url: string | null
          po_line_item_id: string | null
          quantity_backordered: number | null
          quantity_damaged: number | null
          quantity_received: number | null
        }
        Insert: {
          condition?: string | null
          delivery_id: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          po_line_item_id?: string | null
          quantity_backordered?: number | null
          quantity_damaged?: number | null
          quantity_received?: number | null
        }
        Update: {
          condition?: string | null
          delivery_id?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          po_line_item_id?: string | null
          quantity_backordered?: number | null
          quantity_damaged?: number | null
          quantity_received?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_po_line_item_id_fkey"
            columns: ["po_line_item_id"]
            isOneToOne: false
            referencedRelation: "po_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_contacts: {
        Row: {
          address: string | null
          avg_rfi_response_days: number | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          project_id: string
          role: string | null
          trade: string | null
        }
        Insert: {
          address?: string | null
          avg_rfi_response_days?: number | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          project_id: string
          role?: string | null
          trade?: string | null
        }
        Update: {
          address?: string | null
          avg_rfi_response_days?: number | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          project_id?: string
          role?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_markups: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: Json
          drawing_id: string
          id: string
          layer: string | null
          linked_punch_item_id: string | null
          linked_rfi_id: string | null
          note: string | null
          project_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data?: Json
          drawing_id: string
          id?: string
          layer?: string | null
          linked_punch_item_id?: string | null
          linked_rfi_id?: string | null
          note?: string | null
          project_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: Json
          drawing_id?: string
          id?: string
          layer?: string | null
          linked_punch_item_id?: string | null
          linked_rfi_id?: string | null
          note?: string | null
          project_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_markups_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_markups_linked_punch_item_id_fkey"
            columns: ["linked_punch_item_id"]
            isOneToOne: false
            referencedRelation: "punch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_markups_linked_rfi_id_fkey"
            columns: ["linked_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_markups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawings: {
        Row: {
          ai_changes_detected: number | null
          change_description: string | null
          created_at: string | null
          discipline: string | null
          file_url: string | null
          id: string
          previous_revision_id: string | null
          project_id: string
          received_date: string | null
          revision: string | null
          set_name: string | null
          sheet_number: string | null
          status: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_changes_detected?: number | null
          change_description?: string | null
          created_at?: string | null
          discipline?: string | null
          file_url?: string | null
          id?: string
          previous_revision_id?: string | null
          project_id: string
          received_date?: string | null
          revision?: string | null
          set_name?: string | null
          sheet_number?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_changes_detected?: number | null
          change_description?: string | null
          created_at?: string | null
          discipline?: string | null
          file_url?: string | null
          id?: string
          previous_revision_id?: string | null
          project_id?: string
          received_date?: string | null
          revision?: string | null
          set_name?: string | null
          sheet_number?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawings_previous_revision_id_fkey"
            columns: ["previous_revision_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string | null
          current_location: string | null
          current_project_id: string | null
          documents: Json | null
          hours_meter: number | null
          id: string
          insurance_expiry: string | null
          insurance_policy: string | null
          last_service_date: string | null
          make: string | null
          model: string | null
          name: string
          next_service_due: string | null
          ownership: string | null
          photos: Json | null
          project_id: string | null
          qr_code: string | null
          rental_rate_daily: number | null
          rental_rate_monthly: number | null
          rental_rate_weekly: number | null
          serial_number: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          vendor: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          current_location?: string | null
          current_project_id?: string | null
          documents?: Json | null
          hours_meter?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          last_service_date?: string | null
          make?: string | null
          model?: string | null
          name: string
          next_service_due?: string | null
          ownership?: string | null
          photos?: Json | null
          project_id?: string | null
          qr_code?: string | null
          rental_rate_daily?: number | null
          rental_rate_monthly?: number | null
          rental_rate_weekly?: number | null
          serial_number?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          vendor?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          current_location?: string | null
          current_project_id?: string | null
          documents?: Json | null
          hours_meter?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          last_service_date?: string | null
          make?: string | null
          model?: string | null
          name?: string
          next_service_due?: string | null
          ownership?: string | null
          photos?: Json | null
          project_id?: string | null
          qr_code?: string | null
          rental_rate_daily?: number | null
          rental_rate_monthly?: number | null
          rental_rate_weekly?: number | null
          serial_number?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          vendor?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_logs: {
        Row: {
          created_at: string | null
          date: string
          equipment_id: string
          fuel_cost: number | null
          fuel_gallons: number | null
          hours_used: number | null
          id: string
          notes: string | null
          operator_id: string | null
          project_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          equipment_id: string
          fuel_cost?: number | null
          fuel_gallons?: number | null
          hours_used?: number | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          project_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          equipment_id?: string
          fuel_cost?: number | null
          fuel_gallons?: number | null
          hours_used?: number | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string | null
          description: string
          equipment_id: string
          id: string
          next_due_date: string | null
          next_due_hours: number | null
          parts_used: Json | null
          performed_by: string | null
          scheduled_date: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          description: string
          equipment_id: string
          id?: string
          next_due_date?: string | null
          next_due_hours?: number | null
          parts_used?: Json | null
          performed_by?: string | null
          scheduled_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string
          equipment_id?: string
          id?: string
          next_due_date?: string | null
          next_due_hours?: number | null
          parts_used?: Json | null
          performed_by?: string | null
          scheduled_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          created_at: string | null
          csi_code: string | null
          csi_division: string | null
          description: string
          equipment_cost: number | null
          estimate_id: string
          id: string
          labor_cost: number | null
          labor_hours: number | null
          labor_rate: number | null
          markup: number | null
          material_cost: number | null
          notes: string | null
          parent_id: string | null
          quantity: number | null
          sort_order: number | null
          subcontractor_cost: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          csi_code?: string | null
          csi_division?: string | null
          description: string
          equipment_cost?: number | null
          estimate_id: string
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          labor_rate?: number | null
          markup?: number | null
          material_cost?: number | null
          notes?: string | null
          parent_id?: string | null
          quantity?: number | null
          sort_order?: number | null
          subcontractor_cost?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          csi_code?: string | null
          csi_division?: string | null
          description?: string
          equipment_cost?: number | null
          estimate_id?: string
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          labor_rate?: number | null
          markup?: number | null
          material_cost?: number | null
          notes?: string | null
          parent_id?: string | null
          quantity?: number | null
          sort_order?: number | null
          subcontractor_cost?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "estimate_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          bond_percent: number | null
          contingency_percent: number | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          markup_percent: number | null
          name: string
          notes: string | null
          overhead_percent: number | null
          profit_percent: number | null
          project_id: string
          status: string | null
          submitted_date: string | null
          tax_rate: number | null
          total_amount: number | null
          type: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          bond_percent?: number | null
          contingency_percent?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          markup_percent?: number | null
          name: string
          notes?: string | null
          overhead_percent?: number | null
          profit_percent?: number | null
          project_id: string
          status?: string | null
          submitted_date?: string | null
          tax_rate?: number | null
          total_amount?: number | null
          type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          bond_percent?: number | null
          contingency_percent?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          markup_percent?: number | null
          name?: string
          notes?: string | null
          overhead_percent?: number | null
          profit_percent?: number | null
          project_id?: string
          status?: string | null
          submitted_date?: string | null
          tax_rate?: number | null
          total_amount?: number | null
          type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_reports: {
        Row: {
          ai_narrative: string | null
          created_at: string | null
          created_by: string | null
          data: Json | null
          id: string
          period_end: string | null
          period_start: string | null
          portfolio_id: string
          type: string | null
        }
        Insert: {
          ai_narrative?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          portfolio_id: string
          type?: string | null
        }
        Update: {
          ai_narrative?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          portfolio_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_locks: {
        Row: {
          entity_type: string
          entity_id: string
          locked_by_user_id: string
          locked_at: string
          expires_at: string
        }
        Insert: {
          entity_type: string
          entity_id: string
          locked_by_user_id: string
          locked_at: string
          expires_at: string
        }
        Update: {
          entity_type?: string
          entity_id?: string
          locked_by_user_id?: string
          locked_at?: string
          expires_at?: string
        }
        Relationships: []
      }
      field_captures: {
        Row: {
          ai_category: string | null
          ai_tags: Json | null
          content: string | null
          created_at: string | null
          created_by: string | null
          file_url: string | null
          id: string
          linked_drawing_id: string | null
          location: string | null
          project_id: string
          type: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_tags?: Json | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          linked_drawing_id?: string | null
          location?: string | null
          project_id: string
          type?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_tags?: Json | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string | null
          id?: string
          linked_drawing_id?: string | null
          location?: string | null
          project_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_captures_linked_drawing_id_fkey"
            columns: ["linked_drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_captures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          content_type: string | null
          created_at: string | null
          description: string | null
          discipline: string | null
          file_size: number | null
          file_url: string
          folder: string | null
          id: string
          name: string
          previous_version_id: string | null
          project_id: string
          tags: Json | null
          trade: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          discipline?: string | null
          file_size?: number | null
          file_url: string
          folder?: string | null
          id?: string
          name: string
          previous_version_id?: string | null
          project_id: string
          tags?: Json | null
          trade?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          discipline?: string | null
          file_size?: number | null
          file_url?: string
          folder?: string | null
          id?: string
          name?: string
          previous_version_id?: string | null
          project_id?: string
          tags?: Json | null
          trade?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "files_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          area: string | null
          body_part: string | null
          corrective_actions: Json | null
          created_at: string | null
          date: string
          days_away_from_work: number | null
          days_restricted_duty: number | null
          description: string
          documents: Json | null
          floor: string | null
          id: string
          immediate_actions: string | null
          incident_number: number
          injured_party_company: string | null
          injured_party_name: string | null
          injured_party_trade: string | null
          investigated_by: string | null
          investigation_status: string | null
          location: string | null
          nature_of_injury: string | null
          osha_case_number: string | null
          osha_recordable: boolean | null
          osha_report_number: string | null
          photos: Json | null
          preventive_actions: Json | null
          project_id: string
          reported_by: string | null
          root_cause: string | null
          root_cause_analysis: Json | null
          severity: string | null
          type: string | null
          updated_at: string | null
          witness_names: Json | null
        }
        Insert: {
          area?: string | null
          body_part?: string | null
          corrective_actions?: Json | null
          created_at?: string | null
          date: string
          days_away_from_work?: number | null
          days_restricted_duty?: number | null
          description: string
          documents?: Json | null
          floor?: string | null
          id?: string
          immediate_actions?: string | null
          incident_number?: number
          injured_party_company?: string | null
          injured_party_name?: string | null
          injured_party_trade?: string | null
          investigated_by?: string | null
          investigation_status?: string | null
          location?: string | null
          nature_of_injury?: string | null
          osha_case_number?: string | null
          osha_recordable?: boolean | null
          osha_report_number?: string | null
          photos?: Json | null
          preventive_actions?: Json | null
          project_id: string
          reported_by?: string | null
          root_cause?: string | null
          root_cause_analysis?: Json | null
          severity?: string | null
          type?: string | null
          updated_at?: string | null
          witness_names?: Json | null
        }
        Update: {
          area?: string | null
          body_part?: string | null
          corrective_actions?: Json | null
          created_at?: string | null
          date?: string
          days_away_from_work?: number | null
          days_restricted_duty?: number | null
          description?: string
          documents?: Json | null
          floor?: string | null
          id?: string
          immediate_actions?: string | null
          incident_number?: number
          injured_party_company?: string | null
          injured_party_name?: string | null
          injured_party_trade?: string | null
          investigated_by?: string | null
          investigation_status?: string | null
          location?: string | null
          nature_of_injury?: string | null
          osha_case_number?: string | null
          osha_recordable?: boolean | null
          osha_report_number?: string | null
          photos?: Json | null
          preventive_actions?: Json | null
          project_id?: string
          reported_by?: string | null
          root_cause?: string | null
          root_cause_analysis?: Json | null
          severity?: string | null
          type?: string | null
          updated_at?: string | null
          witness_names?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          category: string | null
          corrective_action: string | null
          created_at: string | null
          due_date: string | null
          id: string
          inspection_id: string
          photo_url: string | null
          question: string
          resolved: boolean | null
          resolved_date: string | null
          response: string | null
          responsible_party: string | null
          severity: string | null
        }
        Insert: {
          category?: string | null
          corrective_action?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          inspection_id: string
          photo_url?: string | null
          question: string
          resolved?: boolean | null
          resolved_date?: string | null
          response?: string | null
          responsible_party?: string | null
          severity?: string | null
        }
        Update: {
          category?: string | null
          corrective_action?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          inspection_id?: string
          photo_url?: string | null
          question?: string
          resolved?: boolean | null
          resolved_date?: string | null
          response?: string | null
          responsible_party?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "safety_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_certificates: {
        Row: {
          additional_insured: boolean | null
          aggregate_limit: number | null
          carrier: string | null
          company: string
          coverage_amount: number | null
          created_at: string | null
          document_url: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          policy_number: string | null
          policy_type: string | null
          project_id: string
          subcontractor_id: string | null
          updated_at: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
          waiver_of_subrogation: boolean | null
        }
        Insert: {
          additional_insured?: boolean | null
          aggregate_limit?: number | null
          carrier?: string | null
          company: string
          coverage_amount?: number | null
          created_at?: string | null
          document_url?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          policy_number?: string | null
          policy_type?: string | null
          project_id: string
          subcontractor_id?: string | null
          updated_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          waiver_of_subrogation?: boolean | null
        }
        Update: {
          additional_insured?: boolean | null
          aggregate_limit?: number | null
          carrier?: string | null
          company?: string
          coverage_amount?: number | null
          created_at?: string | null
          document_url?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          policy_number?: string | null
          policy_type?: string | null
          project_id?: string
          subcontractor_id?: string | null
          updated_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          waiver_of_subrogation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_certificates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_certificates_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_field_mappings: {
        Row: {
          created_at: string | null
          field_map: Json
          id: string
          integration_id: string
          source_entity: string
          target_entity: string
          transform_rules: Json | null
        }
        Insert: {
          created_at?: string | null
          field_map?: Json
          id?: string
          integration_id: string
          source_entity: string
          target_entity: string
          transform_rules?: Json | null
        }
        Update: {
          created_at?: string | null
          field_map?: Json
          id?: string
          integration_id?: string
          source_entity?: string
          target_entity?: string
          transform_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_log: {
        Row: {
          completed_at: string | null
          direction: string | null
          error_details: Json | null
          id: string
          integration_id: string
          records_failed: number | null
          records_synced: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          direction?: string | null
          error_details?: Json | null
          id?: string
          integration_id: string
          records_failed?: number | null
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          direction?: string | null
          error_details?: Json | null
          id?: string
          integration_id?: string
          records_failed?: number | null
          records_synced?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          error_log: Json | null
          id: string
          last_sync: string | null
          organization_id: string | null
          status: string | null
          sync_frequency: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          error_log?: Json | null
          id?: string
          last_sync?: string | null
          organization_id?: string | null
          status?: string | null
          sync_frequency?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          error_log?: Json | null
          id?: string
          last_sync?: string | null
          organization_id?: string | null
          status?: string | null
          sync_frequency?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices_payable: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          budget_item_id: string | null
          check_number: string | null
          cost_code: string | null
          created_at: string | null
          created_by: string | null
          document_url: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          paid_date: string | null
          po_number: string | null
          project_id: string
          purchase_order_id: string | null
          status: string | null
          tax: number | null
          total: number | null
          updated_at: string | null
          vendor: string
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          budget_item_id?: string | null
          check_number?: string | null
          cost_code?: string | null
          created_at?: string | null
          created_by?: string | null
          document_url?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_date?: string | null
          po_number?: string | null
          project_id: string
          purchase_order_id?: string | null
          status?: string | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          vendor: string
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          budget_item_id?: string | null
          check_number?: string | null
          cost_code?: string | null
          created_at?: string | null
          created_by?: string | null
          document_url?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_date?: string | null
          po_number?: string | null
          project_id?: string
          purchase_order_id?: string | null
          status?: string | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payable_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_entries: {
        Row: {
          amount: number | null
          budget_item_id: string | null
          contract_id: string | null
          cost_code: string
          cost_type: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          description: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          posted: boolean | null
          posted_date: string | null
          project_id: string
          quantity: number | null
          unit_cost: number | null
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          budget_item_id?: string | null
          contract_id?: string | null
          cost_code: string
          cost_type?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          description?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          posted?: boolean | null
          posted_date?: string | null
          project_id: string
          quantity?: number | null
          unit_cost?: number | null
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          budget_item_id?: string | null
          contract_id?: string | null
          cost_code?: string
          cost_type?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          description?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          posted?: boolean | null
          posted_date?: string | null
          project_id?: string
          quantity?: number | null
          unit_cost?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cost_entries_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cost_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_forecasts: {
        Row: {
          confidence: number | null
          created_at: string | null
          headcount_needed: number | null
          hours_needed: number | null
          id: string
          project_id: string
          source: string | null
          trade: string | null
          week_start: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          headcount_needed?: number | null
          hours_needed?: number | null
          id?: string
          project_id: string
          source?: string | null
          trade?: string | null
          week_start: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          headcount_needed?: number | null
          hours_needed?: number | null
          id?: string
          project_id?: string
          source?: string | null
          trade?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_forecasts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lien_waivers: {
        Row: {
          id: string
          project_id: string
          subcontractor_id: string | null
          payment_period: string | null
          type: 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'
          amount: number | null
          status: 'pending' | 'received' | 'missing'
          payment_app_id: string | null
          created_at: string | null
          received_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          subcontractor_id?: string | null
          payment_period?: string | null
          type: 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'
          amount?: number | null
          status?: 'pending' | 'received' | 'missing'
          payment_app_id?: string | null
          created_at?: string | null
          received_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          subcontractor_id?: string | null
          payment_period?: string | null
          type?: 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final'
          amount?: number | null
          status?: 'pending' | 'received' | 'missing'
          payment_app_id?: string | null
          created_at?: string | null
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lien_waivers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_inventory: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          last_counted_by: string | null
          last_counted_date: string | null
          location: string | null
          minimum_quantity: number | null
          name: string
          project_id: string
          qr_code: string | null
          quantity_on_hand: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          last_counted_by?: string | null
          last_counted_date?: string | null
          location?: string | null
          minimum_quantity?: number | null
          name: string
          project_id: string
          qr_code?: string | null
          quantity_on_hand?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          last_counted_by?: string | null
          last_counted_date?: string | null
          location?: string | null
          minimum_quantity?: number | null
          name?: string
          project_id?: string
          qr_code?: string | null
          quantity_on_hand?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          description: string
          due_date: string | null
          id: string
          linked_task_id: string | null
          meeting_id: string
          notes: string | null
          priority: string | null
          source_agenda_item_id: string | null
          status: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          linked_task_id?: string | null
          meeting_id: string
          notes?: string | null
          priority?: string | null
          source_agenda_item_id?: string | null
          status?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          linked_task_id?: string | null
          meeting_id?: string
          notes?: string | null
          priority?: string | null
          source_agenda_item_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_source_agenda_item_id_fkey"
            columns: ["source_agenda_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_items: {
        Row: {
          attachments: Json | null
          created_at: string | null
          decision: string | null
          duration_minutes: number | null
          id: string
          meeting_id: string
          notes: string | null
          presenter: string | null
          sort_order: number | null
          status: string | null
          title: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          decision?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_id: string
          notes?: string | null
          presenter?: string | null
          sort_order?: number | null
          status?: string | null
          title: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          decision?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_id?: string
          notes?: string | null
          presenter?: string | null
          sort_order?: number | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attended: boolean | null
          company: string | null
          id: string
          meeting_id: string
          role: string | null
          sign_in_time: string | null
          signature_url: string | null
          user_id: string | null
        }
        Insert: {
          attended?: boolean | null
          company?: string | null
          id?: string
          meeting_id: string
          role?: string | null
          sign_in_time?: string | null
          signature_url?: string | null
          user_id?: string | null
        }
        Update: {
          attended?: boolean | null
          company?: string | null
          id?: string
          meeting_id?: string
          role?: string | null
          sign_in_time?: string | null
          signature_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_series: {
        Row: {
          active: boolean | null
          created_at: string | null
          day_of_week: number | null
          default_attendees: Json | null
          default_duration_minutes: number | null
          id: string
          location: string | null
          project_id: string
          recurrence: string | null
          time_of_day: string | null
          title: string
          type: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          day_of_week?: number | null
          default_attendees?: Json | null
          default_duration_minutes?: number | null
          id?: string
          location?: string | null
          project_id: string
          recurrence?: string | null
          time_of_day?: string | null
          title: string
          type?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          day_of_week?: number | null
          default_attendees?: Json | null
          default_duration_minutes?: number | null
          id?: string
          location?: string | null
          project_id?: string
          recurrence?: string | null
          time_of_day?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_series_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          actual_duration_minutes: number | null
          agenda: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_number: number
          minutes_published: boolean | null
          minutes_published_at: string | null
          notes: string | null
          previous_meeting_id: string | null
          project_id: string
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          agenda?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_number?: number
          minutes_published?: boolean | null
          minutes_published_at?: string | null
          notes?: string | null
          previous_meeting_id?: string | null
          project_id: string
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          agenda?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_number?: number
          minutes_published?: boolean | null
          minutes_published_at?: string | null
          notes?: string | null
          previous_meeting_id?: string | null
          project_id?: string
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_previous_meeting_id_fkey"
            columns: ["previous_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          ai_insight_channel: string | null
          approval_needed_channel: string | null
          assignment_channel: string | null
          comment_channel: string | null
          created_at: string | null
          daily_digest: boolean | null
          digest_time: string | null
          id: string
          mention_channel: string | null
          muted_projects: string[] | null
          muted_threads: Json | null
          overdue_channel: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          status_change_channel: string | null
          system_channel: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_insight_channel?: string | null
          approval_needed_channel?: string | null
          assignment_channel?: string | null
          comment_channel?: string | null
          created_at?: string | null
          daily_digest?: boolean | null
          digest_time?: string | null
          id?: string
          mention_channel?: string | null
          muted_projects?: string[] | null
          muted_threads?: Json | null
          overdue_channel?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          status_change_channel?: string | null
          system_channel?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_insight_channel?: string | null
          approval_needed_channel?: string | null
          assignment_channel?: string | null
          comment_channel?: string | null
          created_at?: string | null
          daily_digest?: boolean | null
          digest_time?: string | null
          id?: string
          mention_channel?: string | null
          muted_projects?: string[] | null
          muted_threads?: Json | null
          overdue_channel?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          status_change_channel?: string | null
          system_channel?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          group_key: string | null
          id: string
          link: string | null
          metadata: Json | null
          project_id: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          group_key?: string | null
          id?: string
          link?: string | null
          metadata?: Json | null
          project_id?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          group_key?: string | null
          id?: string
          link?: string | null
          metadata?: Json | null
          project_id?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string | null
          default_inspection_templates: Json | null
          default_markup_percentages: Json | null
          fiscal_year_start: number | null
          id: string
          logo_url: string | null
          name: string
          organization_id: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_inspection_templates?: Json | null
          default_markup_percentages?: Json | null
          fiscal_year_start?: number | null
          id?: string
          logo_url?: string | null
          name: string
          organization_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_inspection_templates?: Json | null
          default_markup_percentages?: Json | null
          fiscal_year_start?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          organization_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      owner_updates: {
        Row: {
          budget_summary: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          milestone_updates: Json | null
          photos: Json | null
          project_id: string
          published: boolean | null
          published_at: string | null
          schedule_summary: string | null
          title: string
          updated_at: string | null
          weather_summary: string | null
        }
        Insert: {
          budget_summary?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          milestone_updates?: Json | null
          photos?: Json | null
          project_id: string
          published?: boolean | null
          published_at?: string | null
          schedule_summary?: string | null
          title: string
          updated_at?: string | null
          weather_summary?: string | null
        }
        Update: {
          budget_summary?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          milestone_updates?: Json | null
          photos?: Json | null
          project_id?: string
          published?: boolean | null
          published_at?: string | null
          schedule_summary?: string | null
          title?: string
          updated_at?: string | null
          weather_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_applications: {
        Row: {
          application_number: number | null
          balance_to_finish: number | null
          certified_by: string | null
          certified_date: string | null
          contract_id: string
          contract_sum_to_date: number | null
          created_at: string | null
          current_payment_due: number | null
          id: string
          less_previous_certificates: number | null
          net_change_orders: number | null
          original_contract_sum: number | null
          paid_amount: number | null
          paid_date: string | null
          period_to: string
          project_id: string
          retainage: number | null
          signature_url: string | null
          status: string | null
          submitted_date: string | null
          total_completed_and_stored: number | null
          total_earned_less_retainage: number | null
          updated_at: string | null
        }
        Insert: {
          application_number?: number | null
          balance_to_finish?: number | null
          certified_by?: string | null
          certified_date?: string | null
          contract_id: string
          contract_sum_to_date?: number | null
          created_at?: string | null
          current_payment_due?: number | null
          id?: string
          less_previous_certificates?: number | null
          net_change_orders?: number | null
          original_contract_sum?: number | null
          paid_amount?: number | null
          paid_date?: string | null
          period_to: string
          project_id: string
          retainage?: number | null
          signature_url?: string | null
          status?: string | null
          submitted_date?: string | null
          total_completed_and_stored?: number | null
          total_earned_less_retainage?: number | null
          updated_at?: string | null
        }
        Update: {
          application_number?: number | null
          balance_to_finish?: number | null
          certified_by?: string | null
          certified_date?: string | null
          contract_id?: string
          contract_sum_to_date?: number | null
          created_at?: string | null
          current_payment_due?: number | null
          id?: string
          less_previous_certificates?: number | null
          net_change_orders?: number | null
          original_contract_sum?: number | null
          paid_amount?: number | null
          paid_date?: string | null
          period_to?: string
          project_id?: string
          retainage?: number | null
          signature_url?: string | null
          status?: string | null
          submitted_date?: string | null
          total_completed_and_stored?: number | null
          total_earned_less_retainage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_applications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permit_inspections: {
        Row: {
          corrections_required: string | null
          created_at: string | null
          id: string
          inspector_name: string | null
          permit_id: string
          re_inspection_date: string | null
          result_notes: string | null
          scheduled_date: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          corrections_required?: string | null
          created_at?: string | null
          id?: string
          inspector_name?: string | null
          permit_id: string
          re_inspection_date?: string | null
          result_notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          corrections_required?: string | null
          created_at?: string | null
          id?: string
          inspector_name?: string | null
          permit_id?: string
          re_inspection_date?: string | null
          result_notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permit_inspections_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "permits"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          applied_date: string | null
          authority: string | null
          conditions: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          documents: Json | null
          expiration_date: string | null
          fee: number | null
          id: string
          issued_date: string | null
          jurisdiction: string | null
          notes: string | null
          paid: boolean | null
          permit_number: string | null
          project_id: string
          special_inspections: Json | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          applied_date?: string | null
          authority?: string | null
          conditions?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          expiration_date?: string | null
          fee?: number | null
          id?: string
          issued_date?: string | null
          jurisdiction?: string | null
          notes?: string | null
          paid?: boolean | null
          permit_number?: string | null
          project_id: string
          special_inspections?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          applied_date?: string | null
          authority?: string | null
          conditions?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          expiration_date?: string | null
          fee?: number | null
          id?: string
          issued_date?: string | null
          jurisdiction?: string | null
          notes?: string | null
          paid?: boolean | null
          permit_number?: string | null
          project_id?: string
          special_inspections?: Json | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          created_at: string | null
          csi_code: string | null
          description: string
          id: string
          notes: string | null
          purchase_order_id: string
          quantity: number | null
          quantity_received: number | null
          sort_order: number | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          csi_code?: string | null
          description: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          quantity?: number | null
          quantity_received?: number | null
          sort_order?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          csi_code?: string | null
          description?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          quantity?: number | null
          quantity_received?: number | null
          sort_order?: number | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_access_tokens: {
        Row: {
          access_count: number | null
          active: boolean | null
          company: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          name: string | null
          permissions: Json | null
          portal_type: string
          project_id: string
          token: string
        }
        Insert: {
          access_count?: number | null
          active?: boolean | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          name?: string | null
          permissions?: Json | null
          portal_type: string
          project_id: string
          token?: string
        }
        Update: {
          access_count?: number | null
          active?: boolean | null
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          name?: string | null
          permissions?: Json | null
          portal_type?: string
          project_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_invitations: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          company: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          name: string | null
          permissions: Json | null
          portal_type: string
          project_id: string
          token: string | null
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          company?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          name?: string | null
          permissions?: Json | null
          portal_type: string
          project_id: string
          token?: string | null
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          company?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          name?: string | null
          permissions?: Json | null
          portal_type?: string
          project_id?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_users: {
        Row: {
          company: string | null
          created_at: string | null
          id: string
          last_login: string | null
          permissions: Json | null
          portal_type: string
          project_id: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          id?: string
          last_login?: string | null
          permissions?: Json | null
          portal_type: string
          project_id: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          id?: string
          last_login?: string | null
          permissions?: Json | null
          portal_type?: string
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          added_at: string | null
          id: string
          portfolio_id: string
          project_id: string
          sort_order: number | null
        }
        Insert: {
          added_at?: string | null
          id?: string
          portfolio_id: string
          project_id: string
          sort_order?: number | null
        }
        Update: {
          added_at?: string | null
          id?: string
          portfolio_id?: string
          project_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          owner_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          owner_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          accepted_at: string | null
          company: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          permissions: Json | null
          project_id: string
          role: ProjectRole
          trade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          company?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          permissions?: Json | null
          project_id: string
          role: ProjectRole
          trade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          company?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          permissions?: Json | null
          project_id?: string
          role?: ProjectRole
          trade?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_snapshots: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          key_events: Json | null
          project_id: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          key_events?: Json | null
          project_id: string
          snapshot_date: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          key_events?: Json | null
          project_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          architect_contact_id: string | null
          architect_name: string | null
          building_area_sqft: number | null
          city: string | null
          contract_type: 'lump_sum' | 'gmp' | 'cost_plus' | 'time_and_materials' | 'unit_price' | null
          contract_value: number | null
          cover_photo_url: string | null
          created_at: string | null
          delivery_method: 'design_bid_build' | 'cm_at_risk' | 'design_build' | 'integrated_project_delivery' | null
          description: string | null
          general_contractor: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          num_floors: number | null
          organization_id: string | null
          owner_contact_id: string | null
          owner_id: string | null
          owner_name: string | null
          portal_config: Json | null
          project_phase: 'preconstruction' | 'mobilization' | 'construction' | 'commissioning' | 'closeout' | 'warranty' | null
          project_type: 'commercial_office' | 'mixed_use' | 'healthcare' | 'education' | 'multifamily' | 'industrial' | 'data_center' | 'retail' | 'hospitality' | 'government' | 'infrastructure' | null
          retainage_rate: number | null
          start_date: string | null
          state: string | null
          status: string | null
          target_completion: string | null
          time_zone: string | null
          updated_at: string | null
          weather_location_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          architect_contact_id?: string | null
          architect_name?: string | null
          building_area_sqft?: number | null
          city?: string | null
          contract_type?: 'lump_sum' | 'gmp' | 'cost_plus' | 'time_and_materials' | 'unit_price' | null
          contract_value?: number | null
          cover_photo_url?: string | null
          created_at?: string | null
          delivery_method?: 'design_bid_build' | 'cm_at_risk' | 'design_build' | 'integrated_project_delivery' | null
          description?: string | null
          general_contractor?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          num_floors?: number | null
          organization_id?: string | null
          owner_contact_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          portal_config?: Json | null
          project_phase?: 'preconstruction' | 'mobilization' | 'construction' | 'commissioning' | 'closeout' | 'warranty' | null
          project_type?: 'commercial_office' | 'mixed_use' | 'healthcare' | 'education' | 'multifamily' | 'industrial' | 'data_center' | 'retail' | 'hospitality' | 'government' | 'infrastructure' | null
          retainage_rate?: number | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          target_completion?: string | null
          time_zone?: string | null
          updated_at?: string | null
          weather_location_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          architect_contact_id?: string | null
          architect_name?: string | null
          building_area_sqft?: number | null
          city?: string | null
          contract_type?: 'lump_sum' | 'gmp' | 'cost_plus' | 'time_and_materials' | 'unit_price' | null
          contract_value?: number | null
          cover_photo_url?: string | null
          created_at?: string | null
          delivery_method?: 'design_bid_build' | 'cm_at_risk' | 'design_build' | 'integrated_project_delivery' | null
          description?: string | null
          general_contractor?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          num_floors?: number | null
          organization_id?: string | null
          owner_contact_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          portal_config?: Json | null
          project_phase?: 'preconstruction' | 'mobilization' | 'construction' | 'commissioning' | 'closeout' | 'warranty' | null
          project_type?: 'commercial_office' | 'mixed_use' | 'healthcare' | 'education' | 'multifamily' | 'industrial' | 'data_center' | 'retail' | 'hospitality' | 'government' | 'infrastructure' | null
          retainage_rate?: number | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          target_completion?: string | null
          time_zone?: string | null
          updated_at?: string | null
          weather_location_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_architect_contact_id_fkey"
            columns: ["architect_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_items: {
        Row: {
          area: string | null
          assigned_to: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          floor: string | null
          id: string
          location: string | null
          number: number
          photos: Json | null
          priority: string | null
          project_id: string
          reported_by: string | null
          resolved_date: string | null
          status: string | null
          title: string
          trade: string | null
          updated_at: string | null
          verified_date: string | null
        }
        Insert: {
          area?: string | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          floor?: string | null
          id?: string
          location?: string | null
          number?: number
          photos?: Json | null
          priority?: string | null
          project_id: string
          reported_by?: string | null
          resolved_date?: string | null
          status?: string | null
          title: string
          trade?: string | null
          updated_at?: string | null
          verified_date?: string | null
        }
        Update: {
          area?: string | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          floor?: string | null
          id?: string
          location?: string | null
          number?: number
          photos?: Json | null
          priority?: string | null
          project_id?: string
          reported_by?: string | null
          resolved_date?: string | null
          status?: string | null
          title?: string
          trade?: string | null
          updated_at?: string | null
          verified_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_item_id: string | null
          created_at: string | null
          created_by: string | null
          delivery_address: string | null
          description: string | null
          id: string
          is_long_lead: boolean | null
          issued_date: string | null
          lead_time_weeks: number | null
          needed_on_site_date: string | null
          notes: string | null
          po_number: number
          project_id: string
          received_date: string | null
          required_date: string | null
          shipping: number | null
          status: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string | null
          vendor_contact: string | null
          vendor_email: string | null
          vendor_name: string
          vendor_phone: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_item_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_address?: string | null
          description?: string | null
          id?: string
          is_long_lead?: boolean | null
          issued_date?: string | null
          lead_time_weeks?: number | null
          needed_on_site_date?: string | null
          notes?: string | null
          po_number?: number
          project_id: string
          received_date?: string | null
          required_date?: string | null
          shipping?: number | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          vendor_contact?: string | null
          vendor_email?: string | null
          vendor_name: string
          vendor_phone?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_item_id?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_address?: string | null
          description?: string | null
          id?: string
          is_long_lead?: boolean | null
          issued_date?: string | null
          lead_time_weeks?: number | null
          needed_on_site_date?: string | null
          notes?: string | null
          po_number?: number
          project_id?: string
          received_date?: string | null
          required_date?: string | null
          shipping?: number | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          vendor_contact?: string | null
          vendor_email?: string | null
          vendor_name?: string
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      retainage_ledger: {
        Row: {
          amount: number | null
          balance: number | null
          conditions: string | null
          contract_id: string
          created_at: string | null
          id: string
          project_id: string
          release_date: string | null
          released_amount: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          balance?: number | null
          conditions?: string | null
          contract_id: string
          created_at?: string | null
          id?: string
          project_id: string
          release_date?: string | null
          released_amount?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          balance?: number | null
          conditions?: string | null
          contract_id?: string
          created_at?: string | null
          id?: string
          project_id?: string
          release_date?: string | null
          released_amount?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retainage_ledger_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainage_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rfi_responses: {
        Row: {
          attachments: Json | null
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          rfi_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          rfi_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          rfi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfi_responses_rfi_id_fkey"
            columns: ["rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
        ]
      }
      rfi_watchers: {
        Row: {
          created_at: string | null
          id: string
          rfi_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rfi_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rfi_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfi_watchers_rfi_id_fkey"
            columns: ["rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
        ]
      }
      rfis: {
        Row: {
          assigned_to: string | null
          ball_in_court: string | null
          closed_date: string | null
          cost_impact: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          drawing_reference: string | null
          due_date: string | null
          id: string
          number: number
          priority: string | null
          project_id: string
          response_due_date: string | null
          schedule_impact: string | null
          spec_section: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          ball_in_court?: string | null
          closed_date?: string | null
          cost_impact?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drawing_reference?: string | null
          due_date?: string | null
          id?: string
          number?: number
          priority?: string | null
          project_id: string
          response_due_date?: string | null
          schedule_impact?: string | null
          spec_section?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          ball_in_court?: string | null
          closed_date?: string | null
          cost_impact?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drawing_reference?: string | null
          due_date?: string | null
          id?: string
          number?: number
          priority?: string | null
          project_id?: string
          response_due_date?: string | null
          schedule_impact?: string | null
          spec_section?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_certifications: {
        Row: {
          certification_number: string | null
          certification_type: string | null
          company: string | null
          created_at: string | null
          document_url: string | null
          expiration_date: string | null
          id: string
          issued_date: string | null
          project_id: string
          trade: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
          worker_name: string
        }
        Insert: {
          certification_number?: string | null
          certification_type?: string | null
          company?: string | null
          created_at?: string | null
          document_url?: string | null
          expiration_date?: string | null
          id?: string
          issued_date?: string | null
          project_id: string
          trade?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          worker_name: string
        }
        Update: {
          certification_number?: string | null
          certification_type?: string | null
          company?: string | null
          created_at?: string | null
          document_url?: string | null
          expiration_date?: string | null
          id?: string
          issued_date?: string | null
          project_id?: string
          trade?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_certifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_inspection_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_global: boolean | null
          items: Json
          name: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          items?: Json
          name: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          items?: Json
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      safety_inspections: {
        Row: {
          ai_summary: string | null
          area: string | null
          created_at: string | null
          date: string
          floor: string | null
          id: string
          inspector_id: string | null
          max_score: number | null
          notes: string | null
          project_id: string
          score: number | null
          signature_date: string | null
          signature_url: string | null
          status: string | null
          temperature: number | null
          type: string
          updated_at: string | null
          weather_conditions: string | null
        }
        Insert: {
          ai_summary?: string | null
          area?: string | null
          created_at?: string | null
          date: string
          floor?: string | null
          id?: string
          inspector_id?: string | null
          max_score?: number | null
          notes?: string | null
          project_id: string
          score?: number | null
          signature_date?: string | null
          signature_url?: string | null
          status?: string | null
          temperature?: number | null
          type: string
          updated_at?: string | null
          weather_conditions?: string | null
        }
        Update: {
          ai_summary?: string | null
          area?: string | null
          created_at?: string | null
          date?: string
          floor?: string | null
          id?: string
          inspector_id?: string | null
          max_score?: number | null
          notes?: string | null
          project_id?: string
          score?: number | null
          signature_date?: string | null
          signature_url?: string | null
          status?: string | null
          temperature?: number | null
          type?: string
          updated_at?: string | null
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_observations: {
        Row: {
          action_taken: string | null
          category: string | null
          created_at: string | null
          date: string | null
          description: string
          follow_up_required: boolean | null
          id: string
          location: string | null
          observed_by: string | null
          photo_url: string | null
          project_id: string
          type: string | null
        }
        Insert: {
          action_taken?: string | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          description: string
          follow_up_required?: boolean | null
          id?: string
          location?: string | null
          observed_by?: string | null
          photo_url?: string | null
          project_id: string
          type?: string | null
        }
        Update: {
          action_taken?: string | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          description?: string
          follow_up_required?: boolean | null
          id?: string
          location?: string | null
          observed_by?: string | null
          photo_url?: string | null
          project_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_observations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_of_values: {
        Row: {
          balance_to_finish: number | null
          contract_id: string
          cost_code: string | null
          created_at: string | null
          description: string
          id: string
          item_number: string | null
          materials_stored: number | null
          percent_complete: number | null
          previous_completed: number | null
          retainage: number | null
          scheduled_value: number
          sort_order: number | null
          this_period_completed: number | null
          total_completed: number | null
          updated_at: string | null
        }
        Insert: {
          balance_to_finish?: number | null
          contract_id: string
          cost_code?: string | null
          created_at?: string | null
          description: string
          id?: string
          item_number?: string | null
          materials_stored?: number | null
          percent_complete?: number | null
          previous_completed?: number | null
          retainage?: number | null
          scheduled_value: number
          sort_order?: number | null
          this_period_completed?: number | null
          total_completed?: number | null
          updated_at?: string | null
        }
        Update: {
          balance_to_finish?: number | null
          contract_id?: string
          cost_code?: string | null
          created_at?: string | null
          description?: string
          id?: string
          item_number?: string | null
          materials_stored?: number | null
          percent_complete?: number | null
          previous_completed?: number | null
          retainage?: number | null
          scheduled_value?: number
          sort_order?: number | null
          this_period_completed?: number | null
          total_completed?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_of_values_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_phases: {
        Row: {
          assigned_crew_id: string | null
          baseline_end: string | null
          baseline_start: string | null
          created_at: string | null
          dependencies: string[] | null
          depends_on: string | null
          earned_value: number | null
          end_date: string | null
          float_days: number | null
          id: string
          is_critical_path: boolean | null
          name: string
          percent_complete: number | null
          project_id: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_crew_id?: string | null
          baseline_end?: string | null
          baseline_start?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          depends_on?: string | null
          earned_value?: number | null
          end_date?: string | null
          float_days?: number | null
          id?: string
          is_critical_path?: boolean | null
          name: string
          percent_complete?: number | null
          project_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_crew_id?: string | null
          baseline_end?: string | null
          baseline_start?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          depends_on?: string | null
          earned_value?: number | null
          end_date?: string | null
          float_days?: number | null
          id?: string
          is_critical_path?: boolean | null
          name?: string
          percent_complete?: number | null
          project_id?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_phases_assigned_crew_id_fkey"
            columns: ["assigned_crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_phases_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "schedule_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_invoices: {
        Row: {
          amount_due: number | null
          approved_at: string | null
          backup_documents: Json | null
          created_at: string | null
          id: string
          invoice_number: string | null
          materials_stored: number | null
          notes: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          project_id: string
          retainage_amount: number | null
          retainage_percent: number | null
          scheduled_value: number | null
          status: string | null
          subcontractor_id: string | null
          submitted_at: string | null
          total_completed: number | null
          updated_at: string | null
          work_completed_previous: number | null
          work_completed_this_period: number | null
        }
        Insert: {
          amount_due?: number | null
          approved_at?: string | null
          backup_documents?: Json | null
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          materials_stored?: number | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          project_id: string
          retainage_amount?: number | null
          retainage_percent?: number | null
          scheduled_value?: number | null
          status?: string | null
          subcontractor_id?: string | null
          submitted_at?: string | null
          total_completed?: number | null
          updated_at?: string | null
          work_completed_previous?: number | null
          work_completed_this_period?: number | null
        }
        Update: {
          amount_due?: number | null
          approved_at?: string | null
          backup_documents?: Json | null
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          materials_stored?: number | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          project_id?: string
          retainage_amount?: number | null
          retainage_percent?: number | null
          scheduled_value?: number | null
          status?: string | null
          subcontractor_id?: string | null
          submitted_at?: string | null
          total_completed?: number | null
          updated_at?: string | null
          work_completed_previous?: number | null
          work_completed_this_period?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_invoices_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      submittal_approvals: {
        Row: {
          approver_id: string | null
          comments: string | null
          id: string
          reviewed_at: string | null
          role: string | null
          stamp: string | null
          status: string | null
          submittal_id: string
        }
        Insert: {
          approver_id?: string | null
          comments?: string | null
          id?: string
          reviewed_at?: string | null
          role?: string | null
          stamp?: string | null
          status?: string | null
          submittal_id: string
        }
        Update: {
          approver_id?: string | null
          comments?: string | null
          id?: string
          reviewed_at?: string | null
          role?: string | null
          stamp?: string | null
          status?: string | null
          submittal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submittal_approvals_submittal_id_fkey"
            columns: ["submittal_id"]
            isOneToOne: false
            referencedRelation: "submittals"
            referencedColumns: ["id"]
          },
        ]
      }
      submittals: {
        Row: {
          approved_date: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          days_in_review: number | null
          due_date: string | null
          id: string
          lead_time_weeks: number | null
          number: number
          parent_submittal_id: string | null
          project_id: string
          required_onsite_date: string | null
          revision_number: number | null
          spec_section: string | null
          stamp: string | null
          status: string | null
          subcontractor: string | null
          submit_by_date: string | null
          submitted_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_date?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          days_in_review?: number | null
          due_date?: string | null
          id?: string
          lead_time_weeks?: number | null
          number?: number
          parent_submittal_id?: string | null
          project_id: string
          required_onsite_date?: string | null
          revision_number?: number | null
          spec_section?: string | null
          stamp?: string | null
          status?: string | null
          subcontractor?: string | null
          submit_by_date?: string | null
          submitted_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_date?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          days_in_review?: number | null
          due_date?: string | null
          id?: string
          lead_time_weeks?: number | null
          number?: number
          parent_submittal_id?: string | null
          project_id?: string
          required_onsite_date?: string | null
          revision_number?: number | null
          spec_section?: string | null
          stamp?: string | null
          status?: string | null
          subcontractor?: string | null
          submit_by_date?: string | null
          submitted_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submittals_parent_submittal_id_fkey"
            columns: ["parent_submittal_id"]
            isOneToOne: false
            referencedRelation: "submittals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sustainability_metrics: {
        Row: {
          actual_value: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          leed_credit: string | null
          leed_points: number | null
          metric_name: string
          notes: string | null
          project_id: string
          reporting_period: string | null
          source: string | null
          target_value: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          actual_value?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          leed_credit?: string | null
          leed_points?: number | null
          metric_name: string
          notes?: string | null
          project_id: string
          reporting_period?: string | null
          source?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_value?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          leed_credit?: string | null
          leed_points?: number | null
          metric_name?: string
          notes?: string | null
          project_id?: string
          reporting_period?: string | null
          source?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sustainability_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_items: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          drawing_id: string | null
          id: string
          layer: string | null
          measurement_type: string | null
          name: string
          points: Json | null
          project_id: string
          quantity: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          drawing_id?: string | null
          id?: string
          layer?: string | null
          measurement_type?: string | null
          name: string
          points?: Json | null
          project_id: string
          quantity?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          drawing_id?: string | null
          id?: string
          layer?: string | null
          measurement_type?: string | null
          name?: string
          points?: Json | null
          project_id?: string
          quantity?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_items_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_global: boolean | null
          name: string
          phase: string | null
          tasks: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name: string
          phase?: string | null
          tasks?: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name?: string
          phase?: string | null
          tasks?: Json
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          constraint_date: string | null
          constraint_notes: string | null
          constraint_type: string | null
          created_at: string | null
          dependency_type: string | null
          description: string | null
          due_date: string | null
          early_finish: string | null
          early_start: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          inspection_required: boolean | null
          is_critical_path: boolean | null
          lag_days: number | null
          late_finish: string | null
          late_start: string | null
          location: string | null
          material_delivery_required: boolean | null
          parent_task_id: string | null
          percent_complete: number | null
          predecessor_ids: string[] | null
          priority: string | null
          project_id: string
          sort_order: number | null
          start_date: string | null
          status: string | null
          successor_ids: string[] | null
          title: string
          total_float: number | null
          trade: string | null
          updated_at: string | null
          weather_dependent: boolean | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          constraint_date?: string | null
          constraint_notes?: string | null
          constraint_type?: string | null
          created_at?: string | null
          dependency_type?: string | null
          description?: string | null
          due_date?: string | null
          early_finish?: string | null
          early_start?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          inspection_required?: boolean | null
          is_critical_path?: boolean | null
          lag_days?: number | null
          late_finish?: string | null
          late_start?: string | null
          location?: string | null
          material_delivery_required?: boolean | null
          parent_task_id?: string | null
          percent_complete?: number | null
          predecessor_ids?: string[] | null
          priority?: string | null
          project_id: string
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          successor_ids?: string[] | null
          title: string
          total_float?: number | null
          trade?: string | null
          updated_at?: string | null
          weather_dependent?: boolean | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          constraint_date?: string | null
          constraint_notes?: string | null
          constraint_type?: string | null
          created_at?: string | null
          dependency_type?: string | null
          description?: string | null
          due_date?: string | null
          early_finish?: string | null
          early_start?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          inspection_required?: boolean | null
          is_critical_path?: boolean | null
          lag_days?: number | null
          late_finish?: string | null
          late_start?: string | null
          location?: string | null
          material_delivery_required?: boolean | null
          parent_task_id?: string | null
          percent_complete?: number | null
          predecessor_ids?: string[] | null
          priority?: string | null
          project_id?: string
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          successor_ids?: string[] | null
          title?: string
          total_float?: number | null
          trade?: string | null
          updated_at?: string | null
          weather_dependent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved: boolean | null
          approved_by: string | null
          break_minutes: number | null
          clock_in: string | null
          clock_out: string | null
          cost_code: string | null
          created_at: string | null
          date: string
          double_time_hours: number | null
          geolocation_in: Json | null
          geolocation_out: Json | null
          id: string
          overtime_hours: number | null
          project_id: string
          regular_hours: number | null
          task_description: string | null
          updated_at: string | null
          workforce_member_id: string
        }
        Insert: {
          approved?: boolean | null
          approved_by?: string | null
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          cost_code?: string | null
          created_at?: string | null
          date: string
          double_time_hours?: number | null
          geolocation_in?: Json | null
          geolocation_out?: Json | null
          id?: string
          overtime_hours?: number | null
          project_id: string
          regular_hours?: number | null
          task_description?: string | null
          updated_at?: string | null
          workforce_member_id: string
        }
        Update: {
          approved?: boolean | null
          approved_by?: string | null
          break_minutes?: number | null
          clock_in?: string | null
          clock_out?: string | null
          cost_code?: string | null
          created_at?: string | null
          date?: string
          double_time_hours?: number | null
          geolocation_in?: Json | null
          geolocation_out?: Json | null
          id?: string
          overtime_hours?: number | null
          project_id?: string
          regular_hours?: number | null
          task_description?: string | null
          updated_at?: string | null
          workforce_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_workforce_member_id_fkey"
            columns: ["workforce_member_id"]
            isOneToOne: false
            referencedRelation: "workforce_members"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_talk_attendees: {
        Row: {
          company: string | null
          id: string
          signature_url: string | null
          signed_at: string | null
          toolbox_talk_id: string
          trade: string | null
          worker_name: string
        }
        Insert: {
          company?: string | null
          id?: string
          signature_url?: string | null
          signed_at?: string | null
          toolbox_talk_id: string
          trade?: string | null
          worker_name: string
        }
        Update: {
          company?: string | null
          id?: string
          signature_url?: string | null
          signed_at?: string | null
          toolbox_talk_id?: string
          trade?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talk_attendees_toolbox_talk_id_fkey"
            columns: ["toolbox_talk_id"]
            isOneToOne: false
            referencedRelation: "toolbox_talks"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_talks: {
        Row: {
          attendance_count: number | null
          content: string | null
          created_at: string | null
          date: string
          duration_minutes: number | null
          id: string
          language: string | null
          presenter_id: string | null
          project_id: string
          recurrence_rule: string | null
          recurring: boolean | null
          sign_in_sheet_url: string | null
          title: string
          topic: string | null
        }
        Insert: {
          attendance_count?: number | null
          content?: string | null
          created_at?: string | null
          date: string
          duration_minutes?: number | null
          id?: string
          language?: string | null
          presenter_id?: string | null
          project_id: string
          recurrence_rule?: string | null
          recurring?: boolean | null
          sign_in_sheet_url?: string | null
          title: string
          topic?: string | null
        }
        Update: {
          attendance_count?: number | null
          content?: string | null
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          id?: string
          language?: string | null
          presenter_id?: string | null
          project_id?: string
          recurrence_rule?: string | null
          recurring?: boolean | null
          sign_in_sheet_url?: string | null
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transmittals: {
        Row: {
          acknowledged_at: string | null
          action_required: string | null
          created_at: string | null
          created_by: string | null
          document_ids: string[] | null
          from_company: string | null
          from_contact: string | null
          id: string
          notes: string | null
          project_id: string
          purpose: string | null
          sent_at: string | null
          status: string | null
          subject: string
          to_company: string
          to_contact: string | null
          to_email: string | null
          transmittal_number: number
        }
        Insert: {
          acknowledged_at?: string | null
          action_required?: string | null
          created_at?: string | null
          created_by?: string | null
          document_ids?: string[] | null
          from_company?: string | null
          from_contact?: string | null
          id?: string
          notes?: string | null
          project_id: string
          purpose?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          to_company: string
          to_contact?: string | null
          to_email?: string | null
          transmittal_number?: number
        }
        Update: {
          acknowledged_at?: string | null
          action_required?: string | null
          created_at?: string | null
          created_by?: string | null
          document_ids?: string[] | null
          from_company?: string | null
          from_contact?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          purpose?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_company?: string
          to_contact?: string | null
          to_email?: string | null
          transmittal_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "transmittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          category: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          coverage_description: string | null
          created_at: string | null
          document_url: string | null
          duration_years: number | null
          expiration_date: string | null
          id: string
          item: string
          limitations: string | null
          manufacturer: string | null
          project_id: string
          start_date: string | null
          status: string | null
          subcontractor: string | null
          updated_at: string | null
          warranty_type: string | null
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          coverage_description?: string | null
          created_at?: string | null
          document_url?: string | null
          duration_years?: number | null
          expiration_date?: string | null
          id?: string
          item: string
          limitations?: string | null
          manufacturer?: string | null
          project_id: string
          start_date?: string | null
          status?: string | null
          subcontractor?: string | null
          updated_at?: string | null
          warranty_type?: string | null
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          coverage_description?: string | null
          created_at?: string | null
          document_url?: string | null
          duration_years?: number | null
          expiration_date?: string | null
          id?: string
          item?: string
          limitations?: string | null
          manufacturer?: string | null
          project_id?: string
          start_date?: string | null
          status?: string | null
          subcontractor?: string | null
          updated_at?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          claim_date: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string
          documents: Json | null
          id: string
          location: string | null
          photos: Json | null
          project_id: string
          resolution: string | null
          resolution_date: string | null
          severity: string | null
          status: string | null
          updated_at: string | null
          warranty_id: string
        }
        Insert: {
          claim_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description: string
          documents?: Json | null
          id?: string
          location?: string | null
          photos?: Json | null
          project_id: string
          resolution?: string | null
          resolution_date?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          warranty_id: string
        }
        Update: {
          claim_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          documents?: Json | null
          id?: string
          location?: string | null
          photos?: Json | null
          project_id?: string
          resolution?: string | null
          resolution_date?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_logs: {
        Row: {
          cost: number | null
          created_at: string | null
          created_by: string | null
          date: string | null
          disposition: string | null
          document_url: string | null
          hauler: string | null
          id: string
          manifest_number: string | null
          material_type: string | null
          project_id: string
          quantity: number | null
          unit: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          disposition?: string | null
          document_url?: string | null
          hauler?: string | null
          id?: string
          manifest_number?: string | null
          material_type?: string | null
          project_id: string
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          disposition?: string | null
          document_url?: string | null
          hauler?: string | null
          id?: string
          manifest_number?: string | null
          material_type?: string | null
          project_id?: string
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_records: {
        Row: {
          conditions: string | null
          created_at: string | null
          date: string
          delay_hours: number | null
          humidity: number | null
          id: string
          impact_description: string | null
          is_weather_day: boolean | null
          precipitation: string | null
          precipitation_amount: number | null
          project_id: string
          source: string | null
          temperature_high: number | null
          temperature_low: number | null
          wind_speed: string | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string | null
          date: string
          delay_hours?: number | null
          humidity?: number | null
          id?: string
          impact_description?: string | null
          is_weather_day?: boolean | null
          precipitation?: string | null
          precipitation_amount?: number | null
          project_id: string
          source?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          wind_speed?: string | null
        }
        Update: {
          conditions?: string | null
          created_at?: string | null
          date?: string
          delay_hours?: number | null
          humidity?: number | null
          id?: string
          impact_description?: string | null
          is_weather_day?: boolean | null
          precipitation?: string | null
          precipitation_amount?: number | null
          project_id?: string
          source?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          wind_speed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string | null
          event: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          retry_count: number | null
          webhook_id: string
        }
        Insert: {
          delivered_at?: string | null
          event: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number | null
          webhook_id: string
        }
        Update: {
          delivered_at?: string | null
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          events: string[]
          failure_count: number | null
          id: string
          last_triggered_at: string | null
          organization_id: string | null
          project_id: string | null
          secret: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          events: string[]
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          organization_id?: string | null
          project_id?: string | null
          secret?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          organization_id?: string | null
          project_id?: string | null
          secret?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_commitments: {
        Row: {
          committed_by: string | null
          constraint_type: string | null
          created_at: string | null
          crew_id: string | null
          description: string
          id: string
          project_id: string
          reason_not_completed: string | null
          status: string | null
          task_id: string | null
          trade: string | null
          week_start: string
        }
        Insert: {
          committed_by?: string | null
          constraint_type?: string | null
          created_at?: string | null
          crew_id?: string | null
          description: string
          id?: string
          project_id: string
          reason_not_completed?: string | null
          status?: string | null
          task_id?: string | null
          trade?: string | null
          week_start: string
        }
        Update: {
          committed_by?: string | null
          constraint_type?: string | null
          created_at?: string | null
          crew_id?: string | null
          description?: string
          id?: string
          project_id?: string
          reason_not_completed?: string | null
          status?: string | null
          task_id?: string | null
          trade?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_commitments_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_commitments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      wip_reports: {
        Row: {
          billed_to_date: number | null
          contract_amount: number | null
          created_at: string | null
          created_by: string | null
          earned_revenue: number | null
          estimated_costs_to_complete: number | null
          gross_profit: number | null
          gross_profit_margin: number | null
          id: string
          over_under_billing: number | null
          percent_complete_cost: number | null
          period_end: string
          project_id: string
          status: string | null
          total_costs_to_date: number | null
          total_estimated_costs: number | null
        }
        Insert: {
          billed_to_date?: number | null
          contract_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          earned_revenue?: number | null
          estimated_costs_to_complete?: number | null
          gross_profit?: number | null
          gross_profit_margin?: number | null
          id?: string
          over_under_billing?: number | null
          percent_complete_cost?: number | null
          period_end: string
          project_id: string
          status?: string | null
          total_costs_to_date?: number | null
          total_estimated_costs?: number | null
        }
        Update: {
          billed_to_date?: number | null
          contract_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          earned_revenue?: number | null
          estimated_costs_to_complete?: number | null
          gross_profit?: number | null
          gross_profit_margin?: number | null
          id?: string
          over_under_billing?: number | null
          percent_complete_cost?: number | null
          period_end?: string
          project_id?: string
          status?: string | null
          total_costs_to_date?: number | null
          total_estimated_costs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wip_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_assignments: {
        Row: {
          created_at: string | null
          crew_id: string | null
          end_date: string | null
          hours_per_day: number | null
          id: string
          project_id: string
          start_date: string | null
          status: string | null
          workforce_member_id: string
        }
        Insert: {
          created_at?: string | null
          crew_id?: string | null
          end_date?: string | null
          hours_per_day?: number | null
          id?: string
          project_id: string
          start_date?: string | null
          status?: string | null
          workforce_member_id: string
        }
        Update: {
          created_at?: string | null
          crew_id?: string | null
          end_date?: string | null
          hours_per_day?: number | null
          id?: string
          project_id?: string
          start_date?: string | null
          status?: string | null
          workforce_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_assignments_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_assignments_workforce_member_id_fkey"
            columns: ["workforce_member_id"]
            isOneToOne: false
            referencedRelation: "workforce_members"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_members: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          languages: Json | null
          name: string
          organization_id: string | null
          overtime_rate: number | null
          phone: string | null
          photo_url: string | null
          project_id: string
          role: string | null
          skills: Json | null
          status: string | null
          trade: string
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: Json | null
          name: string
          organization_id?: string | null
          overtime_rate?: number | null
          phone?: string | null
          photo_url?: string | null
          project_id: string
          role?: string | null
          skills?: Json | null
          status?: string | null
          trade: string
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          languages?: Json | null
          name?: string
          organization_id?: string | null
          overtime_rate?: number | null
          phone?: string | null
          photo_url?: string | null
          project_id?: string
          role?: string | null
          skills?: Json | null
          status?: string | null
          trade?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workforce_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_portfolio_metrics: {
        Args: { org_id: string }
        Returns: {
          total_projects: number
          active_projects: number
          total_contract_value: number
          avg_completion_percentage: number
          projects_on_schedule: number
          projects_at_risk: number
        }[]
      }
      can_user_approve: { Args: { p_project_id: string }; Returns: boolean }
      can_user_create: { Args: { p_project_id: string }; Returns: boolean }
      check_ai_rate_limit: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: boolean
      }
      check_expiring_certifications: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_body: string
          p_link: string
          p_project_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_user_project_role: { Args: { p_project_id: string }; Returns: string }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_project_role: {
        Args: { allowed_roles: string[]; p_project_id: string }
        Returns: boolean
      }
      search_project: {
        Args: { p_limit?: number; p_project_id: string; p_query: string }
        Returns: {
          entity_id: string
          entity_type: string
          link: string
          rank: number
          subtitle: string
          title: string
        }[]
      }
      should_send_notification: {
        Args: {
          p_channel?: string
          p_notification_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
    Enums: {},
  },
} as const

type PublicTables = Database['public']['Tables']
export type TableRow<T extends keyof PublicTables> = PublicTables[T]['Row']
export type InsertTables<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type UpdateTables<T extends keyof PublicTables> = PublicTables[T]['Update']
export type Project = TableRow<'projects'>
export type RFI = TableRow<'rfis'>
export type Submittal = TableRow<'submittals'>
export type PunchItem = TableRow<'punch_items'>
export type Task = TableRow<'tasks'>
export type Drawing = TableRow<'drawings'>
export type DailyLog = TableRow<'daily_logs'>
export type Crew = TableRow<'crews'>
export type BudgetItem = TableRow<'budget_items'>
export type ChangeOrder = TableRow<'change_orders'>
export type DirectoryContact = TableRow<'directory_contacts'>
export type FileRecord = TableRow<'files'>
export type FieldCapture = TableRow<'field_captures'>
export type SchedulePhase = TableRow<'schedule_phases'>
export type Notification = TableRow<'notifications'>
export type ActivityFeedItem = TableRow<'activity_feed'>
export type AIInsight = TableRow<'ai_insights'>
export type ProjectSnapshot = TableRow<'project_snapshots'>
export type Meeting = TableRow<'meetings'>
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type RFIResponse = TableRow<'rfi_responses'>
export type Organization = TableRow<'organizations'>

// Profile: the DB has no dedicated profiles table yet.
// Define a lightweight interface matching the shape authStore and supabase.ts expect
// so the app compiles. Replace with TableRow<'profiles'> once the migration lands.
export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  phone: string | null
  company: string | null
  trade: string | null
  avatar_url: string | null
  notification_preferences: Json | null
  organization_id: string | null
  role: string | null
  created_at: string | null
  updated_at: string | null
}

export { UserRole } from './enums'
