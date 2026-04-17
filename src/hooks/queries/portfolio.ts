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

// ── Portfolio ────────────────────────────────────────────

export function useOrgPortfolioMetrics(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org_portfolio_metrics', orgId],
    queryFn: () => getPortfolioMetrics(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
    retry: 1,
    throwOnError: true,
  })
}

export function usePortfolios(userId: string | undefined) {
  return useQuery({
    queryKey: ['portfolios', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function usePortfolioProjects(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ['portfolio_projects', portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_projects')
        .select('*, projects(*)')
        .eq('portfolio_id', portfolioId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!portfolioId,
  })
}

export function useExecutiveReports(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ['executive_reports', portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_reports')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!portfolioId,
  })
}
