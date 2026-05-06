/**
 * GenericCitationPanelContent — fallback panel body for citation kinds
 * whose dedicated panel ships in Day 39 (daily_log, change_order,
 * spec, schedule_phase, budget_line, photo).
 *
 * Renders the resolved label + a key/value list of the side_panel_data
 * payload. The "Open in full page" footer link in the parent panel
 * carries the user to the dedicated detail page.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { DraftedActionCitation } from '../../../types/draftedActions'

interface Props {
  data?: Record<string, unknown>
  citation: DraftedActionCitation
}

export const GenericCitationPanelContent: React.FC<Props> = ({ data, citation }) => {
  const entries = data
    ? Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '')
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div
        style={{
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Source
      </div>
      <div
        style={{
          fontSize: typography.fontSize.base,
          color: colors.textPrimary,
          fontWeight: typography.fontWeight.medium,
        }}
      >
        {citation.label}
      </div>

      {entries.length > 0 && (
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: spacing['3'],
            rowGap: spacing['2'],
            padding: spacing['3'],
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm,
          }}
        >
          {entries.map(([key, value]) => (
            <React.Fragment key={key}>
              <dt
                style={{
                  margin: 0,
                  color: colors.textTertiary,
                  fontWeight: typography.fontWeight.semibold,
                  textTransform: 'capitalize',
                }}
              >
                {key.replace(/_/g, ' ')}
              </dt>
              <dd
                style={{
                  margin: 0,
                  color: colors.textPrimary,
                  wordBreak: 'break-word',
                }}
              >
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}
