// ── SLA calculator ──────────────────────────────────────────────────────────
// Single source of truth for "where is this RFI on its response clock?"
// Used by:
//   • SlaTimer.tsx  — colored pill in the Conversation inbox
//   • sla-escalator edge function — decides when to fire each ladder stage
//   • RFI detail status banners
//
// Inputs:
//   • dueDate: the contractual response_due_date (ISO date string)
//   • now: optional override for testing
//   • holidays: per-project holiday calendar (ISO date strings, no time)
//   • paused_at: if non-null, the clock has been frozen as of this time;
//     paused_total_seconds is the sum of prior pauses already applied to
//     dueDate by the migration trigger (or by the resume call).
//
// Convention: weekends are always excluded. Holidays passed in are also
// excluded. Day boundaries are interpreted in the project's local time
// — but since we don't yet track project tz, all calculations are in UTC,
// which is fine for ±1 day; adopt a project_tz column when contracts go
// timezone-strict.

export type SlaStage =
  | 'unknown'      // no due date set
  | 'paused'       // SLA clock manually paused
  | 'on_track'     // > 2 business days remain
  | 'nudge'        // ≤ 2 business days remain (T-2 zone)
  | 'overdue'      // 0 .. +2 days past due
  | 'overdue_cc'   // +3 .. +6 days past due (CC manager territory)
  | 'delay_risk';  // +7 days or more past due

export interface SlaState {
  stage: SlaStage;
  /** Positive when due_date is in the future; negative when overdue. */
  businessDaysRemaining: number | null;
  /** Always positive when overdue, 0 otherwise. */
  businessDaysOverdue: number;
  /** Short label for chips: "5d left", "Due today", "2d overdue", "Paused". */
  label: string;
  /** Semantic color name: 'neutral'|'warn'|'danger'|'paused'|'unknown'. */
  color: 'neutral' | 'warn' | 'danger' | 'paused' | 'unknown';
}

export interface SlaInput {
  dueDate: string | null | undefined;
  now?: Date;
  holidays?: ReadonlyArray<string>;
  pausedAt?: string | null;
  /** Accumulated pause seconds already baked into the due_date. */
  pausedTotalSeconds?: number;
}

/** True for Sat/Sun. UTC-based — see file comment. */
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Inclusive count of business days from `from` to `to`. If `to` is before
 * `from`, returns a negative count.
 *
 * Excludes weekends and any holidays in the calendar set.
 */
export function businessDaysBetween(
  from: Date,
  to: Date,
  holidays: ReadonlySet<string> | ReadonlyArray<string> = new Set(),
): number {
  const holidaySet =
    holidays instanceof Set ? (holidays as ReadonlySet<string>) : new Set<string>(holidays as ReadonlyArray<string>);

  const sign = to.getTime() < from.getTime() ? -1 : 1;
  const start = sign === 1 ? new Date(from) : new Date(to);
  const end = sign === 1 ? new Date(to) : new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  let count = 0;
  const cursor = new Date(start);
  // We count days strictly *after* the start day to mirror "days remaining"
  // semantics — same day = 0 days remaining, not 1.
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWeekend(cursor)) continue;
    if (holidaySet.has(toIsoDate(cursor))) continue;
    count += 1;
  }
  return sign === 1 ? count : -count;
}

/**
 * Compute SLA state for an RFI/Submittal/CO/Punch given its due date.
 *
 * Stage thresholds (response window in business days):
 *   ≥ 3 days remaining:  on_track
 *   ≤ 2 days remaining:  nudge   (T-2 zone)
 *   0 .. 2 overdue:      overdue
 *   3 .. 6 overdue:      overdue_cc
 *   ≥ 7 overdue:         delay_risk
 *
 * Paused state is detected first and short-circuits the rest.
 */
export function calculateSlaState(input: SlaInput): SlaState {
  const now = input.now ?? new Date();

  if (input.pausedAt) {
    return {
      stage: 'paused',
      businessDaysRemaining: null,
      businessDaysOverdue: 0,
      label: 'Paused',
      color: 'paused',
    };
  }

  if (!input.dueDate) {
    return {
      stage: 'unknown',
      businessDaysRemaining: null,
      businessDaysOverdue: 0,
      label: 'No SLA',
      color: 'unknown',
    };
  }

  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) {
    return {
      stage: 'unknown',
      businessDaysRemaining: null,
      businessDaysOverdue: 0,
      label: 'No SLA',
      color: 'unknown',
    };
  }

  const remaining = businessDaysBetween(now, due, input.holidays ?? []);

  if (remaining >= 3) {
    return {
      stage: 'on_track',
      businessDaysRemaining: remaining,
      businessDaysOverdue: 0,
      label: `${remaining}d left`,
      color: 'neutral',
    };
  }
  if (remaining >= 1) {
    return {
      stage: 'nudge',
      businessDaysRemaining: remaining,
      businessDaysOverdue: 0,
      label: `${remaining}d left`,
      color: 'warn',
    };
  }
  if (remaining === 0) {
    return {
      stage: 'nudge',
      businessDaysRemaining: 0,
      businessDaysOverdue: 0,
      label: 'Due today',
      color: 'warn',
    };
  }

  const overdue = -remaining;
  if (overdue <= 2) {
    return {
      stage: 'overdue',
      businessDaysRemaining: remaining,
      businessDaysOverdue: overdue,
      label: `${overdue}d overdue`,
      color: 'danger',
    };
  }
  if (overdue <= 6) {
    return {
      stage: 'overdue_cc',
      businessDaysRemaining: remaining,
      businessDaysOverdue: overdue,
      label: `${overdue}d overdue · escalated`,
      color: 'danger',
    };
  }
  return {
    stage: 'delay_risk',
    businessDaysRemaining: remaining,
    businessDaysOverdue: overdue,
    label: `${overdue}d · delay risk`,
    color: 'danger',
  };
}

/**
 * Comparator for "most-broken-first" sort. Sorts by stage severity, then
 * by business-days-overdue descending. Use as the default sort in the
 * Conversation inbox.
 */
export function compareSlaStateMostBrokenFirst(a: SlaState, b: SlaState): number {
  const order: Record<SlaStage, number> = {
    delay_risk: 0,
    overdue_cc: 1,
    overdue: 2,
    nudge: 3,
    on_track: 4,
    paused: 5,
    unknown: 6,
  };
  const oa = order[a.stage];
  const ob = order[b.stage];
  if (oa !== ob) return oa - ob;
  // Within the same stage: most overdue first; then fewest days remaining.
  if (a.businessDaysOverdue !== b.businessDaysOverdue) {
    return b.businessDaysOverdue - a.businessDaysOverdue;
  }
  const ra = a.businessDaysRemaining ?? Number.POSITIVE_INFINITY;
  const rb = b.businessDaysRemaining ?? Number.POSITIVE_INFINITY;
  return ra - rb;
}

/**
 * Map the SLA stage to the next escalation ladder rung that should fire.
 * Used by the edge function:
 *   • nudge       → t_minus_2
 *   • overdue     → overdue_first
 *   • overdue_cc  → cc_manager
 *   • delay_risk  → delay_risk
 * Returns null when no ladder action is due (on_track / paused / unknown).
 */
export function ladderStageForSla(stage: SlaStage): null | 't_minus_2' | 'overdue_first' | 'cc_manager' | 'delay_risk' {
  switch (stage) {
    case 'nudge':
      return 't_minus_2';
    case 'overdue':
      return 'overdue_first';
    case 'overdue_cc':
      return 'cc_manager';
    case 'delay_risk':
      return 'delay_risk';
    default:
      return null;
  }
}
