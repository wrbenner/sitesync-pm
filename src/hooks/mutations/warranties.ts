import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { WarrantyRow } from '../queries/warranties'

export interface CreateWarrantyInput {
  project_id: string
  item: string
  manufacturer?: string | null
  subcontractor?: string | null
  trade?: string | null
  category?: string | null
  warranty_type?: string | null
  start_date?: string | null
  expiration_date?: string | null
  duration_years?: number | null
  status?: string | null
  document_url?: string | null
  coverage_description?: string | null
  limitations?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

export function useCreateWarranty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateWarrantyInput) => {
      const { data, error } = await supabase
        .from('warranties')
        .insert({ status: 'active', ...input })
        .select()
        .single()
      if (error) throw error
      return data as unknown as WarrantyRow
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['warranties', vars.project_id] })
    },
  })
}

export interface UpdateWarrantyInput {
  id: string
  project_id: string
  updates: Partial<Omit<CreateWarrantyInput, 'project_id'>>
}

export function useUpdateWarranty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: UpdateWarrantyInput) => {
      const { data, error } = await supabase
        .from('warranties')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as WarrantyRow
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['warranties', vars.project_id] })
    },
  })
}

export function useDeleteWarranty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('warranties').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['warranties', vars.project_id] })
    },
  })
}
