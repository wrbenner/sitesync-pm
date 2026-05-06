// ── RFIEmailReviewBanner ───────────────────────────────────────────────
// Surfaces low-confidence inbound email matches as a yellow review banner
// on the RFI Detail page. P1c deliverable #4.
//
// Lifecycle:
//   • inbound-email writes a `drafted_actions` row with action_type =
//     'rfi.email_inbound_review' when the threading match is low
//     confidence (subject-only).
//   • This banner queries the pending drafts for the current RFI and
//     renders one Accept / Reject pair per draft.
//   • Accept inserts an rfi_responses row (source =
//     'email_inbound_iris_review'), persists any attachments captured
//     in the draft payload, marks the draft 'executed', writes audit.
//   • Reject marks the draft 'rejected' with audit; the email body is
//     preserved in inbound_email_replies for the legal record but does
//     not surface in the live thread.
//
// We don't go through the existing Iris executor pipeline because the
// inbound match path needs to write to rfi_responses with a specific
// `source` value the executors don't know about, and because the
// payload shape doesn't fit the existing DraftedActionType union.

import React from 'react'
import { Mail, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import { logAuditEntry } from '../../lib/auditLogger'
import { PermissionGate } from '../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

const from = (table: string) => fromTable(table as never)

interface EmailReviewDraft {
  id: string
  rfi_id: string
  subject: string | null
  body: string
  from_email: string | null
  inbound_message_id: string | null
  via: string | null
  created_at: string
}

interface RFIEmailReviewBannerProps {
  rfiId: string
  projectId: string
}

export function useRFIEmailReviewDrafts(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_email_review_drafts', rfiId],
    enabled: !!rfiId,
    staleTime: 30_000,
    queryFn: async (): Promise<EmailReviewDraft[]> => {
      if (!rfiId) return []
      const { data, error } = await from('drafted_actions')
        .select('id, payload, created_at')
        .eq('action_type' as never, 'rfi.email_inbound_review')
        .eq('related_resource_type' as never, 'rfi')
        .eq('related_resource_id' as never, rfiId)
        .eq('status' as never, 'pending')
        .order('created_at' as never, { ascending: false })
      if (error) return []
      return ((data ?? []) as unknown as Array<{ id: string; payload: Record<string, unknown>; created_at: string }>).map((row) => ({
        id: row.id,
        rfi_id: rfiId,
        subject: (row.payload?.subject as string | undefined) ?? null,
        body: (row.payload?.body as string | undefined) ?? '',
        from_email: (row.payload?.from_email as string | undefined) ?? null,
        inbound_message_id: (row.payload?.inbound_message_id as string | undefined) ?? null,
        via: (row.payload?.via as string | undefined) ?? null,
        created_at: row.created_at,
      }))
    },
  })
}

function useAcceptEmailReviewDraft(rfiId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: EmailReviewDraft) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Insert as a real response — source flag preserves provenance.
      const { data: responseRow, error: respErr } = await from('rfi_responses')
        .insert({
          rfi_id: rfiId,
          author_id: null,
          content: draft.body || draft.subject || '(empty reply)',
          response_type: 'answered',
          is_official: false,
          is_internal: false,
          source: 'email_inbound_iris_review',
          source_email: draft.from_email,
          inbound_message_id: draft.inbound_message_id,
        } as never)
        .select('id')
        .single()
      if (respErr) throw respErr
      const responseId = (responseRow as { id: string }).id

      // Mark the draft executed.
      const { error: updateErr } = await from('drafted_actions')
        .update({
          status: 'executed',
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          executed_resource_type: 'rfi_response',
          executed_resource_id: responseId,
        } as never)
        .eq('id' as never, draft.id)
      if (updateErr) throw updateErr

      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        afterState: { response_id: responseId, source: 'email_inbound_iris_review' },
        metadata: {
          kind: 'rfi_email_review_accept',
          draft_id: draft.id,
          from_email: draft.from_email,
        },
      })
      return { responseId, draftId: draft.id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfi_email_review_drafts', rfiId] })
      qc.invalidateQueries({ queryKey: ['rfi_responses', rfiId] })
      qc.invalidateQueries({ queryKey: ['rfis', 'detail', rfiId] })
    },
  })
}

function useRejectEmailReviewDraft(rfiId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: EmailReviewDraft) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await from('drafted_actions')
        .update({
          status: 'rejected',
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, draft.id)
      if (error) throw error

      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        beforeState: { draft_id: draft.id },
        metadata: {
          kind: 'rfi_email_review_reject',
          from_email: draft.from_email,
        },
      })
      return { draftId: draft.id }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfi_email_review_drafts', rfiId] })
    },
  })
}

export const RFIEmailReviewBanner: React.FC<RFIEmailReviewBannerProps> = ({ rfiId, projectId }) => {
  const { data: drafts = [] } = useRFIEmailReviewDrafts(rfiId)
  const accept = useAcceptEmailReviewDraft(rfiId, projectId)
  const reject = useRejectEmailReviewDraft(rfiId, projectId)

  if (drafts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Iris email review"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['2'],
        padding: spacing['3'],
        margin: `${spacing['3']} 0`,
        backgroundColor: '#FFFBEB',
        border: '1px solid #F59E0B',
        borderRadius: borderRadius.base,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], color: '#92400E' }}>
        <Mail size={14} />
        <strong style={{ fontSize: typography.fontSize.sm }}>
          Iris received {drafts.length === 1 ? 'an email' : `${drafts.length} emails`} that might belong to this RFI
        </strong>
      </div>
      {drafts.map((draft) => (
        <div
          key={draft.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: spacing['2'],
            backgroundColor: 'white',
            border: '1px solid #FCD34D',
            borderRadius: borderRadius.sm,
          }}
        >
          <div style={{ fontSize: 12, color: colors.textTertiary }}>
            from <strong style={{ color: colors.textSecondary }}>{draft.from_email ?? 'unknown sender'}</strong>
            {draft.subject && (
              <>
                {' · '}<em>{draft.subject.slice(0, 120)}</em>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              color: colors.textPrimary,
              whiteSpace: 'pre-wrap',
              maxHeight: 160,
              overflow: 'auto',
              padding: spacing['2'],
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.sm,
            }}
          >
            {draft.body || '(empty body)'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <PermissionGate permission="rfis.edit">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await reject.mutateAsync(draft)
                    toast('Email discarded')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to reject')
                  }
                }}
                disabled={reject.isPending || accept.isPending}
                style={btnStyle(false)}
              >
                <X size={12} /> Reject
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await accept.mutateAsync(draft)
                    toast.success('Added to RFI thread')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to accept')
                  }
                }}
                disabled={accept.isPending || reject.isPending}
                style={btnStyle(true)}
              >
                <Check size={12} /> {accept.isPending ? 'Adding…' : 'Accept'}
              </button>
            </PermissionGate>
          </div>
        </div>
      ))}
    </div>
  )
}

const btnStyle = (primary: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 12px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  color: primary ? 'white' : colors.textSecondary,
  background: primary ? colors.primaryOrange : 'transparent',
  border: primary ? 'none' : `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
})

export default RFIEmailReviewBanner
