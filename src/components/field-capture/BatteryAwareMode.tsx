/**
 * BatteryAwareMode — adapts capture behavior + UI on low battery.
 *
 * The hook reads navigator.getBattery() (where available; Safari doesn't ship
 * it) and emits:
 *   • level [0..1] — fractional battery
 *   • mode 'normal' | 'conserve' — flips at <20%
 *   • a recommended { photoMaxDimension, deferNonCritical } config
 *
 * The banner component renders an orange-channel notice when in 'conserve'
 * mode. Parent capture flows can read useBatteryMode() to lower photo res
 * before encoding.
 */

import React, { useEffect, useState } from 'react'
import { BatteryLow } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { OrangeDot } from '../atoms'

export interface BatteryStatus {
  level: number | null
  charging: boolean
  /** Available means navigator.getBattery worked. */
  available: boolean
}

export interface BatteryConfig {
  /** Max photo dimension in px when conserving. Normal capture uses native res. */
  photoMaxDimension: number
  /** Defer non-critical syncs (already-uploaded duplicates, vision verifies). */
  deferNonCritical: boolean
}

const NORMAL_CONFIG: BatteryConfig = { photoMaxDimension: 4096, deferNonCritical: false }
const CONSERVE_CONFIG: BatteryConfig = { photoMaxDimension: 1920, deferNonCritical: true }
const CONSERVE_THRESHOLD = 0.2

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<{
    level: number
    charging: boolean
    addEventListener: (e: string, fn: () => void) => void
    removeEventListener: (e: string, fn: () => void) => void
  }>
}

export function useBatteryMode(): {
  status: BatteryStatus
  mode: 'normal' | 'conserve'
  config: BatteryConfig
} {
  const [status, setStatus] = useState<BatteryStatus>({ level: null, charging: false, available: false })

  useEffect(() => {
    let cancelled = false
    const nav = navigator as NavigatorWithBattery
    if (!nav.getBattery) {
      // Safari et al. — never enter conserve mode automatically.
      return
    }
    void nav.getBattery().then(b => {
      if (cancelled) return
      const update = () => setStatus({ level: b.level, charging: b.charging, available: true })
      update()
      b.addEventListener('levelchange', update)
      b.addEventListener('chargingchange', update)
    })
    return () => { cancelled = true }
  }, [])

  const conserve = status.available && status.level != null
    && !status.charging && status.level < CONSERVE_THRESHOLD
  return {
    status,
    mode: conserve ? 'conserve' : 'normal',
    config: conserve ? CONSERVE_CONFIG : NORMAL_CONFIG,
  }
}

export const BatteryAwareBanner: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const { status, mode } = useBatteryMode()
  const [dismissed, setDismissed] = useState(false)
  if (mode !== 'conserve' || dismissed) return null

  const pct = status.level != null ? Math.round(status.level * 100) : 0

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`,
        backgroundColor: 'var(--color-primary-subtle)',
        border: '1px solid var(--color-primary-light)',
        borderRadius: 8,
        fontFamily: typography.fontFamily,
        fontSize: 13,
        color: colors.ink,
        marginBottom: spacing['3'],
      }}
    >
      <OrangeDot size={6} haloSpread={2} label={`Battery ${pct}%`} />
      <BatteryLow size={14} style={{ color: colors.primaryOrange, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        Low battery ({pct}%) — saving for the field. Photos compressed; non-essential syncs paused.
      </span>
      <button
        type="button"
        onClick={() => { setDismissed(true); onDismiss?.() }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: colors.ink3, fontSize: 12, padding: 4,
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
