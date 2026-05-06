/**
 * SchedulePhaseCitationPanelContent — body of the citation side panel
 * for a schedule_phase citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { phase_id, name, start, end }
 *
 * Renders phase name + start-end range with duration calculated.
 * Shows "today" / "in N days" / "N days ago" relative position so the
 * PM has urgency context without leaving the inbox.
 */
import React, { useState } from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'

interface Props {
  data?: Record<string, unknown>
}

interface SchedulePhaseSidePanelData {
  name?: string | null
  start?: string | null
  end?: string | null
}

export const SchedulePhaseCitationPanelContent: React.FC<Props> = ({ data }) => {
  const ph = (data ?? {}) as SchedulePhaseSidePanelData
  const startMs = ph.start ? Date.parse(ph.start) : NaN
  const endMs = ph.end ? Date.parse(ph.end) : NaN
  const validRange = !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs
  const durationDays = validRange ? Math.max(1, Math.round((endMs - startMs) / 86_400_000)) : null
  const [today] = useState(() => Date.now())
  const positionLabel = validRange ? phasePositionLabel(today, startMs, endMs) : null
  const positionTone = validRange ? phasePositionTone(today, startMs, endMs) : 'neutral'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div>
        <Eyebrow>Activity</Eyebrow>
        <div
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            lineHeight: 1.3,
          }}
        >
          {ph.name ?? 'Unnamed activity'}
        </div>
      </div>

      {validRange && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: spacing['2'],
            padding: spacing['3'],
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.base,
          }}
        >
          <Field label="Start" value={formatDate(ph.start!)} />
          <Field label="End" value={formatDate(ph.end!)} />
          {durationDays !== null && (
            <Field
              label="Duration"
              value={`${durationDays} day${durationDays === 1 ? '' : 's'}`}
            />
          )}
          {positionLabel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Status
              </div>
              <Pill value={positionLabel} tone={positionTone} />
            </div>
          )}
        </div>
      )}

      {!validRange && (
        <p
          style={{
            margin: 0,
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            fontStyle: 'italic',
          }}
        >
          Activity has no start/end dates set. Open the schedule to view the full Gantt context.
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

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span
      style={{
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {label}
    </span>
    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
      {value}
    </span>
  </div>
)

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const Pill: React.FC<{ value: string; tone: Tone }> = ({ value, tone }) => {
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
        alignItems: 'center',
        padding: `2px ${spacing['2']}`,
        borderRadius: borderRadius.full,
        backgroundColor: bg,
        color: fg,
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        width: 'fit-content',
      }}
    >
      {value}
    </span>
  )
}

function phasePositionLabel(today: number, start: number, end: number): string {
  if (today < start) {
    const days = Math.ceil((start - today) / 86_400_000)
    return days === 0 ? 'Starting today' : `Starts in ${days} day${days === 1 ? '' : 's'}`
  }
  if (today > end) {
    const days = Math.ceil((today - end) / 86_400_000)
    return `Ended ${days} day${days === 1 ? '' : 's'} ago`
  }
  return 'In progress'
}

function phasePositionTone(today: number, start: number, end: number): Tone {
  if (today < start) return 'neutral'
  if (today > end) return 'danger'
  return 'success'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
