import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {  Pencil } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { usePresenceStore } from '../../stores/presenceStore'
import { useShallow } from 'zustand/react/shallow'
import { broadcastEditingStart, broadcastEditingStop } from '../../lib/realtime'

// ── Editing Lock Banner ─────────────────────────────────
// Shows a warning when another user is editing the same entity.
// Automatically broadcasts editing state when mounted.

interface EditingLockBannerProps {
  /** Entity type (rfi, submittal, task, etc.) */
  entityType: string
  /** Entity ID being viewed/edited */
  entityId: string
  /** Whether the current user is in edit mode */
  isEditing?: boolean
}

export const EditingLockBanner: React.FC<EditingLockBannerProps> = React.memo(({
  entityType,
  entityId,
  isEditing = false,
}) => {
  const editors = usePresenceStore(useShallow((s) => s.getUsersEditingEntity(entityId)))

  // Broadcast editing state changes
  useEffect(() => {
    if (isEditing) {
      broadcastEditingStart(entityType, entityId)
    } else {
      broadcastEditingStop()
    }
    return () => {
      broadcastEditingStop()
    }
  }, [isEditing, entityType, entityId])

  if (editors.length === 0) return null

  const names = editors.map(e => e.name)
  const displayName = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        role="alert"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          padding: `${spacing['2']} ${spacing['4']}`,
          backgroundColor: colors.statusPendingSubtle,
          borderRadius: borderRadius.md,
          borderLeft: `3px solid ${colors.statusPending}`,
          marginBottom: spacing['3'],
        }}
      >
        {/* Editor avatars */}
        <div style={{ display: 'flex', gap: '-2px', flexShrink: 0 }}>
          {editors.slice(0, 2).map((editor) => (
            <div
              key={editor.userId}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                backgroundColor: editor.color,
                border: `2px solid ${colors.surfaceRaised}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold, color: colors.white,
              }}
            >
              {editor.initials}
            </div>
          ))}
        </div>

        {/* Warning text */}
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: typography.fontSize.sm,
            color: colors.statusPending,
            fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily,
          }}>
            {displayName} {editors.length === 1 ? 'is' : 'are'} editing this {entityType}. Your changes may be overwritten.
          </span>
        </div>

        {/* Editing indicator */}
        <Pencil size={14} color={colors.statusPending} style={{ flexShrink: 0, animation: 'pulse 2s infinite' }} />
      </motion.div>
    </AnimatePresence>
  )
})
