import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

const from = (table: string) => fromTable(table as never)

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
      const { data, error } = await from('precon_subcontractors')
        .select('*')
        .eq('organization_id' as never, organizationId!)
        .order('company_name', { ascending: true })
      if (error) throw error
      return ((data || []) as unknown) as PreconSubcontractor[]
    },
    enabled: !!organizationId,
  })
}

export function useCreatePreconSubcontractor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconSubcontractor> & { organization_id: string; company_name: string }) => {
      const { data, error } = await from('precon_subcontractors').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as PreconSubcontractor
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
      const { data, error } = await from('precon_subcontractors').update(patch as never).eq('id' as never, id).select().single()
      if (error) throw error
      return data as unknown as PreconSubcontractor
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
      const { error } = await from('precon_subcontractors').delete().eq('id' as never, id)
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
      const { data, error } = await from('precon_bid_invitations')
        .select('*')
        .eq('bid_package_id' as never, bidPackageId!)
        .order('invited_at', { ascending: false })
      if (error) throw error
      return ((data || []) as unknown) as PreconBidInvitation[]
    },
    enabled: !!bidPackageId,
  })
}

export function useAllProjectInvitations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['precon_bid_invitations_all', projectId],
    queryFn: async () => {
      const { data: pkgs, error: pErr } = await from('precon_bid_packages')
        .select('id')
        .eq('project_id' as never, projectId!)
      if (pErr) throw pErr
      const ids = ((pkgs || []) as unknown as Array<{ id: string }>).map((p) => p.id)
      if (ids.length === 0) return [] as PreconBidInvitation[]
      const { data, error } = await from('precon_bid_invitations')
        .select('*')
        .in('bid_package_id' as never, ids)
        .order('invited_at', { ascending: false })
      if (error) throw error
      return ((data || []) as unknown) as PreconBidInvitation[]
    },
    enabled: !!projectId,
  })
}

export function useCreatePreconBidInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconBidInvitation> & { bid_package_id: string; company_name: string }) => {
      const { data, error } = await from('precon_bid_invitations').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as PreconBidInvitation
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
      const { data, error } = await from('precon_bid_invitations').update(patch as never).eq('id' as never, id).select().single()
      if (error) throw error
      return data as unknown as PreconBidInvitation
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
      const { error } = await from('precon_bid_invitations').delete().eq('id' as never, id)
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
      const { data, error } = await from('precon_scope_items')
        .select('*')
        .eq('bid_package_id' as never, bidPackageId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data || []) as unknown) as PreconScopeItem[]
    },
    enabled: !!bidPackageId,
  })
}

export function useCreatePreconScopeItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PreconScopeItem> & { bid_package_id: string; description: string }) => {
      const { data, error } = await from('precon_scope_items').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as PreconScopeItem
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
      const { data, error } = await from('precon_scope_items').update(patch as never).eq('id' as never, id).select().single()
      if (error) throw error
      return data as unknown as PreconScopeItem
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
      const { error } = await from('precon_scope_items').delete().eq('id' as never, id)
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
      const { data, error } = await from('precon_scope_items').insert(items as never).select()
      if (error) throw error
      return ((data || []) as unknown) as PreconScopeItem[]
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
      const { data: items, error: iErr } = await from('precon_scope_items')
        .select('id')
        .eq('bid_package_id' as never, bidPackageId!)
      if (iErr) throw iErr
      const itemIds = ((items || []) as unknown as Array<{ id: string }>).map((i) => i.id)
      if (itemIds.length === 0) return [] as PreconBidScopeResponse[]
      const { data, error } = await from('precon_bid_scope_responses')
        .select('*')
        .in('scope_item_id' as never, itemIds)
      if (error) throw error
      return ((data || []) as unknown) as PreconBidScopeResponse[]
    },
    enabled: !!bidPackageId,
  })
}

export function useUpsertPreconBidScopeResponse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { scope_item_id: string; bid_submission_id: string; response: string; qualification_note?: string; cost_impact?: number }) => {
      const { data, error } = await from('precon_bid_scope_responses')
        .upsert(payload as never, { onConflict: 'scope_item_id,bid_submission_id' })
        .select()
        .single()
      if (error) throw error
      return data as unknown as PreconBidScopeResponse
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
      const { error } = await from('precon_bid_packages').delete().eq('id' as never, id)
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
      const { data, error } = await from('precon_bid_submissions').update(patch as never).eq('id' as never, id).select().single()
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
      const { error } = await from('precon_bid_submissions').delete().eq('id' as never, id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions'] })
      qc.invalidateQueries({ queryKey: ['precon_bid_submissions_all'] })
    },
  })
}
