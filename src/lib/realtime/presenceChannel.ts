// ── Presence channel ───────────────────────────────────────────────────────
// Per-entity (or per-list-page) presence room with heartbeat + multi-device
// dedup. The shape is intentionally agnostic of Supabase Realtime vs
// Liveblocks vs anything else — the impl wires to Supabase Realtime
// today; the public surface lets us swap providers without touching
// callers.
//
// Why this lives separate from the existing src/lib/realtime.ts:
//   • That file is the legacy presence helper used by PresenceAvatars.
//   • This one is the per-entity room machinery introduced in Tab A
//     (Live Collaboration). Long-term we unify; today they coexist.
//
// This module exports pure helpers (room key derivation, dedup logic,
// stale-cleanup math). The Supabase wiring lives in `presenceClient.ts`
// (a separate file the app instantiates once).

export interface PresenceMember {
  user_id: string
  user_name: string
  /** Stable per-tab id; multi-device dedup keys on (user_id, device_id). */
  device_id: string
  /** ms-precision timestamp of the most recent heartbeat. */
  last_seen_at: number
  /** Optional cursor coords. */
  cursor?: { x: number; y: number; field?: string }
  /** Optional avatar URL. */
  avatar_url?: string
}

export const ACTIVE_WINDOW_MS = 30_000  // 30s heartbeat window
export const HEARTBEAT_INTERVAL_MS = 10_000

/**
 * Derive a stable room key from an entity reference. Same code on every
 * client → every client subscribes to the same room.
 */
export function roomKeyFor(input: {
  type: 'entity' | 'list'
  entity_type: string
  entity_id?: string
  filter_hash?: string
}): string {
  if (input.type === 'list') {
    return `${input.entity_type}:list:${input.filter_hash ?? 'all'}`
  }
  if (!input.entity_id) {
    throw new Error('roomKeyFor("entity"): entity_id required')
  }
  return `${input.entity_type}:${input.entity_id}`
}

/**
 * Decide whether a heartbeat is fresh enough to count the member as
 * present. Uses a single window so all callers agree.
 */
export function isMemberActive(member: PresenceMember, now: number = Date.now()): boolean {
  return now - member.last_seen_at <= ACTIVE_WINDOW_MS
}

/**
 * Dedup multi-device presence. When the same user has multiple device_ids
 * all heartbeating, return only the most-recent one — this is the
 * "Mike (laptop) and Mike (phone) shows up once" behaviour.
 *
 * Returns the input array filtered + sorted by last_seen_at descending.
 */
export function dedupByUser(members: ReadonlyArray<PresenceMember>): PresenceMember[] {
  const byUser = new Map<string, PresenceMember>()
  for (const m of members) {
    const existing = byUser.get(m.user_id)
    if (!existing || m.last_seen_at > existing.last_seen_at) byUser.set(m.user_id, m)
  }
  return Array.from(byUser.values()).sort((a, b) => b.last_seen_at - a.last_seen_at)
}

/**
 * Merge a streaming heartbeat into a current member list. Returns a NEW
 * array; never mutates. Stale entries (older than ACTIVE_WINDOW_MS) are
 * dropped during the merge.
 */
export function mergeHeartbeat(
  existing: ReadonlyArray<PresenceMember>,
  beat: PresenceMember,
  now: number = Date.now(),
): PresenceMember[] {
  const fresh = existing.filter((m) => isMemberActive(m, now))
  const idx = fresh.findIndex((m) => m.user_id === beat.user_id && m.device_id === beat.device_id)
  if (idx >= 0) {
    const next = fresh.slice()
    next[idx] = beat
    return next
  }
  return [...fresh, beat]
}

/**
 * Per-tab device id, persisted in sessionStorage so the same tab keeps a
 * stable id across reloads. Survives the tab being inactive but not a new
 * tab/window.
 */
export function getOrCreateDeviceId(): string {
  if (typeof sessionStorage === 'undefined') return generateUuid()
  const KEY = 'sitesync_presence_device_id'
  const existing = sessionStorage.getItem(KEY)
  if (existing) return existing
  const next = generateUuid()
  try { sessionStorage.setItem(KEY, next) } catch { /* incognito mode */ }
  return next
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Decide whether the most-recent device for a user is "this device".
 * Used by LiveCursorOverlay so we render only ONE cursor per user even
 * when they have multiple devices online.
 */
export function isMostRecentDeviceForUser(
  members: ReadonlyArray<PresenceMember>,
  user_id: string,
  device_id: string,
): boolean {
  const userMembers = members.filter((m) => m.user_id === user_id)
  if (userMembers.length === 0) return false
  const mostRecent = userMembers.reduce((a, b) => (a.last_seen_at > b.last_seen_at ? a : b))
  return mostRecent.device_id === device_id
}
