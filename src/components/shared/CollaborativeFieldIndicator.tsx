import React, { useMemo } from 'react'
import { spacing, typography, borderRadius, zIndex, transitions } from '../../styles/theme'

interface CollaborativeFieldIndicatorProps {
  /** Whether another user currently has this field locked */
  isLocked: boolean
  /** Display name of the user who holds the lock */
  lockedBy?: string
  /** Color assigned to the locking user */
  color?: string
  /** The form field to wrap */
  children: React.ReactNode
}

/**
 * Wraps a form field with a colored border and name badge when another user
 * is actively editing it. Provides a pulsing animation to signal live editing.
 *
 * Usage:
 * ```tsx
 * <CollaborativeFieldIndicator isLocked={isLocked} lockedBy={lockedBy} color={color}>
 *   <input ... />
 * </CollaborativeFieldIndicator>
 * ```
 */
export const CollaborativeFieldIndicator: React.FC<CollaborativeFieldIndicatorProps> = ({
  isLocked,
  lockedBy,
  color,
  children,
}) => {
  const borderColor = color ?? '#3A7BC8'

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    borderRadius: borderRadius.md,
    transition: `border-color ${transitions.quick}, box-shadow ${transitions.quick}`,
    ...(isLocked
      ? {
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 0 1px ${borderColor}33`,
        }
      : {
          border: '2px solid transparent',
        }),
  }), [isLocked, borderColor])

  const badgeStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: '-10px',
    left: spacing['3'],
    display: 'flex',
    alignItems: 'center',
    gap: spacing['1'],
    padding: `${spacing['0.5']} ${spacing['2']}`,
    backgroundColor: borderColor,
    color: '#FFFFFF',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
    lineHeight: typography.lineHeight.none,
    borderRadius: borderRadius.full,
    whiteSpace: 'nowrap' as const,
    zIndex: zIndex.tooltip,
    pointerEvents: 'none' as const,
    animation: 'collabPulse 2s ease-in-out infinite',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  }), [borderColor])

  const dotStyle = useMemo<React.CSSProperties>(() => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    animation: 'collabDotPulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  }), [])

  return (
    <div style={containerStyle} data-collab-indicator>
      <CollaborativeKeyframes />
      {isLocked && lockedBy && (
        <div style={badgeStyle} role="status" aria-label={`${lockedBy} is editing this field`}>
          <span style={dotStyle} />
          <span>{lockedBy}</span>
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Injects the keyframe animations once into the document head.
 * Uses a singleton pattern to avoid duplicates.
 */
let keyframesInjected = false

const CollaborativeKeyframes: React.FC = () => {
  React.useEffect(() => {
    if (keyframesInjected || typeof document === 'undefined') return
    keyframesInjected = true

    const style = document.createElement('style')
    style.textContent = `
      @keyframes collabPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
      }
      @keyframes collabDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.8); }
      }
    `
    document.head.appendChild(style)

    return () => {
      // Don't remove — other instances may still need it
    }
  }, [])

  return null
}

export default CollaborativeFieldIndicator
