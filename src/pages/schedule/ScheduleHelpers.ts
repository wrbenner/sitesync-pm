import type { SchedulePhase } from '../../stores/scheduleStore';

const TRADE_KEYWORDS: Array<{ trade: string; keywords: string[] }> = [
  { trade: 'Concrete', keywords: ['concrete', 'foundation', 'slab', 'footing'] },
  { trade: 'Structural', keywords: ['steel', 'structural', 'frame', 'erection'] },
  { trade: 'Masonry', keywords: ['masonry', 'cmu', 'brick', 'block'] },
  { trade: 'Roofing', keywords: ['roof', 'membrane', 'tpo'] },
  { trade: 'Mechanical', keywords: ['hvac', 'mechanical', 'duct'] },
  { trade: 'Electrical', keywords: ['electrical', 'lighting', 'power'] },
  { trade: 'Plumbing', keywords: ['plumbing', 'piping', 'water', 'sewer'] },
  { trade: 'Drywall', keywords: ['drywall', 'gypsum', 'frame interior'] },
  { trade: 'Finishes', keywords: ['paint', 'finish', 'flooring', 'carpet', 'tile'] },
  { trade: 'Sitework', keywords: ['sitework', 'grading', 'excavation', 'paving', 'utilities'] },
  { trade: 'Exterior', keywords: ['exterior', 'cladding', 'storefront', 'glazing', 'window'] },
  { trade: 'Closeout', keywords: ['punch', 'turnover', 'closeout', 'commissioning'] },
];

export function tradeFor(phase: Pick<SchedulePhase, 'name'>): string {
  const name = (phase.name ?? '').toLowerCase();
  for (const { trade, keywords } of TRADE_KEYWORDS) {
    if (keywords.some((k) => name.includes(k))) return trade;
  }
  return '—';
}

export function isMilestone(phase: SchedulePhase): boolean {
  if (phase.is_milestone === true || phase.isMilestone === true) return true;
  return !!phase.start_date && phase.start_date === phase.end_date;
}

// Days behind = max(0, today − expected-by-percent-complete-end). Uses the
// activity's actual span and how far through it we are by the calendar.
export function daysBehind(phase: SchedulePhase): number {
  const start = phase.start_date ? new Date(phase.start_date).getTime() : null;
  const end = phase.end_date ? new Date(phase.end_date).getTime() : null;
  if (!start || !end || end <= start) return 0;
  const now = Date.now();
  if (now < start) return 0;
  const span = end - start;
  const elapsed = Math.min(span, now - start);
  const expectedPct = (elapsed / span) * 100;
  const actualPct = Number(phase.percent_complete ?? phase.progress ?? 0);
  if (actualPct >= expectedPct) return 0;
  const lagPct = expectedPct - actualPct;
  const lagDays = Math.round((lagPct / 100) * (span / 86_400_000));
  return Math.max(0, lagDays);
}

export function isBehind(phase: SchedulePhase): boolean {
  if (phase.status === 'delayed') return true;
  return daysBehind(phase) > 0;
}

export interface ScheduleRange {
  start: number;
  end: number;
  spanMs: number;
}

export function scheduleRange(phases: SchedulePhase[]): ScheduleRange | null {
  const startTimes = phases
    .map((p) => (p.start_date ? new Date(p.start_date).getTime() : NaN))
    .filter((n) => Number.isFinite(n));
  const endTimes = phases
    .map((p) => (p.end_date ? new Date(p.end_date).getTime() : NaN))
    .filter((n) => Number.isFinite(n));
  if (startTimes.length === 0 || endTimes.length === 0) return null;
  const start = Math.min(...startTimes);
  const end = Math.max(...endTimes);
  if (end <= start) return null;
  return { start, end, spanMs: end - start };
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Not started';
  return status
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
