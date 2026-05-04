import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'

import { fromTable } from '../../lib/db/queries'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Activity Feed ─────────────────────────────────────────

export function useCreateActivityFeedItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('activity_feed').insert(params.data as never).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['activity_feed', result.projectId] })
      posthog.capture('activity_created', { project_id: result.projectId })
    },
    onError: createOnError('create_activity_feed_item'),
  })
}
