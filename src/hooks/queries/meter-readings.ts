import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

// ── Types ──────────────────────────────────────────────────

export interface MeterReading {
  id: string
  project_id: string
  equipment_id: string
  meter_name: string
  reading_value: number
  unit: string
  reading_date: string
  recorded_by: string | null
  notes: string | null
  created_at: string
}

// ── Queries ──────────────────────────────────────────────────

export function useMeterReadings(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['meter_readings', equipmentId],
    queryFn: async () => {
      const { data, error } = await fromTable('meter_readings')
        .select('*')
        .eq('equipment_id' as never, equipmentId!)
        .order('reading_date', { ascending: false })
      if (error) throw error
      return data as unknown as MeterReading[]
    },
    enabled: !!equipmentId,
  })
}

export function useLatestMeterReading(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['meter_readings_latest', equipmentId],
    queryFn: async () => {
      const { data, error } = await fromTable('meter_readings')
        .select('*')
        .eq('equipment_id' as never, equipmentId!)
        .order('reading_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as MeterReading | null
    },
    enabled: !!equipmentId,
  })
}

export function useMeterReadingsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['meter_readings_project', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('meter_readings')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('reading_date', { ascending: false })
      if (error) throw error
      return data as unknown as MeterReading[]
    },
    enabled: !!projectId,
  })
}

// ── Mutations ──────────────────────────────────────────────────

export function useCreateMeterReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await fromTable('meter_readings')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as MeterReading
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['meter_readings', vars.equipment_id as string] })
      qc.invalidateQueries({ queryKey: ['meter_readings_latest', vars.equipment_id as string] })
      qc.invalidateQueries({ queryKey: ['meter_readings_project', vars.project_id as string] })
    },
  })
}
