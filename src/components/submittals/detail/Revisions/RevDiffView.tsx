// Phase 8 — Rev-diff side-by-side viewer.
//
// Compares revisions of a submittal item — rev N-1 on the left, rev N on
// the right. Phase 8 ships the structural side-by-side frame + Iris one-
// line summary header + a markup-overlay diff (highlight added/removed/
// moved markups). The PDF backdrop integration with DocumentViewer comes
// online in Phase 8b alongside the markup canvas's DocumentViewer wiring.
//
// Iris one-line summary: Phase 8 ships a deterministic summary derived
// from markup count + new/removed kinds. Phase 8b swaps in the LLM
// summary that compares actual page content + extracted entities.

import React from 'react'
import { ArrowLeftRight, Sparkles } from 'lucide-react'
import { useSubmittalMarkup } from '../../../../hooks/useSubmittalMarkup'
import type { SubmittalMarkup } from '../../../../services/submittalMarkup'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
  brandOrange: '#F47820',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface RevDiffViewProps {
  submittalItemId: string
  /** The newer revision (right pane). Phase 8 reads markups for revFrom and
   *  revTo; Phase 8b joins to the actual rev PDFs from submittal_items. */
  revFrom: number
  revTo: number
  /** Optional Iris-LLM-generated narrative override (Phase 8b). */
  irisNarrative?: string | null
}

export const RevDiffView: React.FC<RevDiffViewProps> = ({
  submittalItemId,
  revFrom,
  revTo,
  irisNarrative,
}) => {
  const { markups: markupsFrom, loading: loadingFrom } = useSubmittalMarkup({
    submittalItemId, revNumber: revFrom,
  })
  const { markups: markupsTo, loading: loadingTo } = useSubmittalMarkup({
    submittalItemId, revNumber: revTo,
  })

  const summary = irisNarrative ?? buildDeterministicSummary(markupsFrom, markupsTo)
  const loading = loadingFrom || loadingTo

  return (
    <section
      aria-label={`Revision diff R${revFrom} vs R${revTo}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: FONT,
      }}
    >
      {/* Iris narrative header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '10px 14px',
          backgroundColor: 'rgba(244, 120, 32, 0.06)',
          border: `1px solid rgba(244, 120, 32, 0.20)`,
          borderRadius: 6,
        }}
      >
        <Sparkles size={14} color={C.brandOrange} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.brandOrange,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Iris diff summary
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.4, fontWeight: 500 }}>
            {loading ? 'Comparing revisions…' : summary}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.ink3 }}>
            Phase 8 ships a deterministic markup-count diff. Phase 8b adds
            LLM-generated narrative that compares actual page content + extracted
            entities (e.g. "Sub responded to all 3 markups; added AAMA cert").
          </p>
        </div>
      </header>

      {/* Side-by-side panes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <RevPane
          label={`R${revFrom}`}
          subtitle="Previous revision"
          markups={markupsFrom}
          tone="neutral"
        />
        <RevPane
          label={`R${revTo}`}
          subtitle="Current revision"
          markups={markupsTo}
          tone="brand"
        />
      </div>

      {/* Inline ↔ separator (kept slim — not a horizontal bar) */}
      <div style={{ display: 'flex', justifyContent: 'center', color: C.ink3 }}>
        <ArrowLeftRight size={14} />
      </div>

      {/* Stat strip */}
      <DiffStatStrip from={markupsFrom} to={markupsTo} />
    </section>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface RevPaneProps {
  label: string
  subtitle: string
  markups: SubmittalMarkup[]
  tone: 'neutral' | 'brand'
}

const RevPane: React.FC<RevPaneProps> = ({ label, subtitle, markups, tone }) => (
  <div
    style={{
      backgroundColor: '#fff',
      border: `1px solid ${tone === 'brand' ? `rgba(244, 120, 32, 0.30)` : C.border}`,
      borderRadius: 6,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 240,
    }}
  >
    <header style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: tone === 'brand' ? C.brandOrange : C.ink2,
          padding: '2px 8px',
          backgroundColor: tone === 'brand' ? 'rgba(244, 120, 32, 0.10)' : C.surfaceInset,
          borderRadius: 3,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11, color: C.ink3 }}>{subtitle}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: C.ink3 }}>
        {markups.length} markup{markups.length === 1 ? '' : 's'}
      </span>
    </header>
    {/* Phase 8 ships a markup list summary; Phase 8b drops the PDF page
     *  render here with markups overlaid via the same MarkupCanvas in
     *  read-only mode. */}
    <ul role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {markups.length === 0 ? (
        <li style={{ fontSize: 12, color: C.ink3, fontStyle: 'italic' }}>
          No markups on this revision.
        </li>
      ) : (
        markups.map((m) => (
          <li
            key={m.id}
            style={{
              padding: '6px 8px',
              backgroundColor: C.surfaceInset,
              borderRadius: 3,
              fontSize: 11,
              color: C.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <KindChip kind={m.kind} />
            <span style={{ color: C.ink3 }}>p. {m.pdf_page}</span>
            {m.comment_md && (
              <span
                style={{
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: C.ink2,
                }}
              >
                {m.comment_md}
              </span>
            )}
          </li>
        ))
      )}
    </ul>
  </div>
)

const KindChip: React.FC<{ kind: string }> = ({ kind }) => (
  <span
    style={{
      fontSize: 9,
      fontWeight: 700,
      color: '#fff',
      backgroundColor: kindColor(kind),
      padding: '1px 5px',
      borderRadius: 2,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      fontFamily: FONT,
    }}
  >
    {kind}
  </span>
)

function kindColor(kind: string): string {
  switch (kind) {
    case 'highlight': return '#C4850C'
    case 'callout':   return '#0EA5E9'
    case 'redline':   return '#C93B3B'
    case 'stamp':     return '#2D8A6E'
    case 'pen':       return '#0F172A'
    case 'text':      return '#8B5CF6'
    default:          return '#6B7280'
  }
}

interface DiffStatStripProps {
  from: SubmittalMarkup[]
  to: SubmittalMarkup[]
}

const DiffStatStrip: React.FC<DiffStatStripProps> = ({ from, to }) => {
  const { added, removed, kept } = computeDiffCounts(from, to)
  return (
    <div
      role="status"
      aria-label="Revision diff statistics"
      style={{
        display: 'flex',
        gap: 14,
        padding: '8px 14px',
        backgroundColor: C.surfaceInset,
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 4,
        fontSize: 12,
        color: C.ink2,
        fontFamily: FONT,
      }}
    >
      <Stat label="Added" value={added} tone={C.active} />
      <Stat label="Removed" value={removed} tone={C.critical} />
      <Stat label="Carried over" value={kept} tone={C.ink3} />
    </div>
  )
}

const Stat: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <strong style={{ color: tone, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    <span style={{ color: C.ink3 }}>{label}</span>
  </span>
)

// ── Helpers ────────────────────────────────────────────────────────────────

export interface DiffCounts {
  added: number
  removed: number
  kept: number
}

export function computeDiffCounts(from: SubmittalMarkup[], to: SubmittalMarkup[]): DiffCounts {
  // A markup "carries over" when its (kind, pdf_page, comment_md) tuple
  // matches between revisions. This is a coarse stand-in until Phase 8b
  // adds a stable cross-revision id (`parent_markup_id`) and geometry-
  // based similarity matching.
  const sigOf = (m: SubmittalMarkup): string =>
    `${m.kind}|${m.pdf_page}|${(m.comment_md ?? '').trim()}`

  const fromSigs = new Set(from.map(sigOf))
  const toSigs = new Set(to.map(sigOf))

  let added = 0
  let removed = 0
  let kept = 0

  for (const m of to) {
    if (fromSigs.has(sigOf(m))) kept += 1
    else added += 1
  }
  for (const m of from) {
    if (!toSigs.has(sigOf(m))) removed += 1
  }
  return { added, removed, kept }
}

export function buildDeterministicSummary(
  from: SubmittalMarkup[],
  to: SubmittalMarkup[],
): string {
  if (from.length === 0 && to.length === 0) {
    return 'No markups on either revision yet.'
  }
  const { added, removed, kept } = computeDiffCounts(from, to)
  if (added === 0 && removed === 0) {
    return `${kept} markup${kept === 1 ? '' : 's'} carried over unchanged.`
  }

  const parts: string[] = []
  if (added > 0) parts.push(`${added} new markup${added === 1 ? '' : 's'} added`)
  if (removed > 0) parts.push(`${removed} previous markup${removed === 1 ? '' : 's'} removed`)
  if (kept > 0) parts.push(`${kept} carried over`)
  return parts.join(' · ')
}

export default RevDiffView
