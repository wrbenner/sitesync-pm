// Phase 8 — Markup tool selector.
//
// 6 tools per spec Part 6.2: pen / highlight / callout / redline / stamp /
// text. Phase 8 ships interactive pen + highlight + select-and-delete; the
// other 3 (callout, redline, stamp) ship as toolbar slots that capture
// kind into geometry but render the same as highlight for now (Phase 8b
// adds dedicated geometry handlers per kind).

import React from 'react'
import {
  Pen,
  Highlighter,
  MessageCircle,
  Edit3,
  Stamp as StampIcon,
  Type,
  MousePointer,
  Trash2,
} from 'lucide-react'
import type { MarkupKind } from '../../../../services/submittalMarkup'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export type ToolMode = 'select' | MarkupKind

const TOOLS: Array<{ mode: ToolMode; icon: React.ComponentType<{ size?: number }>; label: string; live: boolean }> = [
  { mode: 'select',    icon: MousePointer,   label: 'Select',    live: true },
  { mode: 'pen',       icon: Pen,            label: 'Pen',       live: true },
  { mode: 'highlight', icon: Highlighter,    label: 'Highlight', live: true },
  { mode: 'callout',   icon: MessageCircle,  label: 'Callout',   live: false },
  { mode: 'redline',   icon: Edit3,          label: 'Redline',   live: false },
  { mode: 'stamp',     icon: StampIcon,      label: 'Stamp',     live: false },
  { mode: 'text',      icon: Type,           label: 'Text',      live: false },
]

export interface MarkupToolbarProps {
  mode: ToolMode
  onModeChange: (mode: ToolMode) => void
  /** Show a Delete button when a selectable object is active. */
  selectionCount: number
  onDeleteSelection?: () => void
  revNumber: number
}

export const MarkupToolbar: React.FC<MarkupToolbarProps> = ({
  mode,
  onModeChange,
  selectionCount,
  onDeleteSelection,
  revNumber,
}) => (
  <div
    role="toolbar"
    aria-label="Markup tools"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      backgroundColor: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      fontFamily: FONT,
    }}
  >
    {TOOLS.map((t) => {
      const Icon = t.icon
      const active = t.mode === mode
      return (
        <button
          key={t.mode}
          type="button"
          aria-pressed={active}
          aria-label={t.label}
          title={t.live ? t.label : `${t.label} — coming in Phase 8b`}
          disabled={!t.live}
          onClick={() => t.live && onModeChange(t.mode)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: 'none',
            backgroundColor: active ? `${C.brandOrange}1F` : 'transparent',
            color: active ? C.brandOrange : t.live ? C.ink2 : C.ink3,
            cursor: t.live ? 'pointer' : 'not-allowed',
            borderRadius: 4,
            opacity: t.live ? 1 : 0.55,
          }}
        >
          <Icon size={14} />
        </button>
      )
    })}

    <div style={{ width: 1, height: 22, backgroundColor: C.borderSubtle, margin: '0 4px' }} />

    {selectionCount > 0 && onDeleteSelection && (
      <button
        type="button"
        onClick={onDeleteSelection}
        title="Delete selection"
        aria-label={`Delete ${selectionCount} selected`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px',
          backgroundColor: 'transparent',
          color: C.critical,
          border: `1px solid ${C.critical}`,
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: FONT,
        }}
      >
        <Trash2 size={11} /> Delete ({selectionCount})
      </button>
    )}

    <span style={{ flex: 1 }} />

    <span
      style={{
        fontSize: 11,
        color: C.ink3,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        backgroundColor: C.surfaceInset,
        borderRadius: 3,
        fontFamily: FONT,
      }}
    >
      Rev R{revNumber}
    </span>
  </div>
)

export default MarkupToolbar
