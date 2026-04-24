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

// Sums schedule_of_values.retainage per contract_id for a set of
// contracts. Returns a Record<contractId, totalRetainage>. Rows with
// null retainage contribute 0.
export function useContractRetainageTotals(contractIds: string[]) {
  const key = [...contractIds].sort().join(',')
  return useQuery({
    queryKey: ['contracts', 'retainage_totals', key],
    queryFn: async (): Promise<Record<string, number>> => {
      if (contractIds.length === 0) return {}
      const { data, error } = await supabase
        .from('schedule_of_values')
        .select('contract_id, retainage')
        .in('contract_id', contractIds)
      if (error) throw error
      const totals: Record<string, number> = {}
      for (const row of (data ?? []) as Array<{ contract_id: string; retainage: number | null }>) {
        totals[row.contract_id] = (totals[row.contract_id] ?? 0) + (row.retainage ?? 0)
      }
      return totals
    },
    enabled: contractIds.length > 0,
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
