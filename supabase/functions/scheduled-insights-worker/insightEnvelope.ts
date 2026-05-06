// Pure envelope builders for the scheduled-insights worker.
//
// Why a separate file: the worker (`index.ts`) uses Deno globals
// (`Deno.serve`, `Deno.env`) which Vitest can't shim. This file is
// plain TypeScript with no Deno-specific imports, so it loads
// identically under Node (Vitest) and Deno (the worker).
//
// The promote_insight_to_draft RPC's CHECK constraints are the
// runtime safety net: any envelope produced here that violates the
// shape gets rejected at insert time. This module's job is to make
// the happy path cheap to test.

export type InsightKind = 'aging' | 'cascade' | 'variance' | 'staffing' | 'weather'
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low'

/** Stable shape that promote_insight_to_draft expects in p_insight. */
export interface InsightEnvelope {
  kind: InsightKind
  actionType: string
  title: string
  summary: string
  reason: string
  severity: InsightSeverity
  confidence: number
  primaryEntityType: string
  primaryEntityId: string
  payload: Record<string, unknown>
  citations: Array<{
    kind:
      | 'rfi_reference'
      | 'schedule_phase'
      | 'budget_line'
      | 'photo_observation'
      | 'spec_reference'
      | 'drawing_coordinate'
      | 'change_order'
      | 'daily_log_excerpt'
    label: string
    ref?: string
    snippet?: string
  }>
}

// ── Severity ladders ────────────────────────────────────────────────

/**
 * Aging RFI severity: keyed on inferred schedule slip.
 *   ≥ 10 days  → critical
 *   ≥ 5 days   → high
 *   else       → medium (drops below the promotion floor; not promoted)
 */
export function agingSeverity(slipDays: number): InsightSeverity {
  if (slipDays >= 10) return 'critical'
  if (slipDays >= 5) return 'high'
  return 'medium'
}

/**
 * Cascade severity: critical-path activity + at-risk submittal is a
 * "the schedule is about to slip" signal. Off-critical-path with a
 * near baseline is "high"; further-out is "medium".
 *   on critical path                              → critical
 *   off critical path AND baseline within 7 days  → high
 *   else                                          → medium
 */
export function cascadeSeverity(
  isCriticalPath: boolean,
  daysToBaseline: number,
): InsightSeverity {
  if (isCriticalPath) return 'critical'
  if (daysToBaseline <= 7) return 'high'
  return 'medium'
}

// ── Envelope builders ───────────────────────────────────────────────

export interface AgingInputs {
  rfiId: string
  rfiNumber: string
  rfiTitle: string
  overdueDays: number
  activityId: string
  activityName: string
  slipDays: number
}

export function buildAgingEnvelope(inputs: AgingInputs): InsightEnvelope {
  const severity = agingSeverity(inputs.slipDays)
  return {
    kind: 'aging',
    actionType: 'rfi.draft',
    title: `Follow up on aged RFI #${inputs.rfiNumber}`,
    summary: `RFI #${inputs.rfiNumber} ("${inputs.rfiTitle}") is ${inputs.overdueDays} days past due on the critical-path activity "${inputs.activityName}". Estimated slip: ${inputs.slipDays} day(s).`,
    reason: 'aging-detector: critical-path RFI overdue ≥ 5 days',
    severity,
    confidence: 0.85,
    primaryEntityType: 'rfi',
    primaryEntityId: inputs.rfiId,
    payload: {
      title: `Follow up on aged RFI #${inputs.rfiNumber}`,
      description: `Iris noticed RFI #${inputs.rfiNumber} is ${inputs.overdueDays} days past its due date and the linked activity "${inputs.activityName}" is on the critical path. Drafting a follow-up to keep the schedule honest.`,
      priority: severity === 'critical' ? 'critical' : 'high',
      insightKind: 'aging',
    },
    citations: [
      {
        kind: 'rfi_reference',
        label: `RFI #${inputs.rfiNumber}: ${inputs.rfiTitle}`,
        ref: inputs.rfiId,
      },
      {
        kind: 'schedule_phase',
        label: `Critical-path activity: ${inputs.activityName}`,
        ref: inputs.activityId,
      },
    ],
  }
}

export interface CascadeInputs {
  submittalId: string
  submittalNumber: string
  submittalTitle: string
  submittalStatus: string
  activityId: string
  activityName: string
  isCriticalPath: boolean
  daysToBaseline: number
  slipDays: number
}

export function buildCascadeEnvelope(inputs: CascadeInputs): InsightEnvelope {
  const severity = cascadeSeverity(inputs.isCriticalPath, inputs.daysToBaseline)
  const isRejected = inputs.submittalStatus.toLowerCase() === 'rejected'
  const verb = isRejected ? 'was rejected' : 'is at risk'
  return {
    kind: 'cascade',
    actionType: 'rfi.draft',
    title: `Pre-empt cascade from submittal #${inputs.submittalNumber}`,
    summary: `Submittal #${inputs.submittalNumber} ("${inputs.submittalTitle}") ${verb} and feeds the activity "${inputs.activityName}" (baseline in ${inputs.daysToBaseline} days). Estimated slip: ${inputs.slipDays} day(s).`,
    reason: isRejected
      ? 'cascade-detector: rejected submittal feeds near-baseline activity'
      : 'cascade-detector: at-risk submittal feeds near-baseline activity',
    severity,
    confidence: 0.8,
    primaryEntityType: 'submittal',
    primaryEntityId: inputs.submittalId,
    payload: {
      title: `Resequence work around submittal #${inputs.submittalNumber}`,
      description: `Iris noticed submittal #${inputs.submittalNumber} ${verb} and the linked activity "${inputs.activityName}" hits its baseline in ${inputs.daysToBaseline} days${
        inputs.isCriticalPath ? ' (critical path)' : ''
      }. Drafting an RFI to surface options before the slip lands.`,
      priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
      insightKind: 'cascade',
    },
    citations: [
      {
        kind: 'spec_reference',
        label: `Submittal #${inputs.submittalNumber}: ${inputs.submittalTitle}`,
        ref: inputs.submittalId,
      },
      {
        kind: 'schedule_phase',
        label: inputs.isCriticalPath
          ? `Critical-path activity: ${inputs.activityName}`
          : `Activity: ${inputs.activityName}`,
        ref: inputs.activityId,
      },
    ],
  }
}

// ── Slip inference ──────────────────────────────────────────────────

/**
 * Inferred schedule slip when the entity doesn't carry an explicit
 * impact field. Common pattern: overdue days minus the activity's
 * remaining float, floored at zero.
 */
export function inferSlipDays(
  overdueDays: number,
  floatDays: number,
  explicitImpact?: number,
): number {
  if (typeof explicitImpact === 'number' && explicitImpact > 0) return explicitImpact
  return Math.max(0, overdueDays - Math.max(0, floatDays))
}

/**
 * Cascade slip estimate: rejection is heavier than at-risk; both are
 * reduced by the activity's remaining float. Used when we don't yet
 * have a per-submittal impact column.
 */
export function inferCascadeSlip(submittalStatus: string, floatDays: number): number {
  const baseSlip = submittalStatus.toLowerCase() === 'rejected' ? 10 : 5
  return Math.max(0, baseSlip - Math.max(0, floatDays))
}

// ── Variance ────────────────────────────────────────────────────────

/**
 * Variance severity: keyed on the project's percent-committed.
 *   ≥ 100% = over budget → critical
 *   ≥ 90%  = within scope but heating up → high
 *   else   = medium (drops below promotion floor)
 */
export function varianceSeverity(percentCommitted: number): InsightSeverity {
  if (percentCommitted >= 100) return 'critical'
  if (percentCommitted >= 90) return 'high'
  return 'medium'
}

export interface VarianceInputs {
  /** Stable id for the project's latest budget snapshot (e.g. snapshot id or week-start). */
  snapshotId: string
  /** ISO date label for the snapshot (e.g. '2026-06-15'). */
  snapshotDate: string
  /** Latest week's committed delta as % of approved total. */
  weekDeltaPct: number
  /** Trailing-4-week average delta. */
  averageWeeklyPct: number
  /** Latest snapshot's percent-committed. */
  percentCommitted: number
  /** Dollar exposure (committed minus approved, floored at zero). */
  exposureDollars: number
}

export function buildVarianceEnvelope(inputs: VarianceInputs): InsightEnvelope {
  const severity = varianceSeverity(inputs.percentCommitted)
  const accelMultiple =
    inputs.averageWeeklyPct > 0
      ? (inputs.weekDeltaPct / inputs.averageWeeklyPct).toFixed(1)
      : 'n/a'
  return {
    kind: 'variance',
    actionType: 'rfi.draft', // stand-in until 'change_order.draft' lands
    title: `Budget variance accelerating: ${inputs.percentCommitted.toFixed(0)}% committed`,
    summary: `Weekly commit delta jumped to ${inputs.weekDeltaPct.toFixed(1)}% (vs ${inputs.averageWeeklyPct.toFixed(1)}% trailing 4-week avg, ${accelMultiple}× acceleration). Project is ${inputs.percentCommitted.toFixed(0)}% committed against the approved budget.`,
    reason: 'variance-detector: weekly commit delta ≥ 2× trailing average AND ≥ 60% committed',
    severity,
    confidence: 0.78,
    primaryEntityType: 'budget_snapshot',
    primaryEntityId: inputs.snapshotId,
    payload: {
      title: `Variance review for week of ${inputs.snapshotDate}`,
      description: `Iris flagged accelerating budget variance: weekly commit grew ${inputs.weekDeltaPct.toFixed(1)}% (${accelMultiple}× the 4-week average). Drafting an RFI to surface the change-order chain or scope creep before exposure compounds.`,
      priority: severity === 'critical' ? 'critical' : 'high',
      insightKind: 'variance',
      exposureDollars: inputs.exposureDollars,
    },
    citations: [
      {
        kind: 'budget_line',
        label: `Week of ${inputs.snapshotDate}`,
        ref: inputs.snapshotId,
      },
      {
        kind: 'budget_line',
        label: `Trailing 4-week average`,
        ref: `${inputs.snapshotId}-trailing4`,
      },
    ],
  }
}

// ── Staffing ────────────────────────────────────────────────────────

/**
 * Staffing severity:
 *   no crew checked in  → critical
 *   shortfall ≥ 50%     → high
 *   else                → medium (below floor)
 */
export function staffingSeverity(
  scheduledHours: number,
  availableHours: number,
): InsightSeverity {
  if (availableHours === 0) return 'critical'
  const ratio = scheduledHours > 0 ? availableHours / scheduledHours : 1
  if (ratio < 0.5) return 'high'
  return 'medium'
}

export interface StaffingInputs {
  /** Project-level synthetic id ('staffing-<project>-<isoDate>'). */
  syntheticEntityId: string
  todayIso: string // YYYY-MM-DD
  scheduledHours: number
  availableHours: number
  exampleActivityId?: string
  exampleActivityName?: string
}

export function buildStaffingEnvelope(inputs: StaffingInputs): InsightEnvelope {
  const severity = staffingSeverity(inputs.scheduledHours, inputs.availableHours)
  const shortfall = Math.max(0, inputs.scheduledHours - inputs.availableHours)
  const example = inputs.exampleActivityName
    ? ` (e.g. "${inputs.exampleActivityName}")`
    : ''
  return {
    kind: 'staffing',
    actionType: 'rfi.draft',
    title: `Crew shortfall: ${shortfall.toFixed(0)}h gap today`,
    summary: `Today's schedule needs ${inputs.scheduledHours.toFixed(0)}h${example} but only ${inputs.availableHours.toFixed(0)}h are checked in. Shortfall: ${shortfall.toFixed(0)}h.`,
    reason:
      inputs.availableHours === 0
        ? 'staffing-detector: zero crew check-ins for active activities today'
        : 'staffing-detector: crew availability < 50% of scheduled hours',
    severity,
    confidence: 0.72,
    primaryEntityType: 'staffing_day',
    primaryEntityId: inputs.syntheticEntityId,
    payload: {
      title: `Crew gap for ${inputs.todayIso}`,
      description: `Iris noticed a staffing gap on ${inputs.todayIso}: ${inputs.scheduledHours.toFixed(0)}h scheduled${example}, ${inputs.availableHours.toFixed(0)}h checked in. Drafting an RFI to flag the trade-loading risk to the GC superintendent.`,
      priority: severity === 'critical' ? 'critical' : 'high',
      insightKind: 'staffing',
      shortfallHours: shortfall,
    },
    citations: inputs.exampleActivityId
      ? [
          {
            kind: 'schedule_phase',
            label: `Active activity: ${inputs.exampleActivityName ?? inputs.exampleActivityId}`,
            ref: inputs.exampleActivityId,
          },
          {
            kind: 'daily_log_excerpt',
            label: `Crew check-ins for ${inputs.todayIso}`,
            ref: inputs.syntheticEntityId,
          },
        ]
      : [
          {
            kind: 'daily_log_excerpt',
            label: `Crew check-ins for ${inputs.todayIso}`,
            ref: inputs.syntheticEntityId,
          },
        ],
  }
}

// ── Weather ─────────────────────────────────────────────────────────

/**
 * Weather severity: keyed on bad-day count in the horizon.
 *   ≥ 3 bad days = high
 *   else         = medium (below floor)
 */
export function weatherSeverity(badDayCount: number): InsightSeverity {
  if (badDayCount >= 3) return 'high'
  return 'medium'
}

export interface WeatherInputs {
  /** Stable id ('weather-<project>-<firstBadDate>-<lastBadDate>'). */
  syntheticEntityId: string
  conditionsLabel: string
  badDayCount: number
  outdoorActivityCount: number
  exampleActivityId?: string
  exampleActivityName?: string
  firstBadDate: string
  lastBadDate: string
}

export function buildWeatherEnvelope(inputs: WeatherInputs): InsightEnvelope {
  const severity = weatherSeverity(inputs.badDayCount)
  const example = inputs.exampleActivityName
    ? `, e.g. "${inputs.exampleActivityName}"`
    : ''
  return {
    kind: 'weather',
    actionType: 'schedule.resequence',
    title: `Weather collision: ${inputs.badDayCount} bad-weather day${inputs.badDayCount === 1 ? '' : 's'} ahead`,
    summary: `Forecast shows ${inputs.conditionsLabel} on ${inputs.badDayCount} day${inputs.badDayCount === 1 ? '' : 's'} between ${inputs.firstBadDate} and ${inputs.lastBadDate}. ${inputs.outdoorActivityCount} outdoor activit${inputs.outdoorActivityCount === 1 ? 'y' : 'ies'} scheduled in that window${example}.`,
    reason: 'weather-detector: rain/storm forecast in 3-day horizon overlaps outdoor activity',
    severity,
    confidence: 0.75,
    primaryEntityType: 'weather_window',
    primaryEntityId: inputs.syntheticEntityId,
    payload: {
      title: `Resequence outdoor work around ${inputs.conditionsLabel}`,
      description: `Iris noticed ${inputs.badDayCount} day${inputs.badDayCount === 1 ? '' : 's'} of ${inputs.conditionsLabel} forecast between ${inputs.firstBadDate} and ${inputs.lastBadDate}, with ${inputs.outdoorActivityCount} outdoor activit${inputs.outdoorActivityCount === 1 ? 'y' : 'ies'} scheduled${example}. Drafting a schedule resequence to move at-risk work indoors or earlier.`,
      priority: severity === 'high' ? 'high' : 'medium',
      insightKind: 'weather',
      parallelize_pairs: [], // schedule.resequence payload contract; filled by user
      days_recovered: inputs.badDayCount,
    },
    citations: inputs.exampleActivityId
      ? [
          {
            kind: 'schedule_phase',
            label: `Outdoor activity: ${inputs.exampleActivityName ?? inputs.exampleActivityId}`,
            ref: inputs.exampleActivityId,
          },
        ]
      : [],
  }
}
