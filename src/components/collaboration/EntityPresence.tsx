// Entity-level presence indicators.
// Shows who is viewing/editing a specific entity.
// Warning banner when another user is actively editing.

import React, { useEffect } from 'react'
import { usePresenceStore } from '../../stores/presenceStore'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'

// ── Presence Dots (for list rows) ────────────────────────

interface PresenceDotsProps {
  entityId: string
  maxVisible?: number
}

export const PresenceDots: React.FC<PresenceDotsProps> = ({ entityId, maxVisible = 3 }) => {
  const viewers = usePresenceStore((s) => s.getUsersViewingEntity(entityId))
  const isInitialized = usePresenceStore((s) => s.isInitialized)

  useEffect(() => {
    const store = usePresenceStore.getState()
    if (typeof (store as any).trackEntity === 'function') {
      ;(store as any).trackEntity(entityId)
      return () => { (store as any).untrackEntity(entityId) }
    }
    // TODO: presenceStore.trackEntity not yet implemented — presence data depends on parent PresenceBar subscription
  }, [entityId])

  if (!isInitialized || viewers.length === 0) return null

  const visible = viewers.slice(0, maxVisible)
  const overflow = viewers.length - maxVisible

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}
      title={viewers.map((u) => u.name).join(', ')}
      aria-label={`Being viewed by ${viewers.map((u) => u.name).join(', ')}`}
    >
      {visible.map((user) => (
        <button
          key={user.userId}
          aria-label={`${user.name} is viewing`}
          style={{
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: user.color,
              border: `2px solid ${colors.surfaceRaised}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.bold,
              color: colors.white,
              position: 'relative',
              zIndex: maxVisible - visible.indexOf(user),
            }}
          >
            {user.initials}
          </div>
        </button>
      ))}
      {overflow > 0 && (
        <button
          aria-label={`${overflow} more people viewing`}
          role="status"
          style={{
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span style={{
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            marginLeft: spacing['1'],
          }}>
            +{overflow}
          </span>
        </button>
      )}
    </div>
  )
}

// ── Editing Warning Banner ───────────────────────────────

interface EditingWarningProps {
  entityId: string
}

export const EditingWarning: React.FC<EditingWarningProps> = ({ entityId }) => {
  const editors = usePresenceStore((s) => s.getUsersViewingEntity(entityId))

  if (editors.length === 0) return null

  const names = editors.map((u) => u.name).join(', ')

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['4']}`,
        backgroundColor: colors.statusPendingSubtle,
        borderRadius: borderRadius.md,
        borderLeft: `3px solid ${colors.statusPending}`,
        marginBottom: spacing['3'],
        fontSize: typography.fontSize.sm,
        color: colors.statusPending,
        fontWeight: typography.fontWeight.medium,
        transition: `all ${transitions.quick}`,
      }}
    >
      <div style={{ display: 'flex', gap: '-2px' }}>
        {editors.slice(0, 2).map((user) => (
          <div
            key={user.userId}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              backgroundColor: user.color, border: `2px solid ${colors.surfaceRaised}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold, color: colors.white,
            }}
          >
            {user.initials}
          </div>
        ))}
      </div>
      <span>
        {editors.length === 1
          ? `${names} is currently viewing this item. Changes may conflict.`
          : `${names} are currently viewing this item. Changes may conflict.`}
      </span>
    </div>
  )
}

// ── Page Presence Bar ────────────────────────────────────

interface PagePresenceProps {
  page: string
}

export const PagePresence: React.FC<PagePresenceProps> = ({ page }) => {
  const viewers = usePresenceStore((s) => s.getUsersOnPage(page))

  if (viewers.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['1'],
      }}
      aria-label={`${viewers.length} other ${viewers.length === 1 ? 'user' : 'users'} on this page`}
    >
      {viewers.slice(0, 5).map((user, i) => (
        <div
          key={user.userId}
          title={user.name}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: user.color,
            border: `2px solid ${colors.surfaceRaised}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.bold,
            color: colors.white,
            marginLeft: i > 0 ? '-6px' : 0,
            zIndex: 5 - i,
            position: 'relative',
          }}
        >
          {user.initials}
        </div>
      ))}
      {viewers.length > 5 && (
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          marginLeft: spacing['1'],
        }}>
          +{viewers.length - 5}
        </span>
      )}
    </div>
  )
}
