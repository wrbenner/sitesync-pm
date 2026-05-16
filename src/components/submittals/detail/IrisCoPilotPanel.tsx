// Phase 6 — Iris Co-pilot Panel.
//
// THE killer differentiator from the world-class plan (Pillar B): a 360px
// right-rail panel that follows the user across all 7 detail tabs. Three
// sections, each citation-required:
//
//   1. WHAT I SEE     — Iris's structured reading of the current submittal
//                        ("Stainless steel finish, wet-glaze method, 3-coat
//                        paint spec.")
//   2. WHAT I'D ASK   — Pre-flight findings, each with a quick-action
//                        ("Send to sub" / "Add to package")
//   3. PAST SIMILAR   — Three closest prior submittals (vector similarity
//                        + spec-section match), each with disposition +
//                        resubmit count. Click → side panel.
//
// Phase 6 ships the panel SHELL with deterministic placeholder content
// per section. Phase 7 wires the LLM-augmented content (real entities,
// citations, similar-past lookup). The shell is what the user sees and
// what makes the detail page feel alive — Iris is "always there".
//
// Toggleable via the action cluster button. Persists open/closed state
// per (user × project) in localStorage.

import React from 'react'
import { ChevronRight, Sparkles, X } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const COPILOT_PANEL_WIDTH = 360

export interface IrisFinding {
  id: string
  severity: 'info' | 'warning' | 'block'
  message: string
  /** Quick-action button label (e.g. "Send to sub"). */
  actionLabel?: string
  onAction?: () => void
  /** Optional citation chip — links to spec / past submittal / standard. */
  citation?: { label: string; href?: string; onClick?: () => void }
}

export interface SimilarPast {
  id: string
  number: string | null
  title: string
  disposition: string | null
  resubmit_count: number
  onOpen: () => void
}

export interface IrisCoPilotData {
  /** "What I see" — bullet list of structured entities. */
  whatISee: string[]
  /** "What I'd ask" — pre-flight findings, sorted by severity. */
  whatIdAsk: IrisFinding[]
  /** "Past similar" — top 3 similar prior submittals. */
  pastSimilar: SimilarPast[]
}

export interface IrisCoPilotPanelProps {
  open: boolean
  data: IrisCoPilotData
  onClose: () => void
  /** Source attribution shown at the top of the panel ("Iris pre-flight ran 2 minutes ago"). */
  attribution?: string
}

export const IrisCoPilotPanel: React.FC<IrisCoPilotPanelProps> = ({
  open,
  data,
  onClose,
  attribution,
}) => {
  if (!open) return null

  return (
    <aside
      aria-label="Iris co-pilot"
      style={{
        flex: `0 0 ${COPILOT_PANEL_WIDTH}px`,
        width: COPILOT_PANEL_WIDTH,
        borderLeft: `1px solid ${C.border}`,
        backgroundColor: C.surface,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        color: C.ink,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          backgroundColor: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color={C.brandOrange} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Iris</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Iris co-pilot"
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            color: C.ink2,
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <X size={14} />
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
        {attribution && (
          <p style={{ margin: '0 0 12px', fontSize: 11, color: C.ink3 }}>{attribution}</p>
        )}

        <SectionHeading>What I see</SectionHeading>
        {data.whatISee.length > 0 ? (
          <ul style={listStyle}>
            {data.whatISee.map((line, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  color: C.ink2,
                  padding: '4px 0',
                  lineHeight: 1.4,
                }}
              >
                · {line}
              </li>
            ))}
          </ul>
        ) : (
          <Empty hint="Iris will start drafting once the submittal has attachments or a spec link." />
        )}

        <SectionHeading>What I&apos;d ask</SectionHeading>
        {data.whatIdAsk.length > 0 ? (
          <ul style={listStyle}>
            {data.whatIdAsk.map((f) => (
              <FindingRow key={f.id} finding={f} />
            ))}
          </ul>
        ) : (
          <Empty hint="No pre-flight items. Iris is happy with what it sees." />
        )}

        <SectionHeading>Past similar (top 3)</SectionHeading>
        {data.pastSimilar.length > 0 ? (
          <ul style={listStyle}>
            {data.pastSimilar.map((p) => (
              <SimilarRow key={p.id} item={p} />
            ))}
          </ul>
        ) : (
          <Empty hint="No similar submittals on this project yet. Iris will surface them as the log grows." />
        )}

        <p
          style={{
            margin: '20px 0 0',
            fontSize: 11,
            color: C.ink3,
            lineHeight: 1.4,
            paddingTop: 12,
            borderTop: `1px solid ${C.borderSubtle}`,
          }}
        >
          Phase 6 ships the panel shell. Phase 7 wires LLM-augmented entity
          extraction, citations, and similar-past vector lookup. Every Iris
          output will be citation-required and hash-chained.
        </p>
      </div>
    </aside>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    style={{
      margin: '0 0 6px',
      fontSize: 10,
      fontWeight: 700,
      color: C.brandOrange,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </h3>
)

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0 0 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const Empty: React.FC<{ hint: string }> = ({ hint }) => (
  <p style={{ margin: '0 0 18px', fontSize: 11, color: C.ink3, fontStyle: 'italic' }}>
    {hint}
  </p>
)

const FindingRow: React.FC<{ finding: IrisFinding }> = ({ finding: f }) => {
  const sevColor =
    f.severity === 'block' ? C.critical : f.severity === 'warning' ? C.pending : C.ink3
  return (
    <li
      style={{
        padding: '8px 10px',
        backgroundColor: '#fff',
        border: `1px solid ${C.borderSubtle}`,
        borderLeft: `3px solid ${sevColor}`,
        borderRadius: 4,
      }}
    >
      <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{f.message}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        {f.actionLabel && f.onAction && (
          <button
            type="button"
            onClick={f.onAction}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: C.brandOrange,
              backgroundColor: '#fff',
              border: `1px solid ${C.brandOrange}`,
              borderRadius: 3,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            {f.actionLabel}
          </button>
        )}
        {f.citation && (
          <button
            type="button"
            onClick={f.citation.onClick}
            style={{
              padding: '2px 6px',
              fontSize: 10,
              fontWeight: 500,
              color: C.ink2,
              backgroundColor: C.surfaceInset,
              border: 'none',
              borderRadius: 3,
              cursor: f.citation.onClick ? 'pointer' : 'default',
              fontFamily: FONT,
            }}
            title={f.citation.label}
          >
            📎 {f.citation.label}
          </button>
        )}
      </div>
    </li>
  )
}

const SimilarRow: React.FC<{ item: SimilarPast }> = ({ item }) => (
  <li>
    <button
      type="button"
      onClick={item.onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        backgroundColor: '#fff',
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 4,
        fontFamily: FONT,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: C.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.number ? `#${item.number} · ` : ''}{item.title}
        </div>
        <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
          {item.disposition ?? 'No disposition recorded'}
          {item.resubmit_count > 0 && (
            <span
              title={`${item.resubmit_count} resubmit${item.resubmit_count === 1 ? '' : 's'}`}
              style={{ color: C.pending, marginLeft: 6 }}
            >
              · {item.resubmit_count} resubmit{item.resubmit_count === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={12} color={C.ink3} style={{ marginTop: 4 }} />
    </button>
  </li>
)

export default IrisCoPilotPanel
