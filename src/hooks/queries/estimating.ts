import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

// ── Types ────────────────────────────────────────────────

export interface EstimatingItem {
  id: string
  project_id: string
  bid_package_id: string | null
  vendor_id: string | null
  cost_code: string | null
  description: string
  quantity: number
  unit: string | null
  unit_cost: number
  total_cost: number
  category: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EstimateRollup {
  id: string
  project_id: string
  division: string
  total_estimated: number
  total_committed: number
  as_of: string
  created_at: string
  updated_at: string
}

export type BidSubmissionStatus =
  | 'pending'
  | 'submitted'
  | 'shortlisted'
  | 'awarded'
  | 'declined'

export interface BidSubmission {
  id: string
  bid_package_id: string
  vendor_id: string | null
  amount: number
  status: BidSubmissionStatus
  submitted_at: string | null
  awarded_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Estimating Items ─────────────────────────────────────

export function useEstimatingItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['estimating_items', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<EstimatingItem[]> => {
      const { data, error } = await fromTable('estimating_items')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as EstimatingItem[]
    },
  })
}

// ── Estimate Rollups ─────────────────────────────────────

export function useEstimateRollups(projectId: string | undefined) {
  return useQuery({
    queryKey: ['estimate_rollups', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<EstimateRollup[]> => {
      const { data, error } = await fromTable('estimate_rollups')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('as_of', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as EstimateRollup[]
    },
  })
}

// Fetches the single most recent rollup per division — used as the
// "current" line in the Rollups tab (one row per division).
export function useLatestRollupsByDivision(projectId: string | undefined) {
  return useQuery({
    queryKey: ['estimate_rollups', 'latest_by_division', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<EstimateRollup[]> => {
      const { data, error } = await fromTable('estimate_rollups')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('as_of', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as EstimateRollup[]
      const byDivision = new Map<string, EstimateRollup>()
      for (const r of rows) {
        if (!byDivision.has(r.division)) byDivision.set(r.division, r)
      }
      return Array.from(byDivision.values())
    },
  })
}

// ── Bid Submissions ──────────────────────────────────────

export function useBidSubmissions(bidPackageId: string | undefined) {
  return useQuery({
    queryKey: ['bid_submissions', bidPackageId],
    enabled: !!bidPackageId,
    queryFn: async (): Promise<BidSubmission[]> => {
      const { data, error } = await fromTable('bid_submissions')
        .select('*')
        .eq('bid_package_id' as never, bidPackageId!)
        .order('amount', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as BidSubmission[]
    },
  })
}

// All submissions for a project, via bid_packages JOIN.
export function useAllBidSubmissions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['bid_submissions', 'all', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<BidSubmission[]> => {
      const { data: pkgs, error: pErr } = await fromTable('bid_packages')
        .select('id')
        .eq('project_id' as never, projectId!)
      if (pErr) throw pErr
      const ids = (pkgs ?? []).map((p: { id: string }) => p.id)
      if (ids.length === 0) return []
      const { data, error } = await fromTable('bid_submissions')
        .select('*')
        .in('bid_package_id' as never, ids)
        .order('amount', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as BidSubmission[]
    },
  })
}
