import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { useAuditedMutation } from '../mutations/createAuditedMutation'
import { vendorSchema } from '../../components/forms/schemas'

export type Vendor = {
  id: string
  project_id: string | null
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  trade: string | null
  license_number: string | null
  insurance_expiry: string | null
  bonding_capacity: number | null
  status: 'active' | 'probation' | 'suspended' | 'blacklisted'
  performance_score: number | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type VendorEvaluation = {
  id: string
  vendor_id: string
  project_id: string | null
  evaluator: string | null
  quality_score: number | null
  schedule_score: number | null
  safety_score: number | null
  communication_score: number | null
  overall_score: number | null
  comments: string | null
  evaluated_at: string
}

// Strict UUIDv1-v5 shape so we never send a malformed value into the
// PostgREST `.eq.` filter. Hex blocks separated by hyphens, version
// nibble in {1..5}, variant nibble in {8,9,a,b}. PostgREST 400s on a
// bad UUID, which is what was producing the sporadic /estimating + /bim
// vendors warnings during the verification crawl.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function useVendors(projectId: string | undefined) {
  const valid = !!projectId && UUID_RE.test(projectId)
  return useQuery({
    queryKey: ['vendors', projectId ?? null],
    queryFn: async () => {
      // Two scoped queries (project-specific + globals) merged in JS,
      // instead of `.or('project_id.eq.X,project_id.is.null')`. This
      // sidesteps PostgREST's embedded-filter parsing edge cases and
      // makes RLS evaluation simpler on each branch.
      const [scoped, globals] = await Promise.all([
        fromTable('vendors')
          .select('*')
          .eq('project_id' as never, projectId!)
          .order('company_name', { ascending: true }),
        fromTable('vendors')
          .select('*')
          .is('project_id' as never, null)
          .order('company_name', { ascending: true }),
      ])
      if (scoped.error) throw scoped.error
      if (globals.error) throw globals.error
      const combined = [...(scoped.data ?? []), ...(globals.data ?? [])]
      // Stable sort by company_name across the merged set.
      combined.sort((a, b) =>
        ((a.company_name as string) ?? '').localeCompare((b.company_name as string) ?? '')
      )
      return combined as Vendor[]
    },
    enabled: valid,
  })
}

export function useCreateVendor() {
  return useAuditedMutation<Partial<Vendor> & { company_name: string }, Vendor>({
    permission: 'directory.manage',
    schema: vendorSchema.partial().required({ company_name: true }),
    action: 'create',
    entityType: 'vendor',
    getEntityTitle: (p) => p.company_name,
    getAfterState: (p) => p as unknown as Record<string, unknown>,
    mutationFn: async (payload) => {
      const { data, error } = await fromTable('vendors').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as Vendor
    },
    invalidateKeys: () => [['vendors']],
    analyticsEvent: 'vendor_created',
    errorMessage: 'Failed to create vendor',
  })
}

export function useUpdateVendor() {
  return useAuditedMutation<{ id: string; updates: Partial<Vendor> }, Vendor>({
    permission: 'directory.manage',
    schema: vendorSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'vendor',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates as unknown as Record<string, unknown>,
    mutationFn: async (params) => {
      const { data, error } = await fromTable('vendors')
        .update(params.updates)
        .eq('id' as never, params.id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Vendor
    },
    invalidateKeys: () => [['vendors']],
    analyticsEvent: 'vendor_updated',
    errorMessage: 'Failed to update vendor',
  })
}

export function useDeleteVendor() {
  return useAuditedMutation<{ id: string }, { id: string }>({
    permission: 'directory.manage',
    action: 'delete',
    entityType: 'vendor',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await fromTable('vendors').delete().eq('id' as never, params.id)
      if (error) throw error
      return { id: params.id }
    },
    invalidateKeys: () => [['vendors']],
    analyticsEvent: 'vendor_deleted',
    errorMessage: 'Failed to delete vendor',
  })
}

export function useVendorEvaluations(vendorId: string | undefined) {
  return useQuery({
    queryKey: ['vendor_evaluations', vendorId],
    queryFn: async () => {
      const { data, error } = await fromTable('vendor_evaluations')
        .select('*')
        .eq('vendor_id' as never, vendorId!)
        .order('evaluated_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as VendorEvaluation[]
    },
    enabled: !!vendorId,
  })
}

export function useCreateVendorEvaluation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<VendorEvaluation> & { vendor_id: string }) => {
      const { data, error } = await fromTable('vendor_evaluations').insert(payload as never).select().single()
      if (error) throw error
      return data as unknown as VendorEvaluation
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vendor_evaluations', vars.vendor_id] })
      qc.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}
