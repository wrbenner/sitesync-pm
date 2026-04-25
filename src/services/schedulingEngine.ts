/**
 * Working Days Scheduling Engine
 *
 * Pure calculation functions for working-day arithmetic, inspired by OpenProject.
 * No Supabase or external dependencies — deterministic, testable logic only.
 */

// ── Types ────────────────────────────────────────────────

export interface WorkingDaysConfig {
  /** Seven booleans indexed 0–6 where 0 = Sunday, 1 = Monday … 6 = Saturday.
   *  Default Mon–Fri working week: [false, true, true, true, true, true, false] */
  workingWeekDays: boolean[];
  /** Set of 'YYYY-MM-DD' strings representing non-working days (holidays, etc.) */
  nonWorkingDays: Set<string>;
}

// ── Helpers ──────────────────────────────────────────────

/** Format a Date to 'YYYY-MM-DD' without timezone drift (uses UTC). */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Clone a Date so mutations don't leak. */
function cloneDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Return a default Mon–Fri config with no holidays. */
export function defaultWorkingDaysConfig(): WorkingDaysConfig {
  return {
    // Index: Sun Mon Tue Wed Thu Fri Sat
    workingWeekDays: [false, true, true, true, true, true, false],
    nonWorkingDays: new Set(),
  };
}

// ── Core Functions ───────────────────────────────────────

/**
 * Determine whether a given date is a working day.
 */
export function isWorkingDay(date: Date, config: WorkingDaysConfig): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sun … 6 = Sat
  if (!config.workingWeekDays[dayOfWeek]) return false;
  if (config.nonWorkingDays.has(toDateString(date))) return false;
  return true;
}

/**
 * Count the number of working days between two dates (inclusive of both endpoints).
 * If startDate > endDate the result is 0.
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  config: WorkingDaysConfig,
): number {
  if (startDate > endDate) return 0;
  let count = 0;
  const cursor = cloneDate(startDate);
  const end = cloneDate(endDate);
  while (cursor <= end) {
    if (isWorkingDay(cursor, config)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Starting from `startDate`, advance forward by `days` working days and return
 * the resulting date.  `startDate` itself is counted if it is a working day.
 *
 * addWorkingDays(monday, 1, config) === monday  (the first working day is the start)
 * addWorkingDays(monday, 2, config) === tuesday
 *
 * If days <= 0 the startDate is returned as-is.
 */
export function addWorkingDays(
  startDate: Date,
  days: number,
  config: WorkingDaysConfig,
): Date {
  if (days <= 0) return cloneDate(startDate);
  const cursor = cloneDate(startDate);
  let remaining = days;
  while (remaining > 0) {
    if (isWorkingDay(cursor, config)) {
      remaining--;
      if (remaining === 0) return cursor;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  // Should not reach here, but just in case:
  return cursor;
}

/**
 * Starting from `endDate`, go backward by `days` working days and return the
 * resulting date.  `endDate` itself is counted if it is a working day.
 *
 * If days <= 0 the endDate is returned as-is.
 */
export function subtractWorkingDays(
  endDate: Date,
  days: number,
  config: WorkingDaysConfig,
): Date {
  if (days <= 0) return cloneDate(endDate);
  const cursor = cloneDate(endDate);
  let remaining = days;
  while (remaining > 0) {
    if (isWorkingDay(cursor, config)) {
      remaining--;
      if (remaining === 0) return cursor;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return cursor;
}

/**
 * Return the soonest working day on or after `date`.
 * If `date` is already a working day it is returned unchanged.
 */
export function soonestWorkingDay(date: Date, config: WorkingDaysConfig): Date {
  const cursor = cloneDate(date);
  // Safety: cap at 365 iterations to prevent infinite loops from misconfigured weeks
  for (let i = 0; i < 365; i++) {
    if (isWorkingDay(cursor, config)) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  // Fallback — every day of the week is non-working (bad config)
  return cloneDate(date);
}

/**
 * Calculate the end date for a task given a start date and duration in working days.
 * Duration is inclusive: a 1-day task starts and ends on the same working day.
 */
export function calculateEndDate(
  startDate: Date,
  durationWorkingDays: number,
  config: WorkingDaysConfig,
): Date {
  const start = soonestWorkingDay(startDate, config);
  return addWorkingDays(start, durationWorkingDays, config);
}

/**
 * Calculate a successor task's start date based on a predecessor's end date,
 * a relation type, and a lag in working days.
 *
 * Only 'follows' / 'finish_to_start' is handled — other relation types return
 * undefined because they don't constrain a start date in the same way.
 */
export function calculateFollowerStartDate(
  predecessorEndDate: Date,
  lagDays: number,
  config: WorkingDaysConfig,
): Date {
  // The successor starts the next working day after the predecessor ends, plus lag
  const dayAfter = cloneDate(predecessorEndDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const nextWorking = soonestWorkingDay(dayAfter, config);
  if (lagDays <= 0) return nextWorking;
  // Add lag working days (lag of 1 means skip one additional working day)
  return addWorkingDays(nextWorking, lagDays + 1, config);
}
