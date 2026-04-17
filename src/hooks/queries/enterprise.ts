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

// ── Enterprise ───────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('integrations').select('*').order('type')
      if (error) throw error
      return data
    },
  })
}

export function useIntegrationSyncLog(integrationId: string | undefined) {
  return useQuery({
    queryKey: ['integration_sync_log', integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_sync_log')
        .select('*')
        .eq('integration_id', integrationId!)
        .order('completed_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data
    },
    enabled: !!integrationId,
  })
}

export function useCustomReports(projectId: string | undefined) {
  return useQuery({
    queryKey: ['custom_reports', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_reports').select('*').or(`project_id.eq.${projectId},is_template.eq.true`).order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useSustainabilityMetrics(projectId: string | undefined) {
  return useQuery({
    queryKey: ['sustainability_metrics', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sustainability_metrics').select('*').eq('project_id', projectId!).order('category')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWasteLogs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['waste_logs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('waste_logs').select('*').eq('project_id', projectId!).order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWarranties(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranties', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('warranties').select('*').eq('project_id', projectId!).order('expiration_date')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWarrantyClaims(projectId: string | undefined) {
  return useQuery({
    queryKey: ['warranty_claims', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('warranty_claims').select('*').eq('project_id', projectId!).order('claim_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
