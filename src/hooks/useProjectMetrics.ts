import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getProjectMetrics, getPortfolioMetrics } from '../api/endpoints/metrics'
import type { ProjectMetrics } from '../types/api'

const STALE_TIME = 60_000        // 1 minute
const REFETCH_INTERVAL = 300_000 // 5 minutes

export function useProjectMetrics(projectId: string | undefined) {
  return useQuery<ProjectMetrics>({
    queryKey: queryKeys.metrics.project(projectId!),
    queryFn: () => getProjectMetrics(projectId!),
    enabled: Boolean(projectId),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  })
}

export function usePortfolioMetrics(orgId: string | undefined) {
  return useQuery<ProjectMetrics[]>({
    queryKey: queryKeys.metrics.portfolio(orgId!),
    queryFn: () => getPortfolioMetrics(orgId!),
    enabled: Boolean(orgId),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  })
}

// Call on mouse-enter of project cards to warm the cache before navigation
export function usePrefetchProjectMetrics() {
  const queryClient = useQueryClient()
  return (projectId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.metrics.project(projectId),
      queryFn: () => getProjectMetrics(projectId),
      staleTime: STALE_TIME,
    })
  }
}
