import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Workflow Rules ─────────────────────────────────────

export interface WorkflowCondition {
  field: string
  operator: string
  value: string
}

export interface WorkflowAction {
  type: 'assign_user' | 'change_status' | 'send_notification' | 'create_task' | 'add_tag'
  params: Record<string, unknown>
}

export interface WorkflowRule {
  id: string
  project_id: string
  name: string
  description: string | null
  trigger_event: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  is_active: boolean
  execution_count: number
  last_executed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useWorkflowRules(projectId: string | undefined) {
  return useQuery({
    queryKey: ['workflow_rules', projectId],
    queryFn: async (): Promise<WorkflowRule[]> => {
      const { data, error } = await from('workflow_rules')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as WorkflowRule[]
    },
    enabled: !!projectId,
  })
}

export interface CreateWorkflowRuleInput {
  project_id: string
  name: string
  description?: string | null
  trigger_event: string
  conditions?: WorkflowCondition[]
  actions?: WorkflowAction[]
  is_active?: boolean
  created_by?: string | null
}

export function useCreateWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateWorkflowRuleInput) => {
      const { data, error } = await from('workflow_rules')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as unknown as WorkflowRule
    },
    onSuccess: (_data: unknown, variables: CreateWorkflowRuleInput) => {
      queryClient.invalidateQueries({ queryKey: ['workflow_rules', variables.project_id] })
    },
  })
}

export interface UpdateWorkflowRuleInput {
  id: string
  projectId: string
  updates: Partial<Omit<WorkflowRule, 'id' | 'project_id' | 'created_at' | 'created_by'>>
}

export function useUpdateWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: UpdateWorkflowRuleInput) => {
      const { data, error } = await from('workflow_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as WorkflowRule
    },
    onSuccess: (_data: unknown, variables: UpdateWorkflowRuleInput) => {
      queryClient.invalidateQueries({ queryKey: ['workflow_rules', variables.projectId] })
    },
  })
}

export function useToggleWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active, projectId }: { id: string; is_active: boolean; projectId: string }) => {
      const { data, error } = await from('workflow_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { data, projectId }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow_rules', variables.projectId] })
    },
  })
}

export function useDeleteWorkflowRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('workflow_rules').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow_rules', variables.projectId] })
    },
  })
}
