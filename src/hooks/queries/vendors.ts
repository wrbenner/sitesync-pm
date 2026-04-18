import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type Vendor = {
  id: string
  project_id: string | null
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  trade: string | null
  license_number: string | null
  insurance_expiry: string | null
  bonding_capacity: number | null
  status: 'active' | 'probation' | 'suspended' | 'blacklisted'
  performance_score: number | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type VendorEvaluation = {
  id: string
  vendor_id: string
  project_id: string | null
  evaluator: string | null
  quality_score: number | null
  schedule_score: number | null
  safety_score: number | null
  communication_score: number | null
  overall_score: number | null
  comments: string | null
  evaluated_at: string
}

export function useVendors(projectId: string | undefined) {
  return useQuery({
    queryKey: ['vendors', projectId],
    queryFn: async () => {
      let q = supabase.from('vendors').select('*').order('company_name', { ascending: true })
      if (projectId) q = q.or(`project_id.eq.${projectId},project_id.is.null`)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as Vendor[]
    },
    enabled: !!projectId,
  })
}

export function useCreateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Vendor> & { company_name: string }) => {
      const { data, error } = await supabase.from('vendors').insert(payload).select().single()
      if (error) throw error
      return data as Vendor
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

export function useUpdateVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; updates: Partial<Vendor> }) => {
      const { data, error } = await supabase
        .from('vendors')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error
      return data as Vendor
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

export function useDeleteVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string }) => {
      const { error } = await supabase.from('vendors').delete().eq('id', params.id)
      if (error) throw error
      return { id: params.id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

export function useVendorEvaluations(vendorId: string | undefined) {
  return useQuery({
    queryKey: ['vendor_evaluations', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_evaluations')
        .select('*')
        .eq('vendor_id', vendorId!)
        .order('evaluated_at', { ascending: false })
      if (error) throw error
      return (data || []) as VendorEvaluation[]
    },
    enabled: !!vendorId,
  })
}

export function useCreateVendorEvaluation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<VendorEvaluation> & { vendor_id: string }) => {
      const { data, error } = await supabase.from('vendor_evaluations').insert(payload).select().single()
      if (error) throw error
      return data as VendorEvaluation
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vendor_evaluations', vars.vendor_id] })
      qc.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}
