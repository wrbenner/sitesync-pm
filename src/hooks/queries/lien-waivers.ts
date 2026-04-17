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
