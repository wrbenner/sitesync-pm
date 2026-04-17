import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Preconstruction ──────────────────────────────────────

export function useEstimates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['estimates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('project_id', projectId!)
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
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId!)
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
      const { data, error } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('project_id', projectId!)
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
      const { data, error } = await supabase
        .from('bid_responses')
        .select('*')
        .eq('bid_package_id', bidPackageId!)
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
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useCostDatabase() {
  return useQuery({
    queryKey: ['cost_database'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_database')
        .select('*')
        .order('csi_code', { ascending: true })
      if (error) throw error
      return data
    },
  })
}
