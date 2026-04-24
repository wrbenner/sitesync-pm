import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'
import posthog from '../../lib/analytics'
import type { Database } from '../../types/database'

export type PermitRow = Database['public']['Tables']['permits']['Row']
export type PermitInsert = Partial<PermitRow> & { project_id: string; type: string }
export type PermitUpdate = Partial<Omit<PermitRow, 'id'>>

export function useCreatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PermitInsert) => {
      const { data, error } = await supabase
        .from('permits')
        .insert(payload as Record<string, unknown>)
        .select()
        .single()
      if (error) throw error
      return { data: data as unknown as PermitRow, projectId: payload.project_id }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['permits', result.projectId] })
      toast.success('Permit added')
      posthog.capture('permit_created', { project_id: result.projectId })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add permit')
      Sentry.captureException(err, { extra: { mutation: 'create_permit' } })
    },
  })
}

export function useUpdatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string; updates: PermitUpdate }) => {
      const { data, error } = await supabase
        .from('permits')
        .update(params.updates as Record<string, unknown>)
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error
      return { data: data as unknown as PermitRow, projectId: params.projectId }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['permits', result.projectId] })
      toast.success('Permit updated')
      posthog.capture('permit_updated', { project_id: result.projectId })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update permit')
      Sentry.captureException(err, { extra: { mutation: 'update_permit' } })
    },
  })
}

export function useDeletePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await supabase.from('permits').delete().eq('id', params.id)
      if (error) throw error
      return params
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['permits', result.projectId] })
      toast.success('Permit deleted')
      posthog.capture('permit_deleted', { project_id: result.projectId })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete permit')
      Sentry.captureException(err, { extra: { mutation: 'delete_permit' } })
    },
  })
}
