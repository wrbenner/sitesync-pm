import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────

export type PreconSubcontractor = {
  id: string
  organization_id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  primary_trade: string | null
  csi_divisions: number[]
  prequalified: boolean
  prequalified_at: string | null
  bonding_limit: number | null
  insurance_verified: boolean
  license_number: string | null
  rating: number | null
  projects_completed: number
  avg_bid_accuracy: number | null
  notes: string | null
  tags: string[]
  status: 'active' | 'inactive' | 'blacklisted' | 'pending_review'
  created_at: string
  updated_at: string
}

export type PreconBidInvitation = {
  id: string
  bid_package_id: string
  subcontractor_id: string | null
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  status: 'invited' | 'viewed' | 'bidding' | 'declined' | 'submitted' | 'no_response'
  invited_at: string
  viewed_at: string | null
  responded_at: string | null
  decline_reason: string | null
  notes: string | null
  bid_submission_id: string | null
  created_at: string
}

export type PreconScopeItem = {
  id: string
  bid_package_id: string
  description: string
  category: string | null
  sort_order: number
  required: boolean
  created_at: string
}

export type PreconBidScopeResponse = {
  id: string
  scope_item_id: string
  bid_submission_id: string
  response: 'included' | 'excluded' | 'qualified' | 'unknown'
  qualification_note: string | null
  cost_impact: number | null
  created_at: string
}

// ── Subcontractors ────────────────────────────────────────

export function usePreconSubcontractors(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['precon_subcontractors', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precon_subcontractors')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('company_name', { ascending: true })
      if (error) throw error
      return (data || []) as PreconSubcontractor[]
    },
    enabled: !!organizationId,
  })
}

export function useCreatePreconSubcontractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconSubcontractor> & { organization_id: string; company_name: string }) => {
      const { data, error } = await supabase.from('precon_subcontractors').insert(payload).select().single()
      if (error) throw error
      return data as PreconSubcontractor
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['precon_subcontractors', vars.organization_id] })
    },
  })
}

export function useUpdatePreconSubcontractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PreconSubcontractor> }) => {
      const { data, error } = await supabase.from('precon_subcontractors').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as PreconSubcontractor
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_subcontractors'] })
    },
  })
}

export function useDeletePreconSubcontractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precon_subcontractors').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_subcontractors'] })
    },
  })
}

// ── Bid Invitations ───────────────────────────────────────

export function usePreconBidInvitations(bidPackageId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_invitations', bidPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precon_bid_invitations')
        .select('*')
        .eq('bid_package_id', bidPackageId!)
        .order('invited_at', { ascending: false })
      if (error) throw error
      return (data || []) as PreconBidInvitation[]
    },
    enabled: !!bidPackageId,
  })
}

export function useAllProjectInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_invitations_all', projectId],
    queryFn: async () => {
      const { data: pkgs, error: pErr } = await supabase
        .from('precon_bid_packages')
        .select('id')
        .eq('project_id', projectId!)
      if (pErr) throw pErr
      const ids = (pkgs || []).map((p: { id: string }) => p.id)
      if (ids.length === 0) return [] as PreconBidInvitation[]
      const { data, error } = await supabase
        .from('precon_bid_invitations')
        .select('*')
        .in('bid_package_id', ids)
        .order('invited_at', { ascending: false })
      if (error) throw error
      return (data || []) as PreconBidInvitation[]
    },
    enabled: !!projectId,
  })
}

export function useCreatePreconBidInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconBidInvitation> & { bid_package_id: string; company_name: string }) => {
      const { data, error } = await supabase.from('precon_bid_invitations').insert(payload).select().single()
      if (error) throw error
      return data as PreconBidInvitation
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['precon_bid_invitations', vars.bid_package_id] })
      qc.invalidateQueries({ queryKey: ['precon_bid_invitations_all'] })
    },
  })
}

export function useUpdatePreconBidInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PreconBidInvitation> }) => {
      const { data, error } = await supabase.from('precon_bid_invitations').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as PreconBidInvitation
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_invitations'] })
      qc.invalidateQueries({ queryKey: ['precon_bid_invitations_all'] })
    },
  })
}

export function useDeletePreconBidInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precon_bid_invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_invitations'] })
      qc.invalidateQueries({ queryKey: ['precon_bid_invitations_all'] })
    },
  })
}

// ── Scope Items ───────────────────────────────────────────

export function usePreconScopeItems(bidPackageId: string | undefined) {
  return useQuery({
    queryKey: ['precon_scope_items', bidPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precon_scope_items')
        .select('*')
        .eq('bid_package_id', bidPackageId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data || []) as PreconScopeItem[]
    },
    enabled: !!bidPackageId,
  })
}

export function useCreatePreconScopeItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconScopeItem> & { bid_package_id: string; description: string }) => {
      const { data, error } = await supabase.from('precon_scope_items').insert(payload).select().single()
      if (error) throw error
      return data as PreconScopeItem
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['precon_scope_items', vars.bid_package_id] })
    },
  })
}

export function useUpdatePreconScopeItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PreconScopeItem> }) => {
      const { data, error } = await supabase.from('precon_scope_items').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as PreconScopeItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_scope_items'] })
    },
  })
}

export function useDeletePreconScopeItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precon_scope_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_scope_items'] })
    },
  })
}

export function useBulkCreatePreconScopeItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<Partial<PreconScopeItem> & { bid_package_id: string; description: string }>) => {
      const { data, error } = await supabase.from('precon_scope_items').insert(items).select()
      if (error) throw error
      return (data || []) as PreconScopeItem[]
    },
    onSuccess: (_d, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ['precon_scope_items', vars[0].bid_package_id] })
      }
    },
  })
}

// ── Bid Scope Responses ───────────────────────────────────

export function usePreconBidScopeResponses(bidPackageId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_scope_responses', bidPackageId],
    queryFn: async () => {
      // Get all scope items for this package
      const { data: items, error: iErr } = await supabase
        .from('precon_scope_items')
        .select('id')
        .eq('bid_package_id', bidPackageId!)
      if (iErr) throw iErr
      const itemIds = (items || []).map((i: { id: string }) => i.id)
      if (itemIds.length === 0) return [] as PreconBidScopeResponse[]
      const { data, error } = await supabase
        .from('precon_bid_scope_responses')
        .select('*')
        .in('scope_item_id', itemIds)
      if (error) throw error
      return (data || []) as PreconBidScopeResponse[]
    },
    enabled: !!bidPackageId,
  })
}

export function useUpsertPreconBidScopeResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { scope_item_id: string; bid_submission_id: string; response: string; qualification_note?: string; cost_impact?: number }) => {
      const { data, error } = await supabase
        .from('precon_bid_scope_responses')
        .upsert(payload, { onConflict: 'scope_item_id,bid_submission_id' })
        .select()
        .single()
      if (error) throw error
      return data as PreconBidScopeResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_scope_responses'] })
    },
  })
}

// ── Extended Bid Package Operations ───────────────────────

export function useDeletePreconBidPackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precon_bid_packages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_packages'] })
    },
  })
}

// ── Extended Bid Submission Operations ────────────────────

export function useUpdatePreconBidSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('precon_bid_submissions').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions'] })
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions_all'] })
    },
  })
}

export function useDeletePreconBidSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precon_bid_submissions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions'] })
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions_all'] })
    },
  })
}
