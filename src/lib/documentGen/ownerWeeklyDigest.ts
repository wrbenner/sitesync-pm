/**
 * Owner weekly digest — succinct, executive-tone summary.
 */

import type { ProjectSnapshot } from './snapshot'
import type { GeneratedDocument, DocumentSection } from './monthlyReport'

export function generateOwnerWeeklyDigest(snapshot: ProjectSnapshot): GeneratedDocument {
  const sections: DocumentSection[] = []
  const newRfis = snapshot.rfis.length
  const overdueRfis = snapshot.rfis.filter((r) => r.days_open > 7 && r.status !== 'answered').length
  const failedInsp = snapshot.inspections.filter((i) => i.result === 'fail').length
  const totalCoImpact = snapshot.change_orders.reduce((s, c) => s + (c.cost_impact || 0), 0)

  sections.push({
    heading: 'This week',
    bullets: [
      `${newRfis} new RFI${newRfis === 1 ? '' : 's'}`,
      `${overdueRfis} RFI${overdueRfis === 1 ? '' : 's'} overdue (>7 days)`,
      `${failedInsp} failed inspection${failedInsp === 1 ? '' : 's'}`,
      `${snapshot.change_orders.length} new change order${snapshot.change_orders.length === 1 ? '' : 's'} ($${totalCoImpact.toLocaleString()} total impact)`,
    ],
  })

  if (snapshot.change_orders.length > 0) {
    sections.push({
      heading: 'Change orders',
      rows: snapshot.change_orders.map((c) => ({
        '#': c.number,
        Title: c.title,
        Cost: `$${c.cost_impact.toLocaleString()}`,
        Status: c.status,
      })),
    })
  }

  return {
    title: `Weekly digest — ${snapshot.meta.project_name || snapshot.meta.project_id}`,
    subtitle: `Week of ${new Date(snapshot.meta.period_start).toLocaleDateString()}`,
    as_of: snapshot.meta.snapshot_at,
    sections,
  }
}
