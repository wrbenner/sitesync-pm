import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type { Equipment, EquipmentMaintenance } from '../../services/equipmentService'

export function useEquipment(projectId: string | undefined) {
  return useQuery({
    queryKey: ['equipment', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('equipment')
        .select('*')
        .eq('project_id' as never, projectId!)
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
      const { data, error } = await fromTable('equipment_maintenance')
        .select('*, equipment!inner(project_id)')
        .eq('equipment.project_id' as never, projectId!)
        .is('deleted_at' as never, null)
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as EquipmentMaintenance[]
    },
    enabled: !!projectId,
  })
}

export type { Equipment, EquipmentMaintenance }
