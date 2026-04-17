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
