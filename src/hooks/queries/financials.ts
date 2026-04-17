import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getPayApplications } from '../../api/endpoints/payApplications'



// ── Financials ───────────────────────────────────────────

export function useContracts(projectId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePayApplications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['pay_applications', projectId],
    queryFn: () => getPayApplications(projectId!),
    enabled: !!projectId,
  })
}

export function useJobCostEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['job_cost_entries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('job_cost_entries').select('*').eq('project_id', projectId!).order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useInvoicesPayable(projectId: string | undefined) {
  return useQuery({
    queryKey: ['invoices_payable', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices_payable').select('*').eq('project_id', projectId!).order('due_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWipReports(projectId: string | undefined) {
  return useQuery({
    queryKey: ['wip_reports', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wip_reports').select('*').eq('project_id', projectId!).order('period_end', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useRetainageLedger(projectId: string | undefined) {
  return useQuery({
    queryKey: ['retainage_ledger', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('retainage_ledger').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
