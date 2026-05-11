// ────────────────────────────────────────────────────────────────────────────
// Schedule specialist + CPM tests — Phase 2c
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Schedule §)
// Perf budget: CPM walk on 500-activity graph < 200ms.

import { describe, expect, it } from 'vitest'

import { runCpm, synthesizeLookahead, type CpmActivity } from '../../cpm'
import {
  SCHEDULE_DECL,
  computeScheduleFacts,
  scheduleDeterministicCheck,
  scheduleShouldRun,
  type ScheduleInput,
} from '../schedule'
import { buildContext } from '../../contextFabric'

function emptyContext() {
  const { context } = buildContext({
    user_id: 'u',
    org_id: 'org',
    project_id: 'project-avery-oaks',
    current_page: '/schedule',
    entity_type: 'schedule_activity',
    entity_id: 'ACT-x',
    invocation_intent: 'recommend_action',
  })
  return context
}

const SIMPLE_GRAPH: CpmActivity[] = [
  { id: 'A', duration_days: 5, predecessors: [] },
  { id: 'B', duration_days: 3, predecessors: ['A'] },
  { id: 'C', duration_days: 4, predecessors: ['A'] },
  { id: 'D', duration_days: 2, predecessors: ['B', 'C'] },
]

describe('SCHEDULE_DECL — ADR-018 boundary conformance', () => {
  it('declares the canonical specialist shape', () => {
    expect(SCHEDULE_DECL.name).toBe('schedule')
    expect(SCHEDULE_DECL.llmScope).toBe('synthesis')
    expect(SCHEDULE_DECL.modelTier).toBe('sonnet')
    expect(SCHEDULE_DECL.writeScope).toEqual([])
  })

  it('audit fields include lookahead_window_days + activity_count + critical_path_count + weather_signals_used', () => {
    const declared = new Set(SCHEDULE_DECL.auditFields)
    expect(declared.has('lookahead_window_days')).toBe(true)
    expect(declared.has('activity_count')).toBe(true)
    expect(declared.has('critical_path_count')).toBe(true)
    expect(declared.has('weather_signals_used')).toBe(true)
  })

  it('tool allow-list contains weather_query (Schedule needs it) and 4 cite_* tools', () => {
    expect(SCHEDULE_DECL.toolAllowList).toContain('weather_query')
    const citeCount = SCHEDULE_DECL.toolAllowList.filter((t) => t.startsWith('cite_')).length
    expect(citeCount).toBe(4)
  })
})

describe('scheduleDeterministicCheck — gate decisions', () => {
  const ctx = emptyContext()

  it('passes a healthy 4-activity graph', () => {
    const input: ScheduleInput = { activities: SIMPLE_GRAPH, today_offset_days: 0 }
    expect(scheduleDeterministicCheck(input, ctx).ok).toBe(true)
  })

  it('blocks empty activities', () => {
    const result = scheduleDeterministicCheck(
      { activities: [], today_offset_days: 0 },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('empty'))).toBe(true)
  })

  it('blocks today_offset_days < 0', () => {
    const result = scheduleDeterministicCheck(
      { activities: SIMPLE_GRAPH, today_offset_days: -1 },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('today_offset_days'))).toBe(true)
  })

  it('blocks window_days outside [1, 14]', () => {
    const result = scheduleDeterministicCheck(
      { activities: SIMPLE_GRAPH, today_offset_days: 0, window_days: 21 },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('window_days'))).toBe(true)
  })

  it('blocks non-finite duration_days', () => {
    const result = scheduleDeterministicCheck(
      {
        activities: [{ id: 'X', duration_days: Number.NaN, predecessors: [] }],
        today_offset_days: 0,
      },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('duration_days'))).toBe(true)
  })

  it('blocks graphs with cycles (caught via CPM precondition)', () => {
    const cyclic: CpmActivity[] = [
      { id: 'A', duration_days: 1, predecessors: ['B'] },
      { id: 'B', duration_days: 1, predecessors: ['A'] },
    ]
    const result = scheduleDeterministicCheck(
      { activities: cyclic, today_offset_days: 0 },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('CPM precondition'))).toBe(true)
  })

  it('warns when window > 7d and no weather_forecast supplied (not a blocker)', () => {
    const result = scheduleDeterministicCheck(
      { activities: SIMPLE_GRAPH, today_offset_days: 0, window_days: 14 },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(result.warnings?.some((w: string) => w.includes('weather_forecast'))).toBe(true)
  })

  it('warns when weather_forecast has bad date format', () => {
    const result = scheduleDeterministicCheck(
      {
        activities: SIMPLE_GRAPH,
        today_offset_days: 0,
        weather_forecast: [{ date: '05/14/2026', precipitation_pct: 20, high_f: 65 }],
      },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(result.warnings?.some((w: string) => w.includes('YYYY-MM-DD'))).toBe(true)
  })

  it('scheduleShouldRun mirrors scheduleDeterministicCheck', () => {
    const input: ScheduleInput = { activities: SIMPLE_GRAPH, today_offset_days: 0 }
    expect(scheduleShouldRun(input, ctx)).toEqual(scheduleDeterministicCheck(input, ctx))
  })
})

describe('runCpm — deterministic math', () => {
  it('computes forward and backward pass on a diamond graph', () => {
    const result = runCpm(SIMPLE_GRAPH)
    expect(result.project_duration_days).toBe(11) // A(5) + max(B(3), C(4)) + D(2) = 11
    expect(result.activities.A.early_start).toBe(0)
    expect(result.activities.A.early_finish).toBe(5)
    expect(result.activities.D.early_finish).toBe(11)
    expect(result.activities.C.is_critical).toBe(true) // longer path
    expect(result.activities.B.is_critical).toBe(false) // shorter parallel
  })

  it('handles empty input gracefully', () => {
    const result = runCpm([])
    expect(result.project_duration_days).toBe(0)
    expect(result.critical_path).toEqual([])
  })

  it('throws on cycles', () => {
    expect(() =>
      runCpm([
        { id: 'A', duration_days: 1, predecessors: ['B'] },
        { id: 'B', duration_days: 1, predecessors: ['A'] },
      ]),
    ).toThrow(/cycle/)
  })

  it('all activities are critical when there is a single chain', () => {
    const result = runCpm([
      { id: 'A', duration_days: 2, predecessors: [] },
      { id: 'B', duration_days: 3, predecessors: ['A'] },
      { id: 'C', duration_days: 4, predecessors: ['B'] },
    ])
    expect(result.critical_path).toEqual(['A', 'B', 'C'])
  })
})

describe('CPM perf — 500-activity graph < 200ms (spec §Schedule)', () => {
  it('builds and walks a 500-activity sparse graph well under budget', () => {
    const activities: CpmActivity[] = []
    // Linear backbone with cross-edges every 3 nodes to keep it sparse.
    for (let i = 0; i < 500; i++) {
      const preds: string[] = []
      if (i > 0) preds.push(`act-${i - 1}`)
      if (i > 3 && i % 3 === 0) preds.push(`act-${i - 3}`)
      activities.push({ id: `act-${i}`, duration_days: (i % 5) + 1, predecessors: preds })
    }
    const t0 = performance.now()
    const result = runCpm(activities)
    const dt = performance.now() - t0
    expect(result.project_duration_days).toBeGreaterThan(0)
    expect(dt).toBeLessThan(200)
  })
})

describe('synthesizeLookahead', () => {
  it('returns activities overlapping the today + window range, sorted by ES', () => {
    const cpm = runCpm(SIMPLE_GRAPH)
    const window = synthesizeLookahead(cpm, 5, 7) // today = day 5, 7-day window → days 5..12
    expect(window.length).toBeGreaterThan(0)
    expect(window[0].early_start).toBeLessThanOrEqual(window[window.length - 1].early_start)
  })

  it('emits is_critical flag and days_until_start relative to today', () => {
    const cpm = runCpm(SIMPLE_GRAPH)
    const window = synthesizeLookahead(cpm, 5, 7)
    for (const e of window) {
      expect(typeof e.is_critical).toBe('boolean')
      expect(e.days_until_start).toBe(e.early_start - 5)
    }
  })
})

describe('computeScheduleFacts', () => {
  it('returns CPM result for the input activity graph', () => {
    const result = computeScheduleFacts({ activities: SIMPLE_GRAPH, today_offset_days: 0 })
    expect(result.project_duration_days).toBe(11)
  })
})
