/**
 * Progress Tracking Engine
 *
 * Pure calculation functions for work-based progress derivation, parent rollups,
 * and schedule health indicators.  Inspired by OpenProject's progress model.
 * No Supabase or external dependencies.
 */

// ── Types ────────────────────────────────────────────────

export interface DerivedProgress {
  estimated_hours?: number | null;
  remaining_hours?: number | null;
  percent_complete?: number | null;
}

export interface ChildProgress {
  estimated_hours: number | null;
  remaining_hours: number | null;
}

export type ScheduleHealth = 'on_track' | 'at_risk' | 'behind' | 'complete';

// ── Work-based Progress Derivation ──────────────────────

/**
 * Given any two of the three progress values, derive the third.
 *
 * Rules (matching OpenProject's work-based mode):
 *   - If estimated_hours and remaining_hours are known → percent_complete = ((est - rem) / est) * 100
 *   - If estimated_hours and percent_complete are known → remaining_hours = est * (1 - pct/100)
 *   - If remaining_hours and percent_complete are known → estimated_hours = rem / (1 - pct/100)
 *
 * Returns only the field(s) that were derivable.  Callers can merge the result
 * into the task record.
 */
export function deriveProgress(
  estimatedHours: number | null,
  remainingHours: number | null,
  percentComplete: number | null,
): DerivedProgress {
  const result: DerivedProgress = {};

  const hasEst = estimatedHours != null && estimatedHours >= 0;
  const hasRem = remainingHours != null && remainingHours >= 0;
  const hasPct = percentComplete != null && percentComplete >= 0 && percentComplete <= 100;

  if (hasEst && hasRem && !hasPct) {
    // Derive percent_complete
    if (estimatedHours! === 0) {
      result.percent_complete = remainingHours === 0 ? 100 : 0;
    } else {
      const done = estimatedHours! - remainingHours!;
      result.percent_complete = Math.max(0, Math.min(100, Math.round((done / estimatedHours!) * 100)));
    }
  } else if (hasEst && hasPct && !hasRem) {
    // Derive remaining_hours
    result.remaining_hours = Math.max(0, Math.round(estimatedHours! * (1 - percentComplete! / 100) * 100) / 100);
  } else if (hasRem && hasPct && !hasEst) {
    // Derive estimated_hours
    if (percentComplete! >= 100) {
      // 100 % complete and some remaining → estimated = remaining (edge case)
      result.estimated_hours = remainingHours!;
    } else {
      result.estimated_hours = Math.round((remainingHours! / (1 - percentComplete! / 100)) * 100) / 100;
    }
  }

  return result;
}

// ── Parent Task Rollup ──────────────────────────────────

/**
 * Derive a parent task's percent_complete as a work-weighted average of its
 * children.  Children without estimated_hours are excluded from the calculation.
 *
 * Formula:
 *   total_work = sum(child.estimated_hours)
 *   total_remaining = sum(child.remaining_hours ?? child.estimated_hours)
 *   percent_complete = ((total_work - total_remaining) / total_work) * 100
 *
 * Returns null if no children have estimated_hours.
 */
export function deriveParentProgress(
  children: ChildProgress[],
): number | null {
  let totalWork = 0;
  let totalRemaining = 0;
  let hasData = false;

  for (const child of children) {
    if (child.estimated_hours == null || child.estimated_hours <= 0) continue;
    hasData = true;
    totalWork += child.estimated_hours;
    // If remaining is not set, assume no work done → remaining = estimated
    totalRemaining += child.remaining_hours != null ? child.remaining_hours : child.estimated_hours;
  }

  if (!hasData || totalWork === 0) return null;

  const done = totalWork - totalRemaining;
  return Math.max(0, Math.min(100, Math.round((done / totalWork) * 100)));
}

// ── Schedule Health ─────────────────────────────────────

/**
 * Determine the health of a task's schedule relative to the current date.
 *
 * - 'complete'  — percent_complete === 100
 * - 'behind'    — end_date is in the past and not complete
 * - 'at_risk'   — end_date is within 3 days and progress < expected linear progress
 * - 'on_track'  — everything else
 */
export function getScheduleHealth(task: {
  start_date: string | null;
  end_date: string | null;
  percent_complete: number | null;
}): ScheduleHealth {
  const pct = task.percent_complete ?? 0;

  if (pct >= 100) return 'complete';

  if (!task.end_date) return 'on_track';

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(task.end_date);
  end.setHours(0, 0, 0, 0);

  // Past due
  if (now > end) return 'behind';

  // Check if at risk: end date within 3 calendar days AND behind expected linear progress
  const daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilEnd <= 3 && task.start_date) {
    const start = new Date(task.start_date);
    start.setHours(0, 0, 0, 0);
    const totalDuration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const expectedProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    if (pct < expectedProgress) return 'at_risk';
  }

  return 'on_track';
}

/**
 * Return a human-readable label and color hint for a schedule health value.
 */
export function getScheduleHealthDisplay(health: ScheduleHealth): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
} {
  switch (health) {
    case 'on_track':
      return { label: 'On Track', color: 'green' };
    case 'at_risk':
      return { label: 'At Risk', color: 'yellow' };
    case 'behind':
      return { label: 'Behind', color: 'red' };
    case 'complete':
      return { label: 'Complete', color: 'blue' };
  }
}
