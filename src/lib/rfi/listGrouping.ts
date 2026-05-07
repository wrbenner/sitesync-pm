// ── listGrouping ────────────────────────────────────────────────────────
// Group + multi-sort helpers for the RFI list.
//
// Group-by: collapse rows into accordion sections keyed by a column
// value. Aggregates a count + total $ impact per group so the section
// header has Bugatti-grade information density.
//
// Multi-sort: array of { id, dir } applied in order. Stable across
// re-renders by relying on Array.prototype.sort with a tie-breaker on
// the row id.

export interface GroupSection<R> {
  key: string
  label: string
  rows: R[]
  count: number
  costTotalCents: number
  scheduleTotalDays: number
}

interface GroupableRow {
  id: string
  cost_impact_cents?: number | null
  schedule_days_impact?: number | null
  [k: string]: unknown
}

/**
 * Group rows by a column id. Returns an array of sections in stable
 * alphabetical order by key (with `'__none__'` last).
 */
export function groupRows<R extends GroupableRow>(
  rows: R[],
  groupById: string | null | undefined,
  labelOf: (key: string) => string = (k) => k,
): GroupSection<R>[] {
  if (!groupById) {
    return [
      {
        key: '__all__',
        label: 'All',
        rows,
        count: rows.length,
        costTotalCents: rows.reduce((s, r) => s + Number(r.cost_impact_cents ?? 0), 0),
        scheduleTotalDays: rows.reduce((s, r) => s + Number(r.schedule_days_impact ?? 0), 0),
      },
    ]
  }
  const buckets = new Map<string, R[]>()
  for (const r of rows) {
    const raw = (r as Record<string, unknown>)[groupById]
    const key = raw == null || raw === '' ? '__none__' : String(raw)
    const arr = buckets.get(key) ?? []
    arr.push(r)
    buckets.set(key, arr)
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return a.localeCompare(b)
  })
  return keys.map((key) => {
    const arr = buckets.get(key) ?? []
    return {
      key,
      label: key === '__none__' ? '— Unassigned' : labelOf(key),
      rows: arr,
      count: arr.length,
      costTotalCents: arr.reduce((s, r) => s + Number(r.cost_impact_cents ?? 0), 0),
      scheduleTotalDays: arr.reduce((s, r) => s + Number(r.schedule_days_impact ?? 0), 0),
    }
  })
}

/** Compare two values for sort. Strings, numbers, dates handled. */
function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  // ISO dates compare lexicographically as strings.
  return String(a).localeCompare(String(b))
}

export function sortRows<R extends Record<string, unknown> & { id: string }>(
  rows: R[],
  sort: Array<{ id: string; dir: 'asc' | 'desc' }>,
): R[] {
  if (sort.length === 0) return rows
  const next = [...rows]
  next.sort((a, b) => {
    for (const s of sort) {
      const ord = cmp(a[s.id], b[s.id])
      if (ord !== 0) return s.dir === 'desc' ? -ord : ord
    }
    return a.id.localeCompare(b.id)
  })
  return next
}
