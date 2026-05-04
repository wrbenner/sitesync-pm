import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'



// ── Preconstruction ──────────────────────────────────────

export function useEstimates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['estimates', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('estimates')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useEstimateLineItems(estimateId: string | undefined) {
  return useQuery({
    queryKey: ['estimate_line_items', estimateId],
    queryFn: async () => {
      const { data, error } = await fromTable('estimate_line_items')
        .select('*')
        .eq('estimate_id' as never, estimateId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!estimateId,
  })
}

export function useBidPackages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['bid_packages', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('bid_packages')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useBidResponses(bidPackageId: string | undefined) {
  return useQuery({
    queryKey: ['bid_responses', bidPackageId],
    queryFn: async () => {
      const { data, error } = await fromTable('bid_responses')
        .select('*')
        .eq('bid_package_id' as never, bidPackageId!)
        .order('base_bid', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!bidPackageId,
  })
}

export function useTakeoffItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['takeoff_items', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('takeoff_items')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

// ── Mutations ───────────────────────────────────────────

export function useCreateEstimate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await fromTable('estimates').insert(payload as never).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimates', (vars as { project_id?: string }).project_id] })
    },
  })
}

export function useDeleteEstimate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; project_id: string }) => {
      const { error } = await fromTable('estimates').delete().eq('id' as never, payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimates', vars.project_id] })
    },
  })
}

export function useCreateEstimateLineItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await fromTable('estimate_line_items').insert(payload as never).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimate_line_items', (vars as { estimate_id?: string }).estimate_id] })
    },
  })
}

export function useDeleteEstimateLineItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; estimate_id: string }) => {
      const { error } = await fromTable('estimate_line_items').delete().eq('id' as never, payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimate_line_items', vars.estimate_id] })
    },
  })
}

export function useCostDatabase() {
  return useQuery({
    queryKey: ['cost_database'],
    queryFn: async () => {
      const { data, error } = await fromTable('cost_database')
        .select('*')
        .order('csi_code', { ascending: true })
      if (error) throw error
      return data
    },
  })
}
