import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import { getAiInsights } from '../../api/endpoints/ai'
import { getActivityFeed } from '../../api/endpoints/activity'
import type { ActivityFeedItem as EnrichedActivityFeedItem } from '../../types/entities'
import { getPortfolioMetrics } from '../../api/endpoints/organizations'
import { getPayApplication } from '../../api/endpoints/budget'
import { getPayApplications } from '../../api/endpoints/payApplications'
import { getLienWaivers } from '../../api/endpoints/lienWaivers'
import { getFiles as getFilesEnriched } from '../../api/endpoints/documents'
import type {
  Project,
  RFI,
  RFIResponse,
  Submittal,
  PunchItem,
  Task,
  Drawing,
  DailyLog,
  Crew,
  BudgetItem,
  ChangeOrder,
  Meeting,
  DirectoryContact,
  FileRecord,
  FieldCapture,
  SchedulePhase,
  Notification,
  ActivityFeedItem,
  AIInsight,
  ProjectSnapshot,
} from '../../types/database'

// ── Projects ──────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Project[]
    },
  })
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .single()
      if (error) throw error
      return data as Project
    },
    enabled: !!projectId,
  })
}

// ── RFIs ──────────────────────────────────────────────────

export function useRFIs(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['rfis', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<RFI>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('rfis')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('rfi_number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as RFI[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useRFI(id: string | undefined) {
  return useQuery({
    queryKey: ['rfis', 'detail', id],
    queryFn: async () => {
      const [rfiResult, responsesResult] = await Promise.all([
        supabase.from('rfis').select('*').eq('id', id!).single(),
        supabase
          .from('rfi_responses')
          .select('*')
          .eq('rfi_id', id!)
          .order('created_at', { ascending: true }),
      ])
      if (rfiResult.error) throw rfiResult.error
      if (responsesResult.error) throw responsesResult.error
      return {
        ...(rfiResult.data as RFI),
        responses: responsesResult.data as RFIResponse[],
      }
    },
    enabled: !!id,
  })
}

// ── Submittals ────────────────────────────────────────────

export function useSubmittals(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['submittals', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Submittal>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('submittals')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('submittal_number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as Submittal[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useSubmittal(id: string | undefined) {
  return useQuery({
    queryKey: ['submittals', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submittals')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Submittal
    },
    enabled: !!id,
  })
}

export function useSubmittalReviewers(submittalId: string | undefined) {
  return useQuery({
    queryKey: ['submittal_approvals', submittalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submittal_approvals')
        .select('*')
        .eq('submittal_id', submittalId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        submittal_id: string
        role: string | null
        status: string | null
        stamp: string | null
        comments: string | null
        approver_id: string | null
      }>
    },
    enabled: !!submittalId,
  })
}

// ── Punch Items ───────────────────────────────────────────

export function usePunchItems(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['punch_items', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<PunchItem>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('punch_items')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('item_number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as PunchItem[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function usePunchItem(id: string | undefined) {
  return useQuery({
    queryKey: ['punch_items', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punch_items')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as PunchItem
    },
    enabled: !!id,
  })
}

// ── Tasks ─────────────────────────────────────────────────

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Task[]
    },
    enabled: !!projectId,
  })
}

// ── Drawings ──────────────────────────────────────────────

export function useDrawings(projectId: string | undefined) {
  return useQuery({
    queryKey: ['drawings', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('project_id', projectId!)
        .order('set_number', { ascending: true })
      if (error) throw error
      return data as Drawing[]
    },
    enabled: !!projectId,
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Task
    },
    enabled: !!id,
  })
}

// ── Daily Logs ────────────────────────────────────────────

export function useDailyLogs(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['daily_logs', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<DailyLog>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('daily_logs')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as DailyLog[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

// ── Crews ─────────────────────────────────────────────────

export function useCrews(projectId: string | undefined) {
  return useQuery({
    queryKey: ['crews', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('project_id', projectId!)
      if (error) throw error
      return data as Crew[]
    },
    enabled: !!projectId,
  })
}

export function useDailyLog(id: string | undefined) {
  return useQuery({
    queryKey: ['daily_logs', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as DailyLog
    },
    enabled: !!id,
  })
}

// ── Budget Items ──────────────────────────────────────────

export function useBudgetItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['budget_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('division', { ascending: true })
      if (error) throw error
      return data as BudgetItem[]
    },
    enabled: !!projectId,
  })
}

// ── Change Orders ─────────────────────────────────────────

export function useChangeOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['change_orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*')
        .eq('project_id', projectId!)
        .order('co_number', { ascending: false })
      if (error) throw error
      return data as ChangeOrder[]
    },
    enabled: !!projectId,
  })
}

export function useChangeOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['change_orders', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as ChangeOrder
    },
    enabled: !!id,
  })
}

// ── Meetings ──────────────────────────────────────────────

export function useMeetings(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['meetings', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Meeting>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as Meeting[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ['meetings', 'detail', id],
    queryFn: async () => {
      const [meetingResult, attendeesResult, actionItemsResult] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id!).single(),
        supabase.from('meeting_attendees').select('*').eq('meeting_id', id!),
        supabase.from('meeting_action_items').select('*').eq('meeting_id', id!).order('created_at'),
      ])
      if (meetingResult.error) throw meetingResult.error
      return {
        ...(meetingResult.data as Meeting),
        attendees: attendeesResult.data || [],
        action_items: actionItemsResult.data || [],
      }
    },
    enabled: !!id,
  })
}

// ── Directory Contacts ────────────────────────────────────

export function useDirectoryContacts(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['directory_contacts', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<DirectoryContact>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('directory_contacts')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('contact_name', { ascending: true })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as DirectoryContact[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

// ── Files ─────────────────────────────────────────────────

export function useFiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ['files', projectId],
    queryFn: () => getFilesEnriched(projectId!),
    enabled: !!projectId,
  })
}

// ── Field Captures ────────────────────────────────────────

export function useFieldCaptures(projectId: string | undefined) {
  return useQuery({
    queryKey: ['field_captures', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_captures')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as FieldCapture[]
    },
    enabled: !!projectId,
  })
}

// ── Schedule Phases ───────────────────────────────────────

export function useSchedulePhases(projectId: string | undefined) {
  return useQuery({
    queryKey: ['schedule_phases', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_phases')
        .select('*')
        .eq('project_id', projectId!)
        .order('start_date', { ascending: true })
      if (error) throw error
      return data as SchedulePhase[]
    },
    enabled: !!projectId,
  })
}

// ── Notifications ─────────────────────────────────────────

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Notification[]
    },
    enabled: !!userId,
  })
}

// ── Activity Feed ─────────────────────────────────────────

export function useActivityFeed(projectId: string | undefined) {
  return useQuery<EnrichedActivityFeedItem[]>({
    queryKey: ['activity_feed', projectId],
    queryFn: () => getActivityFeed(projectId!),
    enabled: !!projectId,
  })
}

// ── AI Insights ───────────────────────────────────────────

export function useAIInsights(projectId: string | undefined, page?: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`ai_insights:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_insights', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['ai_insights', projectId] }) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])

  return useQuery({
    queryKey: ['ai_insights', projectId, page ?? null],
    queryFn: async () => {
      let query = supabase
        .from('ai_insights')
        .select('*')
        .eq('project_id', projectId!)
        .eq('dismissed', false)

      if (page) {
        query = query.eq('page', page)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as AIInsight[]
    },
    enabled: !!projectId,
  })
}

export function useAIInsightsByCategory(projectId: string | undefined, category?: string) {
  return useQuery({
    queryKey: ['ai_insights', projectId, 'category', category ?? null],
    queryFn: async () => {
      // category column added by migration but not yet in generated DB types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('ai_insights')
        .select('*')
        .eq('project_id', projectId!)
        .eq('dismissed', false)
      if (category) query = query.eq('category', category)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as AIInsight[]
    },
    enabled: !!projectId,
  })
}

/** Routes through getAiInsights so the aiService is tried first, with Supabase as fallback. Returns dataSource and lastFallbackAt for cache indicators. */
export function useAiInsightsMeta(projectId: string | undefined) {
  return useQuery({
    queryKey: ['ai_insights_meta', projectId],
    queryFn: () => getAiInsights(projectId!),
    enabled: !!projectId,
  })
}

export function useTaskRiskScores(projectId: string | undefined) {
  return useQuery({
    queryKey: ['task_risks', projectId],
    queryFn: async () => {
      // risk_score and risk_level added by migration 00031 but not yet in generated DB types
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, risk_score, risk_level')
        .eq('project_id', projectId!)
      if (error) throw error
      return ((data || []) as Array<{ id: string; title: string; risk_score: number | null; risk_level: string | null }>)
        .filter(t => t.risk_level != null)
        .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    },
    enabled: !!projectId,
  })
}

export function useEarnedValueData(projectId: string | undefined) {
  return useQuery({
    queryKey: ['earned_value', projectId],
    queryFn: async () => {
      const [budgetRes, phasesRes, projectRes] = await Promise.all([
        supabase.from('budget_items').select('original_amount, actual_amount, committed_amount, percent_complete').eq('project_id', projectId!),
        supabase.from('schedule_phases').select('percent_complete, status').eq('project_id', projectId!),
        supabase.from('projects').select('start_date, target_completion').eq('id', projectId!).single(),
      ])
      if (budgetRes.error) throw budgetRes.error
      const items = budgetRes.data || []
      const phases = phasesRes.data || []
      const project = projectRes.data

      const avgProgress = phases.length > 0
        ? phases.reduce((s, p) => s + (p.percent_complete || 0), 0) / phases.length
        : 0

      let elapsedPercent = 50
      if (project?.start_date && project?.target_completion) {
        const start = new Date(project.start_date).getTime()
        const end = new Date(project.target_completion).getTime()
        const total = end - start
        elapsedPercent = total > 0 ? Math.min(100, ((Date.now() - start) / total) * 100) : 50
      }

      // Inline EV computation for the client
      const BAC = items.reduce((s, b) => s + (b.original_amount || 0), 0)
      const AC = items.reduce((s, b) => s + (b.actual_amount || 0), 0)
      const PV = BAC * Math.min(1, elapsedPercent / 100)
      const EV = BAC * Math.min(1, avgProgress / 100)
      const CPI = AC > 0 ? EV / AC : 1
      const SPI = PV > 0 ? EV / PV : 1
      const EAC = CPI > 0 ? BAC / CPI : BAC * 1.5
      const ETC = Math.max(0, EAC - AC)
      const VAC = BAC - EAC
      const CV = EV - AC
      const SV = EV - PV
      const TCPI = (BAC - EV) > 0 ? (BAC - EV) / (BAC - AC) : 1

      return { BAC, PV, EV, AC, CPI, SPI, EAC, ETC, VAC, CV, SV, TCPI, avgProgress, elapsedPercent }
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Project Snapshots ─────────────────────────────────────

export function useProjectSnapshots(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_snapshots')
        .select('*')
        .eq('project_id', projectId!)
        .order('snapshot_date', { ascending: false })
      if (error) throw error
      return data as ProjectSnapshot[]
    },
    enabled: !!projectId,
  })
}

export function useWeeklyDigests(projectId: string | undefined) {
  return useQuery({
    queryKey: ['weekly_digests', projectId],
    queryFn: async () => {
      // snapshot_type added by migration 00031 but not yet in generated DB types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = supabase
        .from('project_snapshots')
        .select('*')
        .eq('project_id', projectId!)
      const { data, error } = await query
        .eq('snapshot_type', 'weekly')
        .order('snapshot_date', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data || []) as ProjectSnapshot[]
    },
    enabled: !!projectId,
  })
}

// ── Safety Inspections ───────────────────────────────────

export function useSafetyInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_inspections', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_inspections')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Incidents ────────────────────────────────────────────

export function useIncidents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['incidents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Toolbox Talks ────────────────────────────────────────

export function useToolboxTalks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['toolbox_talks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('toolbox_talks')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Safety Certifications ────────────────────────────────

export function useSafetyCertifications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_certifications', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_certifications')
        .select('*')
        .eq('project_id', projectId!)
        .order('expiration_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Safety Observations ──────────────────────────────────

export function useSafetyObservations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_observations', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_observations')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Preconstruction ──────────────────────────────────────

export function useEstimates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['estimates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useEstimateLineItems(estimateId: string | undefined) {
  return useQuery({
    queryKey: ['estimate_line_items', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!estimateId,
  })
}

export function useBidPackages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['bid_packages', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('project_id', projectId!)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useBidResponses(bidPackageId: string | undefined) {
  return useQuery({
    queryKey: ['bid_responses', bidPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bid_responses')
        .select('*')
        .eq('bid_package_id', bidPackageId!)
        .order('base_bid', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!bidPackageId,
  })
}

export function useTakeoffItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['takeoff_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCostDatabase() {
  return useQuery({
    queryKey: ['cost_database'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_database')
        .select('*')
        .order('csi_code', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// ── Portfolio ────────────────────────────────────────────

export function useOrgPortfolioMetrics(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org_portfolio_metrics', orgId],
    queryFn: () => getPortfolioMetrics(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
    retry: 1,
    throwOnError: true,
  })
}

export function usePortfolios(userId: string | undefined) {
  return useQuery({
    queryKey: ['portfolios', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function usePortfolioProjects(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio_projects', portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_projects')
        .select('*, projects(*)')
        .eq('portfolio_id', portfolioId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!portfolioId,
  })
}

export function useExecutiveReports(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ['executive_reports', portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_reports')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!portfolioId,
  })
}

// ── Portals ──────────────────────────────────────────────

export function usePortalInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['portal_invitations', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_invitations')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useOwnerUpdates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['owner_updates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('owner_updates')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useSubcontractorInvoices(projectId: string | undefined) {
  return useQuery({
    queryKey: ['subcontractor_invoices', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('project_id', projectId!)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useInsuranceCertificates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['insurance_certificates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_certificates')
        .select('*')
        .eq('project_id', projectId!)
        .order('expiration_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Procurement & Equipment ──────────────────────────────

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['purchase_orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders').select('*').eq('project_id', projectId!).order('po_number', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useDeliveries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['deliveries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('project_id', projectId!).order('delivery_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useMaterialInventory(projectId: string | undefined) {
  return useQuery({
    queryKey: ['material_inventory', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('material_inventory').select('*').eq('project_id', projectId!).order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useEquipment(projectId: string | undefined) {
  return useQuery({
    queryKey: ['equipment', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment').select('*').eq('current_project_id', projectId!).order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useEquipmentMaintenance(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['equipment_maintenance', equipmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment_maintenance').select('*').eq('equipment_id', equipmentId!).order('scheduled_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!equipmentId,
  })
}

// ── Financials ───────────────────────────────────────────

export function useContracts(projectId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePayApplications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['pay_applications', projectId],
    queryFn: () => getPayApplications(projectId!),
    enabled: !!projectId,
  })
}

export function useJobCostEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['job_cost_entries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('job_cost_entries').select('*').eq('project_id', projectId!).order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useInvoicesPayable(projectId: string | undefined) {
  return useQuery({
    queryKey: ['invoices_payable', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices_payable').select('*').eq('project_id', projectId!).order('due_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWipReports(projectId: string | undefined) {
  return useQuery({
    queryKey: ['wip_reports', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wip_reports').select('*').eq('project_id', projectId!).order('period_end', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useRetainageLedger(projectId: string | undefined) {
  return useQuery({
    queryKey: ['retainage_ledger', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('retainage_ledger').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── AI Agents ────────────────────────────────────────────

export function useAIAgents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['ai_agents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_agents').select('*').eq('project_id', projectId!).order('agent_type')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useAIAgentActions(projectId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['ai_agent_actions', projectId, status],
    queryFn: async () => {
      let q = supabase.from('ai_agent_actions').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q.limit(50)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Workforce ────────────────────────────────────────────

export function useWorkforceMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['workforce_members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('workforce_members').select('*').eq('project_id', projectId!).order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useTimeEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['time_entries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('time_entries').select('*').eq('project_id', projectId!).order('date', { ascending: false }).limit(100)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Permits ──────────────────────────────────────────────

export function usePermits(projectId: string | undefined) {
  return useQuery({
    queryKey: ['permits', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('permits').select('*').eq('project_id', projectId!).order('type')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePermitInspections(permitId: string | undefined) {
  return useQuery({
    queryKey: ['permit_inspections', permitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('permit_inspections').select('*').eq('permit_id', permitId!).order('scheduled_date')
      if (error) throw error
      return data
    },
    enabled: !!permitId,
  })
}

// ── Enterprise ───────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('integrations').select('*').order('type')
      if (error) throw error
      return data
    },
  })
}

export function useIntegrationSyncLog(integrationId: string | undefined) {
  return useQuery({
    queryKey: ['integration_sync_log', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_sync_log')
        .select('*')
        .eq('integration_id', integrationId!)
        .order('completed_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!integrationId,
  })
}

export function useCustomReports(projectId: string | undefined) {
  return useQuery({
    queryKey: ['custom_reports', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_reports').select('*').or(`project_id.eq.${projectId},is_template.eq.true`).order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useSustainabilityMetrics(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sustainability_metrics', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sustainability_metrics').select('*').eq('project_id', projectId!).order('category')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWasteLogs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['waste_logs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('waste_logs').select('*').eq('project_id', projectId!).order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWarranties(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranties', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('warranties').select('*').eq('project_id', projectId!).order('expiration_date')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWarrantyClaims(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranty_claims', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('warranty_claims').select('*').eq('project_id', projectId!).order('claim_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Task Templates ───────────────────────────────────────

export function useTaskTemplates() {
  return useQuery({
    queryKey: ['task_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .order('phase', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useTaskCriticalPath(projectId: string | undefined) {
  return useQuery({
    queryKey: ['task_critical_path', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, end_date, predecessor_ids, estimated_hours')
        .eq('project_id', projectId!)
        .not('status', 'eq', 'done')
      if (error) throw error

      const { tasksToCPM, calculateCriticalPath } = await import('../../lib/criticalPath')
      const cpmTasks = tasksToCPM((data || []).map((t) => ({
        id: t.id,
        title: t.title,
        start_date: t.start_date,
        end_date: t.end_date,
        predecessor_ids: t.predecessor_ids,
        estimated_hours: t.estimated_hours,
      })))
      return calculateCriticalPath(cpmTasks)
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // CPM results are stable for 5 minutes
  })
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task_dependencies', taskId],
    queryFn: async () => {
      // Get the task's predecessor_ids
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('predecessor_ids, successor_ids')
        .eq('id', taskId!)
        .single()
      if (taskError) throw taskError

      const taskRecord = task as Record<string, unknown>
      const predecessorIds = (taskRecord.predecessor_ids as string[] | null) || []
      const successorIds = (taskRecord.successor_ids as string[] | null) || []

      let predecessors: Array<{ id: string; title: string; status: string; due_date: string | null }> = []
      let successors: Array<{ id: string; title: string; status: string; due_date: string | null }> = []

      if (predecessorIds.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, due_date')
          .in('id', predecessorIds)
        predecessors = data || []
      }

      if (successorIds.length > 0) {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, due_date')
          .in('id', successorIds)
        successors = data || []
      }

      return { predecessors, successors }
    },
    enabled: !!taskId,
  })
}

// ── Safety Enhancements ──────────────────────────────────

export function useSafetyInspectionTemplates() {
  return useQuery({
    queryKey: ['safety_inspection_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_inspection_templates')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCorrectiveActions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['corrective_actions', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corrective_actions')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Document Management ──────────────────────────────────

export function useDrawingMarkups(drawingId: string | undefined) {
  return useQuery({
    queryKey: ['drawing_markups', drawingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_markups')
        .select('*')
        .eq('drawing_id', drawingId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!drawingId,
  })
}

export function useTransmittals(projectId: string | undefined) {
  return useQuery({
    queryKey: ['transmittals', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transmittals')
        .select('*')
        .eq('project_id', projectId!)
        .order('transmittal_number', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Organizations ────────────────────────────────────────

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId!).single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}

export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization_members', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organization_members').select('*').eq('organization_id', orgId!).order('role')
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}

// ── Integration Framework ────────────────────────────────

export function useApiKeys(orgId: string | undefined) {
  return useQuery({
    queryKey: ['api_keys', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('api_keys').select('*').eq('organization_id', orgId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}

export function useWebhooks(orgId: string | undefined) {
  return useQuery({
    queryKey: ['webhooks', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('webhooks').select('*').eq('organization_id', orgId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })
}

// ── Global Search ────────────────────────────────────────

export function useGlobalSearch(projectId: string | undefined, query: string) {
  return useQuery({
    queryKey: ['global_search', projectId, query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const { data, error } = await supabase.rpc('search_project', {
        p_project_id: projectId!,
        p_query: query,
        p_limit: 20,
      })
      if (error) throw error
      return (data || []) as Array<{
        entity_type: string
        entity_id: string
        title: string
        subtitle: string
        link: string
        rank: number
      }>
    },
    enabled: !!projectId && !!query && query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  })
}

// ── Notification Preferences ─────────────────────────────

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ['notification_preferences', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId!)
        .single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      return data
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Portal Access ────────────────────────────────────────

export function usePortalAccessTokens(projectId: string | undefined) {
  return useQuery({
    queryKey: ['portal_access_tokens', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_access_tokens')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePortalAccessByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['portal_access_token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_access_tokens')
        .select('*, projects(*)')
        .eq('token', token!)
        .eq('active', true)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!token,
  })
}

// ── Construction Workflows ───────────────────────────────

export function useCloseoutItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['closeout_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('closeout_items').select('*').eq('project_id', projectId!).order('trade').order('category')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWeatherRecords(projectId: string | undefined) {
  return useQuery({
    queryKey: ['weather_records', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('weather_records').select('*').eq('project_id', projectId!).order('date', { ascending: false }).limit(90)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWeeklyCommitments(projectId: string | undefined, weekStart?: string) {
  return useQuery({
    queryKey: ['weekly_commitments', projectId, weekStart],
    queryFn: async () => {
      let q = supabase.from('weekly_commitments').select('*').eq('project_id', projectId!).order('created_at')
      if (weekStart) q = q.eq('week_start', weekStart)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Meeting Enhancements ─────────────────────────────────

export function useMeetingAgendaItems(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_agenda_items', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_agenda_items').select('*').eq('meeting_id', meetingId!).order('sort_order')
      if (error) throw error
      return data
    },
    enabled: !!meetingId,
  })
}

export function useMeetingActionItems(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_action_items', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_action_items').select('*').eq('meeting_id', meetingId!).order('due_date')
      if (error) throw error
      return data
    },
    enabled: !!meetingId,
  })
}

export function useMeetingSeries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_series', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_series').select('*').eq('project_id', projectId!).eq('active', true).order('title')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useOpenActionItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['open_action_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_action_items').select('*, meetings!inner(project_id)').eq('meetings.project_id', projectId!).eq('status', 'open').order('due_date')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── RFI Watchers ─────────────────────────────────────────

export function useRFIWatchers(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_watchers', rfiId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfi_watchers').select('*').eq('rfi_id', rfiId!)
      if (error) throw error
      return data
    },
    enabled: !!rfiId,
  })
}

// ── Report Runs ──────────────────────────────────────────

export function useReportRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: ['report_runs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_runs')
        .select('*')
        .eq('project_id', projectId!)
        .order('generated_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useReportTemplates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['report_templates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('project_id', projectId!)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useReportSchedules(projectId: string | undefined) {
  return useQuery({
    queryKey: ['report_schedules', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*, template:template_id(name, report_type, format)')
        .eq('project_id', projectId!)
        .order('next_run_at')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Daily Log Entries ────────────────────────────────────

export function useDailyLogEntries(dailyLogId: string | undefined) {
  return useQuery({
    queryKey: ['daily_log_entries', dailyLogId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_log_entries')
        .select('*')
        .eq('daily_log_id', dailyLogId!)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!dailyLogId,
  })
}

// ── Lien Waivers ─────────────────────────────────────────

export function useLienWaivers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['lien_waivers', projectId],
    queryFn: () => getLienWaivers(projectId!),
    enabled: !!projectId,
  })
}

export function useLienWaiversByPayApp(payAppId: string | undefined) {
  return useQuery({
    queryKey: ['lien_waivers', 'pay_app', payAppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lien_waivers')
        .select('*')
        .eq('pay_app_id', payAppId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!payAppId,
  })
}

// ── Lookahead Tasks ──────────────────────────────────────

export function useLookaheadTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['lookahead_tasks', projectId],
    queryFn: async () => {
      const today = new Date()
      const threeWeeksOut = new Date(today)
      threeWeeksOut.setDate(today.getDate() + 21)

      const { data, error } = await supabase
        .from('tasks')
        .select('*, crew:crews(id, name)')
        .eq('project_id', projectId!)
        .gte('start_date', today.toISOString().slice(0, 10))
        .lte('start_date', threeWeeksOut.toISOString().slice(0, 10))
        .in('status', ['todo', 'in_progress'])
        .order('start_date')
      if (error) throw error
      return data as Task[]
    },
    enabled: !!projectId,
  })
}

export function usePayAppSOV(projectId: string | undefined, appNumber: number | null | undefined) {
  return useQuery({
    queryKey: ['pay_app_sov', projectId, appNumber],
    queryFn: () => getPayApplication(projectId!, appNumber!),
    enabled: !!projectId && appNumber != null,
  })
}
