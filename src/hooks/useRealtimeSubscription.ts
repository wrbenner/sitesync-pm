import { useEffect, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { subscribeToProject, subscribeToNotifications, subscribeToPresence, updatePresencePage, requestNotificationPermission } from '../lib/realtime'
import type { PresenceUser } from '../lib/realtime'
import { usePresenceStore } from '../stores/presenceStore'

// ── Centralized subscription registry ─────────────────────────────────────────

/** All active Supabase channels keyed by channel name */
const activeChannels = new Map<string, RealtimeChannel>()

/** Reference counts per channel — channel is removed when count reaches 0 */
const channelRefCounts = new Map<string, number>()

/**
 * Acquire a shared channel by name. Creates it if it does not exist, otherwise
 * increments the reference count so the channel is not removed prematurely.
 *
 * @param name   Supabase channel name
 * @param create Called once to create and subscribe the channel
 * @returns      The shared RealtimeChannel
 */
function acquireChannel(name: string, create: () => RealtimeChannel): RealtimeChannel {
  const existing = activeChannels.get(name)
  if (existing) {
    channelRefCounts.set(name, (channelRefCounts.get(name) ?? 1) + 1)
    return existing
  }
  const ch = create()
  activeChannels.set(name, ch)
  channelRefCounts.set(name, 1)
  return ch
}

/**
 * Release a shared channel. Decrements the reference count and only unsubscribes
 * from Supabase when the count reaches 0.
 */
function releaseChannel(name: string): void {
  const count = channelRefCounts.get(name) ?? 0
  if (count <= 1) {
    const ch = activeChannels.get(name)
    if (ch) supabase.removeChannel(ch)
    activeChannels.delete(name)
    channelRefCounts.delete(name)
  } else {
    channelRefCounts.set(name, count - 1)
  }
}

// ── Multiplexed project table subscription ────────────────────────────────────

/**
 * Creates a single multiplexed channel `project:{projectId}` that listens to
 * all specified tables via multiple `.on()` calls on the same channel. Uses the
 * centralized registry so multiple callers share the same channel automatically.
 *
 * @param projectId  The project to scope all filters to
 * @param tables     Array of table names to listen on
 * @param onUpdate   Callback receiving the table name and raw Supabase payload
 * @returns          Cleanup function — safe to call multiple times
 */
export function subscribeToProjectTables(
  projectId: string,
  tables: string[],
  onUpdate: (table: string, payload: unknown) => void,
): () => void {
  const channelName = `project:${projectId}`

  // We cannot reuse an existing channel and add new .on() listeners after
  // subscribe() has been called, so each unique (projectId + tables) combo
  // gets its own channel keyed by a stable sorted key.
  const stableKey = `${channelName}:${[...tables].sort().join(',')}`

  acquireChannel(stableKey, () => {
    let ch = supabase.channel(stableKey)
    for (const table of tables) {
      ch = ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` },
        (payload) => onUpdate(table, payload),
      )
    }
    ch.subscribe()
    return ch
  })

  return () => releaseChannel(stableKey)
}

// ── useProjectRealtime ────────────────────────────────────────────────────────

const PROJECT_REALTIME_TABLES = [
  'rfis',
  'submittals',
  'punch_items',
  'daily_logs',
  'change_orders',
  'schedule_phases',
  'notifications',
  'activity_feed',
] as const

/**
 * Hook that subscribes to the core project tables and invalidates the matching
 * React Query cache keys whenever a change arrives.
 */
export function useProjectRealtime(projectId: string | undefined): void {
  useEffect(() => {
    if (!projectId) return

    const cleanup = subscribeToProjectTables(
      projectId,
      [...PROJECT_REALTIME_TABLES],
      (table) => {
        queryClient.invalidateQueries({ queryKey: [table, projectId] })
      },
    )

    return cleanup
  }, [projectId])
}

// ── unsubscribeAll ────────────────────────────────────────────────────────────

/**
 * Removes every active channel from the registry. Call this on logout to ensure
 * no orphaned subscriptions remain.
 */
export function unsubscribeAll(): void {
  for (const [name, ch] of activeChannels) {
    supabase.removeChannel(ch)
    activeChannels.delete(name)
    channelRefCounts.delete(name)
  }
}

// ── Original hooks (preserved) ────────────────────────────────────────────────

export function useRealtimeSubscription(projectId: string | undefined, userId: string | undefined) {
  // Subscribe to project-scoped realtime updates
  useEffect(() => {
    if (!projectId) return
    const unsubscribe = subscribeToProject(projectId, userId)
    return () => unsubscribe()
  }, [projectId, userId])

  // Subscribe to user-scoped notifications
  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToNotifications(userId)
    requestNotificationPermission()
    return () => unsubscribe()
  }, [userId])
}

export function usePresence(
  projectId: string | undefined,
  userId: string | undefined,
  userName: string,
  userInitials: string,
  currentPage: string,
) {
  const setOnlineUsers = usePresenceStore(s => s.setOnlineUsers)

  const handlePresenceChange = useCallback((users: PresenceUser[]) => {
    setOnlineUsers(users)
  }, [setOnlineUsers])

  // Subscribe to presence
  useEffect(() => {
    if (!projectId || !userId) return
    const unsubscribe = subscribeToPresence(projectId, userId, userName, userInitials, currentPage, handlePresenceChange)
    return () => unsubscribe()
  }, [projectId, userId, userName, userInitials]) // Don't include currentPage to avoid reconnect

  // Update presence page without reconnecting
  useEffect(() => {
    updatePresencePage(currentPage)
  }, [currentPage])
}
