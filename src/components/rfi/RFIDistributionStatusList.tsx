// ── RFIDistributionStatusList ──────────────────────────────────────────
// Read-only roster of past sends + their current delivery status.
// Renders below the Distribution chip editor in the Edit panel and on
// the Distribute dialog. The chip editor handles add; this list shows
// what's already gone out.
//
// Status dot legend:
//   • green  — delivered (Resend webhook fired email.delivered)
//   • red    — bounced or complained
//   • amber  — unknown (send-email errored locally; row is durable but
//              the fan-out failed)
//   • gray   — sent (we haven't heard back yet)

import React from 'react'
import { useRFIDistributions } from '../../hooks/queries/useRFIDistributions'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIDistributionStatusListProps {
  rfiId: string
}

const STATUS_META: Record<
  'sent' | 'delivered' | 'bounced' | 'complained' | 'unknown',
  { color: string; label: string }
> = {
  sent: { color: colors.borderDefault, label: 'Sent — pending delivery' },
  delivered: { color: '#2D8A6E', label: 'Delivered' },
  bounced: { color: '#C93B3B', label: 'Bounced' },
  complained: { color: '#C93B3B', label: 'Complained' },
  unknown: { color: '#C4850C', label: 'Unknown — send may have failed' },
}

export const RFIDistributionStatusList: React.FC<RFIDistributionStatusListProps> = ({ rfiId }) => {
  const { data: rows = [], isLoading } = useRFIDistributions(rfiId)

  if (isLoading) {
    return (
      <div style={{ fontSize: 11, color: colors.textTertiary }}>
        Loading delivery status…
      </div>
    )
  }
  if (rows.length === 0) return null

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
      aria-label="Distribution delivery status"
    >
      {rows.map((row) => {
        const status = (row.delivery_status ?? 'sent') as keyof typeof STATUS_META
        const meta = STATUS_META[status] ?? STATUS_META.sent
        const tooltip = row.bounce_reason
          ? `${meta.label}: ${row.bounce_reason}`
          : meta.label
        return (
          <li
            key={row.id}
            title={tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              fontSize: typography.fontSize.caption,
              color: colors.textSecondary,
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.sm,
              maxWidth: '100%',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: meta.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.recipient_email}
            </span>
            <span style={{ color: colors.textTertiary, fontSize: 10, marginLeft: spacing['1'] }}>
              {meta.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default RFIDistributionStatusList
