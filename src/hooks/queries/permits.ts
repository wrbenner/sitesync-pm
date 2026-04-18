import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from '../mutations/createAuditedMutation'
import { permitSchema } from '../../components/forms/schemas'



// ── Permits ──────────────────────────────────────────────

export function usePermits(projectId: string | undefined) {
  return useQuery({
    queryKey: ['permits', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('permits').select('*').eq('project_id', projectId!).order('type')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCreatePermit() {
  return useAuditedMutation<{ projectId: string; data: Record<string, unknown> }, { projectId: string; data: unknown }>({
    permission: 'project.settings',
    schema: permitSchema,
    action: 'create',
    entityType: 'permit',
    getEntityTitle: (p) => (p.data.permit_number as string) || (p.data.type as string) || undefined,
    getAfterState: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await supabase
        .from('permits')
        .insert({ ...params.data, project_id: params.projectId })
        .select()
        .single()
      if (error) throw error
      return { projectId: params.projectId, data }
    },
    invalidateKeys: (p) => [['permits', p.projectId]],
    analyticsEvent: 'permit_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create permit',
  })
}

export function useUpdatePermit() {
  return useAuditedMutation<{ id: string; projectId: string; updates: Record<string, unknown> }, { projectId: string; id: string }>({
    permission: 'project.settings',
    schema: permitSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'permit',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates,
    mutationFn: async (params) => {
      const { error } = await supabase
        .from('permits')
        .update(params.updates)
        .eq('id', params.id)
      if (error) throw error
      return { projectId: params.projectId, id: params.id }
    },
    invalidateKeys: (p) => [['permits', p.projectId]],
    analyticsEvent: 'permit_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update permit',
  })
}

export function useDeletePermit() {
  return useAuditedMutation<{ id: string; projectId: string }, { id: string; projectId: string }>({
    permission: 'project.settings',
    action: 'delete',
    entityType: 'permit',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await supabase.from('permits').delete().eq('id', params.id)
      if (error) throw error
      return { id: params.id, projectId: params.projectId }
    },
    invalidateKeys: (p) => [['permits', p.projectId]],
    analyticsEvent: 'permit_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete permit',
  })
}

export function usePermitInspections(permitId: string | undefined) {
  return useQuery({
    queryKey: ['permit_inspections', permitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('permit_inspections').select('*').eq('permit_id', permitId!).order('scheduled_date')
      if (error) throw error
      return data
    },
    enabled: !!permitId,
  })
}
