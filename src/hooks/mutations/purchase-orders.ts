import { useMutation, useQueryClient } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

type POPayload = Record<string, unknown>
type LineItemPayload = Record<string, unknown>

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { po: POPayload; lineItems?: LineItemPayload[] }) => {
      const { data, error } = await fromTable('purchase_orders')
        .insert(payload.po as never)
        .select()
        .single()
      if (error) throw error
      const items = payload.lineItems ?? []
      if (items.length > 0) {
        const rows = items.map((li, i) => ({ ...li, purchase_order_id: data.id, sort_order: i }))
        const { error: liError } = await fromTable('po_line_items').insert(rows as never)
        if (liError) throw liError
      }
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase_orders', (vars.po as POPayload).project_id] })
      qc.invalidateQueries({ queryKey: ['po_line_items'] })
    },
  })
}

export function useUpdatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; projectId: string; updates: POPayload }) => {
      const { data, error } = await fromTable('purchase_orders')
        .update(payload.updates as never)
        .eq('id' as never, payload.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase_orders', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['purchase_orders', 'detail', vars.id] })
    },
  })
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; projectId: string }) => {
      const { error } = await fromTable('purchase_orders').delete().eq('id' as never, payload.id)
      if (error) throw error
      return payload
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase_orders', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['po_line_items'] })
    },
  })
}
