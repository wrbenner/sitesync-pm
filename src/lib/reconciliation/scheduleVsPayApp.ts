/**
 * Schedule-vs-PayApp Reconciliation.
 *
 * Cross-checks two independent sources of project progress: the schedule
 * (CPM activities with % complete) and the pay app SOV (line-item % complete).
 * If a sub bills 80% on the foundation but the activity is only 40% complete
 * per the superintendent, that's a variance — flag it before money moves.
 *
 * Pure function: deterministic, no I/O. Inputs are paired by `costCode` (the
 * canonical join key — every SOV line and every activity has one in our
 * schema). Tolerance is configurable; default ±5% percent-complete.
 */

export interface ScheduleActivityInput {
  /** Activity id from the schedule (P6 / MSP / WBS). */
  id: string;
  /** Cost code shared with the SOV — the join key. */
  costCode: string;
  name: string;
  /** Reported % complete from the schedule (0–100). */
  pctComplete: number;
}

export interface PayAppLineInput {
  id: string;
  costCode: string;
  description: string;
  scheduledValue: number;
  /** Reported % complete on the pay app (0–100). */
  pctComplete: number;
}

export type VarianceSeverity = 'ok' | 'minor' | 'material' | 'critical';

export interface ReconciliationLine {
  costCode: string;
  description: string;
  /** Schedule % (or null when no matching activity). */
  schedulePct: number | null;
  /** Pay-app % (or null when no matching SOV line). */
  payAppPct: number | null;
  /** Pay-app reported value at this line, in dollars. */
  scheduledValue: number;
  /** Variance = payAppPct − schedulePct, in percentage points. */
  variancePct: number | null;
  severity: VarianceSeverity;
  /** Human-readable reason for the severity (UI tooltip). */
  reason: string;
  blocked: boolean;
}

export interface ReconciliationReport {
  lines: ReconciliationLine[];
  /** Sum of pay-app SOV $ that's at material or critical variance. */
  blockedDollarsAtRisk: number;
  /** True iff any line is blocked → pay-app submission should be gated. */
  isBlocked: boolean;
  /** Snapshot of the threshold actually applied. */
  appliedTolerancePct: number;
  /** Pure-function as-of date (ISO) for traceability. */
  asOfDate: string;
}

export interface ReconciliationOptions {
  /** Variance ≥ this is "minor" (default 5pp). */
  minorTolerancePct?: number;
  /** Variance ≥ this is "material" → blocks unless overridden (default 10pp). */
  materialTolerancePct?: number;
  /** Variance ≥ this is "critical" → blocks always (default 20pp). */
  criticalTolerancePct?: number;
  asOfDate?: string;
}

/**
 * Reconcile pay-app SOV lines vs schedule activities. Joins on `costCode`
 * (case-insensitive, trimmed). Returns one row per unique cost code; if a
 * cost code is in only one source, it appears with `null` on the other side.
 */
export function reconcileScheduleVsPayApp(
  payAppLines: PayAppLineInput[],
  scheduleActivities: ScheduleActivityInput[],
  options: ReconciliationOptions = {},
): ReconciliationReport {
  const minor = options.minorTolerancePct ?? 5;
  const material = options.materialTolerancePct ?? 10;
  const critical = options.criticalTolerancePct ?? 20;
  const asOf = options.asOfDate ?? '1970-01-01';

  // Index activities by cost code (lowercase, trimmed). Multiple activities
  // sharing a cost code → average their % complete (weighted equally).
  const actByCode = new Map<string, ScheduleActivityInput[]>();
  for (const a of scheduleActivities) {
    const key = normalize(a.costCode);
    if (!key) continue;
    const list = actByCode.get(key) ?? [];
    list.push(a);
    actByCode.set(key, list);
  }

  const seenCodes = new Set<string>();
  const out: ReconciliationLine[] = [];

  for (const li of payAppLines) {
    const key = normalize(li.costCode);
    seenCodes.add(key);
    const acts = actByCode.get(key);
    const schedulePct = acts && acts.length > 0
      ? avg(acts.map(a => clampPct(a.pctComplete)))
      : null;
    const payPct = clampPct(li.pctComplete);
    const variance = schedulePct == null ? null : payPct - schedulePct;
    const { severity, reason, blocked } = classify(
      variance,
      schedulePct,
      payPct,
      { minor, material, critical },
    );
    out.push({
      costCode: li.costCode,
      description: li.description,
      schedulePct,
      payAppPct: payPct,
      scheduledValue: li.scheduledValue,
      variancePct: variance,
      severity,
      reason,
      blocked,
    });
  }

  // Activities with no SOV line — surface as "schedule-only" rows.
  for (const [key, acts] of actByCode.entries()) {
    if (seenCodes.has(key)) continue;
    const schedulePct = avg(acts.map(a => clampPct(a.pctComplete)));
    out.push({
      costCode: acts[0].costCode,
      description: acts[0].name,
      schedulePct,
      payAppPct: null,
      scheduledValue: 0,
      variancePct: null,
      severity: 'minor',
      reason: 'Schedule activity has no matching pay-app SOV line.',
      blocked: false,
    });
  }

  const blockedDollarsAtRisk = out
    .filter(r => r.blocked)
    .reduce((s, r) => s + r.scheduledValue, 0);

  return {
    lines: out,
    blockedDollarsAtRisk,
    isBlocked: out.some(r => r.blocked),
    appliedTolerancePct: material,
    asOfDate: asOf,
  };
}

// ── helpers ──────────────────────────────────────────────────

function classify(
  variance: number | null,
  schedulePct: number | null,
  payPct: number,
  thresholds: { minor: number; material: number; critical: number },
): { severity: VarianceSeverity; reason: string; blocked: boolean } {
  if (variance == null || schedulePct == null) {
    if (payPct > 0) {
      return {
        severity: 'material',
        reason: 'Pay-app line has no matching schedule activity.',
        blocked: true,
      };
    }
    return {
      severity: 'ok',
      reason: 'Pay-app line not yet started; no schedule match required.',
      blocked: false,
    };
  }
  const abs = Math.abs(variance);
  if (abs >= thresholds.critical) {
    return {
      severity: 'critical',
      reason: `${variance > 0 ? 'Over' : 'Under'}-billed by ${abs.toFixed(1)}pp vs schedule.`,
      blocked: true,
    };
  }
  if (abs >= thresholds.material) {
    return {
      severity: 'material',
      reason: `${variance > 0 ? 'Over' : 'Under'}-billed by ${abs.toFixed(1)}pp vs schedule.`,
      blocked: true,
    };
  }
  if (abs >= thresholds.minor) {
    return {
      severity: 'minor',
      reason: `${abs.toFixed(1)}pp variance vs schedule (within tolerance).`,
      blocked: false,
    };
  }
  return {
    severity: 'ok',
    reason: 'Schedule and pay-app agree within tolerance.',
    blocked: false,
  };
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
