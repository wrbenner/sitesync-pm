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
