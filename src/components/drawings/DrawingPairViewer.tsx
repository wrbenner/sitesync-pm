import React, { useState } from 'react'
import { Layers } from 'lucide-react'
import { colors, spacing } from '../../styles/theme'
import { Btn } from '../Primitives'
import type { DrawingPair } from '../../types/ai'

interface DrawingPairViewerProps {
  pair: DrawingPair
  archImageUrl: string | null
  structImageUrl: string | null
  onClose?: () => void
}

export const DrawingPairViewer: React.FC<DrawingPairViewerProps> = ({
  pair,
  archImageUrl,
  structImageUrl,
  onClose,
}) => {
  const [showOverlay, setShowOverlay] = useState(!!pair.overlap_image_url)
  const [opacity, setOpacity] = useState(70)

  return (
    <div
      role="dialog"
      aria-label="Drawing pair viewer"
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 12,
        padding: spacing.md,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={18} color={colors.primaryOrange} />
          <span style={{ fontWeight: 600, color: colors.textPrimary }}>
            Paired Drawings
          </span>
          <span
            style={{
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            Confidence {Math.round((pair.pairing_confidence ?? 0) * 100)}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          {pair.overlap_image_url && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => setShowOverlay(e.target.checked)}
                aria-label="Toggle overlay visibility"
              />
              Overlay
            </label>
          )}
          {showOverlay && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              Opacity
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                aria-label="Overlay opacity"
              />
            </label>
          )}
          {onClose && (
            <Btn variant="secondary" size="sm" onClick={onClose} aria-label="Close pair viewer">
              Close
            </Btn>
          )}
        </div>
      </header>

      {pair.pairing_reason && (
        <div
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            backgroundColor: colors.surfacePage,
            padding: spacing.sm,
            borderRadius: 6,
          }}
        >
          <strong style={{ color: colors.textPrimary }}>Why paired:</strong> {pair.pairing_reason}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: spacing.md,
        }}
      >
        <figure style={{ margin: 0 }}>
          <figcaption
            style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}
          >
            Architectural
          </figcaption>
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: 240,
              backgroundColor: colors.surfacePage,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {archImageUrl ? (
              <img
                src={archImageUrl}
                alt="Architectural drawing"
                style={{ width: '100%', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  padding: spacing.md,
                  color: colors.textTertiary,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No architectural image available
              </div>
            )}
            {showOverlay && pair.overlap_image_url && (
              <img
                src={pair.overlap_image_url}
                alt="Edge overlap overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: opacity / 100,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </figure>

        <figure style={{ margin: 0 }}>
          <figcaption
            style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}
          >
            Structural
          </figcaption>
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: 240,
              backgroundColor: colors.surfacePage,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {structImageUrl ? (
              <img
                src={structImageUrl}
                alt="Structural drawing"
                style={{ width: '100%', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  padding: spacing.md,
                  color: colors.textTertiary,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No structural image available
              </div>
            )}
          </div>
        </figure>
      </div>
    </div>
  )
}

export default DrawingPairViewer
