// ── useRFIDistributions ─────────────────────────────────────────────────
// Read + add hooks for the rfi_distributions table. The table is
// append-only (no UPDATE policy), so this module exposes only `add`
// for writes — the UI prevents duplicates client-side, the DB schema
// allows them but they are recorded as separate send events (matches
// how email actually works in the field).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { invalidateEntity } from '../../api/invalidation'
import { logAuditEntry } from '../../lib/auditLogger'
import posthog from '../../lib/analytics'

export interface RFIDistributionRow {
  id: string
  rfi_id: string
  recipient_email: string
  recipient_name: string | null
  message: string | null
  sent_by: string | null
  sent_at: string
  // P1c — delivery telemetry projected from the Resend webhook handler.
  message_id: string | null
  delivery_status: 'sent' | 'delivered' | 'bounced' | 'complained' | 'unknown' | null
  delivery_status_at: string | null
  bounce_reason: string | null
}

export function useRFIDistributions(rfiId: string | null | undefined) {
  return useQuery({
    queryKey: ['rfi_distributions', rfiId ?? '__none__'],
    enabled: !!rfiId,
    staleTime: 30_000,
    queryFn: async (): Promise<RFIDistributionRow[]> => {
      if (!rfiId) return []
      const { data } = await fromTable('rfi_distributions')
        .select(
          'id, rfi_id, recipient_email, recipient_name, message, sent_by, sent_at, message_id, delivery_status, delivery_status_at, bounce_reason',
        )
        .eq('rfi_id', rfiId)
        .order('sent_at', { ascending: false })
      return (data ?? []) as unknown as RFIDistributionRow[]
    },
  })
}

export function useAddRFIDistribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      rfiId: string
      projectId: string
      recipient_email: string
      recipient_name: string | null
      message: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await fromTable('rfi_distributions').insert({
        rfi_id: params.rfiId,
        recipient_email: params.recipient_email.trim(),
        recipient_name: params.recipient_name?.trim() || null,
        message: params.message?.trim() || null,
        sent_by: user?.id ?? null,
      } as never)
      if (error) throw error
      await logAuditEntry({
        projectId: params.projectId,
        entityType: 'rfi',
        entityId: params.rfiId,
        action: 'update',
        afterState: {
          distributed_to: params.recipient_email.trim(),
          recipient_name: params.recipient_name?.trim() || null,
        },
        metadata: { kind: 'rfi_distribution_send' },
      })
      return params
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ['rfi_distributions', params.rfiId] })
      invalidateEntity('rfi', params.projectId)
      posthog.capture('rfi_distribution_added', { rfi_id: params.rfiId })
    },
  })
}
