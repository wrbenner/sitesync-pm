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
