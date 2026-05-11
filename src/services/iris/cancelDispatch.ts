// ────────────────────────────────────────────────────────────────────────────
// cancelDispatch — fan-out across the 5 cancel surfaces
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md (§ "Five surfaces")
//
// When an executor enters the 60s window, the user must be reachable through
// AT LEAST ONE of:
//   1. In-app banner (CancelWindowBanner)
//   2. Push notification (iOS Live Activity / Android countdown)
//   3. Email
//   4. SMS
//   5. Desktop notification
//
// Each surface is pluggable so the runtime (browser, edge fn, e2e test) can
// inject its own delivery function. The dispatch returns a Promise.all over
// the surfaces and records which ones fired.

export type CancelSurfaceName =
  | 'in_app_banner'
  | 'push_notification'
  | 'email'
  | 'sms'
  | 'desktop_notification'

export interface CancelDispatchPayload {
  executor_run_id: string
  executor_name: string
  action_label: string
  user_id: string
  decided_at: string
  cancel_deadline_at: string
}

export type CancelSurfaceFn = (payload: CancelDispatchPayload) => Promise<{
  surface: CancelSurfaceName
  delivered: boolean
  error?: string
}>

export interface CancelDispatchConfig {
  in_app_banner?: CancelSurfaceFn
  push_notification?: CancelSurfaceFn
  email?: CancelSurfaceFn
  sms?: CancelSurfaceFn
  desktop_notification?: CancelSurfaceFn
}

export interface DispatchOutcome {
  delivered: readonly CancelSurfaceName[]
  failed: readonly { surface: CancelSurfaceName; error: string }[]
}

const ALL_SURFACES: readonly CancelSurfaceName[] = [
  'in_app_banner',
  'push_notification',
  'email',
  'sms',
  'desktop_notification',
] as const

export async function dispatchCancelWindow(
  payload: CancelDispatchPayload,
  config: CancelDispatchConfig,
): Promise<DispatchOutcome> {
  const surfaces: Array<{ name: CancelSurfaceName; fn: CancelSurfaceFn | undefined }> = [
    { name: 'in_app_banner', fn: config.in_app_banner },
    { name: 'push_notification', fn: config.push_notification },
    { name: 'email', fn: config.email },
    { name: 'sms', fn: config.sms },
    { name: 'desktop_notification', fn: config.desktop_notification },
  ]
  const results = await Promise.all(
    surfaces
      .filter((s): s is { name: CancelSurfaceName; fn: CancelSurfaceFn } => s.fn != null)
      .map(async (s) => {
        try {
          return await s.fn(payload)
        } catch (err) {
          return {
            surface: s.name,
            delivered: false,
            error: (err as Error).message,
          }
        }
      }),
  )
  const delivered: CancelSurfaceName[] = []
  const failed: { surface: CancelSurfaceName; error: string }[] = []
  for (const r of results) {
    if (r.delivered) {
      delivered.push(r.surface)
    } else {
      failed.push({ surface: r.surface, error: r.error ?? 'unknown' })
    }
  }
  return { delivered, failed }
}

export function listAllSurfaces(): readonly CancelSurfaceName[] {
  return ALL_SURFACES
}
