import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── AI Insights ──────────────────────────────────────────

export function useDismissInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({ dismissed: true }).eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_insights', result.projectId] })
      posthog.capture('insight_dismissed', { project_id: result.projectId })
    },
    onError: createOnError('dismiss_insight'),
  })
}

export function useActOnInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action, projectId }: { id: string; action: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({
        acted_on_at: new Date().toISOString(),
        acted_on_action: action,
      }).eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_insights', result.projectId] })
      posthog.capture('insight_acted_on', { project_id: result.projectId })
    },
    onError: createOnError('act_on_insight'),
  })
}
