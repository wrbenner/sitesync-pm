import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getPayApplications, createPayApplication, upsertPayApplication, submitPayApplication, approvePayApplication } from '../../api/endpoints/payApplications'
import type { CreatePayAppPayload } from '../../types/api'



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

export function useCreatePayApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; payload: CreatePayAppPayload }) => {
      return await createPayApplication(params.projectId, params.payload)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pay_applications', vars.projectId] })
    },
  })
}

export function useUpdatePayApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; payload: Parameters<typeof upsertPayApplication>[1] }) => {
      return await upsertPayApplication(params.projectId, params.payload)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pay_applications', vars.projectId] })
    },
  })
}

export function useSubmitPayApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; id: string }) => {
      return await submitPayApplication(params.projectId, params.id)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pay_applications', vars.projectId] })
    },
  })
}

export function useApprovePayApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; id: string }) => {
      return await approvePayApplication(params.projectId, params.id)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pay_applications', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['lien_waivers', vars.projectId] })
    },
  })
}

export function useDeletePayApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; id: string }) => {
      const { error } = await supabase.from('pay_applications').delete().eq('id', params.id).eq('project_id', params.projectId)
      if (error) throw error
      return { id: params.id, projectId: params.projectId }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['pay_applications', result.projectId] })
    },
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
