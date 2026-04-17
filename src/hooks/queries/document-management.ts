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
