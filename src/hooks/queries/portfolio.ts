import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { getPortfolioMetrics } from '../../api/endpoints/organizations'



// ── Portfolio ────────────────────────────────────────────

export function useOrgPortfolioMetrics(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org_portfolio_metrics', orgId],
    queryFn: () => getPortfolioMetrics(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
    retry: 1,
  })
}

export function usePortfolios(userId: string | undefined) {
  return useQuery({
    queryKey: ['portfolios', userId],
    queryFn: async () => {
      const { data, error } = await fromTable('portfolios')
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
      const { data, error } = await fromTable('portfolio_projects')
        .select('*, projects(*)')
        .eq('portfolio_id' as never, portfolioId!)
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
      const { data, error } = await fromTable('executive_reports')
        .select('*')
        .eq('portfolio_id' as never, portfolioId!)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!portfolioId,
  })
}
