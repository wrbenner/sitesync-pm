import { projectService } from '../../services/projectService'
import { useAuditedMutation } from './createAuditedMutation'
import { projectSchema } from '../../components/forms/schemas'
import type { Project } from '../../types/entities'

// ── Projects ───────────────────────────────────────────────
//
// Thin wrappers around projectService that route through useAuditedMutation so
// we get permission checks + Zod validation + audit log + cache invalidation
// for every mutation. The service still handles the actual Supabase call and
// its own authorization (defense in depth).

export function useUpdateProject() {
  return useAuditedMutation<{ projectId: string; updates: Partial<Project> }, { projectId: string }>({
    permission: 'project.settings',
    schema: projectSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'project',
    getEntityId: (p) => p.projectId,
    getAfterState: (p) => p.updates as unknown as Record<string, unknown>,
    mutationFn: async (params) => {
      const { error } = await projectService.updateProject(params.projectId, params.updates)
      if (error) throw new Error(error.userMessage)
      return { projectId: params.projectId }
    },
    invalidateKeys: (p) => [
      ['projects'],
      ['projects', p.projectId],
    ],
    analyticsEvent: 'project_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update project',
  })
}

export function useDeleteProject() {
  return useAuditedMutation<{ projectId: string }, { projectId: string }>({
    permission: 'project.delete',
    action: 'delete',
    entityType: 'project',
    getEntityId: (p) => p.projectId,
    mutationFn: async (params) => {
      const { error } = await projectService.deleteProject(params.projectId)
      if (error) throw new Error(error.userMessage)
      return { projectId: params.projectId }
    },
    invalidateKeys: (p) => [
      ['projects'],
      ['projects', p.projectId],
    ],
    analyticsEvent: 'project_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete project',
  })
}
