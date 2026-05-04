import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Portals ──────────────────────────────────────────────

export function usePortalInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['portal_invitations', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('portal_invitations')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useOwnerUpdates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['owner_updates', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('owner_updates')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useSubcontractorInvoices(projectId: string | undefined) {
  return useQuery({
    queryKey: ['subcontractor_invoices', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('subcontractor_invoices')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useInsuranceCertificates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['insurance_certificates', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('insurance_certificates')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('expiration_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
