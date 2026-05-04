// Realtime-enabled query hooks.
// Each wraps the corresponding standard query with a Supabase Realtime subscription.
// Use these in page components instead of the base hooks for live-updating lists.

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { useRealtimeQuery } from '../useRealtimeQuery'
import { queryKeys } from '../../api/queryKeys'
import { useToast } from '../../components/Primitives'
import { getActivityFeed } from '../../api/endpoints/activity'
import type {
  RFI, Submittal, PunchItem, Task, Drawing, DailyLog,
  Crew, BudgetItem, ChangeOrder, Meeting, DirectoryContact,
  FileRecord, FieldCapture, SchedulePhase,
} from '../../types/database'
import type { ActivityFeedItem } from '../../types/entities'

// ── RFIs ─────────────────────────────────────────────────

export function useRealtimeRFIs(projectId: string | undefined) {
  return useRealtimeQuery<RFI>(
    ['rfis', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('rfis').select('*').eq('project_id' as never, projectId).order('number', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as RFI[]
    },
    { table: 'rfis', relatedTables: ['rfi_responses'] }
  )
}

// ── Submittals ───────────────────────────────────────────

export function useRealtimeSubmittals(projectId: string | undefined) {
  return useRealtimeQuery<Submittal>(
    ['submittals', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('submittals').select('*').eq('project_id' as never, projectId).order('number', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Submittal[]
    },
    { table: 'submittals', relatedTables: ['submittal_approvals'] }
  )
}

// ── Punch Items ──────────────────────────────────────────

export function useRealtimePunchItems(projectId: string | undefined) {
  return useRealtimeQuery<PunchItem>(
    ['punch_items', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('punch_items').select('*').eq('project_id' as never, projectId).order('item_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as PunchItem[]
    },
    { table: 'punch_items' }
  )
}

// ── Tasks ────────────────────────────────────────────────

export function useRealtimeTasks(projectId: string | undefined) {
  return useRealtimeQuery<Task>(
    ['tasks', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('tasks').select('*').eq('project_id' as never, projectId).order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Task[]
    },
    { table: 'tasks' }
  )
}

// ── Daily Logs ───────────────────────────────────────────

export function useRealtimeDailyLogs(projectId: string | undefined) {
  return useRealtimeQuery<DailyLog>(
    ['daily_logs', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('daily_logs').select('*').eq('project_id' as never, projectId).order('log_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DailyLog[]
    },
    { table: 'daily_logs', relatedTables: ['daily_log_entries'] }
  )
}

// ── Budget Items ─────────────────────────────────────────

export function useRealtimeBudgetItems(projectId: string | undefined) {
  return useRealtimeQuery<BudgetItem>(
    ['budget_items', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('budget_items').select('*').eq('project_id' as never, projectId).order('division')
      if (error) throw error
      return (data ?? []) as unknown as BudgetItem[]
    },
    { table: 'budget_items' }
  )
}

// ── Change Orders ────────────────────────────────────────

export function useRealtimeChangeOrders(projectId: string | undefined) {
  return useRealtimeQuery<ChangeOrder>(
    ['change_orders', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('change_orders').select('*').eq('project_id' as never, projectId).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ChangeOrder[]
    },
    { table: 'change_orders' }
  )
}

// ── Meetings ─────────────────────────────────────────────

export function useRealtimeMeetings(projectId: string | undefined) {
  return useRealtimeQuery<Meeting>(
    ['meetings', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('meetings').select('*').eq('project_id' as never, projectId).order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Meeting[]
    },
    { table: 'meetings' }
  )
}

// ── Drawings ─────────────────────────────────────────────

export function useRealtimeDrawings(projectId: string | undefined) {
  return useRealtimeQuery<Drawing>(
    ['drawings', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('drawings').select('*').eq('project_id' as never, projectId).order('sheet_number')
      if (error) throw error
      return (data ?? []) as unknown as Drawing[]
    },
    { table: 'drawings' }
  )
}

// ── Files ────────────────────────────────────────────────

export function useRealtimeFiles(projectId: string | undefined, folder?: string | null) {
  const queryKey = folder ? ['files', projectId, folder] : ['files', projectId]
  return useRealtimeQuery<FileRecord>(
    queryKey,
    async () => {
      if (!projectId) return []
      let query = fromTable('files').select('*').eq('project_id' as never, projectId)
      if (folder) query = query.eq('folder' as never, folder)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as FileRecord[]
    },
    { table: 'files' }
  )
}

// ── Directory Contacts ───────────────────────────────────

export function useRealtimeDirectoryContacts(projectId: string | undefined) {
  return useRealtimeQuery<DirectoryContact>(
    ['directory_contacts', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('directory_contacts').select('*').eq('project_id' as never, projectId).order('name')
      if (error) throw error
      return (data ?? []) as unknown as DirectoryContact[]
    },
    { table: 'directory_contacts' }
  )
}

// ── Crews ────────────────────────────────────────────────

export function useRealtimeCrews(projectId: string | undefined) {
  return useRealtimeQuery<Crew>(
    ['crews', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('crews').select('*').eq('project_id' as never, projectId).order('name')
      if (error) throw error
      return (data ?? []) as unknown as Crew[]
    },
    { table: 'crews' }
  )
}

// ── Schedule Phases ──────────────────────────────────────
// Custom subscription hook (not useRealtimeQuery) so we can:
//   - Expose isSubscribed for the Live indicator
//   - Show a conflict toast when a dirty (in-edit) phase receives an external UPDATE
//   - Optimistically remove phases from cache on DELETE

export function useRealtimeSchedulePhases(
  projectId: string,
  dirtyPhaseIds: ReadonlySet<string> = new Set()
): { isSubscribed: boolean } {
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Refs so the channel handler always sees the latest values without re-subscribing
  const dirtyRef = useRef<ReadonlySet<string>>(dirtyPhaseIds)
  const addToastRef = useRef(addToast)
  useEffect(() => { dirtyRef.current = dirtyPhaseIds })
  useEffect(() => { addToastRef.current = addToast })

  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel(`rt_schedule_phases_${projectId}`)
      .on<SchedulePhase>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_phases', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })

            if (payload.eventType === 'UPDATE') {
              const updatedId = payload.new.id
              if (updatedId && dirtyRef.current.has(updatedId)) {
                addToastRef.current(
                  'warning',
                  'This activity was updated by another user. Reload to see changes.',
                  { label: 'Reload', onClick: () => queryClient.invalidateQueries({ queryKey: ['schedule', projectId] }) }
                )
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            if (deletedId) {
              queryClient.setQueryData<SchedulePhase[]>(
                ['schedule', projectId],
                (prev) => prev?.filter((p) => p.id !== deletedId) ?? []
              )
            }
          }
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setIsSubscribed(false)
    }
  }, [projectId, queryClient])

  return { isSubscribed }
}

// ── Field Captures ───────────────────────────────────────

export function useRealtimeFieldCaptures(projectId: string | undefined) {
  return useRealtimeQuery<FieldCapture>(
    ['field_captures', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await fromTable('field_captures').select('*').eq('project_id' as never, projectId).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as FieldCapture[]
    },
    { table: 'field_captures' }
  )
}

// ── Budget Realtime ──────────────────────────────────────
// Subscribes to budget_items, change_orders, and invoices_payable for a project.
// Invalidates all relevant query keys on any INSERT/UPDATE/DELETE and returns
// a brief isFlashing flag for metric card pulse indicators.

const BUDGET_DEBOUNCE_MS = 300
const BUDGET_FLASH_DURATION_MS = 1200

export function useBudgetRealtime(projectId: string | undefined): { isFlashing: boolean } {
  const queryClient = useQueryClient()
  const [isFlashing, setIsFlashing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!projectId) return

    const handleChange = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        // Invalidate the composite costData query key used by Budget.tsx
        queryClient.invalidateQueries({ queryKey: [`costData-${projectId}`] })
        // Also invalidate individual table keys used by other consumers
        queryClient.invalidateQueries({ queryKey: queryKeys.budgetItems.all(projectId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.changeOrders.all(projectId) })
        debounceRef.current = null

        setIsFlashing(true)
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        flashTimerRef.current = setTimeout(() => setIsFlashing(false), BUDGET_FLASH_DURATION_MS)
      }, BUDGET_DEBOUNCE_MS)
    }

    const channel = supabase
      .channel(`budget_realtime_${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'budget_items',
        filter: `project_id=eq.${projectId}`,
      }, handleChange)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'change_orders',
        filter: `project_id=eq.${projectId}`,
      }, handleChange)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'invoices_payable',
        filter: `project_id=eq.${projectId}`,
      }, handleChange)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [projectId, queryClient])

  return { isFlashing }
}

// ── Schedule Activities ───────────────────────────────────
// Lightweight subscription for the schedule_activities table.
// Invalidates the schedule query on any change so both tabs stay in sync.

export function useScheduleRealtime(projectId: string): { isSubscribed: boolean } {
  const queryClient = useQueryClient()
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel(`schedule_activities_${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_activities', filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['schedule', projectId] })
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setIsSubscribed(false)
    }
  }, [projectId, queryClient])

  return { isSubscribed }
}

// ── Activity Feed ─────────────────────────────────────────

export function useRealtimeActivityFeed(projectId: string | undefined) {
  return useRealtimeQuery<ActivityFeedItem>(
    ['activity_feed', projectId],
    async () => {
      if (!projectId) return []
      return getActivityFeed(projectId)
    },
    { table: 'activity_feed' },
  )
}
