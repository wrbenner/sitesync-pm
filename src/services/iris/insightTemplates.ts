// ─────────────────────────────────────────────────────────────────────────────
// Iris Insight templates — narrative builders for proactive risk detection.
// ─────────────────────────────────────────────────────────────────────────────
// Each template turns a structured detector context into the human-readable
// fields surfaced on a Risk card: a one-line headline and an impact-chain
// array. Iris brand wraps these strings in the UI; the math itself is
// deterministic and lives in insights.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface CascadeContext {
  submittalNumber: string;
  submittalTitle: string;
  activityName: string;
  daysToBaseline: number;
  scheduleSlipDays: number;
}

export interface AgingContext {
  rfiNumber: string;
  rfiTitle: string;
  daysOverdue: number;
  activityName: string;
  estimatedSlipDays: number;
}

export interface VarianceContext {
  weekDeltaPct: number;          // this week's delta as % of approved
  averageWeeklyPct: number;      // four-week trailing avg
  percentCommitted: number;      // 0..100
  exposureDollars: number;
}

export interface StaffingContext {
  trade: string;
  scheduledHours: number;
  availableHours: number;
  shortfallHours: number;
}

export interface WeatherContext {
  conditionsLabel: string;       // e.g. "Rain / Thunderstorm"
  dayCount: number;
  outdoorActivityCount: number;
  exampleActivity: string | null;
}

// ── Cascade ──────────────────────────────────────────────────────────────────

export function cascadeHeadline(ctx: CascadeContext): string {
  return `${ctx.submittalTitle} delay risks ${ctx.activityName}`;
}

export function cascadeChain(ctx: CascadeContext): string[] {
  const chain = [`Submittal ${ctx.submittalNumber} not approved`];
  chain.push('Fabrication can’t start');
  chain.push(`${ctx.activityName} due in ${ctx.daysToBaseline}d`);
  if (ctx.scheduleSlipDays > 0) {
    chain.push(`Slip +${ctx.scheduleSlipDays}d`);
  }
  return chain;
}

// ── Aging ────────────────────────────────────────────────────────────────────

export function agingHeadline(ctx: AgingContext): string {
  return `RFI ${ctx.rfiNumber} stalling ${ctx.activityName}`;
}

export function agingChain(ctx: AgingContext): string[] {
  return [
    `${ctx.rfiTitle} unanswered ${ctx.daysOverdue}d`,
    `${ctx.activityName} on critical path`,
    `Slip +${ctx.estimatedSlipDays}d if not closed`,
  ];
}

// ── Budget variance ──────────────────────────────────────────────────────────

export function varianceHeadline(ctx: VarianceContext): string {
  const factor = ctx.averageWeeklyPct > 0
    ? (ctx.weekDeltaPct / ctx.averageWeeklyPct).toFixed(1)
    : '—';
  return `Spend ${factor}× weekly average — trending toward overrun`;
}

export function varianceChain(ctx: VarianceContext): string[] {
  return [
    `Committed ${ctx.percentCommitted.toFixed(0)}% of approved`,
    `This week +${ctx.weekDeltaPct.toFixed(1)}%`,
    `Avg ${ctx.averageWeeklyPct.toFixed(1)}%/week`,
    `Exposure $${ctx.exposureDollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
  ];
}

// ── Staffing ─────────────────────────────────────────────────────────────────

export function staffingHeadline(ctx: StaffingContext): string {
  return `${ctx.trade} understaffed for today`;
}

export function staffingChain(ctx: StaffingContext): string[] {
  const pct = ctx.scheduledHours > 0
    ? Math.round((ctx.availableHours / ctx.scheduledHours) * 100)
    : 0;
  return [
    `Need ${ctx.scheduledHours}h ${ctx.trade} today`,
    `On site ${ctx.availableHours}h (${pct}%)`,
    `Shortfall ${ctx.shortfallHours}h`,
  ];
}

// ── Weather ──────────────────────────────────────────────────────────────────

export function weatherHeadline(ctx: WeatherContext): string {
  return `${ctx.conditionsLabel} ${ctx.dayCount}d — ${ctx.outdoorActivityCount} outdoor activit${ctx.outdoorActivityCount === 1 ? 'y' : 'ies'} at risk`;
}

export function weatherChain(ctx: WeatherContext): string[] {
  const chain = [`${ctx.conditionsLabel} forecast next ${ctx.dayCount}d`];
  if (ctx.exampleActivity) {
    chain.push(`${ctx.exampleActivity} affected`);
  }
  if (ctx.outdoorActivityCount > 1) {
    chain.push(`+${ctx.outdoorActivityCount - 1} other outdoor task${ctx.outdoorActivityCount === 2 ? '' : 's'}`);
  }
  chain.push('Reschedule or expedite indoor work');
  return chain;
}
