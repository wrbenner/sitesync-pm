import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Procurement & Equipment ──────────────────────────────

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['purchase_orders', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('purchase_orders').select('*').eq('project_id' as never, projectId!).order('po_number', { ascending: false })
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
      const { data, error } = await fromTable('deliveries').select('*').eq('project_id' as never, projectId!).order('delivery_date', { ascending: false })
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
      const { data, error } = await fromTable('material_inventory').select('*').eq('project_id' as never, projectId!).order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePOLineItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['po_line_items', projectId],
    queryFn: async () => {
      // Get all PO IDs for this project first, then fetch their line items
      const { data: poData, error: poError } = await fromTable('purchase_orders').select('id').eq('project_id' as never, projectId!)
      if (poError) throw poError
      if (!poData || poData.length === 0) return []
      const poIds = poData.map(po => po.id)
      const { data, error } = await fromTable('po_line_items').select('*').in('purchase_order_id' as never, poIds).order('sort_order', { ascending: true })
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
      const { data, error } = await fromTable('equipment').select('*').eq('project_id' as never, projectId!).order('name', { ascending: true })
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
      const { data, error } = await fromTable('equipment_maintenance').select('*').eq('equipment_id' as never, equipmentId!).order('scheduled_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!equipmentId,
  })
}

// ── Mutations ──────────────────────────────────────────────

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { po: Record<string, unknown>; lineItems: Array<Record<string, unknown>> }) => {
      const { data, error } = await fromTable('purchase_orders').insert(payload.po).select().single()
      if (error) throw error
      if (payload.lineItems.length > 0) {
        const items = payload.lineItems.map((li, i) => ({ ...li, purchase_order_id: data.id, sort_order: i }))
        const { error: liError } = await fromTable('po_line_items').insert(items as never)
        if (liError) throw liError
      }
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase_orders', (vars.po as Record<string, unknown>).project_id] })
    },
  })
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; projectId: string }) => {
      const { error } = await fromTable('purchase_orders').delete().eq('id' as never, payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase_orders', vars.projectId] })
    },
  })
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await fromTable('deliveries').insert(payload as never).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['deliveries', vars.project_id] })
    },
  })
}

export function useDeleteDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; projectId: string }) => {
      const { error } = await fromTable('deliveries').delete().eq('id' as never, payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['deliveries', vars.projectId] })
    },
  })
}

export function useCreateMaterialItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await fromTable('material_inventory').insert(payload as never).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['material_inventory', vars.project_id] })
    },
  })
}
