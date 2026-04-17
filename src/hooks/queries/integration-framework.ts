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
