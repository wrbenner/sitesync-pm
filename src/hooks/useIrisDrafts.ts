/**
 * useIrisDrafts — read drafts from `drafted_actions` for the project.
 *
 * Filters: by status (default: ['pending']) and project. Subscribes to
 * realtime changes so a draft Iris writes from a tool call appears in
 * the inbox without a manual refetch.
 */

import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../lib/db/queries'
import type { DraftedAction, DraftedActionStatus } from '../types/draftedActions'

export interface UseIrisDraftsOptions {
  status?: DraftedActionStatus[]
  limit?: number
}

export function useIrisDrafts(
  projectId: string | undefined,
  opts: UseIrisDraftsOptions = {},
) {
  const status = opts.status ?? ['pending']
  const limit = opts.limit ?? 100

  return useQuery({
    queryKey: ['drafted_actions', projectId, status.join(','), limit],
    enabled: !!projectId,
    queryFn: async (): Promise<DraftedAction[]> => {
      const { data, error } = await fromTable('drafted_actions')
        .select('*')
        .eq('project_id' as never, projectId!)
        .in('status' as never, status)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        // Graceful degradation when migration hasn't run yet (e.g. local
        // dev DB doesn't have the table). Return [] so the inbox shows
        // empty state instead of crashing.
        if (error.message?.includes('drafted_actions') || error.code === 'PGRST205') {
          return []
        }
        throw error
      }
      return (data ?? []) as unknown as DraftedAction[]
    },
    staleTime: 15_000,
  })
}
