/**
 * SpecCitationPanelContent — body of the citation side panel for a
 * spec_reference citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { spec_id, section, title }
 *
 * The full spec text is too large to render in the panel; we show the
 * section number, title, and rely on the parent panel's "Open in full
 * page" link for the body. The citation snippet (rendered by the
 * parent panel chrome) is the user's anchor into the full spec.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'

interface Props {
  data?: Record<string, unknown>
}

interface SpecSidePanelData {
  section?: string | null
  title?: string | null
}

export const SpecCitationPanelContent: React.FC<Props> = ({ data }) => {
  const s = (data ?? {}) as SpecSidePanelData
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
        {s.section && (
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.primaryOrange,
              letterSpacing: '0.04em',
            }}
          >
            {s.section}
          </div>
        )}
        {s.title && (
          <div
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              lineHeight: 1.35,
            }}
          >
            {s.title}
          </div>
        )}
        {!s.section && !s.title && (
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            Spec section reference (no metadata available).
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.textTertiary,
          lineHeight: 1.55,
        }}
      >
        Spec sections are referenced in citations to anchor a draft to a
        specific section number. The body of the section lives in the full
        spec — open it via the link below to read the surrounding context.
      </div>
    </div>
  )
}
