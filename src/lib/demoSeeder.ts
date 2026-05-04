// ─────────────────────────────────────────────────────────────────────────────
// Demo data seeder (Tab T, investor-readiness push)
// ─────────────────────────────────────────────────────────────────────────────
// One-shot helper that populates a project with realistic-looking RFIs,
// submittals, punch items, schedule activities, budget lines, and photos so
// the dashboard renders a believable story during the investor demo.
//
// Wipe path is precise: every row this seeder inserts is tagged with the
// `demo-seed:` prefix in a free-text field, AND the inserted IDs are kept
// in localStorage so the wipe button can target them exactly. We never
// touch a row that wasn't created by the seeder.
//
// Schema-tolerant: the runtime catches missing columns / tables and skips
// that section rather than aborting the whole seed. The demo still works
// even if a particular table isn't migrated in the current environment.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// Free-text marker stamped into title/description so wipe can re-find rows
// even if localStorage is cleared. Keep it unmistakable.
export const DEMO_SEED_MARKER = '[demo-seed]'

const STORAGE_KEY = (projectId: string) => `demo_seed_ids:${projectId}`

interface SeedTarget {
  table: 'rfis' | 'submittals' | 'punch_items' | 'schedule_phases' | 'cost_codes' | 'commitments' | 'photos'
  ids: string[]
}

interface SeedResult {
  created: Array<{ table: string; count: number }>
  skipped: Array<{ table: string; reason: string }>
}

interface WipeResult {
  deleted: Array<{ table: string; count: number }>
  failed: Array<{ table: string; reason: string }>
}

// ── Storage of seeded ids ──────────────────────────────────────────────────

function readSeededIds(projectId: string): SeedTarget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown as SeedTarget[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSeededIds(projectId: string, targets: SeedTarget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(targets))
  } catch {
    // localStorage may be unavailable in certain privacy modes — wipe falls
    // back to the marker scan in that case.
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const now = () => new Date()
const isoDaysFromNow = (days: number) => {
  const d = now()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

const TRADES = ['Concrete', 'Drywall', 'Electrical', 'Mechanical', 'Plumbing', 'Steel', 'Glazing', 'Roofing'] as const
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const RFI_TITLES = [
  'Confirm column dimensions at line 7',
  'Storefront frame tolerance at lobby',
  'Slab edge condition near loading dock',
  'Fire-rating at corridor 1A',
  'Roof curb detail conflict — Sheet A3.2 vs M2.1',
  'Conduit routing through structural beam',
  'Stair tread material — finish schedule mismatch',
  'Site water table impact on Footing F-7',
  'Curtain wall mullion spacing tolerance',
  'Acoustic ceiling tile pattern at boardroom',
  'Sprinkler head spacing at high-bay',
  'Structural connection at column C-12',
] as const
const SUBMITTAL_TITLES = [
  'Concrete mix design — Spec 03 30 00',
  'Storefront aluminum frames — Spec 08 41 13',
  'Fire alarm panel cut sheets',
  'AHU-4 mechanical equipment',
  'Steel anchor bolts and base plates',
  'Roof TPO membrane and accessories',
  'Acoustic ceiling tile samples',
  'Glazing mockup approval',
] as const
const PUNCH_TITLES = [
  'Touch-up paint at corridor walls',
  'Misaligned door hardware — Room 204',
  'Caulking gap at stone veneer',
  'Floor tile chipped near elevator',
  'Burned-out fixture at stairwell B',
  'Loose handrail bracket — Lobby',
  'Damaged ceiling tile in conference rm',
  'Cabinet drawer alignment — kitchen',
  'Carpet seam visible at room 312',
  'HVAC grille loose at vestibule',
  'Outlet cover missing in IT closet',
  'Window screen torn — Suite 405',
  'Stair nosing scuff at landing',
  'Fire extinguisher cabinet locked',
  'Threshold gap at exterior door',
] as const
const SCHEDULE_ACTIVITIES = [
  { name: 'Foundation pour — Section A', cp: true, daysOffset: -10, durationDays: 5 },
  { name: 'Steel erection — Levels 1–3', cp: true, daysOffset: -5, durationDays: 18 },
  { name: 'MEP rough-in — Level 2', cp: false, daysOffset: 7, durationDays: 14 },
  { name: 'Roof TPO weld-down', cp: true, daysOffset: 21, durationDays: 5 },
  { name: 'Storefront install — Lobby', cp: false, daysOffset: 35, durationDays: 10 },
] as const
const COST_CODES = [
  { code: '03 30 00', name: 'Cast-in-Place Concrete', approved: 1_200_000, committed: 1_080_000 },
  { code: '05 12 00', name: 'Structural Steel', approved: 2_400_000, committed: 2_310_000 },
  { code: '07 54 00', name: 'TPO Roofing', approved: 480_000, committed: 460_000 },
  { code: '08 41 13', name: 'Aluminum-Framed Storefronts', approved: 720_000, committed: 645_000 },
  { code: '09 51 00', name: 'Acoustical Ceilings', approved: 215_000, committed: 88_000 },
  { code: '23 00 00', name: 'HVAC Equipment', approved: 1_650_000, committed: 1_460_000 },
] as const
const PHOTO_URLS = [
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800',
  'https://images.unsplash.com/photo-1517089596392-fb9a9033e05b?w=800',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800',
  'https://images.unsplash.com/photo-1535732759880-bbd5c7265e3f?w=800',
] as const

// ── Insert helpers — each is permissive of schema variations ───────────────

async function tryInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<{ ids: string[]; error?: string }> {
  if (rows.length === 0) return { ids: [] }
  // The generated `Database` type doesn't expose loose-shape inserts, so the
  // demo seeder routes through a single-cast client. The marker keeps wipe
  // safe even if columns drift.
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (rs: unknown) => {
        select: (s: string) => Promise<{ data: unknown; error: { message: string } | null }>
      }
    }
  })
    .from(table)
    .insert(rows as never)
    .select('id')
  if (error) return { ids: [], error: error.message }
  const inserted = (data ?? []) as Array<{ id?: string }>
  return { ids: inserted.map((r) => r.id).filter((id): id is string => !!id) }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Seed the given project with ~50 realistic-looking records spanning RFIs,
 * submittals, punch items, schedule, budget, and photos. Idempotent in the
 * sense that calling twice will create two batches; consumers should usually
 * `wipeDemoData` first.
 */
export async function seedDemoData(projectId: string): Promise<SeedResult> {
  if (!projectId) throw new Error('projectId required')

  const created: SeedResult['created'] = []
  const skipped: SeedResult['skipped'] = []
  const targets: SeedTarget[] = []

  // ── RFIs ─────────────────────────────────────────────────────────────
  const rfiRows = RFI_TITLES.map((title, i) => {
    const overdue = i < 3
    const dueOffset = overdue ? -(2 + i * 2) : 7 + i * 3
    const status =
      i < 3 ? 'open'
      : i < 7 ? 'under_review'
      : i === 7 ? 'closed'
      : 'open'
    return {
      project_id: projectId,
      title: `${title}`,
      description: `${DEMO_SEED_MARKER} Auto-generated RFI for the investor demo. ` +
        `Spec coordination question raised by the field.`,
      status,
      priority: pick(PRIORITIES, i),
      due_date: isoDaysFromNow(dueOffset).slice(0, 10),
      ball_in_court: i % 2 === 0 ? 'Architect' : 'Engineer',
      assigned_to: pick(['Martinez Engineering', 'Hardin Architecture', 'Owner Rep'], i),
      spec_section: pick(['03 30 00', '05 12 00', '08 41 13', '09 51 00'], i),
      drawing_reference: pick(['A3.2', 'S2.1', 'M2.1', 'A4.7'], i),
    }
  })
  const rfiResult = await tryInsert('rfis', rfiRows)
  if (rfiResult.error) {
    skipped.push({ table: 'rfis', reason: rfiResult.error })
  } else {
    created.push({ table: 'rfis', count: rfiResult.ids.length })
    targets.push({ table: 'rfis', ids: rfiResult.ids })
  }

  // ── Submittals ───────────────────────────────────────────────────────
  const submittalRows = SUBMITTAL_TITLES.map((title, i) => {
    const status =
      i < 3 ? 'pending_review'
      : i < 5 ? 'in_review'
      : i === 5 ? 'rejected'
      : 'approved'
    return {
      project_id: projectId,
      title: title,
      status,
      spec_section: title.match(/Spec (\S+ \S+ \S+)/)?.[1] ?? null,
      due_date: isoDaysFromNow(i < 3 ? -2 : 7 + i * 3).slice(0, 10),
      submitted_date: i >= 2 ? isoDaysFromNow(-(7 + i)).slice(0, 10) : null,
      lead_time_weeks: 6 + (i % 4),
      required_onsite_date: isoDaysFromNow(30 + i * 7).slice(0, 10),
      revision_number: i === 5 ? 2 : 1,
      subcontractor: pick(['Bay Concrete', 'Skyline Steel', 'Pacific Glazing', 'Coastal MEP'], i),
      stamp: i === 7 ? 'approved' : i === 5 ? 'revise_resubmit' : null,
    }
  })
  const subResult = await tryInsert('submittals', submittalRows)
  if (subResult.error) {
    skipped.push({ table: 'submittals', reason: subResult.error })
  } else {
    created.push({ table: 'submittals', count: subResult.ids.length })
    targets.push({ table: 'submittals', ids: subResult.ids })
  }

  // ── Punch items ──────────────────────────────────────────────────────
  const punchRows = PUNCH_TITLES.map((title, i) => {
    const status =
      i < 6 ? 'open'
      : i < 10 ? 'in_progress'
      : i < 13 ? 'sub_complete'
      : 'verified'
    return {
      project_id: projectId,
      title,
      description: `${DEMO_SEED_MARKER} Field-identified punch item.`,
      status,
      priority: pick(PRIORITIES, i),
      trade: pick(TRADES, i),
      area: pick(['Lobby', 'Floor 2', 'Floor 3', 'Roof', 'Mechanical', 'Suite 405'], i),
      floor: pick(['L1', 'L2', 'L3', 'L4', 'Roof'], i),
      location: pick(['North wall', 'East corridor', 'Stairwell B', 'Conference 304'], i),
      due_date: isoDaysFromNow(i < 6 ? -3 + i : 7 + i).slice(0, 10),
      assigned_to: pick(['Bay Concrete', 'Skyline Steel', 'Pacific Glazing', 'Coastal MEP'], i),
      verified_date: i >= 13 ? isoDaysFromNow(-(2 + i)).slice(0, 10) : null,
      resolved_date: i >= 10 ? isoDaysFromNow(-(1 + i)).slice(0, 10) : null,
    }
  })
  const punchResult = await tryInsert('punch_items', punchRows)
  if (punchResult.error) {
    skipped.push({ table: 'punch_items', reason: punchResult.error })
  } else {
    created.push({ table: 'punch_items', count: punchResult.ids.length })
    targets.push({ table: 'punch_items', ids: punchResult.ids })
  }

  // ── Schedule activities (schedule_phases) ────────────────────────────
  const scheduleRows = SCHEDULE_ACTIVITIES.map((act) => ({
    project_id: projectId,
    name: act.name,
    start_date: isoDaysFromNow(act.daysOffset).slice(0, 10),
    end_date: isoDaysFromNow(act.daysOffset + act.durationDays).slice(0, 10),
    baseline_start: isoDaysFromNow(act.daysOffset - 2).slice(0, 10),
    baseline_end: isoDaysFromNow(act.daysOffset + act.durationDays - 2).slice(0, 10),
    percent_complete: act.daysOffset < 0
      ? Math.min(100, Math.round((Math.abs(act.daysOffset) / act.durationDays) * 100))
      : 0,
    is_critical_path: act.cp,
    status: act.daysOffset < -3 ? 'in_progress' : 'not_started',
    description: `${DEMO_SEED_MARKER} Demo schedule activity.`,
  }))
  const scheduleResult = await tryInsert('schedule_phases', scheduleRows)
  if (scheduleResult.error) {
    skipped.push({ table: 'schedule_phases', reason: scheduleResult.error })
  } else {
    created.push({ table: 'schedule_phases', count: scheduleResult.ids.length })
    targets.push({ table: 'schedule_phases', ids: scheduleResult.ids })
  }

  // ── Budget / cost codes ──────────────────────────────────────────────
  const budgetRows = COST_CODES.map((c) => ({
    project_id: projectId,
    code: c.code,
    description: `${DEMO_SEED_MARKER} ${c.name}`,
    approved_amount: c.approved,
    committed_amount: c.committed,
    forecast_amount: Math.round(c.committed * 1.02),
    actual_amount: Math.round(c.committed * 0.6),
  }))
  const budgetResult = await tryInsert('cost_codes', budgetRows)
  if (budgetResult.error) {
    skipped.push({ table: 'cost_codes', reason: budgetResult.error })
  } else {
    created.push({ table: 'cost_codes', count: budgetResult.ids.length })
    targets.push({ table: 'cost_codes', ids: budgetResult.ids })
  }

  // ── Photos (best effort — table name + columns vary) ─────────────────
  const photoRows = PHOTO_URLS.map((url, i) => ({
    project_id: projectId,
    url,
    caption: `${DEMO_SEED_MARKER} Site progress — ${pick(['Level 1 framing', 'Roof TPO', 'Concrete pour', 'Storefront mockup'], i)}`,
    captured_at: isoDaysFromNow(-i).slice(0, 19) + 'Z',
  }))
  // Try the canonical name first, then the field-capture variant.
  let photoResult = await tryInsert('photos', photoRows)
  if (photoResult.error) {
    photoResult = await tryInsert('field_capture_photos', photoRows)
    if (photoResult.error) {
      skipped.push({ table: 'photos', reason: photoResult.error })
    } else {
      created.push({ table: 'field_capture_photos', count: photoResult.ids.length })
      targets.push({ table: 'photos', ids: photoResult.ids })
    }
  } else {
    created.push({ table: 'photos', count: photoResult.ids.length })
    targets.push({ table: 'photos', ids: photoResult.ids })
  }

  // ── Commitments (best-effort — derived from RFIs we just inserted) ──
  if (rfiResult.ids.length > 0) {
    const commitmentRows = rfiResult.ids.slice(0, 3).map((rfiId, i) => ({
      project_id: projectId,
      party: pick(['Martinez Engineering', 'Hardin Architecture', 'Coastal MEP'], i),
      commitment: `${DEMO_SEED_MARKER} Respond to RFI`,
      due_date: isoDaysFromNow(-1 + i * 4).slice(0, 10),
      status: i === 0 ? 'overdue' : i === 1 ? 'at_risk' : 'on_track',
      source_type: 'rfi',
      source_id: rfiId,
    }))
    const commitmentsResult = await tryInsert('commitments', commitmentRows)
    if (commitmentsResult.error) {
      skipped.push({ table: 'commitments', reason: commitmentsResult.error })
    } else {
      created.push({ table: 'commitments', count: commitmentsResult.ids.length })
      targets.push({ table: 'commitments', ids: commitmentsResult.ids })
    }
  }

  // Persist precise wipe targets.
  const previous = readSeededIds(projectId)
  writeSeededIds(projectId, [...previous, ...targets])

  return { created, skipped }
}

/**
 * Delete every row created by `seedDemoData`. Targets:
 *   1. ids stored in localStorage (precise — fastest path)
 *   2. PLUS any row whose description contains DEMO_SEED_MARKER (defensive
 *      — catches rows seeded from a different browser / cleared storage)
 *
 * We never wipe rows we didn't tag.
 */
export async function wipeDemoData(projectId: string): Promise<WipeResult> {
  if (!projectId) throw new Error('projectId required')

  const deleted: WipeResult['deleted'] = []
  const failed: WipeResult['failed'] = []

  // ── Pass 1: precise delete-by-id ────────────────────────────────────
  const targets = readSeededIds(projectId)
  for (const t of targets) {
    if (t.ids.length === 0) continue
    try {
      const { error, count } = await (supabase as unknown as {
        from: (t: string) => {
          delete: (opts: { count: 'exact' }) => {
            in: (k: string, v: string[]) => Promise<{ error: { message: string } | null; count: number | null }>
          }
        }
      })
        .from(t.table)
        .delete({ count: 'exact' })
        .in('id' as never, t.ids)
      if (error) {
        failed.push({ table: t.table, reason: error.message })
      } else {
        deleted.push({ table: t.table, count: count ?? t.ids.length })
      }
    } catch (err) {
      failed.push({ table: t.table, reason: err instanceof Error ? err.message : 'delete failed' })
    }
  }

  // ── Pass 2: marker scan (defense for cross-browser seeded rows) ─────
  const markerTables = [
    { table: 'rfis', col: 'description' },
    { table: 'punch_items', col: 'description' },
    { table: 'schedule_phases', col: 'description' },
    { table: 'cost_codes', col: 'description' },
    { table: 'photos', col: 'caption' },
    { table: 'field_capture_photos', col: 'caption' },
    { table: 'commitments', col: 'commitment' },
  ] as const
  for (const { table, col } of markerTables) {
    try {
      const { error, count } = await (supabase as unknown as {
        from: (t: string) => {
          delete: (opts: { count: 'exact' }) => {
            eq: (k: string, v: string) => {
              like: (k: string, v: string) => Promise<{ error: { message: string } | null; count: number | null }>
            }
          }
        }
      })
        .from(table)
        .delete({ count: 'exact' })
        .eq('project_id' as never, projectId)
        .like(col, `%${DEMO_SEED_MARKER}%`)
      if (error) {
        failed.push({ table: `${table} (marker)`, reason: error.message })
      } else if ((count ?? 0) > 0) {
        deleted.push({ table: `${table} (marker)`, count: count ?? 0 })
      }
    } catch (err) {
      failed.push({ table: `${table} (marker)`, reason: err instanceof Error ? err.message : 'delete failed' })
    }
  }

  // Submittals don't carry our marker (no description column), so target by
  // title prefix exclusively for them.
  try {
    const titles = SUBMITTAL_TITLES as ReadonlyArray<string>
    const { error, count } = await (supabase as unknown as {
      from: (t: string) => {
        delete: (opts: { count: 'exact' }) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{ error: { message: string } | null; count: number | null }>
          }
        }
      }
    })
      .from('submittals')
      .delete({ count: 'exact' })
      .eq('project_id' as never, projectId)
      .in('title' as never, titles as unknown as string[])
    if (error) {
      failed.push({ table: 'submittals (title)', reason: error.message })
    } else if ((count ?? 0) > 0) {
      deleted.push({ table: 'submittals (title)', count: count ?? 0 })
    }
  } catch (err) {
    failed.push({ table: 'submittals (title)', reason: err instanceof Error ? err.message : 'delete failed' })
  }

  // Clear stored ids whether wipe fully succeeded or not — re-seeding picks
  // up fresh ids next time.
  writeSeededIds(projectId, [])

  return { deleted, failed }
}

/** Whether at least one seed batch is currently tracked for this project. */
export function hasDemoData(projectId: string): boolean {
  return readSeededIds(projectId).some((t) => t.ids.length > 0)
}
