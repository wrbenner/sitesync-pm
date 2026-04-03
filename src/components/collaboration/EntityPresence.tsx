// Entity-level presence indicators.
// Shows who is viewing/editing a specific entity.
// Warning banner when another user is actively editing.

import React, { useState, useRef, useEffect } from 'react'
import { usePresenceStore } from '../../stores/presenceStore'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme'

// ── Presence Dots (for list rows) ────────────────────────

interface PresenceDotsProps {
  entityId: string
  maxVisible?: number
}

export const PresenceDots: React.FC<PresenceDotsProps> = ({ entityId, maxVisible = 3 }) => {
  // Data flow: PresenceBar's useOthers hook (Liveblocks) populates presenceStore,
  // and this component reads entity viewers via the getUsersViewingEntity selector.
  // No explicit registration is needed here.
  const viewers = usePresenceStore((s) => s.getUsersViewingEntity(entityId))
  const isInitialized = usePresenceStore((s) => s.isInitialized)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowContainerRef = useRef<HTMLDivElement>(null)
  const overflowToggleRef = useRef<HTMLButtonElement>(null)
  const firstDropdownItemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (overflowOpen && firstDropdownItemRef.current) {
      firstDropdownItemRef.current.focus()
    }
  }, [overflowOpen])

  if (!isInitialized || viewers.length === 0) {
    return null
  }

  const visible = viewers.slice(0, maxVisible)
  const overflowViewers = viewers.slice(maxVisible)
  const overflow = overflowViewers.length

  const handleOverflowKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOverflowOpen((o) => !o)
    }
  }

  const handleOverflowBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Close only when focus leaves the entire container (button + dropdown)
    if (!overflowContainerRef.current?.contains(e.relatedTarget as Node)) {
      setOverflowOpen(false)
    }
  }

  return (
    <div
      role="group"
      aria-label="Active viewers on this item"
      style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}
      title={viewers.map((u) => u.name).join(', ')}
      aria-live="polite"
    >
      {visible.map((user) => (
        <button
          key={user.userId}
          aria-label={`${user.name} is viewing this item`}
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
        <div
          ref={overflowContainerRef}
          style={{ position: 'relative' }}
          onBlur={handleOverflowBlur}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setOverflowOpen(false)
              overflowToggleRef.current?.focus()
            }
          }}
        >
          <button
            ref={overflowToggleRef}
            aria-label={`${overflow} more viewers`}
            aria-expanded={overflowOpen}
            aria-haspopup="true"
            aria-controls="presence-overflow-list"
            onClick={() => setOverflowOpen((o) => !o)}
            onKeyDown={handleOverflowKeyDown}
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
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: colors.textTertiary,
              border: `2px solid ${colors.surfaceRaised}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.bold,
              color: colors.white,
            }}>
              +{overflow}
            </div>
          </button>
          {overflowOpen && (
            <div
              id="presence-overflow-list"
              role="list"
              aria-label="Additional viewers"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: colors.surfaceRaised,
                border: '1px solid ' + colors.border,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
                boxShadow: shadows.md,
                zIndex: 50,
                minWidth: 140,
              }}
            >
              {overflowViewers.map((user, idx) => (
                <div
                  key={user.userId}
                  role="listitem"
                  tabIndex={idx === 0 ? 0 : -1}
                  ref={idx === 0 ? firstDropdownItemRef : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    padding: `${spacing['1']} 0`,
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: user.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.bold,
                    color: colors.white,
                    flexShrink: 0,
                  }}>
                    {user.initials}
                  </div>
                  {user.name}
                </div>
              ))}
            </div>
          )}
        </div>
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
      aria-live="assertive"
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
