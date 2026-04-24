import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Equipment, EquipmentMaintenance } from '../../services/equipmentService'

export function useEquipment(projectId: string | undefined) {
  return useQuery({
    queryKey: ['equipment', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('project_id', projectId!)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Equipment[]
    },
    enabled: !!projectId,
  })
}

export function useEquipmentMaintenance(projectId: string | undefined) {
  return useQuery({
    queryKey: ['equipment_maintenance', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_maintenance')
        .select('*, equipment!inner(project_id)')
        .eq('equipment.project_id', projectId!)
        .is('deleted_at', null)
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as EquipmentMaintenance[]
    },
    enabled: !!projectId,
  })
}

export type { Equipment, EquipmentMaintenance }
