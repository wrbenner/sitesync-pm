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
