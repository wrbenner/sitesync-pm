// ── deepLink ───────────────────────────────────────────────────────────────
// Parse `sitesync://...` URLs into the in-app routes the SPA navigates to.
// Used by:
//   • iOS / Android URL-scheme handler — caller passes the full URL
//   • Push-notification click handler — payload includes a `deep_link`
//   • Magic-link share emails (web fallback)
//
// Schema:
//   sitesync://entity/<entity_type>/<entity_id>          → /<type>/<id>
//   sitesync://entity/<entity_type>/<entity_id>?action=<x>
//   sitesync://daily-log[?date=YYYY-MM-DD]               → /daily-log
//   sitesync://capture                                    → quick capture sheet
//   sitesync://share/<entity_type>/<entity_id>?t=<token> → magic-link page
//
// The parser is pure; the caller does the actual navigate.

export interface ParsedDeepLink {
  /** Route segment to navigate to inside the SPA (no leading slash). */
  spaPath: string
  /** Optional query string to append. */
  query?: Record<string, string>
  /** Whether the link requires auth before navigating. Magic-link share
   *  paths do NOT require auth; everything else does. */
  requires_auth: boolean
  /** Stable diagnostic kind for logging. */
  kind: 'entity' | 'daily-log' | 'capture' | 'share' | 'unknown'
  /** When kind === 'entity'; entity_type + entity_id for the caller. */
  entity?: { type: string; id: string; action?: string }
  /** When kind === 'share'; magic-link token + entity ref. */
  share?: { entity_type: string; entity_id: string; token: string }
}

const ENTITY_TYPES = new Set(['rfi', 'submittal', 'change_order', 'punch', 'punch_item'])

/**
 * Parse a deep-link URL. Returns `null` for completely-unparseable input
 * so the caller can fall back to the home screen.
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'sitesync:') return null

  // The "host" part of `sitesync://entity/...` is the first segment.
  const segments = [parsed.host, ...parsed.pathname.split('/').filter(Boolean)]
  const head = segments[0]

  if (head === 'entity') {
    const entity_type = segments[1]
    const entity_id = segments[2]
    if (!entity_type || !entity_id) return null
    const normalizedType = entity_type === 'change_order' ? 'change-orders'
      : entity_type === 'rfi' ? 'rfis'
      : entity_type === 'submittal' ? 'submittals'
      : entity_type === 'punch' || entity_type === 'punch_item' ? 'punch-list'
      : null
    if (!normalizedType) return null
    const action = parsed.searchParams.get('action') ?? undefined
    return {
      spaPath: `${normalizedType}/${entity_id}`,
      query: action ? { action } : undefined,
      requires_auth: true,
      kind: 'entity',
      entity: { type: entity_type, id: entity_id, action },
    }
  }

  if (head === 'daily-log') {
    const date = parsed.searchParams.get('date') ?? undefined
    return {
      spaPath: 'daily-log',
      query: date ? { date } : undefined,
      requires_auth: true,
      kind: 'daily-log',
    }
  }

  if (head === 'capture') {
    return {
      spaPath: 'field-capture',
      requires_auth: true,
      kind: 'capture',
    }
  }

  if (head === 'share') {
    const entity_type = segments[1]
    const entity_id = segments[2]
    const token = parsed.searchParams.get('t') ?? ''
    if (!entity_type || !entity_id || !token) return null
    if (!ENTITY_TYPES.has(entity_type)) return null
    return {
      spaPath: `share/${entity_type}/${entity_id}`,
      query: { t: token },
      requires_auth: false,
      kind: 'share',
      share: { entity_type, entity_id, token },
    }
  }

  return { spaPath: '', requires_auth: true, kind: 'unknown' }
}

/**
 * Build a `sitesync://` URL pointing at an entity. Used by push payloads
 * to give the click handler a deterministic target.
 */
export function deepLinkForEntity(input: { type: string; id: string; action?: string }): string {
  const u = `sitesync://entity/${input.type}/${input.id}`
  return input.action ? `${u}?action=${encodeURIComponent(input.action)}` : u
}

/** Build a deep link for a magic-link share. */
export function deepLinkForShare(entity_type: string, entity_id: string, token: string): string {
  return `sitesync://share/${entity_type}/${entity_id}?t=${encodeURIComponent(token)}`
}
