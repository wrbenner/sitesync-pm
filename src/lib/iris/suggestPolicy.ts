/**
 * Iris suggestion policy — pure, idempotent.
 *
 * Given a snapshot of an entity, history of past suggestions, and the
 * user's frequency preference, returns 0-3 suggestions sorted by
 * confidence (highest first).
 *
 * Rules (encoded as named matchers):
 *   - RFI awaiting response > 5 days → "Iris drafted a response — review?"
 *   - Punch item open > 7 days → "Iris drafted a follow-up to the sub"
 *   - Daily log empty at 5 PM local → "Iris drafted today's log"
 *   - Submittal in pending_review > 14 days → "Iris drafted an architect nudge"
 *   - CO with cost_impact > $50k and no quote attached → "ask the sub for backup"
 *
 * Frequency throttle:
 *   - 'off'        → returns []
 *   - 'occasional' → max 1, only confidence ≥ 0.8
 *   - 'always'     → max 3, confidence ≥ 0.5
 *
 * Idempotency: don't suggest the same kind for the same entity twice
 * within 24 hours (drives off SuggestionHistoryRow.suggested_at).
 */

export type EntityType = 'rfi' | 'submittal' | 'change_order' | 'punch_item' | 'daily_log'

export type SuggestionKind =
  | 'rfi.draft_response'
  | 'punch_item.follow_up'
  | 'daily_log.draft'
  | 'submittal.nudge_architect'
  | 'change_order.request_backup'

export interface EntitySnapshot {
  entity_type: EntityType
  entity_id: string
  project_id: string
  /** Free-form, but matchers know which keys to inspect by entity_type. */
  fields: {
    /** RFI: the date we sent the RFI. */
    sent_at?: string
    /** Punch item: created_at. */
    created_at?: string
    /** Status (entity-specific). */
    status?: string
    /** Daily-log specific: log_date (YYYY-MM-DD) and entry count. */
    log_date?: string
    entry_count?: number
    /** Daily-log: user's IANA timezone for "5 PM local" check. */
    timezone?: string
    /** CO specific. */
    cost_impact?: number
    quote_attached?: boolean
    /** Submittal: submitted_at. */
    submitted_at?: string
  }
}

export interface SuggestionHistoryRow {
  user_id: string
  entity_type: string
  entity_id: string
  suggestion_kind: SuggestionKind
  suggested_at: string
}

export interface Suggestion {
  kind: SuggestionKind
  entity_type: EntityType
  entity_id: string
  title: string
  rationale: string
  confidence: number
}

export interface UserPrefs {
  suggestionFrequency: 'off' | 'occasional' | 'always'
}

const DAY_MS = 24 * 60 * 60 * 1000

export function suggestForEntity(
  entity: EntitySnapshot,
  history: SuggestionHistoryRow[],
  userPrefs: UserPrefs,
  now: Date,
): Suggestion[] {
  if (userPrefs.suggestionFrequency === 'off') return []

  const candidates: Suggestion[] = []
  for (const matcher of MATCHERS) {
    const match = matcher(entity, now)
    if (match) candidates.push(match)
  }

  // 24h dedup: drop any candidate whose kind+entity was suggested in last 24h.
  const cutoff = new Date(now.getTime() - DAY_MS)
  const recent = new Set(
    history
      .filter((h) => h.entity_id === entity.entity_id && new Date(h.suggested_at) >= cutoff)
      .map((h) => h.suggestion_kind),
  )
  const fresh = candidates.filter((c) => !recent.has(c.kind))

  // Sort by confidence desc.
  fresh.sort((a, b) => b.confidence - a.confidence)

  if (userPrefs.suggestionFrequency === 'occasional') {
    return fresh.filter((s) => s.confidence >= 0.8).slice(0, 1)
  }
  // 'always'
  return fresh.filter((s) => s.confidence >= 0.5).slice(0, 3)
}

// ── Matchers ──────────────────────────────────────────────────────────

type Matcher = (e: EntitySnapshot, now: Date) => Suggestion | null

const rfiMatcher: Matcher = (e, now) => {
  if (e.entity_type !== 'rfi') return null
  if (!e.fields.sent_at) return null
  if (e.fields.status === 'answered' || e.fields.status === 'closed') return null
  const daysOpen = (now.getTime() - new Date(e.fields.sent_at).getTime()) / DAY_MS
  if (daysOpen <= 5) return null
  // Confidence climbs with overdue magnitude. 5d→0.7, 10d→0.85, 20d→0.95
  const confidence = Math.min(0.95, 0.6 + (daysOpen - 5) * 0.03)
  return {
    kind: 'rfi.draft_response',
    entity_type: 'rfi',
    entity_id: e.entity_id,
    title: 'Iris drafted a response — review?',
    rationale: `RFI has been open ${Math.floor(daysOpen)} days without response`,
    confidence: Math.round(confidence * 100) / 100,
  }
}

const punchMatcher: Matcher = (e, now) => {
  if (e.entity_type !== 'punch_item') return null
  if (!e.fields.created_at) return null
  if (e.fields.status === 'closed' || e.fields.status === 'verified') return null
  const daysOpen = (now.getTime() - new Date(e.fields.created_at).getTime()) / DAY_MS
  if (daysOpen <= 7) return null
  const confidence = Math.min(0.92, 0.65 + (daysOpen - 7) * 0.025)
  return {
    kind: 'punch_item.follow_up',
    entity_type: 'punch_item',
    entity_id: e.entity_id,
    title: 'Iris drafted a follow-up to the sub',
    rationale: `Punch item open ${Math.floor(daysOpen)} days`,
    confidence: Math.round(confidence * 100) / 100,
  }
}

const dailyLogMatcher: Matcher = (e, now) => {
  if (e.entity_type !== 'daily_log') return null
  if ((e.fields.entry_count ?? 0) > 0) return null
  if (!e.fields.log_date) return null
  // Today's log only.
  const tz = e.fields.timezone ?? 'UTC'
  const localDate = formatLocalDate(now, tz)
  if (e.fields.log_date !== localDate) return null
  // Need to be after 5 PM local.
  const localHm = getLocalMinutes(now, tz)
  if (localHm < 17 * 60) return null
  return {
    kind: 'daily_log.draft',
    entity_type: 'daily_log',
    entity_id: e.entity_id,
    title: "Iris drafted today's log from your captures",
    rationale: 'Daily log empty after 5 PM local',
    confidence: 0.82,
  }
}

const submittalMatcher: Matcher = (e, now) => {
  if (e.entity_type !== 'submittal') return null
  if (e.fields.status !== 'pending_review') return null
  if (!e.fields.submitted_at) return null
  const daysOpen = (now.getTime() - new Date(e.fields.submitted_at).getTime()) / DAY_MS
  if (daysOpen <= 14) return null
  const confidence = Math.min(0.9, 0.7 + (daysOpen - 14) * 0.015)
  return {
    kind: 'submittal.nudge_architect',
    entity_type: 'submittal',
    entity_id: e.entity_id,
    title: 'Iris drafted an architect nudge',
    rationale: `Submittal in pending review ${Math.floor(daysOpen)} days`,
    confidence: Math.round(confidence * 100) / 100,
  }
}

const coBackupMatcher: Matcher = (e) => {
  if (e.entity_type !== 'change_order') return null
  if ((e.fields.cost_impact ?? 0) <= 50000) return null
  if (e.fields.quote_attached) return null
  return {
    kind: 'change_order.request_backup',
    entity_type: 'change_order',
    entity_id: e.entity_id,
    title: 'Iris suggested asking the sub for backup',
    rationale: `CO over $50k with no quote attached`,
    confidence: 0.88,
  }
}

const MATCHERS: Matcher[] = [rfiMatcher, punchMatcher, dailyLogMatcher, submittalMatcher, coBackupMatcher]

// ── tz helpers (local copies — avoid cross-lib coupling) ──────────────

function getLocalMinutes(now: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(now)
    let h = 0
    let m = 0
    for (const p of parts) {
      if (p.type === 'hour') h = parseInt(p.value, 10)
      if (p.type === 'minute') m = parseInt(p.value, 10)
    }
    if (h === 24) h = 0
    return h * 60 + m
  } catch {
    return 0
  }
}

function formatLocalDate(now: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    return fmt.format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}
