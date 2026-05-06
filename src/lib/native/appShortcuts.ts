// ── appShortcuts ───────────────────────────────────────────────────────────
// Long-press iOS icon / Android home-screen → quick action. We define
// three: New RFI, Capture photo, Open today's daily log. Each routes
// to a `sitesync://` deep link so the existing push handler reuses the
// same nav logic.
//
// Capacitor's @capacitor/app plugin exposes the `appUrlOpen` event for
// the URL scheme. The actual shortcut declaration lives in the platform
// config files (Info.plist for iOS, shortcuts.xml for Android) — those
// are checked into `public/` and `ios/`/`android/` directories. This
// module just exposes the canonical link list for both runtime use and
// docs generation.

import { deepLinkForEntity } from './deepLink'

export interface AppShortcut {
  id: string
  title: string
  subtitle: string
  /** sitesync:// URL the OS opens on tap. */
  url: string
  /** SF Symbol / Android material icon name suggestion for the platform
   *  config; not consumed at runtime. */
  icon: string
}

export const APP_SHORTCUTS: ReadonlyArray<AppShortcut> = [
  {
    id: 'new_rfi',
    title: 'New RFI',
    subtitle: 'Draft an RFI immediately',
    url: 'sitesync://capture?intent=rfi',
    icon: 'questionmark.circle',
  },
  {
    id: 'capture_photo',
    title: 'Capture photo',
    subtitle: 'Open the field-capture sheet',
    url: 'sitesync://capture',
    icon: 'camera',
  },
  {
    id: 'todays_log',
    title: "Today's daily log",
    subtitle: 'Jump to today\'s log',
    url: `sitesync://daily-log?date=${todayIso()}`,
    icon: 'doc.plaintext',
  },
]

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Build an entity-specific shortcut from a deep-link target. Used by
 *  the dynamic shortcut list (e.g. "Resume RFI #047") on Android. */
export function shortcutForEntity(input: { type: string; id: string; title: string }): AppShortcut {
  return {
    id: `entity:${input.type}:${input.id}`,
    title: input.title,
    subtitle: `Resume ${input.type.toUpperCase()}`,
    url: deepLinkForEntity({ type: input.type, id: input.id }),
    icon: 'arrow.uturn.right',
  }
}
