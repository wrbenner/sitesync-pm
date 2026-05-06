// ── Schedule Health Engine ───────────────────────────────────────────────────
// Proactive schedule quality analysis — the kind of intelligence that makes
// construction managers trust a tool. Inspired by PMI scheduling best practices
// and real CM rejection criteria for subcontractor schedules.
//
// Detects: open ends, negative float, out-of-sequence progress, dangling
// activities, unreasonable durations, logic density, missing predecessors,
// and critical-path concentration risk.
//
// Returns a scored HealthReport with actionable findings and fix suggestions.

import type { MappedSchedulePhase } from '../types/entities';

// ── Types ───────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info';

export type FindingCategory =
  | 'open-end'
  | 'negative-float'
  | 'out-of-sequence'
  | 'dangling'
  | 'duration-anomaly'
  | 'logic-density'
  | 'missing-predecessor'
  | 'critical-concentration'
  | 'constraint-conflict'
  | 'near-critical';

export interface HealthFinding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
  affectedTaskIds: string[];
  /** 0–100 deduction from the overall score this finding causes */
  scoreImpact: number;
}

export interface HealthReport {
  /** 0–100 overall schedule health score */
  score: number;
  /** A/B/C/D/F letter grade */
  grade: string;
  /** Short narrative summary */
  summary: string;
  /** Individual findings sorted by severity then impact */
  findings: HealthFinding[];
  /** Counts by severity */
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  /** Timestamp of analysis */
  analyzedAt: string;
  /** Metrics used in scoring */
  metrics: HealthMetrics;
}

export interface HealthMetrics {
  totalActivities: number;
  activitiesWithPredecessors: number;
  activitiesWithSuccessors: number;
  logicDensityPct: number;
  criticalPathPct: number;
  avgFloatDays: number;
  openStartCount: number;
  openFinishCount: number;
  negativeFloatCount: number;
  outOfSequenceCount: number;
  danglingCount: number;
  durationAnomalyCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ── Main Analysis Function ──────────────────────────────────────────────────

export function analyzeScheduleHealth(phases: MappedSchedulePhase[]): HealthReport {
  if (phases.length === 0) {
    return emptyReport();
  }

  const findings: HealthFinding[] = [];

  // Build adjacency lookups
  const allIds = new Set(phases.map(p => p.id));
  const predecessorMap = new Map<string, string[]>(); // taskId → [predecessor IDs]
  const successorMap = new Map<string, string[]>();   // taskId → [successor IDs]

  for (const p of phases) {
    const preds = (p.predecessorIds ?? p.predecessor_ids ?? []).filter(id => allIds.has(id));
    predecessorMap.set(p.id, preds);
    for (const pred of preds) {
      if (!successorMap.has(pred)) successorMap.set(pred, []);
      successorMap.get(pred)!.push(p.id);
    }
  }

  // ── 1. Open Ends ──────────────────────────────────────────────────────────
  // Tasks without predecessors (open starts) or without successors (open finishes)
  // Milestones at project start/end are exempted

  const sortedByStart = [...phases].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const sortedByEnd = [...phases].sort(
    (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
  );
  const earliestStart = sortedByStart[0]?.startDate;
  const latestEnd = sortedByEnd[0]?.endDate;

  const openStarts: string[] = [];
  const openFinishes: string[] = [];

  for (const p of phases) {
    const preds = predecessorMap.get(p.id) ?? [];
    const succs = successorMap.get(p.id) ?? [];


    // Open start: no predecessors and not the project start
    if (preds.length === 0 && p.startDate !== earliestStart) {
      openStarts.push(p.id);
    }

    // Open finish: no successors and not the project end
    if (succs.length === 0 && p.endDate !== latestEnd) {
      openFinishes.push(p.id);
    }
  }

  if (openStarts.length > 0) {
    findings.push({
      id: uid(),
      category: 'open-end',
      severity: openStarts.length > 3 ? 'critical' : 'warning',
      title: `${openStarts.length} activit${openStarts.length === 1 ? 'y' : 'ies'} missing predecessors`,
      description: `These activities have no logical predecessors, meaning they could start at any time regardless of project sequencing. This breaks CPM logic and weakens the schedule's integrity.`,
      suggestion: `Add predecessor links to connect these activities to the logical work sequence. Ask: "What must finish before this can start?"`,
      affectedTaskIds: openStarts,
      scoreImpact: Math.min(25, openStarts.length * 3),
    });
  }

  if (openFinishes.length > 0) {
    findings.push({
      id: uid(),
      category: 'open-end',
      severity: openFinishes.length > 3 ? 'critical' : 'warning',
      title: `${openFinishes.length} activit${openFinishes.length === 1 ? 'y' : 'ies'} missing successors`,
      description: `These activities have no logical successors. If they slip, the schedule won't reflect the downstream impact. CMs commonly reject schedules with open finishes.`,
      suggestion: `Add successor links or connect them to a project milestone. Ask: "What depends on this finishing?"`,
      affectedTaskIds: openFinishes,
      scoreImpact: Math.min(25, openFinishes.length * 3),
    });
  }

  // ── 2. Negative Float ─────────────────────────────────────────────────────
  const negativeFloatTasks = phases.filter(p => (p.floatDays ?? 0) < 0);
  if (negativeFloatTasks.length > 0) {
    findings.push({
      id: uid(),
      category: 'negative-float',
      severity: 'critical',
      title: `${negativeFloatTasks.length} activit${negativeFloatTasks.length === 1 ? 'y' : 'ies'} with negative float`,
      description: `Negative float means the schedule cannot meet its constraints — the math says these activities need to start before their predecessors finish. This typically indicates constraint conflicts or an impossible deadline.`,
      suggestion: `Review date constraints on these activities. Remove "Must Finish By" constraints or extend the project deadline. Consider fast-tracking or crashing the critical path.`,
      affectedTaskIds: negativeFloatTasks.map(p => p.id),
      scoreImpact: Math.min(30, negativeFloatTasks.length * 5),
    });
  }

  // ── 3. Out-of-Sequence Progress ───────────────────────────────────────────
  // Activities that have started but their predecessors aren't complete
  const outOfSequence: string[] = [];
  for (const p of phases) {
    const progress = p.progress ?? 0;
    if (progress <= 0) continue;

    const preds = predecessorMap.get(p.id) ?? [];
    for (const predId of preds) {
      const pred = phases.find(ph => ph.id === predId);
      if (pred && (pred.progress ?? 0) < 100 && pred.status !== 'completed') {
        outOfSequence.push(p.id);
        break;
      }
    }
  }

  if (outOfSequence.length > 0) {
    findings.push({
      id: uid(),
      category: 'out-of-sequence',
      severity: outOfSequence.length > 5 ? 'critical' : 'warning',
      title: `${outOfSequence.length} activit${outOfSequence.length === 1 ? 'y' : 'ies'} progressing out of sequence`,
      description: `These activities have reported progress, but their predecessors are not yet complete. This violates the logic network and may indicate the schedule doesn't reflect actual field conditions.`,
      suggestion: `Either update predecessor progress to reflect reality, or revise the logic links (e.g., change FS to SS if partial overlap is acceptable).`,
      affectedTaskIds: outOfSequence,
      scoreImpact: Math.min(20, outOfSequence.length * 2),
    });
  }

  // ── 4. Dangling Activities ────────────────────────────────────────────────
  // Activities not logically connected to any other activity (no preds AND no succs)
  const dangling: string[] = [];
  for (const p of phases) {
    const preds = predecessorMap.get(p.id) ?? [];
    const succs = successorMap.get(p.id) ?? [];
    if (preds.length === 0 && succs.length === 0 && phases.length > 1) {
      dangling.push(p.id);
    }
  }

  if (dangling.length > 0) {
    findings.push({
      id: uid(),
      category: 'dangling',
      severity: dangling.length > 2 ? 'critical' : 'warning',
      title: `${dangling.length} completely disconnected activit${dangling.length === 1 ? 'y' : 'ies'}`,
      description: `These activities have zero logic ties — no predecessors and no successors. They float independently of the schedule and cannot drive or be driven by the critical path.`,
      suggestion: `Connect each activity to the schedule network. Every activity should answer: "What comes before me?" and "What comes after me?"`,
      affectedTaskIds: dangling,
      scoreImpact: Math.min(20, dangling.length * 4),
    });
  }

  // ── 5. Duration Anomalies ─────────────────────────────────────────────────
  // Unreasonably long or short durations
  const durations = phases
    .filter(p => !p.isMilestone && p.startDate !== p.endDate)
    .map(p => ({
      id: p.id,
      days: daysBetween(p.startDate, p.endDate),
    }));

  if (durations.length > 3) {


    const anomalies: string[] = [];

    for (const d of durations) {
      // Flag durations that are > 60 working days (about 3 months) or suspiciously short (< 1 day)
      if (d.days > 60) {
        anomalies.push(d.id);
      } else if (d.days < 1 && d.days !== 0) {
        anomalies.push(d.id);
      }
    }

    if (anomalies.length > 0) {
      findings.push({
        id: uid(),
        category: 'duration-anomaly',
        severity: 'warning',
        title: `${anomalies.length} activit${anomalies.length === 1 ? 'y has' : 'ies have'} unusual duration`,
        description: `Activities longer than 60 days should typically be broken into smaller, measurable tasks. Very short durations may indicate missing scope. Construction best practice keeps activities between 5–20 working days.`,
        suggestion: `Break long activities into 2–4 week segments. Verify short activities aren't missing work scope.`,
        affectedTaskIds: anomalies,
        scoreImpact: Math.min(10, anomalies.length * 2),
      });
    }
  }

  // ── 6. Logic Density ──────────────────────────────────────────────────────
  // A healthy schedule has at least 1.5 links per activity on average
  const totalLinks = phases.reduce((sum, p) => sum + (predecessorMap.get(p.id)?.length ?? 0), 0);
  const logicDensity = phases.length > 0 ? totalLinks / phases.length : 0;

  if (logicDensity < 1.0 && phases.length > 5) {
    findings.push({
      id: uid(),
      category: 'logic-density',
      severity: logicDensity < 0.5 ? 'critical' : 'warning',
      title: `Low logic density: ${logicDensity.toFixed(1)} links per activity`,
      description: `A well-connected schedule typically has 1.5+ links per activity. Low density means changes won't properly ripple through the schedule, reducing its value as a planning tool. Current: ${totalLinks} links across ${phases.length} activities.`,
      suggestion: `Review the schedule from start to finish. For each activity, ensure at least one predecessor and one successor exist. Target 1.5–2.0 links per activity.`,
      affectedTaskIds: [],
      scoreImpact: Math.min(20, Math.round((1.0 - logicDensity) * 20)),
    });
  }

  // ── 7. Critical Path Concentration ────────────────────────────────────────
  // If > 50% of activities are on the critical path, the schedule lacks flexibility
  const criticalCount = phases.filter(p => p.critical || p.is_critical || p.is_critical_path).length;
  const criticalPct = phases.length > 0 ? (criticalCount / phases.length) * 100 : 0;

  if (criticalPct > 50 && phases.length > 5) {
    findings.push({
      id: uid(),
      category: 'critical-concentration',
      severity: criticalPct > 70 ? 'critical' : 'warning',
      title: `${Math.round(criticalPct)}% of activities on critical path`,
      description: `When most activities are critical, the schedule has almost no flexibility. Any single delay cascades to the project end date. This often indicates missing parallel paths or overly sequential logic.`,
      suggestion: `Look for opportunities to parallelize work (e.g., SS or FF relationships). Add float buffers between independent work streams. Consider if some constraints are artificially tight.`,
      affectedTaskIds: phases.filter(p => p.critical || p.is_critical || p.is_critical_path).map(p => p.id),
      scoreImpact: Math.min(15, Math.round((criticalPct - 50) / 3)),
    });
  }

  // ── 8. Near-Critical Activities ───────────────────────────────────────────
  // Activities with very low float (1–3 days) that could easily become critical
  const nearCritical = phases.filter(p => {
    const float = p.floatDays ?? 0;
    return float > 0 && float <= 3 && !(p.critical || p.is_critical || p.is_critical_path);
  });

  if (nearCritical.length > 0) {
    findings.push({
      id: uid(),
      category: 'near-critical',
      severity: 'info',
      title: `${nearCritical.length} near-critical activit${nearCritical.length === 1 ? 'y' : 'ies'} (≤3 days float)`,
      description: `These activities are close to becoming critical. A small delay could push them onto the critical path and extend the project. They deserve extra monitoring.`,
      suggestion: `Monitor these activities closely. Consider adding resources or parallel crews to protect them. Flag them in lookahead meetings.`,
      affectedTaskIds: nearCritical.map(p => p.id),
      scoreImpact: Math.min(5, nearCritical.length),
    });
  }

  // ── Calculate Score ───────────────────────────────────────────────────────
  const totalDeduction = findings.reduce((sum, f) => sum + f.scoreImpact, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeduction));
  const grade = scoreToGrade(score);

  // ── Build Metrics ─────────────────────────────────────────────────────────
  const activitiesWithPredecessors = phases.filter(p => (predecessorMap.get(p.id)?.length ?? 0) > 0).length;
  const activitiesWithSuccessors = phases.filter(p => (successorMap.get(p.id)?.length ?? 0) > 0).length;
  const avgFloat = phases.length > 0
    ? phases.reduce((sum, p) => sum + (p.floatDays ?? 0), 0) / phases.length
    : 0;

  const metrics: HealthMetrics = {
    totalActivities: phases.length,
    activitiesWithPredecessors,
    activitiesWithSuccessors,
    logicDensityPct: Math.round(logicDensity * 100) / 100,
    criticalPathPct: Math.round(criticalPct),
    avgFloatDays: Math.round(avgFloat * 10) / 10,
    openStartCount: openStarts.length,
    openFinishCount: openFinishes.length,
    negativeFloatCount: negativeFloatTasks.length,
    outOfSequenceCount: outOfSequence.length,
    danglingCount: dangling.length,
    durationAnomalyCount: durations.filter(d => d.days > 60 || (d.days < 1 && d.days !== 0)).length,
  };

  // ── Sort findings: critical first, then warning, then info ────────────
  const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.scoreImpact - a.scoreImpact;
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = buildSummary(score, grade, findings, metrics);

  return {
    score,
    grade,
    summary,
    findings,
    criticalCount: findings.filter(f => f.severity === 'critical').length,
    warningCount: findings.filter(f => f.severity === 'warning').length,
    infoCount: findings.filter(f => f.severity === 'info').length,
    analyzedAt: new Date().toISOString(),
    metrics,
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildSummary(
  score: number,
  _grade: string,
  findings: HealthFinding[],
  metrics: HealthMetrics
): string {
  const critCount = findings.filter(f => f.severity === 'critical').length;
  const warnCount = findings.filter(f => f.severity === 'warning').length;

  if (score >= 90) {
    return `Schedule is in excellent condition. ${metrics.totalActivities} activities with strong logic density (${metrics.logicDensityPct} links/activity). ${warnCount > 0 ? `${warnCount} minor item${warnCount === 1 ? '' : 's'} to review.` : 'No issues detected.'}`;
  }
  if (score >= 75) {
    return `Schedule is solid but has room for improvement. ${critCount > 0 ? `${critCount} critical issue${critCount === 1 ? '' : 's'} should be addressed before the next update.` : ''} ${warnCount} warning${warnCount === 1 ? '' : 's'} identified across ${metrics.totalActivities} activities.`;
  }
  if (score >= 60) {
    return `Schedule needs attention. ${critCount} critical issue${critCount === 1 ? '' : 's'} and ${warnCount} warning${warnCount === 1 ? '' : 's'} were found. Logic density is ${metrics.logicDensityPct < 1 ? 'below target' : 'adequate'}. Address critical findings before submitting for review.`;
  }
  return `Schedule has significant quality issues. ${critCount} critical finding${critCount === 1 ? '' : 's'} undermine the schedule's reliability. Focus on connecting open ends and improving logic density (currently ${metrics.logicDensityPct} links/activity, target ≥1.5).`;
}

// ── Empty Report ────────────────────────────────────────────────────────────

function emptyReport(): HealthReport {
  return {
    score: 100,
    grade: 'A',
    summary: 'No activities to analyze.',
    findings: [],
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    analyzedAt: new Date().toISOString(),
    metrics: {
      totalActivities: 0,
      activitiesWithPredecessors: 0,
      activitiesWithSuccessors: 0,
      logicDensityPct: 0,
      criticalPathPct: 0,
      avgFloatDays: 0,
      openStartCount: 0,
      openFinishCount: 0,
      negativeFloatCount: 0,
      outOfSequenceCount: 0,
      danglingCount: 0,
      durationAnomalyCount: 0,
    },
  };
}
