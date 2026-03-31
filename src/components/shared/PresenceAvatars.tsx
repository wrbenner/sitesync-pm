import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import type { PresenceUser } from '../../lib/realtime'
import { usePresenceStore } from '../../stores/presenceStore'

// ── PresenceAvatars ─────────────────────────────────────
// Animated avatar stack showing who's viewing the same page/entity.
// Tooltips show user name + action ("viewing" / "editing").

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
  size = 28,
}) => {
  const pageUsers = usePresenceStore((s) => page ? s.getUsersOnPage(page) : [])
  const entityUsers = usePresenceStore((s) => entityId ? s.getUsersViewingEntity(entityId) : [])

  const users = propUsers ?? (entityId ? entityUsers : pageUsers)

  if (users.length === 0) return null

  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible

  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        style={{ display: 'flex', alignItems: 'center' }}
        role="group"
        aria-label={`${users.length} user${users.length !== 1 ? 's' : ''} online`}
      >
        <AnimatePresence mode="popLayout">
          {visible.map((user, i) => (
            <Tooltip.Root key={user.userId}>
              <Tooltip.Trigger asChild>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25, duration: 0.2 }}
                  layout
                  style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    backgroundColor: user.color || colors.statusInfo,
                    border: `2px solid ${colors.surfaceRaised}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: size <= 24 ? '8px' : '10px',
                    fontWeight: 700,
                    color: colors.white,
                    marginLeft: i > 0 ? `-${Math.round(size * 0.28)}px` : 0,
                    position: 'relative',
                    zIndex: maxVisible - i,
                    cursor: 'default',
                    flexShrink: 0,
                  }}
                >
                  {user.initials}
                  {/* Editing pulse indicator */}
                  {(user as PresenceUserWithAction).action === 'editing' && (
                    <div style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors.statusPending,
                      border: `1.5px solid ${colors.surfaceRaised}`,
                      animation: 'pulse 2s infinite',
                    }} />
                  )}
                </motion.div>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={6}
                  style={{
                    padding: `${spacing['1.5']} ${spacing['3']}`,
                    backgroundColor: colors.textPrimary,
                    color: colors.white,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.caption,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    boxShadow: shadows.dropdown,
                    zIndex: 9999,
                    maxWidth: 200,
                    lineHeight: typography.lineHeight.snug,
                  }}
                >
                  <div>{user.name}</div>
                  <div style={{ opacity: 0.7, fontSize: '10px', marginTop: 1 }}>
                    {(user as PresenceUserWithAction).action === 'editing' ? 'editing' : 'viewing'}
                  </div>
                  <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </AnimatePresence>

        {overflow > 0 && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: colors.surfaceInset,
                  border: `2px solid ${colors.surfaceRaised}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: size <= 24 ? '8px' : '10px',
                  fontWeight: 600,
                  color: colors.textSecondary,
                  marginLeft: `-${Math.round(size * 0.28)}px`,
                  cursor: 'default',
                  flexShrink: 0,
                }}
              >
                +{overflow}
              </motion.div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={6}
                style={{
                  padding: `${spacing['1.5']} ${spacing['3']}`,
                  backgroundColor: colors.textPrimary,
                  color: colors.white,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.caption,
                  fontFamily: typography.fontFamily,
                  boxShadow: shadows.dropdown,
                  zIndex: 9999,
                }}
              >
                {users.slice(maxVisible).map(u => u.name).join(', ')}
                <Tooltip.Arrow style={{ fill: colors.textPrimary }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
      </div>
    </Tooltip.Provider>
  )
})

// Extended type for editing state
interface PresenceUserWithAction extends PresenceUser {
  action?: 'viewing' | 'editing'
}
