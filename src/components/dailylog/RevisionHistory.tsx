/**
 * RevisionHistory — inline view of a signed daily log's edit chain.
 *
 * Renders one row per revision (oldest → newest). Each row shows the field,
 * the change (old → new), the reason, who, when, and the chain hash for
 * forensic verification. Empty state ("No revisions — original log stands.")
 * is part of the legal narrative; never hide an unedited log behind silence.
 */

import React from 'react'
import { ArrowRight, History } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Eyebrow, Hairline } from '../atoms'

export interface RevisionRow {
  id: string
  field: string
  oldValue: unknown
  newValue: unknown
  reason: string
  revisedBy: string
  revisedByName?: string | null
  revisedAt: string
  revisionHash: string
}

interface RevisionHistoryProps {
  revisions: RevisionRow[]
  /** Caller-provided field-name humanizer for display. Defaults to startCase. */
  formatField?: (field: string) => string
}

function startCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v.length > 60 ? `${v.slice(0, 57)}…` : v
  return String(v)
}

export const RevisionHistory: React.FC<RevisionHistoryProps> = ({
  revisions,
  formatField = startCase,
}) => {
  return (
    <section role="region" aria-label="Revision history">
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: spacing['3'] }}>
        <History size={12} style={{ color: colors.ink3 }} />
        <Eyebrow>Revision history</Eyebrow>
      </div>

      {revisions.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontFamily: typography.fontFamilySerif,
            fontStyle: 'italic',
            fontSize: 15,
            color: colors.ink3,
          }}
        >
          No revisions — original log stands.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {revisions.map((r, i) => (
            <li key={r.id}>
              {i > 0 && <Hairline weight={2} spacing="tight" />}
              <article
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 18%) 1fr',
                  gap: spacing['3'],
                  padding: `${spacing['2']} 0`,
                  fontFamily: typography.fontFamily,
                  fontSize: 13,
                  color: colors.ink,
                }}
              >
                <div style={{ color: colors.ink3 }}>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{new Date(r.revisedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 11 }}>{r.revisedByName ?? r.revisedBy}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: typography.fontWeight.medium }}>
                    {formatField(r.field)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.ink2 }}>
                    <span style={{ textDecoration: 'line-through', color: colors.ink3 }}>{formatValue(r.oldValue)}</span>
                    <ArrowRight size={11} style={{ color: colors.ink4 }} />
                    <span>{formatValue(r.newValue)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: colors.ink2, fontFamily: typography.fontFamilySerif, fontStyle: 'italic' }}>
                    "{r.reason}"
                  </div>
                  <div style={{ fontSize: 10, color: colors.ink4, fontFamily: typography.fontFamilyMono ?? 'monospace', wordBreak: 'break-all' }}>
                    {r.revisionHash.slice(0, 16)}…
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
