import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, borderRadius, transitions } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { useProjectId } from '../../hooks/useProjectId'
import { useAuth } from '../../hooks/useAuth'

// ── Realtime Flash ──────────────────────────────────────
// Wraps list items to show visual feedback when realtime changes occur.
// - INSERT: slide in with subtle green glow (1s)
// - UPDATE: yellow flash (0.5s) on changed fields
// - DELETE: red fade out (0.3s)

type FlashType = 'insert' | 'update' | 'delete' | null

interface RealtimeFlashProps {
  /** The entity ID to monitor */
  entityId: string
  /** The table name to watch */
  table: string
  children: React.ReactNode
}

export const RealtimeFlash: React.FC<RealtimeFlashProps> = React.memo(({ entityId, table, children }) => {
  const [flash, setFlash] = useState<FlashType>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const projectId = useProjectId()
  const { user } = useAuth()

  useEffect(() => {
    if (!projectId) return

    const channel = supabase
      .channel(`flash_${table}_${entityId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `id=eq.${entityId}`,
      }, (payload) => {
        // Skip changes made by current user
        const record = (payload.new || payload.old) as Record<string, unknown> | null
        const changedBy = record?.created_by || record?.submitted_by || record?.updated_by
        if (changedBy === user?.id) return

        const type = payload.eventType === 'INSERT' ? 'insert'
          : payload.eventType === 'UPDATE' ? 'update'
          : payload.eventType === 'DELETE' ? 'delete'
          : null

        if (type) {
          setFlash(type)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setFlash(null), type === 'insert' ? 1000 : type === 'update' ? 500 : 300)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [entityId, table, projectId, user?.id])

  const flashStyles: Record<string, React.CSSProperties> = {
    insert: {
      boxShadow: `inset 0 0 0 1px ${colors.statusActive}40, 0 0 8px ${colors.statusActive}20`,
      backgroundColor: colors.statusActiveSubtle,
    },
    update: {
      boxShadow: `inset 0 0 0 1px ${colors.statusPending}40`,
      backgroundColor: colors.statusPendingSubtle,
    },
    delete: {
      opacity: 0.4,
      backgroundColor: colors.statusCriticalSubtle,
    },
  }

  return (
    <div style={{
      position: 'relative',
      transition: `all ${flash === 'delete' ? '0.3s' : '0.2s'} ease-out`,
      borderRadius: borderRadius.sm,
      ...(flash ? flashStyles[flash] : {}),
    }}>
      {children}
    </div>
  )
})

// ── useRealtimeFlash (lightweight alternative) ──────────
// Hook version for when you don't want wrapper divs.
// Returns flash state that you can use to apply styles.

export function useRealtimeFlash(table: string, entityId: string): FlashType {
  const [flash, setFlash] = useState<FlashType>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const projectId = useProjectId()
  const { user } = useAuth()

  useEffect(() => {
    if (!projectId || !entityId) return

    const channel = supabase
      .channel(`flash_hook_${table}_${entityId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `id=eq.${entityId}`,
      }, (payload) => {
        const record = (payload.new || payload.old) as Record<string, unknown> | null
        const changedBy = record?.created_by || record?.submitted_by || record?.updated_by
        if (changedBy === user?.id) return

        const type = payload.eventType === 'INSERT' ? 'insert' as const
          : payload.eventType === 'UPDATE' ? 'update' as const
          : payload.eventType === 'DELETE' ? 'delete' as const
          : null

        if (type) {
          setFlash(type)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setFlash(null), type === 'insert' ? 1000 : type === 'update' ? 500 : 300)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [entityId, table, projectId, user?.id])

  return flash
}

// ── MetricFlash ─────────────────────────────────────────
// Wraps a metric card and pulses an orange ring when realtime data refreshes.
// Driven by the isFlashing flag returned from useBudgetRealtime.

interface MetricFlashProps {
  isFlashing: boolean
  children: React.ReactNode
}

export const MetricFlash: React.FC<MetricFlashProps> = ({ isFlashing, children }) => (
  <div
    aria-live="polite"
    style={{
      borderRadius: borderRadius.md,
      transition: 'box-shadow 0.35s ease-out',
      boxShadow: isFlashing
        ? `0 0 0 2px ${'#F47820'}66, 0 0 10px ${'#F47820'}22`
        : 'none',
    }}
  >
    {children}
  </div>
)

// ── Animated List Item ──────────────────────────────────
// Wrapper for list items that animates insert/delete.

export const AnimatedListItem: React.FC<{
  children: React.ReactNode
  itemKey: string
}> = ({ children, itemKey }) => (
  <motion.div
    key={itemKey}
    initial={{ opacity: 0, height: 0, y: -8 }}
    animate={{ opacity: 1, height: 'auto', y: 0 }}
    exit={{ opacity: 0, height: 0, x: 20 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    layout
  >
    {children}
  </motion.div>
)
