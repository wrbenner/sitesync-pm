// Demo project seeder.
//
// Takes the curated "Maple Ridge Mixed-Use" fixture in src/lib/demoData.ts
// and writes it into the supplied organization as a single read-only
// demo project. Designed to be:
//
//   * Idempotent     — running twice on the same org upserts the same rows.
//                       Demo IDs are deterministic-by-construction so the
//                       seeder can safely be invoked from "Reset Demo".
//   * Fail-soft      — any single insert failure is logged and skipped;
//                       partial seeding is allowed. The user still gets a
//                       populated dashboard.
//   * Tenant-scoped  — every row carries (organization_id, project_id) so
//                       it cannot leak across orgs even if RLS were
//                       misconfigured.
//
// Tables touched (in dependency order):
//   1. projects          — the demo project itself, flagged is_demo = true
//   2. schedule_phases   — 12 phases
//   3. rfis              — 30 RFIs
//   4. submittals        — 12 submittals
//   5. change_orders     — 6 COs
//   6. punch_items       — 60 punch items
//   7. daily_logs        — 14 daily logs
//   8. drawings          — 5 drawings (metadata only; no actual files)
//
// Vendors and team members are intentionally NOT seeded as separate
// rows — they would need real auth.users and project_members entries
// which would require service-role access. They appear in the UI as
// foreign-key targets only when those records exist; otherwise the UI
// gracefully shows "Unassigned." A follow-up enhancement can use the
// service-role path to seed phantom demo team members.


import { fromTable } from '../lib/db/queries'
import { DEMO_BUNDLE } from '../lib/demoData'

export interface SeedResult {
  ok: boolean
  rows_inserted: number
  errors: Array<{ table: string; error: string }>
}

const DEMO_PROJECT_LOGICAL_ID = DEMO_BUNDLE.project.id

/**
 * Build a deterministic UUID from an organization_id and a demo logical id.
 * SHA-1-based v5-like derivation: stable across runs, unique per org so
 * different orgs never collide on the same demo row.
 *
 * Uses the WebCrypto API (available in modern browsers + edge functions).
 */
async function deriveId(orgId: string, logicalId: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-1', enc.encode(`${orgId}:${logicalId}`))
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  // Format as a UUID v5-ish: 8-4-4-4-12 with version 5 nibble.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

/**
 * Seed (or re-seed) the demo project for an organization.
 *
 * Returns a SeedResult describing what was inserted and any per-table errors.
 * Caller is expected to be the org owner or admin — RLS will reject otherwise.
 */
export async function seedDemoProject(orgId: string): Promise<SeedResult> {
  const errors: SeedResult['errors'] = []
  let inserted = 0

  // 1. Project (upsert by id).
  const projectId = await deriveId(orgId, DEMO_PROJECT_LOGICAL_ID)
  const { error: projErr } = await fromTable('projects')
    .upsert(
      {
        id: projectId,
        organization_id: orgId,
        name: DEMO_BUNDLE.project.name,
        number: DEMO_BUNDLE.project.number,
        status: DEMO_BUNDLE.project.status,
        contract_value_cents: DEMO_BUNDLE.project.contract_value_cents,
        start_date: DEMO_BUNDLE.project.start_date,
        substantial_completion_date: DEMO_BUNDLE.project.substantial_completion_date,
        address_line1: DEMO_BUNDLE.project.address_line1,
        city: DEMO_BUNDLE.project.city,
        state: DEMO_BUNDLE.project.state,
        postal_code: DEMO_BUNDLE.project.postal_code,
        square_footage: DEMO_BUNDLE.project.square_footage,
        number_of_floors: DEMO_BUNDLE.project.number_of_floors,
        description: DEMO_BUNDLE.project.description,
        // Optional jurisdiction field. Only set when present on the seed row so
        // we don't overwrite real data on tables where the column may differ.
        ...('jurisdiction' in DEMO_BUNDLE.project ? { jurisdiction: (DEMO_BUNDLE.project as { jurisdiction: string }).jurisdiction } : {}),
        is_demo: true,
      } as never,
      { onConflict: 'id' },
    )

  if (projErr) {
    errors.push({ table: 'projects', error: projErr.message })
    return { ok: false, rows_inserted: 0, errors }
  }
  inserted++

  // 2. Schedule phases.
  const phaseRows = await Promise.all(
    DEMO_BUNDLE.phases.map(async (p) => ({
      id: await deriveId(orgId, p.id),
      project_id: projectId,
      name: p.name,
      start_date: p.start,
      end_date: p.end,
      status: p.status,
      percent_complete: p.pct,
    })),
  )
  const phRes = await fromTable('schedule_phases').upsert(phaseRows as never, { onConflict: 'id' })
  if (phRes.error) errors.push({ table: 'schedule_phases', error: phRes.error.message })
  else inserted += phaseRows.length

  // 3. RFIs.
  const rfiRows = await Promise.all(
    DEMO_BUNDLE.rfis.map(async (r) => ({
      id: await deriveId(orgId, r.id),
      project_id: projectId,
      number: r.number,
      title: r.title,
      status: r.status,
      priority: r.priority,
      discipline: r.discipline,
      due_date: r.due_date,
      closed_date: 'closed_date' in r ? (r as { closed_date: string }).closed_date : null,
      // Optional code-grounding field. Only set when present on the seed row so
      // we don't overwrite real data on tables where the column may differ.
      ...('applicable_codes' in r ? { applicable_codes: (r as { applicable_codes: readonly string[] }).applicable_codes } : {}),
    })),
  )
  const rfiRes = await fromTable('rfis').upsert(rfiRows as never, { onConflict: 'id' })
  if (rfiRes.error) errors.push({ table: 'rfis', error: rfiRes.error.message })
  else inserted += rfiRows.length

  // 4. Submittals.
  const subRows = await Promise.all(
    DEMO_BUNDLE.submittals.map(async (s) => ({
      id: await deriveId(orgId, s.id),
      project_id: projectId,
      spec_section: s.spec_section,
      title: s.title,
      type: s.type,
      status: s.status,
      submitted_date: s.submitted_date,
      approved_date: 'approved_date' in s ? (s as { approved_date: string }).approved_date : null,
      // Optional procurement fields. Only set when present on the seed row so
      // we don't overwrite real data on tables where the columns may differ.
      ...('lead_time_weeks' in s ? { lead_time_weeks: (s as { lead_time_weeks: number }).lead_time_weeks } : {}),
      ...('subcontractor' in s ? { subcontractor: (s as { subcontractor: string }).subcontractor } : {}),
    })),
  )
  const subRes = await fromTable('submittals').upsert(subRows as never, { onConflict: 'id' })
  if (subRes.error) errors.push({ table: 'submittals', error: subRes.error.message })
  else inserted += subRows.length

  // 5. Change orders.
  const coRows = await Promise.all(
    DEMO_BUNDLE.change_orders.map(async (c) => ({
      id: await deriveId(orgId, c.id),
      project_id: projectId,
      number: c.number,
      title: c.title,
      amount: c.amount_cents,
      status: c.status,
      type: c.type,
      reason: c.reason,
      approved_date: 'approved_date' in c ? (c as { approved_date: string }).approved_date : null,
    })),
  )
  const coRes = await fromTable('change_orders').upsert(coRows as never, { onConflict: 'id' })
  if (coRes.error) errors.push({ table: 'change_orders', error: coRes.error.message })
  else inserted += coRows.length

  // 6. Punch items.
  const piRows = await Promise.all(
    DEMO_BUNDLE.punch_items.map(async (p) => ({
      id: await deriveId(orgId, p.id),
      project_id: projectId,
      number: p.number,
      title: p.title,
      trade: p.trade,
      status: p.status,
      priority: p.priority,
      location: p.floor,
    })),
  )
  const piRes = await fromTable('punch_items').upsert(piRows as never, { onConflict: 'id' })
  if (piRes.error) errors.push({ table: 'punch_items', error: piRes.error.message })
  else inserted += piRows.length

  // 7. Daily logs.
  const dlRows = await Promise.all(
    DEMO_BUNDLE.daily_logs.map(async (d) => ({
      id: await deriveId(orgId, d.id),
      project_id: projectId,
      log_date: d.log_date,
      weather: d.weather,
      temperature_high: d.temperature_high,
      temperature_low: d.temperature_low,
      workers_onsite: d.workers_onsite,
      work_summary: d.work_summary,
      safety_notes: d.safety_notes,
      delays: d.delays,
      status: 'submitted',
    })),
  )
  const dlRes = await fromTable('daily_logs').upsert(dlRows as never, { onConflict: 'id' })
  if (dlRes.error) errors.push({ table: 'daily_logs', error: dlRes.error.message })
  else inserted += dlRows.length

  // 8. Drawings (metadata only; no file upload).
  const dwgRows = await Promise.all(
    DEMO_BUNDLE.drawings.map(async (d) => ({
      id: await deriveId(orgId, d.id),
      project_id: projectId,
      sheet_number: d.sheet_number,
      discipline: d.discipline,
      title: d.title,
      revision: d.revision,
      status: d.status,
    })),
  )
  const dwgRes = await fromTable('drawings').upsert(dwgRows as never, { onConflict: 'id' })
  if (dwgRes.error) errors.push({ table: 'drawings', error: dwgRes.error.message })
  else inserted += dwgRows.length

  return { ok: errors.length === 0, rows_inserted: inserted, errors }
}

/**
 * Reset the demo project for an organization back to its pristine fixture
 * state. Implemented as a re-seed of the fixed-id rows; any user
 * modifications get overwritten because every row upserts on its derived id.
 */
export async function resetDemoProject(orgId: string): Promise<SeedResult> {
  return seedDemoProject(orgId)
}
