import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {  WifiOff, RefreshCw, Clock, ChevronDown, Cloud } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme'
import { useOfflineStatus } from '../../hooks/useOfflineStatus'
import { supabase } from '../../lib/supabase'

// ── Connection Status Types ─────────────────────────────

type ConnectionState = 'connected' | 'reconnecting' | 'offline'

function useConnectionState(): ConnectionState {
  const { isOnline } = useOfflineStatus()
  const [realtimeConnected, setRealtimeConnected] = useState(true)

  useEffect(() => {
    // Monitor Supabase realtime connection state
    const checkConnection = () => {
      const channels = supabase.getChannels()
      const hasActive = channels.some(ch => ch.state === 'joined')
      const hasPending = channels.some(ch => ch.state === 'joining')

      if (!isOnline) {
        setRealtimeConnected(false)
      } else if (hasActive) {
        setRealtimeConnected(true)
      } else if (hasPending) {
        setRealtimeConnected(false)
      }
    }

    checkConnection()
    const interval = setInterval(checkConnection, 3000)
    return () => clearInterval(interval)
  }, [isOnline])

  if (!isOnline) return 'offline'
  if (!realtimeConnected) return 'reconnecting'
  return 'connected'
}

// ── Connection Status Dot (for TopBar) ──────────────────

export const ConnectionStatusDot: React.FC = React.memo(() => {
  const state = useConnectionState()
  const { pendingChanges, lastSynced, sync } = useOfflineStatus()
  const [expanded, setExpanded] = useState(false)

  const dotConfig: Record<ConnectionState, { color: string; label: string; pulse: boolean }> = {
    connected: { color: colors.statusActive, label: 'Connected', pulse: false },
    reconnecting: { color: colors.statusPending, label: 'Reconnecting...', pulse: true },
    offline: { color: colors.statusCritical, label: 'Offline', pulse: true },
  }

  const config = dotConfig[state]

  const formatTime = useCallback((date: Date | null) => {
    if (!date) return 'Never'
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1.5'],
          padding: `${spacing['1']} ${spacing['2']}`,
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          transition: `background-color ${transitions.instant}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        aria-label={`Connection status: ${config.label}`}
        aria-expanded={expanded}
      >
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: config.color,
            ...(config.pulse ? { animation: 'pulse 2s infinite' } : {}),
          }} />
        </div>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          fontWeight: typography.fontWeight.medium,
          fontFamily: typography.fontFamily,
        }}>
          {config.label}
        </span>
        {pendingChanges > 0 && (
          <span style={{
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            backgroundColor: colors.statusPendingSubtle,
            color: colors.statusPending,
            padding: `${spacing['px']} ${spacing['1']}`,
            borderRadius: borderRadius.full,
          }}>
            {pendingChanges}
          </span>
        )}
        <ChevronDown
          size={12}
          color={colors.textTertiary}
          style={{
            transition: `transform ${transitions.instant}`,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: spacing['1'],
              width: 260,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.dropdown,
              padding: spacing['3'],
              zIndex: zIndex.dropdown as number,
              fontFamily: typography.fontFamily,
            }}
          >
            {/* Status row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
              {state === 'connected' ? <Cloud size={16} color={colors.statusActive} /> :
               state === 'reconnecting' ? <RefreshCw size={16} color={colors.statusPending} style={{ animation: 'spin 1s linear infinite' }} /> :
               <WifiOff size={16} color={colors.statusCritical} />}
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {config.label}
              </span>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: config.color, marginLeft: 'auto',
                ...(config.pulse ? { animation: 'pulse 2s infinite' } : {}),
              }} />
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              <DetailRow icon={<Clock size={12} />} label="Last synced" value={formatTime(lastSynced)} />
              <DetailRow
                icon={<RefreshCw size={12} />}
                label="Pending changes"
                value={String(pendingChanges)}
                highlight={pendingChanges > 0}
              />
            </div>

            {/* Sync button */}
            {pendingChanges > 0 && state !== 'offline' && (
              <button
                onClick={() => sync()}
                style={{
                  width: '100%',
                  marginTop: spacing['3'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  fontWeight: typography.fontWeight.medium,
                  backgroundColor: colors.primaryOrange,
                  color: colors.white,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing['2'],
                }}
              >
                <RefreshCw size={14} />
                Sync Now
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// ── Detail Row (internal) ───────────────────────────────

const DetailRow: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}> = ({ icon, label, value, highlight }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing['1']} 0`,
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      color: colors.textTertiary,
      fontSize: typography.fontSize.caption,
    }}>
      {icon}
      <span>{label}</span>
    </div>
    <span style={{
      fontSize: typography.fontSize.caption,
      fontWeight: typography.fontWeight.medium,
      color: highlight ? colors.statusPending : colors.textSecondary,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </span>
  </div>
)
