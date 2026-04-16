import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { queryKeys } from '../api/queryKeys'
import { useProjectId } from './useProjectId'

// Map table names to their query key invalidation targets
const TABLE_TO_QUERY_KEYS: Record<string, (projectId: string) => readonly unknown[]> = {
  rfis: (pid) => queryKeys.rfis.all(pid),
  submittals: (pid) => queryKeys.submittals.all(pid),
  change_orders: (pid) => queryKeys.changeOrders.all(pid),
  budget_items: (pid) => queryKeys.budgetItems.all(pid),
  daily_logs: (pid) => queryKeys.dailyLogs.all(pid),
  punch_items: (pid) => queryKeys.punchItems.all(pid),
  tasks: (pid) => queryKeys.tasks.all(pid),
  schedule_phases: (pid) => queryKeys.schedulePhases.all(pid),
  crews: (pid) => queryKeys.crews.all(pid),
  meetings: (pid) => queryKeys.meetings.all(pid),
  activity_feed: (pid) => queryKeys.activityFeed.all(pid),
  ai_insights: (pid) => queryKeys.aiInsights.all(pid),
  drawings: (pid) => queryKeys.drawings.all(pid),
  files: (pid) => queryKeys.files.all(pid),
  directory_contacts: (pid) => queryKeys.directoryContacts.all(pid),
  field_captures: (pid) => queryKeys.fieldCaptures.all(pid),
}

const CRITICAL_TABLES = Object.keys(TABLE_TO_QUERY_KEYS)

/**
 * Subscribe to Supabase realtime changes scoped to the active project.
 *
 * @param activeProjectId - Explicit project ID to scope subscriptions to.
 *   When omitted, falls back to the value from `useProjectId()`. Passing it
 *   explicitly from the call site makes the per-project scoping visible and
 *   ensures the subscription is immediately torn down when the user switches
 *   projects rather than waiting for the context to propagate.
 */
export function useRealtimeInvalidation(activeProjectId?: string) {
  const ctxProjectId = useProjectId()
  const projectId = activeProjectId ?? ctxProjectId

  useEffect(() => {
    if (!projectId) return

    const channelName = `project-${projectId}-changes`
    const channel = supabase.channel(channelName)

    CRITICAL_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table,
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          const keyFn = TABLE_TO_QUERY_KEYS[table]
          if (keyFn) {
            queryClient.invalidateQueries({ queryKey: keyFn(projectId) })
          }
          // Invalidate project metrics and activity feed on any change
          queryClient.invalidateQueries({ queryKey: queryKeys.metrics.project(projectId) })
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all(projectId) })
        },
      )
    })

    channel.subscribe()
    if (process.env.NODE_ENV === 'development') {
      console.log('[Realtime] Subscribed to', channelName)
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Realtime] Unsubscribed from', channelName)
      }
      supabase.removeChannel(channel)
    }
  }, [projectId])
}
