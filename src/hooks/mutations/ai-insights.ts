import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'

import { fromTable } from '../../lib/db/queries'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── AI Insights ──────────────────────────────────────────

export function useDismissInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({ dismissed: true } as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
      } as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
