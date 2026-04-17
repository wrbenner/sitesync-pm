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
