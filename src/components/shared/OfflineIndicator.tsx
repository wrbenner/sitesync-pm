import { useState, useEffect, type CSSProperties } from 'react'
import { useOfflineStatus } from '../../hooks/useOffline'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
} from '../../styles/theme'

// ── Styles ───────────────────────────────────────────────

const bannerBase: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: zIndex.toast,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing['2'],
  padding: `${spacing['1.5']} ${spacing['4']}`,
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  lineHeight: typography.lineHeight.normal,
  transition: `transform ${transitions.smooth}, opacity ${transitions.smooth}`,
  boxShadow: shadows.dropdown,
}

const hiddenStyle: CSSProperties = {
  ...bannerBase,
  transform: 'translateY(-100%)',
  opacity: 0,
  pointerEvents: 'none',
}

const visibleStyle: CSSProperties = {
  ...bannerBase,
  transform: 'translateY(0)',
  opacity: 1,
}

const offlineColors: CSSProperties = {
  background: colors.statusPendingSubtle,
  color: colors.statusPending,
  borderBottom: `1px solid ${colors.statusPending}`,
}

const syncingColors: CSSProperties = {
  background: colors.statusInfoSubtle,
  color: colors.statusInfo,
  borderBottom: `1px solid ${colors.statusInfo}`,
}

const conflictColors: CSSProperties = {
  background: colors.statusCriticalSubtle,
  color: colors.statusCritical,
  borderBottom: `1px solid ${colors.statusCritical}`,
  cursor: 'pointer',
}

const errorColors: CSSProperties = {
  background: colors.statusCriticalSubtle,
  color: colors.statusCritical,
  borderBottom: `1px solid ${colors.statusCritical}`,
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '20px',
  height: '20px',
  padding: `0 ${spacing['1.5']}`,
  borderRadius: borderRadius.full,
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.semibold,
  lineHeight: 1,
}

const spinnerStyle: CSSProperties = {
  display: 'inline-block',
  width: '14px',
  height: '14px',
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: borderRadius.full,
  animation: 'offline-indicator-spin 0.8s linear infinite',
}

const dotStyle: CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: borderRadius.full,
  backgroundColor: 'currentColor',
  flexShrink: 0,
}

// ── Component ────────────────────────────────────────────

interface OfflineIndicatorProps {
  /** Callback when the user clicks on the conflict banner */
  onConflictClick?: () => void
}

export function OfflineIndicator({ onConflictClick }: OfflineIndicatorProps) {
  const { isOnline, pendingCount, conflicts, status } = useOfflineStatus()
  const [visible, setVisible] = useState(false)

  // Determine what to show
  const showBanner = !isOnline || status === 'syncing' || conflicts > 0 || status === 'error'

  // Animate in/out with a slight delay for smoother transitions
  useEffect(() => {
    if (showBanner) {
      // Small delay before showing to avoid flicker on quick reconnections
      const timer = setTimeout(() => setVisible(true), 200)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [showBanner])

  // Pick the right appearance
  let colorScheme: CSSProperties
  let content: JSX.Element

  if (conflicts > 0) {
    colorScheme = conflictColors
    content = (
      <>
        <span style={dotStyle} />
        <span>
          {conflicts} conflict{conflicts > 1 ? 's' : ''} need{conflicts === 1 ? 's' : ''} resolution
        </span>
        <span
          style={{
            ...badgeStyle,
            background: colors.statusCritical,
            color: colors.white,
          }}
        >
          {conflicts}
        </span>
      </>
    )
  } else if (!isOnline) {
    colorScheme = offlineColors
    content = (
      <>
        <span style={dotStyle} />
        <span>Offline — changes will sync when reconnected</span>
        {pendingCount > 0 && (
          <span
            style={{
              ...badgeStyle,
              background: colors.statusPending,
              color: colors.white,
            }}
          >
            {pendingCount} pending
          </span>
        )}
      </>
    )
  } else if (status === 'syncing') {
    colorScheme = syncingColors
    content = (
      <>
        <span style={spinnerStyle} />
        <span>Syncing{pendingCount > 0 ? ` ${pendingCount} change${pendingCount > 1 ? 's' : ''}` : ''}...</span>
      </>
    )
  } else {
    // Error state
    colorScheme = errorColors
    content = (
      <>
        <span style={dotStyle} />
        <span>Sync error — will retry automatically</span>
      </>
    )
  }

  const style: CSSProperties = {
    ...(visible ? visibleStyle : hiddenStyle),
    ...colorScheme,
  }

  return (
    <>
      {/* Inject keyframe animation for the spinner */}
      <style>{`
        @keyframes offline-indicator-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={style}
        onClick={conflicts > 0 ? onConflictClick : undefined}
      >
        {content}
      </div>
    </>
  )
}
