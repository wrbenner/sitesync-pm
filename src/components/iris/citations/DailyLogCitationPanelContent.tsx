/**
 * DailyLogCitationPanelContent — body of the citation side panel for a
 * daily_log_excerpt citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { log_id, date, summary }
 *
 * Renders the log date + a 360-char preview of the summary, with the
 * citation snippet (if present) highlighted via the parent panel's
 * blockquote chrome.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'

interface Props {
  data?: Record<string, unknown>
}

interface DailyLogSidePanelData {
  date?: string | null
  summary?: string | null
}

const PREVIEW_CHARS = 360

export const DailyLogCitationPanelContent: React.FC<Props> = ({ data }) => {
  const log = (data ?? {}) as DailyLogSidePanelData
  const dateLabel = log.date ? formatDate(log.date) : 'Unknown date'
  const summary = log.summary?.trim() ?? ''
  const truncated = summary.length > PREVIEW_CHARS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <Field label="Log date" value={dateLabel} />
      {summary.length > 0 ? (
        <div>
          <Eyebrow>Summary</Eyebrow>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              padding: spacing['3'],
              backgroundColor: colors.surfaceInset,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
            }}
          >
            {summary.slice(0, PREVIEW_CHARS)}
            {truncated && '…'}
          </p>
          {truncated && (
            <p
              style={{
                margin: `${spacing['1']} 0 0 0`,
                fontSize: typography.fontSize.caption,
                color: colors.textTertiary,
              }}
            >
              {summary.length} characters total · open the full log for the rest.
            </p>
          )}
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
          No narrative recorded for this log entry.
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
  <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
    <span
      style={{
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        minWidth: 80,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: typography.fontSize.sm,
        color: colors.textPrimary,
        fontWeight: typography.fontWeight.medium,
      }}
    >
      {value}
    </span>
  </div>
)

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
