import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import type {
  PrequalificationRow,
  PrequalStatus,
  CommunicationLogRow,
  CommunicationChannel,
} from '../queries/directory'

// ── Prequalification upsert ──────────────────────────────
// One row per (project_id, company_id) — re-requests update status
// in place. Status history belongs in audit_trail, not here.

export interface UpsertPrequalInput {
  projectId: string
  companyId: string
  status: PrequalStatus
  submittedAt?: string | null
  reviewedAt?: string | null
  expiresAt?: string | null
  bondingCapacity?: string | null
  insuranceLimits?: string | null
  emrRate?: number | null
  yearsInBusiness?: number | null
  licenseNumbers?: string | null
  notes?: string | null
}

export function useUpsertPrequalification() {
  const qc = useQueryClient()
  return useMutation<PrequalificationRow, Error, UpsertPrequalInput>({
    mutationFn: async (input) => {
      const payload = {
        project_id: input.projectId,
        company_id: input.companyId,
        status: input.status,
        submitted_at: input.submittedAt ?? null,
        reviewed_at: input.reviewedAt ?? null,
        expires_at: input.expiresAt ?? null,
        bonding_capacity: input.bondingCapacity ?? null,
        insurance_limits: input.insuranceLimits ?? null,
        emr_rate: input.emrRate ?? null,
        years_in_business: input.yearsInBusiness ?? null,
        license_numbers: input.licenseNumbers ?? null,
        notes: input.notes ?? null,
      }
      const { data, error } = await supabase
        .from('prequalifications')
        .upsert(payload, { onConflict: 'project_id,company_id' })
        .select()
        .single()
      if (error) throw error
      return data as PrequalificationRow
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['prequalifications', variables.projectId],
      })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update prequalification')
    },
  })
}

// ── Communication log: create ────────────────────────────

export interface CreateCommLogInput {
  projectId: string
  contactId: string
  channel: CommunicationChannel
  subject?: string
  summary?: string
  occurredAt?: string
}

export function useCreateCommunicationLog() {
  const qc = useQueryClient()
  return useMutation<CommunicationLogRow, Error, CreateCommLogInput>({
    mutationFn: async (input) => {
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user?.id ?? null

      const { data, error } = await supabase
        .from('communication_logs')
        .insert({
          project_id: input.projectId,
          contact_id: input.contactId,
          channel: input.channel,
          subject: input.subject ?? null,
          summary: input.summary ?? '',
          occurred_at: input.occurredAt ?? new Date().toISOString(),
          logged_by: userId,
        })
        .select()
        .single()
      if (error) throw error
      return data as CommunicationLogRow
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['communication_logs', variables.projectId],
      })
      qc.invalidateQueries({
        queryKey: ['communication_logs', 'last_by_contact', variables.projectId],
      })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to log communication')
    },
  })
}

// ── Communication log: delete ────────────────────────────

export function useDeleteCommunicationLog() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; projectId: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from('communication_logs')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['communication_logs', variables.projectId],
      })
      qc.invalidateQueries({
        queryKey: ['communication_logs', 'last_by_contact', variables.projectId],
      })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete log entry')
    },
  })
}
