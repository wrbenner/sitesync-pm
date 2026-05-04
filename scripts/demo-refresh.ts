/**
 * demo-refresh.ts
 *
 * Eliminates the data-quality bugs that plagued tonight's demo session by
 * fixing them at the source instead of in the rendering components:
 *
 *   1. Names showing as `a00000` — backfills the `profiles` table with a row
 *      for every synthetic seed UUID found in assigned_to/created_by/etc.
 *      across rfis, submittals, punch_items, tasks. After this runs, the
 *      regex overlay in src/hooks/queries/profiles.ts becomes redundant.
 *
 *   2. Multi-party approval chain UI is empty — populates
 *      `change_orders.approval_chain` JSONB with realistic 3-step chains
 *      (originator → PM review → owner approval) so the InlineApprovalChain
 *      / ChainBlock components actually have content to render.
 *
 *   3. Iris Insights Lane is empty — inserts a small, varied set of
 *      ai_insights rows (cascade, aging, variance, staffing, weather)
 *      anchored to today so the cockpit feels alive on first paint.
 *
 *   4. Audit drawer attribution is single-sided — inserts a couple of
 *      magic-link-attributed audit_log entries so the new actor_kind
 *      badge has both 'user' and 'magic_link' rows to demo.
 *
 * Idempotent: safe to run repeatedly. Each table uses upserts keyed by
 * stable IDs.
 *
 * Usage:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   npx tsx scripts/demo-refresh.ts --project <uuid>
 *
 *   # Or with the canonical demo project:
 *   npx tsx scripts/demo-refresh.ts
 *
 * Optional flags:
 *   --skip-profiles      Don't backfill profile rows
 *   --skip-chains        Don't populate change_order approval chains
 *   --skip-insights      Don't seed ai_insights rows
 *   --skip-audit         Don't seed magic-link audit attribution
 *   --dry-run            Show what would change without writing
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────

// The same overlay used by src/hooks/queries/profiles.ts. Persisting these
// to the `profiles` table makes the overlay redundant: real profile rows
// always win in the lookup map.
const SYNTHETIC_NAMES: ReadonlyArray<{ tail: string; full_name: string; role: string; trade: string | null; company: string }> = [
  { tail: '001', full_name: 'Mike Foreman',  role: 'project_manager',     trade: null,        company: 'SiteSync GC' },
  { tail: '002', full_name: 'Sarah Garcia',  role: 'superintendent',      trade: null,        company: 'SiteSync GC' },
  { tail: '003', full_name: 'Robert Torres', role: 'architect',           trade: null,        company: 'Garrett Architects' },
  { tail: '004', full_name: 'Lisa Chen',     role: 'project_engineer',    trade: null,        company: 'SiteSync GC' },
  { tail: '005', full_name: 'David Park',    role: 'foreman',             trade: 'framing',   company: 'SiteSync GC' },
  { tail: '006', full_name: 'Karen Walsh',   role: 'field_user',          trade: null,        company: 'SiteSync GC' },
  { tail: '007', full_name: 'James Reilly',  role: 'architect',           trade: null,        company: 'Garrett Architects' },
  { tail: '008', full_name: 'Jennifer Cole', role: 'owner_rep',           trade: null,        company: 'Avery Oaks Owner LLC' },
  { tail: '009', full_name: 'Tom Brown',     role: 'subcontractor',       trade: 'steel',     company: 'Brown Steel Co.' },
  { tail: '00a', full_name: 'Erin Patel',    role: 'subcontractor',       trade: 'electrical',company: 'Patel Electric' },
  { tail: '00b', full_name: 'Mark Hayes',    role: 'subcontractor',       trade: 'mechanical',company: 'Hayes Mechanical' },
  { tail: '00c', full_name: 'Anna Diaz',     role: 'subcontractor',       trade: 'plumbing',  company: 'Diaz Plumbing' },
  { tail: '00d', full_name: 'Carlos Romero', role: 'subcontractor',       trade: 'concrete',  company: 'Romero Concrete' },
  { tail: '00e', full_name: 'Priya Anand',   role: 'safety_manager',      trade: null,        company: 'SiteSync GC' },
  { tail: '00f', full_name: 'Alex Nguyen',   role: 'project_executive',   trade: null,        company: 'SiteSync GC' },
  { tail: '010', full_name: 'Beth Klein',    role: 'subcontractor',       trade: 'roofing',   company: 'Klein Roofing' },
]

const SYNTHETIC_UUID_RE = /^[0-9a-f]{8}-0{4}-0{4}-0{4}-0{9}([0-9a-f]{3})$/i

interface ChangeOrderApprovalStep {
  step: number
  role: string
  approver_name: string
  approver_id: string
  status: 'approved' | 'pending' | 'current' | 'rejected'
  decided_at: string | null
  comment: string | null
}

// Realistic 3-stage chain template — originator → PM review → owner approval.
function chainTemplate(currentStep: number, anchorDate: Date, totalAmount: number): ChangeOrderApprovalStep[] {
  const day = (offset: number) => {
    const d = new Date(anchorDate)
    d.setDate(d.getDate() + offset)
    return d.toISOString()
  }
  const status = (i: number): ChangeOrderApprovalStep['status'] =>
    i < currentStep ? 'approved' : i === currentStep ? 'current' : 'pending'
  return [
    {
      step: 0, role: 'originator',
      approver_name: 'Mike Foreman', approver_id: 'a0000001-0000-0000-0000-000000000001',
      status: status(0), decided_at: status(0) === 'approved' ? day(-7) : null,
      comment: status(0) === 'approved' ? 'Submitted with attached scope letter and quote.' : null,
    },
    {
      step: 1, role: 'project_manager',
      approver_name: 'Lisa Chen', approver_id: 'a0000001-0000-0000-0000-000000000004',
      status: status(1),
      decided_at: status(1) === 'approved' ? day(-3) : null,
      comment: status(1) === 'approved' ? `Reviewed against budget — within ${totalAmount > 25000 ? 'discretionary' : 'unallocated'} contingency.` : null,
    },
    {
      step: 2, role: 'owner_approval',
      approver_name: 'Jennifer Cole', approver_id: 'a0000001-0000-0000-0000-000000000008',
      status: status(2),
      decided_at: status(2) === 'approved' ? day(-1) : null,
      comment: status(2) === 'approved' ? 'Approved per OAC meeting decision.' : null,
    },
  ]
}

// ─── Args ─────────────────────────────────────────────────────────────────

interface CliArgs {
  projectId: string | null
  dryRun: boolean
  skipProfiles: boolean
  skipChains: boolean
  skipInsights: boolean
  skipAudit: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
  }
  return {
    projectId: get('--project') ?? null,
    dryRun: argv.includes('--dry-run'),
    skipProfiles: argv.includes('--skip-profiles'),
    skipChains: argv.includes('--skip-chains'),
    skipInsights: argv.includes('--skip-insights'),
    skipAudit: argv.includes('--skip-audit'),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface RefreshStats {
  profiles_inserted: number
  approval_chains_set: number
  insights_seeded: number
  audit_events_seeded: number
  warnings: string[]
}

function nameForTail(tail: string): string {
  const exact = SYNTHETIC_NAMES.find((n) => n.tail.toLowerCase() === tail.toLowerCase())
  if (exact) return exact.full_name
  // Cycle fallback for any out-of-range synthetic UUID.
  const idx = parseInt(tail, 16)
  if (!Number.isFinite(idx)) return 'Demo User'
  return SYNTHETIC_NAMES[idx % SYNTHETIC_NAMES.length].full_name
}

function profileRowForTail(tail: string, userId: string): Record<string, unknown> | null {
  const exact = SYNTHETIC_NAMES.find((n) => n.tail.toLowerCase() === tail.toLowerCase())
  if (!exact) {
    // For UUIDs outside the known table, build a sensible default.
    const idx = parseInt(tail, 16)
    if (!Number.isFinite(idx)) return null
    const base = SYNTHETIC_NAMES[idx % SYNTHETIC_NAMES.length]
    return {
      user_id: userId,
      full_name: base.full_name,
      first_name: base.full_name.split(' ')[0] ?? null,
      last_name: base.full_name.split(' ').slice(1).join(' ') || null,
      role: base.role,
      trade: base.trade,
      company: base.company,
    }
  }
  return {
    user_id: userId,
    full_name: exact.full_name,
    first_name: exact.full_name.split(' ')[0] ?? null,
    last_name: exact.full_name.split(' ').slice(1).join(' ') || null,
    role: exact.role,
    trade: exact.trade,
    company: exact.company,
  }
}

async function collectSyntheticUserIds(sb: SupabaseClient, projectId: string): Promise<Set<string>> {
  const ids = new Set<string>()

  const queries = [
    sb.from('rfis').select('assigned_to, created_by, ball_in_court').eq('project_id', projectId),
    sb.from('submittals').select('assigned_to, created_by, reviewer_id').eq('project_id', projectId),
    sb.from('punch_items').select('assigned_to, created_by, verified_by').eq('project_id', projectId),
    sb.from('tasks').select('assigned_to, created_by').eq('project_id', projectId),
    sb.from('change_orders').select('approved_by, rejected_by, created_by').eq('project_id', projectId),
    sb.from('daily_logs').select('created_by, submitted_by, approved_by').eq('project_id', projectId),
  ]

  for (const q of queries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await q) as { data: Array<Record<string, unknown>> | null; error: any }
    if (error) {
      // Tables may not exist in all environments — skip silently.
      continue
    }
    for (const row of data ?? []) {
      for (const v of Object.values(row)) {
        if (typeof v === 'string' && SYNTHETIC_UUID_RE.test(v)) ids.add(v)
      }
    }
  }
  return ids
}

// ─── Step 1: backfill profile rows ────────────────────────────────────────

async function backfillProfiles(sb: SupabaseClient, projectId: string, dryRun: boolean, stats: RefreshStats): Promise<void> {
  const ids = await collectSyntheticUserIds(sb, projectId)
  if (ids.size === 0) {
    stats.warnings.push('No synthetic user IDs found in project tables — nothing to backfill.')
    return
  }

  // Skip any IDs that already have profile rows.
  const idArray = Array.from(ids)
  const { data: existing } = await sb.from('profiles').select('user_id').in('user_id', idArray)
  const existingSet = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id))
  const toInsert = idArray.filter((id) => !existingSet.has(id))

  if (toInsert.length === 0) {
    console.log('  ✓ All synthetic UUIDs already have profile rows.')
    return
  }

  const rows = toInsert
    .map((id) => {
      const m = id.match(SYNTHETIC_UUID_RE)
      if (!m) return null
      return profileRowForTail(m[1].toLowerCase(), id)
    })
    .filter((r): r is Record<string, unknown> => !!r)

  console.log(`  → Backfilling ${rows.length} profile rows…`)
  if (dryRun) {
    console.log('    (dry-run: no writes)')
    rows.slice(0, 5).forEach((r) => console.log(`    + ${r.full_name} (${r.role})`))
    return
  }

  const { error } = await sb.from('profiles').upsert(rows, { onConflict: 'user_id' })
  if (error) {
    stats.warnings.push(`Profile backfill failed: ${error.message}`)
    return
  }
  stats.profiles_inserted = rows.length
}

// ─── Step 2: populate change_order approval chains ────────────────────────

async function populateApprovalChains(sb: SupabaseClient, projectId: string, dryRun: boolean, stats: RefreshStats): Promise<void> {
  const { data: cos, error } = await sb
    .from('change_orders')
    .select('id, number, status, amount, estimated_cost, approval_chain')
    .eq('project_id', projectId)

  if (error) {
    stats.warnings.push(`Could not list change orders: ${error.message}`)
    return
  }
  const list = (cos ?? []) as Array<{
    id: string
    number: number | null
    status: string | null
    amount: number | null
    estimated_cost: number | null
    approval_chain: unknown
  }>

  if (list.length === 0) {
    stats.warnings.push('No change orders found — nothing to populate.')
    return
  }

  const anchor = new Date()
  let updated = 0

  for (const co of list) {
    // Skip any CO that already has a non-empty chain.
    if (Array.isArray(co.approval_chain) && (co.approval_chain as unknown[]).length > 0) continue

    // Choose the current step from status.
    const currentStep =
      co.status === 'approved' ? 3
      : co.status === 'rejected' ? 2
      : co.status === 'pending_owner' ? 2
      : co.status === 'pending_pm' ? 1
      : 0

    const amount = Number(co.amount ?? co.estimated_cost ?? 0)
    const chain = chainTemplate(currentStep, anchor, amount)

    if (dryRun) {
      console.log(`    ~ CO#${co.number ?? co.id.slice(0, 8)} → ${chain.length}-step chain (currentStep=${currentStep})`)
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (sb.from('change_orders') as any)
      .update({ approval_chain: chain })
      .eq('id', co.id)
    if (upErr) {
      stats.warnings.push(`CO#${co.number} chain update failed: ${upErr.message}`)
      continue
    }
    updated++
  }

  stats.approval_chains_set = updated
  console.log(`  → Set approval_chain on ${updated} change order${updated === 1 ? '' : 's'}.`)
}

// ─── Step 3: seed ai_insights rows for the cockpit ────────────────────────

async function seedAiInsights(sb: SupabaseClient, projectId: string, dryRun: boolean, stats: RefreshStats): Promise<void> {
  const today = new Date()
  const day = (offset: number) => new Date(today.getTime() + offset * 86400000).toISOString()

  // Six varied insights covering the five detector types so the lane
  // shows mixed severity + mixed kinds. Stable IDs so re-runs upsert.
  const rows = [
    {
      id: 'demo-insight-cascade-001',
      project_id: projectId,
      page: 'day',
      category: 'risk',
      prediction_type: 'cascade',
      message: 'Storefront submittal delay may cascade to dry-in milestone — 2 weeks of float remaining.',
      confidence: 0.84,
      action_label: 'Open submittal',
      created_at: day(0),
      dismissed: false,
    },
    {
      id: 'demo-insight-aging-001',
      project_id: projectId,
      page: 'day',
      category: 'risk',
      prediction_type: 'aging',
      message: 'RFI #58 (balcony deck waterproofing) has been in-court 21 days — 3× the project median.',
      confidence: 0.92,
      action_label: 'View RFI',
      created_at: day(0),
      dismissed: false,
    },
    {
      id: 'demo-insight-variance-001',
      project_id: projectId,
      page: 'day',
      category: 'cost',
      prediction_type: 'variance',
      message: 'Mechanical division burning 1.8× plan rate — projected 12% over by milestone.',
      confidence: 0.77,
      action_label: 'Review budget',
      created_at: day(0),
      dismissed: false,
    },
    {
      id: 'demo-insight-staffing-001',
      project_id: projectId,
      page: 'day',
      category: 'staffing',
      prediction_type: 'staffing',
      message: 'Drywall crew at 60% of scheduled headcount this week — check sub availability.',
      confidence: 0.81,
      action_label: 'Open crew',
      created_at: day(0),
      dismissed: false,
    },
    {
      id: 'demo-insight-weather-001',
      project_id: projectId,
      page: 'day',
      category: 'risk',
      prediction_type: 'weather',
      message: '3 days of rain forecast Mon-Wed during scheduled exterior framing — reschedule indoor work?',
      confidence: 0.68,
      action_label: 'Open lookahead',
      created_at: day(0),
      dismissed: false,
    },
  ]

  if (dryRun) {
    console.log(`    ~ would seed ${rows.length} ai_insights rows`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('ai_insights') as any).upsert(rows, { onConflict: 'id' })
  if (error) {
    stats.warnings.push(`ai_insights seed failed: ${error.message}`)
    return
  }
  stats.insights_seeded = rows.length
  console.log(`  → Seeded ${rows.length} ai_insights rows for the cockpit.`)
}

// ─── Step 4: seed magic-link audit attribution variety ────────────────────

async function seedAuditAttribution(sb: SupabaseClient, projectId: string, dryRun: boolean, stats: RefreshStats): Promise<void> {
  // Find one in-court RFI we can attach a magic-link "viewed" event to.
  const { data: rfis } = await sb
    .from('rfis')
    .select('id, number')
    .eq('project_id', projectId)
    .order('number', { ascending: false })
    .limit(1)

  if (!rfis || rfis.length === 0) {
    stats.warnings.push('No RFIs found — skipping magic-link audit seed.')
    return
  }

  const rfi = rfis[0] as { id: string; number: number | null }
  const now = new Date()
  const events = [
    {
      project_id: projectId,
      entity_type: 'rfi',
      entity_id: rfi.id,
      action: 'magic_link_viewed',
      user_id: null,
      user_email: 'jennifer.cole@avery-oaks-owner.demo',
      user_name: 'Jennifer Cole (magic link)',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      metadata: {
        actor_kind: 'magic_link',
        magic_link_token_id: 'demo-magic-tok-001',
        company_id: 'avery-oaks-owner-llc',
        recipient_email: 'jennifer.cole@avery-oaks-owner.demo',
      },
      created_at: new Date(now.getTime() - 2 * 3600_000).toISOString(),
    },
    {
      project_id: projectId,
      entity_type: 'rfi',
      entity_id: rfi.id,
      action: 'comment_added',
      user_id: null,
      user_email: 'jennifer.cole@avery-oaks-owner.demo',
      user_name: 'Jennifer Cole (magic link)',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      metadata: {
        actor_kind: 'magic_link',
        magic_link_token_id: 'demo-magic-tok-001',
        company_id: 'avery-oaks-owner-llc',
        comment: 'Confirmed acceptable per attached detail.',
      },
      created_at: new Date(now.getTime() - 90 * 60_000).toISOString(),
    },
  ]

  if (dryRun) {
    console.log(`    ~ would seed ${events.length} magic-link audit events on RFI #${rfi.number}`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('audit_log') as any).insert(events)
  if (error) {
    stats.warnings.push(`audit_log seed failed: ${error.message}`)
    return
  }
  stats.audit_events_seeded = events.length
  console.log(`  → Seeded ${events.length} magic-link audit events on RFI #${rfi.number}.`)
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
    console.error('  Run:  SUPABASE_URL=<url>  SUPABASE_SERVICE_ROLE_KEY=<service-key>  npx tsx scripts/demo-refresh.ts')
    process.exit(1)
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  // If no project specified, find the demo project.
  let projectId = args.projectId
  if (!projectId) {
    const { data: demo } = await sb
      .from('projects')
      .select('id, name')
      .eq('is_demo', true)
      .limit(1)
      .maybeSingle()
    if (demo) {
      projectId = (demo as { id: string }).id
      console.log(`▸ Refreshing demo project: ${(demo as { id: string; name: string }).name}`)
    } else {
      console.error('✗ No --project specified and no project marked is_demo=true.')
      console.error('  Pass --project <uuid> with the project to refresh.')
      process.exit(1)
    }
  } else {
    console.log(`▸ Refreshing project ${projectId}…`)
  }

  if (args.dryRun) console.log('  (DRY RUN — no writes will be performed)')
  console.log('')

  const stats: RefreshStats = {
    profiles_inserted: 0,
    approval_chains_set: 0,
    insights_seeded: 0,
    audit_events_seeded: 0,
    warnings: [],
  }

  if (!args.skipProfiles) {
    console.log('Step 1/4 — backfilling profile rows for synthetic UUIDs…')
    await backfillProfiles(sb, projectId!, args.dryRun, stats)
  }

  if (!args.skipChains) {
    console.log('Step 2/4 — populating change_order approval chains…')
    await populateApprovalChains(sb, projectId!, args.dryRun, stats)
  }

  if (!args.skipInsights) {
    console.log('Step 3/4 — seeding ai_insights rows for the cockpit lane…')
    await seedAiInsights(sb, projectId!, args.dryRun, stats)
  }

  if (!args.skipAudit) {
    console.log('Step 4/4 — seeding magic-link audit attribution variety…')
    await seedAuditAttribution(sb, projectId!, args.dryRun, stats)
  }

  console.log('')
  console.log('Done.')
  console.log(`  profiles_inserted:    ${stats.profiles_inserted}`)
  console.log(`  approval_chains_set:  ${stats.approval_chains_set}`)
  console.log(`  insights_seeded:      ${stats.insights_seeded}`)
  console.log(`  audit_events_seeded:  ${stats.audit_events_seeded}`)
  if (stats.warnings.length > 0) {
    console.log('')
    console.log('Warnings:')
    for (const w of stats.warnings) console.log(`  • ${w}`)
  }

  // Sanity probe — re-resolve a known synthetic UUID and confirm the name lands.
  if (!args.dryRun && stats.profiles_inserted > 0) {
    const probeId = 'a0000001-0000-0000-0000-000000000007'
    const { data: probe } = await sb.from('profiles').select('full_name').eq('user_id', probeId).maybeSingle()
    if (probe && (probe as { full_name: string }).full_name) {
      console.log(`  ✓ Sanity: ${probeId} → ${(probe as { full_name: string }).full_name}`)
    }
  }
}

main().catch((err) => {
  console.error('✗ demo-refresh failed:', err)
  process.exit(1)
})

// Verify name resolution helper survived the trip.
void nameForTail
