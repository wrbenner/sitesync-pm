/**
 * ChangeOrderCitationPanelContent — body of the citation side panel for
 * a change_order citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { co_id, status, amount, description }
 *
 * Renders status pill (color-coded by approval state) + a USD amount
 * (`amount` is dollars, not cents — change_orders.amount is numeric).
 * Description preview is capped at 320 chars.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'

interface Props {
  data?: Record<string, unknown>
}

interface ChangeOrderSidePanelData {
  status?: string | null
  amount?: number | null
  description?: string | null
}

const PREVIEW_CHARS = 320

export const ChangeOrderCitationPanelContent: React.FC<Props> = ({ data }) => {
  const co = (data ?? {}) as ChangeOrderSidePanelData
  const status = co.status ? capitalize(co.status) : 'Unknown'
  const amount = typeof co.amount === 'number' ? formatCurrency(co.amount) : null
  const desc = co.description?.trim() ?? ''
  const truncated = desc.length > PREVIEW_CHARS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
        <Pill label="Status" value={status} tone={statusTone(co.status)} />
        {amount !== null && <Pill label="Amount" value={amount} tone="neutral" />}
      </div>
      {desc.length > 0 ? (
        <div>
          <Eyebrow>Description</Eyebrow>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {desc.slice(0, PREVIEW_CHARS)}
            {truncated && '…'}
          </p>
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            fontStyle: 'italic',
          }}
        >
          No description recorded.
        </p>
      )}
    </div>
  )
}

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: typography.fontSize.caption,
      fontWeight: typography.fontWeight.semibold,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: spacing['1'],
    }}
  >
    {children}
  </div>
)

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const Pill: React.FC<{ label: string; value: string; tone: Tone }> = ({
  label,
  value,
  tone,
}) => {
  const fg = (() => {
    switch (tone) {
      case 'success':
        return colors.statusActive
      case 'warning':
        return colors.statusPending
      case 'danger':
        return colors.statusCritical
      case 'neutral':
        return colors.textSecondary
    }
  })()
  const bg = (() => {
    switch (tone) {
      case 'success':
        return colors.statusActiveSubtle
      case 'warning':
        return colors.statusPendingSubtle
      case 'danger':
        return colors.statusCriticalSubtle
      case 'neutral':
        return colors.surfaceInset
    }
  })()
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: `2px ${spacing['2']}`,
        borderRadius: borderRadius.full,
        backgroundColor: bg,
        color: fg,
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}:</span> {value}
    </span>
  )
}

function statusTone(status: string | null | undefined): Tone {
  if (!status) return 'neutral'
  const s = status.toLowerCase()
  if (s === 'approved' || s === 'executed' || s === 'closed') return 'success'
  if (s === 'rejected' || s === 'voided') return 'danger'
  if (s === 'pending' || s === 'submitted' || s === 'in_review') return 'warning'
  return 'neutral'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
}
