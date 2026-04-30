// ─────────────────────────────────────────────────────────────────────────────
// Stream Store — Snooze + Dismiss state
// ─────────────────────────────────────────────────────────────────────────────
// Tab A (Stream Data Layer). Persistence rules from PRODUCT-DIRECTION.md:
//
//   • Snooze   → localStorage `stream:snoozed:{userId}` → { id: ISO datetime }
//                Auto-prune entries past their resurface time on read.
//   • Dismiss  → in-memory only (Zustand session); cleared on reload.
//   • Resolve  → NOT here. Mutates the source record via existing mutation
//                hooks; React Query invalidation removes the item.
//
// Snooze options exposed to UI: '1h' | 'tomorrow' (8am local) | 'next_week'
// (next Monday 8am local).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type { SnoozeDuration } from '../types/stream'

const SNOOZE_KEY_PREFIX = 'stream:snoozed:'
const DEFAULT_USER_KEY = 'anon'

let activeUserKey = DEFAULT_USER_KEY

interface StreamStore {
  dismissedIds: Set<string>
  snoozedItems: Map<string, string>          // id → ISO datetime to resurface
  setUserKey: (userId: string | null | undefined) => void
  dismiss: (id: string) => void
  undismiss: (id: string) => void
  snooze: (id: string, duration: SnoozeDuration) => void
  unsnooze: (id: string) => void
  isDismissed: (id: string) => boolean
  isSnoozed: (id: string) => boolean
  clear: () => void
}

function snoozeKey(userKey: string): string {
  return `${SNOOZE_KEY_PREFIX}${userKey}`
}

function readSnoozedFromStorage(userKey: string): Map<string, string> {
  if (typeof localStorage === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(snoozeKey(userKey))
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, string>
    const now = Date.now()
    const entries: [string, string][] = []
    for (const [id, iso] of Object.entries(parsed)) {
      const t = Date.parse(iso)
      if (Number.isFinite(t) && t > now) entries.push([id, iso])
    }
    return new Map(entries)
  } catch {
    return new Map()
  }
}

function writeSnoozedToStorage(userKey: string, map: Map<string, string>): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (map.size === 0) {
      localStorage.removeItem(snoozeKey(userKey))
      return
    }
    const obj: Record<string, string> = {}
    for (const [id, iso] of map.entries()) obj[id] = iso
    localStorage.setItem(snoozeKey(userKey), JSON.stringify(obj))
  } catch {
    // Quota or privacy mode — best-effort, drop silently.
  }
}

function resolveSnoozeUntil(duration: SnoozeDuration, from: Date = new Date()): string {
  const target = new Date(from)
  switch (duration) {
    case '1h':
      target.setTime(from.getTime() + 60 * 60 * 1000)
      return target.toISOString()
    case 'tomorrow': {
      target.setDate(from.getDate() + 1)
      target.setHours(8, 0, 0, 0)
      return target.toISOString()
    }
    case 'next_week': {
      // Next Monday 8am local. If today is Monday, jump 7 days.
      const day = from.getDay() // 0=Sun … 1=Mon
      const daysUntilMonday = ((1 - day + 7) % 7) || 7
      target.setDate(from.getDate() + daysUntilMonday)
      target.setHours(8, 0, 0, 0)
      return target.toISOString()
    }
  }
}

function pruneSnoozed(map: Map<string, string>): { map: Map<string, string>; changed: boolean } {
  const now = Date.now()
  let changed = false
  const next = new Map<string, string>()
  for (const [id, iso] of map.entries()) {
    const t = Date.parse(iso)
    if (Number.isFinite(t) && t > now) next.set(id, iso)
    else changed = true
  }
  return { map: next, changed }
}

export const useStreamStore = create<StreamStore>((set, get) => ({
  dismissedIds: new Set<string>(),
  snoozedItems: readSnoozedFromStorage(DEFAULT_USER_KEY),

  setUserKey: (userId) => {
    const next = userId ?? DEFAULT_USER_KEY
    if (next === activeUserKey) return
    activeUserKey = next
    set({ snoozedItems: readSnoozedFromStorage(next) })
  },

  dismiss: (id) => {
    set((s) => {
      const dismissed = new Set(s.dismissedIds)
      dismissed.add(id)
      return { dismissedIds: dismissed }
    })
  },

  undismiss: (id) => {
    set((s) => {
      if (!s.dismissedIds.has(id)) return s
      const dismissed = new Set(s.dismissedIds)
      dismissed.delete(id)
      return { dismissedIds: dismissed }
    })
  },

  snooze: (id, duration) => {
    const until = resolveSnoozeUntil(duration)
    set((s) => {
      const next = new Map(s.snoozedItems)
      next.set(id, until)
      writeSnoozedToStorage(activeUserKey, next)
      return { snoozedItems: next }
    })
  },

  unsnooze: (id) => {
    set((s) => {
      if (!s.snoozedItems.has(id)) return s
      const next = new Map(s.snoozedItems)
      next.delete(id)
      writeSnoozedToStorage(activeUserKey, next)
      return { snoozedItems: next }
    })
  },

  isDismissed: (id) => get().dismissedIds.has(id),

  isSnoozed: (id) => {
    const until = get().snoozedItems.get(id)
    if (!until) return false
    const t = Date.parse(until)
    if (!Number.isFinite(t)) return false
    if (t <= Date.now()) {
      // Lazy prune: drop the stale entry on read.
      const { map, changed } = pruneSnoozed(get().snoozedItems)
      if (changed) {
        writeSnoozedToStorage(activeUserKey, map)
        set({ snoozedItems: map })
      }
      return false
    }
    return true
  },

  clear: () => {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(snoozeKey(activeUserKey)) } catch { /* noop */ }
    }
    set({ dismissedIds: new Set(), snoozedItems: new Map() })
  },
}))

// Internal helpers exported for tests only.
export const __test__ = { resolveSnoozeUntil, pruneSnoozed, snoozeKey }
