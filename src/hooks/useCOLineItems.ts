import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getCOLineItems,
  createCOLineItem,
  updateCOLineItem,
  deleteCOLineItem,
  type COLineItem,
  type CreateCOLineItemPayload,
  type UpdateCOLineItemPayload,
} from '../services/changeOrderLineItemService'

/**
 * Fetch line items for a change order.
 */
export function useCOLineItems(changeOrderId: string | null | undefined) {
  return useQuery<COLineItem[]>({
    queryKey: ['co_line_items', changeOrderId],
    queryFn: () => getCOLineItems(changeOrderId!),
    enabled: !!changeOrderId,
    staleTime: 30_000,
  })
}

/**
 * Mutation hooks for CRUD on CO line items.
 */
export function useCreateCOLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCOLineItemPayload) => createCOLineItem(payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['co_line_items', vars.change_order_id] })
      queryClient.invalidateQueries({ queryKey: ['costData'] })
      toast.success('Line item added')
    },
    onError: () => toast.error('Failed to add line item'),
  })
}

export function useUpdateCOLineItem(changeOrderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCOLineItemPayload }) =>
      updateCOLineItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co_line_items', changeOrderId] })
      queryClient.invalidateQueries({ queryKey: ['costData'] })
      toast.success('Line item updated')
    },
    onError: () => toast.error('Failed to update line item'),
  })
}

export function useDeleteCOLineItem(changeOrderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lineItemId: string) => deleteCOLineItem(lineItemId, changeOrderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co_line_items', changeOrderId] })
      queryClient.invalidateQueries({ queryKey: ['costData'] })
      toast.success('Line item removed')
    },
    onError: () => toast.error('Failed to remove line item'),
  })
}
