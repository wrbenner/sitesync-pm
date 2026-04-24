import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type Contract = {
  id: string
  project_id: string
  contract_type: string | null
  type: string | null
  contract_number: string | null
  title: string
  counterparty_name: string | null
  counterparty: string | null
  counterparty_contact: string | null
  counterparty_email: string | null
  contract_amount: number | null
  original_value: number | null
  revised_value: number | null
  retention_percentage: number | null
  retainage_percent: number | null
  start_date: string | null
  end_date: string | null
  executed_date: string | null
  status: string
  scope_of_work: string | null
  payment_terms: string | null
  billing_method: string | null
  insurance_required: boolean | null
  bonding_required: boolean | null
  documents: unknown
  file_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useContracts(projectId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Contract[]
    },
    enabled: !!projectId,
  })
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Contract
    },
    enabled: !!id,
  })
}
