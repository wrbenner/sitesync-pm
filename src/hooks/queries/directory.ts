import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Types ────────────────────────────────────────────────

export type PrequalStatus =
  | 'not_started'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export interface PrequalificationRow {
  id: string
  project_id: string
  company_id: string
  status: PrequalStatus
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  expires_at: string | null
  bonding_capacity: string | null
  insurance_limits: string | null
  emr_rate: number | null
  years_in_business: number | null
  license_numbers: string | null
  documents: unknown
  notes: string | null
  created_at: string
  updated_at: string
}

export type CommunicationChannel = 'email' | 'phone' | 'meeting' | 'note'

export interface CommunicationLogRow {
  id: string
  project_id: string
  contact_id: string
  channel: CommunicationChannel
  subject: string | null
  summary: string
  occurred_at: string
  logged_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Prequalifications ────────────────────────────────────

export function usePrequalifications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['prequalifications', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<PrequalificationRow[]> => {
      const { data, error } = await supabase
        .from('prequalifications')
        .select('*')
        .eq('project_id', projectId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PrequalificationRow[]
    },
  })
}

// ── Communication Logs ───────────────────────────────────

export function useCommunicationLogs(
  projectId: string | undefined,
  contactId?: string,
) {
  return useQuery({
    queryKey: ['communication_logs', projectId, contactId ?? 'all'],
    enabled: !!projectId,
    queryFn: async (): Promise<CommunicationLogRow[]> => {
      let q = supabase
        .from('communication_logs')
        .select('*')
        .eq('project_id', projectId!)
        .order('occurred_at', { ascending: false })
      if (contactId) q = q.eq('contact_id', contactId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as CommunicationLogRow[]
    },
  })
}

// ── Last-contact timestamp per contact ───────────────────
// Returns a Map<contact_id, ISO timestamp of most recent communication>.
// Used by the "Not Contacted 30+ Days" filter on /directory.

export function useLastContactMap(projectId: string | undefined) {
  return useQuery({
    queryKey: ['communication_logs', 'last_by_contact', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('contact_id, occurred_at')
        .eq('project_id', projectId!)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      const map = new Map<string, string>()
      for (const row of (data ?? []) as Array<{
        contact_id: string
        occurred_at: string
      }>) {
        if (!map.has(row.contact_id)) map.set(row.contact_id, row.occurred_at)
      }
      return map
    },
  })
}
