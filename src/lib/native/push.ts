// ── push ──────────────────────────────────────────────────────────────────
// Capacitor Push Notifications wrapper. Three responsibilities:
//   1. Request permission + register the device, surface the FCM/APNs token
//      to the platform so it can store it on `user_devices`.
//   2. Subscribe to `pushNotificationReceived` (foreground) and
//      `pushNotificationActionPerformed` (background tap).
//   3. Translate the payload's `deep_link` field into an SPA route via
//      parseDeepLink + the caller's navigate fn.
//
// Like haptics + share, we dynamically import @capacitor/push-notifications
// so the SPA loads even when the plugin isn't available.

import { parseDeepLink, type ParsedDeepLink } from './deepLink'

export interface PushHandlerOptions {
  /** SPA navigate function (history.push or React Router's navigate). */
  navigate: (route: { path: string; query?: Record<string, string> }) => void
  /** Persist the device push token to user_devices. */
  registerToken: (token: string, platform: 'ios' | 'android') => Promise<void>
  /** Optional foreground toast hook. */
  onForeground?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
}

export interface PushSetupResult {
  ok: boolean
  available: boolean
  token?: string
  error?: string
}

export async function setupPush(opts: PushHandlerOptions): Promise<PushSetupResult> {
  let isNative = false
  let platform: 'ios' | 'android' = 'ios'
  try {
    const { Capacitor } = await import('@capacitor/core')
    isNative = Capacitor.isNativePlatform()
    platform = (Capacitor.getPlatform() as 'ios' | 'android')
  } catch {
    return { ok: true, available: false }
  }
  if (!isNative) return { ok: true, available: false }

  const mod = await import('@capacitor/push-notifications').catch(() => null) as any
  if (!mod?.PushNotifications) return { ok: true, available: false, error: 'plugin missing' }
  const PN = mod.PushNotifications

  try {
    const perm = await PN.checkPermissions()
    let granted = perm.receive === 'granted'
    if (!granted) {
      const r = await PN.requestPermissions()
      granted = r.receive === 'granted'
    }
    if (!granted) {
      return { ok: false, available: true, error: 'permission_denied' }
    }

    let token: string | undefined
    PN.addListener('registration', async (t: { value: string }) => {
      token = t.value
      try { await opts.registerToken(t.value, platform) } catch { /* best-effort */ }
    })
    PN.addListener('registrationError', (_err: unknown) => { /* surface via opts.onForeground */ })

    PN.addListener('pushNotificationReceived', (n: { title?: string; body?: string; data?: Record<string, unknown> }) => {
      opts.onForeground?.(n)
    })

    PN.addListener('pushNotificationActionPerformed', (action: { notification: { data?: Record<string, unknown> } }) => {
      const dl = (action?.notification?.data?.deep_link as string | undefined) ?? null
      if (!dl) return
      const parsed = parseDeepLink(dl)
      if (parsed && parsed.spaPath) {
        opts.navigate({ path: parsed.spaPath, query: parsed.query })
      }
    })

    await PN.register()
    return { ok: true, available: true, token }
  } catch (err) {
    return { ok: false, available: true, error: (err as Error).message }
  }
}

/** Apply a deep-link to the SPA after auth. Used during the
 *  "user clicked notification while logged out" path. */
export function applyPendingDeepLink(
  pending: ParsedDeepLink | null,
  navigate: PushHandlerOptions['navigate'],
): void {
  if (!pending || !pending.spaPath) return
  navigate({ path: pending.spaPath, query: pending.query })
}
