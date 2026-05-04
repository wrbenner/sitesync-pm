import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from './createAuditedMutation'
import { crewSchema } from '../../components/forms/schemas'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Crews ─────────────────────────────────────────────────

export function useCreateCrew() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: unknown; projectId: string }>({
    permission: 'crews.manage',
    schema: crewSchema,
    action: 'create',
    entityType: 'crew',
    getEntityTitle: (p) => (p.data.name as string) || undefined,
    getAfterState: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('crews').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'crew_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create crew',
  })
}

export function useUpdateCrew() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'crews.manage',
    schema: crewSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'crew',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates,
    mutationFn: async (params) => {
      const { error } = await from('crews').update(params.updates).eq('id' as never, params.id).eq('project_id' as never, params.projectId)
      if (error) throw error
      return { projectId: params.projectId, id: params.id }
    },
    analyticsEvent: 'crew_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update crew',
  })
}

export function useDeleteCrew() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'crews.manage',
    action: 'delete',
    entityType: 'crew',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await from('crews').delete().eq('id' as never, params.id).eq('project_id' as never, params.projectId)
      if (error) throw error
      return { projectId: params.projectId }
    },
    analyticsEvent: 'crew_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete crew',
  })
}
