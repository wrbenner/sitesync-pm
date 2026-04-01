import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getProjectMetrics, getBulkProjectMetrics } from '../api/endpoints/metrics'
import type { ProjectMetrics } from '../types/api'

const PROJECT_STALE_TIME = 300_000        // 5 minutes
const PROJECT_REFETCH_INTERVAL = 300_000  // 5 minutes

export function useProjectMetrics(projectId: string | undefined) {
  return useQuery<ProjectMetrics>({
    queryKey: queryKeys.metrics.project(projectId!),
    queryFn: () => getProjectMetrics(projectId!),
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_TIME,
    refetchInterval: PROJECT_REFETCH_INTERVAL,
  })
}

// Fetches metrics for many projects in a single query — use this in portfolio views
// to avoid N+1 fetches. Returns a stable map so consumers can look up by project ID.
export function usePortfolioMetrics(projectIds: string[]) {
  const sortedKey = [...projectIds].sort().join(',')
  const result = useQuery<Record<string, ProjectMetrics>>({
    queryKey: ['portfolio-metrics', sortedKey],
    queryFn: () => getBulkProjectMetrics(projectIds),
    enabled: projectIds.length > 0,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  return {
    metricsMap: result.data ?? ({} as Record<string, ProjectMetrics>),
    isLoading: result.isPending,
    error: result.error,
  }
}

// Call on mouse-enter of project cards to warm the cache before navigation
export function usePrefetchProjectMetrics() {
  const queryClient = useQueryClient()
  return (projectId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.metrics.project(projectId),
      queryFn: () => getProjectMetrics(projectId),
      staleTime: PROJECT_STALE_TIME,
    })
  }
}
