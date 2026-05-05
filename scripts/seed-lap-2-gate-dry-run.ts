/**
 * seed-lap-2-gate-dry-run.ts — synthetic data for the 7 spec-mandated
 * gate scenarios. Lets us prove the gate works before real pilot data
 * exists.
 *
 * Each scenario is independent, idempotent, and reversible:
 *   - Inserts rows under deterministic ids the script owns
 *   - --reset deletes only those ids; never touches real data
 *
 * Reference: docs/audits/LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md
 *   § Test plan for the gate itself
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *     npx tsx scripts/seed-lap-2-gate-dry-run.ts \
 *     --scenario=baseline-pass --pilot-org-slug=soft-pilot-gc-tbd
 *
 * Scenarios:
 *   baseline-pass    75 approved + 20 rejected + 5 withdrawn → ~78.9% rate, 60s latency
 *   soft-fail-90s    same counts, 100s latency
 *   hard-fail-130s   same counts, 130s latency
 *   one-incident     adds a critical audit_incidents row
 *   short-volume     99 approvals + 20 rejections (count fail)
 *   resolved-hundred 100 approvals + 20 rejections, no incidents (final pass)
 *   ghost-approval   approval without first_viewed_at (Gate 4 trip)
 *   reset            wipe all script-owned synthetic rows
 *
 * The script uses the org slug 'soft-pilot-gc-tbd' by default — the same
 * placeholder slug the matview filters on. Pass --pilot-org-slug=<real>
 * once the soft-pilot org is recruited to seed against production-shape
 * data on staging.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(2)
}

type Scenario =
  | 'baseline-pass'
  | 'soft-fail-90s'
  | 'hard-fail-130s'
  | 'one-incident'
  | 'short-volume'
  | 'resolved-hundred'
  | 'ghost-approval'
  | 'reset'

const args = new Map<string, string>()
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=')
    args.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? '' : a.slice(eq + 1))
  }
}
const scenario = (args.get('scenario') ?? 'baseline-pass') as Scenario
const pilotOrgSlug = args.get('pilot-org-slug') ?? 'soft-pilot-gc-tbd'

// Deterministic id space the script owns: prefix b002****-****-****-****-************
// This namespace is reserved for gate-dry-run synthetic rows.
const SYNTHETIC_PREFIX = 'b0020000'
const SYNTHETIC_DRAFT_ID = (i: number): string =>
  `${SYNTHETIC_PREFIX}-0000-0000-0000-${i.toString(16).padStart(12, '0')}`
const SYNTHETIC_INCIDENT_ID = `${SYNTHETIC_PREFIX}-0001-0000-0000-000000000001`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface PilotContext {
  orgId: string
  projectId: string
  userId: string
}

async function resolvePilotContext(): Promise<PilotContext> {
  // Find the pilot org by slug.
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', pilotOrgSlug)
    .maybeSingle()
  if (orgErr) throw new Error(`org lookup: ${orgErr.message}`)
  if (!org) {
    throw new Error(
      `pilot org with slug='${pilotOrgSlug}' not found — create it on staging before running this script`,
    )
  }

  // Pick any project in that org. If none, fail loudly — gate seed
  // requires at least one project in the org.
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', org.id)
    .limit(1)
    .maybeSingle()
  if (projErr) throw new Error(`project lookup: ${projErr.message}`)
  if (!project) {
    throw new Error(
      `pilot org ${org.id} has no projects — create one before seeding the gate`,
    )
  }

  // Use the first member of the project as the synthetic decider.
  const { data: member, error: memberErr } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', project.id)
    .limit(1)
    .maybeSingle()
  if (memberErr) throw new Error(`project_members lookup: ${memberErr.message}`)
  if (!member) {
    throw new Error(
      `project ${project.id} has no members — add at least one before seeding`,
    )
  }

  return { orgId: org.id, projectId: project.id, userId: member.user_id }
}

async function resetSynthetic(): Promise<void> {
  // Delete by id-prefix using a range filter. Postgres uuid lexicographic
  // ordering covers our 0x'b0020000…' / 0x'b0020001…' prefixes.
  const lo = `${SYNTHETIC_PREFIX}-0000-0000-0000-000000000000`
  const hi = `${SYNTHETIC_PREFIX}-ffff-ffff-ffff-ffffffffffff`
  const { error: dErr } = await supabase
    .from('drafted_actions')
    .delete()
    .gte('id', lo)
    .lte('id', hi)
  if (dErr) throw new Error(`reset drafted_actions: ${dErr.message}`)
  const { error: iErr } = await supabase
    .from('audit_incidents')
    .delete()
    .gte('id', lo)
    .lte('id', hi)
  if (iErr) throw new Error(`reset audit_incidents: ${iErr.message}`)
  console.log('[seed] reset complete — all synthetic gate rows removed')
}

interface DraftSeed {
  i: number
  status: 'approved' | 'rejected' | 'executed'
  /** Seconds between created_at and decided_at (round-trip latency). */
  latencySec: number
  /** Subtract from latencySec; if positive, becomes time_to_decide_ms. */
  viewLagSec?: number
  /** Auto-withdrawn or aged-out marker for decision_note. */
  noteTag?: 'withdrawn' | 'aged-out'
  /** Skip first_viewed_at (ghost-approval scenario). */
  skipView?: boolean
}

async function seedDrafts(ctx: PilotContext, drafts: DraftSeed[]): Promise<void> {
  const lapStart = new Date('2026-06-04T12:00:00Z') // Day 31 default
  const rows = drafts.map((d) => {
    const createdAt = new Date(lapStart.getTime() + d.i * 60_000) // 1 draft / min
    const viewLag = d.viewLagSec ?? 1 // viewer opened the inbox ~1s after creation
    const firstViewedAt = d.skipView
      ? null
      : new Date(createdAt.getTime() + viewLag * 1000)
    const decidedAt = new Date(createdAt.getTime() + (viewLag + d.latencySec) * 1000)
    const note =
      d.noteTag === 'withdrawn'
        ? '[withdrawn by system] state changed mid-flight'
        : d.noteTag === 'aged-out'
          ? '[aged out: 72h pending]'
          : null
    return {
      id: SYNTHETIC_DRAFT_ID(d.i),
      project_id: ctx.projectId,
      action_type: 'rfi.draft',
      title: `Synthetic gate-dry-run draft #${d.i}`,
      summary: 'Generated by seed-lap-2-gate-dry-run.ts',
      payload: { title: 'synthetic', description: 'synthetic' },
      citations: [],
      confidence: 0.85,
      status: d.status,
      drafted_by: 'iris.gate-dry-run',
      decided_by: ctx.userId,
      decided_at: decidedAt.toISOString(),
      decision_note: note,
      first_viewed_at: firstViewedAt?.toISOString() ?? null,
      viewed_count: d.skipView ? 0 : 1,
      decision_method: 'keyboard',
      required_edits: false,
      created_at: createdAt.toISOString(),
    }
  })

  // Upsert so the script is idempotent across re-runs.
  const { error } = await supabase.from('drafted_actions').upsert(rows, {
    onConflict: 'id',
  })
  if (error) throw new Error(`upsert drafted_actions: ${error.message}`)
  console.log(`[seed] upserted ${rows.length} synthetic drafts (${scenario})`)
}

async function seedIncident(ctx: PilotContext, severity: 'high' | 'critical'): Promise<void> {
  const { error } = await supabase.from('audit_incidents').upsert({
    id: SYNTHETIC_INCIDENT_ID,
    severity,
    category: 'other',
    description: 'Synthetic gate-dry-run incident',
    related_project_id: ctx.projectId,
    detected_by: 'seed-lap-2-gate-dry-run',
    resolved_at: null,
    context: { scenario },
  })
  if (error) throw new Error(`upsert audit_incidents: ${error.message}`)
  console.log(`[seed] upserted critical incident`)
}

async function clearSyntheticIncidents(): Promise<void> {
  const { error } = await supabase
    .from('audit_incidents')
    .update({ resolved_at: new Date().toISOString(), resolution_note: 'gate dry-run reset' })
    .eq('id', SYNTHETIC_INCIDENT_ID)
  if (error) throw new Error(`resolve incident: ${error.message}`)
}

function buildBaseline({
  approved,
  rejected,
  withdrawn,
  latencySec,
}: {
  approved: number
  rejected: number
  withdrawn: number
  latencySec: number
}): DraftSeed[] {
  const drafts: DraftSeed[] = []
  let i = 1
  for (let n = 0; n < approved; n++) {
    drafts.push({ i: i++, status: 'approved', latencySec })
  }
  for (let n = 0; n < rejected; n++) {
    drafts.push({ i: i++, status: 'rejected', latencySec })
  }
  for (let n = 0; n < withdrawn; n++) {
    drafts.push({
      i: i++,
      status: 'rejected',
      latencySec,
      noteTag: 'withdrawn',
    })
  }
  return drafts
}

async function run(): Promise<void> {
  if (scenario === 'reset') {
    await resetSynthetic()
    return
  }

  const ctx = await resolvePilotContext()

  // Always reset our id-space first so consecutive scenario runs don't
  // accumulate stale synthetic rows.
  await resetSynthetic()

  switch (scenario) {
    case 'baseline-pass':
      // 75 approved + 20 rejected + 5 withdrawn → 75 / (75+20) = 78.9%; 60s latency
      await seedDrafts(ctx, buildBaseline({ approved: 75, rejected: 20, withdrawn: 5, latencySec: 60 }))
      break
    case 'soft-fail-90s':
      await seedDrafts(ctx, buildBaseline({ approved: 100, rejected: 20, withdrawn: 0, latencySec: 100 }))
      break
    case 'hard-fail-130s':
      await seedDrafts(ctx, buildBaseline({ approved: 100, rejected: 20, withdrawn: 0, latencySec: 130 }))
      break
    case 'one-incident':
      await seedDrafts(ctx, buildBaseline({ approved: 100, rejected: 20, withdrawn: 0, latencySec: 60 }))
      await seedIncident(ctx, 'critical')
      break
    case 'short-volume':
      await seedDrafts(ctx, buildBaseline({ approved: 99, rejected: 20, withdrawn: 0, latencySec: 60 }))
      break
    case 'resolved-hundred':
      await seedDrafts(ctx, buildBaseline({ approved: 100, rejected: 20, withdrawn: 0, latencySec: 60 }))
      await clearSyntheticIncidents()
      break
    case 'ghost-approval':
      await seedDrafts(ctx, [
        ...buildBaseline({ approved: 100, rejected: 20, withdrawn: 0, latencySec: 60 }),
        { i: 999, status: 'approved', latencySec: 60, skipView: true },
      ])
      break
    default:
      throw new Error(`unknown scenario: ${scenario}`)
  }

  console.log(`[seed] scenario "${scenario}" applied. Run check-lap-2-gate.ts to evaluate.`)
}

run().catch((err) => {
  console.error('seed-lap-2-gate-dry-run failed:', err.message ?? err)
  process.exit(2)
})
