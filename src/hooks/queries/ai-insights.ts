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
  FieldCapture,
  SchedulePhase,
  Notification,
  AIInsight,
  ProjectSnapshot,
} from '../../types/database'

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
