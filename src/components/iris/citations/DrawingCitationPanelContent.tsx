/**
 * DrawingCitationPanelContent — body of the citation panel for a
 * drawing_coordinate citation.
 *
 * Renders the drawing thumbnail with a pin overlay at (x, y). When
 * the IssueOverlay's full-page deep link works the parent's footer
 * link takes the user there for editing; the panel itself is the
 * peek-without-leaving experience.
 */
import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { DraftedActionCitation } from '../../../types/draftedActions'

interface Props {
  data?: Record<string, unknown>
  citation: DraftedActionCitation
}

interface DrawingSidePanelData {
  drawing_id?: string
  title?: string | null
  pin_x?: number | null
  pin_y?: number | null
}

export const DrawingCitationPanelContent: React.FC<Props> = ({ data, citation }) => {
  const d = (data ?? {}) as DrawingSidePanelData
  const x = (typeof d.pin_x === 'number' ? d.pin_x : citation.x) ?? null
  const y = (typeof d.pin_y === 'number' ? d.pin_y : citation.y) ?? null
  const title = d.title ?? citation.label

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div>
        <div
          style={{
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: spacing['1'],
          }}
        >
          Drawing
        </div>
        <div
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}
        >
          {title}
        </div>
      </div>
      {/* Synthetic pin preview — the in-app drawing viewer renders the
          actual tiles; the panel just confirms the location numerically. */}
      <div
        aria-label={
          x != null && y != null
            ? `Pin at coordinates ${x.toFixed(2)}, ${y.toFixed(2)}`
            : 'No pin coordinates available'
        }
        style={{
          position: 'relative',
          aspectRatio: '4 / 3',
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid for orientation */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              `linear-gradient(${colors.borderSubtle} 1px, transparent 1px),` +
              `linear-gradient(90deg, ${colors.borderSubtle} 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            opacity: 0.6,
          }}
        />
        {x != null && y != null && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${Math.max(0, Math.min(1, x)) * 100}%`,
              top: `${Math.max(0, Math.min(1, y)) * 100}%`,
              transform: 'translate(-50%, -100%)',
              width: 24,
              height: 24,
              backgroundColor: colors.primaryOrange,
              borderRadius: '50% 50% 50% 0',
              transformOrigin: 'bottom',
              rotate: '-45deg',
              boxShadow: `0 2px 6px rgba(15, 23, 42, 0.3)`,
            }}
          />
        )}
      </div>
      {x != null && y != null && (
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          Pin: ({x.toFixed(2)}, {y.toFixed(2)}) — open in the full drawing for the
          tile-resolution view.
        </div>
      )}
    </div>
  )
}
