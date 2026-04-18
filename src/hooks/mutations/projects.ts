import { useMutation, useQueryClient } from '@tanstack/react-query'
import posthog from '../../lib/analytics'
import { projectService } from '../../services/projectService'
import { createOnError } from './createAuditedMutation'
import type { Project } from '../../types/entities'

// ── Projects ───────────────────────────────────────────────
//
// Thin wrappers around projectService so the rest of the app can use the
// standard React-Query mutation pattern. The service handles permission
// checks and auditing; these hooks add cache invalidation + analytics.

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; updates: Partial<Project> }) => {
      const { error } = await projectService.updateProject(params.projectId, params.updates)
      if (error) throw new Error(error.userMessage)
      return params
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', result.projectId] })
      posthog.capture('project_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_project'),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string }) => {
      const { error } = await projectService.deleteProject(params.projectId)
      if (error) throw new Error(error.userMessage)
      return params
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', result.projectId] })
      posthog.capture('project_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_project'),
  })
}
