// ── haptics ────────────────────────────────────────────────────────────────
// Thin Capacitor Haptics wrapper. Platform detection uses the existing
// Capacitor SPI: `Capacitor.isNativePlatform()`. Web platforms no-op.
//
// Three semantic patterns:
//   • success — short bump on save / approve
//   • warning — double bump on near-miss / overdue
//   • error   — heavy bump on validation failure
//
// We use the LIGHT impact for taps (HapticButton) and the named
// notification API for state changes (success/warning/error).

let _supported: boolean | null = null
let _haptics: any | null = null

async function getHaptics() {
  if (_supported !== null) return { supported: _supported, haptics: _haptics }
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const mod = await import('@capacitor/haptics')
      _haptics = mod.Haptics
      _supported = true
    } else {
      _supported = false
    }
  } catch {
    _supported = false
  }
  return { supported: _supported, haptics: _haptics }
}

export type HapticPattern = 'success' | 'warning' | 'error' | 'tap'

/** Fire a haptic. No-op on web. Never throws. */
export async function fireHaptic(pattern: HapticPattern): Promise<void> {
  try {
    const { supported, haptics } = await getHaptics()
    if (!supported || !haptics) return
    if (pattern === 'tap') {
      await haptics.impact({ style: 'LIGHT' })
      return
    }
    const mapped =
      pattern === 'success' ? 'SUCCESS'
      : pattern === 'warning' ? 'WARNING'
      : 'ERROR'
    await haptics.notification({ type: mapped })
  } catch {
    // best-effort
  }
}

/** Detect whether haptics will fire on this platform. The UI can use
 *  this to adjust micro-interactions (e.g. only shake on web, not on
 *  native where the haptic carries the signal). */
export async function isNativeHaptics(): Promise<boolean> {
  const { supported } = await getHaptics()
  return supported === true
}

/** Test-only: reset the cached platform detection so tests can
 *  re-exercise both paths. Production code never calls this. */
export function _resetForTest(): void {
  _supported = null
  _haptics = null
}
