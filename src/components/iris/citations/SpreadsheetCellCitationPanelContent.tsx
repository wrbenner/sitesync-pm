/**
 * SpreadsheetCellCitationPanelContent — body of the side panel for a
 * spreadsheet_cell citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { sheet_name, range_a1, named_range?, file_name? }
 *
 * The cell range is the user's hook back into the source spreadsheet. The
 * parent panel's "Open in full page" link routes via citationRouting's
 * buildDeepLink to `/files/<asset_id>?sheet=...&range=...`.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { DraftedActionCitation } from '../../../types/draftedActions'

interface Props {
  data?: Record<string, unknown>
  citation: DraftedActionCitation
}

interface SpreadsheetSidePanelData {
  sheet_name?: string | null
  range_a1?: string | null
  named_range?: string | null
  file_name?: string | null
}

export const SpreadsheetCellCitationPanelContent: React.FC<Props> = ({ data, citation }) => {
  const d = (data ?? {}) as SpreadsheetSidePanelData
  const sheet = d.sheet_name ?? citation.sheet_name ?? null
  const range = d.range_a1 ?? citation.range_a1 ?? null
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
        {d.file_name && (
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
            }}
          >
            {d.file_name}
          </div>
        )}
        {(sheet || range) && (
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.primaryOrange,
              letterSpacing: '0.04em',
            }}
          >
            {sheet ? `${sheet}!` : ''}{range ?? ''}
          </div>
        )}
        {d.named_range && (
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
            }}
          >
            Named range: {d.named_range}
          </div>
        )}
        {!sheet && !range && !d.named_range && (
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            Spreadsheet cell reference (no metadata available).
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
        Spreadsheet citations anchor a draft to a specific cell range. The
        full sheet contents live in the source file — open it via the link
        below to read the surrounding context.
      </div>
    </div>
  )
}
