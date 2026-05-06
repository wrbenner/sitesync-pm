/**
 * Closeout package generator.
 *
 * Composes all the standard closeout artifacts (RFIs, submittals, COs,
 * inspections, punch list completion) into a single navigable document.
 */

import type { ProjectSnapshot } from './snapshot'
import type { GeneratedDocument, DocumentSection } from './monthlyReport'

export function generateCloseoutPackage(snapshot: ProjectSnapshot): GeneratedDocument {
  const sections: DocumentSection[] = []

  sections.push({
    heading: 'Project summary',
    body:
      `Closeout package for ${snapshot.meta.project_name || snapshot.meta.project_id}. ` +
      `Period covered: ${new Date(snapshot.meta.period_start).toLocaleDateString()} – ${new Date(snapshot.meta.period_end).toLocaleDateString()}.`,
    kpis: [
      { label: 'Total RFIs', value: snapshot.rfis.length },
      { label: 'Total submittals', value: snapshot.submittals.length },
      { label: 'Total COs', value: snapshot.change_orders.length },
      { label: 'Punch items', value: snapshot.punch_items.length },
      { label: 'Punch closed', value: snapshot.punch_items.filter((p) => p.status === 'closed' || p.status === 'verified').length },
      { label: 'Inspections passed', value: snapshot.inspections.filter((i) => i.result === 'pass').length },
    ],
  })

  // RFIs
  if (snapshot.rfis.length > 0) {
    sections.push({
      heading: 'RFI log',
      rows: snapshot.rfis.map((r) => ({
        '#': r.number,
        Title: r.title,
        Status: r.status,
        Sent: r.sent_at?.slice(0, 10) ?? '—',
        Responded: r.responded_at?.slice(0, 10) ?? '—',
      })),
    })
  }

  // Submittals
  if (snapshot.submittals.length > 0) {
    sections.push({
      heading: 'Submittal log',
      rows: snapshot.submittals.map((s) => ({
        '#': s.number,
        Title: s.title,
        Status: s.status,
      })),
    })
  }

  // Change orders
  if (snapshot.change_orders.length > 0) {
    sections.push({
      heading: 'Change order log',
      rows: snapshot.change_orders.map((c) => ({
        '#': c.number,
        Title: c.title,
        Status: c.status,
        Cost: `$${c.cost_impact.toLocaleString()}`,
      })),
    })
  }

  // Punch list
  if (snapshot.punch_items.length > 0) {
    const open = snapshot.punch_items.filter((p) => p.status !== 'closed' && p.status !== 'verified')
    sections.push({
      heading: 'Punch list (open)',
      rows: open.map((p) => ({
        Title: p.title,
        Trade: p.trade ?? '—',
        Severity: p.severity,
        Status: p.status,
      })),
    })
  }

  return {
    title: `Closeout package — ${snapshot.meta.project_name || snapshot.meta.project_id}`,
    as_of: snapshot.meta.snapshot_at,
    sections,
  }
}
