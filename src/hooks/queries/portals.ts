import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Portals ──────────────────────────────────────────────

export function usePortalInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['portal_invitations', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_invitations')
        .select('*')
        .eq('project_id', projectId!)
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
      const { data, error } = await supabase
        .from('owner_updates')
        .select('*')
        .eq('project_id', projectId!)
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
      const { data, error } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('project_id', projectId!)
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
      const { data, error } = await supabase
        .from('insurance_certificates')
        .select('*')
        .eq('project_id', projectId!)
        .order('expiration_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
