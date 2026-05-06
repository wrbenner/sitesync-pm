
import { useAuditedMutation } from './createAuditedMutation'
import { contactSchema } from '../../components/forms/schemas'

import { fromTable } from '../../lib/db/queries'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Directory Contacts ────────────────────────────────────

export function useCreateDirectoryContact() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: unknown; projectId: string }>({
    permission: 'directory.manage',
    schema: contactSchema,
    action: 'create',
    entityType: 'contact',
    getEntityTitle: (p) => (p.data.name as string) || undefined,
    getAfterState: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('directory_contacts').insert(params.data as never).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    analyticsEvent: 'directory_contact_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create contact',
  })
}

export function useUpdateDirectoryContact() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'directory.manage',
    schema: contactSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'contact',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates,
    mutationFn: async (params) => {
      const { error } = await from('directory_contacts').update(params.updates as never).eq('id' as never, params.id).eq('project_id' as never, params.projectId)
      if (error) throw error
      return { projectId: params.projectId, id: params.id }
    },
    analyticsEvent: 'directory_contact_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update contact',
  })
}

export function useDeleteDirectoryContact() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'directory.manage',
    action: 'delete',
    entityType: 'contact',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await from('directory_contacts').delete().eq('id' as never, params.id).eq('project_id' as never, params.projectId)
      if (error) throw error
      return { projectId: params.projectId }
    },
    analyticsEvent: 'directory_contact_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete contact',
  })
}
