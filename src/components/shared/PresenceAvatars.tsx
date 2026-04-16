import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import type { PresenceUser } from '../../lib/realtime'
import { usePresenceStore } from '../../stores/presenceStore'
import { useShallow } from 'zustand/react/shallow'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const EMPTY_USERS: PresenceUser[] = []

// ── Presence helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(lastSeen: number): string {
  const diffMs = Date.now() - lastSeen
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

type PresenceStatus = 'active' | 'idle' | 'away'

function getPresenceStatus(lastSeen: number): PresenceStatus {
  const diffMin = (Date.now() - lastSeen) / 60_000
  if (diffMin < 5) return 'active'
  if (diffMin < 30) return 'idle'
  return 'away'
}

const STATUS_COLOR: Record<PresenceStatus, string> = {
  active: colors.statusActive,
  idle: colors.statusPending,
  away: colors.statusNeutral,
}

const STATUS_BORDER: Record<PresenceStatus, string> = {
  active: colors.statusActive,
  idle: colors.statusPending,
  away: '#C0C4CC',
}

const TOOLTIP_CONTENT_STYLE: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['3']}`,
  backgroundColor: colors.textPrimary,
  borderRadius: borderRadius.md,
  boxShadow: shadows.dropdown,
  fontFamily: typography.fontFamily,
  zIndex: 9999,
  maxWidth: 240,
  animation: 'presenceTooltipIn 0.15s ease',
}

// ── Tooltip content ───────────────────────────────────────────────────────────

const AvatarTooltipContent: React.FC<{ user: { displayName: string; role?: string; lastSeen: number } }> = ({ user }) => {
  const status = getPresenceStatus(user.lastSeen)
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{
        fontSize: 14,
        fontWeight: typography.fontWeight.bold,
        color: colors.white,
        lineHeight: typography.lineHeight.snug,
      }}>
        {user.displayName}
      </div>
      {user.role && (
        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.65)',
          marginTop: 2,
          lineHeight: typography.lineHeight.snug,
        }}>
          {user.role}
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['1'],
        marginTop: spacing['1.5'],
      }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: STATUS_COLOR[status],
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          {formatRelativeTime(user.lastSeen)}
        </span>
      </div>
    </div>
  )
}

const OverflowTooltipContent: React.FC<{ users: Array<{ displayName: string; role?: string; lastSeen: number }> }> = ({ users }) => (
  <div style={{ minWidth: 160 }}>
    {users.map((u, i) => (
      <div key={i} style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        marginBottom: i < users.length - 1 ? spacing['2'] : 0,
      }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: STATUS_COLOR[getPresenceStatus(u.lastSeen)],
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: typography.fontWeight.semibold, color: colors.white }}>
            {u.displayName}
          </div>
          {u.role && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{u.role}</div>
          )}
        </div>
      </div>
    ))}
  </div>
)

// ── PresenceAvatars ───────────────────────────────────────────────────────────

interface PresenceAvatarsProps {
  /** Users to display (pass directly or use page/entityId helpers) */
  users?: PresenceUser[]
  /** Auto-fetch users viewing this page */
  page?: string
  /** Auto-fetch users viewing this entity */
  entityId?: string
  /** Max avatars before overflow badge */
  maxVisible?: number
  /** Avatar size in px */
  size?: number
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = React.memo(({
  users: propUsers,
  page,
  entityId,
  maxVisible = 5,
  size = 32,
}) => {
  const reducedMotion = useReducedMotion()
  const pageUsers = usePresenceStore(useShallow((s) => page ? s.getUsersOnPage(page) : EMPTY_USERS))
  const entityUsers = usePresenceStore(useShallow((s) => entityId ? s.getUsersViewingEntity(entityId) : EMPTY_USERS))

  const users = propUsers ?? (entityId ? entityUsers : pageUsers)

  if (users.length === 0) return null

  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible
  const overlapPx = -8

  return (
    <>
      <style>{`@keyframes presenceTooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <Tooltip.Provider delayDuration={150}>
        <div
          style={{ display: 'flex', alignItems: 'center' }}
          role="group"
          aria-label={`${users.length} user${users.length !== 1 ? 's' : ''} online`}
        >
          <AnimatePresence mode="popLayout">
            {visible.map((user, i) => {
              const status = getPresenceStatus(user.lastSeen)
              return (
                <Tooltip.Root key={user.userId}>
                  <Tooltip.Trigger asChild>
                    <motion.div
                      initial={reducedMotion ? undefined : { scale: 0, opacity: 0 }}
                      animate={reducedMotion ? undefined : { scale: 1, opacity: 1 }}
                      exit={reducedMotion ? undefined : { scale: 0, opacity: 0 }}
                      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 25, duration: 0.2 }}
                      layout
                      title={user.displayName}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        backgroundColor: user.color || colors.statusInfo,
                        border: `2px solid ${colors.white}`,
                        boxShadow: `0 0 0 2px ${STATUS_BORDER[status]}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: size <= 24 ? '9px' : '11px',
                        fontWeight: 700,
                        color: colors.white,
                        marginLeft: i > 0 ? overlapPx : 0,
                        position: 'relative',
                        zIndex: maxVisible - i,
                        cursor: 'default',
                        flexShrink: 0,
                      }}
                    >
                      {user.initials}
                      {/* Editing pulse indicator */}
                      {(user as PresenceUserWithAction).action === 'editing' && (
                        <div
                          role="status"
                          aria-label={`${user.displayName} is editing`}
                          style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: colors.statusPending,
                            border: `1.5px solid ${colors.surfaceRaised}`,
                            animation: 'pulse 2s infinite',
                          }}
                        />
                      )}
                    </motion.div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="bottom"
                      align="center"
                      sideOffset={8}
                      avoidCollisions
                      collisionPadding={12}
                      style={TOOLTIP_CONTENT_STYLE}
                    >
                      <AvatarTooltipContent user={user} />
                      <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )
            })}
          </AnimatePresence>

          {overflow > 0 && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <motion.div
                  initial={reducedMotion ? undefined : { scale: 0 }}
                  animate={reducedMotion ? undefined : { scale: 1 }}
                  transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 25 }}
                  aria-label={`${overflow} more user${overflow !== 1 ? 's' : ''}`}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    backgroundColor: colors.surfaceInset,
                    border: `2px solid ${colors.white}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: size <= 24 ? '9px' : '11px',
                    fontWeight: 600,
                    color: colors.textSecondary,
                    marginLeft: overlapPx,
                    cursor: 'default',
                    flexShrink: 0,
                  }}
                >
                  <span aria-hidden="true">+{overflow}</span>
                </motion.div>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  align="center"
                  sideOffset={8}
                  avoidCollisions
                  collisionPadding={12}
                  style={TOOLTIP_CONTENT_STYLE}
                >
                  <OverflowTooltipContent users={users.slice(maxVisible)} />
                  <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </div>
      </Tooltip.Provider>
    </>
  )
})

// Extended type for editing state (used internally)
interface PresenceUserWithAction extends PresenceUser {
  action?: 'viewing' | 'editing'
}
