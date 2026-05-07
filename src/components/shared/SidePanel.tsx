// Shared right-rail SidePanel — extracted in Phase 4 for reuse by Phase 4
// (Ball-in-Court reviewer plate) and Phase 7 (citations preview).
//
// Per ADR-004: never modal, never full-page nav. Slides in from the right,
// overlays content (does not push), closes via × or Esc.

import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  scrim: 'rgba(26, 22, 19, 0.18)',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface SidePanelProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Width in pixels. Defaults to 400 per ADR-004. */
  width?: number
  /** When true, renders a translucent scrim behind the panel. Defaults to false. */
  withScrim?: boolean
  children: React.ReactNode
  /** Aria label fallback when title isn't a plain string. */
  ariaLabel?: string
}

export const SidePanel: React.FC<SidePanelProps> = ({
  open,
  onClose,
  title,
  subtitle,
  width = 400,
  withScrim = false,
  children,
  ariaLabel,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Esc closes; focus moves into the panel on open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {withScrim && (
        <div
          aria-hidden
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: C.scrim,
            zIndex: 39,
            animation: 'sitesync-side-panel-fade 120ms ease-out',
          }}
        />
      )}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : 'Side panel')}
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: '90vw',
          backgroundColor: '#fff',
          borderLeft: `1px solid ${C.border}`,
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.06)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT,
          color: C.ink,
          animation: 'sitesync-side-panel-slide 160ms ease-out',
          outline: 'none',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: `1px solid ${C.borderSubtle}`,
            backgroundColor: C.surface,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 12, color: C.ink3, marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            aria-label="Close side panel"
            onClick={onClose}
            style={{
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: 'none',
              backgroundColor: 'transparent',
              color: C.ink2,
              cursor: 'pointer',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0EFEB' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <X size={14} />
          </button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>{children}</div>
        <style>
          {`@keyframes sitesync-side-panel-slide { from { transform: translateX(${width}px); } to { transform: translateX(0); } }
            @keyframes sitesync-side-panel-fade { from { opacity: 0; } to { opacity: 1; } }`}
        </style>
      </aside>
    </>
  )
}

export default SidePanel
