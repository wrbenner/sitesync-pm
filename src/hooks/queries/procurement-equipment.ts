import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Procurement & Equipment ──────────────────────────────

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['purchase_orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders').select('*').eq('project_id', projectId!).order('po_number', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useDeliveries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['deliveries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('project_id', projectId!).order('delivery_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useMaterialInventory(projectId: string | undefined) {
  return useQuery({
    queryKey: ['material_inventory', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('material_inventory').select('*').eq('project_id', projectId!).order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useEquipment(projectId: string | undefined) {
  return useQuery({
    queryKey: ['equipment', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment').select('*').eq('current_project_id', projectId!).order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useEquipmentMaintenance(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['equipment_maintenance', equipmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment_maintenance').select('*').eq('equipment_id', equipmentId!).order('scheduled_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!equipmentId,
  })
}
