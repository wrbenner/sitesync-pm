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
  closeout_items: (pid) => ['closeout_items', pid] as const,
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

    // Use a unique suffix to avoid collisions with existing subscribed channels
    // (React strict mode or multiple components using this hook)
    const uid = crypto.randomUUID().slice(0, 8)
    const channelName = `project-${projectId}-changes-${uid}`

    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase.channel(channelName)

      for (const table of CRITICAL_TABLES) {
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
      }

      channel.subscribe()
      if (process.env.NODE_ENV === 'development') {
        console.log('[Realtime] Subscribed to', channelName)
      }
    } catch (err) {
      // Defensive: if channel creation or .on() fails (e.g. duplicate channel
      // name from hot-reload race), log and continue without crashing the page.
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Realtime] Failed to subscribe, will retry on next render:', err)
      }
      if (channel) {
        try { supabase.removeChannel(channel) } catch { /* ignore */ }
      }
      return
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Realtime] Unsubscribed from', channelName)
      }
      supabase.removeChannel(channel!)
    }
  }, [projectId])
}

/**
 * Subscribe to realtime changes on a single row so two users editing the
 * same RFI / punch item / submittal / change order see each other's updates.
 *
 * @param table  Supabase table name (rfis, punch_items, submittals, change_orders)
 * @param rowId  Primary-key id of the row to subscribe to; skip when undefined
 * @param queryKeys Additional React Query keys to invalidate on any UPDATE/DELETE
 */
export function useRealtimeRowInvalidation(
  table: string,
  rowId: string | undefined,
  queryKeys: ReadonlyArray<readonly unknown[]> = [],
) {
  useEffect(() => {
    if (!rowId) return

    const uid = crypto.randomUUID().slice(0, 8)
    const channelName = `row-${table}-${rowId}-${uid}`

    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase.channel(channelName)
      channel.on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table,
          filter: `id=eq.${rowId}`,
        },
        () => {
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: key })
          }
        },
      )
      channel.subscribe()
      if (process.env.NODE_ENV === 'development') {
        console.log('[Realtime] Subscribed to', channelName)
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Realtime] Row subscription failed:', err)
      }
      if (channel) {
        try { supabase.removeChannel(channel) } catch { /* ignore */ }
      }
      return
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Realtime] Unsubscribed from', channelName)
      }
      supabase.removeChannel(channel!)
    }
    // queryKeys is intentionally omitted from deps; callers should pass a stable
    // memoized reference when they want to change the invalidation set, which
    // is very rarely needed for detail pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, rowId])
}
