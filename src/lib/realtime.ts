import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { toast } from 'sonner'
import { colors } from '../styles/theme'

// BUG-M08 FIX: Allow a React Router-aware navigate function to be registered so
// realtime toasts can use it instead of bypassing the router via
// window.location.hash. Falls back to history.pushState if no navigator was registered.
type NavigateFn = (path: string) => void
let registeredNavigate: NavigateFn | null = null
export function setRealtimeNavigator(fn: NavigateFn | null) {
  registeredNavigate = fn
}
function routerNavigate(path: string) {
  if (registeredNavigate) {
    registeredNavigate(path)
  } else if (typeof window !== 'undefined') {
    // Fallback: pushState + popstate dispatch so React Router picks it up.
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

// All tables that support real-time project-scoped updates
const PROJECT_TABLES = [
  'rfis', 'rfi_responses', 'submittals', 'submittal_approvals',
  'punch_items', 'tasks', 'daily_logs', 'daily_log_entries',
  'activity_feed', 'crews', 'change_orders', 'budget_items',
  'drawings', 'files', 'field_captures', 'meetings',
  'schedule_phases', 'ai_insights', 'ai_agent_actions',
  'directory_contacts', 'safety_inspections', 'incidents',
  'corrective_actions',
] as const

// Friendly names for toast messages
const TABLE_LABELS: Partial<Record<string, string>> = {
  rfis: 'RFI',
  submittals: 'Submittal',
  tasks: 'Task',
  punch_items: 'Punch Item',
  daily_logs: 'Daily Log',
  change_orders: 'Change Order',
  meetings: 'Meeting',
  drawings: 'Drawing',
  files: 'File',
  crews: 'Crew',
  safety_inspections: 'Safety Inspection',
}

const EVENT_LABELS: Record<string, string> = {
  INSERT: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
}

// ── Project data subscriptions ─────────────────────────────

export function subscribeToProject(projectId: string, currentUserId?: string) {
  const channels: ReturnType<typeof supabase.channel>[] = []

  for (const table of PROJECT_TABLES) {
    const channel = supabase
      .channel(`${table}_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        // Invalidate the relevant query cache
        queryClient.invalidateQueries({ queryKey: [table, projectId] })

        // For key tables, also invalidate related queries
        if (table === 'rfi_responses') {
          queryClient.invalidateQueries({ queryKey: ['rfis', projectId] })
        }
        if (table === 'daily_log_entries') {
          queryClient.invalidateQueries({ queryKey: ['daily_logs', projectId] })
        }
        if (table === 'submittal_approvals') {
          queryClient.invalidateQueries({ queryKey: ['submittals', projectId] })
        }

        // Show toast for changes made by other users
        const record = (payload.new || payload.old) as Record<string, unknown> | null
        const friendlyName = TABLE_LABELS[table]
        const eventLabel = EVENT_LABELS[payload.eventType]

        // Don't toast for changes the current user made (they already see them)
        if (record && friendlyName && eventLabel) {
          const changedBy = record.created_by || record.submitted_by || record.assigned_to
          if (changedBy && changedBy !== currentUserId) {
            const title = (record.title || record.name || record.number || '') as string
            const label = title ? `${friendlyName} ${eventLabel}: ${title}` : `${friendlyName} ${eventLabel}`
            const link = (record.id as string) ? `/${table.replace('_', '-')}` : undefined
            toast.info(label, {
              action: link ? { label: 'View', onClick: () => { routerNavigate(link) } } : undefined,
              duration: 4000,
            })
          }
        }
      })
      .subscribe()
    channels.push(channel)
  }

  return () => {
    channels.forEach((ch) => supabase.removeChannel(ch))
  }
}

// ── Notification subscriptions ─────────────────────────────

export function subscribeToNotifications(userId: string) {
  const channel = supabase
    .channel(`notifications_${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })

      const notification = payload.new as Record<string, unknown>

      // Show desktop notification if permission granted
      if (notification && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('SiteSync PM', {
          body: (notification.title as string) || 'New notification',
          icon: '/sitesync-pm/icon-192.svg',
        })
      }

      // Show in-app toast with click-through
      if (notification?.title) {
        const link = notification.link as string | undefined
        toast.info(notification.title as string, {
          description: (notification.body as string) || undefined,
          action: link ? { label: 'View', onClick: () => { routerNavigate(link) } } : undefined,
          duration: 6000,
        })
      }
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ── Presence tracking ──────────────────────────────────────

export interface PresenceUser {
  userId: string
  name: string
  displayName: string
  role?: string
  initials: string
  color: string
  page: string
  entityId?: string
  action?: 'viewing' | 'editing'
  editingEntityType?: string
  editingEntityId?: string
  editingSince?: number
  lastSeen: number
}

const PRESENCE_COLORS = [
  colors.statusInfo, colors.statusActive, colors.statusPending, colors.statusReview, colors.statusCritical,
  colors.chartCyan, colors.primaryOrange, colors.brand800, colors.chartRed, colors.indigo,
]

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash) + userId.charCodeAt(i)
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

let presenceChannel: ReturnType<typeof supabase.channel> | null = null
let onPresenceChange: ((users: PresenceUser[]) => void) | null = null

export function subscribeToPresence(
  projectId: string,
  userId: string,
  userName: string,
  userInitials: string,
  currentPage: string,
  onChange: (users: PresenceUser[]) => void,
  userRole?: string,
  userDisplayName?: string,
) {
  onPresenceChange = onChange

  // Clean up existing channel
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel)
  }

  presenceChannel = supabase.channel(`presence_${projectId}`, {
    config: { presence: { key: userId } },
  })

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel!.presenceState()
      const users: PresenceUser[] = []

      for (const [key, presences] of Object.entries(state)) {
        if (key === userId) continue // Skip self
        const latest = (presences as Array<{ editingSince?: number; action?: string; name?: string; displayName?: string; role?: string; initials?: string; page?: string; editingEntity?: string }>)[0]
        if (latest) {
          // Release stale editing locks (30 second timeout)
          const editingSince = latest.editingSince as number | undefined
          const isStaleEdit = editingSince && (Date.now() - editingSince > 30_000)
          const action = (latest.action === 'editing' && !isStaleEdit) ? 'editing' as const : 'viewing' as const

          users.push({
            userId: key,
            name: latest.name || 'Unknown',
            displayName: latest.displayName || latest.name || 'Unknown',
            role: latest.role,
            initials: latest.initials || '??',
            color: getUserColor(key),
            page: latest.page || 'dashboard',
            entityId: latest.entityId,
            action,
            editingEntityType: action === 'editing' ? latest.editingEntityType : undefined,
            editingEntityId: action === 'editing' ? latest.editingEntityId : undefined,
            editingSince: action === 'editing' ? editingSince : undefined,
            lastSeen: latest.lastSeen || Date.now(),
          })
        }
      }

      onPresenceChange?.(users)
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel!.track({
          name: userName,
          displayName: userDisplayName || userName,
          role: userRole,
          initials: userInitials,
          page: currentPage,
          lastSeen: Date.now(),
        })
      }
    })

  return () => {
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel)
      presenceChannel = null
    }
    onPresenceChange = null
  }
}

export function updatePresencePage(page: string, entityId?: string) {
  if (presenceChannel) {
    presenceChannel.track({
      page,
      entityId,
      action: 'viewing',
      lastSeen: Date.now(),
    }).catch(() => {}) // Ignore errors on presence update
  }
}

/** Broadcast that current user started editing an entity */
export function broadcastEditingStart(entityType: string, entityId: string) {
  if (presenceChannel) {
    presenceChannel.track({
      action: 'editing',
      editingEntityType: entityType,
      editingEntityId: entityId,
      editingSince: Date.now(),
      lastSeen: Date.now(),
    }).catch(() => {})
  }
}

/** Broadcast that current user stopped editing */
export function broadcastEditingStop() {
  if (presenceChannel) {
    presenceChannel.track({
      action: 'viewing',
      editingEntityType: undefined,
      editingEntityId: undefined,
      editingSince: undefined,
      lastSeen: Date.now(),
    }).catch(() => {})
  }
}

// Request desktop notification permission
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}
