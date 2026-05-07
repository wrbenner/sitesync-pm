// ── reports ─────────────────────────────────────────────────────────────
// Pure aggregators that build the Recharts datasets for the six canned
// RFI reports. Each takes the raw rfi rows + optional response history
// and returns a typed dataset.
//
// Money flows in cents and renders in dollars at the chart axis only —
// per CLAUDE.md money rule.

import { fromCents } from '../../types/money'

export interface RFIRowForReport {
  id: string
  status: string | null
  priority: string | null
  ball_in_court: string | null
  cost_impact_cents: number | null
  schedule_days_impact: number | null
  due_date: string | null
  closed_date: string | null
  created_at: string | null
  spec_section: string | null
  trade?: string | null
  location_id?: string | null
}

export interface ResponseRowForReport {
  rfi_id: string
  is_official: boolean | null
  created_at: string | null
}

/** 1. Avg response time per firm — bar chart by ball-in-court. */
export function avgResponseTimePerFirm(
  rfis: RFIRowForReport[],
  responses: ResponseRowForReport[],
  firmLookup: (userId: string) => string,
): Array<{ firm: string; avgDays: number; rfiCount: number }> {
  const firstResponseAt: Record<string, number> = {}
  for (const r of responses) {
    if (!r.created_at || !r.is_official) continue
    const t = new Date(r.created_at).getTime()
    if (!firstResponseAt[r.rfi_id] || t < firstResponseAt[r.rfi_id]) {
      firstResponseAt[r.rfi_id] = t
    }
  }
  const buckets: Record<string, { sumDays: number; count: number }> = {}
  for (const rfi of rfis) {
    if (!rfi.ball_in_court || !rfi.created_at) continue
    const respondedAt = firstResponseAt[rfi.id]
    if (!respondedAt) continue
    const days = Math.max(0, (respondedAt - new Date(rfi.created_at).getTime()) / 86400000)
    const firm = firmLookup(rfi.ball_in_court)
    if (!buckets[firm]) buckets[firm] = { sumDays: 0, count: 0 }
    buckets[firm].sumDays += days
    buckets[firm].count += 1
  }
  return Object.entries(buckets)
    .map(([firm, b]) => ({ firm, avgDays: Number((b.sumDays / b.count).toFixed(1)), rfiCount: b.count }))
    .sort((a, b) => b.avgDays - a.avgDays)
}

/** 2. On-time close % — single percentage + trend over last 12 months. */
export function onTimeClosePercent(rfis: RFIRowForReport[]): {
  current: number
  trend: Array<{ month: string; pct: number; closed: number }>
} {
  const closed = rfis.filter((r) => r.status === 'closed' && r.closed_date && r.due_date)
  const onTime = closed.filter((r) => (r.closed_date as string) <= (r.due_date as string)).length
  const current = closed.length === 0 ? 0 : Math.round((onTime / closed.length) * 1000) / 10
  // Bucket by month-of-close.
  const buckets: Record<string, { closed: number; onTime: number }> = {}
  for (const r of closed) {
    const m = (r.closed_date as string).slice(0, 7)
    if (!buckets[m]) buckets[m] = { closed: 0, onTime: 0 }
    buckets[m].closed += 1
    if ((r.closed_date as string) <= (r.due_date as string)) buckets[m].onTime += 1
  }
  const trend = Object.entries(buckets)
    .map(([month, b]) => ({ month, pct: Math.round((b.onTime / b.closed) * 1000) / 10, closed: b.closed }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
  return { current, trend }
}

/** 3. Cost at risk — sum of open RFIs with cost_impact_cents > 0. */
export function costAtRisk(rfis: RFIRowForReport[]): { totalDollars: number; rfiCount: number; byPriority: Array<{ priority: string; dollars: number; count: number }> } {
  const open = rfis.filter((r) => r.status !== 'closed' && r.status !== 'void' && r.cost_impact_cents && r.cost_impact_cents > 0)
  const totalCents = open.reduce((s, r) => s + Number(r.cost_impact_cents ?? 0), 0)
  const buckets: Record<string, { cents: number; count: number }> = {}
  for (const r of open) {
    const p = r.priority ?? 'medium'
    if (!buckets[p]) buckets[p] = { cents: 0, count: 0 }
    buckets[p].cents += Number(r.cost_impact_cents ?? 0)
    buckets[p].count += 1
  }
  return {
    totalDollars: fromCents(totalCents as never),
    rfiCount: open.length,
    byPriority: Object.entries(buckets).map(([priority, b]) => ({ priority, dollars: fromCents(b.cents as never), count: b.count })),
  }
}

/** 4. Schedule at risk — sum of schedule_days_impact across open RFIs. */
export function scheduleAtRisk(rfis: RFIRowForReport[]): { totalDays: number; rfiCount: number; byTrade: Array<{ trade: string; days: number; count: number }> } {
  const open = rfis.filter((r) => r.status !== 'closed' && r.status !== 'void' && r.schedule_days_impact && r.schedule_days_impact > 0)
  const totalDays = open.reduce((s, r) => s + Number(r.schedule_days_impact ?? 0), 0)
  const buckets: Record<string, { days: number; count: number }> = {}
  for (const r of open) {
    const trade = r.spec_section?.slice(0, 2) ?? r.trade ?? 'Unknown'
    if (!buckets[trade]) buckets[trade] = { days: 0, count: 0 }
    buckets[trade].days += Number(r.schedule_days_impact ?? 0)
    buckets[trade].count += 1
  }
  return {
    totalDays,
    rfiCount: open.length,
    byTrade: Object.entries(buckets).map(([trade, b]) => ({ trade, days: b.days, count: b.count })).sort((a, b) => b.days - a.days),
  }
}

/** 5. RFI count by trade — heatmap-friendly dataset. */
export function rfiCountByTrade(rfis: RFIRowForReport[]): Array<{ trade: string; open: number; closed: number; total: number }> {
  const buckets: Record<string, { open: number; closed: number }> = {}
  for (const r of rfis) {
    const trade = r.spec_section?.slice(0, 2) ?? r.trade ?? 'Unknown'
    if (!buckets[trade]) buckets[trade] = { open: 0, closed: 0 }
    if (r.status === 'closed') buckets[trade].closed += 1
    else if (r.status !== 'void') buckets[trade].open += 1
  }
  return Object.entries(buckets)
    .map(([trade, b]) => ({ trade, open: b.open, closed: b.closed, total: b.open + b.closed }))
    .sort((a, b) => b.total - a.total)
}

/** 6. Designer scorecard — accuracy + response time per firm. */
export function designerScorecard(
  rfis: RFIRowForReport[],
  responses: ResponseRowForReport[],
  firmLookup: (userId: string) => string,
): Array<{ firm: string; avgDays: number; rfiCount: number; closedOnTime: number; closedTotal: number; accuracy: number }> {
  const avg = avgResponseTimePerFirm(rfis, responses, firmLookup)
  const byFirm = new Map(avg.map((a) => [a.firm, a]))
  // Closed on-time per firm.
  const closedByFirm: Record<string, { onTime: number; total: number }> = {}
  for (const r of rfis) {
    if (r.status !== 'closed' || !r.ball_in_court || !r.closed_date || !r.due_date) continue
    const firm = firmLookup(r.ball_in_court)
    if (!closedByFirm[firm]) closedByFirm[firm] = { onTime: 0, total: 0 }
    closedByFirm[firm].total += 1
    if ((r.closed_date as string) <= (r.due_date as string)) closedByFirm[firm].onTime += 1
  }
  return Array.from(byFirm.values()).map((row) => {
    const closed = closedByFirm[row.firm] ?? { onTime: 0, total: 0 }
    const accuracy = closed.total === 0 ? 0 : Math.round((closed.onTime / closed.total) * 1000) / 10
    return {
      firm: row.firm,
      avgDays: row.avgDays,
      rfiCount: row.rfiCount,
      closedOnTime: closed.onTime,
      closedTotal: closed.total,
      accuracy,
    }
  })
}

export const CANNED_REPORT_KEYS = [
  'avg_response_time_per_firm',
  'on_time_close_pct',
  'cost_at_risk',
  'schedule_at_risk',
  'rfi_count_by_trade',
  'designer_scorecard',
] as const
export type CannedReportKey = typeof CANNED_REPORT_KEYS[number]

export const CANNED_REPORT_LABELS: Record<CannedReportKey, string> = {
  avg_response_time_per_firm: 'Avg Response Time per Firm',
  on_time_close_pct: 'On-Time Close %',
  cost_at_risk: 'Cost at Risk',
  schedule_at_risk: 'Schedule at Risk',
  rfi_count_by_trade: 'RFI Count by Trade',
  designer_scorecard: 'Designer Scorecard',
}
