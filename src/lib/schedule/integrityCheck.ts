/**
 * Schedule integrity checker.
 *
 * Pure analyzer over an array of activities + their predecessor links. Looks
 * for the canonical CPM logic-quality issues:
 *
 *   - open_start         no predecessor (other than the project start milestone)
 *   - open_finish        no successor (other than the project finish milestone)
 *   - negative_float     total float < 0 ⇒ behind-schedule constraint conflict
 *   - constraint_conflict  Must Finish On / Must Start On where the date
 *                          can't be met given the predecessor logic
 *   - orphan             activity with no links in either direction
 *
 * Status mapping:
 *   - unanalyzed   no activities, OR no predecessor/successor metadata at all
 *                  (we can't say "broken" if we never saw the logic)
 *   - healthy      score >= 90
 *   - watch        70 <= score < 90
 *   - broken       score < 70
 *
 * Score formula: 100 − (issues weighted by severity / activity count × 100),
 * clamped to [0, 100].
 *
 * Pure: no I/O, no Date.now(). Pass `asOfDate` if you need it for context.
 */

export interface ActivityInput {
  id: string;
  name: string;
  /** Predecessor activity ids — empty array means "no predecessors". */
  predecessorIds?: string[];
  /** Successor activity ids — optional, derived from predecessors when absent. */
  successorIds?: string[];
  /** Total float (days). Negative means behind-schedule constraint conflict. */
  totalFloatDays?: number | null;
  /** Schedule constraint type. */
  constraintType?:
    | 'as_soon_as_possible'
    | 'must_start_on'
    | 'must_finish_on'
    | 'start_no_earlier_than'
    | 'finish_no_later_than'
    | null;
  /** Constraint date (ISO) — paired with constraintType. */
  constraintDate?: string | null;
  /** Computed early-finish (ISO) — used only for constraint reconciliation. */
  earlyFinishDate?: string | null;
  /** Marks the conventional project start/finish milestones. */
  isProjectStart?: boolean;
  isProjectFinish?: boolean;
}

export type IntegrityIssueType =
  | 'open_start'
  | 'open_finish'
  | 'negative_float'
  | 'constraint_conflict'
  | 'orphan';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IntegrityIssue {
  activityId: string;
  activityName: string;
  type: IntegrityIssueType;
  severity: IssueSeverity;
  message: string;
  suggestedFix: string;
}

export type IntegrityStatus = 'unanalyzed' | 'healthy' | 'watch' | 'broken';

export interface IntegrityReport {
  issues: IntegrityIssue[];
  /** 0 (broken) to 100 (perfect). */
  score: number;
  status: IntegrityStatus;
  countsByType: Record<IntegrityIssueType, number>;
  /** Number of activities analyzed. */
  activityCount: number;
}

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  low: 1,
  medium: 3,
  high: 8,
  critical: 16,
};

/**
 * Analyze a schedule's logic quality. Pure, deterministic.
 */
export function integrityCheck(
  activities: ActivityInput[],
): IntegrityReport {
  const empty = (
    countsByType: Record<IntegrityIssueType, number>,
  ): IntegrityReport => ({
    issues: [],
    score: 0,
    status: 'unanalyzed',
    countsByType,
    activityCount: activities.length,
  });

  const zeroCounts: Record<IntegrityIssueType, number> = {
    open_start: 0,
    open_finish: 0,
    negative_float: 0,
    constraint_conflict: 0,
    orphan: 0,
  };

  if (activities.length === 0) return empty(zeroCounts);

  // Unanalyzed when NO activity carries any link metadata. We can't claim
  // "broken" before we've seen the logic — that's punitive.
  const hasAnyLinkMetadata = activities.some(a => {
    const preds = a.predecessorIds ?? null;
    const succs = a.successorIds ?? null;
    return (preds && preds.length > 0) || (succs && succs.length > 0);
  });
  if (!hasAnyLinkMetadata) return empty(zeroCounts);

  // Build successor index from predecessors when not supplied directly.
  const successorIndex = new Map<string, string[]>();
  for (const a of activities) {
    if (a.successorIds) {
      successorIndex.set(a.id, [...a.successorIds]);
    }
  }
  for (const a of activities) {
    for (const pid of a.predecessorIds ?? []) {
      const list = successorIndex.get(pid) ?? [];
      if (!list.includes(a.id)) list.push(a.id);
      successorIndex.set(pid, list);
    }
  }

  const issues: IntegrityIssue[] = [];
  const counts: Record<IntegrityIssueType, number> = { ...zeroCounts };

  for (const a of activities) {
    const preds = a.predecessorIds ?? [];
    const succs = successorIndex.get(a.id) ?? [];

    // Orphan: no links in either direction (and not a project endpoint).
    if (
      preds.length === 0 &&
      succs.length === 0 &&
      !a.isProjectStart &&
      !a.isProjectFinish
    ) {
      issues.push({
        activityId: a.id,
        activityName: a.name,
        type: 'orphan',
        severity: 'high',
        message: `${a.name} has no predecessors or successors.`,
        suggestedFix: 'Tie this activity to its driving predecessor and a downstream successor.',
      });
      counts.orphan += 1;
      continue;
    }

    // Open start: no predecessor on a non-start activity.
    if (preds.length === 0 && !a.isProjectStart) {
      issues.push({
        activityId: a.id,
        activityName: a.name,
        type: 'open_start',
        severity: 'medium',
        message: `${a.name} has no predecessor — the schedule has an open start.`,
        suggestedFix: 'Add a predecessor logic tie (FS, SS, or to project-start milestone).',
      });
      counts.open_start += 1;
    }

    // Open finish: no successor on a non-finish activity.
    if (succs.length === 0 && !a.isProjectFinish) {
      issues.push({
        activityId: a.id,
        activityName: a.name,
        type: 'open_finish',
        severity: 'medium',
        message: `${a.name} has no successor — the schedule has an open finish.`,
        suggestedFix: 'Tie this activity to a downstream successor or the project-finish milestone.',
      });
      counts.open_finish += 1;
    }

    // Negative float: schedule cannot meet constraint.
    if (typeof a.totalFloatDays === 'number' && a.totalFloatDays < 0) {
      issues.push({
        activityId: a.id,
        activityName: a.name,
        type: 'negative_float',
        severity: 'critical',
        message: `${a.name} has ${a.totalFloatDays} days of float (negative).`,
        suggestedFix: 'Compress duration, add resources, or relax the constraint driving this path.',
      });
      counts.negative_float += 1;
    }

    // Constraint conflict: a hard constraint cannot be satisfied by upstream logic.
    if (
      a.constraintType === 'must_finish_on' &&
      a.constraintDate &&
      a.earlyFinishDate
    ) {
      const must = new Date(a.constraintDate).getTime();
      const ef = new Date(a.earlyFinishDate).getTime();
      if (Number.isFinite(must) && Number.isFinite(ef) && ef > must) {
        issues.push({
          activityId: a.id,
          activityName: a.name,
          type: 'constraint_conflict',
          severity: 'high',
          message: `${a.name} must finish on ${a.constraintDate} but earliest finish is ${a.earlyFinishDate}.`,
          suggestedFix: 'Relax the must-finish-on constraint or shorten the predecessor chain.',
        });
        counts.constraint_conflict += 1;
      }
    }
  }

  // Score: each issue weighted by severity, normalized over activity count.
  const totalWeight = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0);
  const denom = Math.max(1, activities.length);
  const rawPenalty = (totalWeight / denom) * 8;
  const score = Math.max(0, Math.min(100, Math.round(100 - rawPenalty)));

  let status: IntegrityStatus;
  if (score >= 90) status = 'healthy';
  else if (score >= 70) status = 'watch';
  else status = 'broken';

  return {
    issues,
    score,
    status,
    countsByType: counts,
    activityCount: activities.length,
  };
}
