import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

// ── Types ──────────────────────────────────────────────────

export interface PMSchedule {
  id: string
  project_id: string
  equipment_id: string
  title: string
  description: string | null
  priority: string | null
  recurrence_type: string
  recurrence_interval: number | null
  day_of_week: number[] | null
  day_of_month: number | null
  starts_on: string
  ends_on: string | null
  last_generated_at: string | null
  next_due_date: string | null
  based_on: string | null
  meter_trigger_value: number | null
  meter_trigger_unit: string | null
  checklist_template: unknown
  assigned_to: string | null
  estimated_duration_hours: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CreatePMScheduleInput = Omit<PMSchedule, 'id' | 'created_at' | 'updated_at' | 'last_generated_at'>

export type UpdatePMScheduleInput = Partial<Omit<PMSchedule, 'id' | 'created_at' | 'updated_at'>>

// ── Queries ──────────────────────────────────────────────────

export function usePMSchedules(projectId: string | undefined) {
  return useQuery({
    queryKey: ['pm_schedules', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('preventive_maintenance_schedules')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('next_due_date', { ascending: true })
      if (error) throw error
      return data as unknown as PMSchedule[]
    },
    enabled: !!projectId,
  })
}

export function usePMSchedulesByEquipment(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['pm_schedules_by_equipment', equipmentId],
    queryFn: async () => {
      const { data, error } = await fromTable('preventive_maintenance_schedules')
        .select('*')
        .eq('equipment_id' as never, equipmentId!)
        .order('next_due_date', { ascending: true })
      if (error) throw error
      return data as unknown as PMSchedule[]
    },
    enabled: !!equipmentId,
  })
}

// ── Mutations ──────────────────────────────────────────────────

export function useCreatePMSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await fromTable('preventive_maintenance_schedules')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as PMSchedule
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pm_schedules', vars.project_id as string] })
      qc.invalidateQueries({ queryKey: ['pm_schedules_by_equipment', vars.equipment_id as string] })
    },
  })
}

export function useUpdatePMSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; projectId: string; equipmentId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await fromTable('preventive_maintenance_schedules')
        .update({ ...payload.updates, updated_at: new Date().toISOString() } as never)
        .eq('id' as never, payload.id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as PMSchedule
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pm_schedules', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['pm_schedules_by_equipment', vars.equipmentId] })
    },
  })
}

export function useDeletePMSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; projectId: string; equipmentId: string }) => {
      const { error } = await fromTable('preventive_maintenance_schedules')
        .delete()
        .eq('id' as never, payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pm_schedules', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['pm_schedules_by_equipment', vars.equipmentId] })
    },
  })
}
