import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createOnError } from './createAuditedMutation'

import { fromTable } from '../../lib/db/queries'

// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Audit Trail ────────────────────────────────────────────

export function useLogAuditEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      projectId: string
      action: string
      entityType: string
      entityId?: string
      entityTitle?: string
      oldValue?: Record<string, unknown>
      newValue?: Record<string, unknown>
    }) => {
      const { data, error } = await from('audit_trail')
        .insert({
          project_id: params.projectId,
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId || null,
          entity_title: params.entityTitle || null,
          old_value: params.oldValue || null,
          new_value: params.newValue || null,
        } as never)
        .select()
        .single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['audit_trail', result.projectId] })
    },
    onError: createOnError('log_audit_event'),
  })
}
