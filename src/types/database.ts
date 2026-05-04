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
      account_deletion_events: {
        Row: {
          deleted_at: string
          id: string
          reason: string | null
          user_id_hash: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          reason?: string | null
          user_id_hash: string
        }
        Update: {
          deleted_at?: string
          id?: string
          reason?: string | null
          user_id_hash?: string
        }
        Relationships: []
      }
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      agent_tasks: {
        Row: {
          agent_domain: string
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          project_id: string
          started_at: string | null
          status: string
          tool_input: Json | null
          tool_name: string | null
          tool_output: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_domain: string
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id: string
          started_at?: string | null
          status?: string
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_domain?: string
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id?: string
          started_at?: string | null
          status?: string
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "agent_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "agent_tasks_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      ai_conversations: {
        Row: {
          conversation_topic: string | null
          created_at: string | null
          id: string
          message_count: number | null
          project_id: string | null
          started_at: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_topic?: string | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          project_id?: string | null
          started_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_topic?: string | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          project_id?: string | null
          started_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_cost_tracking: {
        Row: {
          acknowledgement_id: string | null
          created_at: string | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string | null
          operation: string | null
          output_tokens: number | null
          project_id: string | null
          service: string
          total_cost_cents: number | null
          user_id: string | null
        }
        Insert: {
          acknowledgement_id?: string | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          operation?: string | null
          output_tokens?: number | null
          project_id?: string | null
          service: string
          total_cost_cents?: number | null
          user_id?: string | null
        }
        Update: {
          acknowledgement_id?: string | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          operation?: string | null
          output_tokens?: number | null
          project_id?: string | null
          service?: string
          total_cost_cents?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_cost_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_cost_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_cost_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extraction_results: {
        Row: {
          applied_resource_id: string | null
          applied_resource_type: string | null
          bbox: Json | null
          confidence: number
          created_at: string
          extracted_payload: Json
          field_confidence: Json | null
          id: string
          pdf_page: number | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_decision: string | null
          source_kind: string
          source_storage_path: string
          status: string
        }
        Insert: {
          applied_resource_id?: string | null
          applied_resource_type?: string | null
          bbox?: Json | null
          confidence: number
          created_at?: string
          extracted_payload: Json
          field_confidence?: Json | null
          id?: string
          pdf_page?: number | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_decision?: string | null
          source_kind: string
          source_storage_path: string
          status: string
        }
        Update: {
          applied_resource_id?: string | null
          applied_resource_type?: string | null
          bbox?: Json | null
          confidence?: number
          created_at?: string
          extracted_payload?: Json
          field_confidence?: Json | null
          id?: string
          pdf_page?: number | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_decision?: string | null
          source_kind?: string
          source_storage_path?: string
          status?: string
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      ai_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      ai_training_corrections: {
        Row: {
          annotation_coordinates: Json | null
          corrected_value: Json | null
          correction_type: string | null
          created_at: string | null
          drawing_id: string | null
          export_batch_id: string | null
          exported_at: string | null
          id: string
          is_exported: boolean | null
          original_value: Json | null
          page_image_url: string | null
          project_id: string | null
          source_record_id: string | null
          source_table: string | null
          user_id: string | null
        }
        Insert: {
          annotation_coordinates?: Json | null
          corrected_value?: Json | null
          correction_type?: string | null
          created_at?: string | null
          drawing_id?: string | null
          export_batch_id?: string | null
          exported_at?: string | null
          id?: string
          is_exported?: boolean | null
          original_value?: Json | null
          page_image_url?: string | null
          project_id?: string | null
          source_record_id?: string | null
          source_table?: string | null
          user_id?: string | null
        }
        Update: {
          annotation_coordinates?: Json | null
          corrected_value?: Json | null
          correction_type?: string | null
          created_at?: string | null
          drawing_id?: string | null
          export_batch_id?: string | null
          exported_at?: string | null
          id?: string
          is_exported?: boolean | null
          original_value?: Json | null
          page_image_url?: string | null
          project_id?: string | null
          source_record_id?: string | null
          source_table?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_corrections_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_corrections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_training_corrections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_training_corrections_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      approval_instances: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          entity_id: string
          entity_type: string
          id: string
          project_id: string
          status: string | null
          template_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          entity_id: string
          entity_type: string
          id?: string
          project_id: string
          status?: string | null
          template_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          entity_id?: string
          entity_type?: string
          id?: string
          project_id?: string
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "approval_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "approval_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "approval_workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_step_actions: {
        Row: {
          acted_at: string | null
          action: string | null
          assigned_to: string | null
          comments: string | null
          created_at: string | null
          due_date: string | null
          id: string
          instance_id: string
          step_order: number
        }
        Insert: {
          acted_at?: string | null
          action?: string | null
          assigned_to?: string | null
          comments?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          instance_id: string
          step_order: number
        }
        Update: {
          acted_at?: string | null
          action?: string | null
          assigned_to?: string | null
          comments?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          instance_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_step_actions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "approval_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflow_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_type: string
          id: string
          is_default: boolean | null
          name: string
          project_id: string
          steps: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_type: string
          id?: string
          is_default?: boolean | null
          name: string
          project_id: string
          steps?: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_type?: string
          id?: string
          is_default?: boolean | null
          name?: string
          project_id?: string
          steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflow_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "approval_workflow_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "approval_workflow_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      audit_chain_checkpoints: {
        Row: {
          id: number
          last_run_at: string
          last_verified: string | null
          single_row: boolean
        }
        Insert: {
          id?: number
          last_run_at?: string
          last_verified?: string | null
          single_row?: boolean
        }
        Update: {
          id?: number
          last_run_at?: string
          last_verified?: string | null
          single_row?: boolean
        }
        Relationships: []
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
          entry_hash: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          previous_hash: string | null
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
          entry_hash?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          previous_hash?: string | null
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
          entry_hash?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          previous_hash?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      bid_submissions: {
        Row: {
          amount: number
          awarded_at: string | null
          bid_package_id: string
          created_at: string
          id: string
          notes: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount?: number
          awarded_at?: string | null
          bid_package_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          awarded_at?: string | null
          bid_package_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_submissions_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          created_at: string | null
          id: string
          max_files_per_project: number | null
          max_pages_per_file: number | null
          max_projects: number | null
          organization_id: string | null
          stripe_customer_id: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_files_per_project?: number | null
          max_pages_per_file?: number | null
          max_projects?: number | null
          organization_id?: string | null
          stripe_customer_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_files_per_project?: number | null
          max_pages_per_file?: number | null
          max_projects?: number | null
          organization_id?: string | null
          stripe_customer_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      bonds: {
        Row: {
          bond_amount: number
          bond_number: string | null
          bond_type: string
          company: string
          contractor_id: string | null
          created_at: string
          document_url: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          notes: string | null
          project_id: string
          released_at: string | null
          released_reason: string | null
          status: string
          surety_company: string | null
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bond_amount: number
          bond_number?: string | null
          bond_type: string
          company: string
          contractor_id?: string | null
          created_at?: string
          document_url?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          released_at?: string | null
          released_reason?: string | null
          status?: string
          surety_company?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bond_amount?: number
          bond_number?: string | null
          bond_type?: string
          company?: string
          contractor_id?: string | null
          created_at?: string
          document_url?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          released_at?: string | null
          released_reason?: string | null
          status?: string
          surety_company?: string | null
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bonds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bonds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bonds_project_id_fkey"
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
          external_ids: Json | null
          forecast_amount: number | null
          id: string
          legacy_payload: Json | null
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
          external_ids?: Json | null
          forecast_amount?: number | null
          id?: string
          legacy_payload?: Json | null
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
          external_ids?: Json | null
          forecast_amount?: number | null
          id?: string
          legacy_payload?: Json | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      budget_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          division_data: Json
          id: string
          name: string
          project_id: string
          snapshot_date: string
          total_budget: number
          total_committed: number
          total_spent: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          division_data?: Json
          id?: string
          name: string
          project_id: string
          snapshot_date?: string
          total_budget?: number
          total_committed?: number
          total_spent?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          division_data?: Json
          id?: string
          name?: string
          project_id?: string
          snapshot_date?: string
          total_budget?: number
          total_committed?: number
          total_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      carbon_factors: {
        Row: {
          created_at: string | null
          embodied_carbon_kg_per_unit: number
          id: string
          material_category: string
          material_name: string
          notes: string | null
          source: string | null
          unit: string
        }
        Insert: {
          created_at?: string | null
          embodied_carbon_kg_per_unit: number
          id?: string
          material_category: string
          material_name: string
          notes?: string | null
          source?: string | null
          unit: string
        }
        Update: {
          created_at?: string | null
          embodied_carbon_kg_per_unit?: number
          id?: string
          material_category?: string
          material_name?: string
          notes?: string | null
          source?: string | null
          unit?: string
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      change_order_line_items: {
        Row: {
          amount: number
          budget_item_id: string | null
          change_order_id: string
          cost_code: string | null
          created_at: string
          description: string
          id: string
          project_id: string
          quantity: number | null
          sort_order: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          amount?: number
          budget_item_id?: string | null
          change_order_id: string
          cost_code?: string | null
          created_at?: string
          description: string
          id?: string
          project_id: string
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_item_id?: string | null
          change_order_id?: string
          cost_code?: string | null
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          quantity?: number | null
          sort_order?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_order_line_items_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_line_items_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_order_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_order_line_items_project_id_fkey"
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
          cause: Database["public"]["Enums"]["change_order_cause"] | null
          cause_notes: string | null
          cause_originator:
            | Database["public"]["Enums"]["change_order_originator_role"]
            | null
          cause_stage:
            | Database["public"]["Enums"]["change_order_project_stage"]
            | null
          cost_code: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string
          estimated_cost: number | null
          external_ids: Json | null
          id: string
          legacy_payload: Json | null
          metadata: Json
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
          source_rfi_id: string | null
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
          cause?: Database["public"]["Enums"]["change_order_cause"] | null
          cause_notes?: string | null
          cause_originator?:
            | Database["public"]["Enums"]["change_order_originator_role"]
            | null
          cause_stage?:
            | Database["public"]["Enums"]["change_order_project_stage"]
            | null
          cost_code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          estimated_cost?: number | null
          external_ids?: Json | null
          id?: string
          legacy_payload?: Json | null
          metadata?: Json
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
          source_rfi_id?: string | null
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
          cause?: Database["public"]["Enums"]["change_order_cause"] | null
          cause_notes?: string | null
          cause_originator?:
            | Database["public"]["Enums"]["change_order_originator_role"]
            | null
          cause_stage?:
            | Database["public"]["Enums"]["change_order_project_stage"]
            | null
          cost_code?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          estimated_cost?: number | null
          external_ids?: Json | null
          id?: string
          legacy_payload?: Json | null
          metadata?: Json
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
          source_rfi_id?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          {
            foreignKeyName: "change_orders_source_rfi_id_fkey"
            columns: ["source_rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
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
          approved_date: string | null
          assigned_to: string | null
          category: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          description: string
          document_size_bytes: number | null
          document_url: string | null
          due_date: string | null
          escalated_at: string | null
          escalation_status: string | null
          expiration_date: string | null
          file_url: string | null
          id: string
          item_type: string | null
          notes: string | null
          priority: string | null
          project_id: string
          project_type: string | null
          rejection_comments: string | null
          reminder_sent_at: string | null
          required_by: string | null
          responsible_party: string | null
          signoff_received_at: string | null
          signoff_received_by: string | null
          signoff_required: boolean
          status: string | null
          submitted_date: string | null
          title: string | null
          trade: string
          updated_at: string | null
          vendor_contact_id: string | null
        }
        Insert: {
          approved_date?: string | null
          assigned_to?: string | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          document_size_bytes?: number | null
          document_url?: string | null
          due_date?: string | null
          escalated_at?: string | null
          escalation_status?: string | null
          expiration_date?: string | null
          file_url?: string | null
          id?: string
          item_type?: string | null
          notes?: string | null
          priority?: string | null
          project_id: string
          project_type?: string | null
          rejection_comments?: string | null
          reminder_sent_at?: string | null
          required_by?: string | null
          responsible_party?: string | null
          signoff_received_at?: string | null
          signoff_received_by?: string | null
          signoff_required?: boolean
          status?: string | null
          submitted_date?: string | null
          title?: string | null
          trade: string
          updated_at?: string | null
          vendor_contact_id?: string | null
        }
        Update: {
          approved_date?: string | null
          assigned_to?: string | null
          category?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          document_size_bytes?: number | null
          document_url?: string | null
          due_date?: string | null
          escalated_at?: string | null
          escalation_status?: string | null
          expiration_date?: string | null
          file_url?: string | null
          id?: string
          item_type?: string | null
          notes?: string | null
          priority?: string | null
          project_id?: string
          project_type?: string | null
          rejection_comments?: string | null
          reminder_sent_at?: string | null
          required_by?: string | null
          responsible_party?: string | null
          signoff_received_at?: string | null
          signoff_received_by?: string | null
          signoff_required?: boolean
          status?: string | null
          submitted_date?: string | null
          title?: string | null
          trade?: string
          updated_at?: string | null
          vendor_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closeout_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          {
            foreignKeyName: "closeout_items_vendor_contact_id_fkey"
            columns: ["vendor_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      coi_check_in_blocks: {
        Row: {
          block_until: string | null
          company_name: string
          created_at: string | null
          created_via: string | null
          expired_on: string
          id: string
          insurance_certificate_id: string | null
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          project_id: string
          reason: string
          source_drafted_action_id: string | null
          subcontractor_id: string | null
          updated_at: string | null
        }
        Insert: {
          block_until?: string | null
          company_name: string
          created_at?: string | null
          created_via?: string | null
          expired_on: string
          id?: string
          insurance_certificate_id?: string | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          project_id: string
          reason?: string
          source_drafted_action_id?: string | null
          subcontractor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          block_until?: string | null
          company_name?: string
          created_at?: string | null
          created_via?: string | null
          expired_on?: string
          id?: string
          insurance_certificate_id?: string | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          project_id?: string
          reason?: string
          source_drafted_action_id?: string | null
          subcontractor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coi_check_in_blocks_insurance_certificate_id_fkey"
            columns: ["insurance_certificate_id"]
            isOneToOne: false
            referencedRelation: "insurance_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coi_check_in_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "coi_check_in_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "coi_check_in_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      coi_expiration_alerts: {
        Row: {
          channel: string
          created_at: string | null
          created_via: string | null
          delivery_status: string | null
          failure_reason: string | null
          id: string
          insurance_certificate_id: string
          project_id: string | null
          recipient: string | null
          threshold_days: number
        }
        Insert: {
          channel: string
          created_at?: string | null
          created_via?: string | null
          delivery_status?: string | null
          failure_reason?: string | null
          id?: string
          insurance_certificate_id: string
          project_id?: string | null
          recipient?: string | null
          threshold_days: number
        }
        Update: {
          channel?: string
          created_at?: string | null
          created_via?: string | null
          delivery_status?: string | null
          failure_reason?: string | null
          id?: string
          insurance_certificate_id?: string
          project_id?: string | null
          recipient?: string | null
          threshold_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "coi_expiration_alerts_insurance_certificate_id_fkey"
            columns: ["insurance_certificate_id"]
            isOneToOne: false
            referencedRelation: "insurance_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coi_expiration_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "coi_expiration_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "coi_expiration_alerts_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      collab_doc_state: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field: string
          id: string
          last_synced_at: string | null
          liveblocks_room_id: string
          organization_id: string
          project_id: string | null
          snapshot_version: number
          text_snapshot: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          field: string
          id?: string
          last_synced_at?: string | null
          liveblocks_room_id: string
          organization_id: string
          project_id?: string | null
          snapshot_version?: number
          text_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          last_synced_at?: string | null
          liveblocks_room_id?: string
          organization_id?: string
          project_id?: string | null
          snapshot_version?: number
          text_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_doc_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_doc_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "collab_doc_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "collab_doc_state_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      communication_logs: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          id: string
          logged_by: string | null
          metadata: Json
          occurred_at: string
          project_id: string
          subject: string | null
          summary: string
          updated_at: string
        }
        Insert: {
          channel: string
          contact_id: string
          created_at?: string
          id?: string
          logged_by?: string | null
          metadata?: Json
          occurred_at?: string
          project_id: string
          subject?: string | null
          summary?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          id?: string
          logged_by?: string | null
          metadata?: Json
          occurred_at?: string
          project_id?: string
          subject?: string | null
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "communication_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "communication_logs_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          bonding_required: boolean | null
          contract_amount: number | null
          contract_number: string | null
          contract_type: string | null
          counterparty: string
          counterparty_contact: string | null
          counterparty_contact_id: string | null
          counterparty_email: string | null
          counterparty_name: string | null
          created_at: string | null
          created_by: string | null
          documents: Json | null
          end_date: string | null
          executed_date: string | null
          file_url: string | null
          id: string
          insurance_required: boolean | null
          notes: string | null
          original_value: number
          payment_terms: string | null
          project_id: string
          retainage_percent: number | null
          retention_percentage: number | null
          revised_value: number | null
          scope_of_work: string | null
          start_date: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          billing_method?: string | null
          bonding_required?: boolean | null
          contract_amount?: number | null
          contract_number?: string | null
          contract_type?: string | null
          counterparty: string
          counterparty_contact?: string | null
          counterparty_contact_id?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          end_date?: string | null
          executed_date?: string | null
          file_url?: string | null
          id?: string
          insurance_required?: boolean | null
          notes?: string | null
          original_value: number
          payment_terms?: string | null
          project_id: string
          retainage_percent?: number | null
          retention_percentage?: number | null
          revised_value?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          billing_method?: string | null
          bonding_required?: boolean | null
          contract_amount?: number | null
          contract_number?: string | null
          contract_type?: string | null
          counterparty?: string
          counterparty_contact?: string | null
          counterparty_contact_id?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string | null
          created_by?: string | null
          documents?: Json | null
          end_date?: string | null
          executed_date?: string | null
          file_url?: string | null
          id?: string
          insurance_required?: boolean | null
          notes?: string | null
          original_value?: number
          payment_terms?: string | null
          project_id?: string
          retainage_percent?: number | null
          retention_percentage?: number | null
          revised_value?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_counterparty_contact_id_fkey"
            columns: ["counterparty_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          csi_division: string | null
          description: string
          division: string | null
          forecast_amount: number | null
          id: string
          is_active: boolean
          labor_class: string | null
          name: string | null
          organization_id: string | null
          parent_code: string | null
          prevailing_wage_required: boolean
          project_id: string
          rate: number | null
          source_external_id: string | null
          source_system: string | null
          tax_treatment: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          code: string
          committed_amount?: number | null
          created_at?: string | null
          csi_division?: string | null
          description?: string
          division?: string | null
          forecast_amount?: number | null
          id?: string
          is_active?: boolean
          labor_class?: string | null
          name?: string | null
          organization_id?: string | null
          parent_code?: string | null
          prevailing_wage_required?: boolean
          project_id: string
          rate?: number | null
          source_external_id?: string | null
          source_system?: string | null
          tax_treatment?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          code?: string
          committed_amount?: number | null
          created_at?: string | null
          csi_division?: string | null
          description?: string
          division?: string | null
          forecast_amount?: number | null
          id?: string
          is_active?: boolean
          labor_class?: string | null
          name?: string | null
          organization_id?: string | null
          parent_code?: string | null
          prevailing_wage_required?: boolean
          project_id?: string
          rate?: number | null
          source_external_id?: string | null
          source_system?: string | null
          tax_treatment?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          source_id: string | null
          source_type: string | null
          transaction_date: string | null
          transaction_type: string | null
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
          source_id?: string | null
          source_type?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
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
          source_id?: string | null
          source_type?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      crew_attendance: {
        Row: {
          actual_check_in_at: string | null
          attendance_date: string
          created_at: string
          crew_id: string
          id: string
          meeting_action_item_id: string | null
          metadata: Json
          no_show_flagged_at: string | null
          notes: string | null
          planned_arrival_time: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_check_in_at?: string | null
          attendance_date: string
          created_at?: string
          crew_id: string
          id?: string
          meeting_action_item_id?: string | null
          metadata?: Json
          no_show_flagged_at?: string | null
          notes?: string | null
          planned_arrival_time?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_check_in_at?: string | null
          attendance_date?: string
          created_at?: string
          crew_id?: string
          id?: string
          meeting_action_item_id?: string | null
          metadata?: Json
          no_show_flagged_at?: string | null
          notes?: string | null
          planned_arrival_time?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_attendance_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_attendance_meeting_action_item_id_fkey"
            columns: ["meeting_action_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_checkins: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          checked_out_at: string | null
          created_at: string
          crew_id: string | null
          dispute_meta: Json | null
          dispute_status: string
          disputed_at: string | null
          disputed_reason: string | null
          geo_accuracy_m: number | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          location_id: string
          notes: string | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          checked_out_at?: string | null
          created_at?: string
          crew_id?: string | null
          dispute_meta?: Json | null
          dispute_status?: string
          disputed_at?: string | null
          disputed_reason?: string | null
          geo_accuracy_m?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          location_id: string
          notes?: string | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          checked_out_at?: string | null
          created_at?: string
          crew_id?: string | null
          dispute_meta?: Json | null
          dispute_status?: string
          disputed_at?: string | null
          disputed_reason?: string | null
          geo_accuracy_m?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          location_id?: string
          notes?: string | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_checkins_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_checkins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_checkins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_checkins_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      crew_schedules: {
        Row: {
          created_at: string
          crew_name: string
          end_date: string
          headcount: number
          id: string
          phase_id: string | null
          project_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crew_name: string
          end_date: string
          headcount?: number
          id?: string
          phase_id?: string | null
          project_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crew_name?: string
          end_date?: string
          headcount?: number
          id?: string
          phase_id?: string | null
          project_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_schedules_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "schedule_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crew_schedules_project_id_fkey"
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
          planned_arrival_time: string | null
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
          planned_arrival_time?: string | null
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
          planned_arrival_time?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      daily_log_revisions: {
        Row: {
          daily_log_id: string
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          prev_revision_hash: string | null
          project_id: string
          reason: string
          revised_at: string
          revised_by: string | null
          revision_hash: string | null
          sequence: number
        }
        Insert: {
          daily_log_id: string
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          prev_revision_hash?: string | null
          project_id: string
          reason: string
          revised_at?: string
          revised_by?: string | null
          revision_hash?: string | null
          sequence?: number
        }
        Update: {
          daily_log_id?: string
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          prev_revision_hash?: string | null
          project_id?: string
          reason?: string
          revised_at?: string
          revised_by?: string | null
          revision_hash?: string | null
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_log_revisions_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_log_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_log_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_log_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          external_ids: Json | null
          id: string
          incidents: number | null
          legacy_payload: Json | null
          log_date: string
          manager_signature_url: string | null
          precipitation: string | null
          project_id: string
          rejection_comments: string | null
          signed_at: string | null
          signed_by: string | null
          signed_chain_hash: string | null
          signed_payload_hash: string | null
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
          external_ids?: Json | null
          id?: string
          incidents?: number | null
          legacy_payload?: Json | null
          log_date: string
          manager_signature_url?: string | null
          precipitation?: string | null
          project_id: string
          rejection_comments?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_chain_hash?: string | null
          signed_payload_hash?: string | null
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
          external_ids?: Json | null
          id?: string
          incidents?: number | null
          legacy_payload?: Json | null
          log_date?: string
          manager_signature_url?: string | null
          precipitation?: string | null
          project_id?: string
          rejection_comments?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_chain_hash?: string | null
          signed_payload_hash?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      daily_summaries: {
        Row: {
          concerns: Json | null
          created_at: string | null
          highlights: Json | null
          id: string
          project_id: string | null
          summary: string | null
          summary_date: string
          updated_at: string | null
        }
        Insert: {
          concerns?: Json | null
          created_at?: string | null
          highlights?: Json | null
          id?: string
          project_id?: string | null
          summary?: string | null
          summary_date?: string
          updated_at?: string | null
        }
        Update: {
          concerns?: Json | null
          created_at?: string | null
          highlights?: Json | null
          id?: string
          project_id?: string | null
          summary?: string | null
          summary_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          actual_date: string | null
          carrier: string | null
          created_at: string | null
          damage_reports: Json | null
          delivery_date: string | null
          delivery_number: number
          expected_date: string | null
          id: string
          inspection_notes: string | null
          items: Json | null
          packing_slip_url: string | null
          photo_urls: string[] | null
          photos: Json | null
          project_id: string
          purchase_order_id: string | null
          received_by: string | null
          receiving_notes: string | null
          status: string | null
          supplier: string | null
          tracking_number: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          actual_date?: string | null
          carrier?: string | null
          created_at?: string | null
          damage_reports?: Json | null
          delivery_date?: string | null
          delivery_number?: number
          expected_date?: string | null
          id?: string
          inspection_notes?: string | null
          items?: Json | null
          packing_slip_url?: string | null
          photo_urls?: string[] | null
          photos?: Json | null
          project_id: string
          purchase_order_id?: string | null
          received_by?: string | null
          receiving_notes?: string | null
          status?: string | null
          supplier?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          actual_date?: string | null
          carrier?: string | null
          created_at?: string | null
          damage_reports?: Json | null
          delivery_date?: string | null
          delivery_number?: number
          expected_date?: string | null
          id?: string
          inspection_notes?: string | null
          items?: Json | null
          packing_slip_url?: string | null
          photo_urls?: string[] | null
          photos?: Json | null
          project_id?: string
          purchase_order_id?: string | null
          received_by?: string | null
          receiving_notes?: string | null
          status?: string | null
          supplier?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          escalation_policy: string
          external_ids: Json | null
          id: string
          legacy_payload: Json | null
          name: string
          parent_contact_id: string | null
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
          escalation_policy?: string
          external_ids?: Json | null
          id?: string
          legacy_payload?: Json | null
          name: string
          parent_contact_id?: string | null
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
          escalation_policy?: string
          external_ids?: Json | null
          id?: string
          legacy_payload?: Json | null
          name?: string
          parent_contact_id?: string | null
          phone?: string | null
          project_id?: string
          role?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_contacts_parent_contact_id_fkey"
            columns: ["parent_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string | null
          document_name: string
          embedding: string | null
          id: string
          metadata: Json | null
          project_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id?: string | null
          document_name: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string | null
          document_name?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "document_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "document_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_gen_runs: {
        Row: {
          completed_at: string | null
          content_hash: string | null
          distribution_list: Json
          error_message: string | null
          id: string
          kind: string
          output_storage_path: string | null
          project_id: string
          sent_to_count: number
          snapshot_at: string
          started_at: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          content_hash?: string | null
          distribution_list?: Json
          error_message?: string | null
          id?: string
          kind: string
          output_storage_path?: string | null
          project_id: string
          sent_to_count?: number
          snapshot_at: string
          started_at?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          content_hash?: string | null
          distribution_list?: Json
          error_message?: string | null
          id?: string
          kind?: string
          output_storage_path?: string | null
          project_id?: string
          sent_to_count?: number
          snapshot_at?: string
          started_at?: string
          triggered_by?: string | null
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      drafted_actions: {
        Row: {
          action_type: string
          citations: Json
          confidence: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          draft_reason: string | null
          drafted_by: string
          executed_at: string | null
          executed_resource_id: string | null
          executed_resource_type: string | null
          execution_result: Json | null
          id: string
          payload: Json
          project_id: string
          related_resource_id: string | null
          related_resource_type: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          citations?: Json
          confidence?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          draft_reason?: string | null
          drafted_by: string
          executed_at?: string | null
          executed_resource_id?: string | null
          executed_resource_type?: string | null
          execution_result?: Json | null
          id?: string
          payload?: Json
          project_id: string
          related_resource_id?: string | null
          related_resource_type?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          citations?: Json
          confidence?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          draft_reason?: string | null
          drafted_by?: string
          executed_at?: string | null
          executed_resource_id?: string | null
          executed_resource_type?: string | null
          execution_result?: Json | null
          id?: string
          payload?: Json
          project_id?: string
          related_resource_id?: string | null
          related_resource_type?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafted_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drafted_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drafted_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_report_extraction_jobs: {
        Row: {
          created_at: string
          document_id: string | null
          error_message: string | null
          filename: string | null
          finished_at: string | null
          id: string
          project_id: string
          result_json: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          filename?: string | null
          finished_at?: string | null
          id?: string
          project_id: string
          result_json?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          filename?: string | null
          finished_at?: string | null
          id?: string
          project_id?: string
          result_json?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_report_extraction_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draw_report_extraction_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "draw_report_extraction_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "draw_report_extraction_jobs_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          annotation_type: string | null
          color: string | null
          content: string | null
          coordinates: Json | null
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
          page_number: number | null
          project_id: string
          shape_data: Json | null
          stamp_type: string | null
          type: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          annotation_type?: string | null
          color?: string | null
          content?: string | null
          coordinates?: Json | null
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
          page_number?: number | null
          project_id: string
          shape_data?: Json | null
          stamp_type?: string | null
          type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          annotation_type?: string | null
          color?: string | null
          content?: string | null
          coordinates?: Json | null
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
          page_number?: number | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      drawing_scopes: {
        Row: {
          area_polygon: Json | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          crew_id: string | null
          drawing_id: string
          id: string
          notes: string | null
          priority: number
          project_id: string
          spec_section: string | null
          updated_at: string
        }
        Insert: {
          area_polygon?: Json | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          crew_id?: string | null
          drawing_id: string
          id?: string
          notes?: string | null
          priority?: number
          project_id: string
          spec_section?: string | null
          updated_at?: string
        }
        Update: {
          area_polygon?: Json | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          crew_id?: string | null
          drawing_id?: string
          id?: string
          notes?: string | null
          priority?: number
          project_id?: string
          spec_section?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_scopes_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_scopes_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_scopes_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      drawing_sheets: {
        Row: {
          created_at: string | null
          drawing_id: string | null
          file_url: string | null
          id: string
          page_number: number
          project_id: string | null
          sheet_number: string | null
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          drawing_id?: string | null
          file_url?: string | null
          id?: string
          page_number?: number
          project_id?: string | null
          sheet_number?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          drawing_id?: string | null
          file_url?: string | null
          id?: string
          page_number?: number
          project_id?: string | null
          sheet_number?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_sheets_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "drawing_sheets_project_id_fkey"
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
          external_ids: Json | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          legacy_payload: Json | null
          north_offset_deg: number | null
          origin_lat: number | null
          origin_lng: number | null
          origin_set: boolean | null
          origin_set_at: string | null
          origin_set_by: string | null
          previous_revision_id: string | null
          processing_status: string | null
          project_id: string
          received_date: string | null
          revision: string | null
          search_vector: unknown
          set_name: string | null
          sheet_extent_m: Json | null
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
          external_ids?: Json | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          legacy_payload?: Json | null
          north_offset_deg?: number | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_set?: boolean | null
          origin_set_at?: string | null
          origin_set_by?: string | null
          previous_revision_id?: string | null
          processing_status?: string | null
          project_id: string
          received_date?: string | null
          revision?: string | null
          search_vector?: unknown
          set_name?: string | null
          sheet_extent_m?: Json | null
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
          external_ids?: Json | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          legacy_payload?: Json | null
          north_offset_deg?: number | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_set?: boolean | null
          origin_set_at?: string | null
          origin_set_by?: string | null
          previous_revision_id?: string | null
          processing_status?: string | null
          project_id?: string
          received_date?: string | null
          revision?: string | null
          search_vector?: unknown
          set_name?: string | null
          sheet_extent_m?: Json | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      eeo1_demographics: {
        Row: {
          gender: string | null
          id: string
          job_category: string | null
          race_ethnicity: string | null
          reported_at: string
          updated_at: string
          workforce_member_id: string
        }
        Insert: {
          gender?: string | null
          id?: string
          job_category?: string | null
          race_ethnicity?: string | null
          reported_at?: string
          updated_at?: string
          workforce_member_id: string
        }
        Update: {
          gender?: string | null
          id?: string
          job_category?: string | null
          race_ethnicity?: string | null
          reported_at?: string
          updated_at?: string
          workforce_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eeo1_demographics_workforce_member_id_fkey"
            columns: ["workforce_member_id"]
            isOneToOne: false
            referencedRelation: "workforce_members"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      entity_audit_chain: {
        Row: {
          chain_hash: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          payload_hash: string
          prev_hash: string
          project_id: string
          sequence: number
          signed_at: string
          signed_by: string | null
        }
        Insert: {
          chain_hash: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          payload_hash: string
          prev_hash: string
          project_id: string
          sequence?: number
          signed_at?: string
          signed_by?: string | null
        }
        Update: {
          chain_hash?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          payload_hash?: string
          prev_hash?: string
          project_id?: string
          sequence?: number
          signed_at?: string
          signed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_audit_chain_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "entity_audit_chain_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "entity_audit_chain_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          project_id: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "entity_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "entity_links_project_id_fkey"
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
          assigned_to: string | null
          barcode: string | null
          checkin_date: string | null
          checkout_date: string | null
          created_at: string | null
          created_by: string | null
          current_location: string | null
          current_project_id: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          updated_by: string | null
          vendor: string | null
          warranty_expiry: string | null
          year: number | null
        }
        Insert: {
          acquisition_cost?: number | null
          assigned_to?: string | null
          barcode?: string | null
          checkin_date?: string | null
          checkout_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_location?: string | null
          current_project_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
          vendor?: string | null
          warranty_expiry?: string | null
          year?: number | null
        }
        Update: {
          acquisition_cost?: number | null
          assigned_to?: string | null
          barcode?: string | null
          checkin_date?: string | null
          checkout_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_location?: string | null
          current_project_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
          vendor?: string | null
          warranty_expiry?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          updated_by: string | null
          vendor: string | null
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
          vendor?: string | null
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          updated_by?: string | null
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
      equipment_rates: {
        Row: {
          created_at: string | null
          daily_rate: number
          equipment_name: string
          fuel_included: boolean | null
          id: string
          monthly_rate: number | null
          operator_included: boolean | null
          project_id: string
          weekly_rate: number | null
        }
        Insert: {
          created_at?: string | null
          daily_rate: number
          equipment_name: string
          fuel_included?: boolean | null
          id?: string
          monthly_rate?: number | null
          operator_included?: boolean | null
          project_id: string
          weekly_rate?: number | null
        }
        Update: {
          created_at?: string | null
          daily_rate?: number
          equipment_name?: string
          fuel_included?: boolean | null
          id?: string
          monthly_rate?: number | null
          operator_included?: boolean | null
          project_id?: string
          weekly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "equipment_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "equipment_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      estimate_rollups: {
        Row: {
          as_of: string
          created_at: string
          division: string
          id: string
          project_id: string
          total_committed: number
          total_estimated: number
          updated_at: string
        }
        Insert: {
          as_of?: string
          created_at?: string
          division: string
          id?: string
          project_id: string
          total_committed?: number
          total_estimated?: number
          updated_at?: string
        }
        Update: {
          as_of?: string
          created_at?: string
          division?: string
          id?: string
          project_id?: string
          total_committed?: number
          total_estimated?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_rollups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "estimate_rollups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "estimate_rollups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          total_amount: number
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
          total_amount?: number
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
          total_amount?: number
          type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      estimating_items: {
        Row: {
          bid_package_id: string | null
          category: string | null
          cost_code: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          project_id: string
          quantity: number
          total_cost: number | null
          unit: string | null
          unit_cost: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          bid_package_id?: string | null
          category?: string | null
          cost_code?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          project_id: string
          quantity?: number
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          bid_package_id?: string | null
          category?: string | null
          cost_code?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimating_items_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "bid_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimating_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "estimating_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "estimating_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimating_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
      failed_login_attempts: {
        Row: {
          attempted_at: string
          email_lower: string
          id: string
          ip_hint: string | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email_lower: string
          id?: string
          ip_hint?: string | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email_lower?: string
          id?: string
          ip_hint?: string | null
          user_agent?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      field_session_events: {
        Row: {
          activity: string
          app_build: string | null
          created_at: string
          did_mutate: boolean
          ended_at: string | null
          id: string
          network: string | null
          project_id: string
          role_at_event: string | null
          started_at: string
          surface: string
          user_id: string
        }
        Insert: {
          activity: string
          app_build?: string | null
          created_at?: string
          did_mutate?: boolean
          ended_at?: string | null
          id?: string
          network?: string | null
          project_id: string
          role_at_event?: string | null
          started_at?: string
          surface: string
          user_id: string
        }
        Update: {
          activity?: string
          app_build?: string | null
          created_at?: string
          did_mutate?: boolean
          ended_at?: string | null
          id?: string
          network?: string | null
          project_id?: string
          role_at_event?: string | null
          started_at?: string
          surface?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_session_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "field_session_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "field_session_events_project_id_fkey"
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
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          discipline: string | null
          document_status: string | null
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
          updated_at: string | null
          updated_by: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          discipline?: string | null
          document_status?: string | null
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
          updated_at?: string | null
          updated_by?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          discipline?: string | null
          document_status?: string | null
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
          updated_at?: string | null
          updated_by?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      financial_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          period_month: string
          project_id: string
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period_month: string
          project_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period_month?: string
          project_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_periods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_periods_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      import_jobs: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          entity_type: string
          error_log: Json
          id: string
          organization_id: string
          processed_count: number
          resumable_cursor: Json
          source_system: string
          started_at: string
          started_by: string | null
          status: string
          total_count: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          entity_type: string
          error_log?: Json
          id?: string
          organization_id: string
          processed_count?: number
          resumable_cursor?: Json
          source_system?: string
          started_at?: string
          started_by?: string | null
          status?: string
          total_count?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          entity_type?: string
          error_log?: Json
          id?: string
          organization_id?: string
          processed_count?: number
          resumable_cursor?: Json
          source_system?: string
          started_at?: string
          started_by?: string | null
          status?: string
          total_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_email_replies: {
        Row: {
          body_text: string | null
          entity_id: string
          entity_type: string
          from_email: string | null
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          in_reply_to: string | null
          message_id: string | null
          received_at: string
          subject: string | null
          threaded_via: string
          threading_confidence: string
        }
        Insert: {
          body_text?: string | null
          entity_id: string
          entity_type: string
          from_email?: string | null
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          in_reply_to?: string | null
          message_id?: string | null
          received_at?: string
          subject?: string | null
          threaded_via: string
          threading_confidence: string
        }
        Update: {
          body_text?: string | null
          entity_id?: string
          entity_type?: string
          from_email?: string | null
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          in_reply_to?: string | null
          message_id?: string | null
          received_at?: string
          subject?: string | null
          threaded_via?: string
          threading_confidence?: string
        }
        Relationships: []
      }
      inbound_email_unmatched: {
        Row: {
          body_text: string | null
          from_email: string | null
          id: string
          in_reply_to: string | null
          message_id: string | null
          received_at: string
          subject: string | null
          to_emails: string[]
          triage_notes: string | null
          triaged_at: string | null
          triaged_by_user: string | null
          triaged_to_entity_id: string | null
          triaged_to_entity_type: string | null
        }
        Insert: {
          body_text?: string | null
          from_email?: string | null
          id?: string
          in_reply_to?: string | null
          message_id?: string | null
          received_at?: string
          subject?: string | null
          to_emails?: string[]
          triage_notes?: string | null
          triaged_at?: string | null
          triaged_by_user?: string | null
          triaged_to_entity_id?: string | null
          triaged_to_entity_type?: string | null
        }
        Update: {
          body_text?: string | null
          from_email?: string | null
          id?: string
          in_reply_to?: string | null
          message_id?: string | null
          received_at?: string
          subject?: string | null
          to_emails?: string[]
          triage_notes?: string | null
          triaged_at?: string | null
          triaged_by_user?: string | null
          triaged_to_entity_id?: string | null
          triaged_to_entity_type?: string | null
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          last_reminder_sent_at: string | null
          policy_number: string | null
          policy_type: string | null
          project_id: string
          reminder_thresholds_sent: number[] | null
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
          last_reminder_sent_at?: string | null
          policy_number?: string | null
          policy_type?: string | null
          project_id: string
          reminder_thresholds_sent?: number[] | null
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
          last_reminder_sent_at?: string | null
          policy_number?: string | null
          policy_type?: string | null
          project_id?: string
          reminder_thresholds_sent?: number[] | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      integration_connections: {
        Row: {
          account_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_sync_at: string | null
          metadata: Json
          oauth_refresh_token_encrypted: string | null
          oauth_token_encrypted: string | null
          organization_id: string
          provider: string
          scope: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json
          oauth_refresh_token_encrypted?: string | null
          oauth_token_encrypted?: string | null
          organization_id: string
          provider: string
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          metadata?: Json
          oauth_refresh_token_encrypted?: string | null
          oauth_token_encrypted?: string | null
          organization_id?: string
          provider?: string
          scope?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      integration_sync_jobs: {
        Row: {
          completed_at: string | null
          connection_id: string
          created_at: string
          direction: string
          entity_type: string
          error_message: string | null
          id: string
          records_failed: number
          records_processed: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          created_at?: string
          direction?: string
          entity_type: string
          error_message?: string | null
          id?: string
          records_failed?: number
          records_processed?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          direction?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          records_failed?: number
          records_processed?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      invite_logs: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          metadata: Json | null
          organization_id: string
          project_ids: string[] | null
          role: string | null
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          organization_id: string
          project_ids?: string[] | null
          role?: string | null
          status?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          organization_id?: string
          project_ids?: string[] | null
          role?: string | null
          status?: string | null
          token?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string | null
          due_at: string | null
          id: string
          invoice_number: string | null
          invoice_pdf_url: string | null
          line_items: Json | null
          organization_id: string | null
          paid_at: string | null
          receipt_pdf_url: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          due_at?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          line_items?: Json | null
          organization_id?: string | null
          paid_at?: string | null
          receipt_pdf_url?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          due_at?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          line_items?: Json | null
          organization_id?: string | null
          paid_at?: string | null
          receipt_pdf_url?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      iris_call_idempotency: {
        Row: {
          created_at: string
          idempotency_key: string
          request_hash: string
          response: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          request_hash: string
          response: Json
          user_id: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          request_hash?: string
          response?: Json
          user_id?: string
        }
        Relationships: []
      }
      iris_grounding_cache: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          fingerprint: string
          response: Json
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          fingerprint: string
          response: Json
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          fingerprint?: string
          response?: Json
        }
        Relationships: []
      }
      iris_suggestion_history: {
        Row: {
          decided_at: string | null
          decision: string | null
          entity_id: string
          entity_type: string
          id: string
          suggested_at: string
          suggestion_kind: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decision?: string | null
          entity_id: string
          entity_type: string
          id?: string
          suggested_at?: string
          suggestion_kind: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decision?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          suggested_at?: string
          suggestion_kind?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      labor_rates: {
        Row: {
          benefits_rate: number | null
          classification: string
          created_at: string | null
          effective_date: string
          hourly_rate: number
          id: string
          overtime_rate: number | null
          project_id: string
          source: string | null
          trade: string
        }
        Insert: {
          benefits_rate?: number | null
          classification: string
          created_at?: string | null
          effective_date: string
          hourly_rate: number
          id?: string
          overtime_rate?: number | null
          project_id: string
          source?: string | null
          trade: string
        }
        Update: {
          benefits_rate?: number | null
          classification?: string
          created_at?: string | null
          effective_date?: string
          hourly_rate?: number
          id?: string
          overtime_rate?: number | null
          project_id?: string
          source?: string | null
          trade?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "labor_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "labor_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leed_credits: {
        Row: {
          created_at: string | null
          credit_category: string
          credit_id: string
          credit_name: string
          documentation_notes: string | null
          id: string
          points_achieved: number | null
          points_possible: number
          project_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          credit_category: string
          credit_id: string
          credit_name: string
          documentation_notes?: string | null
          id?: string
          points_achieved?: number | null
          points_possible: number
          project_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          credit_category?: string
          credit_id?: string
          credit_name?: string
          documentation_notes?: string | null
          id?: string
          points_achieved?: number | null
          points_possible?: number
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leed_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "leed_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "leed_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lien_waiver_signatures: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          signature_image_url: string | null
          signed_at: string
          signed_body: string
          signed_by_email: string
          signed_by_name: string | null
          signed_by_title: string | null
          signer_ip: unknown
          signer_ua: string | null
          waiver_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          signature_image_url?: string | null
          signed_at?: string
          signed_body: string
          signed_by_email: string
          signed_by_name?: string | null
          signed_by_title?: string | null
          signer_ip?: unknown
          signer_ua?: string | null
          waiver_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          signature_image_url?: string | null
          signed_at?: string
          signed_body?: string
          signed_by_email?: string
          signed_by_name?: string | null
          signed_by_title?: string | null
          signer_ip?: unknown
          signer_ua?: string | null
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lien_waiver_signatures_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "lien_waivers"
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
          created_via: string
          document_url: string | null
          expires_at: string | null
          id: string
          jurisdiction: string
          magic_token_hash: string | null
          notes: string | null
          pay_app_id: string | null
          period_through: string | null
          project_id: string
          sent_at: string | null
          sent_to_email: string | null
          signed_at: string | null
          signed_by: string | null
          source_drafted_action_id: string | null
          status: string
          subcontractor_id: string | null
          subcontractor_name: string | null
          template_id: string | null
          template_version: string | null
          through_date: string
          type: string | null
          updated_at: string | null
          waiver_state: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          contractor_name: string
          created_at?: string | null
          created_via?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          jurisdiction?: string
          magic_token_hash?: string | null
          notes?: string | null
          pay_app_id?: string | null
          period_through?: string | null
          project_id: string
          sent_at?: string | null
          sent_to_email?: string | null
          signed_at?: string | null
          signed_by?: string | null
          source_drafted_action_id?: string | null
          status?: string
          subcontractor_id?: string | null
          subcontractor_name?: string | null
          template_id?: string | null
          template_version?: string | null
          through_date: string
          type?: string | null
          updated_at?: string | null
          waiver_state?: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          contractor_name?: string
          created_at?: string | null
          created_via?: string
          document_url?: string | null
          expires_at?: string | null
          id?: string
          jurisdiction?: string
          magic_token_hash?: string | null
          notes?: string | null
          pay_app_id?: string | null
          period_through?: string | null
          project_id?: string
          sent_at?: string | null
          sent_to_email?: string | null
          signed_at?: string | null
          signed_by?: string | null
          source_drafted_action_id?: string | null
          status?: string
          subcontractor_id?: string | null
          subcontractor_name?: string | null
          template_id?: string | null
          template_version?: string | null
          through_date?: string
          type?: string | null
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
            foreignKeyName: "lien_waivers_pay_app_id_fkey"
            columns: ["pay_app_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lien_waivers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      magic_link_tokens: {
        Row: {
          accessed_count: number
          accessed_ip: string | null
          accessed_ua: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          first_accessed_at: string | null
          forwarded: boolean
          forwarded_email: string | null
          id: string
          issued_at: string
          issued_by: string | null
          last_accessed_at: string | null
          metadata: Json
          project_id: string
          recipient_email: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          scope: string
          token_hash: string
        }
        Insert: {
          accessed_count?: number
          accessed_ip?: string | null
          accessed_ua?: string | null
          entity_id: string
          entity_type: string
          expires_at: string
          first_accessed_at?: string | null
          forwarded?: boolean
          forwarded_email?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_accessed_at?: string | null
          metadata?: Json
          project_id: string
          recipient_email: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          scope?: string
          token_hash: string
        }
        Update: {
          accessed_count?: number
          accessed_ip?: string | null
          accessed_ua?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string
          first_accessed_at?: string | null
          forwarded?: boolean
          forwarded_email?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_accessed_at?: string | null
          metadata?: Json
          project_id?: string
          recipient_email?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          scope?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_link_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "magic_link_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "magic_link_tokens_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      material_prices: {
        Row: {
          created_at: string
          id: string
          material_type: string
          price: number
          recorded_at: string
          region: string
          source: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_type: string
          price: number
          recorded_at?: string
          region?: string
          source?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_type?: string
          price?: number
          recorded_at?: string
          region?: string
          source?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      material_rates: {
        Row: {
          created_at: string | null
          csi_division: number | null
          id: string
          item_name: string
          lead_time_days: number | null
          project_id: string
          supplier: string | null
          unit: string
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          csi_division?: number | null
          id?: string
          item_name: string
          lead_time_days?: number | null
          project_id: string
          supplier?: string | null
          unit: string
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          csi_division?: number | null
          id?: string
          item_name?: string
          lead_time_days?: number | null
          project_id?: string
          supplier?: string | null
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "material_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "material_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      media_links: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          entity_id: string
          entity_type: string
          id: string
          media_id: string
          media_type: string
          notes: string | null
          pin_x: number | null
          pin_y: number | null
          project_id: string
          source: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          entity_id: string
          entity_type: string
          id?: string
          media_id: string
          media_type: string
          notes?: string | null
          pin_x?: number | null
          pin_y?: number | null
          project_id: string
          source?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          media_id?: string
          media_type?: string
          notes?: string | null
          pin_x?: number | null
          pin_y?: number | null
          project_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "media_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "media_links_project_id_fkey"
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
      meeting_participants: {
        Row: {
          attended: boolean | null
          created_at: string | null
          email: string | null
          id: string
          meeting_id: string | null
          name: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          attended?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          meeting_id?: string | null
          name?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          attended?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          meeting_id?: string | null
          name?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          bypass_dnd_for_critical: boolean
          channels: Json
          comment_channel: string | null
          created_at: string | null
          daily_digest: boolean | null
          digest_schedule: Json | null
          digest_time: string | null
          dnd_end: string | null
          dnd_start: string | null
          dnd_timezone: string | null
          id: string
          mention_channel: string | null
          muted_projects: string[] | null
          muted_threads: Json | null
          overdue_channel: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          slack_enabled: boolean | null
          slack_user_id: string | null
          status_change_channel: string | null
          suggestion_frequency: string
          system_channel: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_insight_channel?: string | null
          approval_needed_channel?: string | null
          assignment_channel?: string | null
          bypass_dnd_for_critical?: boolean
          channels?: Json
          comment_channel?: string | null
          created_at?: string | null
          daily_digest?: boolean | null
          digest_schedule?: Json | null
          digest_time?: string | null
          dnd_end?: string | null
          dnd_start?: string | null
          dnd_timezone?: string | null
          id?: string
          mention_channel?: string | null
          muted_projects?: string[] | null
          muted_threads?: Json | null
          overdue_channel?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          slack_enabled?: boolean | null
          slack_user_id?: string | null
          status_change_channel?: string | null
          suggestion_frequency?: string
          system_channel?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_insight_channel?: string | null
          approval_needed_channel?: string | null
          assignment_channel?: string | null
          bypass_dnd_for_critical?: boolean
          channels?: Json
          comment_channel?: string | null
          created_at?: string | null
          daily_digest?: boolean | null
          digest_schedule?: Json | null
          digest_time?: string | null
          dnd_end?: string | null
          dnd_start?: string | null
          dnd_timezone?: string | null
          id?: string
          mention_channel?: string | null
          muted_projects?: string[] | null
          muted_threads?: Json | null
          overdue_channel?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          slack_enabled?: boolean | null
          slack_user_id?: string | null
          status_change_channel?: string | null
          suggestion_frequency?: string
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      org_api_token_uses: {
        Row: {
          endpoint: string | null
          id: string
          ip_address: string | null
          outcome: string
          status_code: number | null
          token_id: string
          used_at: string
          user_agent: string | null
        }
        Insert: {
          endpoint?: string | null
          id?: string
          ip_address?: string | null
          outcome: string
          status_code?: number | null
          token_id: string
          used_at?: string
          user_agent?: string | null
        }
        Update: {
          endpoint?: string | null
          id?: string
          ip_address?: string | null
          outcome?: string
          status_code?: number | null
          token_id?: string
          used_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_api_token_uses_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "org_api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          first_used_ip: string | null
          first_used_ua: string | null
          id: string
          last_used_at: string | null
          name: string
          organization_id: string
          prefix: string
          project_ids: string[] | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          scopes: string[]
          token_hash: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          first_used_ip?: string | null
          first_used_ua?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          organization_id: string
          prefix: string
          project_ids?: string[] | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          token_hash: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          first_used_ip?: string | null
          first_used_ua?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          prefix?: string
          project_ids?: string[] | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          token_hash?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_api_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_branding: {
        Row: {
          custom_domain: string | null
          email_from_address: string | null
          email_from_name: string | null
          favicon_url: string | null
          legal_name: string | null
          logo_storage_path: string | null
          logo_url: string | null
          organization_id: string
          primary_color: string | null
          privacy_url: string | null
          secondary_color: string | null
          support_email: string | null
          support_url: string | null
          terms_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_domain?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          favicon_url?: string | null
          legal_name?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          organization_id: string
          primary_color?: string | null
          privacy_url?: string | null
          secondary_color?: string | null
          support_email?: string | null
          support_url?: string | null
          terms_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_domain?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          favicon_url?: string | null
          legal_name?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          organization_id?: string
          primary_color?: string | null
          privacy_url?: string | null
          secondary_color?: string | null
          support_email?: string | null
          support_url?: string | null
          terms_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_custom_role_assignments: {
        Row: {
          custom_role_id: string
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          custom_role_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          custom_role_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_custom_role_assignments_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "org_custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_custom_role_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          inherits_from: string | null
          is_active: boolean
          name: string
          organization_id: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inherits_from?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inherits_from?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_s3_export_config: {
        Row: {
          bucket_name: string
          bucket_prefix: string | null
          bucket_region: string
          created_at: string
          enabled: boolean
          enc_access_key_id: string | null
          enc_secret_access_key: string | null
          enc_session_token: string | null
          id: string
          last_run_at: string | null
          last_run_bytes: number | null
          last_run_error: string | null
          last_run_status: string | null
          max_export_bytes: number | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          bucket_prefix?: string | null
          bucket_region: string
          created_at?: string
          enabled?: boolean
          enc_access_key_id?: string | null
          enc_secret_access_key?: string | null
          enc_session_token?: string | null
          id?: string
          last_run_at?: string | null
          last_run_bytes?: number | null
          last_run_error?: string | null
          last_run_status?: string | null
          max_export_bytes?: number | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          bucket_prefix?: string | null
          bucket_region?: string
          created_at?: string
          enabled?: boolean
          enc_access_key_id?: string | null
          enc_secret_access_key?: string | null
          enc_session_token?: string | null
          id?: string
          last_run_at?: string | null
          last_run_bytes?: number | null
          last_run_error?: string | null
          last_run_status?: string | null
          max_export_bytes?: number | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_sso_config: {
        Row: {
          allow_jit_provision: boolean
          attribute_mapping: Json
          created_at: string
          created_by: string | null
          default_role: string | null
          enabled: boolean
          group_role_mapping: Json
          id: string
          oidc_authorization_endpoint: string | null
          oidc_client_id: string | null
          oidc_client_secret_ciphertext: string | null
          oidc_issuer: string | null
          oidc_jwks_uri: string | null
          oidc_token_endpoint: string | null
          oidc_userinfo_endpoint: string | null
          organization_id: string
          protocol: string
          saml_idp_entity_id: string | null
          saml_sp_entity_id: string | null
          saml_sso_url: string | null
          saml_x509_certs: string | null
          test_mode_enabled: boolean
          test_user_emails: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_jit_provision?: boolean
          attribute_mapping?: Json
          created_at?: string
          created_by?: string | null
          default_role?: string | null
          enabled?: boolean
          group_role_mapping?: Json
          id?: string
          oidc_authorization_endpoint?: string | null
          oidc_client_id?: string | null
          oidc_client_secret_ciphertext?: string | null
          oidc_issuer?: string | null
          oidc_jwks_uri?: string | null
          oidc_token_endpoint?: string | null
          oidc_userinfo_endpoint?: string | null
          organization_id: string
          protocol: string
          saml_idp_entity_id?: string | null
          saml_sp_entity_id?: string | null
          saml_sso_url?: string | null
          saml_x509_certs?: string | null
          test_mode_enabled?: boolean
          test_user_emails?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_jit_provision?: boolean
          attribute_mapping?: Json
          created_at?: string
          created_by?: string | null
          default_role?: string | null
          enabled?: boolean
          group_role_mapping?: Json
          id?: string
          oidc_authorization_endpoint?: string | null
          oidc_client_id?: string | null
          oidc_client_secret_ciphertext?: string | null
          oidc_issuer?: string | null
          oidc_jwks_uri?: string | null
          oidc_token_endpoint?: string | null
          oidc_userinfo_endpoint?: string | null
          organization_id?: string
          protocol?: string
          saml_idp_entity_id?: string | null
          saml_sp_entity_id?: string | null
          saml_sso_url?: string | null
          saml_x509_certs?: string | null
          test_mode_enabled?: boolean
          test_user_emails?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_sso_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
          slack_channel_default: string | null
          slack_enabled: boolean | null
          slack_webhook_url: string | null
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
          slack_channel_default?: string | null
          slack_enabled?: boolean | null
          slack_webhook_url?: string | null
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
          slack_channel_default?: string | null
          slack_enabled?: boolean | null
          slack_webhook_url?: string | null
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
      outbound_email_log: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          message_id: string
          sent_at: string
          sent_by_user: string | null
          subject: string | null
          to_emails: string[]
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          message_id: string
          sent_at?: string
          sent_by_user?: string | null
          subject?: string | null
          to_emails?: string[]
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          message_id?: string
          sent_at?: string
          sent_by_user?: string | null
          subject?: string | null
          to_emails?: string[]
        }
        Relationships: []
      }
      outbound_webhooks: {
        Row: {
          active: boolean
          consecutive_failures: number
          created_at: string
          created_by: string | null
          event_types: string[]
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          name: string
          organization_id: string
          paused: boolean
          project_ids: string[] | null
          secret_hint: string
          status_filter: Json
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          event_types?: string[]
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          name: string
          organization_id: string
          paused?: boolean
          project_ids?: string[] | null
          secret_hint: string
          status_filter?: Json
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          event_types?: string[]
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          name?: string
          organization_id?: string
          paused?: boolean
          project_ids?: string[] | null
          secret_hint?: string
          status_filter?: Json
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      pay_app_reconciliation_lines: {
        Row: {
          blocked: boolean
          cost_code: string
          created_at: string
          description: string
          id: string
          pay_app_id: string
          pay_app_pct: number | null
          project_id: string
          reason: string
          reconciliation_id: string
          schedule_pct: number | null
          scheduled_value: number
          severity: string
          variance_pct: number | null
        }
        Insert: {
          blocked?: boolean
          cost_code: string
          created_at?: string
          description: string
          id?: string
          pay_app_id: string
          pay_app_pct?: number | null
          project_id: string
          reason: string
          reconciliation_id: string
          schedule_pct?: number | null
          scheduled_value?: number
          severity?: string
          variance_pct?: number | null
        }
        Update: {
          blocked?: boolean
          cost_code?: string
          created_at?: string
          description?: string
          id?: string
          pay_app_id?: string
          pay_app_pct?: number | null
          project_id?: string
          reason?: string
          reconciliation_id?: string
          schedule_pct?: number | null
          scheduled_value?: number
          severity?: string
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_app_reconciliation_lines_pay_app_id_fkey"
            columns: ["pay_app_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_app_reconciliation_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pay_app_reconciliation_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pay_app_reconciliation_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_app_reconciliation_lines_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "pay_app_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_app_reconciliations: {
        Row: {
          applied_tolerance_pct: number
          blocked: boolean
          blocked_dollars_at_risk: number
          computed_at: string
          created_at: string
          created_via: string
          id: string
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          pay_app_id: string
          project_id: string
          source_drafted_action_id: string | null
          status: string
          updated_at: string
          variance_lines: Json
        }
        Insert: {
          applied_tolerance_pct?: number
          blocked?: boolean
          blocked_dollars_at_risk?: number
          computed_at?: string
          created_at?: string
          created_via?: string
          id?: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          pay_app_id: string
          project_id: string
          source_drafted_action_id?: string | null
          status?: string
          updated_at?: string
          variance_lines?: Json
        }
        Update: {
          applied_tolerance_pct?: number
          blocked?: boolean
          blocked_dollars_at_risk?: number
          computed_at?: string
          created_at?: string
          created_via?: string
          id?: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          pay_app_id?: string
          project_id?: string
          source_drafted_action_id?: string | null
          status?: string
          updated_at?: string
          variance_lines?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pay_app_reconciliations_pay_app_id_fkey"
            columns: ["pay_app_id"]
            isOneToOne: true
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_app_reconciliations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pay_app_reconciliations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pay_app_reconciliations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_application_line_items: {
        Row: {
          amount: number | null
          amount_this_period: number | null
          balance_to_finish: number | null
          cost_code: string | null
          created_at: string | null
          description: string | null
          extraction_confidence: number | null
          id: string
          item_number: string | null
          materials_stored: number | null
          pay_application_id: string | null
          payment_period: string | null
          percent_complete: number | null
          previous_completed: number | null
          retainage: number | null
          scheduled_value: number | null
          sort_order: number | null
          source_document_id: string | null
          subcontractor_id: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          amount_this_period?: number | null
          balance_to_finish?: number | null
          cost_code?: string | null
          created_at?: string | null
          description?: string | null
          extraction_confidence?: number | null
          id?: string
          item_number?: string | null
          materials_stored?: number | null
          pay_application_id?: string | null
          payment_period?: string | null
          percent_complete?: number | null
          previous_completed?: number | null
          retainage?: number | null
          scheduled_value?: number | null
          sort_order?: number | null
          source_document_id?: string | null
          subcontractor_id?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          amount_this_period?: number | null
          balance_to_finish?: number | null
          cost_code?: string | null
          created_at?: string | null
          description?: string | null
          extraction_confidence?: number | null
          id?: string
          item_number?: string | null
          materials_stored?: number | null
          pay_application_id?: string | null
          payment_period?: string | null
          percent_complete?: number | null
          previous_completed?: number | null
          retainage?: number | null
          scheduled_value?: number | null
          sort_order?: number | null
          source_document_id?: string | null
          subcontractor_id?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_application_line_items_pay_application_id_fkey"
            columns: ["pay_application_id"]
            isOneToOne: false
            referencedRelation: "pay_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_application_line_items_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
          raw_extraction: Json | null
          retainage: number | null
          signature_url: string | null
          source_document_id: string | null
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
          raw_extraction?: Json | null
          retainage?: number | null
          signature_url?: string | null
          source_document_id?: string | null
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
          raw_extraction?: Json | null
          retainage?: number | null
          signature_url?: string | null
          source_document_id?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          {
            foreignKeyName: "pay_applications_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      payapp_audit_overrides: {
        Row: {
          audit_run_id: string | null
          created_at: string | null
          created_via: string | null
          id: string
          overridden_by: string | null
          overridden_check_ids: string[]
          payment_application_id: string
          project_id: string
          reason: string
          source_drafted_action_id: string | null
        }
        Insert: {
          audit_run_id?: string | null
          created_at?: string | null
          created_via?: string | null
          id?: string
          overridden_by?: string | null
          overridden_check_ids?: string[]
          payment_application_id: string
          project_id: string
          reason: string
          source_drafted_action_id?: string | null
        }
        Update: {
          audit_run_id?: string | null
          created_at?: string | null
          created_via?: string | null
          id?: string
          overridden_by?: string | null
          overridden_check_ids?: string[]
          payment_application_id?: string
          project_id?: string
          reason?: string
          source_drafted_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payapp_audit_overrides_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "payapp_audit_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payapp_audit_overrides_payment_application_id_fkey"
            columns: ["payment_application_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payapp_audit_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_audit_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_audit_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payapp_audit_runs: {
        Row: {
          created_at: string | null
          created_via: string | null
          failed_checks: number
          id: string
          payment_application_id: string
          project_id: string
          ran_by: string | null
          results: Json
          source_drafted_action_id: string | null
          status: string
          total_checks: number
          warned_checks: number
        }
        Insert: {
          created_at?: string | null
          created_via?: string | null
          failed_checks?: number
          id?: string
          payment_application_id: string
          project_id: string
          ran_by?: string | null
          results?: Json
          source_drafted_action_id?: string | null
          status: string
          total_checks?: number
          warned_checks?: number
        }
        Update: {
          created_at?: string | null
          created_via?: string | null
          failed_checks?: number
          id?: string
          payment_application_id?: string
          project_id?: string
          ran_by?: string | null
          results?: Json
          source_drafted_action_id?: string | null
          status?: string
          total_checks?: number
          warned_checks?: number
        }
        Relationships: [
          {
            foreignKeyName: "payapp_audit_runs_payment_application_id_fkey"
            columns: ["payment_application_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payapp_audit_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_audit_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_audit_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payapp_owner_preview_comments: {
        Row: {
          author_email: string
          author_role: string
          comment: string
          cost_code_anchor: string | null
          created_at: string
          id: string
          pay_app_id: string
          preview_id: string
          project_id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          author_email: string
          author_role?: string
          comment: string
          cost_code_anchor?: string | null
          created_at?: string
          id?: string
          pay_app_id: string
          preview_id: string
          project_id: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          author_email?: string
          author_role?: string
          comment?: string
          cost_code_anchor?: string | null
          created_at?: string
          id?: string
          pay_app_id?: string
          preview_id?: string
          project_id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payapp_owner_preview_comments_pay_app_id_fkey"
            columns: ["pay_app_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payapp_owner_preview_comments_preview_id_fkey"
            columns: ["preview_id"]
            isOneToOne: false
            referencedRelation: "payapp_owner_previews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payapp_owner_preview_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_owner_preview_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_owner_preview_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payapp_owner_previews: {
        Row: {
          accessed_at: string | null
          approved_at: string | null
          approved_by_email: string | null
          comment_thread_id: string | null
          created_at: string
          created_via: string
          expires_at: string
          id: string
          magic_token_hash: string
          pay_app_id: string
          project_id: string
          source_drafted_action_id: string | null
          updated_at: string
        }
        Insert: {
          accessed_at?: string | null
          approved_at?: string | null
          approved_by_email?: string | null
          comment_thread_id?: string | null
          created_at?: string
          created_via?: string
          expires_at: string
          id?: string
          magic_token_hash: string
          pay_app_id: string
          project_id: string
          source_drafted_action_id?: string | null
          updated_at?: string
        }
        Update: {
          accessed_at?: string | null
          approved_at?: string | null
          approved_by_email?: string | null
          comment_thread_id?: string | null
          created_at?: string
          created_via?: string
          expires_at?: string
          id?: string
          magic_token_hash?: string
          pay_app_id?: string
          project_id?: string
          source_drafted_action_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payapp_owner_previews_pay_app_id_fkey"
            columns: ["pay_app_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payapp_owner_previews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_owner_previews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payapp_owner_previews_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      payment_methods: {
        Row: {
          added_by: string | null
          brand: string | null
          created_at: string | null
          deleted_at: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean | null
          last4: string | null
          organization_id: string | null
          stripe_payment_method_id: string | null
        }
        Insert: {
          added_by?: string | null
          brand?: string | null
          created_at?: string | null
          deleted_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          organization_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Update: {
          added_by?: string | null
          brand?: string | null
          created_at?: string | null
          deleted_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          organization_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      per_project_role_overrides: {
        Row: {
          add_permissions: string[]
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          override_role: string
          project_id: string
          reason: string | null
          remove_permissions: string[]
          user_id: string
        }
        Insert: {
          add_permissions?: string[]
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          override_role: string
          project_id: string
          reason?: string | null
          remove_permissions?: string[]
          user_id: string
        }
        Update: {
          add_permissions?: string[]
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          override_role?: string
          project_id?: string
          reason?: string | null
          remove_permissions?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "per_project_role_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "per_project_role_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "per_project_role_overrides_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          gps_accuracy_m: number | null
          gps_status: string | null
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
          gps_accuracy_m?: number | null
          gps_status?: string | null
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
          gps_accuracy_m?: number | null
          gps_status?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      pre_task_plans: {
        Row: {
          attendees: Json | null
          created_at: string | null
          created_by: string | null
          crew_name: string | null
          date: string
          emergency_plan: string | null
          foreman: string | null
          hazards: Json | null
          id: string
          project_id: string
          status: string | null
          task_description: string
          updated_at: string | null
        }
        Insert: {
          attendees?: Json | null
          created_at?: string | null
          created_by?: string | null
          crew_name?: string | null
          date: string
          emergency_plan?: string | null
          foreman?: string | null
          hazards?: Json | null
          id?: string
          project_id: string
          status?: string | null
          task_description: string
          updated_at?: string | null
        }
        Update: {
          attendees?: Json | null
          created_at?: string | null
          created_by?: string | null
          crew_name?: string | null
          date?: string
          emergency_plan?: string | null
          foreman?: string | null
          hazards?: Json | null
          id?: string
          project_id?: string
          status?: string | null
          task_description?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_task_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pre_task_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pre_task_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      precon_bid_invitations: {
        Row: {
          bid_package_id: string
          bid_submission_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          decline_reason: string | null
          email: string | null
          id: string
          invited_at: string | null
          notes: string | null
          phone: string | null
          responded_at: string | null
          status: string | null
          subcontractor_id: string | null
          viewed_at: string | null
        }
        Insert: {
          bid_package_id: string
          bid_submission_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          decline_reason?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          phone?: string | null
          responded_at?: string | null
          status?: string | null
          subcontractor_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          bid_package_id?: string
          bid_submission_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          decline_reason?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          phone?: string | null
          responded_at?: string | null
          status?: string | null
          subcontractor_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precon_bid_invitations_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "precon_bid_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precon_bid_invitations_bid_submission_id_fkey"
            columns: ["bid_submission_id"]
            isOneToOne: false
            referencedRelation: "precon_bid_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precon_bid_invitations_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "precon_subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      precon_bid_packages: {
        Row: {
          addenda_count: number | null
          awarded_amount: number | null
          awarded_to: string | null
          awarded_to_company: string | null
          bid_due_date: string | null
          created_at: string | null
          created_by: string | null
          csi_division: number | null
          description: string | null
          estimated_value: number | null
          id: string
          package_number: string
          pre_bid_meeting: string | null
          project_id: string
          scope_documents: Json | null
          status: string | null
          title: string
          trade: string | null
        }
        Insert: {
          addenda_count?: number | null
          awarded_amount?: number | null
          awarded_to?: string | null
          awarded_to_company?: string | null
          bid_due_date?: string | null
          created_at?: string | null
          created_by?: string | null
          csi_division?: number | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          package_number: string
          pre_bid_meeting?: string | null
          project_id: string
          scope_documents?: Json | null
          status?: string | null
          title: string
          trade?: string | null
        }
        Update: {
          addenda_count?: number | null
          awarded_amount?: number | null
          awarded_to?: string | null
          awarded_to_company?: string | null
          bid_due_date?: string | null
          created_at?: string | null
          created_by?: string | null
          csi_division?: number | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          package_number?: string
          pre_bid_meeting?: string | null
          project_id?: string
          scope_documents?: Json | null
          status?: string | null
          title?: string
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precon_bid_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "precon_bid_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "precon_bid_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      precon_bid_scope_responses: {
        Row: {
          bid_submission_id: string
          cost_impact: number | null
          created_at: string | null
          id: string
          qualification_note: string | null
          response: string | null
          scope_item_id: string
        }
        Insert: {
          bid_submission_id: string
          cost_impact?: number | null
          created_at?: string | null
          id?: string
          qualification_note?: string | null
          response?: string | null
          scope_item_id: string
        }
        Update: {
          bid_submission_id?: string
          cost_impact?: number | null
          created_at?: string | null
          id?: string
          qualification_note?: string | null
          response?: string | null
          scope_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "precon_bid_scope_responses_bid_submission_id_fkey"
            columns: ["bid_submission_id"]
            isOneToOne: false
            referencedRelation: "precon_bid_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precon_bid_scope_responses_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "precon_scope_items"
            referencedColumns: ["id"]
          },
        ]
      }
      precon_bid_submissions: {
        Row: {
          alternate_amounts: Json | null
          bid_amount: number
          bid_package_id: string
          bidder_company: string | null
          bidder_name: string
          bond_included: boolean | null
          evaluation_score: number | null
          exclusions: string | null
          file_url: string | null
          id: string
          inclusions: string | null
          notes: string | null
          qualifications: string | null
          schedule_days: number | null
          status: string | null
          submitted_at: string | null
        }
        Insert: {
          alternate_amounts?: Json | null
          bid_amount: number
          bid_package_id: string
          bidder_company?: string | null
          bidder_name: string
          bond_included?: boolean | null
          evaluation_score?: number | null
          exclusions?: string | null
          file_url?: string | null
          id?: string
          inclusions?: string | null
          notes?: string | null
          qualifications?: string | null
          schedule_days?: number | null
          status?: string | null
          submitted_at?: string | null
        }
        Update: {
          alternate_amounts?: Json | null
          bid_amount?: number
          bid_package_id?: string
          bidder_company?: string | null
          bidder_name?: string
          bond_included?: boolean | null
          evaluation_score?: number | null
          exclusions?: string | null
          file_url?: string | null
          id?: string
          inclusions?: string | null
          notes?: string | null
          qualifications?: string | null
          schedule_days?: number | null
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precon_bid_submissions_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "precon_bid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      precon_scope_items: {
        Row: {
          bid_package_id: string
          category: string | null
          created_at: string | null
          description: string
          id: string
          required: boolean | null
          sort_order: number | null
        }
        Insert: {
          bid_package_id: string
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          bid_package_id?: string
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          required?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "precon_scope_items_bid_package_id_fkey"
            columns: ["bid_package_id"]
            isOneToOne: false
            referencedRelation: "precon_bid_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      precon_subcontractors: {
        Row: {
          address: string | null
          avg_bid_accuracy: number | null
          bonding_limit: number | null
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          csi_divisions: number[] | null
          email: string | null
          id: string
          insurance_verified: boolean | null
          license_number: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          prequalified: boolean | null
          prequalified_at: string | null
          primary_trade: string | null
          projects_completed: number | null
          rating: number | null
          state: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          avg_bid_accuracy?: number | null
          bonding_limit?: number | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          csi_divisions?: number[] | null
          email?: string | null
          id?: string
          insurance_verified?: boolean | null
          license_number?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          prequalified?: boolean | null
          prequalified_at?: string | null
          primary_trade?: string | null
          projects_completed?: number | null
          rating?: number | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          avg_bid_accuracy?: number | null
          bonding_limit?: number | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          csi_divisions?: number[] | null
          email?: string | null
          id?: string
          insurance_verified?: boolean | null
          license_number?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          prequalified?: boolean | null
          prequalified_at?: string | null
          primary_trade?: string | null
          projects_completed?: number | null
          rating?: number | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      prequalifications: {
        Row: {
          bonding_capacity: string | null
          company_id: string
          created_at: string
          documents: Json
          emr_rate: number | null
          expires_at: string | null
          id: string
          insurance_limits: string | null
          license_numbers: string | null
          notes: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          bonding_capacity?: string | null
          company_id: string
          created_at?: string
          documents?: Json
          emr_rate?: number | null
          expires_at?: string | null
          id?: string
          insurance_limits?: string | null
          license_numbers?: string | null
          notes?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          bonding_capacity?: string | null
          company_id?: string
          created_at?: string
          documents?: Json
          emr_rate?: number | null
          expires_at?: string | null
          id?: string
          insurance_limits?: string | null
          license_numbers?: string | null
          notes?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prequalifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prequalifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "prequalifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "prequalifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_heartbeats: {
        Row: {
          cursor_state: Json | null
          device_id: string
          id: string
          last_seen_at: string
          organization_id: string
          room_key: string
          user_id: string
          user_name: string
        }
        Insert: {
          cursor_state?: Json | null
          device_id: string
          id?: string
          last_seen_at?: string
          organization_id: string
          room_key: string
          user_id: string
          user_name: string
        }
        Update: {
          cursor_state?: Json | null
          device_id?: string
          id?: string
          last_seen_at?: string
          organization_id?: string
          room_key?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_heartbeats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      presence_room_keys: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_seen_at: string
          metadata: Json
          organization_id: string
          project_id: string | null
          room_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          metadata?: Json
          organization_id: string
          project_id?: string | null
          room_key: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          metadata?: Json
          organization_id?: string
          project_id?: string | null
          room_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_room_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_room_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "presence_room_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "presence_room_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      prevailing_wage_decisions: {
        Row: {
          apprentice_level: number | null
          base_rate: number
          county: string
          created_at: string
          effective_from: string
          effective_to: string | null
          fringe_rate: number
          id: string
          overtime_multiplier: number
          source: string
          state_code: string
          trade: string
          updated_at: string
          wage_decision_number: string | null
        }
        Insert: {
          apprentice_level?: number | null
          base_rate: number
          county: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          fringe_rate?: number
          id?: string
          overtime_multiplier?: number
          source?: string
          state_code: string
          trade: string
          updated_at?: string
          wage_decision_number?: string | null
        }
        Update: {
          apprentice_level?: number | null
          base_rate?: number
          county?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fringe_rate?: number
          id?: string
          overtime_multiplier?: number
          source?: string
          state_code?: string
          trade?: string
          updated_at?: string
          wage_decision_number?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          dashboard_preferences: Json
          first_name: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          mfa_grace_period_until: string | null
          notification_preferences: Json | null
          onboarded_at: string | null
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
          dashboard_preferences?: Json
          first_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          mfa_grace_period_until?: string | null
          notification_preferences?: Json | null
          onboarded_at?: string | null
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
          dashboard_preferences?: Json
          first_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          mfa_grace_period_until?: string | null
          notification_preferences?: Json | null
          onboarded_at?: string | null
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_detection_results_photo_pin_id_fkey"
            columns: ["photo_pin_id"]
            isOneToOne: false
            referencedRelation: "photo_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_detection_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "progress_detection_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "progress_detection_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_carbon_entries: {
        Row: {
          carbon_factor_id: string | null
          carbon_kg: number
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          project_id: string
          quantity: number
          scope: string
          source_id: string | null
          source_type: string | null
          unit: string
        }
        Insert: {
          carbon_factor_id?: string | null
          carbon_kg: number
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          project_id: string
          quantity: number
          scope: string
          source_id?: string | null
          source_type?: string | null
          unit: string
        }
        Update: {
          carbon_factor_id?: string | null
          carbon_kg?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          project_id?: string
          quantity?: number
          scope?: string
          source_id?: string | null
          source_type?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_carbon_entries_carbon_factor_id_fkey"
            columns: ["carbon_factor_id"]
            isOneToOne: false
            referencedRelation: "carbon_factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_carbon_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_carbon_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_carbon_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          label: string | null
          project_id: string | null
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          label?: string | null
          project_id?: string | null
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          label?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_holidays_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_holidays_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_holidays_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      project_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          structural_payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          structural_payload?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          structural_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          architect_contact_id: string | null
          architect_name: string | null
          auto_co_drafting_enabled: boolean
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
          is_demo: boolean
          jurisdiction: string | null
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
          site_geofence: Json | null
          start_date: string | null
          state: string | null
          status: string | null
          target_completion: string | null
          time_zone: string | null
          timezone: string
          updated_at: string | null
          weather_location_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          architect_contact_id?: string | null
          architect_name?: string | null
          auto_co_drafting_enabled?: boolean
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
          is_demo?: boolean
          jurisdiction?: string | null
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
          site_geofence?: Json | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          target_completion?: string | null
          time_zone?: string | null
          timezone?: string
          updated_at?: string | null
          weather_location_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          architect_contact_id?: string | null
          architect_name?: string | null
          auto_co_drafting_enabled?: boolean
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
          is_demo?: boolean
          jurisdiction?: string | null
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
          site_geofence?: Json | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          target_completion?: string | null
          time_zone?: string | null
          timezone?: string
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
      punch_item_comments: {
        Row: {
          author: string | null
          content: string
          created_at: string | null
          id: string
          initials: string | null
          punch_item_id: string | null
          text: string | null
          user_id: string | null
        }
        Insert: {
          author?: string | null
          content: string
          created_at?: string | null
          id?: string
          initials?: string | null
          punch_item_id?: string | null
          text?: string | null
          user_id?: string | null
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string | null
          id?: string
          initials?: string | null
          punch_item_id?: string | null
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_item_comments_punch_item_id_fkey"
            columns: ["punch_item_id"]
            isOneToOne: false
            referencedRelation: "punch_items"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_items: {
        Row: {
          after_photo_url: string | null
          area: string | null
          assigned_to: string | null
          before_photo_url: string | null
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
          rejection_reason: string | null
          reported_by: string | null
          resolved_date: string | null
          status: string | null
          sub_completed_at: string | null
          title: string
          trade: string | null
          updated_at: string | null
          updated_by: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
          verified_date: string | null
        }
        Insert: {
          after_photo_url?: string | null
          area?: string | null
          assigned_to?: string | null
          before_photo_url?: string | null
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
          rejection_reason?: string | null
          reported_by?: string | null
          resolved_date?: string | null
          status?: string | null
          sub_completed_at?: string | null
          title: string
          trade?: string | null
          updated_at?: string | null
          updated_by?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_date?: string | null
        }
        Update: {
          after_photo_url?: string | null
          area?: string | null
          assigned_to?: string | null
          before_photo_url?: string | null
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
          rejection_reason?: string | null
          reported_by?: string | null
          resolved_date?: string | null
          status?: string | null
          sub_completed_at?: string | null
          title?: string
          trade?: string | null
          updated_at?: string | null
          updated_by?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      retainage_entries: {
        Row: {
          amount_held: number
          contract_id: string
          created_at: string
          id: string
          notes: string | null
          pay_app_id: string | null
          percent_held: number | null
          project_id: string
          released_amount: number
          released_at: string | null
          released_by: string | null
          updated_at: string
        }
        Insert: {
          amount_held: number
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          pay_app_id?: string | null
          percent_held?: number | null
          project_id: string
          released_amount?: number
          released_at?: string | null
          released_by?: string | null
          updated_at?: string
        }
        Update: {
          amount_held?: number
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          pay_app_id?: string | null
          percent_held?: number | null
          project_id?: string
          released_amount?: number
          released_at?: string | null
          released_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retainage_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainage_entries_pay_app_id_fkey"
            columns: ["pay_app_id"]
            isOneToOne: false
            referencedRelation: "payment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainage_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "retainage_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "retainage_entries_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      rfi_escalations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          channel: string
          created_at: string
          id: string
          metadata: Json
          notification_queue_id: string | null
          project_id: string
          recipient_contact_id: string | null
          recipient_email: string | null
          recipient_user_id: string | null
          rfi_id: string
          stage: string
          triggered_at: string
          triggered_by: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channel: string
          created_at?: string
          id?: string
          metadata?: Json
          notification_queue_id?: string | null
          project_id: string
          recipient_contact_id?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          rfi_id: string
          stage: string
          triggered_at?: string
          triggered_by?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json
          notification_queue_id?: string | null
          project_id?: string
          recipient_contact_id?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          rfi_id?: string
          stage?: string
          triggered_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfi_escalations_notification_queue_id_fkey"
            columns: ["notification_queue_id"]
            isOneToOne: false
            referencedRelation: "notification_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfi_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "rfi_escalations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_escalations_recipient_contact_id_fkey"
            columns: ["recipient_contact_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_escalations_rfi_id_fkey"
            columns: ["rfi_id"]
            isOneToOne: false
            referencedRelation: "rfis"
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
          applicable_codes: string[] | null
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
          drawing_x: number | null
          drawing_y: number | null
          due_date: string | null
          external_ids: Json | null
          id: string
          is_auto_generated: boolean | null
          legacy_payload: Json | null
          number: number
          priority: string | null
          project_id: string
          response_due_date: string | null
          schedule_impact: string | null
          sla_paused_at: string | null
          sla_paused_by: string | null
          sla_paused_reason: string | null
          sla_total_pause_seconds: number
          source_discrepancy_id: string | null
          spec_section: string | null
          specification_id: string | null
          status: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
          void_reason: string | null
        }
        Insert: {
          applicable_codes?: string[] | null
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
          drawing_x?: number | null
          drawing_y?: number | null
          due_date?: string | null
          external_ids?: Json | null
          id?: string
          is_auto_generated?: boolean | null
          legacy_payload?: Json | null
          number?: number
          priority?: string | null
          project_id: string
          response_due_date?: string | null
          schedule_impact?: string | null
          sla_paused_at?: string | null
          sla_paused_by?: string | null
          sla_paused_reason?: string | null
          sla_total_pause_seconds?: number
          source_discrepancy_id?: string | null
          spec_section?: string | null
          specification_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
        }
        Update: {
          applicable_codes?: string[] | null
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
          drawing_x?: number | null
          drawing_y?: number | null
          due_date?: string | null
          external_ids?: Json | null
          id?: string
          is_auto_generated?: boolean | null
          legacy_payload?: Json | null
          number?: number
          priority?: string | null
          project_id?: string
          response_due_date?: string | null
          schedule_impact?: string | null
          sla_paused_at?: string | null
          sla_paused_by?: string | null
          sla_paused_reason?: string | null
          sla_total_pause_seconds?: number
          source_discrepancy_id?: string | null
          spec_section?: string | null
          specification_id?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          {
            foreignKeyName: "rfis_specification_id_fkey"
            columns: ["specification_id"]
            isOneToOne: false
            referencedRelation: "specifications"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_predictions: {
        Row: {
          created_at: string
          description: string
          factors: Json
          id: string
          impact: string
          predicted_at: string
          probability: number
          project_id: string
          recommendation: string
          risk_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          factors?: Json
          id?: string
          impact: string
          predicted_at?: string
          probability: number
          project_id: string
          recommendation?: string
          risk_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          factors?: Json
          id?: string
          impact?: string
          predicted_at?: string
          probability?: number
          project_id?: string
          recommendation?: string
          risk_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_predictions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "risk_predictions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "risk_predictions_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      safety_photo_analyses: {
        Row: {
          analyzed_at: string | null
          analyzed_by: string | null
          created_by: string | null
          id: string
          photo_url: string
          project_id: string
          safety_score: number | null
          scene_description: string | null
          summary: string | null
          violations: Json | null
        }
        Insert: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          created_by?: string | null
          id?: string
          photo_url: string
          project_id: string
          safety_score?: number | null
          scene_description?: string | null
          summary?: string | null
          violations?: Json | null
        }
        Update: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          created_by?: string | null
          id?: string
          photo_url?: string
          project_id?: string
          safety_score?: number | null
          scene_description?: string | null
          summary?: string | null
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_photo_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "safety_photo_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "safety_photo_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_import_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          filename: string | null
          finished_at: string | null
          id: string
          project_id: string
          result_json: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          filename?: string | null
          finished_at?: string | null
          id?: string
          project_id: string
          result_json?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          filename?: string | null
          finished_at?: string | null
          id?: string
          project_id?: string
          result_json?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "schedule_import_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "schedule_import_jobs_project_id_fkey"
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
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dependency_type: string | null
          depends_on: string | null
          description: string | null
          end_date: string | null
          external_ids: Json | null
          float_days: number | null
          id: string
          is_critical: boolean | null
          is_critical_path: boolean | null
          is_milestone: boolean | null
          lag_days: number | null
          legacy_payload: Json | null
          name: string
          percent_complete: number | null
          predecessor_ids: string[] | null
          project_id: string
          start_date: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          wbs: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_crew_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dependency_type?: string | null
          depends_on?: string | null
          description?: string | null
          end_date?: string | null
          external_ids?: Json | null
          float_days?: number | null
          id?: string
          is_critical?: boolean | null
          is_critical_path?: boolean | null
          is_milestone?: boolean | null
          lag_days?: number | null
          legacy_payload?: Json | null
          name: string
          percent_complete?: number | null
          predecessor_ids?: string[] | null
          project_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          wbs?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_crew_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dependency_type?: string | null
          depends_on?: string | null
          description?: string | null
          end_date?: string | null
          external_ids?: Json | null
          float_days?: number | null
          id?: string
          is_critical?: boolean | null
          is_critical_path?: boolean | null
          is_milestone?: boolean | null
          lag_days?: number | null
          legacy_payload?: Json | null
          name?: string
          percent_complete?: number | null
          predecessor_ids?: string[] | null
          project_id?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          wbs?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      schedule_recovery_events: {
        Row: {
          actions_taken: Json
          affected_phase_ids: string[]
          created_at: string
          days_slipped: number
          description: string | null
          id: string
          observed_at: string
          project_id: string
          recorded_by: string | null
          recovery_type: string
        }
        Insert: {
          actions_taken?: Json
          affected_phase_ids?: string[]
          created_at?: string
          days_slipped: number
          description?: string | null
          id?: string
          observed_at?: string
          project_id: string
          recorded_by?: string | null
          recovery_type: string
        }
        Update: {
          actions_taken?: Json
          affected_phase_ids?: string[]
          created_at?: string
          days_slipped?: number
          description?: string | null
          id?: string
          observed_at?: string
          project_id?: string
          recorded_by?: string | null
          recovery_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_recovery_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "schedule_recovery_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "schedule_recovery_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      search_index_dirty_flags: {
        Row: {
          dirty: boolean
          entity_id: string
          entity_type: string
          id: string
          marked_at: string
          organization_id: string | null
          project_id: string | null
          reindexed_at: string | null
        }
        Insert: {
          dirty?: boolean
          entity_id: string
          entity_type: string
          id?: string
          marked_at?: string
          organization_id?: string | null
          project_id?: string | null
          reindexed_at?: string | null
        }
        Update: {
          dirty?: boolean
          entity_id?: string
          entity_type?: string
          id?: string
          marked_at?: string
          organization_id?: string | null
          project_id?: string | null
          reindexed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_index_dirty_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "search_index_dirty_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "search_index_dirty_flags_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      site_check_ins: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          created_at: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          method: string
          project_id: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          method?: string
          project_id: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          method?: string
          project_id?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_check_ins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_check_ins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_check_ins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_check_ins_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workforce_members"
            referencedColumns: ["id"]
          },
        ]
      }
      site_map_pins: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          floor: string | null
          icon_color: string | null
          id: string
          label: string
          latitude: number | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          longitude: number | null
          metadata: Json | null
          photo_urls: string[] | null
          pin_type: string
          pixel_x: number | null
          pixel_y: number | null
          project_id: string
          status: string | null
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: string | null
          icon_color?: string | null
          id?: string
          label: string
          latitude?: number | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          longitude?: number | null
          metadata?: Json | null
          photo_urls?: string[] | null
          pin_type: string
          pixel_x?: number | null
          pixel_y?: number | null
          project_id: string
          status?: string | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: string | null
          icon_color?: string | null
          id?: string
          label?: string
          latitude?: number | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          longitude?: number | null
          metadata?: Json | null
          photo_urls?: string[] | null
          pin_type?: string
          pixel_x?: number | null
          pixel_y?: number | null
          project_id?: string
          status?: string | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pin_zone"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "site_map_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_map_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_map_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_map_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_map_zones: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          floor: string | null
          geojson: Json | null
          id: string
          is_active: boolean | null
          name: string
          opacity: number | null
          pixel_polygon: Json | null
          project_id: string
          updated_at: string | null
          zone_type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          opacity?: number | null
          pixel_polygon?: Json | null
          project_id: string
          updated_at?: string | null
          zone_type: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: string | null
          geojson?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          opacity?: number | null
          pixel_polygon?: Json | null
          project_id?: string
          updated_at?: string | null
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_map_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_map_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_map_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_plans: {
        Row: {
          bounds: Json | null
          created_at: string | null
          file_path: string
          file_url: string | null
          floor: string | null
          id: string
          image_height: number | null
          image_width: number | null
          is_current: boolean | null
          name: string
          project_id: string
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          bounds?: Json | null
          created_at?: string | null
          file_path: string
          file_url?: string | null
          floor?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_current?: boolean | null
          name: string
          project_id: string
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          bounds?: Json | null
          created_at?: string | null
          file_path?: string
          file_url?: string | null
          floor?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_current?: boolean | null
          name?: string
          project_id?: string
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "site_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_delivery_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          organization_id: string | null
          payload_digest: string | null
          project_id: string | null
          status: string
          status_code: number | null
          webhook_url_masked: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          organization_id?: string | null
          payload_digest?: string | null
          project_id?: string | null
          status: string
          status_code?: number | null
          webhook_url_masked?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          organization_id?: string | null
          payload_digest?: string | null
          project_id?: string | null
          status?: string
          status_code?: number | null
          webhook_url_masked?: string | null
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      sso_login_events: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          organization_id: string
          outcome: string
          protocol: string
          raw_assertion_excerpt: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          organization_id: string
          outcome: string
          protocol: string
          raw_assertion_excerpt?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string
          outcome?: string
          protocol?: string
          raw_assertion_excerpt?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_login_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      state_lien_rules: {
        Row: {
          applies_to_commercial: boolean
          applies_to_residential: boolean
          claimant_role: string
          created_at: string
          effective_from: string
          effective_to: string | null
          foreclosure_suit_days: number | null
          id: string
          lien_record_days: number
          notes: string | null
          owner_demand_days: number | null
          preliminary_notice_days: number | null
          state_code: string
          statute_citation: string | null
          updated_at: string
        }
        Insert: {
          applies_to_commercial?: boolean
          applies_to_residential?: boolean
          claimant_role: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          foreclosure_suit_days?: number | null
          id?: string
          lien_record_days: number
          notes?: string | null
          owner_demand_days?: number | null
          preliminary_notice_days?: number | null
          state_code: string
          statute_citation?: string | null
          updated_at?: string
        }
        Update: {
          applies_to_commercial?: boolean
          applies_to_residential?: boolean
          claimant_role?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          foreclosure_suit_days?: number | null
          id?: string
          lien_record_days?: number
          notes?: string | null
          owner_demand_days?: number | null
          preliminary_notice_days?: number | null
          state_code?: string
          statute_citation?: string | null
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      subcontractor_ratings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          metrics: Json
          period: string
          project_id: string | null
          project_type: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          metrics?: Json
          period: string
          project_id?: string | null
          project_type?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          period?: string
          project_id?: string | null
          project_type?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_ratings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "directory_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "subcontractor_ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "subcontractor_ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      submittal_revisions: {
        Row: {
          comments: string | null
          created_at: string | null
          file_urls: Json | null
          id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_role: string | null
          revision_number: number
          status: string | null
          submittal_id: string | null
          submitted_by: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          file_urls?: Json | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_role?: string | null
          revision_number?: number
          status?: string | null
          submittal_id?: string | null
          submitted_by?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          file_urls?: Json | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_role?: string | null
          revision_number?: number
          status?: string | null
          submittal_id?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submittal_revisions_submittal_id_fkey"
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
          attachments: Json | null
          closed_date: string | null
          created_at: string | null
          created_by: string | null
          current_reviewer: string | null
          days_in_review: number | null
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          external_ids: Json | null
          id: string
          lead_time_weeks: number | null
          legacy_payload: Json | null
          number: number
          parent_submittal_id: string | null
          project_id: string
          required_onsite_date: string | null
          revision_number: number | null
          spec_section: string | null
          specification_id: string | null
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
          attachments?: Json | null
          closed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_reviewer?: string | null
          days_in_review?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          external_ids?: Json | null
          id?: string
          lead_time_weeks?: number | null
          legacy_payload?: Json | null
          number?: number
          parent_submittal_id?: string | null
          project_id: string
          required_onsite_date?: string | null
          revision_number?: number | null
          spec_section?: string | null
          specification_id?: string | null
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
          attachments?: Json | null
          closed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_reviewer?: string | null
          days_in_review?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          external_ids?: Json | null
          id?: string
          lead_time_weeks?: number | null
          legacy_payload?: Json | null
          number?: number
          parent_submittal_id?: string | null
          project_id?: string
          required_onsite_date?: string | null
          revision_number?: number | null
          spec_section?: string | null
          specification_id?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          {
            foreignKeyName: "submittals_specification_id_fkey"
            columns: ["specification_id"]
            isOneToOne: false
            referencedRelation: "specifications"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
          activity_description: string | null
          approved: boolean | null
          approved_by: string | null
          break_minutes: number | null
          classification: string | null
          clock_in: string | null
          clock_out: string | null
          cost_code: string | null
          cost_code_id: string | null
          created_at: string | null
          daily_log_id: string | null
          date: string
          double_time_hours: number | null
          geolocation_in: Json | null
          geolocation_out: Json | null
          hours: number | null
          id: string
          overtime_hours: number | null
          project_id: string
          regular_hours: number | null
          task_description: string | null
          updated_at: string | null
          user_id: string | null
          workforce_member_id: string
        }
        Insert: {
          activity_description?: string | null
          approved?: boolean | null
          approved_by?: string | null
          break_minutes?: number | null
          classification?: string | null
          clock_in?: string | null
          clock_out?: string | null
          cost_code?: string | null
          cost_code_id?: string | null
          created_at?: string | null
          daily_log_id?: string | null
          date: string
          double_time_hours?: number | null
          geolocation_in?: Json | null
          geolocation_out?: Json | null
          hours?: number | null
          id?: string
          overtime_hours?: number | null
          project_id: string
          regular_hours?: number | null
          task_description?: string | null
          updated_at?: string | null
          user_id?: string | null
          workforce_member_id: string
        }
        Update: {
          activity_description?: string | null
          approved?: boolean | null
          approved_by?: string | null
          break_minutes?: number | null
          classification?: string | null
          clock_in?: string | null
          clock_out?: string | null
          cost_code?: string | null
          cost_code_id?: string | null
          created_at?: string | null
          daily_log_id?: string | null
          date?: string
          double_time_hours?: number | null
          geolocation_in?: Json | null
          geolocation_out?: Json | null
          hours?: number | null
          id?: string
          overtime_hours?: number | null
          project_id?: string
          regular_hours?: number | null
          task_description?: string | null
          updated_at?: string | null
          user_id?: string | null
          workforce_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      timesheets: {
        Row: {
          activity: string
          created_at: string
          hours: number
          id: string
          project_id: string
          updated_at: string
          work_date: string
          worker_id: string
        }
        Insert: {
          activity?: string
          created_at?: string
          hours: number
          id?: string
          project_id: string
          updated_at?: string
          work_date: string
          worker_id: string
        }
        Update: {
          activity?: string
          created_at?: string
          hours?: number
          id?: string
          project_id?: string
          updated_at?: string
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_worker_id_fkey"
            columns: ["worker_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          acknowledged_date: string | null
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
          responded_date: string | null
          sent_at: string | null
          sent_date: string | null
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
          acknowledged_date?: string | null
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
          responded_date?: string | null
          sent_at?: string | null
          sent_date?: string | null
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
          acknowledged_date?: string | null
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
          responded_date?: string | null
          sent_at?: string | null
          sent_date?: string | null
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      typing_indicators: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          last_seen_at: string
          project_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          last_seen_at?: string
          project_id: string
          user_id: string
          user_name: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          last_seen_at?: string
          project_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "typing_indicators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "typing_indicators_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      vendor_evaluations: {
        Row: {
          comments: string | null
          communication_score: number | null
          evaluated_at: string | null
          evaluator: string | null
          id: string
          overall_score: number | null
          project_id: string | null
          quality_score: number | null
          safety_score: number | null
          schedule_score: number | null
          vendor_id: string
        }
        Insert: {
          comments?: string | null
          communication_score?: number | null
          evaluated_at?: string | null
          evaluator?: string | null
          id?: string
          overall_score?: number | null
          project_id?: string | null
          quality_score?: number | null
          safety_score?: number | null
          schedule_score?: number | null
          vendor_id: string
        }
        Update: {
          comments?: string | null
          communication_score?: number | null
          evaluated_at?: string | null
          evaluator?: string | null
          id?: string
          overall_score?: number | null
          project_id?: string | null
          quality_score?: number | null
          safety_score?: number | null
          schedule_score?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_evaluations_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      view_refresh_metadata: {
        Row: {
          last_error: string | null
          last_refresh_completed_at: string | null
          last_refresh_duration_ms: number | null
          last_refresh_started_at: string | null
          last_refresh_status: string | null
          target_interval_seconds: number
          updated_at: string
          view_name: string
        }
        Insert: {
          last_error?: string | null
          last_refresh_completed_at?: string | null
          last_refresh_duration_ms?: number | null
          last_refresh_started_at?: string | null
          last_refresh_status?: string | null
          target_interval_seconds?: number
          updated_at?: string
          view_name: string
        }
        Update: {
          last_error?: string | null
          last_refresh_completed_at?: string | null
          last_refresh_duration_ms?: number | null
          last_refresh_started_at?: string | null
          last_refresh_status?: string | null
          target_interval_seconds?: number
          updated_at?: string
          view_name?: string
        }
        Relationships: []
      }
      walkthrough_captures: {
        Row: {
          audio_storage_path: string | null
          captured_at: string
          created_at: string
          created_via: string
          drawing_id: string | null
          drawing_x: number | null
          drawing_y: number | null
          executed_punch_item_id: string | null
          gps_lat: number | null
          gps_lon: number | null
          id: string
          parsed: Json | null
          photo_storage_path: string | null
          project_id: string
          session_id: string
          source_drafted_action_id: string | null
          status: string
          transcript: string | null
          transcript_confidence: number | null
          updated_at: string
        }
        Insert: {
          audio_storage_path?: string | null
          captured_at?: string
          created_at?: string
          created_via?: string
          drawing_id?: string | null
          drawing_x?: number | null
          drawing_y?: number | null
          executed_punch_item_id?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          id?: string
          parsed?: Json | null
          photo_storage_path?: string | null
          project_id: string
          session_id: string
          source_drafted_action_id?: string | null
          status?: string
          transcript?: string | null
          transcript_confidence?: number | null
          updated_at?: string
        }
        Update: {
          audio_storage_path?: string | null
          captured_at?: string
          created_at?: string
          created_via?: string
          drawing_id?: string | null
          drawing_x?: number | null
          drawing_y?: number | null
          executed_punch_item_id?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          id?: string
          parsed?: Json | null
          photo_storage_path?: string | null
          project_id?: string
          session_id?: string
          source_drafted_action_id?: string | null
          status?: string
          transcript?: string | null
          transcript_confidence?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "walkthrough_captures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "walkthrough_captures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "walkthrough_captures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkthrough_captures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "walkthrough_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      walkthrough_sessions: {
        Row: {
          attendees: Json
          created_at: string
          ended_at: string | null
          id: string
          pdf_content_hash: string | null
          pdf_export_url: string | null
          project_id: string
          started_at: string
          started_by_user: string
          status: string
          total_approved: number
          total_drafted: number
          total_rejected: number
          updated_at: string
        }
        Insert: {
          attendees?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          pdf_content_hash?: string | null
          pdf_export_url?: string | null
          project_id: string
          started_at?: string
          started_by_user: string
          status?: string
          total_approved?: number
          total_drafted?: number
          total_rejected?: number
          updated_at?: string
        }
        Update: {
          attendees?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          pdf_content_hash?: string | null
          pdf_export_url?: string | null
          project_id?: string
          started_at?: string
          started_by_user?: string
          status?: string
          total_approved?: number
          total_drafted?: number
          total_rejected?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "walkthrough_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "walkthrough_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "walkthrough_sessions_project_id_fkey"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
          attempt_count: number
          created_at: string
          delivered_at: string | null
          event: string
          event_type: string | null
          id: string
          last_attempt_at: string | null
          last_response_body: string | null
          last_response_status: number | null
          next_attempt_at: string | null
          organization_id: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          retry_count: number | null
          status: string
          succeeded_at: string | null
          webhook_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          event_type?: string | null
          id?: string
          last_attempt_at?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          next_attempt_at?: string | null
          organization_id?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number | null
          status?: string
          succeeded_at?: string | null
          webhook_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          event_type?: string | null
          id?: string
          last_attempt_at?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          next_attempt_at?: string | null
          organization_id?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          retry_count?: number | null
          status?: string
          succeeded_at?: string | null
          webhook_id?: string
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      workflow_definitions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          definition: Json
          entity_type: string
          id: string
          name: string
          project_id: string
          start_step: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          definition: Json
          entity_type: string
          id?: string
          name: string
          project_id: string
          start_step: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          definition?: Json
          entity_type?: string
          id?: string
          name?: string
          project_id?: string
          start_step?: string
          version?: number
        }
        Relationships: []
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      workflow_runs: {
        Row: {
          completed_at: string | null
          current_step: string
          entity_id: string
          history: Json
          id: string
          started_at: string
          workflow_definition_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step: string
          entity_id: string
          history?: Json
          id?: string
          started_at?: string
          workflow_definition_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: string
          entity_id?: string
          history?: Json
          id?: string
          started_at?: string
          workflow_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_definition_id_fkey"
            columns: ["workflow_definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      org_search_index: {
        Row: {
          body: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          organization_id: string | null
          project_id: string | null
          search_vector: unknown
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      pay_app_status_summary: {
        Row: {
          certified_count: number | null
          draft_count: number | null
          paid_count: number | null
          pending_payment_due: number | null
          project_id: string | null
          refreshed_at: string | null
          submitted_count: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
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
      project_health_summary: {
        Row: {
          approved_co_amount: number | null
          critical_punch_items: number | null
          incidents_ytd: number | null
          most_recent_daily_log: string | null
          name: string | null
          open_punch_items: number | null
          open_rfis: number | null
          organization_id: string | null
          overdue_rfis: number | null
          pending_change_orders: number | null
          pending_submittals: number | null
          project_id: string | null
          refreshed_at: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      punch_list_status_rollup: {
        Row: {
          critical_count: number | null
          in_progress_count: number | null
          open_count: number | null
          overdue_count: number | null
          project_id: string | null
          refreshed_at: string | null
          resolved_count: number | null
          total: number | null
          verified_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      rfi_kpi_rollup: {
        Row: {
          avg_response_days: number | null
          critical_open_count: number | null
          open_count: number | null
          overdue_count: number | null
          project_id: string | null
          refreshed_at: string | null
          resolved_count: number | null
          under_review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "project_health_summary"
            referencedColumns: ["project_id"]
          },
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
      check_login_lockout: {
        Args: { email_to_check: string }
        Returns: {
          attempts_allowed: number
          attempts_in_window: number
          is_locked: boolean
          unlocks_at: string
        }[]
      }
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
      iris_call_count_recent: {
        Args: { p_user_id: string; p_window_seconds: number }
        Returns: number
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
      match_document_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_project_id: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          document_name: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      record_failed_login: {
        Args: {
          email_to_record: string
          ip_hint_text?: string
          user_agent_text?: string
        }
        Returns: undefined
      }
      refresh_project_health_summary: { Args: never; Returns: undefined }
      refresh_project_metrics: { Args: never; Returns: undefined }
      reorder_tasks: {
        Args: { new_orders: number[]; task_ids: string[] }
        Returns: undefined
      }
      search_org:
        | {
            Args: {
              p_limit?: number
              p_organization_id: string
              p_query: string
              p_user_id: string
            }
            Returns: {
              body: string
              created_at: string
              entity_id: string
              entity_type: string
              organization_id: string
              project_id: string
              rank: number
              title: string
            }[]
          }
        | {
            Args: {
              p_limit?: number
              p_organization_id: string
              p_query: string
            }
            Returns: {
              body: string
              created_at: string
              entity_id: string
              entity_type: string
              project_id: string
              rank: number
              status: string
              title: string
            }[]
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
      verify_audit_chain: {
        Args: { start_after?: string }
        Returns: {
          actual_hash: string
          broken_at_id: string
          broken_at_seq: number
          expected_hash: string
        }[]
      }
      view_freshness_status: {
        Args: never
        Returns: {
          age_seconds: number
          is_stale: boolean
          refreshed_at: string
          status: string
          view_name: string
        }[]
      }
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
      change_order_cause:
        | "owner_directed_scope_change"
        | "design_error_or_omission"
        | "unforeseen_field_condition"
        | "value_engineering"
        | "allowance_adjustment"
        | "permit_or_code_change"
        | "weather_delay"
        | "subcontractor_default"
        | "material_substitution"
        | "schedule_acceleration"
        | "other"
      change_order_originator_role:
        | "owner"
        | "architect"
        | "engineer"
        | "gc"
        | "subcontractor"
        | "authority_having_jurisdiction"
        | "other"
      change_order_project_stage:
        | "pre_construction"
        | "schematic_design"
        | "design_development"
        | "construction_documents"
        | "bidding"
        | "mobilization"
        | "foundation"
        | "structure"
        | "envelope"
        | "mep_rough"
        | "finishes"
        | "commissioning"
        | "closeout"
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
      change_order_cause: [
        "owner_directed_scope_change",
        "design_error_or_omission",
        "unforeseen_field_condition",
        "value_engineering",
        "allowance_adjustment",
        "permit_or_code_change",
        "weather_delay",
        "subcontractor_default",
        "material_substitution",
        "schedule_acceleration",
        "other",
      ],
      change_order_originator_role: [
        "owner",
        "architect",
        "engineer",
        "gc",
        "subcontractor",
        "authority_having_jurisdiction",
        "other",
      ],
      change_order_project_stage: [
        "pre_construction",
        "schematic_design",
        "design_development",
        "construction_documents",
        "bidding",
        "mobilization",
        "foundation",
        "structure",
        "envelope",
        "mep_rough",
        "finishes",
        "commissioning",
        "closeout",
      ],
    },
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

// ProjectRole — canonical 15-value role enum. Defined in ./stream (locked
// contract for the homepage redesign). Re-exported here so legacy import
// sites (`from '../types/database'`) keep resolving.
export type { ProjectRole } from './stream'

// UserRole lives in ./enums — import from there directly. Re-exporting an
// enum through this type-heavy barrel breaks under verbatimModuleSyntax
// (Vite dev server fails to resolve the runtime value).
