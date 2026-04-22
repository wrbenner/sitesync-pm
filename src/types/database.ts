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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          acted_on_action: string | null
          acted_on_at: string | null
          action_label: string | null
          action_link: string | null
          category: string | null
          confidence: number | null
          created_at: string | null
          dismissed: boolean | null
          entity_id: string | null
          entity_type: string | null
          expanded_content: string | null
          id: string
          message: string
          page: string
          prediction_type: string | null
          project_id: string
          severity: string | null
          updated_at: string | null
        }
        Insert: {
          acted_on_action?: string | null
          acted_on_at?: string | null
          action_label?: string | null
          action_link?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          dismissed?: boolean | null
          entity_id?: string | null
          entity_type?: string | null
          expanded_content?: string | null
          id?: string
          message: string
          page: string
          prediction_type?: string | null
          project_id: string
          severity?: string | null
          updated_at?: string | null
        }
        Update: {
          acted_on_action?: string | null
          acted_on_at?: string | null
          action_label?: string | null
          action_link?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          dismissed?: boolean | null
          entity_id?: string | null
          entity_type?: string | null
          expanded_content?: string | null
          id?: string
          message?: string
          page?: string
          prediction_type?: string | null
          project_id?: string
          severity?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rfi_drafts: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          project_id: string | null
          question: string | null
          severity: string | null
          source: string | null
          source_ref: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          question?: string | null
          severity?: string | null
          source?: string | null
          source_ref?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          question?: string | null
          severity?: string | null
          source?: string | null
          source_ref?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_rfi_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_rfi_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
      async_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          integration_id: string | null
          payload: Json | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          payload?: Json | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          payload?: Json | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          changed_fields: string[] | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string | null
          project_id: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          project_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          project_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_trail: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_title: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          project_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_title?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          project_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_title?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          project_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "audit_trail_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmarks: {
        Row: {
          closed_date: string | null
          created_at: string | null
          end_date: string | null
          id: string
          metric_type: string
          percent_complete: number | null
          project_id: string | null
          status: string | null
          value: number | null
        }
        Insert: {
          closed_date?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          metric_type: string
          percent_complete?: number | null
          project_id?: string | null
          status?: string | null
          value?: number | null
        }
        Update: {
          closed_date?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          metric_type?: string
          percent_complete?: number | null
          project_id?: string | null
          status?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "benchmarks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "benchmarks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
      bim_4d_sequence: {
        Row: {
          created_at: string | null
          id: string
          ifc_element_ids: number[]
          planned_end: string | null
          planned_start: string | null
          project_id: string
          sequence_order: number | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ifc_element_ids: number[]
          planned_end?: string | null
          planned_start?: string | null
          project_id: string
          sequence_order?: number | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ifc_element_ids?: number[]
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string
          sequence_order?: number | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_4d_sequence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_4d_sequence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_4d_sequence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_clash_reports: {
        Row: {
          assigned_to: string | null
          clash_location: Json | null
          clash_volume_cm3: number | null
          created_at: string | null
          created_by: string
          description: string | null
          element_a_id: number
          element_b_id: number
          id: string
          markup_id: string | null
          project_id: string
          resolution: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          clash_location?: Json | null
          clash_volume_cm3?: number | null
          created_at?: string | null
          created_by: string
          description?: string | null
          element_a_id: number
          element_b_id: number
          id?: string
          markup_id?: string | null
          project_id: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          clash_location?: Json | null
          clash_volume_cm3?: number | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          element_a_id?: number
          element_b_id?: number
          id?: string
          markup_id?: string | null
          project_id?: string
          resolution?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bim_clash_reports_markup_id_fkey"
            columns: ["markup_id"]
            isOneToOne: false
            referencedRelation: "bim_markups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_clash_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_clash_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_clashes: {
        Row: {
          clash_type: string
          created_at: string | null
          distance: number | null
          element_a_id: string | null
          element_b_id: string | null
          id: string
          linked_rfi_id: string | null
          model_id: string
          position: Json
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          clash_type: string
          created_at?: string | null
          distance?: number | null
          element_a_id?: string | null
          element_b_id?: string | null
          id?: string
          linked_rfi_id?: string | null
          model_id: string
          position: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          clash_type?: string
          created_at?: string | null
          distance?: number | null
          element_a_id?: string | null
          element_b_id?: string | null
          id?: string
          linked_rfi_id?: string | null
          model_id?: string
          position?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_clashes_element_a_id_fkey"
            columns: ["element_a_id"]
            isOneToOne: false
            referencedRelation: "bim_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_clashes_element_b_id_fkey"
            columns: ["element_b_id"]
            isOneToOne: false
            referencedRelation: "bim_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_clashes_linked_rfi_id_fkey"
            columns: ["linked_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_clashes_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bim_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_element_progress: {
        Row: {
          completion_percent: number | null
          element_name: string | null
          global_id: string | null
          id: string
          ifc_element_id: number
          last_updated: string | null
          notes: string | null
          project_id: string
          updated_by: string | null
        }
        Insert: {
          completion_percent?: number | null
          element_name?: string | null
          global_id?: string | null
          id?: string
          ifc_element_id: number
          last_updated?: string | null
          notes?: string | null
          project_id: string
          updated_by?: string | null
        }
        Update: {
          completion_percent?: number | null
          element_name?: string | null
          global_id?: string | null
          id?: string
          ifc_element_id?: number
          last_updated?: string | null
          notes?: string | null
          project_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_element_progress_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_element_progress_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_elements: {
        Row: {
          bounding_box: Json | null
          created_at: string | null
          floor: string | null
          geometry_hash: string | null
          id: string
          ifc_guid: string | null
          ifc_type: string | null
          linked_task_id: string | null
          material: string | null
          model_id: string
          name: string | null
          percent_complete: number | null
          properties: Json | null
          status: string | null
          trade: string | null
        }
        Insert: {
          bounding_box?: Json | null
          created_at?: string | null
          floor?: string | null
          geometry_hash?: string | null
          id?: string
          ifc_guid?: string | null
          ifc_type?: string | null
          linked_task_id?: string | null
          material?: string | null
          model_id: string
          name?: string | null
          percent_complete?: number | null
          properties?: Json | null
          status?: string | null
          trade?: string | null
        }
        Update: {
          bounding_box?: Json | null
          created_at?: string | null
          floor?: string | null
          geometry_hash?: string | null
          id?: string
          ifc_guid?: string | null
          ifc_type?: string | null
          linked_task_id?: string | null
          material?: string | null
          model_id?: string
          name?: string | null
          percent_complete?: number | null
          properties?: Json | null
          status?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_elements_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_elements_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bim_models"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_markups: {
        Row: {
          annotation_text: string | null
          area_unit: string | null
          area_value: number | null
          camera_position: Json | null
          camera_target: Json | null
          camera_zoom: number | null
          color: string | null
          created_at: string | null
          created_by: string
          data: Json | null
          description: string | null
          element_ids: number[] | null
          end_position: Json | null
          expires_at: string | null
          id: string
          image_url: string | null
          layer: string | null
          linked_element_id: string | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          markup_data: Json | null
          markup_type: string
          measurement_unit: string | null
          measurement_value: number | null
          model_id: string
          normal: Json | null
          photo_url: string | null
          position: Json
          project_id: string
          shared_with: string[] | null
          start_position: Json | null
          title: string | null
          updated_at: string | null
          visibility_public: boolean | null
          volume_unit: string | null
          volume_value: number | null
        }
        Insert: {
          annotation_text?: string | null
          area_unit?: string | null
          area_value?: number | null
          camera_position?: Json | null
          camera_target?: Json | null
          camera_zoom?: number | null
          color?: string | null
          created_at?: string | null
          created_by: string
          data?: Json | null
          description?: string | null
          element_ids?: number[] | null
          end_position?: Json | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          layer?: string | null
          linked_element_id?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          markup_data?: Json | null
          markup_type: string
          measurement_unit?: string | null
          measurement_value?: number | null
          model_id: string
          normal?: Json | null
          photo_url?: string | null
          position: Json
          project_id: string
          shared_with?: string[] | null
          start_position?: Json | null
          title?: string | null
          updated_at?: string | null
          visibility_public?: boolean | null
          volume_unit?: string | null
          volume_value?: number | null
        }
        Update: {
          annotation_text?: string | null
          area_unit?: string | null
          area_value?: number | null
          camera_position?: Json | null
          camera_target?: Json | null
          camera_zoom?: number | null
          color?: string | null
          created_at?: string | null
          created_by?: string
          data?: Json | null
          description?: string | null
          element_ids?: number[] | null
          end_position?: Json | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          layer?: string | null
          linked_element_id?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          markup_data?: Json | null
          markup_type?: string
          measurement_unit?: string | null
          measurement_value?: number | null
          model_id?: string
          normal?: Json | null
          photo_url?: string | null
          position?: Json
          project_id?: string
          shared_with?: string[] | null
          start_position?: Json | null
          title?: string | null
          updated_at?: string | null
          visibility_public?: boolean | null
          volume_unit?: string | null
          volume_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_markups_linked_element_id_fkey"
            columns: ["linked_element_id"]
            isOneToOne: false
            referencedRelation: "bim_elements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_markups_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "bim_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_markups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_markups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_models: {
        Row: {
          bounding_box: Json | null
          created_at: string | null
          element_count: number | null
          file_path: string
          file_size: number | null
          floor_count: number | null
          format: string
          id: string
          metadata: Json | null
          name: string
          processed: boolean | null
          processing_error: string | null
          project_id: string
          spatial_tree: Json | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          bounding_box?: Json | null
          created_at?: string | null
          element_count?: number | null
          file_path: string
          file_size?: number | null
          floor_count?: number | null
          format?: string
          id?: string
          metadata?: Json | null
          name: string
          processed?: boolean | null
          processing_error?: string | null
          project_id: string
          spatial_tree?: Json | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          bounding_box?: Json | null
          created_at?: string | null
          element_count?: number | null
          file_path?: string
          file_size?: number | null
          floor_count?: number | null
          format?: string
          id?: string
          metadata?: Json | null
          name?: string
          processed?: boolean | null
          processing_error?: string | null
          project_id?: string
          spatial_tree?: Json | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bim_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_rfi_elements: {
        Row: {
          created_at: string | null
          id: string
          ifc_element_id: number
          location_x: number | null
          location_y: number | null
          location_z: number | null
          project_id: string
          rfi_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ifc_element_id: number
          location_x?: number | null
          location_y?: number | null
          location_z?: number | null
          project_id: string
          rfi_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ifc_element_id?: number
          location_x?: number | null
          location_y?: number | null
          location_z?: number | null
          project_id?: string
          rfi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bim_rfi_elements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_rfi_elements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bim_rfi_elements_rfi_id_fkey"
            columns: ["rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
        ]
      }
      bim_safety_zones: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          hazard_type: string
          id: string
          project_id: string
          severity: string | null
          zone_bounds: Json
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          hazard_type: string
          id?: string
          project_id: string
          severity?: string | null
          zone_bounds: Json
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          hazard_type?: string
          id?: string
          project_id?: string
          severity?: string | null
          zone_bounds?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bim_safety_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bim_safety_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_line_items: {
        Row: {
          actual_cost: number | null
          approved_changes: number | null
          committed_cost: number | null
          contingency_original: number | null
          contingency_used: number | null
          created_at: string | null
          csi_code: string | null
          description: string | null
          id: string
          original_amount: number | null
          project_id: string
          projected_final: number | null
          revised_budget: number | null
          updated_at: string | null
          variance: number | null
        }
        Insert: {
          actual_cost?: number | null
          approved_changes?: number | null
          committed_cost?: number | null
          contingency_original?: number | null
          contingency_used?: number | null
          created_at?: string | null
          csi_code?: string | null
          description?: string | null
          id?: string
          original_amount?: number | null
          project_id: string
          projected_final?: number | null
          revised_budget?: number | null
          updated_at?: string | null
          variance?: number | null
        }
        Update: {
          actual_cost?: number | null
          approved_changes?: number | null
          committed_cost?: number | null
          contingency_original?: number | null
          contingency_used?: number | null
          created_at?: string | null
          csi_code?: string | null
          description?: string | null
          id?: string
          original_amount?: number | null
          project_id?: string
          projected_final?: number | null
          revised_budget?: number | null
          updated_at?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      certified_payroll_employees: {
        Row: {
          created_at: string | null
          employee_name: string
          federal_withholding: number | null
          fringe_benefits: number | null
          gross_pay: number | null
          hourly_rate: number | null
          hours_worked: number | null
          id: string
          medicare: number | null
          payroll_report_id: string
          prevailing_wage_met: boolean | null
          social_security: number | null
          state_withholding: number | null
          trade_classification: string | null
        }
        Insert: {
          created_at?: string | null
          employee_name: string
          federal_withholding?: number | null
          fringe_benefits?: number | null
          gross_pay?: number | null
          hourly_rate?: number | null
          hours_worked?: number | null
          id?: string
          medicare?: number | null
          payroll_report_id: string
          prevailing_wage_met?: boolean | null
          social_security?: number | null
          state_withholding?: number | null
          trade_classification?: string | null
        }
        Update: {
          created_at?: string | null
          employee_name?: string
          federal_withholding?: number | null
          fringe_benefits?: number | null
          gross_pay?: number | null
          hourly_rate?: number | null
          hours_worked?: number | null
          id?: string
          medicare?: number | null
          payroll_report_id?: string
          prevailing_wage_met?: boolean | null
          social_security?: number | null
          state_withholding?: number | null
          trade_classification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certified_payroll_employees_payroll_report_id_fkey"
            columns: ["payroll_report_id"]
            isOneToOne: false
            referencedRelation: "certified_payroll_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      certified_payroll_reports: {
        Row: {
          contractor_id: string
          created_at: string | null
          davis_bacon_compliant: boolean | null
          id: string
          project_id: string
          report_number: string | null
          status: string | null
          submitted_at: string | null
          submitted_to_agency: string | null
          week_ending_date: string
        }
        Insert: {
          contractor_id: string
          created_at?: string | null
          davis_bacon_compliant?: boolean | null
          id?: string
          project_id: string
          report_number?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_to_agency?: string | null
          week_ending_date: string
        }
        Update: {
          contractor_id?: string
          created_at?: string | null
          davis_bacon_compliant?: boolean | null
          id?: string
          project_id?: string
          report_number?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_to_agency?: string | null
          week_ending_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "certified_payroll_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "certified_payroll_reports_project_id_fkey"
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
          approval_comments: string | null
          approved_at: string | null
          approved_by: string | null
          approved_cost: number | null
          approved_date: string | null
          budget_line_item_id: string | null
          cost_code: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          estimated_cost: number | null
          id: string
          number: number
          parent_co_id: string | null
          project_id: string
          promoted_at: string | null
          promoted_from_id: string | null
          reason: string | null
          reason_code: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_comments: string | null
          requested_by: string | null
          requested_date: string | null
          review_comments: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_impact: string | null
          schedule_impact_days: number | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          submitted_cost: number | null
          title: string | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          approval_comments?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_cost?: number | null
          approved_date?: string | null
          budget_line_item_id?: string | null
          cost_code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          number?: number
          parent_co_id?: string | null
          project_id: string
          promoted_at?: string | null
          promoted_from_id?: string | null
          reason?: string | null
          reason_code?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_comments?: string | null
          requested_by?: string | null
          requested_date?: string | null
          review_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_impact?: string | null
          schedule_impact_days?: number | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_cost?: number | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          approval_comments?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_cost?: number | null
          approved_date?: string | null
          budget_line_item_id?: string | null
          cost_code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          number?: number
          parent_co_id?: string | null
          project_id?: string
          promoted_at?: string | null
          promoted_from_id?: string | null
          reason?: string | null
          reason_code?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_comments?: string | null
          requested_by?: string | null
          requested_date?: string | null
          review_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_impact?: string | null
          schedule_impact_days?: number | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_cost?: number | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_promoted_from_id_fkey"
            columns: ["promoted_from_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
          priority: string | null
          project_id: string
          project_type: string | null
          rejection_comments: string | null
          reminder_sent_at: string | null
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
          priority?: string | null
          project_id: string
          project_type?: string | null
          rejection_comments?: string | null
          reminder_sent_at?: string | null
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
          priority?: string | null
          project_id?: string
          project_type?: string | null
          rejection_comments?: string | null
          reminder_sent_at?: string | null
          status?: string | null
          trade?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closeout_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "closeout_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coi_extractions: {
        Row: {
          additional_insured: boolean | null
          coverage_limit: number | null
          coverage_type: string | null
          created_at: string | null
          deductible: number | null
          effective_date: string | null
          expiration_date: string | null
          extraction_confidence: number | null
          id: string
          insurance_certificate_id: string
          insurer_name: string | null
          policy_number: string | null
          primary_non_contributory: boolean | null
          verified_at: string | null
          verified_by: string | null
          waiver_of_subrogation: boolean | null
        }
        Insert: {
          additional_insured?: boolean | null
          coverage_limit?: number | null
          coverage_type?: string | null
          created_at?: string | null
          deductible?: number | null
          effective_date?: string | null
          expiration_date?: string | null
          extraction_confidence?: number | null
          id?: string
          insurance_certificate_id: string
          insurer_name?: string | null
          policy_number?: string | null
          primary_non_contributory?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          waiver_of_subrogation?: boolean | null
        }
        Update: {
          additional_insured?: boolean | null
          coverage_limit?: number | null
          coverage_type?: string | null
          created_at?: string | null
          deductible?: number | null
          effective_date?: string | null
          expiration_date?: string | null
          extraction_confidence?: number | null
          id?: string
          insurance_certificate_id?: string
          insurer_name?: string | null
          policy_number?: string | null
          primary_non_contributory?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
          waiver_of_subrogation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coi_extractions_insurance_certificate_id_fkey"
            columns: ["insurance_certificate_id"]
            isOneToOne: false
            referencedRelation: "insurance_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      coi_requirements: {
        Row: {
          additional_insured_required: boolean | null
          coverage_type: string
          created_at: string | null
          id: string
          minimum_limit: number | null
          notes: string | null
          primary_non_contributory_required: boolean | null
          project_id: string
          waiver_of_subrogation_required: boolean | null
        }
        Insert: {
          additional_insured_required?: boolean | null
          coverage_type: string
          created_at?: string | null
          id?: string
          minimum_limit?: number | null
          notes?: string | null
          primary_non_contributory_required?: boolean | null
          project_id: string
          waiver_of_subrogation_required?: boolean | null
        }
        Update: {
          additional_insured_required?: boolean | null
          coverage_type?: string
          created_at?: string | null
          id?: string
          minimum_limit?: number | null
          notes?: string | null
          primary_non_contributory_required?: boolean | null
          project_id?: string
          waiver_of_subrogation_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coi_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "coi_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commissioning_items: {
        Row: {
          category: string
          created_at: string | null
          description: string
          equipment_tag: string | null
          id: string
          linked_closeout_id: string | null
          location: string | null
          notes: string | null
          project_id: string
          result_data: Json | null
          status: string | null
          system_name: string
          tested_at: string | null
          tested_by: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          equipment_tag?: string | null
          id?: string
          linked_closeout_id?: string | null
          location?: string | null
          notes?: string | null
          project_id: string
          result_data?: Json | null
          status?: string | null
          system_name: string
          tested_at?: string | null
          tested_by?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          equipment_tag?: string | null
          id?: string
          linked_closeout_id?: string | null
          location?: string | null
          notes?: string | null
          project_id?: string
          result_data?: Json | null
          status?: string | null
          system_name?: string
          tested_at?: string | null
          tested_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissioning_items_linked_closeout_id_fkey"
            columns: ["linked_closeout_id"]
            isOneToOne: false
            referencedRelation: "closeout_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissioning_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "commissioning_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          insurance_expiry: string | null
          insurance_status: string | null
          name: string
          project_id: string | null
          trade: string | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_status?: string | null
          name: string
          project_id?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_status?: string | null
          name?: string
          project_id?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "companies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reports: {
        Row: {
          created_at: string | null
          date_range_end: string
          date_range_start: string
          file_url: string | null
          generated_by: string
          id: string
          metadata: Json | null
          organization_id: string
          project_id: string | null
          report_type: string
        }
        Insert: {
          created_at?: string | null
          date_range_end: string
          date_range_start: string
          file_url?: string | null
          generated_by: string
          id?: string
          metadata?: Json | null
          organization_id: string
          project_id?: string | null
          report_type: string
        }
        Update: {
          created_at?: string | null
          date_range_end?: string
          date_range_start?: string
          file_url?: string | null
          generated_by?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          project_id?: string | null
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "compliance_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clauses: {
        Row: {
          clause_category: string | null
          clause_id: string | null
          clause_text: string | null
          clause_title: string | null
          clause_version: number | null
          contract_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          clause_category?: string | null
          clause_id?: string | null
          clause_text?: string | null
          clause_title?: string | null
          clause_version?: number | null
          contract_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          clause_category?: string | null
          clause_id?: string | null
          clause_text?: string | null
          clause_title?: string | null
          clause_version?: number | null
          contract_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
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
          updated_by: string | null
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
          updated_by?: string | null
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
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string | null
          id: string
          project_id: string
          route: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          project_id: string
          route?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          project_id?: string
          route?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "corrective_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          actual_amount: number | null
          budgeted_amount: number | null
          code: string
          committed_amount: number | null
          created_at: string | null
          description: string
          forecast_amount: number | null
          id: string
          project_id: string
        }
        Insert: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          code: string
          committed_amount?: number | null
          created_at?: string | null
          description?: string
          forecast_amount?: number | null
          id?: string
          project_id: string
        }
        Update: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          code?: string
          committed_amount?: number | null
          created_at?: string | null
          description?: string
          forecast_amount?: number | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "cost_codes_project_id_fkey"
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
      cost_transactions: {
        Row: {
          amount: number
          cost_code_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          description: string | null
          id: string
          project_id: string
          reference: string | null
          type: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          cost_code_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          description?: string | null
          id?: string
          project_id: string
          reference?: string | null
          type: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          cost_code_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          description?: string | null
          id?: string
          project_id?: string
          reference?: string | null
          type?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_transactions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "cost_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_gps_locations: {
        Row: {
          accuracy_meters: number | null
          altitude: number | null
          crew_id: string
          id: string
          latitude: number
          longitude: number
          project_id: string
          recorded_at: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          altitude?: number | null
          crew_id: string
          id?: string
          latitude: number
          longitude: number
          project_id: string
          recorded_at?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          altitude?: number | null
          crew_id?: string
          id?: string
          latitude?: number
          longitude?: number
          project_id?: string
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_gps_locations_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_gps_locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_gps_locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          deleted_at: string | null
          deleted_by: string | null
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
          updated_by: string | null
          weather: string | null
          weather_am: string | null
          weather_pm: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          incidents?: number | null
          log_date: string
          manager_signature_url?: string | null
          precipitation?: string | null
          project_id: string
          rejection_comments?: string | null
          status?: string | null
          summary?: string | null
          superintendent_signature_url?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          total_hours?: number | null
          updated_at?: string | null
          updated_by?: string | null
          weather?: string | null
          weather_am?: string | null
          weather_pm?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          incidents?: number | null
          log_date?: string
          manager_signature_url?: string | null
          precipitation?: string | null
          project_id?: string
          rejection_comments?: string | null
          status?: string | null
          summary?: string | null
          superintendent_signature_url?: string | null
          temperature_high?: number | null
          temperature_low?: number | null
          total_hours?: number | null
          updated_at?: string | null
          updated_by?: string | null
          weather?: string | null
          weather_am?: string | null
          weather_pm?: string | null
          wind_speed?: string | null
          workers_onsite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "directory_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          folder: string | null
          id: string
          name: string
          project_id: string
          search_vector: unknown
          tags: Json | null
          updated_at: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          folder?: string | null
          id?: string
          name: string
          project_id: string
          search_vector?: unknown
          tags?: Json | null
          updated_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          folder?: string | null
          id?: string
          name?: string
          project_id?: string
          search_vector?: unknown
          tags?: Json | null
          updated_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_annotations: {
        Row: {
          annotation_data: Json | null
          annotation_type: string
          color: string
          created_at: string | null
          created_by: string | null
          drawing_id: string
          fill_color: string | null
          id: string
          is_locked: boolean | null
          is_resolved: boolean | null
          label: string | null
          layer_index: number | null
          linked_punch_item_id: string | null
          linked_rfi_id: string | null
          notes: string | null
          opacity: number | null
          page_number: number
          project_id: string
          rotation: number | null
          scale: number | null
          shape_data: Json
          stroke_color: string | null
          stroke_width: number | null
          updated_at: string | null
        }
        Insert: {
          annotation_data?: Json | null
          annotation_type?: string
          color?: string
          created_at?: string | null
          created_by?: string | null
          drawing_id: string
          fill_color?: string | null
          id?: string
          is_locked?: boolean | null
          is_resolved?: boolean | null
          label?: string | null
          layer_index?: number | null
          linked_punch_item_id?: string | null
          linked_rfi_id?: string | null
          notes?: string | null
          opacity?: number | null
          page_number?: number
          project_id: string
          rotation?: number | null
          scale?: number | null
          shape_data?: Json
          stroke_color?: string | null
          stroke_width?: number | null
          updated_at?: string | null
        }
        Update: {
          annotation_data?: Json | null
          annotation_type?: string
          color?: string
          created_at?: string | null
          created_by?: string | null
          drawing_id?: string
          fill_color?: string | null
          id?: string
          is_locked?: boolean | null
          is_resolved?: boolean | null
          label?: string | null
          layer_index?: number | null
          linked_punch_item_id?: string | null
          linked_rfi_id?: string | null
          notes?: string | null
          opacity?: number | null
          page_number?: number
          project_id?: string
          rotation?: number | null
          scale?: number | null
          shape_data?: Json
          stroke_color?: string | null
          stroke_width?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_annotations_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_annotations_linked_punch_item_id_fkey"
            columns: ["linked_punch_item_id"]
            isOneToOne: false
            referencedRelation: "punch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_annotations_linked_rfi_id_fkey"
            columns: ["linked_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_bulletins: {
        Row: {
          affected_drawing_ids: string[]
          bulletin_number: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          issued_date: string | null
          project_id: string
          title: string
        }
        Insert: {
          affected_drawing_ids?: string[]
          bulletin_number: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          issued_date?: string | null
          project_id: string
          title: string
        }
        Update: {
          affected_drawing_ids?: string[]
          bulletin_number?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          issued_date?: string | null
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_bulletins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_bulletins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_classifications: {
        Row: {
          ai_cost_cents: number | null
          building_name: string | null
          classification_confidence: number | null
          created_at: string | null
          design_description: Json | null
          discipline: string | null
          drawing_id: string | null
          drawing_title: string | null
          floor_level: string | null
          id: string
          pairing_tokens: Json | null
          plan_type: string | null
          processed_at: string | null
          processing_status: string | null
          project_id: string | null
          scale_ratio: number | null
          scale_text: string | null
          sheet_number: string | null
          viewport_details: Json | null
        }
        Insert: {
          ai_cost_cents?: number | null
          building_name?: string | null
          classification_confidence?: number | null
          created_at?: string | null
          design_description?: Json | null
          discipline?: string | null
          drawing_id?: string | null
          drawing_title?: string | null
          floor_level?: string | null
          id?: string
          pairing_tokens?: Json | null
          plan_type?: string | null
          processed_at?: string | null
          processing_status?: string | null
          project_id?: string | null
          scale_ratio?: number | null
          scale_text?: string | null
          sheet_number?: string | null
          viewport_details?: Json | null
        }
        Update: {
          ai_cost_cents?: number | null
          building_name?: string | null
          classification_confidence?: number | null
          created_at?: string | null
          design_description?: Json | null
          discipline?: string | null
          drawing_id?: string | null
          drawing_title?: string | null
          floor_level?: string | null
          id?: string
          pairing_tokens?: Json | null
          plan_type?: string | null
          processed_at?: string | null
          processing_status?: string | null
          project_id?: string | null
          scale_ratio?: number | null
          scale_text?: string | null
          sheet_number?: string | null
          viewport_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_classifications_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_classifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_classifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_discrepancies: {
        Row: {
          arch_dimension: string | null
          auto_rfi_id: string | null
          confidence: number | null
          created_at: string | null
          description: string | null
          drawing_id: string | null
          drawing_pair_id: string | null
          id: string
          is_false_positive: boolean | null
          location_label: string | null
          location_on_drawing: Json | null
          location_x: number | null
          location_y: number | null
          metadata: Json | null
          pair_id: string | null
          project_id: string
          severity: string | null
          status: string | null
          struct_dimension: string | null
          type: string | null
          updated_at: string | null
          user_confirmed: boolean | null
        }
        Insert: {
          arch_dimension?: string | null
          auto_rfi_id?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          drawing_id?: string | null
          drawing_pair_id?: string | null
          id?: string
          is_false_positive?: boolean | null
          location_label?: string | null
          location_on_drawing?: Json | null
          location_x?: number | null
          location_y?: number | null
          metadata?: Json | null
          pair_id?: string | null
          project_id: string
          severity?: string | null
          status?: string | null
          struct_dimension?: string | null
          type?: string | null
          updated_at?: string | null
          user_confirmed?: boolean | null
        }
        Update: {
          arch_dimension?: string | null
          auto_rfi_id?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          drawing_id?: string | null
          drawing_pair_id?: string | null
          id?: string
          is_false_positive?: boolean | null
          location_label?: string | null
          location_on_drawing?: Json | null
          location_x?: number | null
          location_y?: number | null
          metadata?: Json | null
          pair_id?: string | null
          project_id?: string
          severity?: string | null
          status?: string | null
          struct_dimension?: string | null
          type?: string | null
          updated_at?: string | null
          user_confirmed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_discrepancies_auto_rfi_id_fkey"
            columns: ["auto_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_discrepancies_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_discrepancies_drawing_pair_id_fkey"
            columns: ["drawing_pair_id"]
            isOneToOne: false
            referencedRelation: "drawing_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_discrepancies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_discrepancies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_distributions: {
        Row: {
          acknowledged_at: string | null
          downloaded_at: string | null
          drawing_set_id: string | null
          id: string
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          transmittal_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          downloaded_at?: string | null
          drawing_set_id?: string | null
          id?: string
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          transmittal_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          downloaded_at?: string | null
          drawing_set_id?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          transmittal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_distributions_drawing_set_id_fkey"
            columns: ["drawing_set_id"]
            isOneToOne: false
            referencedRelation: "drawing_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_distributions_transmittal_id_fkey"
            columns: ["transmittal_id"]
            isOneToOne: false
            referencedRelation: "transmittals"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_markups: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          data: Json
          drawing_id: string
          geometry_type: string | null
          id: string
          layer: string | null
          linked_photo_id: string | null
          linked_punch_item_id: string | null
          linked_rfi_id: string | null
          linked_submittal_id: string | null
          markup_status: string | null
          measurement_scale: number | null
          measurement_unit: string | null
          measurement_value: number | null
          normalized_coords: Json | null
          note: string | null
          project_id: string
          shape_data: Json | null
          stamp_type: string | null
          type: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json
          drawing_id: string
          geometry_type?: string | null
          id?: string
          layer?: string | null
          linked_photo_id?: string | null
          linked_punch_item_id?: string | null
          linked_rfi_id?: string | null
          linked_submittal_id?: string | null
          markup_status?: string | null
          measurement_scale?: number | null
          measurement_unit?: string | null
          measurement_value?: number | null
          normalized_coords?: Json | null
          note?: string | null
          project_id: string
          shape_data?: Json | null
          stamp_type?: string | null
          type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json
          drawing_id?: string
          geometry_type?: string | null
          id?: string
          layer?: string | null
          linked_photo_id?: string | null
          linked_punch_item_id?: string | null
          linked_rfi_id?: string | null
          linked_submittal_id?: string | null
          markup_status?: string | null
          measurement_scale?: number | null
          measurement_unit?: string | null
          measurement_value?: number | null
          normalized_coords?: Json | null
          note?: string | null
          project_id?: string
          shape_data?: Json | null
          stamp_type?: string | null
          type?: string | null
          updated_at?: string | null
          visibility?: string | null
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      drawing_pages: {
        Row: {
          building_name: string | null
          classification: string | null
          classification_confidence: number | null
          created_at: string | null
          design_description: Json | null
          discipline: string | null
          drawing_id: string
          drawing_title: string | null
          floor_level: string | null
          height: number | null
          id: string
          image_url: string | null
          is_pair_candidate: boolean | null
          page_number: number
          pairing_tokens: Json | null
          plan_type: string | null
          project_id: string
          scale_ratio: number | null
          scale_text: string | null
          sheet_number: string | null
          thumbnail_url: string | null
          updated_at: string | null
          viewport_details: Json | null
          width: number | null
        }
        Insert: {
          building_name?: string | null
          classification?: string | null
          classification_confidence?: number | null
          created_at?: string | null
          design_description?: Json | null
          discipline?: string | null
          drawing_id: string
          drawing_title?: string | null
          floor_level?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_pair_candidate?: boolean | null
          page_number: number
          pairing_tokens?: Json | null
          plan_type?: string | null
          project_id: string
          scale_ratio?: number | null
          scale_text?: string | null
          sheet_number?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          viewport_details?: Json | null
          width?: number | null
        }
        Update: {
          building_name?: string | null
          classification?: string | null
          classification_confidence?: number | null
          created_at?: string | null
          design_description?: Json | null
          discipline?: string | null
          drawing_id?: string
          drawing_title?: string | null
          floor_level?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_pair_candidate?: boolean | null
          page_number?: number
          pairing_tokens?: Json | null
          plan_type?: string | null
          project_id?: string
          scale_ratio?: number | null
          scale_text?: string | null
          sheet_number?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          viewport_details?: Json | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_pages_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_pairs: {
        Row: {
          arch_classification_id: string | null
          arch_drawing_id: string | null
          created_at: string | null
          detected_edges: Json | null
          drawing_a_id: string | null
          drawing_b_id: string | null
          id: string
          overlap_image_url: string | null
          pair_type: string | null
          pairing_confidence: number | null
          pairing_method: string | null
          pairing_reason: string | null
          project_id: string
          similarity_score: number | null
          status: string | null
          struct_classification_id: string | null
          struct_drawing_id: string | null
          updated_at: string | null
        }
        Insert: {
          arch_classification_id?: string | null
          arch_drawing_id?: string | null
          created_at?: string | null
          detected_edges?: Json | null
          drawing_a_id?: string | null
          drawing_b_id?: string | null
          id?: string
          overlap_image_url?: string | null
          pair_type?: string | null
          pairing_confidence?: number | null
          pairing_method?: string | null
          pairing_reason?: string | null
          project_id: string
          similarity_score?: number | null
          status?: string | null
          struct_classification_id?: string | null
          struct_drawing_id?: string | null
          updated_at?: string | null
        }
        Update: {
          arch_classification_id?: string | null
          arch_drawing_id?: string | null
          created_at?: string | null
          detected_edges?: Json | null
          drawing_a_id?: string | null
          drawing_b_id?: string | null
          id?: string
          overlap_image_url?: string | null
          pair_type?: string | null
          pairing_confidence?: number | null
          pairing_method?: string | null
          pairing_reason?: string | null
          project_id?: string
          similarity_score?: number | null
          status?: string | null
          struct_classification_id?: string | null
          struct_drawing_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_pairs_drawing_a_id_fkey"
            columns: ["drawing_a_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_pairs_drawing_b_id_fkey"
            columns: ["drawing_b_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_pairs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_pairs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_revisions: {
        Row: {
          change_description: string | null
          created_at: string | null
          description: string | null
          drawing_id: string
          file_url: string | null
          id: string
          issued_by: string | null
          issued_date: string | null
          project_id: string
          revision_number: string
          uploaded_by: string | null
        }
        Insert: {
          change_description?: string | null
          created_at?: string | null
          description?: string | null
          drawing_id: string
          file_url?: string | null
          id?: string
          issued_by?: string | null
          issued_date?: string | null
          project_id: string
          revision_number: string
          uploaded_by?: string | null
        }
        Update: {
          change_description?: string | null
          created_at?: string | null
          description?: string | null
          drawing_id?: string
          file_url?: string | null
          id?: string
          issued_by?: string | null
          issued_date?: string | null
          project_id?: string
          revision_number?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_revisions_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_sets: {
        Row: {
          cover_letter: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          drawing_ids: string[]
          id: string
          issued_by: string | null
          issued_date: string | null
          name: string
          project_id: string
          set_type: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drawing_ids?: string[]
          id?: string
          issued_by?: string | null
          issued_date?: string | null
          name: string
          project_id: string
          set_type?: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          drawing_ids?: string[]
          id?: string
          issued_by?: string | null
          issued_date?: string | null
          name?: string
          project_id?: string
          set_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_text_content: {
        Row: {
          created_at: string | null
          drawing_id: string
          id: string
          page_number: number
          text_blocks: Json | null
          text_content: string
        }
        Insert: {
          created_at?: string | null
          drawing_id: string
          id?: string
          page_number: number
          text_blocks?: Json | null
          text_content: string
        }
        Update: {
          created_at?: string | null
          drawing_id?: string
          id?: string
          page_number?: number
          text_blocks?: Json | null
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_text_content_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
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
          file_size_bytes: number | null
          file_url: string | null
          id: string
          previous_revision_id: string | null
          processing_status: string | null
          project_id: string
          received_date: string | null
          revision: string | null
          search_vector: unknown
          set_name: string | null
          sheet_number: string | null
          source_filename: string | null
          status: string | null
          thumbnail_url: string | null
          tile_format: string | null
          tile_levels: number | null
          tile_status: string | null
          title: string
          total_pages: number | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_changes_detected?: number | null
          change_description?: string | null
          created_at?: string | null
          discipline?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          previous_revision_id?: string | null
          processing_status?: string | null
          project_id: string
          received_date?: string | null
          revision?: string | null
          search_vector?: unknown
          set_name?: string | null
          sheet_number?: string | null
          source_filename?: string | null
          status?: string | null
          thumbnail_url?: string | null
          tile_format?: string | null
          tile_levels?: number | null
          tile_status?: string | null
          title: string
          total_pages?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_changes_detected?: number | null
          change_description?: string | null
          created_at?: string | null
          discipline?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          previous_revision_id?: string | null
          processing_status?: string | null
          project_id?: string
          received_date?: string | null
          revision?: string | null
          search_vector?: unknown
          set_name?: string | null
          sheet_number?: string | null
          source_filename?: string | null
          status?: string | null
          thumbnail_url?: string | null
          tile_format?: string | null
          tile_levels?: number | null
          tile_status?: string | null
          title?: string
          total_pages?: number | null
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      edit_locks: {
        Row: {
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          locked_at: string | null
          locked_by: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string
        }
        Relationships: []
      }
      encrypted_fields: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          project_id: string
          vault_secret_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          project_id: string
          vault_secret_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          project_id?: string
          vault_secret_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "encrypted_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          acquisition_cost: number | null
          barcode: string | null
          created_at: string | null
          current_location: string | null
          current_project_id: string | null
          depreciation_rate: number | null
          documents: Json | null
          hours_meter: number | null
          id: string
          insurance_expiry: string | null
          insurance_policy: string | null
          is_operational: boolean | null
          last_service_date: string | null
          make: string | null
          manufacturer: string | null
          model: string | null
          name: string
          next_service_due: string | null
          ownership: string | null
          parent_equipment_id: string | null
          photos: Json | null
          project_id: string | null
          qr_code: string | null
          rental_rate_daily: number | null
          rental_rate_monthly: number | null
          rental_rate_weekly: number | null
          serial_number: string | null
          status: string | null
          total_downtime_hours: number | null
          type: string | null
          updated_at: string | null
          vendor: string | null
          warranty_expiry: string | null
          year: number | null
        }
        Insert: {
          acquisition_cost?: number | null
          barcode?: string | null
          created_at?: string | null
          current_location?: string | null
          current_project_id?: string | null
          depreciation_rate?: number | null
          documents?: Json | null
          hours_meter?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          is_operational?: boolean | null
          last_service_date?: string | null
          make?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_service_due?: string | null
          ownership?: string | null
          parent_equipment_id?: string | null
          photos?: Json | null
          project_id?: string | null
          qr_code?: string | null
          rental_rate_daily?: number | null
          rental_rate_monthly?: number | null
          rental_rate_weekly?: number | null
          serial_number?: string | null
          status?: string | null
          total_downtime_hours?: number | null
          type?: string | null
          updated_at?: string | null
          vendor?: string | null
          warranty_expiry?: string | null
          year?: number | null
        }
        Update: {
          acquisition_cost?: number | null
          barcode?: string | null
          created_at?: string | null
          current_location?: string | null
          current_project_id?: string | null
          depreciation_rate?: number | null
          documents?: Json | null
          hours_meter?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          is_operational?: boolean | null
          last_service_date?: string | null
          make?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_service_due?: string | null
          ownership?: string | null
          parent_equipment_id?: string | null
          photos?: Json | null
          project_id?: string | null
          qr_code?: string | null
          rental_rate_daily?: number | null
          rental_rate_monthly?: number | null
          rental_rate_weekly?: number | null
          serial_number?: string | null
          status?: string | null
          total_downtime_hours?: number | null
          type?: string | null
          updated_at?: string | null
          vendor?: string | null
          warranty_expiry?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "equipment_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_parent_equipment_id_fkey"
            columns: ["parent_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      file_versions: {
        Row: {
          change_description: string | null
          created_at: string | null
          file_id: string
          file_size: number | null
          file_url: string
          id: string
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          change_description?: string | null
          created_at?: string | null
          file_id: string
          file_size?: number | null
          file_url: string
          id?: string
          uploaded_by?: string | null
          version_number?: number
        }
        Update: {
          change_description?: string | null
          created_at?: string | null
          file_id?: string
          file_size?: number | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
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
          search_vector: unknown
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
          search_vector?: unknown
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
          search_vector?: unknown
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      ifc_models: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string
          file_size: number | null
          hash: string
          id: string
          metadata: Json | null
          project_id: string
          storage_key: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_size?: number | null
          hash: string
          id?: string
          metadata?: Json | null
          project_id: string
          storage_key?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          hash?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          storage_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ifc_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ifc_models_project_id_fkey"
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
          created_by: string | null
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
          updated_by: string | null
          witness_names: Json | null
        }
        Insert: {
          area?: string | null
          body_part?: string | null
          corrective_actions?: Json | null
          created_at?: string | null
          created_by?: string | null
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
          updated_by?: string | null
          witness_names?: Json | null
        }
        Update: {
          area?: string | null
          body_part?: string | null
          corrective_actions?: Json | null
          created_at?: string | null
          created_by?: string | null
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
          updated_by?: string | null
          witness_names?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checklist_items: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          label: string
          meter_unit: string | null
          notes: string | null
          photo_urls: Json | null
          sort_order: number | null
          status: string | null
          task_type: string
          value_meter: number | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          label: string
          meter_unit?: string | null
          notes?: string | null
          photo_urls?: Json | null
          sort_order?: number | null
          status?: string | null
          task_type?: string
          value_meter?: number | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          label?: string
          meter_unit?: string | null
          notes?: string | null
          photo_urls?: Json | null
          sort_order?: number | null
          status?: string | null
          task_type?: string
          value_meter?: number | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "inspection_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checklists: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_template: boolean | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          name: string
          pass_rate: number | null
          project_id: string
          source_template_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          name: string
          pass_rate?: number | null
          project_id: string
          source_template_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          name?: string
          pass_rate?: number | null
          project_id?: string
          source_template_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inspection_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_checklists_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "inspection_checklists"
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
      inspections: {
        Row: {
          attachments: Json | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          id: string
          inspector_id: string | null
          inspector_name: string | null
          location: string | null
          notes: string | null
          project_id: string
          result: string | null
          scheduled_date: string | null
          status: string | null
          title: string
          trade: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          inspector_id?: string | null
          inspector_name?: string | null
          location?: string | null
          notes?: string | null
          project_id: string
          result?: string | null
          scheduled_date?: string | null
          status?: string | null
          title: string
          trade?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          inspector_id?: string | null
          inspector_name?: string | null
          location?: string | null
          notes?: string | null
          project_id?: string
          result?: string | null
          scheduled_date?: string | null
          status?: string | null
          title?: string
          trade?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
          status?: string | null
          sync_frequency?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          amount: number
          application_id: string | null
          contractor_name: string
          created_at: string | null
          document_url: string | null
          id: string
          notes: string | null
          project_id: string
          signed_at: string | null
          signed_by: string | null
          status: string
          through_date: string
          updated_at: string | null
          waiver_state: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          contractor_name: string
          created_at?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          project_id: string
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          through_date: string
          updated_at?: string | null
          waiver_state?: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          contractor_name?: string
          created_at?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          through_date?: string
          updated_at?: string | null
          waiver_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "lien_waivers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lien_waivers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      meter_readings: {
        Row: {
          created_at: string | null
          equipment_id: string
          id: string
          meter_name: string
          notes: string | null
          project_id: string
          reading_date: string | null
          reading_value: number
          recorded_by: string | null
          unit: string
        }
        Insert: {
          created_at?: string | null
          equipment_id: string
          id?: string
          meter_name?: string
          notes?: string | null
          project_id: string
          reading_date?: string | null
          reading_value: number
          recorded_by?: string | null
          unit?: string
        }
        Update: {
          created_at?: string | null
          equipment_id?: string
          id?: string
          meter_name?: string
          notes?: string | null
          project_id?: string
          reading_date?: string | null
          reading_value?: number
          recorded_by?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "meter_readings_project_id_fkey"
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
      notification_queue: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          project_id: string
          recipient_email: string
          recipient_user_id: string
          retry_count: number
          sent_at: string | null
          status: string
          template_data: Json
          template_name: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          project_id: string
          recipient_email: string
          recipient_user_id: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_data?: Json
          template_name: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          project_id?: string
          recipient_email?: string
          recipient_user_id?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_data?: Json
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notification_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organism_cycles: {
        Row: {
          build_result: Json | null
          completed_at: string | null
          cost_tokens_in: number | null
          cost_tokens_out: number | null
          error: string | null
          experiments: Json | null
          id: string
          learnings: Json | null
          models_used: string[] | null
          perception_data: Json | null
          phase: string
          started_at: string
          status: string
          verification_result: Json | null
        }
        Insert: {
          build_result?: Json | null
          completed_at?: string | null
          cost_tokens_in?: number | null
          cost_tokens_out?: number | null
          error?: string | null
          experiments?: Json | null
          id?: string
          learnings?: Json | null
          models_used?: string[] | null
          perception_data?: Json | null
          phase: string
          started_at?: string
          status?: string
          verification_result?: Json | null
        }
        Update: {
          build_result?: Json | null
          completed_at?: string | null
          cost_tokens_in?: number | null
          cost_tokens_out?: number | null
          error?: string | null
          experiments?: Json | null
          id?: string
          learnings?: Json | null
          models_used?: string[] | null
          perception_data?: Json | null
          phase?: string
          started_at?: string
          status?: string
          verification_result?: Json | null
        }
        Relationships: []
      }
      organism_experiments: {
        Row: {
          completed_at: string | null
          created_at: string
          cycle_id: string | null
          expected_improvement: string | null
          failure_reason: string | null
          id: string
          instruction: string
          metrics_after: Json | null
          metrics_before: Json | null
          pr_number: number | null
          pr_url: string | null
          risk_level: string | null
          status: string
          target_file: string | null
          target_metric: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          cycle_id?: string | null
          expected_improvement?: string | null
          failure_reason?: string | null
          id?: string
          instruction: string
          metrics_after?: Json | null
          metrics_before?: Json | null
          pr_number?: number | null
          pr_url?: string | null
          risk_level?: string | null
          status?: string
          target_file?: string | null
          target_metric?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          cycle_id?: string | null
          expected_improvement?: string | null
          failure_reason?: string | null
          id?: string
          instruction?: string
          metrics_after?: Json | null
          metrics_before?: Json | null
          pr_number?: number | null
          pr_url?: string | null
          risk_level?: string | null
          status?: string
          target_file?: string | null
          target_metric?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "organism_experiments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "organism_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      organism_learnings: {
        Row: {
          category: string
          confidence: number | null
          content: string
          created_at: string
          experiment_id: string | null
          id: string
          times_validated: number | null
        }
        Insert: {
          category: string
          confidence?: number | null
          content: string
          created_at?: string
          experiment_id?: string | null
          id?: string
          times_validated?: number | null
        }
        Update: {
          category?: string
          confidence?: number | null
          content?: string
          created_at?: string
          experiment_id?: string | null
          id?: string
          times_validated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organism_learnings_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "organism_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      organism_skills: {
        Row: {
          avg_turns: number | null
          contraindications: string | null
          created_at: string
          description: string
          failure_count: number | null
          files_typically_modified: string[] | null
          id: string
          instruction_template: string
          last_used_at: string | null
          name: string
          success_count: number | null
          trigger_conditions: string
        }
        Insert: {
          avg_turns?: number | null
          contraindications?: string | null
          created_at?: string
          description: string
          failure_count?: number | null
          files_typically_modified?: string[] | null
          id?: string
          instruction_template: string
          last_used_at?: string | null
          name: string
          success_count?: number | null
          trigger_conditions: string
        }
        Update: {
          avg_turns?: number | null
          contraindications?: string | null
          created_at?: string
          description?: string
          failure_count?: number | null
          files_typically_modified?: string[] | null
          id?: string
          instruction_template?: string
          last_used_at?: string | null
          name?: string
          success_count?: number | null
          trigger_conditions?: string
        }
        Relationships: []
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
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string | null
          default_inspection_templates: Json | null
          default_markup_percentages: Json | null
          fiscal_year_start: number | null
          id: string
          is_blocked: boolean | null
          logo_url: string | null
          max_files_per_project: number | null
          max_projects: number | null
          max_storage_gb: number | null
          max_users: number | null
          name: string
          organization_id: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string | null
          default_inspection_templates?: Json | null
          default_markup_percentages?: Json | null
          fiscal_year_start?: number | null
          id?: string
          is_blocked?: boolean | null
          logo_url?: string | null
          max_files_per_project?: number | null
          max_projects?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name: string
          organization_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string | null
          default_inspection_templates?: Json | null
          default_markup_percentages?: Json | null
          fiscal_year_start?: number | null
          id?: string
          is_blocked?: boolean | null
          logo_url?: string | null
          max_files_per_project?: number | null
          max_projects?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
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
          audit_retention_years: number | null
          billing_email: string | null
          compliance_level: string | null
          created_at: string | null
          data_region: string | null
          default_project_role: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string | null
          settings: Json | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          audit_retention_years?: number | null
          billing_email?: string | null
          compliance_level?: string | null
          created_at?: string | null
          data_region?: string | null
          default_project_role?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          audit_retention_years?: number | null
          billing_email?: string | null
          compliance_level?: string | null
          created_at?: string | null
          data_region?: string | null
          default_project_role?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string | null
          settings?: Json | null
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      payment_applications: {
        Row: {
          application_number: number
          approved_at: string | null
          approved_by: string | null
          architect_signature: Json | null
          balance_to_finish: number
          check_number: string | null
          contract_sum_to_date: number | null
          contractor_id: string | null
          contractor_name: string | null
          contractor_signature: Json | null
          created_at: string | null
          current_payment_due: number
          gc_reviewed_at: string | null
          gc_reviewed_by: string | null
          id: string
          less_previous_certificates: number
          net_change_orders: number
          notes: string | null
          original_contract_sum: number
          owner_signature: Json | null
          paid_at: string | null
          payment_date: string | null
          period_to: string
          project_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_comments: string | null
          retainage_amount: number
          retainage_percent: number
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_completed_and_stored: number
          total_earned_less_retainage: number | null
          updated_at: string | null
        }
        Insert: {
          application_number: number
          approved_at?: string | null
          approved_by?: string | null
          architect_signature?: Json | null
          balance_to_finish?: number
          check_number?: string | null
          contract_sum_to_date?: number | null
          contractor_id?: string | null
          contractor_name?: string | null
          contractor_signature?: Json | null
          created_at?: string | null
          current_payment_due?: number
          gc_reviewed_at?: string | null
          gc_reviewed_by?: string | null
          id?: string
          less_previous_certificates?: number
          net_change_orders?: number
          notes?: string | null
          original_contract_sum?: number
          owner_signature?: Json | null
          paid_at?: string | null
          payment_date?: string | null
          period_to: string
          project_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_comments?: string | null
          retainage_amount?: number
          retainage_percent?: number
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_completed_and_stored?: number
          total_earned_less_retainage?: number | null
          updated_at?: string | null
        }
        Update: {
          application_number?: number
          approved_at?: string | null
          approved_by?: string | null
          architect_signature?: Json | null
          balance_to_finish?: number
          check_number?: string | null
          contract_sum_to_date?: number | null
          contractor_id?: string | null
          contractor_name?: string | null
          contractor_signature?: Json | null
          created_at?: string | null
          current_payment_due?: number
          gc_reviewed_at?: string | null
          gc_reviewed_by?: string | null
          id?: string
          less_previous_certificates?: number
          net_change_orders?: number
          notes?: string | null
          original_contract_sum?: number
          owner_signature?: Json | null
          paid_at?: string | null
          payment_date?: string | null
          period_to?: string
          project_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_comments?: string | null
          retainage_amount?: number
          retainage_percent?: number
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_completed_and_stored?: number
          total_earned_less_retainage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_line_items: {
        Row: {
          application_id: string
          balance_to_finish: number
          cost_code: string
          created_at: string | null
          description: string
          id: string
          item_number: string
          materials_stored: number
          percent_complete: number
          previous_completed: number
          retainage: number
          scheduled_value: number
          sort_order: number
          this_period: number
          total_completed_and_stored: number | null
        }
        Insert: {
          application_id: string
          balance_to_finish?: number
          cost_code: string
          created_at?: string | null
          description: string
          id?: string
          item_number: string
          materials_stored?: number
          percent_complete?: number
          previous_completed?: number
          retainage?: number
          scheduled_value?: number
          sort_order?: number
          this_period?: number
          total_completed_and_stored?: number | null
        }
        Update: {
          application_id?: string
          balance_to_finish?: number
          cost_code?: string
          created_at?: string | null
          description?: string
          id?: string
          item_number?: string
          materials_stored?: number
          percent_complete?: number
          previous_completed?: number
          retainage?: number
          scheduled_value?: number
          sort_order?: number
          this_period?: number
          total_completed_and_stored?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_line_items_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_milestones: {
        Row: {
          amount: number | null
          completed_at: string | null
          contract_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          status: string | null
          title: string
        }
        Insert: {
          amount?: number | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          status?: string | null
          title: string
        }
        Update: {
          amount?: number | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          application_id: string | null
          application_number: number | null
          created_at: string | null
          currency: string
          description: string | null
          error: string | null
          id: string
          payment_method: string | null
          platform_fee: number
          project_id: string
          recipient_name: string | null
          status: string
          stripe_account_id: string | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          application_id?: string | null
          application_number?: number | null
          created_at?: string | null
          currency?: string
          description?: string | null
          error?: string | null
          id?: string
          payment_method?: string | null
          platform_fee?: number
          project_id: string
          recipient_name?: string | null
          status?: string
          stripe_account_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          application_id?: string | null
          application_number?: number | null
          created_at?: string | null
          currency?: string
          description?: string | null
          error?: string | null
          id?: string
          payment_method?: string | null
          platform_fee?: number
          project_id?: string
          recipient_name?: string | null
          status?: string
          stripe_account_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_transactions_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_comparisons: {
        Row: {
          after_photo_id: string
          before_photo_id: string
          comparison_url: string | null
          created_at: string | null
          days_elapsed: number | null
          id: string
          progress_detected: boolean | null
          project_id: string
        }
        Insert: {
          after_photo_id: string
          before_photo_id: string
          comparison_url?: string | null
          created_at?: string | null
          days_elapsed?: number | null
          id?: string
          progress_detected?: boolean | null
          project_id: string
        }
        Update: {
          after_photo_id?: string
          before_photo_id?: string
          comparison_url?: string | null
          created_at?: string | null
          days_elapsed?: number | null
          id?: string
          progress_detected?: boolean | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_comparisons_after_photo_id_fkey"
            columns: ["after_photo_id"]
            isOneToOne: false
            referencedRelation: "photo_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comparisons_before_photo_id_fkey"
            columns: ["before_photo_id"]
            isOneToOne: false
            referencedRelation: "photo_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comparisons_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "photo_comparisons_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_pin_associations: {
        Row: {
          created_at: string | null
          id: string
          ifc_element_id: number
          is_primary: boolean | null
          photo_pin_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ifc_element_id: number
          is_primary?: boolean | null
          photo_pin_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ifc_element_id?: number
          is_primary?: boolean | null
          photo_pin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_pin_associations_photo_pin_id_fkey"
            columns: ["photo_pin_id"]
            isOneToOne: false
            referencedRelation: "photo_pins"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_pins: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          location_x: number
          location_y: number
          location_z: number
          metadata: Json | null
          photo_360_url: string | null
          photo_url: string
          project_id: string
          taken_at: string | null
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          location_x: number
          location_y: number
          location_z: number
          metadata?: Json | null
          photo_360_url?: string | null
          photo_url: string
          project_id: string
          taken_at?: string | null
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          location_x?: number
          location_y?: number
          location_z?: number
          metadata?: Json | null
          photo_360_url?: string | null
          photo_url?: string
          project_id?: string
          taken_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "photo_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean | null
          ai_copilot: boolean | null
          ai_per_page_rate: number | null
          api_access: boolean | null
          created_at: string | null
          custom_reports: boolean | null
          dedicated_support: boolean | null
          description: string | null
          id: string
          integrations: boolean | null
          max_projects: number
          max_storage_gb: number
          max_users: number
          name: string
          payment_processing_rate: number | null
          price_annual: number
          price_monthly: number
          sso: boolean | null
          stripe_price_annual: string | null
          stripe_price_monthly: string | null
        }
        Insert: {
          active?: boolean | null
          ai_copilot?: boolean | null
          ai_per_page_rate?: number | null
          api_access?: boolean | null
          created_at?: string | null
          custom_reports?: boolean | null
          dedicated_support?: boolean | null
          description?: string | null
          id: string
          integrations?: boolean | null
          max_projects?: number
          max_storage_gb?: number
          max_users?: number
          name: string
          payment_processing_rate?: number | null
          price_annual?: number
          price_monthly?: number
          sso?: boolean | null
          stripe_price_annual?: string | null
          stripe_price_monthly?: string | null
        }
        Update: {
          active?: boolean | null
          ai_copilot?: boolean | null
          ai_per_page_rate?: number | null
          api_access?: boolean | null
          created_at?: string | null
          custom_reports?: boolean | null
          dedicated_support?: boolean | null
          description?: string | null
          id?: string
          integrations?: boolean | null
          max_projects?: number
          max_storage_gb?: number
          max_users?: number
          name?: string
          payment_processing_rate?: number | null
          price_annual?: number
          price_monthly?: number
          sso?: boolean | null
          stripe_price_annual?: string | null
          stripe_price_monthly?: string | null
        }
        Relationships: []
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      prevailing_wage_rates: {
        Row: {
          base_hourly_rate: number | null
          county_name: string | null
          created_at: string | null
          effective_date: string | null
          expires_date: string | null
          fringe_benefits: number | null
          id: string
          project_type: string | null
          source: string | null
          state_code: string
          trade: string | null
        }
        Insert: {
          base_hourly_rate?: number | null
          county_name?: string | null
          created_at?: string | null
          effective_date?: string | null
          expires_date?: string | null
          fringe_benefits?: number | null
          id?: string
          project_type?: string | null
          source?: string | null
          state_code: string
          trade?: string | null
        }
        Update: {
          base_hourly_rate?: number | null
          county_name?: string | null
          created_at?: string | null
          effective_date?: string | null
          expires_date?: string | null
          fringe_benefits?: number | null
          id?: string
          project_type?: string | null
          source?: string | null
          state_code?: string
          trade?: string | null
        }
        Relationships: []
      }
      preventive_maintenance_schedules: {
        Row: {
          assigned_to: string | null
          based_on: string | null
          checklist_template: Json | null
          created_at: string | null
          day_of_month: number | null
          day_of_week: number[] | null
          description: string | null
          ends_on: string | null
          equipment_id: string
          estimated_duration_hours: number | null
          id: string
          is_active: boolean | null
          last_generated_at: string | null
          meter_trigger_unit: string | null
          meter_trigger_value: number | null
          next_due_date: string | null
          priority: string | null
          project_id: string
          recurrence_interval: number | null
          recurrence_type: string
          starts_on: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          based_on?: string | null
          checklist_template?: Json | null
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number[] | null
          description?: string | null
          ends_on?: string | null
          equipment_id: string
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          meter_trigger_unit?: string | null
          meter_trigger_value?: number | null
          next_due_date?: string | null
          priority?: string | null
          project_id: string
          recurrence_interval?: number | null
          recurrence_type?: string
          starts_on?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          based_on?: string | null
          checklist_template?: Json | null
          created_at?: string | null
          day_of_month?: number | null
          day_of_week?: number[] | null
          description?: string | null
          ends_on?: string | null
          equipment_id?: string
          estimated_duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          meter_trigger_unit?: string | null
          meter_trigger_value?: number | null
          next_due_date?: string | null
          priority?: string | null
          project_id?: string
          recurrence_interval?: number | null
          recurrence_type?: string
          starts_on?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preventive_maintenance_schedules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_maintenance_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "preventive_maintenance_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          notification_preferences: Json | null
          organization_id: string | null
          phone: string | null
          role: string | null
          trade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          notification_preferences?: Json | null
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          trade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          notification_preferences?: Json | null
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          trade?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_detection_results: {
        Row: {
          ai_analysis: Json | null
          completion_percent: number | null
          confidence_score: number | null
          created_at: string | null
          description: string | null
          element_id: number
          id: string
          photo_pin_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          completion_percent?: number | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          element_id: number
          id?: string
          photo_pin_id: string
        }
        Update: {
          ai_analysis?: Json | null
          completion_percent?: number | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          element_id?: number
          id?: string
          photo_pin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_detection_results_photo_pin_id_fkey"
            columns: ["photo_pin_id"]
            isOneToOne: false
            referencedRelation: "photo_pins"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          accepted_at: string | null
          company: string | null
          id: string
          invited_at: string | null
          permissions: Json | null
          project_id: string
          role: string
          trade: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          company?: string | null
          id?: string
          invited_at?: string | null
          permissions?: Json | null
          project_id: string
          role: string
          trade?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          company?: string | null
          id?: string
          invited_at?: string | null
          permissions?: Json | null
          project_id?: string
          role?: string
          trade?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          insights_summary: Json | null
          key_events: Json | null
          metrics: Json | null
          project_id: string
          risks: Json | null
          snapshot_date: string
          snapshot_type: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          insights_summary?: Json | null
          key_events?: Json | null
          metrics?: Json | null
          project_id: string
          risks?: Json | null
          snapshot_date: string
          snapshot_type?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          insights_summary?: Json | null
          key_events?: Json | null
          metrics?: Json | null
          project_id?: string
          risks?: Json | null
          snapshot_date?: string
          snapshot_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          contract_type: string | null
          contract_value: number | null
          cover_photo_url: string | null
          created_at: string | null
          delivery_method: string | null
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
          project_phase: string | null
          project_type: string | null
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
          contract_type?: string | null
          contract_value?: number | null
          cover_photo_url?: string | null
          created_at?: string | null
          delivery_method?: string | null
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
          project_phase?: string | null
          project_type?: string | null
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
          contract_type?: string | null
          contract_value?: number | null
          cover_photo_url?: string | null
          created_at?: string | null
          delivery_method?: string | null
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
          project_phase?: string | null
          project_type?: string | null
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
            foreignKeyName: "projects_architect_contact_id_fkey"
            columns: ["architect_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
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
        ]
      }
      punch_items: {
        Row: {
          area: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          updated_by: string | null
          verified_date: string | null
        }
        Insert: {
          area?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
          verified_date?: string | null
        }
        Update: {
          area?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
          verified_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "punch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_list_items: {
        Row: {
          assigned_company: string | null
          assigned_to: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          location: string | null
          photos: Json | null
          priority: string | null
          project_id: string
          status: string | null
          title: string
          trade: string | null
          updated_at: string | null
          verified_by: string | null
          verified_date: string | null
        }
        Insert: {
          assigned_company?: string | null
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location?: string | null
          photos?: Json | null
          priority?: string | null
          project_id: string
          status?: string | null
          title: string
          trade?: string | null
          updated_at?: string | null
          verified_by?: string | null
          verified_date?: string | null
        }
        Update: {
          assigned_company?: string | null
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location?: string | null
          photos?: Json | null
          priority?: string | null
          project_id?: string
          status?: string | null
          title?: string
          trade?: string | null
          updated_at?: string | null
          verified_by?: string | null
          verified_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_list_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "punch_list_items_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      report_runs: {
        Row: {
          error: string | null
          file_size: number | null
          format: string
          generated_at: string | null
          generated_by: string | null
          id: string
          project_id: string
          report_type: string
          schedule_id: string | null
          status: string
          storage_path: string | null
          template_id: string | null
        }
        Insert: {
          error?: string | null
          file_size?: number | null
          format?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          project_id: string
          report_type: string
          schedule_id?: string | null
          status?: string
          storage_path?: string | null
          template_id?: string | null
        }
        Update: {
          error?: string | null
          file_size?: number | null
          format?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          project_id?: string
          report_type?: string
          schedule_id?: string | null
          status?: string
          storage_path?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "report_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          id: string
          last_error: string | null
          last_run_at: string | null
          next_run_at: string | null
          project_id: string
          recipients: string[]
          run_count: number | null
          template_id: string
          time_utc: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          next_run_at?: string | null
          project_id: string
          recipients?: string[]
          run_count?: number | null
          template_id: string
          time_utc?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          next_run_at?: string | null
          project_id?: string
          recipients?: string[]
          run_count?: number | null
          template_id?: string
          time_utc?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "report_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          format: string | null
          id: string
          is_default: boolean | null
          name: string
          project_id: string
          report_type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          format?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          project_id: string
          report_type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          format?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          project_id?: string
          report_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "report_templates_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      rfi_drafts: {
        Row: {
          created_at: string | null
          id: string
          project_id: string | null
          question: string | null
          source_description: string | null
          source_drawing: string | null
          source_photo: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          question?: string | null
          source_description?: string | null
          source_drawing?: string | null
          source_photo?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          question?: string | null
          source_description?: string | null
          source_drawing?: string | null
          source_photo?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfi_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfi_drafts_project_id_fkey"
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
          is_official: boolean | null
          response_type: string | null
          rfi_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          response_type?: string | null
          rfi_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          response_type?: string | null
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
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          drawing_reference: string | null
          due_date: string | null
          id: string
          is_auto_generated: boolean | null
          number: number
          priority: string | null
          project_id: string
          response_due_date: string | null
          schedule_impact: string | null
          source_discrepancy_id: string | null
          spec_section: string | null
          status: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          void_reason: string | null
        }
        Insert: {
          assigned_to?: string | null
          ball_in_court?: string | null
          closed_date?: string | null
          cost_impact?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          drawing_reference?: string | null
          due_date?: string | null
          id?: string
          is_auto_generated?: boolean | null
          number?: number
          priority?: string | null
          project_id: string
          response_due_date?: string | null
          schedule_impact?: string | null
          source_discrepancy_id?: string | null
          spec_section?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
        }
        Update: {
          assigned_to?: string | null
          ball_in_court?: string | null
          closed_date?: string | null
          cost_impact?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          drawing_reference?: string | null
          due_date?: string | null
          id?: string
          is_auto_generated?: boolean | null
          number?: number
          priority?: string | null
          project_id?: string
          response_due_date?: string | null
          schedule_impact?: string | null
          source_discrepancy_id?: string | null
          spec_section?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          actual_end: string | null
          actual_start: string | null
          assigned_crew_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          dependency_type: string | null
          depends_on: string | null
          description: string | null
          end_date: string | null
          float_days: number | null
          id: string
          is_critical: boolean | null
          is_critical_path: boolean | null
          is_milestone: boolean | null
          lag_days: number | null
          name: string
          percent_complete: number | null
          predecessor_ids: string[] | null
          project_id: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_crew_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dependency_type?: string | null
          depends_on?: string | null
          description?: string | null
          end_date?: string | null
          float_days?: number | null
          id?: string
          is_critical?: boolean | null
          is_critical_path?: boolean | null
          is_milestone?: boolean | null
          lag_days?: number | null
          name: string
          percent_complete?: number | null
          predecessor_ids?: string[] | null
          project_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_crew_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dependency_type?: string | null
          depends_on?: string | null
          description?: string | null
          end_date?: string | null
          float_days?: number | null
          id?: string
          is_critical?: boolean | null
          is_critical_path?: boolean | null
          is_milestone?: boolean | null
          lag_days?: number | null
          name?: string
          percent_complete?: number | null
          predecessor_ids?: string[] | null
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      signature_audit_trail: {
        Row: {
          created_at: string | null
          document_hash: string | null
          event_description: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          request_id: string
          signer_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          document_hash?: string | null
          event_description?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          request_id: string
          signer_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          document_hash?: string | null
          event_description?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          request_id?: string
          signer_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_trail_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_trail_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signature_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_fields: {
        Row: {
          completed_at: string | null
          created_at: string | null
          default_value: string | null
          field_type: string
          font_size: number | null
          height: number
          id: string
          is_required: boolean | null
          page_number: number
          placeholder: string | null
          request_id: string
          response_value: string | null
          signer_id: string
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          default_value?: string | null
          field_type: string
          font_size?: number | null
          height?: number
          id?: string
          is_required?: boolean | null
          page_number?: number
          placeholder?: string | null
          request_id: string
          response_value?: string | null
          signer_id: string
          width?: number
          x_position: number
          y_position: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          default_value?: string | null
          field_type?: string
          font_size?: number | null
          height?: number
          id?: string
          is_required?: boolean | null
          page_number?: number
          placeholder?: string | null
          request_id?: string
          response_value?: string | null
          signer_id?: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "signature_fields_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_fields_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signature_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          auto_remind: boolean | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          document_id: string | null
          expires_at: string | null
          file_id: string | null
          id: string
          metadata: Json | null
          project_id: string
          reminder_frequency_days: number | null
          sent_at: string | null
          signed_file_url: string | null
          signing_order: string
          source_file_url: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          auto_remind?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          expires_at?: string | null
          file_id?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          reminder_frequency_days?: number | null
          sent_at?: string | null
          signed_file_url?: string | null
          signing_order?: string
          source_file_url: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          auto_remind?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          expires_at?: string | null
          file_id?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          reminder_frequency_days?: number | null
          sent_at?: string | null
          signed_file_url?: string | null
          signing_order?: string
          source_file_url?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "signature_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_signers: {
        Row: {
          access_token: string | null
          color_code: string | null
          created_at: string | null
          decline_reason: string | null
          declined_at: string | null
          id: string
          ip_address: string | null
          request_id: string
          signed_at: string | null
          signer_email: string
          signer_name: string
          signer_role: string | null
          signing_order_index: number | null
          status: string
          user_agent: string | null
        }
        Insert: {
          access_token?: string | null
          color_code?: string | null
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          ip_address?: string | null
          request_id: string
          signed_at?: string | null
          signer_email: string
          signer_name: string
          signer_role?: string | null
          signing_order_index?: number | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          access_token?: string | null
          color_code?: string | null
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          ip_address?: string | null
          request_id?: string
          signed_at?: string | null
          signer_email?: string
          signer_name?: string
          signer_role?: string | null
          signing_order_index?: number | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_signers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      specifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          division: string | null
          file_url: string | null
          id: string
          notes: string | null
          project_id: string
          responsible_party: string | null
          revision: string | null
          section_number: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          project_id: string
          responsible_party?: string | null
          revision?: string | null
          section_number: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          responsible_party?: string | null
          revision?: string | null
          section_number?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "specifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_configurations: {
        Row: {
          allowed_domains: string[]
          certificate: string
          created_at: string | null
          default_role: string | null
          enforced: boolean | null
          entity_id: string
          id: string
          jit_provisioning: boolean | null
          organization_id: string
          provider: string
          scim_enabled: boolean | null
          scim_endpoint: string | null
          scim_token_hash: string | null
          sso_url: string
          updated_at: string | null
        }
        Insert: {
          allowed_domains?: string[]
          certificate: string
          created_at?: string | null
          default_role?: string | null
          enforced?: boolean | null
          entity_id: string
          id?: string
          jit_provisioning?: boolean | null
          organization_id: string
          provider: string
          scim_enabled?: boolean | null
          scim_endpoint?: string | null
          scim_token_hash?: string | null
          sso_url: string
          updated_at?: string | null
        }
        Update: {
          allowed_domains?: string[]
          certificate?: string
          created_at?: string | null
          default_role?: string | null
          enforced?: boolean | null
          entity_id?: string
          id?: string
          jit_provisioning?: boolean | null
          organization_id?: string
          provider?: string
          scim_enabled?: boolean | null
          scim_endpoint?: string | null
          scim_token_hash?: string | null
          sso_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connected_accounts: {
        Row: {
          charges_enabled: boolean | null
          company_name: string
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          onboarding_complete: boolean | null
          organization_id: string | null
          payouts_enabled: boolean | null
          project_id: string | null
          stripe_account_id: string
          updated_at: string | null
        }
        Insert: {
          charges_enabled?: boolean | null
          company_name: string
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          onboarding_complete?: boolean | null
          organization_id?: string | null
          payouts_enabled?: boolean | null
          project_id?: string | null
          stripe_account_id: string
          updated_at?: string | null
        }
        Update: {
          charges_enabled?: boolean | null
          company_name?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          onboarding_complete?: boolean | null
          organization_id?: string | null
          payouts_enabled?: boolean | null
          project_id?: string | null
          stripe_account_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connected_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_connected_accounts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stripe_connected_accounts_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          chain_order: number | null
          comments: string | null
          id: string
          reviewed_at: string | null
          revision_number: number | null
          role: string | null
          stamp: string | null
          status: string | null
          submittal_id: string
        }
        Insert: {
          approver_id?: string | null
          chain_order?: number | null
          comments?: string | null
          id?: string
          reviewed_at?: string | null
          revision_number?: number | null
          role?: string | null
          stamp?: string | null
          status?: string | null
          submittal_id: string
        }
        Update: {
          approver_id?: string | null
          chain_order?: number | null
          comments?: string | null
          id?: string
          reviewed_at?: string | null
          revision_number?: number | null
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
          approval_chain: Json | null
          approved_date: string | null
          assigned_to: string | null
          closed_date: string | null
          created_at: string | null
          created_by: string | null
          current_reviewer: string | null
          days_in_review: number | null
          deleted_at: string | null
          deleted_by: string | null
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
          updated_by: string | null
        }
        Insert: {
          approval_chain?: Json | null
          approved_date?: string | null
          assigned_to?: string | null
          closed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_reviewer?: string | null
          days_in_review?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
        }
        Update: {
          approval_chain?: Json | null
          approved_date?: string | null
          assigned_to?: string | null
          closed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_reviewer?: string | null
          days_in_review?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      subscriptions: {
        Row: {
          billing_cycle: string
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          custom_rate_override: Json | null
          id: string
          max_projects_override: number | null
          max_storage_gb_override: number | null
          max_users_override: number | null
          organization_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          custom_rate_override?: Json | null
          id?: string
          max_projects_override?: number | null
          max_storage_gb_override?: number | null
          max_users_override?: number | null
          organization_id: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          custom_rate_override?: Json | null
          id?: string
          max_projects_override?: number | null
          max_storage_gb_override?: number | null
          max_users_override?: number | null
          organization_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          risk_level: string | null
          risk_score: number | null
          sort_order: number | null
          start_date: string | null
          status: string | null
          successor_ids: string[] | null
          title: string
          total_float: number | null
          trade: string | null
          updated_at: string | null
          updated_by: string | null
          weather_dependent: boolean | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          constraint_date?: string | null
          constraint_notes?: string | null
          constraint_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          risk_level?: string | null
          risk_score?: number | null
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          successor_ids?: string[] | null
          title: string
          total_float?: number | null
          trade?: string | null
          updated_at?: string | null
          updated_by?: string | null
          weather_dependent?: boolean | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          constraint_date?: string | null
          constraint_notes?: string | null
          constraint_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          risk_level?: string | null
          risk_score?: number | null
          sort_order?: number | null
          start_date?: string | null
          status?: string | null
          successor_ids?: string[] | null
          title?: string
          total_float?: number | null
          trade?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
          description: string | null
          document_ids: string[] | null
          due_date: string | null
          from_company: string | null
          from_contact: string | null
          id: string
          items: Json | null
          notes: string | null
          project_id: string
          purpose: string | null
          responded_at: string | null
          sent_at: string | null
          status: string | null
          subject: string
          to_company: string
          to_contact: string | null
          to_email: string | null
          transmittal_number: number
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          action_required?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_ids?: string[] | null
          due_date?: string | null
          from_company?: string | null
          from_contact?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          project_id: string
          purpose?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          to_company: string
          to_contact?: string | null
          to_email?: string | null
          transmittal_number?: number
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          action_required?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_ids?: string[] | null
          due_date?: string | null
          from_company?: string | null
          from_contact?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          project_id?: string
          purpose?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_company?: string
          to_contact?: string | null
          to_email?: string | null
          transmittal_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transmittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transmittals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          project_id: string | null
          quantity: number
          total_amount: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          project_id?: string | null
          quantity?: number
          total_amount?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          project_id?: string | null
          quantity?: number
          total_amount?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "usage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          permissions: Json | null
          project_id: string | null
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          permissions?: Json | null
          project_id?: string | null
          role?: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          permissions?: Json | null
          project_id?: string | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          company: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          insurance_expiry: string | null
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          project_id: string
          rating: number | null
          status: string | null
          trade: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          project_id: string
          rating?: number | null
          status?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          rating?: number | null
          status?: string | null
          trade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendors_project_id_fkey"
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
          coverage_details: string | null
          created_at: string | null
          document_url: string | null
          duration_years: number | null
          expiration_date: string | null
          id: string
          item: string
          limitations: string | null
          manufacturer: string | null
          project_id: string
          reminder_30_sent: boolean | null
          reminder_7_sent: boolean | null
          start_date: string | null
          status: string | null
          subcontractor: string | null
          trade: string | null
          updated_at: string | null
          warranty_type: string | null
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          coverage_description?: string | null
          coverage_details?: string | null
          created_at?: string | null
          document_url?: string | null
          duration_years?: number | null
          expiration_date?: string | null
          id?: string
          item: string
          limitations?: string | null
          manufacturer?: string | null
          project_id: string
          reminder_30_sent?: boolean | null
          reminder_7_sent?: boolean | null
          start_date?: string | null
          status?: string | null
          subcontractor?: string | null
          trade?: string | null
          updated_at?: string | null
          warranty_type?: string | null
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          coverage_description?: string | null
          coverage_details?: string | null
          created_at?: string | null
          document_url?: string | null
          duration_years?: number | null
          expiration_date?: string | null
          id?: string
          item?: string
          limitations?: string | null
          manufacturer?: string | null
          project_id?: string
          reminder_30_sent?: boolean | null
          reminder_7_sent?: boolean | null
          start_date?: string | null
          status?: string | null
          subcontractor?: string | null
          trade?: string | null
          updated_at?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "waste_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          cached_at: string | null
          forecast_data: Json | null
          id: string
          project_id: string | null
        }
        Insert: {
          cached_at?: string | null
          forecast_data?: Json | null
          id?: string
          project_id?: string | null
        }
        Update: {
          cached_at?: string | null
          forecast_data?: Json | null
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "weather_cache_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
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
      webhook_endpoints: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          events: string[]
          id: string
          organization_id: string | null
          secret: string
          updated_at: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          events?: string[]
          id?: string
          organization_id?: string | null
          secret: string
          updated_at?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          events?: string[]
          id?: string
          organization_id?: string | null
          secret?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
      wiki_pages: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          parent_id: string | null
          project_id: string
          search_vector: unknown
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          parent_id?: string | null
          project_id: string
          search_vector?: unknown
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          parent_id?: string | null
          project_id?: string
          search_vector?: unknown
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wiki_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wiki_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "wiki_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "wip_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_rules: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          project_id: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          project_id: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          project_id?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "workflow_rules_project_id_fkey"
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "workforce_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_upload_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          file_count: number | null
          id: string
          processed_count: number | null
          project_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          file_count?: number | null
          id?: string
          processed_count?: number | null
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          file_count?: number | null
          id?: string
          processed_count?: number | null
          project_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zip_upload_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "zip_upload_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      project_metrics: {
        Row: {
          avg_rfi_response_days: number | null
          budget_committed: number | null
          budget_spent: number | null
          budget_total: number | null
          contract_value: number | null
          crews_active: number | null
          milestones_completed: number | null
          milestones_total: number | null
          overall_progress: number | null
          project_id: string | null
          project_name: string | null
          punch_open: number | null
          punch_total: number | null
          rfis_open: number | null
          rfis_overdue: number | null
          rfis_total: number | null
          safety_incidents_this_month: number | null
          schedule_variance_days: number | null
          submittals_approved: number | null
          submittals_pending: number | null
          submittals_total: number | null
          workers_onsite: number | null
        }
        Relationships: []
      }
      usage_summary: {
        Row: {
          event_type: string | null
          organization_id: string | null
          period: string | null
          total_amount: number | null
          total_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_members_kernel: {
        Row: {
          effective_role: string | null
          id: string | null
          invited_at: string | null
          project_id: string | null
          raw_role: string | null
          user_id: string | null
        }
        Insert: {
          effective_role?: never
          id?: string | null
          invited_at?: string | null
          project_id?: string | null
          raw_role?: string | null
          user_id?: string | null
        }
        Update: {
          effective_role?: never
          id?: string | null
          invited_at?: string | null
          project_id?: string | null
          raw_role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_next_run: {
        Args: {
          p_day_of_month: number
          p_day_of_week: number
          p_frequency: string
          p_time_utc: string
        }
        Returns: string
      }
      can_user_approve: { Args: { p_project_id: string }; Returns: boolean }
      can_user_create: { Args: { p_project_id: string }; Returns: boolean }
      check_ai_rate_limit: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: boolean
      }
      check_expiring_certifications: { Args: never; Returns: undefined }
      check_plan_limit: {
        Args: { p_limit_type: string; p_organization_id: string }
        Returns: boolean
      }
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
      get_my_org_ids: { Args: never; Returns: string[] }
      get_portfolio_metrics: {
        Args: { org_id: string }
        Returns: {
          active_projects: number
          avg_completion_percentage: number
          projects_at_risk: number
          projects_on_schedule: number
          total_contract_value: number
          total_projects: number
        }[]
      }
      get_user_project_role: { Args: { p_project_id: string }; Returns: string }
      has_project_permission: {
        Args: { p_min_role: string; p_project_id: string }
        Returns: boolean
      }
      increment_webhook_failures: {
        Args: { webhook_id: string }
        Returns: undefined
      }
      is_org_admin_or_empty: {
        Args: { org_id: string; uid: string }
        Returns: boolean
      }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_project_role: {
        Args: { allowed_roles: string[]; p_project_id: string }
        Returns: boolean
      }
      is_project_role_compat: {
        Args: { allowed_roles: string[]; p_project_id: string }
        Returns: boolean
      }
      kernel_role_label: { Args: { raw_role: string }; Returns: string }
      refresh_project_metrics: { Args: never; Returns: undefined }
      reorder_tasks: {
        Args: { new_orders: number[]; task_ids: string[] }
        Returns: undefined
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
      update_warranty_status: { Args: never; Returns: undefined }
      write_audit_entry: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_title?: string
          p_entity_type: string
          p_new_value?: Json
          p_old_value?: Json
          p_project_id: string
        }
        Returns: string
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

// ── Custom exports (preserved across schema regeneration) ───────────────────

type PublicTables = Database['public']['Tables']
export type TableRow<T extends keyof PublicTables> = PublicTables[T]['Row']
export type InsertTables<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type UpdateTables<T extends keyof PublicTables> = PublicTables[T]['Update']

export type Project = TableRow<'projects'>
export type RFI = TableRow<'rfis'>
export type RfiStatus = 'draft' | 'open' | 'under_review' | 'answered' | 'closed' | 'void'
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
export type RFIResponse = TableRow<'rfi_responses'>
export type Organization = TableRow<'organizations'>
export type Profile = TableRow<'profiles'>

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

// UserRole lives in ./enums — import from there directly. Re-exporting an
// enum through this type-heavy barrel breaks under verbatimModuleSyntax
// (Vite dev server fails to resolve the runtime value).
