import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export type LaborRate = {
  id: string
  project_id: string
  trade: string
  classification: string
  hourly_rate: number
  overtime_rate: number | null
  benefits_rate: number | null
  effective_date: string
  source: 'manual' | 'davis_bacon' | 'prevailing_wage' | 'union'
  created_at: string
}

export type MaterialRate = {
  id: string
  project_id: string
  item_name: string
  unit: string
  unit_cost: number
  supplier: string | null
  lead_time_days: number | null
  csi_division: number | null
  created_at: string
}

export type EquipmentRate = {
  id: string
  project_id: string
  equipment_name: string
  daily_rate: number
  weekly_rate: number | null
  monthly_rate: number | null
  operator_included: boolean
  fuel_included: boolean
  created_at: string
}

function makeListHook<T>(table: string, queryKey: string) {
  return function useList(projectId: string | undefined) {
    return useQuery({
      queryKey: [queryKey, projectId],
      queryFn: async () => {
        const { data, error } = await fromTable(table).select('*').eq('project_id' as never, projectId!).order('created_at', { ascending: false })
        if (error) throw error
        return (data || []) as T[]
      },
      enabled: !!projectId,
    })
  }
}

function makeCreateHook<T>(table: string, queryKey: string) {
  return function useCreate() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: Partial<T> & { project_id: string }) => {
        const { data, error } = await fromTable(table).insert(payload as never).select().single()
        if (error) throw error
        return data as T
      },
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: [queryKey, (vars as { project_id: string }).project_id] })
      },
    })
  }
}

export const useLaborRates = makeListHook<LaborRate>('labor_rates', 'labor_rates')
export const useCreateLaborRate = makeCreateHook<LaborRate>('labor_rates', 'labor_rates')

export const useMaterialRates = makeListHook<MaterialRate>('material_rates', 'material_rates')
export const useCreateMaterialRate = makeCreateHook<MaterialRate>('material_rates', 'material_rates')

export const useEquipmentRates = makeListHook<EquipmentRate>('equipment_rates', 'equipment_rates')
export const useCreateEquipmentRate = makeCreateHook<EquipmentRate>('equipment_rates', 'equipment_rates')

export function useImportDavisBacon(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ state, county }: { state: string; county?: string }) => {
      if (!projectId) throw new Error('No project')
      let q = fromTable('prevailing_wage_rates').select('*').eq('state_code' as never, state)
      if (county) q = q.eq('county_name' as never, county)
      const { data: rates, error } = await q
      if (error) throw error
      const rows = (rates || []).map((r: Record<string, unknown>) => ({
        project_id: projectId,
        trade: (r.trade as string) || 'Unknown',
        classification: (r.project_type as string) || 'Journeyman',
        hourly_rate: Math.round(Number(r.base_hourly_rate || 0) * 100),
        overtime_rate: null,
        benefits_rate: r.fringe_benefits != null ? Math.round(Number(r.fringe_benefits) * 100) : null,
        effective_date: (r.effective_date as string) || new Date().toISOString().slice(0, 10),
        source: 'davis_bacon' as const,
      }))
      if (rows.length === 0) return { inserted: 0 }
      const { error: insErr } = await fromTable('labor_rates').insert(rows as never)
      if (insErr) throw insErr
      return { inserted: rows.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labor_rates', projectId] })
    },
  })
}
