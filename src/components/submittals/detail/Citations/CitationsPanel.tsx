// Phase 7 — Citations side panel.
//
// Per ADR-004: right-rail dock, never modal, never full-page nav. Two-pane
// layout inside the panel: left rail = citation cards (grouped by kind),
// right pane = preview of the selected citation. Closing returns to the
// detail tab below.
//
// Phase 7 ships the panel shell + the 8-kind card system + preview view-
// switcher. PDF preview with highlight-rect uses a placeholder for now
// (the existing react-pdf wiring lives in `DocumentViewer.tsx` 948 LOC,
// which Phase 8 wires for the Markup tab; the preview here is structural,
// not pixel-accurate).

import React, { useState } from 'react'
import { X, ChevronRight, ExternalLink } from 'lucide-react'
import {
  CITATION_KIND_META,
  CITATION_KIND_ORDER,
  type CitationBase,
  type CitationKind,
  type CitationPreview,
} from './citationKinds'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const PANEL_WIDTH_LEFT = 240
const PANEL_WIDTH_RIGHT = 360
const PANEL_WIDTH_TOTAL = PANEL_WIDTH_LEFT + PANEL_WIDTH_RIGHT

export interface CitationsPanelProps {
  open: boolean
  onClose: () => void
  citations: CitationBase[]
  /** When set, the panel opens with this citation pre-selected. */
  initialCitationId?: string | null
}

export const CitationsPanel: React.FC<CitationsPanelProps> = ({
  open,
  onClose,
  citations,
  initialCitationId,
}) => {
  const [activeId, setActiveId] = useState<string | null>(
    initialCitationId ?? citations[0]?.id ?? null,
  )
  const active = citations.find((c) => c.id === activeId) ?? citations[0] ?? null

  // Esc closes.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const grouped = groupByKind(citations)

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Citations"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH_TOTAL,
        maxWidth: '95vw',
        backgroundColor: '#fff',
        borderLeft: `1px solid ${C.border}`,
        boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.06)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'row',
        fontFamily: FONT,
        color: C.ink,
        animation: 'sitesync-citations-slide 160ms ease-out',
      }}
    >
      <style>{`@keyframes sitesync-citations-slide { from { transform: translateX(${PANEL_WIDTH_TOTAL}px); } to { transform: translateX(0); } }`}</style>

      {/* Left rail — kind groups + citation cards */}
      <nav
        aria-label="Citation list"
        style={{
          flex: `0 0 ${PANEL_WIDTH_LEFT}px`,
          width: PANEL_WIDTH_LEFT,
          borderRight: `1px solid ${C.borderSubtle}`,
          backgroundColor: C.surface,
          overflow: 'auto',
        }}
      >
        <header
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${C.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fff',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.ink }}>
            Citations <span style={{ color: C.ink3, fontWeight: 500 }}>({citations.length})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close citations"
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: C.ink2,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        </header>

        {citations.length === 0 ? (
          <p style={{ padding: 16, fontSize: 12, color: C.ink3, lineHeight: 1.4 }}>
            No citations on this submittal yet. Iris adds them as it pre-flights and
            as reviewers respond.
          </p>
        ) : (
          CITATION_KIND_ORDER.filter((k) => grouped.get(k)?.length).map((k) => (
            <KindGroup
              key={k}
              kind={k}
              items={grouped.get(k) ?? []}
              activeId={active?.id ?? null}
              onSelect={(id) => setActiveId(id)}
            />
          ))
        )}
      </nav>

      {/* Right rail — preview pane */}
      <section
        aria-label="Citation preview"
        style={{
          flex: `0 0 ${PANEL_WIDTH_RIGHT}px`,
          width: PANEL_WIDTH_RIGHT,
          backgroundColor: '#fff',
          overflow: 'auto',
        }}
      >
        {active ? <CitationPreviewView citation={active} /> : (
          <div style={{ padding: 24, color: C.ink3, fontSize: 12 }}>
            Select a citation to preview.
          </div>
        )}
      </section>
    </aside>
  )
}

// ── Left rail — kind groups ────────────────────────────────────────────────

const KindGroup: React.FC<{
  kind: CitationKind
  items: CitationBase[]
  activeId: string | null
  onSelect: (id: string) => void
}> = ({ kind, items, activeId, onSelect }) => {
  const meta = CITATION_KIND_META[kind]
  const Icon = meta.icon
  return (
    <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
      <h3
        style={{
          margin: 0,
          padding: '10px 16px 6px',
          fontSize: 10,
          fontWeight: 700,
          color: C.ink3,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ color: meta.accent }}>
          <Icon size={11} />
        </span>
        {meta.label}
        <span style={{ color: C.ink4, fontWeight: 600 }}>· {items.length}</span>
      </h3>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: '0 0 8px' }}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={item.id === activeId}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px 8px 12px',
                border: 'none',
                borderLeft: `3px solid ${item.id === activeId ? meta.accent : 'transparent'}`,
                backgroundColor: item.id === activeId ? C.surfaceInset : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: FONT,
              }}
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
                  {item.label}
                </div>
                {item.subtitle && (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.ink3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 1,
                    }}
                  >
                    {item.subtitle}
                  </div>
                )}
              </div>
              <ChevronRight size={11} color={C.ink3} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Right rail — preview view ───────────────────────────────────────────────

const CitationPreviewView: React.FC<{ citation: CitationBase }> = ({ citation }) => {
  const meta = CITATION_KIND_META[citation.kind]
  const Icon = meta.icon

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          backgroundColor: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <span style={{ color: meta.accent, marginTop: 2 }}>
          <Icon size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.ink3, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 2, lineHeight: 1.3 }}>
            {citation.label}
          </div>
          {citation.subtitle && (
            <div style={{ fontSize: 12, color: C.ink2, marginTop: 2, lineHeight: 1.3 }}>
              {citation.subtitle}
            </div>
          )}
        </div>
      </header>
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        <PreviewBody preview={citation.preview} kind={citation.kind} />
      </div>
    </div>
  )
}

const PreviewBody: React.FC<{ preview: CitationPreview | undefined; kind: CitationKind }> = ({ preview, kind }) => {
  if (!preview) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: C.ink3, lineHeight: 1.4 }}>
        No preview available for this citation.
      </p>
    )
  }
  switch (preview.kind) {
    case 'pdf':
      return <PdfPreview preview={preview} />
    case 'text':
      return (
        <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {preview.body}
        </p>
      )
    case 'submittal_summary':
      return <SubmittalSummary preview={preview} />
    case 'rfi_summary':
      return <RfiSummary preview={preview} />
    case 'change_order_summary':
      return <ChangeOrderSummary preview={preview} />
    case 'schedule_activity_summary':
      return <ScheduleActivitySummary preview={preview} />
    default:
      return <p style={{ fontSize: 12, color: C.ink3 }}>Unsupported preview kind for {kind}.</p>
  }
}

const PdfPreview: React.FC<{ preview: Extract<CitationPreview, { kind: 'pdf' }> }> = ({ preview }) => (
  <div>
    <div
      role="img"
      aria-label={`PDF preview placeholder for page ${preview.page}`}
      style={{
        position: 'relative',
        width: '100%',
        height: 360,
        backgroundColor: C.surfaceInset,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.ink3,
        fontSize: 12,
      }}
    >
      Page {preview.page} preview
      {preview.highlightRect && (
        <span
          aria-label="Highlight rectangle"
          style={{
            position: 'absolute',
            left: `${preview.highlightRect[0]}%`,
            top: `${preview.highlightRect[1]}%`,
            width: `${preview.highlightRect[2]}%`,
            height: `${preview.highlightRect[3]}%`,
            backgroundColor: 'rgba(244, 120, 32, 0.18)',
            border: `2px solid ${C.brandOrange}`,
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
    <p style={{ margin: '10px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
      Phase 7 ships the structural preview frame. Phase 8 wires the
      {' '}<code style={{ fontFamily: FONT }}>DocumentViewer.tsx</code>{' '}
      pixel-accurate render with the highlight rect.
    </p>
    <a
      href={preview.pdfUrl}
      target="_blank"
      rel="noreferrer"
      style={{
        marginTop: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: C.brandOrange,
        textDecoration: 'none',
        fontWeight: 500,
      }}
    >
      Open PDF in new tab <ExternalLink size={11} />
    </a>
  </div>
)

const SubmittalSummary: React.FC<{ preview: Extract<CitationPreview, { kind: 'submittal_summary' }> }> = ({ preview }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <SummaryRow label="Number" value={preview.number ?? '—'} mono />
    <SummaryRow label="Title" value={preview.title} bold />
    <SummaryRow label="Disposition" value={preview.disposition ?? '—'} />
    <SummaryRow label="Resubmits" value={String(preview.rev_count)} />
    <a
      href={`/submittals/${preview.submittal_id}`}
      style={{ marginTop: 6, fontSize: 12, color: C.brandOrange, fontWeight: 500, textDecoration: 'none' }}
    >
      Open submittal →
    </a>
  </div>
)

const RfiSummary: React.FC<{ preview: Extract<CitationPreview, { kind: 'rfi_summary' }> }> = ({ preview }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <SummaryRow label="RFI" value={preview.number ?? '—'} mono />
    <SummaryRow label="Status" value={preview.status} />
    <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{preview.question}</p>
    <a
      href={`/rfis/${preview.rfi_id}`}
      style={{ marginTop: 6, fontSize: 12, color: C.brandOrange, fontWeight: 500, textDecoration: 'none' }}
    >
      Open RFI →
    </a>
  </div>
)

const ChangeOrderSummary: React.FC<{ preview: Extract<CitationPreview, { kind: 'change_order_summary' }> }> = ({ preview }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <SummaryRow label="CO" value={preview.number ?? '—'} mono />
    <SummaryRow label="Status" value={preview.status} />
    <SummaryRow
      label="Amount"
      value={preview.amount_cents != null ? formatMoney(preview.amount_cents) : '—'}
      mono
    />
    <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{preview.description}</p>
    <a
      href={`/change-orders/${preview.co_id}`}
      style={{ marginTop: 6, fontSize: 12, color: C.brandOrange, fontWeight: 500, textDecoration: 'none' }}
    >
      Open change order →
    </a>
  </div>
)

const ScheduleActivitySummary: React.FC<{ preview: Extract<CitationPreview, { kind: 'schedule_activity_summary' }> }> = ({ preview }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <SummaryRow label="Activity" value={preview.name} bold />
    <SummaryRow label="Start" value={preview.start_date ?? '—'} mono />
    <SummaryRow label="End" value={preview.end_date ?? '—'} mono />
  </div>
)

const SummaryRow: React.FC<{ label: string; value: React.ReactNode; bold?: boolean; mono?: boolean }> = ({
  label,
  value,
  bold,
  mono,
}) => (
  <div style={{ display: 'flex', gap: 8 }}>
    <span
      style={{
        flex: '0 0 80px',
        fontSize: 11,
        color: C.ink3,
        fontWeight: 500,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
    <span
      style={{
        flex: 1,
        fontSize: 13,
        color: C.ink,
        fontWeight: bold ? 600 : 400,
        fontFamily: mono ? '"JetBrains Mono", SFMono-Regular, Menlo, monospace' : 'inherit',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </span>
  </div>
)

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function groupByKind(citations: CitationBase[]): Map<CitationKind, CitationBase[]> {
  const map = new Map<CitationKind, CitationBase[]>()
  for (const c of citations) {
    const list = map.get(c.kind)
    if (list) list.push(c)
    else map.set(c.kind, [c])
  }
  return map
}

export default CitationsPanel
