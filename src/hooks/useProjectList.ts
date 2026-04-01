import { useQuery } from '@tanstack/react-query'
import { useOrganization } from './useOrganization'
import { getOrganizationProjects } from '../api/endpoints/organizations'
import { queryKeys } from '../api/queryKeys'
import type { ProjectRow } from '../types/api'

// Returns the cached list of projects for the current organization.
// Automatically re-fetches when the active org changes.
export function useProjectList(): {
  projects: ProjectRow[]
  loading: boolean
  error: Error | null
} {
  const { currentOrg } = useOrganization()

  const { data, isLoading, error } = useQuery({
    queryKey: currentOrg
      ? queryKeys.organizations.projects(currentOrg.id)
      : ['organizations', 'projects', 'no-org'],
    queryFn: () => getOrganizationProjects(currentOrg!.id),
    enabled: !!currentOrg,
    staleTime: 2 * 60 * 1000,
  })

  return {
    projects: data ?? [],
    loading: isLoading,
    error: error as Error | null,
  }
}
