// Real-time query hook: TanStack React Query + Supabase Realtime.
// Auto-invalidates cache when other users modify data in the same project.
// Shows toast notifications for changes by other users.
// Includes entity-level presence tracking for conflict prevention.

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { supabase, fromTable } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useProjectId } from './useProjectId'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  rfis: 'RFI', submittals: 'Submittal', tasks: 'Task',
  punch_items: 'Punch Item', daily_logs: 'Daily Log',
  change_orders: 'Change Order', meetings: 'Meeting',
  drawings: 'Drawing', files: 'File', crews: 'Crew',
  budget_items: 'Budget Item', schedule_phases: 'Schedule Phase',
  directory_contacts: 'Contact', field_captures: 'Field Capture',
  safety_inspections: 'Inspection', incidents: 'Incident',
  corrective_actions: 'Corrective Action',
}

const EVENT_LABELS: Record<string, string> = {
  INSERT: 'created',
  UPDATE: 'updated',
  DELETE: 'removed',
}

// Batch invalidation: don't spam refetches on rapid changes
const INVALIDATION_DEBOUNCE_MS = 300

// ── Main Hook ────────────────────────────────────────────

interface RealtimeQueryOptions<T> {
  // The Supabase table name to subscribe to
  table: string
  // Additional tables that should trigger refetch (e.g., 'rfi_responses' for RFIs)
  relatedTables?: string[]
  // TanStack Query options
  queryOptions?: Omit<UseQueryOptions<T[], Error>, 'queryKey' | 'queryFn'>
  // Show toast when other users make changes (default: true)
  showToasts?: boolean
}

export function useRealtimeQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T[]>,
  options: RealtimeQueryOptions<T>
) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const projectId = useProjectId()
  const currentUserId = user?.id
  const pendingInvalidation = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: !!projectId,
    ...options.queryOptions,
  })

  useEffect(() => {
    if (!projectId) return

    const tables = [options.table, ...(options.relatedTables ?? [])]
    const channels: ReturnType<typeof supabase.channel>[] = []

    for (const table of tables) {
      const channelName = `rt_${table}_${projectId}_${queryKey.join('_')}`

      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: `project_id=eq.${projectId}`,
        }, (payload) => {
          // Debounce invalidation: rapid changes (bulk updates, template apply) shouldn't cause N refetches
          if (pendingInvalidation.current) {
            clearTimeout(pendingInvalidation.current)
          }
          pendingInvalidation.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey })
            pendingInvalidation.current = null
          }, INVALIDATION_DEBOUNCE_MS)

          // Toast for changes by OTHER users
          if (options.showToasts !== false) {
            const record = (payload.new || payload.old) as Record<string, unknown> | null
            const changedBy = record?.updated_by ?? record?.created_by ?? record?.submitted_by
            if (changedBy && changedBy !== currentUserId) {
              const label = TABLE_LABELS[table] ?? table
              const event = EVENT_LABELS[payload.eventType] ?? 'changed'
              const title = (record?.title ?? record?.name ?? record?.number ?? '') as string
              const msg = title ? `${label} ${event}: ${title}` : `${label} ${event}`
              toast.info(msg, { duration: 3000 })
            }
          }
        })
        .subscribe()

      channels.push(channel)
    }

    return () => {
      if (pendingInvalidation.current) {
        clearTimeout(pendingInvalidation.current)
      }
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [projectId, options.table, queryKey[0]]) // Re-subscribe when table or primary key changes

  return query
}

// ── Entity Presence Hook ─────────────────────────────────

// Track which entity a user is viewing/editing. Other users see this via the presence store.

import { updatePresencePage } from '../lib/realtime'

export function useEntityPresence(page: string, entityId?: string) {
  const prevEntityRef = useRef<string | undefined>()

  useEffect(() => {
    if (prevEntityRef.current !== entityId) {
      updatePresencePage(page, entityId)
      prevEntityRef.current = entityId
    }
  }, [page, entityId])
}

// ── Optimistic Locking Hook ──────────────────────────────

// Check if an entity was modified since we loaded it.
// Returns { isStale, serverUpdatedAt } for conflict detection.

export function useOptimisticLock(
  table: string,
  entityId: string | undefined,
  loadedUpdatedAt: string | undefined
) {
  const checkResult = useQuery({
    queryKey: ['optimistic_lock', table, entityId],
    queryFn: async () => {
      if (!entityId) return null
      const { data, error } = await fromTable(table)
        .select('updated_at')
        .eq('id', entityId)
        .single()
      if (error) return null
      return (data as Record<string, unknown>)?.updated_at as string | null
    },
    enabled: !!entityId && !!loadedUpdatedAt,
    refetchInterval: 10_000, // Check every 10 seconds while editing
    staleTime: 5_000,
  })

  const serverUpdatedAt = checkResult.data ?? null
  const isStale = !!(
    loadedUpdatedAt &&
    serverUpdatedAt &&
    new Date(serverUpdatedAt).getTime() > new Date(loadedUpdatedAt).getTime()
  )

  return { isStale, serverUpdatedAt }
}
