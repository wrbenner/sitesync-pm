import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'

const from = (table: string) => fromTable(table as never)
import { toast } from 'sonner'
import type {
  EstimatingItem,
  EstimateRollup,
  BidSubmission,
  BidSubmissionStatus,
} from '../queries/estimating'

// ── Estimating Items ─────────────────────────────────────

export interface CreateEstimatingItemInput {
  project_id: string
  bid_package_id?: string | null
  vendor_id?: string | null
  cost_code?: string | null
  description: string
  quantity: number
  unit?: string | null
  unit_cost: number
  category?: string | null
  notes?: string | null
}

export function useCreateEstimatingItem() {
  const qc = useQueryClient()
  return useMutation<EstimatingItem, Error, CreateEstimatingItemInput>({
    mutationFn: async (input) => {
      const { data, error } = await from('estimating_items')
        .insert(input as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as EstimatingItem
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimating_items', vars.project_id] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create line item')
    },
  })
}

export function useUpdateEstimatingItem() {
  const qc = useQueryClient()
  return useMutation<
    EstimatingItem,
    Error,
    { id: string; projectId: string; patch: Partial<EstimatingItem> }
  >({
    mutationFn: async ({ id, patch }) => {
      // total_cost is generated; never patch it directly
      const cleanPatch = { ...patch }
      delete (cleanPatch as Record<string, unknown>).total_cost
      const { data, error } = await from('estimating_items')
        .update(cleanPatch as never)
        .eq('id' as never, id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as EstimatingItem
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimating_items', vars.projectId] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update line item')
    },
  })
}

export function useDeleteEstimatingItem() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; projectId: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await from('estimating_items')
        .delete()
        .eq('id' as never, id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimating_items', vars.projectId] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete line item')
    },
  })
}

// ── Estimate Rollups ─────────────────────────────────────

export interface UpsertRollupInput {
  project_id: string
  division: string
  total_estimated: number
  total_committed: number
  as_of?: string
}

export function useUpsertEstimateRollup() {
  const qc = useQueryClient()
  return useMutation<EstimateRollup, Error, UpsertRollupInput>({
    mutationFn: async (input) => {
      const payload = {
        ...input,
        as_of: input.as_of ?? new Date().toISOString().slice(0, 10),
      }
      const { data, error } = await from('estimate_rollups')
        .upsert(payload as never, { onConflict: 'project_id,division,as_of' })
        .select()
        .single()
      if (error) throw error
      return data as unknown as EstimateRollup
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimate_rollups', vars.project_id] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save rollup')
    },
  })
}

export function useDeleteEstimateRollup() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; projectId: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await from('estimate_rollups').delete().eq('id' as never, id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['estimate_rollups', vars.projectId] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete rollup')
    },
  })
}

// ── Bid Submissions ──────────────────────────────────────

export interface CreateBidSubmissionInput {
  bid_package_id: string
  vendor_id?: string | null
  amount: number
  status?: BidSubmissionStatus
  submitted_at?: string | null
  notes?: string | null
}

export function useCreateBidSubmission() {
  const qc = useQueryClient()
  return useMutation<BidSubmission, Error, CreateBidSubmissionInput>({
    mutationFn: async (input) => {
      const payload = {
        ...input,
        status: input.status ?? 'submitted',
        submitted_at: input.submitted_at ?? new Date().toISOString(),
      }
      const { data, error } = await from('bid_submissions')
        .insert(payload as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as BidSubmission
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bid_submissions', vars.bid_package_id] })
      qc.invalidateQueries({ queryKey: ['bid_submissions', 'all'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to record submission')
    },
  })
}

export function useUpdateBidSubmission() {
  const qc = useQueryClient()
  return useMutation<
    BidSubmission,
    Error,
    { id: string; bid_package_id: string; patch: Partial<BidSubmission> }
  >({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await from('bid_submissions')
        .update(patch as never)
        .eq('id' as never, id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as BidSubmission
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bid_submissions', vars.bid_package_id] })
      qc.invalidateQueries({ queryKey: ['bid_submissions', 'all'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update submission')
    },
  })
}

// Awards a submission: sets status='awarded', stamps awarded_at, and
// marks every other submission on the same package as 'declined'.
// Lives here because the orchestration — single awarded winner +
// remaining declined — is the behavior the Award button needs.
export function useAwardBidSubmission() {
  const qc = useQueryClient()
  return useMutation<
    BidSubmission,
    Error,
    { id: string; bid_package_id: string }
  >({
    mutationFn: async ({ id, bid_package_id }) => {
      const now = new Date().toISOString()
      const { data: awarded, error: awardErr } = await from('bid_submissions')
        .update({ status: 'awarded', awarded_at: now } as never)
        .eq('id' as never, id)
        .select()
        .single()
      if (awardErr) throw awardErr
      const { error: declineErr } = await from('bid_submissions')
        .update({ status: 'declined' } as never)
        .eq('bid_package_id' as never, bid_package_id)
        .neq('id' as never, id)
        .not('status' as never, 'eq', 'awarded')
      if (declineErr) throw declineErr
      return awarded as unknown as BidSubmission
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bid_submissions', vars.bid_package_id] })
      qc.invalidateQueries({ queryKey: ['bid_submissions', 'all'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to award bid')
    },
  })
}

export function useDeleteBidSubmission() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; bid_package_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await from('bid_submissions').delete().eq('id' as never, id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['bid_submissions', vars.bid_package_id] })
      qc.invalidateQueries({ queryKey: ['bid_submissions', 'all'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete submission')
    },
  })
}
