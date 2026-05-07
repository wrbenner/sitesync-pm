/**
 * RFIDistributionStaticList — readable, click-to-edit chip list of every
 * recipient on this RFI's distribution.
 *
 * Procore renders the distribution list as a static block of names on
 * the detail page (8 chips on RFI #96 in the May-7 audit walkthrough);
 * SiteSync today only exposes the "Distribute" button — recipients are
 * invisible until you click into Edit. That's the gap.
 *
 * Reads `rfi_distributions` (append-only history of every send + bounce).
 * For the static block we deduplicate by recipient_email and surface the
 * latest delivery_status per address.
 *
 * Click any chip → opens the existing RFIDistributeDialog so PM can edit
 * the list. Read-only viewers see the chips but the click is a no-op.
 */

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, Mail, Send, Inbox } from 'lucide-react'
import { fromTable } from '../../lib/db/queries'
import { usePermissions } from '../../hooks/usePermissions'
import { colors, spacing, typography } from '../../styles/theme'
import { RFIDistributeDialog } from './RFIDistributeDialog'

type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'bounced'
  | 'failed'
  | 'complained'

type DistributionRow = {
  id: string
  rfi_id: string
  recipient_email: string
  recipient_name: string | null
  sent_at: string
  delivery_status: DeliveryStatus
  bounce_reason: string | null
}

interface Props {
  rfiId: string
  projectId: string
  rfiNumber?: string | number | null
}

const STATUS_RANK: Record<DeliveryStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  bounced: 4,
  failed: 4,
  complained: 4,
}

const STATUS_DISPLAY: Record<
  DeliveryStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: { label: 'Pending', color: colors.textTertiary, icon: <Send size={11} /> },
  sent: { label: 'Sent', color: colors.textTertiary, icon: <Send size={11} /> },
  delivered: { label: 'Delivered', color: colors.green, icon: <Mail size={11} /> },
  opened: { label: 'Opened', color: colors.green, icon: <CheckCircle2 size={11} /> },
  bounced: { label: 'Bounced', color: colors.red, icon: <AlertTriangle size={11} /> },
  failed: { label: 'Failed', color: colors.red, icon: <AlertTriangle size={11} /> },
  complained: { label: 'Spam-flagged', color: colors.red, icon: <AlertTriangle size={11} /> },
}

export const RFIDistributionStaticList: React.FC<Props> = ({
  rfiId,
  projectId,
  rfiNumber = null,
}) => {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('rfis.edit')
  const [editorOpen, setEditorOpen] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rfi_distributions', rfiId],
    queryFn: async () => {
      const { data, error } = await fromTable('rfi_distributions')
        .select('id, rfi_id, recipient_email, recipient_name, sent_at, delivery_status, bounce_reason')
        .eq('rfi_id' as never, rfiId)
        .order('sent_at' as never, { ascending: false })
      if (error) throw error
      return ((data as unknown) ?? []) as DistributionRow[]
    },
    enabled: !!rfiId,
  })

  // Dedup by email — keep the worst-status row per recipient (bounced beats
  // delivered beats sent) so the chip surfaces real signal, not a stale send.
  const recipients = useMemo(() => {
    const byEmail = new Map<string, DistributionRow>()
    for (const r of rows) {
      const existing = byEmail.get(r.recipient_email)
      if (!existing) {
        byEmail.set(r.recipient_email, r)
        continue
      }
      const a = STATUS_RANK[r.delivery_status] ?? 0
      const b = STATUS_RANK[existing.delivery_status] ?? 0
      if (a > b) byEmail.set(r.recipient_email, r)
    }
    return Array.from(byEmail.values()).sort((a, b) =>
      (a.recipient_name ?? a.recipient_email).localeCompare(b.recipient_name ?? b.recipient_email),
    )
  }, [rows])

  if (isLoading) {
    return <div style={{ fontSize: 12, color: colors.textTertiary }}>Loading distribution…</div>
  }

  if (recipients.length === 0) {
    return (
      <button
        type="button"
        onClick={() => canEdit && setEditorOpen(true)}
        disabled={!canEdit}
        style={{
          all: 'unset',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: canEdit ? colors.primaryOrange : colors.textTertiary,
          cursor: canEdit ? 'pointer' : 'default',
          fontWeight: 500,
          padding: `${spacing['1']} ${spacing['2']}`,
          borderRadius: 6,
        }}
      >
        <Inbox size={13} /> No recipients yet{canEdit ? ' · click to add' : ''}
      </button>
    )
  }

  return (
    <>
      <ul
        aria-label="RFI distribution recipients"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing['2'],
        }}
      >
        {recipients.map((r) => {
          const statusInfo = STATUS_DISPLAY[r.delivery_status] ?? STATUS_DISPLAY.sent
          const display = r.recipient_name?.trim() || r.recipient_email
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => canEdit && setEditorOpen(true)}
                disabled={!canEdit}
                title={
                  r.bounce_reason
                    ? `${r.recipient_email} — ${statusInfo.label}: ${r.bounce_reason}`
                    : `${r.recipient_email} — ${statusInfo.label}`
                }
                style={{
                  all: 'unset',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: colors.surfaceInset,
                  border: `1px solid ${colors.borderSubtle}`,
                  fontSize: 12,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  cursor: canEdit ? 'pointer' : 'default',
                }}
              >
                <span>{display}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10,
                    fontWeight: 600,
                    color: statusInfo.color,
                  }}
                >
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>
              </button>
            </li>
          )
        })}
        {canEdit ? (
          <li>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              style={{
                all: 'unset',
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px dashed ${colors.borderDefault}`,
                fontSize: 12,
                color: colors.textSecondary,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              + add
            </button>
          </li>
        ) : null}
      </ul>

      {editorOpen ? (
        <RFIDistributeDialog
          rfiId={rfiId}
          projectId={projectId}
          rfiNumber={rfiNumber}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
    </>
  )
}

export default RFIDistributionStaticList
