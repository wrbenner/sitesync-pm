// ─────────────────────────────────────────────────────────────────────────────
// Iris Phase 4 — Proactive risk detection.
// ─────────────────────────────────────────────────────────────────────────────
// Pure, deterministic detectors. Each takes structured inputs and emits zero
// or more IrisInsights. The aggregator runs them all, dedupes by stable id,
// and sorts by severity → estimatedImpact.dollars desc → scheduleDays desc.
//
// "Iris" is the brand wrapper on the OUTPUT — no LLM calls happen here. The
// React Query hook in src/hooks/useIrisInsights.ts pulls data from existing
// project queries and feeds it into runInsights().
// ─────────────────────────────────────────────────────────────────────────────

import type { SourceReference } from '../../types/stream';
import {
  cascadeChain,
  cascadeHeadline,
  agingChain,
  agingHeadline,
  varianceChain,
  varianceHeadline,
  staffingChain,
  staffingHeadline,
  weatherChain,
  weatherHeadline,
} from './insightTemplates';

// ── Output shape ─────────────────────────────────────────────────────────────

export type IrisInsightKind = 'cascade' | 'aging' | 'variance' | 'staffing' | 'weather';
export type IrisInsightSeverity = 'critical' | 'high' | 'medium';

export interface IrisInsight {
  id: string;
  kind: IrisInsightKind;
  severity: IrisInsightSeverity;
  headline: string;
  impactChain: string[];
  sourceTrail: SourceReference[];
  estimatedImpact?: { dollars?: number; scheduleDays?: number };
  detectedAt: string;
}

// ── Input shapes ─────────────────────────────────────────────────────────────
// Detectors accept narrow, denormalized input. The hook adapts whatever the
// project queries return into these shapes.

export interface SubmittalRow {
  id: string;
  number?: string | number | null;
  title?: string | null;
  status?: string | null;
  linked_activity_id?: string | null;
  linked_activity_name?: string | null;
}

export interface ScheduleRow {
  id: string;
  name: string;
  baseline_end?: string | null;
  end_date?: string | null;
  is_critical_path?: boolean | null;
  float_days?: number | null;
  outdoor_activity?: boolean | null;
  start_date?: string | null;
  trade?: string | null;
  required_hours_today?: number | null;
}

export interface RfiRow {
  id: string;
  number?: string | number | null;
  title?: string | null;
  due_date?: string | null;
  status?: string | null;
  schedule_impact_days?: number | null;
  linked_activity_id?: string | null;
}

export interface BudgetWeekSnapshot {
  weekStart: string;        // YYYY-MM-DD (Monday)
  committed: number;        // dollars committed at end of week
  approvedTotal: number;    // dollars approved at end of week
}

export interface WorkforceCheckIn {
  trade: string;
  hoursAvailable: number;   // sum of scheduled crew hours actually present
}

export interface WeatherDayForecast {
  date: string;             // YYYY-MM-DD
  conditions: string;       // "Clear" | "Rain" | "Snow" | …
}

export interface InsightsInput {
  projectId: string;
  now: Date;
  submittals: SubmittalRow[];
  schedule: ScheduleRow[];
  rfis: RfiRow[];
  budgetWeekly: BudgetWeekSnapshot[];
  workforce: WorkforceCheckIn[];
  weatherForecast: WeatherDayForecast[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const RAIN_RE = /rain|thunderstorm|storm|snow/i;

function daysBetween(fromIso: string | null | undefined, to: Date): number {
  if (!fromIso) return Infinity;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.round((t - to.getTime()) / MS_PER_DAY);
}

function daysPast(fromIso: string | null | undefined, now: Date): number {
  if (!fromIso) return 0;
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_DAY));
}

function isAtRiskOrRejected(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'rejected' || s === 'revise_resubmit' || s === 'revise_and_resubmit' || s === 'at_risk' || s === 'overdue';
}

function isOpenRfi(status: string | null | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return s !== 'answered' && s !== 'closed' && s !== 'void' && s !== 'voided';
}

// ── 1. Submittal cascades to milestone ──────────────────────────────────────

export function detectCascades(input: InsightsInput, withinDays = 21): IrisInsight[] {
  const activityById = new Map<string, ScheduleRow>();
  for (const a of input.schedule) activityById.set(a.id, a);

  const out: IrisInsight[] = [];
  for (const sub of input.submittals) {
    if (!isAtRiskOrRejected(sub.status)) continue;
    if (!sub.linked_activity_id) continue;
    const activity = activityById.get(sub.linked_activity_id);
    if (!activity) continue;
    const baselineIso = activity.baseline_end ?? activity.end_date ?? null;
    const daysToBaseline = daysBetween(baselineIso, input.now);
    if (!Number.isFinite(daysToBaseline) || daysToBaseline > withinDays || daysToBaseline < 0) continue;

    // Slip estimate: if the activity has float, assume the worst-case is
    // float-burned-down to zero plus the leftover delay. Without explicit
    // submittal-impact data, fall back to "≥ 5 days" as the headline figure.
    const floatDays = Math.max(0, Number(activity.float_days ?? 0));
    const baseSlip = sub.status?.toLowerCase() === 'rejected' ? 10 : 5;
    const slip = Math.max(0, baseSlip - floatDays);

    const submittalNumber = String(sub.number ?? sub.id);
    const submittalTitle = sub.title ?? `Submittal ${submittalNumber}`;
    const ctx = {
      submittalNumber,
      submittalTitle,
      activityName: activity.name,
      daysToBaseline,
      scheduleSlipDays: slip,
    };
    out.push({
      id: `cascade-${input.projectId}-${sub.id}`,
      kind: 'cascade',
      severity: activity.is_critical_path ? 'critical' : daysToBaseline <= 7 ? 'high' : 'medium',
      headline: cascadeHeadline(ctx),
      impactChain: cascadeChain(ctx),
      sourceTrail: [
        { type: 'submittal', id: sub.id, title: `Submittal ${submittalNumber}`, url: `/submittals/${sub.id}` },
        { type: 'schedule_activity', id: activity.id, title: activity.name, url: `/schedule?activity=${activity.id}` },
      ],
      estimatedImpact: { scheduleDays: slip },
      detectedAt: input.now.toISOString(),
    });
  }
  return out;
}

// ── 2. RFI aging on critical path ────────────────────────────────────────────

export function detectAgingRfis(input: InsightsInput): IrisInsight[] {
  const activityById = new Map<string, ScheduleRow>();
  for (const a of input.schedule) activityById.set(a.id, a);

  const out: IrisInsight[] = [];
  for (const rfi of input.rfis) {
    if (!isOpenRfi(rfi.status)) continue;
    const overdue = daysPast(rfi.due_date, input.now);
    if (overdue < 5) continue;
    const activityId = rfi.linked_activity_id ?? null;
    if (!activityId) continue;
    const activity = activityById.get(activityId);
    if (!activity || activity.is_critical_path !== true) continue;

    const slipFromField = Number(rfi.schedule_impact_days ?? 0);
    const inferredSlip = Math.max(0, overdue - Math.max(0, Number(activity.float_days ?? 0)));
    const slip = slipFromField > 0 ? slipFromField : inferredSlip;

    const rfiNumber = String(rfi.number ?? rfi.id);
    const rfiTitle = rfi.title ?? `RFI ${rfiNumber}`;
    const ctx = {
      rfiNumber,
      rfiTitle,
      daysOverdue: overdue,
      activityName: activity.name,
      estimatedSlipDays: slip,
    };
    out.push({
      id: `aging-${input.projectId}-${rfi.id}`,
      kind: 'aging',
      severity: slip >= 10 ? 'critical' : slip >= 5 ? 'high' : 'medium',
      headline: agingHeadline(ctx),
      impactChain: agingChain(ctx),
      sourceTrail: [
        { type: 'rfi', id: rfi.id, title: `RFI ${rfiNumber}`, url: `/rfis/${rfi.id}` },
        { type: 'schedule_activity', id: activity.id, title: activity.name, url: `/schedule?activity=${activity.id}` },
      ],
      estimatedImpact: { scheduleDays: slip },
      detectedAt: input.now.toISOString(),
    });
  }
  return out;
}

// ── 3. Budget variance acceleration ─────────────────────────────────────────

export function detectVarianceAcceleration(input: InsightsInput): IrisInsight[] {
  const sorted = [...input.budgetWeekly].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  if (sorted.length < 5) return [];
  const latest = sorted[sorted.length - 1];
  const trailing = sorted.slice(-5, -1); // four weeks before latest

  const weekDeltas = sorted.slice(1).map((wk, i) => {
    const prev = sorted[i];
    if (prev.approvedTotal <= 0) return 0;
    return ((wk.committed - prev.committed) / prev.approvedTotal) * 100;
  });

  const latestDelta = weekDeltas[weekDeltas.length - 1] ?? 0;
  const trailingDeltas = weekDeltas.slice(-5, -1);
  if (trailingDeltas.length === 0) return [];
  const avgTrailing = trailingDeltas.reduce((a, b) => a + b, 0) / trailingDeltas.length;

  const percentCommitted = latest.approvedTotal > 0
    ? (latest.committed / latest.approvedTotal) * 100
    : 0;

  const accelerationFactor = avgTrailing > 0 ? latestDelta / avgTrailing : 0;
  if (accelerationFactor < 2) return [];
  if (percentCommitted < 60) return [];

  const exposure = Math.max(0, latest.committed - latest.approvedTotal);
  const ctx = {
    weekDeltaPct: latestDelta,
    averageWeeklyPct: avgTrailing,
    percentCommitted,
    exposureDollars: exposure,
  };

  return [
    {
      id: `variance-${input.projectId}-${latest.weekStart}`,
      kind: 'variance',
      severity: percentCommitted >= 100 ? 'critical' : percentCommitted >= 90 ? 'high' : 'medium',
      headline: varianceHeadline(ctx),
      impactChain: varianceChain(ctx),
      sourceTrail: [
        { type: 'budget_line', id: `week-${latest.weekStart}`, title: `Week of ${latest.weekStart}`, url: '/budget' },
        ...(trailing[0]
          ? [{ type: 'budget_line' as const, id: `week-${trailing[0].weekStart}`, title: `Trailing 4-week avg`, url: '/budget' }]
          : []),
      ],
      estimatedImpact: { dollars: Math.max(exposure, latest.committed * (latestDelta / 100)) },
      detectedAt: input.now.toISOString(),
    },
  ];
}

// ── 4. Crew vs lookahead mismatch ────────────────────────────────────────────

export function detectStaffing(input: InsightsInput): IrisInsight[] {
  const todayIso = input.now.toISOString().slice(0, 10);
  const tradeRequired = new Map<string, { hours: number; sample: string | null }>();
  for (const a of input.schedule) {
    const start = a.start_date ?? '';
    const end = a.end_date ?? '';
    if (start && start > todayIso) continue;
    if (end && end < todayIso) continue;
    const required = Number(a.required_hours_today ?? 0);
    if (required <= 0) continue;
    const trade = a.trade ?? 'Unassigned';
    const cur = tradeRequired.get(trade) ?? { hours: 0, sample: null };
    cur.hours += required;
    if (!cur.sample) cur.sample = a.name;
    tradeRequired.set(trade, cur);
  }

  const tradeAvailable = new Map<string, number>();
  for (const w of input.workforce) {
    tradeAvailable.set(w.trade, (tradeAvailable.get(w.trade) ?? 0) + Number(w.hoursAvailable ?? 0));
  }

  const out: IrisInsight[] = [];
  for (const [trade, { hours: scheduled, sample }] of tradeRequired) {
    const available = tradeAvailable.get(trade) ?? 0;
    if (scheduled <= 0) continue;
    if (available >= scheduled * 0.5) continue;
    const shortfall = Math.max(0, scheduled - available);
    const ctx = {
      trade,
      scheduledHours: Math.round(scheduled),
      availableHours: Math.round(available),
      shortfallHours: Math.round(shortfall),
    };
    out.push({
      id: `staffing-${input.projectId}-${todayIso}-${trade}`,
      kind: 'staffing',
      severity: available === 0 ? 'critical' : 'high',
      headline: staffingHeadline(ctx),
      impactChain: staffingChain(ctx),
      sourceTrail: [
        { type: 'schedule_activity', id: `today-${trade}`, title: sample ?? `${trade} today`, url: '/schedule' },
      ],
      estimatedImpact: { scheduleDays: shortfall >= scheduled * 0.75 ? 1 : 0 },
      detectedAt: input.now.toISOString(),
    });
  }
  return out;
}

// ── 5. Weather vs outdoor activity ──────────────────────────────────────────

export function detectWeatherCollision(input: InsightsInput, horizonDays = 3): IrisInsight[] {
  const todayIso = input.now.toISOString().slice(0, 10);
  const horizonIso = new Date(input.now.getTime() + horizonDays * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

  const badDays = input.weatherForecast.filter(
    (d) => d.date >= todayIso && d.date <= horizonIso && RAIN_RE.test(d.conditions),
  );
  if (badDays.length === 0) return [];

  const outdoor = input.schedule.filter((a) => {
    if (a.outdoor_activity !== true) return false;
    const start = a.start_date ?? '';
    const end = a.end_date ?? todayIso;
    if (end < todayIso) return false;
    if (start > horizonIso) return false;
    return true;
  });
  if (outdoor.length === 0) return [];

  const conditionsLabel = Array.from(new Set(badDays.map((d) => d.conditions))).slice(0, 2).join(' / ');
  const exampleActivity = outdoor[0]?.name ?? null;
  const ctx = {
    conditionsLabel,
    dayCount: badDays.length,
    outdoorActivityCount: outdoor.length,
    exampleActivity,
  };
  return [
    {
      id: `weather-${input.projectId}-${badDays[0].date}-${badDays[badDays.length - 1].date}`,
      kind: 'weather',
      severity: badDays.length >= 3 ? 'high' : 'medium',
      headline: weatherHeadline(ctx),
      impactChain: weatherChain(ctx),
      sourceTrail: outdoor.slice(0, 3).map((a) => ({
        type: 'schedule_activity' as const,
        id: a.id,
        title: a.name,
        url: `/schedule?activity=${a.id}`,
      })),
      estimatedImpact: { scheduleDays: badDays.length },
      detectedAt: input.now.toISOString(),
    },
  ];
}

// ── Aggregator ───────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<IrisInsightSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

export function dedupeInsights(insights: IrisInsight[]): IrisInsight[] {
  const seen = new Map<string, IrisInsight>();
  for (const ins of insights) {
    if (!seen.has(ins.id)) seen.set(ins.id, ins);
  }
  return Array.from(seen.values());
}

export function sortInsights(insights: IrisInsight[]): IrisInsight[] {
  return [...insights].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const aDollars = a.estimatedImpact?.dollars ?? 0;
    const bDollars = b.estimatedImpact?.dollars ?? 0;
    if (aDollars !== bDollars) return bDollars - aDollars;
    const aDays = a.estimatedImpact?.scheduleDays ?? 0;
    const bDays = b.estimatedImpact?.scheduleDays ?? 0;
    if (aDays !== bDays) return bDays - aDays;
    return a.id.localeCompare(b.id);
  });
}

export function runInsights(input: InsightsInput): IrisInsight[] {
  const all = [
    ...detectCascades(input),
    ...detectAgingRfis(input),
    ...detectVarianceAcceleration(input),
    ...detectStaffing(input),
    ...detectWeatherCollision(input),
  ];
  return sortInsights(dedupeInsights(all));
}
