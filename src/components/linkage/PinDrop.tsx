/**
 * PinDrop — manual drawing-pin fallback
 *
 * When GPS is unavailable (basement, signal jam) or wrong (drift > 20 m), the
 * auto-linker can't place a drawing pin. The Day/Field UIs surface this
 * inline:
 *
 *   "Tap drawing to pin manually"  →  opens this component
 *
 * The user clicks somewhere on the rendered drawing image; we report
 * normalized coords in [0..1] back to the caller, who writes a media_links
 * row with source='manual' (so the audit log distinguishes auto from manual
 * forever).
 *
 * The component itself is presentational — it renders the drawing image,
 * tracks pointer position, and emits onConfirm({ x, y }). Persistence + which
 * drawing was chosen are the parent's job.
 */

import React, { useCallback, useRef, useState } from 'react'
import { X, Crosshair } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Btn } from '../Primitives'
import { Eyebrow } from '../atoms'

interface PinDropProps {
  drawingUrl: string
  drawingTitle: string
  drawingSheet?: string
  /** Pre-existing pin to render at open (if user is editing a previous drop). */
  initialPin?: { x: number; y: number } | null
  onCancel: () => void
  onConfirm: (pin: { x: number; y: number }) => void
}

export const PinDrop: React.FC<PinDropProps> = ({
  drawingUrl,
  drawingTitle,
  drawingSheet,
  initialPin = null,
  onCancel,
  onConfirm,
}) => {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(initialPin)
  const imgRef = useRef<HTMLImageElement>(null)

  const place = useCallback((evt: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = (evt.clientX - rect.left) / rect.width
    const y = (evt.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    setPin({ x, y })
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pindrop-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26, 22, 19, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: spacing['4'],
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surfaceRaised, #FFFFFF)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          width: 'min(960px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacing['3']} ${spacing['4']}`,
            borderBottom: '1px solid var(--hairline)',
            gap: spacing['3'],
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <Eyebrow>Drop a pin</Eyebrow>
            <h2
              id="pindrop-title"
              style={{
                margin: 0,
                fontFamily: typography.fontFamilySerif,
                fontSize: 22,
                fontWeight: 400,
                color: colors.ink,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {drawingTitle}
              {drawingSheet && (
                <span style={{ color: colors.ink3, fontWeight: 400 }}>{` · ${drawingSheet}`}</span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: colors.ink3, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Drawing surface ─────────────── */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
            background: colors.surfaceInset,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing['4'],
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img
              ref={imgRef}
              src={drawingUrl}
              alt={drawingTitle}
              draggable={false}
              onClick={place}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '70vh',
                cursor: 'crosshair',
                userSelect: 'none',
              }}
            />
            {pin && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: `${pin.x * 100}%`,
                  top: `${pin.y * 100}%`,
                  width: 14, height: 14, marginLeft: -7, marginTop: -7,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: '0 0 0 4px var(--color-primary-light)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacing['3']} ${spacing['4']}`,
            borderTop: '1px solid var(--hairline)',
            gap: spacing['3'],
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1.5'],
              fontFamily: typography.fontFamily,
              fontSize: 12,
              color: colors.ink3,
            }}
          >
            <Crosshair size={13} />
            {pin
              ? `Pinned at ${(pin.x * 100).toFixed(1)}%, ${(pin.y * 100).toFixed(1)}%`
              : 'Tap the drawing to drop a pin.'}
          </div>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!pin}
              onClick={() => pin && onConfirm(pin)}
            >
              Save pin
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
