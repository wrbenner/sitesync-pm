import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Directory Contacts ────────────────────────────────────

export function useCreateDirectoryContact() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('directory_contacts').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('contact', result.projectId)
      posthog.capture('directory_contact_created', { project_id: result.projectId })
    },
    onError: createOnError('create_directory_contact'),
  })
}

export function useUpdateDirectoryContact() {
  return useMutation({
    mutationFn: async (params: { id: string; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('directory_contacts').update(params.updates).eq('id', params.id)
      if (error) throw error
      return { projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('contact', result.projectId)
      posthog.capture('directory_contact_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_directory_contact'),
  })
}

export function useDeleteDirectoryContact() {
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await from('directory_contacts').delete().eq('id', params.id)
      if (error) throw error
      return { projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('contact', result.projectId)
      posthog.capture('directory_contact_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_directory_contact'),
  })
}
