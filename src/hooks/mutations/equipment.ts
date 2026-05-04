import { useMutation, useQueryClient } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'
import posthog from '../../lib/analytics'
import type { Equipment } from '../../services/equipmentService'

type EquipmentInsert = Partial<Equipment> & { project_id: string; name: string }
type EquipmentUpdate = Partial<Omit<Equipment, 'id'>>

export function useCreateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EquipmentInsert) => {
      const { data, error } = await fromTable('equipment')
        .insert(payload as Record<string, unknown>)
        .select()
        .single()
      if (error) throw error
      return { data: data as unknown as Equipment, projectId: payload.project_id }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['equipment', result.projectId] })
      toast.success('Equipment added')
      posthog.capture('equipment_created', { project_id: result.projectId })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add equipment')
      Sentry.captureException(err, { extra: { mutation: 'create_equipment' } })
    },
  })
}

export function useUpdateEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string; updates: EquipmentUpdate }) => {
      const { data, error } = await fromTable('equipment')
        .update(params.updates as Record<string, unknown>)
        .eq('id' as never, params.id)
        .select()
        .single()
      if (error) throw error
      return { data: data as unknown as Equipment, projectId: params.projectId }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['equipment', result.projectId] })
      toast.success('Equipment updated')
      posthog.capture('equipment_updated', { project_id: result.projectId })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update equipment')
      Sentry.captureException(err, { extra: { mutation: 'update_equipment' } })
    },
  })
}

export function useDeleteEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await fromTable('equipment').delete().eq('id' as never, params.id)
      if (error) throw error
      return params
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['equipment', result.projectId] })
      toast.success('Equipment deleted')
      posthog.capture('equipment_deleted', { project_id: result.projectId })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete equipment')
      Sentry.captureException(err, { extra: { mutation: 'delete_equipment' } })
    },
  })
}
