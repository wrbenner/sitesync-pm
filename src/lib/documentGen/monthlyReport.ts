/**
 * Monthly project report generator.
 *
 * Pure function. Given a snapshot + the month being reported, returns a
 * structured GeneratedDocument that an edge function then renders to PDF.
 */

import type { ProjectSnapshot } from './snapshot'

export interface GeneratedDocument {
  title: string
  subtitle?: string
  /** ISO-8601 timestamp this document represents. */
  as_of: string
  sections: DocumentSection[]
}

export interface DocumentSection {
  heading: string
  body?: string
  /** Optional rows for a tabular section. */
  rows?: Array<Record<string, string | number>>
  /** Optional bullet list. */
  bullets?: string[]
  /** Optional KPIs to render as inline tiles. */
  kpis?: Array<{ label: string; value: string | number }>
}

export interface MonthlyReportInput {
  snapshot: ProjectSnapshot
  /** YYYY-MM */
  month: string
}

export function generateMonthlyReport(input: MonthlyReportInput): GeneratedDocument {
  const { snapshot, month } = input
  const sections: DocumentSection[] = []

  // KPI section
  sections.push({
    heading: 'Project KPIs',
    kpis: [
      { label: 'RFIs sent', value: snapshot.rfis.length },
      { label: 'RFIs answered', value: snapshot.rfis.filter((r) => r.status === 'answered').length },
      { label: 'Submittals', value: snapshot.submittals.length },
      { label: 'Open punch items', value: snapshot.punch_items.filter((p) => p.status === 'open').length },
      { label: 'Change orders', value: snapshot.change_orders.length },
      { label: 'CO cost impact', value: formatMoney(snapshot.change_orders.reduce((s, c) => s + (c.cost_impact || 0), 0)) },
    ],
  })

  // Daily logs
  sections.push({
    heading: 'Daily logs',
    body: `${snapshot.daily_logs.length} log${snapshot.daily_logs.length === 1 ? '' : 's'} captured this period.`,
  })

  // Outstanding RFIs
  const openRfis = snapshot.rfis.filter((r) => r.status !== 'answered' && r.status !== 'closed')
  if (openRfis.length > 0) {
    sections.push({
      heading: 'Outstanding RFIs',
      rows: openRfis.map((r) => ({
        '#': r.number,
        Title: r.title,
        Status: r.status,
        'Days open': r.days_open,
      })),
    })
  }

  // Inspections
  const failedInspections = snapshot.inspections.filter((i) => i.result === 'fail')
  if (failedInspections.length > 0) {
    sections.push({
      heading: 'Failed inspections',
      rows: failedInspections.map((i) => ({
        Date: i.date,
        Type: i.inspection_type,
        Deficiencies: i.deficiencies_count,
      })),
    })
  }

  return {
    title: `Monthly report — ${snapshot.meta.project_name || snapshot.meta.project_id}`,
    subtitle: month,
    as_of: snapshot.meta.snapshot_at,
    sections,
  }
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
