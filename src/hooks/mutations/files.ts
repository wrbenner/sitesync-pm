import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'

import { fromTable } from '../../lib/db/queries'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Files ─────────────────────────────────────────────────

export function useCreateFile() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('files').insert(params.data).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('file', result.projectId)
      posthog.capture('file_uploaded', { project_id: result.projectId })
    },
    onError: createOnError('upload_file'),
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('files').delete().eq('id' as never, id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      // exact:false catches ['files', projectId, folder] for all folder variations
      queryClient.invalidateQueries({ queryKey: ['files', result.projectId], exact: false })
      posthog.capture('file_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_file'),
  })
}
