import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { getPayApplications, createPayApplication, upsertPayApplication, submitPayApplication, approvePayApplication } from '../../api/endpoints/payApplications'
import type { CreatePayAppPayload } from '../../types/api'
import { useAuditedMutation } from '../mutations/createAuditedMutation'
import { payApplicationSchema } from '../../components/forms/schemas'



// ── Financials ───────────────────────────────────────────

export function useContracts(projectId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('contracts').select('*').eq('project_id' as never, projectId!).order('created_at', { ascending: false })
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
  return useAuditedMutation<{ projectId: string; payload: CreatePayAppPayload }, unknown>({
    permission: 'financials.edit',
    schema: payApplicationSchema,
    schemaKey: 'payload',
    action: 'create',
    entityType: 'pay_application',
    getAfterState: (p) => p.payload as unknown as Record<string, unknown>,
    mutationFn: async (params) => {
      return await createPayApplication(params.projectId, params.payload)
    },
    invalidateKeys: (p) => [['pay_applications', p.projectId]],
    analyticsEvent: 'pay_application_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create pay application',
  })
}

export function useUpdatePayApplication() {
  return useAuditedMutation<{ projectId: string; payload: Parameters<typeof upsertPayApplication>[1] }, unknown>({
    permission: 'financials.edit',
    schema: payApplicationSchema.partial(),
    schemaKey: 'payload',
    action: 'update',
    entityType: 'pay_application',
    getEntityId: (p) => p.payload.id,
    getAfterState: (p) => p.payload as unknown as Record<string, unknown>,
    mutationFn: async (params) => {
      return await upsertPayApplication(params.projectId, params.payload)
    },
    invalidateKeys: (p) => [['pay_applications', p.projectId]],
    analyticsEvent: 'pay_application_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update pay application',
  })
}

export function useSubmitPayApplication() {
  return useAuditedMutation<{ projectId: string; id: string }, unknown>({
    permission: 'financials.edit',
    action: 'submit',
    entityType: 'pay_application',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      return await submitPayApplication(params.projectId, params.id)
    },
    invalidateKeys: (p) => [['pay_applications', p.projectId]],
    analyticsEvent: 'pay_application_submitted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to submit pay application',
  })
}

export function useApprovePayApplication() {
  return useAuditedMutation<{ projectId: string; id: string }, unknown>({
    permission: 'budget.approve',
    action: 'approve',
    entityType: 'pay_application',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      return await approvePayApplication(params.projectId, params.id)
    },
    invalidateKeys: (p) => [
      ['pay_applications', p.projectId],
      ['lien_waivers', p.projectId],
    ],
    analyticsEvent: 'pay_application_approved',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to approve pay application',
  })
}

export function useDeletePayApplication() {
  return useAuditedMutation<{ projectId: string; id: string }, { id: string; projectId: string }>({
    permission: 'financials.edit',
    action: 'delete',
    entityType: 'pay_application',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await fromTable('pay_applications').delete().eq('id' as never, params.id).eq('project_id' as never, params.projectId)
      if (error) throw error
      return { id: params.id, projectId: params.projectId }
    },
    invalidateKeys: (p) => [['pay_applications', p.projectId]],
    analyticsEvent: 'pay_application_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete pay application',
  })
}

export function useJobCostEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['job_cost_entries', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('job_cost_entries').select('*').eq('project_id' as never, projectId!).order('date', { ascending: false })
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
      const { data, error } = await fromTable('invoices_payable').select('*').eq('project_id' as never, projectId!).order('due_date', { ascending: true })
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
      const { data, error } = await fromTable('wip_reports').select('*').eq('project_id' as never, projectId!).order('period_end', { ascending: false })
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
      const { data, error } = await fromTable('retainage_ledger').select('*').eq('project_id' as never, projectId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
