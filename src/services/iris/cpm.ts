// ────────────────────────────────────────────────────────────────────────────
// cpm — Critical Path walk + lookahead synthesis for the Schedule specialist
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Schedule §)
//
// Generic CPM implementation operating on a typed activity graph. The graph
// shape is intentionally decoupled from the existing `src/lib/criticalPath.ts`
// (which is bound to `SchedulePhase`) so the specialist can run CPM on any
// caller-supplied graph — including a derived 3-week lookahead slice.
//
// Performance: forward + backward pass is O(V + E). The 500-activity perf
// budget (<200ms) is comfortably met because the graph is sparse (avg edges
// per activity ≈ 2 on construction networks).

export interface CpmActivity {
  id: string
  duration_days: number // float allowed; CPM math returns float
  // Predecessor IDs. Empty for start activities.
  predecessors: readonly string[]
}

export interface CpmResult {
  activities: Record<
    string,
    {
      early_start: number // days from project zero
      early_finish: number
      late_start: number
      late_finish: number
      total_float: number // late_start - early_start
      is_critical: boolean // total_float <= 0
    }
  >
  project_duration_days: number
  critical_path: readonly string[] // IDs in topological order
}

// Forward pass: ES = max(predecessor.EF, 0); EF = ES + duration
// Backward pass: LF = min(successor.LS, project_duration); LS = LF - duration
// Float = LS - ES; Critical = float ≤ 0.
//
// Throws on cycles (caller must ensure the input is a DAG; ADR-018's
// deterministic check on the Schedule specialist gates this).
export function runCpm(activities: readonly CpmActivity[]): CpmResult {
  if (activities.length === 0) {
    return {
      activities: {},
      project_duration_days: 0,
      critical_path: [],
    }
  }

  const byId = new Map<string, CpmActivity>()
  for (const a of activities) byId.set(a.id, a)

  // Build adjacency lists (successors) for the backward pass.
  const successors = new Map<string, string[]>()
  for (const a of activities) {
    successors.set(a.id, [])
  }
  for (const a of activities) {
    for (const pred of a.predecessors) {
      const list = successors.get(pred)
      if (list) list.push(a.id)
    }
  }

  // Topological sort (Kahn's algorithm).
  const indeg = new Map<string, number>()
  for (const a of activities) indeg.set(a.id, a.predecessors.length)
  const queue: string[] = []
  for (const [id, deg] of indeg) if (deg === 0) queue.push(id)
  const order: string[] = []
  let qHead = 0
  while (qHead < queue.length) {
    const id = queue[qHead++]
    order.push(id)
    for (const next of successors.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1
      indeg.set(next, d)
      if (d === 0) queue.push(next)
    }
  }
  if (order.length !== activities.length) {
    throw new Error('cpm: input graph contains a cycle (or unknown predecessor ids)')
  }

  // Forward pass.
  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of order) {
    const a = byId.get(id)!
    let earliest = 0
    for (const pred of a.predecessors) {
      const predEf = ef.get(pred) ?? 0
      if (predEf > earliest) earliest = predEf
    }
    es.set(id, earliest)
    ef.set(id, earliest + a.duration_days)
  }
  const projectDuration = order.reduce((m, id) => Math.max(m, ef.get(id) ?? 0), 0)

  // Backward pass.
  const lf = new Map<string, number>()
  const ls = new Map<string, number>()
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const a = byId.get(id)!
    const succs = successors.get(id) ?? []
    let latest: number
    if (succs.length === 0) {
      latest = projectDuration
    } else {
      latest = Number.POSITIVE_INFINITY
      for (const succ of succs) {
        const succLs = ls.get(succ) ?? projectDuration
        if (succLs < latest) latest = succLs
      }
    }
    lf.set(id, latest)
    ls.set(id, latest - a.duration_days)
  }

  // Assemble result.
  const result: CpmResult['activities'] = {}
  const critical: string[] = []
  for (const id of order) {
    const eS = es.get(id) ?? 0
    const eF = ef.get(id) ?? 0
    const lS = ls.get(id) ?? 0
    const lF = lf.get(id) ?? 0
    const float = lS - eS
    const isCritical = float <= 0
    result[id] = {
      early_start: eS,
      early_finish: eF,
      late_start: lS,
      late_finish: lF,
      total_float: float,
      is_critical: isCritical,
    }
    if (isCritical) critical.push(id)
  }

  return {
    activities: result,
    project_duration_days: projectDuration,
    critical_path: critical,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Lookahead synthesis
// ────────────────────────────────────────────────────────────────────────────
// Given a CPM result and a "current day" position, emit the 14-day lookahead
// slice the Super persona's dashboard consumes. Pure function — no DB calls.

export interface LookaheadEntry {
  activity_id: string
  early_start: number
  early_finish: number
  total_float: number
  is_critical: boolean
  // Days from "now" the activity is scheduled to begin (negative = already
  // started; positive = future).
  days_until_start: number
}

export function synthesizeLookahead(
  cpm: CpmResult,
  today_offset_days: number,
  window_days = 14,
): LookaheadEntry[] {
  const horizon = today_offset_days + window_days
  const entries: LookaheadEntry[] = []
  for (const [id, a] of Object.entries(cpm.activities)) {
    if (a.early_start <= horizon && a.early_finish >= today_offset_days) {
      entries.push({
        activity_id: id,
        early_start: a.early_start,
        early_finish: a.early_finish,
        total_float: a.total_float,
        is_critical: a.is_critical,
        days_until_start: a.early_start - today_offset_days,
      })
    }
  }
  entries.sort((a, b) => a.early_start - b.early_start)
  return entries
}
