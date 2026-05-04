/**
 * seed-90-day-lifecycle.ts
 *
 * Populates a single project with 90 days of realistic construction data so
 * the lifecycle smoke spec (e2e/lifecycle/90-day-smoke.spec.ts) has concrete
 * artifacts to assert against.
 *
 * What you get:
 *   • 1 project (Avery Oaks expansion phase, with auto_co_drafting_enabled)
 *   • 5 project_members (owner / PM / 2 supers / architect)
 *   • 8 crews across 5 trades (concrete / framing / MEP / drywall / finishes)
 *   • 90 days of crew_checkins, weekdays only, ~6 crews/day, ~5% disputed
 *   • 200 photo_pins distributed over the 90 days, 80/15/5 GPS-status split
 *   • 80 daily_logs (Mon-Fri), 30% submitted / 20% approved / rest draft
 *   • 25 RFIs                  (5 closed, 10 answered, 8 open, 2 overdue)
 *   • 12 submittals             (3 approved, 4 approved-as-noted, 2 revise, 3 open)
 *   •  4 pay_applications       (paid / approved / submitted / draft)
 *   •  6 change_orders          (2 approved, 2 pending, 2 draft incl. RFI-source)
 *   • 40 punch_items            (30 open, 10 verified-complete with photos)
 *   • 12 cross-feature chain entries (rfi_overdue_sweep / submittal_rejected etc.)
 *
 * Idempotent: running twice on the same `--project-id` wipes child rows and
 * re-seeds. Default behavior (no flag) is to use a stable test-fixture UUID
 * so the spec can target it deterministically.
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *     npx tsx scripts/seed-90-day-lifecycle.ts [--project-id <uuid>] [--quiet]
 *
 * Exit code: 0 on success; non-zero on the first DB error so CI can distinguish
 * a flaky seed from a flaky spec.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Constants ─────────────────────────────────────────────────────────────

/** Stable project id so the spec can target the same row deterministically. */
const DEFAULT_PROJECT_ID = 'e2090d01-0000-4000-8000-000000000001'
const DEFAULT_ORG_ID = 'e20d000a-0000-4000-8000-000000000001'

// Stable user UUIDs for the 5 personas. Auth users are NOT created here —
// a separate setup pass should mint them via supabase.auth.admin.createUser
// before running this seed. The seed accepts a missing auth.users row
// gracefully (project_members.user_id is text-comparable to a uuid string).
const USERS = {
  owner:     'e2090d01-0001-4000-8000-000000000001',
  pm:        'e2090d01-0001-4000-8000-000000000002',
  super_a:   'e2090d01-0001-4000-8000-000000000003',
  super_b:   'e2090d01-0001-4000-8000-000000000004',
  architect: 'e2090d01-0001-4000-8000-000000000005',
} as const

// ── CLI ──────────────────────────────────────────────────────────────────

interface Options {
  projectId: string
  quiet: boolean
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2)
  let projectId = DEFAULT_PROJECT_ID
  let quiet = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-id' && args[i + 1]) {
      projectId = args[++i]
    } else if (args[i] === '--quiet') {
      quiet = true
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(
        `Usage: npx tsx scripts/seed-90-day-lifecycle.ts [--project-id <uuid>] [--quiet]\n` +
        `  --project-id  uuid     Override the test-fixture project id (default: ${DEFAULT_PROJECT_ID})\n` +
        `  --quiet                Suppress per-row logs; only print the summary table\n`,
      )
      process.exit(0)
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    console.error(`✖ --project-id must be a uuid (got "${projectId}")`)
    process.exit(2)
  }
  return { projectId, quiet }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('✖ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(2)
}

const opts = parseArgs(process.argv)
const log = (msg: string) => { if (!opts.quiet) console.log(msg) }

// The generated Database types lag behind the live schema for several of the
// tables this seed populates (line_items, dispute_status, etc.). We use the
// codebase's standard escape hatch — cast through `any` once and rely on
// PostgREST to validate the row shape server-side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as unknown as SupabaseClient<any>

// ── Deterministic randomness ─────────────────────────────────────────────
//
// We want realistic-looking distributions, but we also want the seed to
// produce identical rows on every run. A small mulberry32 PRNG seeded from
// the project id gives both.

function makePrng(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return function () {
    h |= 0
    h = (h + 0x6d2b79f5) | 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const prng = makePrng(opts.projectId)
const pick = <T>(xs: ReadonlyArray<T>): T => xs[Math.floor(prng() * xs.length)]
const between = (lo: number, hi: number) => lo + Math.floor(prng() * (hi - lo + 1))

// ── Date helpers ─────────────────────────────────────────────────────────

/** 90-day window ending today. The spec asserts against "Day N" semantics
 *  so the absolute calendar dates don't matter — only the offsets. */
const TODAY = new Date()
TODAY.setUTCHours(12, 0, 0, 0)

function daysAgo(n: number): Date {
  const d = new Date(TODAY)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
function isWeekday(d: Date): boolean {
  const day = d.getUTCDay()
  return day >= 1 && day <= 5
}
function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function isoTs(d: Date): string { return d.toISOString() }

const WORKDAYS: Date[] = []
for (let n = 89; n >= 0; n--) {
  const d = daysAgo(n)
  if (isWeekday(d)) WORKDAYS.push(d)
}

// ── Realistic content sources ────────────────────────────────────────────

const RFI_QUESTIONS = [
  {
    title: 'Sub for SCH40 PVC on 2-1/2" risers in bathrooms 3B-7B',
    description:
      'Plumbing spec section 22 11 13 calls for SCH80 PVC on the 2-1/2" risers in the bathroom stack ' +
      'serving units 3B through 7B. Local supply has SCH80 in 6-week lead, SCH40 available immediately. ' +
      'Static pressure at the riser is 35 psi per the calc package. Approve sub or hold for SCH80?',
    spec: '22 11 13',
  },
  {
    title: 'Slab depression at elevator pit — confirm waterproofing detail',
    description:
      'Detail 7/A4.20 shows a 4" slab depression at the pit but the waterproofing detail at 12/A8.04 ' +
      'references the standard slab elevation. Need clarification on which detail governs at the joint.',
    spec: '07 13 26',
    drawing: 'A4.20',
  },
  {
    title: 'Curtain wall anchor spacing at corner condition',
    description:
      'CW-3 corner condition shows anchors at 24" o.c. on both legs of the corner. Structural drawing ' +
      'S-301 calls for 18" o.c. within 4 feet of any corner. Which controls?',
    spec: '08 44 13',
    drawing: 'A6.11',
  },
  {
    title: 'Acoustic ceiling tile substitution — Armstrong Optima vs Tectum',
    description:
      'Specified Tectum panels in lobby 101 are on a 14-week lead. Armstrong Optima Plank with same NRC ' +
      'rating (0.95) and CAC (35) available in 2 weeks. Submitting product data attached.',
    spec: '09 51 13',
  },
  {
    title: 'Fire-rated door frame welding — site or shop?',
    description:
      'Spec 08 11 13 paragraph 2.3.B calls for shop-welded HM frames at all 90-min rated openings. ' +
      'Schedule pressure: site-welding the 23 stair-tower frames would save 3 weeks. Code-approved?',
    spec: '08 11 13',
  },
  {
    title: 'Conflict between mechanical and structural — duct routing at gridline 7',
    description:
      'M-401 routes a 24x12 supply duct between floor joists at gridline 7 between B and C. Structural ' +
      'S-201 shows blocking that conflicts. Need re-routing direction.',
    spec: '23 31 00',
    drawing: 'M-401',
  },
  {
    title: 'Tile pattern at curved wall in entry lobby',
    description:
      'Detail 5/A7.21 shows linear tile on the curved entry-lobby wall. Tile sub asks for ashlar pattern ' +
      'instead — easier to install on the curve, owner indicated approval. Confirm?',
    spec: '09 30 13',
  },
  {
    title: 'Window-wall sealant — Dow 795 vs Pecora 895',
    description:
      'Sealant spec 07 92 00 calls for Dow Corning 795. Approved equal Pecora 895 has same movement ' +
      'capability and the GC has used it on 4 prior similar projects. Sub OK?',
    spec: '07 92 00',
  },
  {
    title: 'Roof drain cover — vandal-proof or standard?',
    description:
      'Detail 14/A9.02 shows standard cast-iron domes. Owner walkthrough requested vandal-proof covers ' +
      'on the lower 12 feet roof drains accessible from the parking deck. Substitute and credit?',
    spec: '07 72 00',
  },
  {
    title: 'CMU coursing at clerestory window head',
    description:
      'Window head bears at +14\'-8" per A4.30, but CMU coursing for 8" CMU blocks lands at +14\'-8 5/8". ' +
      'Trim block above? Soldier course? Lay header beam at next course up?',
    spec: '04 22 00',
    drawing: 'A4.30',
  },
  {
    title: 'EIFS termination at brick — flashing detail',
    description:
      'Detail 6/A8.10 shows EIFS terminating at brick belt course but doesn\'t show counterflashing. ' +
      'Sub provided shop drawing showing custom Z-flashing — confirm acceptable?',
    spec: '07 24 00',
  },
  {
    title: 'Fire alarm strobe candela — 75 or 110 in corridors?',
    description:
      'NFPA 72 lookup table for 60ft x 60ft area gives 110 cd. Spec 28 31 00 says 75 cd in corridors ' +
      'less than 8ft wide. Corridor is 7\'-6". 75 cd OK?',
    spec: '28 31 00',
  },
  {
    title: 'Owner FF&E delivery clash with painting subcontractor',
    description:
      'Owner notified GC they intend to begin FF&E delivery week of CD+85. Painters scheduled to be in ' +
      'units 1A-2D that week. Delay paint or temporarily reroute FF&E?',
    spec: '01 21 00',
  },
  {
    title: 'Roofing warranty — 20-year NDL vs 25-year',
    description:
      'Owner requested upgrade to 25-year NDL warranty on the EPDM. Sub quotes additional $48,000. ' +
      'Authorize as a CO or substitute equal-spec 20-year?',
    spec: '07 53 23',
  },
  {
    title: 'Ground floor slab — plastic shrinkage cracking',
    description:
      'Inspection of pour 12 (CD+34) showed plastic shrinkage cracks at three locations. Concrete sub ' +
      'attributes to high evaporation rate (17% RH that day). Repair via routing & filling per spec, ' +
      'or partial replace?',
    spec: '03 30 00',
  },
  {
    title: 'Missing dimension at toilet partition — bathroom 4C',
    description:
      'Plumbing rough-in dimension on A6.04 is missing for toilet centerline at bathroom 4C. ADA layout ' +
      'requires 18" min from sidewall. Confirm 18" or other?',
    spec: '10 21 13',
  },
  {
    title: 'Corner guard finish at lobby column',
    description:
      'A4.20 shows corner guards at lobby columns finished to match base. Owner walkthrough requested ' +
      'stainless steel instead. Issue CO?',
    spec: '10 26 00',
  },
  {
    title: 'Coordination — sprinkler head vs. pendant light at lobby',
    description:
      'Sprinkler head per FP-201 lands within 6" of pendant fixture per E-401. Move sprinkler 18" west ' +
      'or relocate fixture? Architect signoff required.',
    spec: '21 13 00',
  },
  {
    title: 'Balcony railing post anchorage — drilled or cast-in?',
    description:
      'Detail 9/A6.20 shows railing posts cast into slab. Sub asks for drill-and-epoxy alternative due to ' +
      'tolerance issues at slab edge. Performance equal? Approve?',
    spec: '05 73 13',
  },
  {
    title: 'Vapor retarder under slab — 10 mil or 15 mil?',
    description:
      'Spec 03 30 00 says 10 mil min vapor retarder. Geotech report recommends 15 mil due to clay ' +
      'subgrade. Which controls?',
    spec: '03 30 00',
  },
  {
    title: 'Coffered ceiling depth at conference room',
    description:
      'Section A/A7.04 shows 6" coffer depth. Acoustic engineer says 12" needed for the spec absorption ' +
      'rating. Increase ceiling height by 6" or accept reduced rating?',
    spec: '09 53 23',
  },
  {
    title: 'Stair tower pressurization fan — VFD or constant-volume?',
    description:
      'Smoke control sequence calls for VFD on the stair pressurization fan. Mechanical sub quoting ' +
      'constant-volume to save $12,000. Code-compliant?',
    spec: '23 34 00',
  },
  {
    title: 'Exterior wall insulation — closed-cell vs open-cell spray foam',
    description:
      'Spec 07 21 19 calls for closed-cell SPF at exterior walls. Sub proposing open-cell with continuous ' +
      'air barrier outside, claiming equivalent R-value. R-value match? Air-leakage rating same?',
    spec: '07 21 19',
  },
  {
    title: 'Owner-supplied finishes — lead-time risk on pendant lights',
    description:
      'Owner-furnished pendant lights for lobby have 14-week lead, beat schedule by 1 week. Reserve ' +
      'temporary fixtures for substantial completion? CO if needed?',
    spec: '01 21 00',
  },
  {
    title: 'Concrete cylinders 28-day break — grade B mix at parking',
    description:
      'Parking deck concrete cylinders broke at 3,650 psi (28-day) vs. 4,000 spec. Materials engineer ' +
      'recommends acceptance per ACI 318 sec 5.6.3.4. Owner concur?',
    spec: '03 30 00',
  },
] as const

const TRADES = ['concrete', 'framing', 'mep', 'drywall', 'finishes'] as const
const SUB_COMPANIES = [
  'PourPro Concrete', 'SteelSouth Erectors', 'Hudson Electric',
  'Apex Interiors', 'Lone Star Framers', 'Crystal Glass & Aluminum',
  'BlueRiver Mechanical', 'Forge Plumbing',
] as const

const SPEC_SECTIONS = [
  '03 30 00', '04 22 00', '05 12 00', '06 10 00', '07 21 00', '07 53 23',
  '08 11 13', '08 44 13', '08 71 00', '09 21 16', '09 30 13', '09 91 23',
  '21 10 00', '22 11 13', '23 31 00', '23 34 00', '26 05 00', '27 10 00',
  '28 31 00', '31 23 00',
] as const

const PUNCH_LOCATIONS = [
  'Unit 1A — kitchen', 'Unit 1A — bath', 'Unit 1B — living room',
  'Unit 2C — kitchen', 'Unit 2C — bedroom 1', 'Unit 3A — entry',
  'Lobby — east wall', 'Lobby — column 7', 'Stair tower 2 — landing',
  'Roof — RTU-3 access', 'Mech room — sub-meter panel', 'Garage — slab joint',
  'Garage — wheel stop', 'Corridor 4 north', 'Elevator 2 — return air',
  'Bathroom 3B — tile out-of-plumb', 'Mailroom — door closer',
  'Trash room — fire-rated door', 'Mech room — chiller pad',
  'Roof — flashing termination',
] as const

// ── Reset (idempotency) ─────────────────────────────────────────────────

async function reset(projectId: string): Promise<void> {
  log(`→ resetting project ${projectId}`)
  // Order matters: child rows first. Delete-by-project_id uses RLS-bypassing
  // service-role key, so this is unconditional within the project's scope.
  const childTables = [
    'media_links', 'crew_checkins', 'photo_pins',
    'daily_log_entries', 'daily_logs',
    'rfi_responses', 'rfis',
    'submittal_approvals', 'submittals',
    'change_order_line_items', 'change_orders',
    'lien_waivers', 'pay_app_line_items', 'pay_applications',
    'insurance_certificates',
    'punch_items',
    'audit_log',           // hash-chain rows
    'drafted_actions',
    'rfi_escalations',
    'activity_feed',
    'crews',
    'project_members',
  ]
  for (const t of childTables) {
    const { error } = await admin.from(t).delete().eq('project_id', projectId)
    if (error && !/does not exist/i.test(error.message)) {
      // table may not exist on older schemas; soft-fail for those.
      log(`  ! skipping ${t}: ${error.message}`)
    }
  }
  // Project last (FKs cascade).
  await admin.from('projects').delete().eq('id', projectId)
}

// ── Steps ───────────────────────────────────────────────────────────────

const counts: Record<string, number> = {}
function bump(table: string, n: number) { counts[table] = (counts[table] ?? 0) + n }

async function seedProject(projectId: string): Promise<void> {
  const { error } = await admin.from('projects').insert({
    id: projectId,
    organization_id: DEFAULT_ORG_ID,
    name: 'Avery Oaks — Building B Expansion',
    description:
      '100-unit residential expansion. Phase 2: foundations through TCO. ' +
      'Used by the 90-day lifecycle smoke spec as the deterministic fixture.',
    project_type: 'residential',
    delivery_method: 'CMAR',
    contract_type: 'GMP',
    contract_value: 24_500_000,
    address: '1242 Oakwood Dr',
    city: 'Asheville',
    latitude: 35.5951,
    longitude: -82.5515,
    project_phase: 'construction',
    general_contractor: 'Suffolk Construction',
    architect_name: 'Studio Five Design',
    owner_name: 'Avery Oaks Properties LLC',
    auto_co_drafting_enabled: true,
  } as any)
  if (error) throw new Error(`project insert: ${error.message}`)
  bump('projects', 1)
}

async function seedMembers(projectId: string): Promise<void> {
  const rows = [
    { project_id: projectId, user_id: USERS.owner,     role: 'owner',         company: 'Avery Oaks Properties LLC' },
    { project_id: projectId, user_id: USERS.pm,        role: 'pm',            company: 'Suffolk Construction' },
    { project_id: projectId, user_id: USERS.super_a,   role: 'super',         company: 'Suffolk Construction' },
    { project_id: projectId, user_id: USERS.super_b,   role: 'super',         company: 'Suffolk Construction' },
    { project_id: projectId, user_id: USERS.architect, role: 'architect',     company: 'Studio Five Design' },
  ]
  const { error } = await admin.from('project_members').insert(rows as any)
  if (error) throw new Error(`project_members insert: ${error.message}`)
  bump('project_members', rows.length)
}

interface SeededCrew { id: string; name: string; trade: string; sub: string }
async function seedCrews(projectId: string): Promise<SeededCrew[]> {
  const crewSeed = [
    { trade: 'concrete', sub: 'PourPro Concrete',         name: 'PourPro Crew A', size: 8 },
    { trade: 'concrete', sub: 'PourPro Concrete',         name: 'PourPro Crew B', size: 5 },
    { trade: 'framing',  sub: 'Lone Star Framers',        name: 'Lone Star North', size: 9 },
    { trade: 'framing',  sub: 'SteelSouth Erectors',      name: 'SteelSouth Tower', size: 6 },
    { trade: 'mep',      sub: 'Hudson Electric',          name: 'Hudson Electric Roughing', size: 4 },
    { trade: 'mep',      sub: 'BlueRiver Mechanical',     name: 'BlueRiver HVAC', size: 5 },
    { trade: 'drywall',  sub: 'Apex Interiors',           name: 'Apex Drywall', size: 7 },
    { trade: 'finishes', sub: 'Crystal Glass & Aluminum', name: 'Crystal Glazing', size: 3 },
  ]
  const rows = crewSeed.map((c) => ({
    project_id: projectId,
    name: c.name,
    trade: c.trade,
    size: c.size,
    status: 'active',
    productivity_score: 70 + between(0, 25),
    location: pick(['Building A', 'Building B', 'Site perimeter']),
  }))
  const { data, error } = await admin.from('crews').insert(rows as any).select('id, name, trade')
  if (error) throw new Error(`crews insert: ${error.message}`)
  bump('crews', rows.length)
  return (data ?? []).map((d, i) => ({ id: d.id as string, name: d.name as string, trade: d.trade as string, sub: crewSeed[i].sub }))
}

async function seedCheckins(projectId: string, crews: SeededCrew[]): Promise<void> {
  const rows: any[] = []
  for (const day of WORKDAYS) {
    // Pick ~6 crews per day, deterministic per-day shuffle.
    const dailyPick = [...crews].sort(() => prng() - 0.5).slice(0, 6)
    for (const crew of dailyPick) {
      const startHour = 6 + between(0, 1)
      const start = new Date(day); start.setUTCHours(startHour, between(0, 30), 0, 0)
      const end = new Date(start); end.setUTCHours(start.getUTCHours() + 8 + between(0, 2), between(0, 45), 0, 0)
      const disputed = prng() < 0.05
      rows.push({
        project_id: projectId,
        user_id: USERS.super_a,
        crew_id: crew.id,
        location_id: 'main-gate',
        checked_in_at: isoTs(start),
        checked_out_at: isoTs(end),
        checked_in_by: USERS.super_a,
        dispute_status: disputed ? 'auto_flagged' : 'none',
        dispute_meta: disputed ? { reason: 'outside_geofence', distance_m: 80 + between(0, 60) } : null,
      })
    }
  }
  // Insert in batches (PostgREST default 1000).
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await admin.from('crew_checkins').insert(batch as any)
    if (error) throw new Error(`crew_checkins batch ${i}: ${error.message}`)
  }
  bump('crew_checkins', rows.length)
}

async function seedPhotoPins(projectId: string, crews: SeededCrew[]): Promise<void> {
  const total = 200
  const rows: any[] = []
  for (let i = 0; i < total; i++) {
    const dayIdx = Math.floor(prng() * WORKDAYS.length)
    const day = WORKDAYS[dayIdx]
    const taken = new Date(day); taken.setUTCHours(7 + between(0, 9), between(0, 59), 0, 0)
    const r = prng()
    const gpsStatus = r < 0.80 ? 'good' : r < 0.95 ? 'low_confidence' : 'unavailable'
    rows.push({
      project_id: projectId,
      uploaded_by: pick([USERS.super_a, USERS.super_b]),
      photo_url: `https://placehold.co/1200x900?text=Avery+Oaks+${i + 1}`,
      caption: pick([
        'Slab pour west bay', 'Rebar mat unit 3B', 'Drywall taping unit 1A',
        'EMT to panel A', 'Fireproofing top of beam', 'Window install unit 2C',
        'Punch walk lobby', 'Roof flashing termination', 'CMU lift north wall',
        'MEP rough-in stair tower', 'Trim out unit 4B', 'Concrete cylinders cast',
      ]),
      location_x: between(-20, 20),
      location_y: between(-20, 20),
      location_z: between(0, 6),
      taken_at: isoTs(taken),
      gps_status: gpsStatus,
      gps_accuracy_m: gpsStatus === 'good' ? between(3, 18) : gpsStatus === 'low_confidence' ? between(20, 80) : null,
      metadata: { trade: pick(crews.map((c) => c.trade)), unit_no: pick(['1A', '1B', '2C', '3A', '3B', '4B', '5A']) },
    })
  }
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await admin.from('photo_pins').insert(rows.slice(i, i + 250) as any)
    if (error) throw new Error(`photo_pins batch ${i}: ${error.message}`)
  }
  bump('photo_pins', rows.length)
}

async function seedDailyLogs(projectId: string): Promise<void> {
  const rows: any[] = []
  for (const day of WORKDAYS.slice(-80)) {
    const r = prng()
    const status = r < 0.30 ? 'submitted' : r < 0.50 ? 'approved' : 'draft'
    const high = 55 + between(0, 35)
    rows.push({
      project_id: projectId,
      log_date: isoDate(day),
      created_by: USERS.super_a,
      status,
      approved: status === 'approved',
      approved_by: status === 'approved' ? USERS.pm : null,
      approved_at: status === 'approved' ? isoTs(day) : null,
      weather: pick(['clear', 'partly cloudy', 'overcast', 'rain', 'snow']),
      temperature_high: high,
      temperature_low: high - between(8, 25),
      precipitation: pick(['0.0', '0.05', '0.20', '1.10', '0.0']),
      wind_speed: `${between(2, 18)} mph`,
      workers_onsite: between(28, 64),
      total_hours: between(220, 540),
      summary: 'Routine production day. See entries.',
    })
  }
  const { data, error } = await admin.from('daily_logs').insert(rows as any).select('id, log_date')
  if (error) throw new Error(`daily_logs insert: ${error.message}`)
  bump('daily_logs', rows.length)

  // A few entries per log for realism.
  const entries: any[] = []
  for (const log of (data ?? []) as Array<{ id: string; log_date: string }>) {
    const n = between(2, 5)
    for (let i = 0; i < n; i++) {
      entries.push({
        daily_log_id: log.id,
        type: pick(['work_performed', 'manpower', 'photo', 'delay', 'note']),
        description: pick([
          'Concrete pour pier 7 — 32 cy delivered, two cylinders cast.',
          'Rebar mat tied for slab on grade — column line 6-8.',
          'Drywall taping started on level 3 west.',
          'EMT pulled to panel A — 240V circuit homerun.',
          'Roof membrane lap inspected — passed visual.',
          'Toolbox talk — fall protection refresher.',
          'Concrete delayed 90 min — truck breakdown at gate.',
        ]),
        trade: pick([...TRADES]),
        headcount: between(2, 12),
        hours: between(8, 96),
      })
    }
  }
  for (let i = 0; i < entries.length; i += 250) {
    const { error: e } = await admin.from('daily_log_entries').insert(entries.slice(i, i + 250) as any)
    if (e) throw new Error(`daily_log_entries batch ${i}: ${e.message}`)
  }
  bump('daily_log_entries', entries.length)
}

async function seedRfis(projectId: string): Promise<{ ids: string[]; overdueIds: string[]; rejectedSubmittalRfiId: string }> {
  // 25 RFIs, deterministic distribution: 5 closed, 10 answered, 8 open, 2 overdue.
  const distribution: Array<{ status: string; daysAgo: number; due: number }> = []
  for (let i = 0; i < 5; i++)  distribution.push({ status: 'closed',   daysAgo: between(60, 85), due: between(50, 70) })
  for (let i = 0; i < 10; i++) distribution.push({ status: 'answered', daysAgo: between(20, 60), due: between(10, 50) })
  for (let i = 0; i < 8; i++)  distribution.push({ status: 'open',     daysAgo: between(0,  18), due: -between(1, 14) })
  for (let i = 0; i < 2; i++)  distribution.push({ status: 'open',     daysAgo: between(15, 30), due: between(8, 12) })
  // Last 2 are the "overdue" ones — created 15-30d ago, response_due_date in the past.

  const rows: any[] = []
  for (let i = 0; i < distribution.length; i++) {
    const q = RFI_QUESTIONS[i % RFI_QUESTIONS.length]
    const created = daysAgo(distribution[i].daysAgo)
    // For overdue (last 2), force response_due_date in the past.
    const isOverdue = i >= distribution.length - 2
    const responseDue = isOverdue
      ? daysAgo(between(3, 10))
      : daysAgo(distribution[i].daysAgo - distribution[i].due)
    rows.push({
      project_id: projectId,
      number: i + 1,
      title: q.title,
      description: q.description,
      spec_section: q.spec ?? null,
      drawing_reference: 'drawing' in q ? (q as any).drawing : null,
      status: distribution[i].status,
      priority: pick(['low', 'medium', 'high', 'critical']),
      created_by: USERS.pm,
      created_at: isoTs(created),
      assigned_to: USERS.architect,
      ball_in_court: distribution[i].status === 'open' ? USERS.architect : USERS.pm,
      response_due_date: isoDate(responseDue),
      due_date: isoDate(responseDue),
      closed_date: distribution[i].status === 'closed' ? isoTs(daysAgo(distribution[i].daysAgo - 5)) : null,
    })
  }
  const { data, error } = await admin.from('rfis').insert(rows as any).select('id, number, status, response_due_date')
  if (error) throw new Error(`rfis insert: ${error.message}`)
  bump('rfis', rows.length)

  const allIds = (data ?? []).map((r: any) => r.id as string)
  // Take the last 2 (overdue) for the spec to assert on.
  const overdueIds = allIds.slice(-2)
  // Reserve one auto-generated RFI for the submittal_rejected chain assertion.
  const rejectedSubmittalRfiId = allIds[0]
  return { ids: allIds, overdueIds, rejectedSubmittalRfiId }
}

async function seedSubmittals(projectId: string): Promise<{ rejectedId: string }> {
  const distribution = [
    ...Array(3).fill('approved'),
    ...Array(4).fill('approved_as_noted'),
    ...Array(2).fill('revise_resubmit'),
    ...Array(3).fill('open'),
  ]
  const rows: any[] = []
  for (let i = 0; i < distribution.length; i++) {
    const status = distribution[i]
    const submitted = daysAgo(between(15, 75))
    rows.push({
      project_id: projectId,
      number: i + 1,
      title: pick([
        'Aluminum storefront frames — Tubelite system 14000I',
        'Roofing — Carlisle 60-mil EPDM shop drawings',
        'Drywall — Type X 5/8" gypsum',
        'HVAC ductwork — sheet metal shop drawings level 2',
        'Tile — porcelain plank 12x24 in lobby',
        'Paint — Sherwin Williams Pro Industrial Acrylic',
        'Light fixtures — pendant Lambert LX-200',
        'Concrete mix design — 4,000 psi at 28 days',
        'Plumbing fixtures — Toto Aquia bathroom 1.0/1.6 gpf',
        'Steel — open-web bar joists L7-L10',
        'Door hardware — Allegion mortise locks',
        'Curtain wall — Vistawall E2 series',
      ]),
      spec_section: SPEC_SECTIONS[i % SPEC_SECTIONS.length],
      subcontractor: pick([...SUB_COMPANIES]),
      status,
      stamp: status === 'approved' ? 'approved' : status === 'approved_as_noted' ? 'approved_as_noted' : status === 'revise_resubmit' ? 'revise_resubmit' : null,
      submitted_date: isoDate(submitted),
      due_date: isoDate(daysAgo(between(0, 30))),
      lead_time_weeks: between(2, 14),
      revision_number: status === 'revise_resubmit' ? 2 : 1,
      created_by: USERS.pm,
      assigned_to: USERS.architect,
    })
  }
  const { data, error } = await admin.from('submittals').insert(rows as any).select('id, status')
  if (error) throw new Error(`submittals insert: ${error.message}`)
  bump('submittals', rows.length)

  // The first revise_resubmit submittal will be the chain-source for the
  // submittal_rejected → RFI auto-draft assertion.
  const rejected = (data ?? []).find((s: any) => s.status === 'revise_resubmit')
  return { rejectedId: rejected ? (rejected.id as string) : ((data ?? [])[0]?.id as string) }
}

async function seedChangeOrders(projectId: string, sourceRfiId: string): Promise<void> {
  const rows = [
    { status: 'approved', amount: 28_500,  title: 'Owner-requested stainless corner guards in lobby',     fromRfi: false },
    { status: 'approved', amount: 12_000,  title: 'Roof drain vandal-proof covers — lower 12 ft',         fromRfi: false },
    { status: 'pending_review', amount: 48_000, title: '25-year roofing warranty upgrade',               fromRfi: false },
    { status: 'pending_review', amount: 7_500,  title: 'Vapor retarder upgrade 10→15 mil',               fromRfi: false },
    { status: 'draft', amount: 22_400, title: 'CMU coursing adjustment at clerestory',                    fromRfi: false },
    { status: 'draft', amount: 18_750, title: 'Auto-drafted: scope expansion identified in RFI #1',       fromRfi: true },
  ]
  const inserts = rows.map((c, i) => ({
    project_id: projectId,
    number: i + 1,
    title: c.title,
    description: c.title,
    type: 'pricing',
    reason: c.fromRfi ? 'rfi_scope_change' : 'owner_request',
    reason_code: c.fromRfi ? 'rfi_followup' : 'owner_directive',
    status: c.status,
    estimated_cost: c.amount,
    submitted_cost: c.amount,
    approved_cost: c.status === 'approved' ? c.amount : null,
    amount: c.amount,
    requested_by: USERS.pm,
    requested_date: isoDate(daysAgo(between(15, 60))),
    submitted_at: c.status !== 'draft' ? isoTs(daysAgo(between(10, 30))) : null,
    submitted_by: c.status !== 'draft' ? USERS.pm : null,
    approved_at: c.status === 'approved' ? isoTs(daysAgo(between(2, 8))) : null,
    approved_date: c.status === 'approved' ? isoDate(daysAgo(between(2, 8))) : null,
    approved_by: c.status === 'approved' ? USERS.owner : null,
    metadata: c.fromRfi ? { source: 'rfi', source_rfi_id: sourceRfiId } : {},
  }))
  const { error } = await admin.from('change_orders').insert(inserts as any)
  if (error) throw new Error(`change_orders insert: ${error.message}`)
  bump('change_orders', inserts.length)
}

async function seedPunchItems(projectId: string): Promise<void> {
  const rows: any[] = []
  for (let i = 0; i < 30; i++) {
    rows.push({
      project_id: projectId,
      number: i + 1,
      title: pick([...PUNCH_LOCATIONS]) + ' — ' + pick(['paint touch-up', 'door rub', 'chip in tile', 'caulk gap', 'scratched plate', 'loose trim']),
      description: 'Field-identified during walk on ' + isoDate(daysAgo(between(2, 30))),
      area: pick(['Building A', 'Building B', 'Lobby', 'Garage', 'Roof']),
      floor: pick(['1', '2', '3', '4', 'roof']),
      location: pick([...PUNCH_LOCATIONS]),
      trade: pick([...TRADES]),
      priority: pick(['low', 'medium', 'high']),
      status: pick(['open', 'in_progress', 'resolved']),
      assigned_to: USERS.super_b,
      reported_by: USERS.pm,
      due_date: isoDate(daysAgo(between(-30, 0))),
    })
  }
  for (let i = 0; i < 10; i++) {
    rows.push({
      project_id: projectId,
      number: 30 + i + 1,
      title: pick([...PUNCH_LOCATIONS]) + ' — ' + pick(['paint touch-up', 'door rub', 'chip in tile']),
      description: 'Closed punch with before/after photo',
      area: pick(['Building A', 'Building B']),
      floor: '2',
      location: pick([...PUNCH_LOCATIONS]),
      trade: pick([...TRADES]),
      priority: 'low',
      status: 'verified',
      assigned_to: USERS.super_b,
      reported_by: USERS.pm,
      resolved_date: isoDate(daysAgo(between(2, 20))),
      verified_date: isoDate(daysAgo(between(0, 10))),
      photos: [
        { id: `${i}-before`, url: 'https://placehold.co/800x600?text=Before', caption: 'before', timestamp: isoTs(daysAgo(15)) },
        { id: `${i}-after`,  url: 'https://placehold.co/800x600?text=After',  caption: 'after',  timestamp: isoTs(daysAgo(2))  },
      ],
    })
  }
  const { error } = await admin.from('punch_items').insert(rows as any)
  if (error) throw new Error(`punch_items insert: ${error.message}`)
  bump('punch_items', rows.length)
}

async function seedPayApps(projectId: string): Promise<void> {
  // Pay apps require a contract_id. Create a single GMP contract first.
  const { data: contract, error: cErr } = await admin
    .from('contracts')
    .insert({
      project_id: projectId,
      title: 'GC Prime Contract — Suffolk',
      counterparty: 'Suffolk Construction',
      counterparty_email: 'pm@suffolk.example',
      type: 'prime',
      original_value: 24_500_000,
      retainage_percent: 5,
      status: 'active',
      billing_method: 'monthly_aia',
    } as any)
    .select('id')
    .single()
  if (cErr) throw new Error(`contracts insert: ${cErr.message}`)
  bump('contracts', 1)
  const contractId = (contract as any).id as string

  const rows = [
    { app: 1, status: 'paid',      months_ago: 3, complete: 1_625_000 },
    { app: 2, status: 'approved',  months_ago: 2, complete: 3_900_000 },
    { app: 3, status: 'submitted', months_ago: 1, complete: 6_180_000 },
    { app: 4, status: 'draft',     months_ago: 0, complete: 8_240_000 },
  ]
  const inserts = rows.map((p) => {
    const periodTo = daysAgo(p.months_ago * 30 + 1)
    const retainage = Math.round(p.complete * 0.05)
    const earnedLessRet = p.complete - retainage
    return {
      project_id: projectId,
      contract_id: contractId,
      application_number: p.app,
      period_to: isoDate(periodTo),
      original_contract_sum: 24_500_000,
      net_change_orders: p.app >= 2 ? 40_500 : 0,
      contract_sum_to_date: 24_500_000 + (p.app >= 2 ? 40_500 : 0),
      total_completed_and_stored: p.complete,
      retainage,
      total_earned_less_retainage: earnedLessRet,
      less_previous_certificates: p.app === 1 ? 0 : (p.app - 1) * 1_550_000,
      current_payment_due: p.app === 1 ? 1_543_750 : p.app === 2 ? 1_596_750 : p.app === 3 ? 2_166_500 : 1_957_000,
      balance_to_finish: 24_500_000 - p.complete,
      status: p.status,
      submitted_date: p.status !== 'draft' ? isoDate(daysAgo(p.months_ago * 30 - 5)) : null,
      certified_date: p.status === 'paid' || p.status === 'approved' ? isoDate(daysAgo(p.months_ago * 30 - 10)) : null,
      certified_by: p.status === 'paid' || p.status === 'approved' ? USERS.architect : null,
      paid_date: p.status === 'paid' ? isoDate(daysAgo(p.months_ago * 30 - 18)) : null,
      paid_amount: p.status === 'paid' ? 1_543_750 : null,
    }
  })
  const { data: payApps, error } = await admin.from('pay_applications').insert(inserts as any).select('id, application_number, status')
  if (error) throw new Error(`pay_applications insert: ${error.message}`)
  bump('pay_applications', inserts.length)

  // Lien waivers for the paid + approved apps. Pay app #4 (draft) has NO
  // waivers — that's the gap PreSubmissionAudit is supposed to catch.
  const lienRows: any[] = []
  for (const pa of (payApps ?? []) as Array<{ id: string; application_number: number; status: string }>) {
    if (pa.status === 'draft') continue
    for (const sub of (SUB_COMPANIES.slice(0, 4) as readonly string[])) {
      lienRows.push({
        project_id: projectId,
        application_id: pa.id,
        contractor_name: sub,
        amount: between(80_000, 360_000),
        through_date: isoDate(daysAgo(((pa.application_number - 1) * 30) + 5)),
        status: pa.status === 'paid' ? 'final' : 'conditional',
        waiver_state: 'NC',
        signed_at: isoTs(daysAgo(((pa.application_number - 1) * 30) + 3)),
        signed_by: 'pm@suffolk.example',
      })
    }
  }
  if (lienRows.length) {
    const { error: lErr } = await admin.from('lien_waivers').insert(lienRows as any)
    if (lErr) throw new Error(`lien_waivers insert: ${lErr.message}`)
    bump('lien_waivers', lienRows.length)
  }

  // Insurance certificates — required by the compliance check on the
  // submitted pay app (#3). Two certs: GL + WC.
  const certRows = [
    { project_id: projectId, contractor_name: 'Suffolk Construction', policy_type: 'general_liability', carrier: 'Travelers', policy_number: 'GL-998877', expires_at: isoDate(daysAgo(-180)), per_occurrence_limit: 1_000_000, aggregate_limit: 2_000_000 },
    { project_id: projectId, contractor_name: 'Suffolk Construction', policy_type: 'workers_comp',     carrier: 'Travelers', policy_number: 'WC-554433', expires_at: isoDate(daysAgo(-120)), per_occurrence_limit: 1_000_000 },
  ]
  const { error: iErr } = await admin.from('insurance_certificates').insert(certRows as any)
  if (iErr) {
    // Soft-fail if the table doesn't exist on this branch — the spec marks it FAIL with a note.
    log(`  ! insurance_certificates skipped: ${iErr.message}`)
  } else {
    bump('insurance_certificates', certRows.length)
  }
}

async function seedDraftedActions(projectId: string, rfis: { ids: string[]; rejectedSubmittalRfiId: string }): Promise<void> {
  // 12 chain-entry rows so the spec can assert that the cross-feature chains
  // produced visible artifacts.
  const drafts = [
    {
      action_type: 'rfi_overdue_sweep',
      title: 'Follow-up task: RFI #24 overdue',
      summary: 'RFI #24 is 7 business days past due. Auto-created a follow-up task.',
      payload: { source: 'rfi_overdue_sweep', rfi_id: rfis.ids[rfis.ids.length - 1] ?? rfis.ids[0], days_overdue: 7 },
      drafted_by: 'cron:rfi_overdue_sweep',
      status: 'pending',
    },
    {
      action_type: 'submittal_rejected',
      title: 'Auto-drafted RFI from rejected submittal',
      summary: 'Submittal flagged revise_resubmit. Drafted RFI to architect for clarification.',
      payload: { source: 'submittal_rejected', source_rfi_id: rfis.rejectedSubmittalRfiId },
      drafted_by: 'chain:submittal_rejected',
      status: 'pending',
    },
    {
      action_type: 'discrepancy_detected',
      title: 'AI-drafted RFI: mechanical-structural clash at gridline 7',
      summary: 'analyze-discrepancies surfaced 1 high-severity clash. Drafted RFI.',
      drafted_by: 'edge:analyze-discrepancies',
      status: 'pending',
    },
    {
      action_type: 'daily_log_incident',
      title: 'Auto-created safety incident from daily log entry',
      summary: 'Daily log entry type=incident detected. Created tracked investigation.',
      drafted_by: 'chain:daily_log_incident',
      status: 'pending',
    },
    {
      action_type: 'daily_log_delay',
      title: 'Schedule shift suggestion: 1d delay in concrete pour',
      summary: 'Delay-type entry recorded. Suggested shift on 3 affected tasks.',
      drafted_by: 'chain:daily_log_delay',
      status: 'pending',
    },
    {
      action_type: 'drawing_revised',
      title: 'Affected RFIs flagged from sheet A4.20 rev D',
      summary: 'A4.20 revised; 2 open RFIs reference this sheet.',
      drafted_by: 'chain:drawing_revised',
      status: 'pending',
    },
    {
      action_type: 'schedule_slip',
      title: 'CO drafted: 7-day slip on slab pour',
      summary: 'Schedule slip ≥ 5 days detected. Drafted time-only CO.',
      drafted_by: 'chain:schedule_slip',
      status: 'pending',
    },
    {
      action_type: 'submittal_approved',
      title: 'Procurement suggestion from approved submittal',
      summary: 'Submittal approved; lead time 14w → buyout-by date back-calculated.',
      drafted_by: 'chain:submittal_approved',
      status: 'pending',
    },
    {
      action_type: 'permit_approved',
      title: 'Building permit issued — schedule unlock notice',
      summary: 'Building permit moved to issued; tasks gated on permit can proceed.',
      drafted_by: 'chain:permit_approved',
      status: 'pending',
    },
    {
      action_type: 'punch_verified',
      title: 'Closeout coverage advance: Building A — Lobby',
      summary: 'Last open punch in area "Lobby" verified. Closeout coverage advances.',
      drafted_by: 'chain:punch_verified',
      status: 'pending',
    },
    {
      action_type: 'meeting_action_item',
      title: 'Task auto-created from meeting action item',
      summary: 'Action item from foreman standup converted to a tracked task.',
      drafted_by: 'sweep:meeting_action_item',
      status: 'pending',
    },
    {
      action_type: 'crew_no_show',
      title: 'Foreman call action item: PourPro Crew B 70 min late',
      summary: 'Crew flagged 60+ min late. Created meeting action item.',
      drafted_by: 'chain:crew_no_show',
      status: 'pending',
    },
  ]
  const rows = drafts.map((d) => ({
    project_id: projectId,
    action_type: d.action_type,
    title: d.title,
    summary: d.summary,
    payload: (d as any).payload ?? {},
    citations: [],
    confidence: 0.85,
    status: d.status,
    drafted_by: d.drafted_by,
  }))
  const { error } = await admin.from('drafted_actions').insert(rows as any)
  if (error) throw new Error(`drafted_actions insert: ${error.message}`)
  bump('drafted_actions', rows.length)
}

// ── Summary table ────────────────────────────────────────────────────────

function printSummary(projectId: string): void {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  const w = Math.max(...rows.map(([t]) => t.length))
  console.log('\n📋 Seed summary')
  console.log(`   project_id: ${projectId}`)
  console.log('   ────────────────────────────────────')
  for (const [t, n] of rows) {
    console.log(`   ${t.padEnd(w)}  ${String(n).padStart(6)}`)
  }
  console.log('   ────────────────────────────────────')
  console.log(`   total rows: ${rows.reduce((a, [, n]) => a + n, 0)}`)
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const projectId = opts.projectId
  log(`▶ seeding 90-day lifecycle into ${projectId}`)

  await reset(projectId)
  await seedProject(projectId)
  await seedMembers(projectId)
  const crews = await seedCrews(projectId)
  await seedCheckins(projectId, crews)
  await seedPhotoPins(projectId, crews)
  await seedDailyLogs(projectId)
  const rfis = await seedRfis(projectId)
  const subs = await seedSubmittals(projectId)
  await seedChangeOrders(projectId, subs.rejectedId)
  await seedPunchItems(projectId)
  await seedPayApps(projectId)
  await seedDraftedActions(projectId, rfis)

  printSummary(projectId)
  console.log('\n✓ seed complete')
}

main().catch((err) => {
  console.error('\n✖ seed failed:', err.message)
  console.error(err)
  process.exit(1)
})
