// ── Live cursor utilities ──────────────────────────────────────────────────
// Pure helpers for rendering remote-user cursors over a shared editor.
// Coordinate space:
//   • Cursor positions are emitted as normalized 0..1 coords against the
//     editor's bounding rect. This survives window resize across clients
//     because every receiver multiplies by their own rect on render.
//   • For text fields, an additional `field` key + `caret` index lets
//     callers render a caret in the right field.

export interface CursorState {
  /** 0..1 horizontal position relative to the room's surface. */
  x: number
  /** 0..1 vertical. */
  y: number
  /** Stable identifier of the field the cursor belongs to (e.g. 'description'). */
  field?: string
  /** For text fields: caret index (UTF-16 code units, NOT bytes). */
  caret?: number
  /** True when the user has a selection rather than a single caret. */
  has_selection?: boolean
  /** Color hint for the remote cursor render. Stable per (user_id, room). */
  color?: string
}

/** Normalize a (clientX, clientY) point to 0..1 within `rect`. */
export function normalizePoint(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height
  return { x: clamp01(x), y: clamp01(y) }
}

/** Convert a 0..1 cursor back to pixels for rendering. */
export function denormalizePoint(
  cursor: { x: number; y: number },
  rect: { width: number; height: number },
): { x: number; y: number } {
  return { x: cursor.x * rect.width, y: cursor.y * rect.height }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

/**
 * Stable color for a user within a room. The color picks from a small
 * palette indexed by a hash of (user_id, room_key) so two users in the
 * same room never collide on color, and the same user gets the same
 * color across reloads.
 */
export const CURSOR_PALETTE = [
  '#F47820', // primary orange
  '#3A7BC8', // blue
  '#5DA86F', // green
  '#7C5DC7', // purple
  '#C75D7C', // rose
  '#D2A93A', // amber
  '#3AB8C8', // teal
  '#C84444', // red
] as const

export function colorForUser(userId: string, roomKey: string): string {
  const seed = `${userId}:${roomKey}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return CURSOR_PALETTE[hash % CURSOR_PALETTE.length]
}

/**
 * Throttle helper: returns a wrapped fn that fires at most once per
 * `window_ms`. Cursor updates emit ~30fps locally; this reduces the
 * cross-client traffic to ~10fps which is still smooth.
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  window_ms: number,
): T {
  let last = 0
  let pending: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  const wrapped = (...args: any[]) => {
    const now = Date.now()
    const since = now - last
    if (since >= window_ms) {
      last = now
      fn(...(args as Parameters<T>))
      lastArgs = null
      return
    }
    lastArgs = args
    if (!pending) {
      pending = setTimeout(() => {
        pending = null
        last = Date.now()
        if (lastArgs) {
          fn(...(lastArgs as Parameters<T>))
          lastArgs = null
        }
      }, window_ms - since)
    }
  }
  return wrapped as T
}

/**
 * Decide whether a cursor update is "meaningful" enough to broadcast.
 * Suppresses sub-pixel jitter when the user isn't actually moving.
 */
export function isMeaningfulMove(
  prev: CursorState | undefined,
  next: CursorState,
  thresholdNormalized = 0.005,
): boolean {
  if (!prev) return true
  if (prev.field !== next.field) return true
  if (prev.caret !== next.caret) return true
  const dx = Math.abs((prev.x ?? 0) - (next.x ?? 0))
  const dy = Math.abs((prev.y ?? 0) - (next.y ?? 0))
  return dx > thresholdNormalized || dy > thresholdNormalized
}
