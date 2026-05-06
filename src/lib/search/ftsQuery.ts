// =============================================================================
// FTS query helpers — sanitize user input, build Postgres tsquery
// =============================================================================
// Pure helpers: take user input ("flashing detail in unit 312"), output a
// safe tsquery + a cleaned display string for highlight rendering. The
// edge-side caller composes these into the final Postgres call to
// `search_org()`.
// =============================================================================

export interface ParsedQuery {
  /** The string to pass to Postgres `plainto_tsquery('english', ...)`. */
  tsqueryInput: string
  /** Tokens for client-side highlight rendering. */
  highlights: string[]
  empty: boolean
  tooShort: boolean
}

const TSQUERY_OPS = /[!&|()<>:*]/g
const MULTI_WS = /\s+/g

export function parseQuery(raw: string): ParsedQuery {
  const stripped = (raw ?? '').replace(TSQUERY_OPS, ' ').replace(MULTI_WS, ' ').trim()
  if (!stripped) return { tsqueryInput: '', highlights: [], empty: true, tooShort: false }
  if (stripped.length < 2) return { tsqueryInput: stripped, highlights: [stripped], empty: false, tooShort: true }
  const tokens = stripped.split(' ').filter(Boolean)
  return {
    tsqueryInput: tokens.join(' '),
    highlights: tokens,
    empty: false,
    tooShort: false,
  }
}

/**
 * Highlight regex matches in a string and return an array of segments
 * `{ text, highlighted }` for the SearchResultRow renderer to color.
 *
 * Case-insensitive, longest-token-first to avoid sub-matching.
 */
export function highlightSegments(
  body: string,
  highlights: string[],
): Array<{ text: string; highlighted: boolean }> {
  if (!body) return []
  if (highlights.length === 0) return [{ text: body, highlighted: false }]
  const ordered = [...highlights].sort((a, b) => b.length - a.length)
  const escaped = ordered.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts: Array<{ text: string; highlighted: boolean }> = []
  let lastIndex = 0
  for (const match of body.matchAll(re)) {
    const idx = match.index ?? 0
    if (idx > lastIndex) parts.push({ text: body.slice(lastIndex, idx), highlighted: false })
    parts.push({ text: match[0], highlighted: true })
    lastIndex = idx + match[0].length
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex), highlighted: false })
  return parts
}

export interface SearchRow {
  entity_type: string
  entity_id: string
  project_id: string
  title: string
  body: string
  status: string
  rank: number
  created_at: string
}

export function groupByEntity(rows: SearchRow[]): Record<string, SearchRow[]> {
  const out: Record<string, SearchRow[]> = {}
  for (const r of rows) {
    if (!out[r.entity_type]) out[r.entity_type] = []
    out[r.entity_type].push(r)
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b.rank - a.rank)
  return out
}

/** Trim a body to a snippet around the first highlight match. */
export function snippet(body: string, highlights: string[], maxLength = 140): string {
  if (!body) return ''
  if (body.length <= maxLength) return body
  if (highlights.length === 0) return body.slice(0, maxLength) + '…'
  const lower = body.toLowerCase()
  let firstIdx = body.length
  for (const h of highlights) {
    const idx = lower.indexOf(h.toLowerCase())
    if (idx >= 0 && idx < firstIdx) firstIdx = idx
  }
  if (firstIdx === body.length) return body.slice(0, maxLength) + '…'
  const start = Math.max(0, firstIdx - 30)
  const end = Math.min(body.length, start + maxLength)
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '')
}
