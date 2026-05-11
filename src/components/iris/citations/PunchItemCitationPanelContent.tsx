/**
 * PunchItemCitationPanelContent — body of the side panel for a
 * punch_item citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { punch_id, summary, status, location, assignee, due_date }
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'

interface Props {
  data?: Record<string, unknown>
}

interface PunchSidePanelData {
  summary?: string | null
  status?: string | null
  location?: string | null
  assignee?: string | null
  due_date?: string | null
}

export const PunchItemCitationPanelContent: React.FC<Props> = ({ data }) => {
  const d = (data ?? {}) as PunchSidePanelData
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div
        style={{
          padding: spacing['3'],
          backgroundColor: colors.surfaceInset,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.base,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['2'],
        }}
      >
        {d.summary && (
          <div
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              lineHeight: 1.35,
            }}
          >
            {d.summary}
          </div>
        )}
        {d.status && (
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.primaryOrange,
              letterSpacing: '0.04em',
            }}
          >
            {d.status}
          </div>
        )}
        {(d.location || d.assignee || d.due_date) && (
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['1'],
            }}
          >
            {d.location && <div>Location: {d.location}</div>}
            {d.assignee && <div>Assignee: {d.assignee}</div>}
            {d.due_date && <div>Due: {d.due_date}</div>}
          </div>
        )}
        {!d.summary && !d.status && (
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            Punch item reference (no metadata available).
          </div>
        )}
      </div>
    </div>
  )
}
