import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── AI Agents ────────────────────────────────────────────

export function useApproveAgentAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId, userId }: { id: string; projectId: string; userId: string }) => {
      const { error } = await from('ai_agent_actions').update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        applied: true,
        applied_at: new Date().toISOString(),
      }).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agent_actions', result.projectId] })
      posthog.capture('agent_action_approved', { project_id: result.projectId })
    },
    onError: createOnError('approve_agent_action'),
  })
}

export function useRejectAgentAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId, userId }: { id: string; projectId: string; userId: string }) => {
      const { error } = await from('ai_agent_actions').update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      }).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agent_actions', result.projectId] })
      posthog.capture('agent_action_rejected', { project_id: result.projectId })
    },
    onError: createOnError('reject_agent_action'),
  })
}

export function useUpdateAgentConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates, projectId }: { id: string; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('ai_agents').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agents', result.projectId] })
      posthog.capture('agent_config_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_agent_config'),
  })
}

export function useRunAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentType, projectId }: { agentType: string; projectId: string }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) throw new Error('Supabase not configured')

      const response = await fetch(`${supabaseUrl}/functions/v1/agent-runner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_type: agentType, project_id: projectId, trigger: 'manual' }),
      })
      if (!response.ok) throw new Error('Agent execution failed')
      return await response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agents', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['ai_agent_actions', variables.projectId] })
      posthog.capture('agent_run_manual', { agent_type: _data?.agent_type, project_id: variables.projectId })
    },
    onError: createOnError('run_agent'),
  })
}
