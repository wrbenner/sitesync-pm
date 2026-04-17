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
