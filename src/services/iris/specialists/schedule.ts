// ────────────────────────────────────────────────────────────────────────────
// Schedule specialist — Phase 2c, ADR-018 conformant
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Schedule §)
// ADR: docs/audits/ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md
//
// The Schedule specialist owns lookahead-update + safety-brief + day-by-day
// scheduling recommendations. LLM scope is `synthesis`: the model combines
// deterministic CPM signals + weather + crew availability into a draft
// recommendation. The numerical math is non-negotiable — deterministic.

import type { IrisContext } from '../types/context'

import { runCpm, type CpmActivity, type CpmResult } from '../cpm'

import {
  assertAuditFieldsComplete,
  BASE_AUDIT_FIELDS,
  type DeterministicResult,
  type SpecialistDecl,
} from './types'

export interface WeatherDay {
  date: string // YYYY-MM-DD
  precipitation_pct: number
  high_f: number
}

export interface ScheduleInput {
  /** Activity graph for the project (or a 3-week lookahead slice). */
  activities: readonly CpmActivity[]
  /** Days from project zero that "today" represents. */
  today_offset_days: number
  /** 14-day forecast aligned to `today_offset_days`. */
  weather_forecast?: readonly WeatherDay[]
  /** Lookahead window length in days. Cap = 14 per spec. */
  window_days?: number
}

const SCHEDULE_VERSION = '0.1.0' as const
const SCHEDULE_PROMPT_VERSION = 'phase-2c.0' as const
const WEATHER_STALENESS_MAX_HOURS = 1

export function scheduleDeterministicCheck(
  input: ScheduleInput,
  _ctx: IrisContext,
): DeterministicResult {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!Array.isArray(input.activities) || input.activities.length === 0) {
    blockers.push('activities cannot be empty')
  }
  if (!Number.isFinite(input.today_offset_days) || input.today_offset_days < 0) {
    blockers.push('today_offset_days must be >= 0')
  }
  if (input.window_days != null && (input.window_days < 1 || input.window_days > 14)) {
    blockers.push('window_days must be in [1, 14] (spec §Schedule)')
  }

  // Float values must be present. We treat duration_days as the float-bearing
  // field; "present" means it's a finite number ≥ 0.
  for (const [i, a] of input.activities.entries()) {
    if (!a.id) blockers.push(`activities[${i}].id required`)
    if (!Number.isFinite(a.duration_days) || a.duration_days < 0) {
      blockers.push(`activities[${i}].duration_days must be a finite non-negative number`)
    }
    if (!Array.isArray(a.predecessors)) {
      blockers.push(`activities[${i}].predecessors must be an array`)
    }
  }

  // Cycle detection — runCpm() throws on cycles, but we surface here to keep
  // the gate the source of truth (no LLM call if the graph is invalid).
  if (blockers.length === 0) {
    try {
      runCpm(input.activities)
    } catch (err) {
      blockers.push(`CPM precondition failed: ${(err as Error).message}`)
    }
  }

  // Weather staleness — caller-supplied snapshots include a `date`; this gate
  // only requires the array to be present + non-empty if a synthesis path
  // wants weather context. Real freshness is enforced by the upstream
  // weather-detector (Lap 2 Day 35); we just warn if the array is missing
  // when a lookahead window > 7 days is requested.
  const window = input.window_days ?? 14
  if (window > 7 && (!input.weather_forecast || input.weather_forecast.length === 0)) {
    warnings.push(
      'lookahead window > 7d but no weather_forecast supplied — synthesis will skip weather signals',
    )
  }
  if (input.weather_forecast && input.weather_forecast.length > 0) {
    // Sanity: forecast has the right shape. (Real staleness check lives in
    // the weather-detector with a 6h ttl; ADR-018 says this specialist
    // shouldn't re-implement it.)
    for (const [i, d] of input.weather_forecast.entries()) {
      if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
        warnings.push(`weather_forecast[${i}].date is not YYYY-MM-DD`)
      }
      if (d.precipitation_pct < 0 || d.precipitation_pct > 100) {
        warnings.push(`weather_forecast[${i}].precipitation_pct out of [0, 100]`)
      }
    }
  }

  return {
    ok: blockers.length === 0,
    blockers: blockers.length ? blockers : undefined,
    warnings: warnings.length ? warnings : undefined,
  }
}

/**
 * Compute the deterministic facts the Schedule specialist hands to the LLM.
 * Pure — no DB. Caller-supplied graph in, CpmResult out.
 */
export function computeScheduleFacts(input: ScheduleInput): CpmResult {
  return runCpm(input.activities)
}

export const SCHEDULE_DECL: SpecialistDecl<ScheduleInput> = {
  name: 'schedule',
  version: SCHEDULE_VERSION,
  deterministicCheck: scheduleDeterministicCheck,
  llmScope: 'synthesis',
  modelTier: 'sonnet',
  promptVersion: SCHEDULE_PROMPT_VERSION,
  // Read-only — the schedule_lookahead_publish_executor ratifies.
  writeScope: [],
  latencyBudgetMs: { p50: 3000, p95: 5000 },
  auditFields: [
    ...BASE_AUDIT_FIELDS,
    'lookahead_window_days',
    'activity_count',
    'critical_path_count',
    'weather_signals_used',
  ],
  toolAllowList: [
    'weather_query',
    'cite_schedule_phase',
    'cite_drawing_coordinate',
    'cite_rfi_reference',
    'cite_daily_log_excerpt',
  ],
}

assertAuditFieldsComplete(SCHEDULE_DECL)

export function scheduleShouldRun(input: ScheduleInput, ctx: IrisContext): DeterministicResult {
  return scheduleDeterministicCheck(input, ctx)
}

// Exported for the Lap 2 weather-detector reuse assertion (Schedule never
// re-implements the staleness check; it consults this constant).
export const SCHEDULE_WEATHER_STALENESS_MAX_HOURS = WEATHER_STALENESS_MAX_HOURS
