import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Crews ─────────────────────────────────────────────────

export function useCreateCrew() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('crews').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('crew', result.projectId)
      posthog.capture('crew_created', { project_id: result.projectId })
    },
    onError: createOnError('create_crew'),
  })
}

export function useUpdateCrew() {
  return useMutation({
    mutationFn: async (params: { id: string; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('crews').update(params.updates).eq('id', params.id)
      if (error) throw error
      return { projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('crew', result.projectId)
      posthog.capture('crew_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_crew'),
  })
}

export function useDeleteCrew() {
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await from('crews').delete().eq('id', params.id)
      if (error) throw error
      return { projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('crew', result.projectId)
      posthog.capture('crew_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_crew'),
  })
}
