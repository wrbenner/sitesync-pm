import { useMutation } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'

import { fromTable } from '../../lib/db/queries'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Field Captures ────────────────────────────────────────

export function useCreateFieldCapture() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('field_captures').insert(params.data as never).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('field_capture', result.projectId)
      posthog.capture('field_capture_created', { project_id: result.projectId })
    },
    onError: createOnError('create_field_capture'),
  })
}
