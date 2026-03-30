// Realtime-enabled query hooks.
// Each wraps the corresponding standard query with a Supabase Realtime subscription.
// Use these in page components instead of the base hooks for live-updating lists.

import { supabase } from '../../lib/supabase'
import { useRealtimeQuery } from '../useRealtimeQuery'
import type {
  RFI, Submittal, PunchItem, Task, Drawing, DailyLog,
  Crew, BudgetItem, ChangeOrder, Meeting, DirectoryContact,
  FileRecord, FieldCapture, SchedulePhase,
} from '../../types/database'

// ── RFIs ─────────────────────────────────────────────────

export function useRealtimeRFIs(projectId: string | undefined) {
  return useRealtimeQuery<RFI>(
    ['rfis', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await supabase.from('rfis').select('*').eq('project_id', projectId).order('rfi_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as RFI[]
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
      const { data, error } = await supabase.from('submittals').select('*').eq('project_id', projectId).order('submittal_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as Submittal[]
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
      const { data, error } = await supabase.from('punch_items').select('*').eq('project_id', projectId).order('item_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as PunchItem[]
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
      const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Task[]
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
      const { data, error } = await supabase.from('daily_logs').select('*').eq('project_id', projectId).order('log_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as DailyLog[]
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
      const { data, error } = await supabase.from('budget_items').select('*').eq('project_id', projectId).order('division')
      if (error) throw error
      return (data ?? []) as BudgetItem[]
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
      const { data, error } = await supabase.from('change_orders').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ChangeOrder[]
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
      const { data, error } = await supabase.from('meetings').select('*').eq('project_id', projectId).order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Meeting[]
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
      const { data, error } = await supabase.from('drawings').select('*').eq('project_id', projectId).order('set_number')
      if (error) throw error
      return (data ?? []) as Drawing[]
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
      let query = supabase.from('files').select('*').eq('project_id', projectId)
      if (folder) query = query.eq('folder', folder)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FileRecord[]
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
      const { data, error } = await supabase.from('directory_contacts').select('*').eq('project_id', projectId).order('name')
      if (error) throw error
      return (data ?? []) as DirectoryContact[]
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
      const { data, error } = await supabase.from('crews').select('*').eq('project_id', projectId).order('name')
      if (error) throw error
      return (data ?? []) as Crew[]
    },
    { table: 'crews' }
  )
}

// ── Schedule Phases ──────────────────────────────────────

export function useRealtimeSchedulePhases(projectId: string | undefined) {
  return useRealtimeQuery<SchedulePhase>(
    ['schedule_phases', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await supabase.from('schedule_phases').select('*').eq('project_id', projectId).order('start_date')
      if (error) throw error
      return (data ?? []) as SchedulePhase[]
    },
    { table: 'schedule_phases' }
  )
}

// ── Field Captures ───────────────────────────────────────

export function useRealtimeFieldCaptures(projectId: string | undefined) {
  return useRealtimeQuery<FieldCapture>(
    ['field_captures', projectId],
    async () => {
      if (!projectId) return []
      const { data, error } = await supabase.from('field_captures').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FieldCapture[]
    },
    { table: 'field_captures' }
  )
}
