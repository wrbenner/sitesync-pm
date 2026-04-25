// SiteSync PM — Haptic Feedback Hook
// Wraps Capacitor Haptics with platform detection. No-op on web.
// Light: toggles, checkboxes, selection. Medium: button press, confirmations. Heavy: delete, errors.

import { useCallback, useMemo } from 'react'

type ImpactStyle = 'light' | 'medium' | 'heavy'

interface HapticsAPI {
  /** Light haptic: toggles, checkboxes, selection change */
  light: () => void
  /** Medium haptic: button press, action confirmation */
  medium: () => void
  /** Heavy haptic: delete confirmation, error state */
  heavy: () => void
  /** Generic impact with explicit style */
  impact: (style: ImpactStyle) => void
  /** Selection change tick */
  selection: () => void
  /** Notification feedback */
  notification: (type: 'success' | 'warning' | 'error') => void
}

// Lazy-load the Capacitor Haptics plugin only on native platforms
let hapticsPlugin: {
  impact: (opts: { style: string }) => Promise<void>
  selectionStart: () => Promise<void>
  selectionChanged: () => Promise<void>
  selectionEnd: () => Promise<void>
  notification: (opts: { type: string }) => Promise<void>
} | null = null

let hapticsChecked = false

async function getHaptics() {
  if (hapticsChecked) return hapticsPlugin
  hapticsChecked = true

  try {
    // Only import on Capacitor native runtime (iOS/Android)
    const isNative =
      typeof (window as Record<string, unknown>).Capacitor !== 'undefined' &&
      (window as Record<string, unknown>).Capacitor !== null

    if (!isNative) return null

    const mod = await import('@capacitor/haptics')
    hapticsPlugin = mod.Haptics
    return hapticsPlugin
  } catch {
    // @capacitor/haptics not available (web build)
    return null
  }
}

// Fire-and-forget haptic calls
function fireImpact(style: ImpactStyle) {
  getHaptics().then((h) => {
    const styleMap: Record<ImpactStyle, string> = {
      light: 'Light',
      medium: 'Medium',
      heavy: 'Heavy',
    }
    h?.impact({ style: styleMap[style] })
  })
}

function fireSelection() {
  getHaptics().then((h) => {
    h?.selectionChanged()
  })
}

function fireNotification(type: 'success' | 'warning' | 'error') {
  getHaptics().then((h) => {
    const typeMap: Record<string, string> = {
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
    }
    h?.notification({ type: typeMap[type] })
  })
}

export function useHaptics(): HapticsAPI {
  const light = useCallback(() => fireImpact('light'), [])
  const medium = useCallback(() => fireImpact('medium'), [])
  const heavy = useCallback(() => fireImpact('heavy'), [])
  const impact = useCallback((style: ImpactStyle) => fireImpact(style), [])
  const selection = useCallback(() => fireSelection(), [])
  const notification = useCallback(
    (type: 'success' | 'warning' | 'error') => fireNotification(type),
    [],
  )

  return useMemo(
    () => ({ light, medium, heavy, impact, selection, notification }),
    [light, medium, heavy, impact, selection, notification],
  )
}
