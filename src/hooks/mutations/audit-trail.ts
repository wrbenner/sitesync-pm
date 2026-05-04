import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { createOnError } from './createAuditedMutation'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

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
        })
        .select()
        .single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['audit_trail', result.projectId] })
    },
    onError: createOnError('log_audit_event'),
  })
}
