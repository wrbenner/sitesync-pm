import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type PurchaseOrder = {
  id: string
  project_id: string
  po_number: number
  vendor_name: string
  vendor_contact: string | null
  vendor_email: string | null
  vendor_phone: string | null
  description: string | null
  status: 'draft' | 'issued' | 'acknowledged' | 'partially_received' | 'fully_received' | 'closed' | 'cancelled'
  subtotal: number | null
  tax: number | null
  shipping: number | null
  total: number | null
  issued_date: string | null
  required_date: string | null
  received_date: string | null
  delivery_address: string | null
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  budget_item_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type POLineItem = {
  id: string
  purchase_order_id: string
  description: string
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  total_cost: number | null
  quantity_received: number | null
  csi_code: string | null
  notes: string | null
  sort_order: number | null
  created_at: string
}

export function usePurchaseOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['purchase_orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('project_id', projectId!)
        .order('po_number', { ascending: false })
      if (error) throw error
      return (data ?? []) as PurchaseOrder[]
    },
    enabled: !!projectId,
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase_orders', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as PurchaseOrder
    },
    enabled: !!id,
  })
}

export function usePOLineItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['po_line_items', projectId],
    queryFn: async () => {
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('project_id', projectId!)
      if (poError) throw poError
      if (!poData || poData.length === 0) return [] as POLineItem[]
      const poIds = poData.map((po) => po.id as string)
      const { data, error } = await supabase
        .from('po_line_items')
        .select('*')
        .in('purchase_order_id', poIds)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as POLineItem[]
    },
    enabled: !!projectId,
  })
}

export function usePOLineItemsByPO(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: ['po_line_items', 'by_po', purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('purchase_order_id', purchaseOrderId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as POLineItem[]
    },
    enabled: !!purchaseOrderId,
  })
}
