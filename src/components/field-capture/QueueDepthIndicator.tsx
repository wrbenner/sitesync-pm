/**
 * QueueDepthIndicator — topbar pill showing how many captures are pending sync.
 *
 * Polls the durableQueue every 5s. Tap → opens an inspection sheet (callback
 * provided by the parent). The parent owns navigation; this component
 * only shows the count + status.
 *
 * The pill colors:
 *   • depth = 0 (and online)  → no pill rendered
 *   • depth > 0 (online)      → gray "Syncing N"
 *   • depth > 0 (offline)     → orange dot + "N queued · offline"
 *   • any item failed_permanent → rust + "N pending review"
 */

import React, { useEffect, useState } from 'react'
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { colors, typography } from '../../styles/theme'
import { OrangeDot } from '../atoms'
import { listAll, type QueueItem } from '../../lib/fieldCapture/durableQueue'

interface QueueDepthIndicatorProps {
  online?: boolean
  /** ms between polls. Default 5000. */
  pollMs?: number
  onTap?: () => void
}

export const QueueDepthIndicator: React.FC<QueueDepthIndicatorProps> = ({
  online = true,
  pollMs = 5000,
  onTap,
}) => {
  const [items, setItems] = useState<QueueItem[]>([])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const all = await listAll()
        if (!cancelled) setItems(all)
      } catch { /* IDB unavailable — treat as no queue */ }
    }
    void tick()
    const id = window.setInterval(() => void tick(), pollMs)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [pollMs])

  const depth = items.filter(i => i.status === 'queued' || i.status === 'syncing').length
  const failedCount = items.filter(i => i.status === 'failed_permanent').length

  if (depth === 0 && failedCount === 0) return null

  let label: React.ReactNode
  let icon: React.ReactNode
  let tone: 'neutral' | 'orange' | 'rust' = 'neutral'

  if (failedCount > 0) {
    tone = 'rust'
    icon = <AlertTriangle size={12} />
    label = `${failedCount} pending review`
  } else if (!online) {
    tone = 'orange'
    icon = <CloudOff size={12} />
    label = `${depth} queued · offline`
  } else {
    icon = <RefreshCw size={12} className="ss-rotating" />
    label = `Syncing ${depth}`
  }

  const fg = tone === 'rust'
    ? colors.statusCritical
    : tone === 'orange'
      ? colors.primaryOrange
      : colors.ink2
  const bg = tone === 'rust'
    ? `${colors.statusCritical}10`
    : tone === 'orange'
      ? 'var(--color-primary-subtle)'
      : 'var(--color-surfaceRaised, #FFFFFF)'

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={typeof label === 'string' ? label : 'Queue status'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        backgroundColor: bg,
        border: `1px solid ${tone === 'neutral' ? 'var(--hairline)' : 'transparent'}`,
        borderRadius: 999,
        fontFamily: typography.fontFamily,
        fontSize: 11,
        fontWeight: typography.fontWeight.medium,
        color: fg,
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <style>{`@keyframes ss-rotate { to { transform: rotate(360deg); } }
      .ss-rotating { animation: ss-rotate 1.6s linear infinite; }`}</style>
      {tone === 'orange' && <OrangeDot size={6} haloSpread={2} />}
      {icon}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</span>
    </button>
  )
}
