// ── listFilters ─────────────────────────────────────────────────────────
// Shared shape + URL serializer for the RFI list filter state. The
// FilterPanel, the SavedViews loader, and the KPI-card click handlers
// all read/write through this single source of truth so the URL is the
// canonical state.
//
// Why URL-driven, not React-state-only:
//   • Walker can paste a filter URL into Slack and the recipient sees
//     the same view (no "what filter did you click?" round-trip).
//   • Browser back/forward navigates filter history naturally.
//   • Saved Views serialize the same shape, so applying a view is just
//     "merge view.filters into current URL params".

export interface RFIListFilters {
  status?: string[]
  statusNot?: string[]
  priority?: string[]
  ballInCourt?: string[]
  receivedFrom?: string[]
  rfiManager?: string[]
  trade?: string[]
  specSection?: string
  drawingReference?: string
  costCode?: string
  scheduleImpact?: 'yes' | 'no' | 'tbd'
  costImpact?: 'yes' | 'no' | 'tbd'
  costMin?: number
  costMax?: number
  dueFrom?: string
  dueTo?: string
  daysOpenMin?: number
  daysOpenMax?: number
  createdFrom?: string
  createdTo?: string
  tags?: string[]
  hasUnreadResponse?: boolean
  hasChainGap?: boolean
  isPrivate?: boolean
  /** Convenience: status not closed AND due_date < today. */
  overdue?: boolean
  /** Convenience: due within N days from now. Used by "At risk this week". */
  dueWithinDays?: number
  /** Free-text search across title + number. */
  q?: string
}

export type ViewMode = 'table' | 'kanban' | 'calendar'

export interface RFIListUrlState {
  filters: RFIListFilters
  view: ViewMode
  groupBy?: string
  sort?: Array<{ id: string; dir: 'asc' | 'desc' }>
  savedViewId?: string
}

const ARRAY_KEYS = new Set([
  'status',
  'statusNot',
  'priority',
  'ballInCourt',
  'receivedFrom',
  'rfiManager',
  'trade',
  'tags',
])

const BOOL_KEYS = new Set(['hasUnreadResponse', 'hasChainGap', 'isPrivate', 'overdue'])

const NUMBER_KEYS = new Set(['costMin', 'costMax', 'daysOpenMin', 'daysOpenMax', 'dueWithinDays'])

/** Serialize URL-canonical ?key=val&key=val for the list state. */
export function filtersToSearchParams(state: RFIListUrlState): URLSearchParams {
  const sp = new URLSearchParams()
  if (state.view && state.view !== 'table') sp.set('view', state.view)
  if (state.groupBy) sp.set('groupBy', state.groupBy)
  if (state.savedViewId) sp.set('savedView', state.savedViewId)
  if (state.sort && state.sort.length > 0) {
    sp.set('sort', state.sort.map((s) => `${s.dir === 'desc' ? '-' : ''}${s.id}`).join(','))
  }
  for (const [k, v] of Object.entries(state.filters)) {
    if (v == null) continue
    if (Array.isArray(v)) {
      if (v.length === 0) continue
      sp.set(k, v.join(','))
    } else if (typeof v === 'boolean') {
      if (v) sp.set(k, '1')
    } else if (typeof v === 'number') {
      if (Number.isFinite(v)) sp.set(k, String(v))
    } else if (typeof v === 'string' && v.trim().length > 0) {
      sp.set(k, v)
    }
  }
  return sp
}

export function searchParamsToFilters(sp: URLSearchParams): RFIListUrlState {
  const filters: RFIListFilters = {}
  let view: ViewMode = 'table'
  const sort: Array<{ id: string; dir: 'asc' | 'desc' }> = []
  let groupBy: string | undefined
  let savedViewId: string | undefined

  sp.forEach((rawValue, key) => {
    if (key === 'view') {
      if (rawValue === 'kanban' || rawValue === 'calendar') view = rawValue
      return
    }
    if (key === 'groupBy') {
      groupBy = rawValue
      return
    }
    if (key === 'savedView') {
      savedViewId = rawValue
      return
    }
    if (key === 'sort') {
      for (const tok of rawValue.split(',')) {
        const trimmed = tok.trim()
        if (!trimmed) continue
        const dir: 'asc' | 'desc' = trimmed.startsWith('-') ? 'desc' : 'asc'
        const id = dir === 'desc' ? trimmed.slice(1) : trimmed
        if (id) sort.push({ id, dir })
      }
      return
    }
    if (ARRAY_KEYS.has(key)) {
      ;(filters as Record<string, unknown>)[key] = rawValue.split(',').filter(Boolean)
    } else if (BOOL_KEYS.has(key)) {
      ;(filters as Record<string, unknown>)[key] = rawValue === '1' || rawValue === 'true'
    } else if (NUMBER_KEYS.has(key)) {
      const n = Number(rawValue)
      if (Number.isFinite(n)) (filters as Record<string, unknown>)[key] = n
    } else {
      ;(filters as Record<string, unknown>)[key] = rawValue
    }
  })

  return { filters, view, sort, groupBy, savedViewId }
}

const TODAY_ISO = (): string => new Date().toISOString().slice(0, 10)

const daysBetween = (a: string, b: string): number => {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0
  return Math.floor((db - da) / 86400000)
}

/** Apply a filter set to a flat RFI row. Pure for testability. */
export function matchesFilter(
  rfi: Record<string, unknown>,
  filters: RFIListFilters,
): boolean {
  const status = (rfi.status as string | null) ?? ''
  const priority = (rfi.priority as string | null) ?? ''
  const ballInCourt = (rfi.ball_in_court as string | null) ?? ''
  const dueDate = (rfi.due_date as string | null) ?? ''
  const createdAt = (rfi.created_at as string | null) ?? ''
  const isPrivate = Boolean(rfi.is_private)
  const costCents =
    (rfi.cost_impact_cents as number | null) ?? null
  const titleLower = (rfi.title as string | null)?.toLowerCase() ?? ''
  const numberStr = String((rfi.number as number | null) ?? '')
  const q = filters.q?.trim().toLowerCase() ?? ''

  if (filters.status && filters.status.length > 0 && !filters.status.includes(status)) return false
  if (filters.statusNot && filters.statusNot.length > 0 && filters.statusNot.includes(status)) return false
  if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(priority)) return false
  if (filters.ballInCourt && filters.ballInCourt.length > 0 && !filters.ballInCourt.includes(ballInCourt)) return false

  if (filters.dueFrom && (!dueDate || dueDate < filters.dueFrom)) return false
  if (filters.dueTo && (!dueDate || dueDate > filters.dueTo)) return false
  if (filters.createdFrom && (!createdAt || createdAt < filters.createdFrom)) return false
  if (filters.createdTo && (!createdAt || createdAt > filters.createdTo)) return false

  if (filters.daysOpenMin != null || filters.daysOpenMax != null) {
    const opened = createdAt ? daysBetween(createdAt, TODAY_ISO()) : 0
    if (filters.daysOpenMin != null && opened < filters.daysOpenMin) return false
    if (filters.daysOpenMax != null && opened > filters.daysOpenMax) return false
  }

  if (filters.overdue) {
    const open = status !== 'closed' && status !== 'void' && status !== ''
    const past = !!dueDate && dueDate < TODAY_ISO()
    if (!(open && past)) return false
  }
  if (filters.dueWithinDays != null) {
    if (!dueDate) return false
    const today = TODAY_ISO()
    const cutoff = new Date(Date.now() + filters.dueWithinDays * 86400000)
      .toISOString()
      .slice(0, 10)
    if (dueDate < today || dueDate > cutoff) return false
  }
  if (filters.isPrivate != null && filters.isPrivate !== isPrivate) return false
  if (filters.scheduleImpact === 'yes' && (rfi.schedule_days_impact == null || rfi.schedule_days_impact === 0)) return false
  if (filters.scheduleImpact === 'no' && rfi.schedule_days_impact != null && rfi.schedule_days_impact !== 0) return false
  if (filters.costImpact === 'yes' && (costCents == null || costCents === 0)) return false
  if (filters.costImpact === 'no' && costCents != null && costCents !== 0) return false
  if (filters.costMin != null && costCents != null && costCents / 100 < filters.costMin) return false
  if (filters.costMax != null && costCents != null && costCents / 100 > filters.costMax) return false

  if (q) {
    if (!titleLower.includes(q) && !numberStr.includes(q)) return false
  }

  return true
}

export const EMPTY_FILTERS: RFIListFilters = {}
export const DEFAULT_URL_STATE: RFIListUrlState = { filters: {}, view: 'table', sort: [] }
