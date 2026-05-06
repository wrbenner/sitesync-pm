/**
 * RfiCitationPanelContent — body of the citation side panel for an RFI.
 *
 * Reads `side_panel_data` from the resolve_citation RPC payload:
 *   { rfi_id, status, ball_in_court, due_date, description }
 *
 * Renders status pill + ball-in-court chip + due date + first-200-char
 * description preview. The Open-in-full-page footer link (in the parent
 * panel) navigates to /rfis/:id for the full thread.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import { UserName } from '../../UserName'

interface Props {
  data?: Record<string, unknown>
}

interface RfiSidePanelData {
  status?: string | null
  ball_in_court?: string | null
  due_date?: string | null
  description?: string | null
}

export const RfiCitationPanelContent: React.FC<Props> = ({ data }) => {
  const rfi = (data ?? {}) as RfiSidePanelData
  const status = rfi.status ? capitalize(rfi.status) : 'Unknown'
  const due = rfi.due_date ? formatDate(rfi.due_date) : null
  const desc = rfi.description?.slice(0, 240) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
        <Pill label="Status" value={status} tone={statusTone(rfi.status)} />
        {rfi.ball_in_court && (
          <Pill
            label="Ball in court"
            // ball_in_court is a UUID FK to auth.users — never render raw.
            // <UserName /> resolves to the person's name with a skeleton
            // shimmer during load, never "Unknown".
            value={<UserName userId={rfi.ball_in_court} fallback="—" />}
            tone="neutral"
          />
        )}
        {due && <Pill label="Due" value={due} tone={dueTone(rfi.due_date)} />}
      </div>
      {desc && (
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
            {desc}
            {(rfi.description?.length ?? 0) > 240 && '…'}
          </p>
        </div>
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

const Pill: React.FC<{ label: string; value: React.ReactNode; tone: Tone }> = ({
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
  if (s === 'answered' || s === 'closed') return 'success'
  if (s === 'overdue') return 'danger'
  if (s === 'open' || s === 'pending' || s === 'in_review') return 'warning'
  return 'neutral'
}

function dueTone(due: string | null | undefined): Tone {
  if (!due) return 'neutral'
  const t = Date.parse(due)
  if (isNaN(t)) return 'neutral'
  const today = new Date().setHours(0, 0, 0, 0)
  if (t < today) return 'danger'
  if (t < today + 3 * 86_400_000) return 'warning'
  return 'neutral'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
