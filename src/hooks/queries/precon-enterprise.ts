import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

export type PreconBidPackage = {
  id: string
  project_id: string
  package_number: string
  title: string
  description: string | null
  csi_division: number | null
  trade: string | null
  estimated_value: number
  bid_due_date: string | null
  status: 'draft' | 'issued' | 'receiving_bids' | 'evaluating' | 'awarded' | 'cancelled'
  awarded_to: string | null
  awarded_amount: number | null
  scope_documents: unknown
  created_by: string | null
  created_at: string
}

export type PreconBidSubmission = {
  id: string
  bid_package_id: string
  bidder_name: string
  bidder_company: string | null
  bid_amount: number
  submitted_at: string
  notes: string | null
  file_url: string | null
  status: 'received' | 'under_review' | 'shortlisted' | 'accepted' | 'rejected'
  evaluation_score: number | null
}

export function usePreconBidPackages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_packages', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('precon_bid_packages')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as PreconBidPackage[]
    },
    enabled: !!projectId,
  })
}

export function useCreatePreconBidPackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconBidPackage> & { project_id: string; package_number: string; title: string }) => {
      const { data, error } = await fromTable('precon_bid_packages').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as PreconBidPackage
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['precon_bid_packages', vars.project_id] })
    },
  })
}

export function useUpdatePreconBidPackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PreconBidPackage> }) => {
      const { data, error } = await fromTable('precon_bid_packages').update(patch as never).eq('id' as never, id).select().single()
      if (error) throw error
      return data as unknown as PreconBidPackage
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_packages'] })
    },
  })
}

export function usePreconBidSubmissions(packageId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_submissions', packageId],
    queryFn: async () => {
      const { data, error } = await fromTable('precon_bid_submissions')
        .select('*')
        .eq('bid_package_id' as never, packageId!)
        .order('bid_amount', { ascending: true })
      if (error) throw error
      return (data || []) as unknown as PreconBidSubmission[]
    },
    enabled: !!packageId,
  })
}

export function useAllPreconBidSubmissions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_submissions_all', projectId],
    queryFn: async () => {
      const { data: pkgs, error: pErr } = await fromTable('precon_bid_packages')
        .select('id')
        .eq('project_id' as never, projectId!)
      if (pErr) throw pErr
      const ids = (pkgs || []).map((p) => (p as { id: string }).id)
      if (ids.length === 0) return [] as PreconBidSubmission[]
      const { data, error } = await fromTable('precon_bid_submissions')
        .select('*')
        .in('bid_package_id' as never, ids as never[])
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as PreconBidSubmission[]
    },
    enabled: !!projectId,
  })
}

export function useCreatePreconBidSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconBidSubmission> & { bid_package_id: string; bidder_name: string; bid_amount: number }) => {
      const { data, error } = await fromTable('precon_bid_submissions').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as PreconBidSubmission
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions', vars.bid_package_id] })
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions_all'] })
    },
  })
}
