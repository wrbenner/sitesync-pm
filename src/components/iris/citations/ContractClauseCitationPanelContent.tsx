/**
 * ContractClauseCitationPanelContent — body of the side panel for a
 * contract_clause citation.
 *
 * Reads `side_panel_data` from resolve_citation:
 *   { contract_title, contract_type?, clause_number, article?, heading? }
 *
 * Shows clause number, article header, and clause heading. Full clause text
 * lives in the source contract — opened via parent panel's deep link.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { DraftedActionCitation } from '../../../types/draftedActions'

interface Props {
  data?: Record<string, unknown>
  citation: DraftedActionCitation
}

interface ContractSidePanelData {
  contract_title?: string | null
  contract_type?: string | null
  clause_number?: string | null
  article?: string | null
  heading?: string | null
}

export const ContractClauseCitationPanelContent: React.FC<Props> = ({ data, citation }) => {
  const d = (data ?? {}) as ContractSidePanelData
  const clauseNumber = d.clause_number ?? citation.clause_number ?? null
  const article = d.article ?? citation.article ?? null
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
        {d.contract_title && (
          <div
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
            }}
          >
            {d.contract_title}
            {d.contract_type && ` · ${d.contract_type}`}
          </div>
        )}
        {clauseNumber && (
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.primaryOrange,
              letterSpacing: '0.04em',
            }}
          >
            Clause {clauseNumber}
            {article && ` · ${article}`}
          </div>
        )}
        {d.heading && (
          <div
            style={{
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              lineHeight: 1.35,
            }}
          >
            {d.heading}
          </div>
        )}
        {!clauseNumber && !d.heading && (
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            Contract clause reference (no metadata available).
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
        Contract clauses are referenced when a draft depends on a specific
        article or section of the construction contract. Open the source
        contract via the link below to read the full clause body in context.
      </div>
    </div>
  )
}
