/**
 * provision-pilot-org.ts — Day 49 prep automation.
 *
 * After the pilot agreement is signed, this script:
 *   1. Sets the org's is_soft_pilot=TRUE + soft_pilot_started_at + signed-at.
 *   2. Inserts a pilot_agreements row with the named users + consent.
 *   3. Prints next-step smoke commands (heartbeat sanity, gate seed,
 *      etc.) so Walker can run them in order.
 *
 * The script is idempotent: re-running with the same `--org-slug` and
 * `--pdf-url` updates the existing pilot_agreements row instead of
 * inserting a duplicate.
 *
 * Reference:
 *   docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md § Phase 3 (Day 49 prep)
 *   docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md
 *   docs/audits/pilot-agreement-template-v1.md
 *
 * Usage (idempotent):
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *     npx tsx scripts/provision-pilot-org.ts \
 *       --org-slug=nexus-companies \
 *       --signed-by-name="Brad Cameron" \
 *       --signed-by-email=brad@nexuscompanies.com \
 *       --signed-by-role="Technical Director" \
 *       --signed-at="2026-05-18T15:30:00-05:00" \
 *       --agreement-text-version=v1 \
 *       --pdf-url="https://drive.google.com/file/d/abc/view" \
 *       --pilot-user-ids=<pm1-uuid>,<pm2-uuid>,<sup1-uuid>,<sup2-uuid>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(2)
}

const args = new Map<string, string>()
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=')
    args.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? '' : a.slice(eq + 1))
  }
}

const orgSlug = req('org-slug')
const signedByName = req('signed-by-name')
const signedByEmail = req('signed-by-email')
const signedByRole = args.get('signed-by-role') ?? null
const signedAt = req('signed-at')
const agreementTextVersion = args.get('agreement-text-version') ?? 'v1'
const pdfUrl = args.get('pdf-url') ?? null
const pilotUserIdsStr = req('pilot-user-ids')

if (!/^[\w-]+$/.test(orgSlug)) {
  fatal('--org-slug must be a slug (alphanumerics, dashes, underscores only)')
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signedByEmail)) {
  fatal('--signed-by-email is not a valid email address')
}
if (Number.isNaN(Date.parse(signedAt))) {
  fatal('--signed-at must be an ISO-8601 timestamp')
}
const pilotUserIds = pilotUserIdsStr.split(',').map((s) => s.trim()).filter(Boolean)
if (pilotUserIds.length < 2 || pilotUserIds.length > 8) {
  fatal('--pilot-user-ids must list 2 to 8 uuids (the playbook expects 4)')
}
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
for (const id of pilotUserIds) {
  if (!uuidRe.test(id)) fatal(`pilot user id is not a uuid: ${id}`)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  // 1. Resolve the org by slug.
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, is_soft_pilot, soft_pilot_started_at, soft_pilot_agreement_signed_at')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (orgErr) fatal(`org lookup: ${orgErr.message}`)
  if (!org) fatal(`organization with slug='${orgSlug}' not found`)
  console.log(`[provision] resolved org: ${org.name} (${org.id})`)

  // 2. Verify all pilot users exist.
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', pilotUserIds)
  if (profilesErr) fatal(`profile lookup: ${profilesErr.message}`)
  if ((profiles ?? []).length < pilotUserIds.length) {
    const found = new Set((profiles ?? []).map((p) => p.id))
    const missing = pilotUserIds.filter((id) => !found.has(id))
    fatal(`pilot user(s) not found in profiles: ${missing.join(', ')}`)
  }
  console.log(`[provision] verified ${pilotUserIds.length} pilot users`)

  // 3. Flip the org flag.
  const { error: updErr } = await supabase
    .from('organizations')
    .update({
      is_soft_pilot: true,
      soft_pilot_started_at: new Date().toISOString(),
      soft_pilot_agreement_signed_at: signedAt,
    } as never)
    .eq('id', org.id)
  if (updErr) fatal(`org update: ${updErr.message}`)
  console.log(`[provision] org flagged as soft_pilot`)

  // 4. Insert/update the pilot_agreements row. Idempotent on
  //    (organization_id, agreement_text_version, pdf_url) — the
  //    natural identity of "this signed agreement".
  const consent = {
    telemetry_retention_24mo: true,
    case_study_quote_permission_required: true,
    right_to_erasure: true,
    audit_chain_export: true,
    no_cross_tenant_exposure: true,
    template_version: agreementTextVersion,
  }

  const { data: existing } = await supabase
    .from('pilot_agreements')
    .select('id')
    .eq('organization_id', org.id)
    .eq('agreement_text_version', agreementTextVersion)
    .is('pilot_ended_at', null)
    .maybeSingle()

  if (existing) {
    const { error: updAgErr } = await supabase
      .from('pilot_agreements')
      .update({
        signed_by_name: signedByName,
        signed_by_email: signedByEmail,
        signed_by_role: signedByRole,
        signed_at: signedAt,
        agreement_pdf_url: pdfUrl,
        pilot_user_ids: pilotUserIds,
        data_handling_consent: consent,
      } as never)
      .eq('id', existing.id)
    if (updAgErr) fatal(`pilot_agreement update: ${updAgErr.message}`)
    console.log(`[provision] updated existing agreement row ${existing.id}`)
  } else {
    const { data: created, error: insErr } = await supabase
      .from('pilot_agreements')
      .insert({
        organization_id: org.id,
        signed_by_name: signedByName,
        signed_by_email: signedByEmail,
        signed_by_role: signedByRole,
        signed_at: signedAt,
        agreement_text_version: agreementTextVersion,
        agreement_pdf_url: pdfUrl,
        pilot_user_ids: pilotUserIds,
        data_handling_consent: consent,
      } as never)
      .select('id')
      .single()
    if (insErr || !created) fatal(`pilot_agreement insert: ${insErr?.message ?? 'unknown'}`)
    console.log(`[provision] inserted agreement row ${created.id}`)
  }

  // 5. Print next-step smoke commands.
  console.log('\n[provision] DONE. Next steps:')
  console.log(`  1. Confirm matview filter:`)
  console.log(`     UPDATE materialized view 'lap_2_gate_metrics_daily' WHERE slug='${orgSlug}'`)
  console.log(`     (currently the view filters on slug='soft-pilot-gc-tbd' — swap and refresh)`)
  console.log(`  2. Heartbeat sanity:`)
  console.log(`     psql "$STAGING_DB_URL" -c "SELECT public.enqueue_insights_jobs();"`)
  console.log(`  3. Worker invoke:`)
  console.log(`     curl -X POST -H "Authorization: Bearer $CRON_SECRET" \\`)
  console.log(`          $SUPABASE_URL/functions/v1/scheduled-insights-worker`)
  console.log(`  4. Gate dry-run (verifies counts ≥ 0 + chain intact):`)
  console.log(`     npx tsx scripts/check-lap-2-gate.ts --json`)
  console.log(`  5. Walker prints the Day 49 prep checklist + sticks it above the laptop.`)
}

function req(key: string): string {
  const v = args.get(key)
  if (!v) fatal(`required flag missing: --${key}`)
  return v as string
}

function fatal(msg: string): never {
  console.error(`provision-pilot-org: ${msg}`)
  process.exit(2)
}

main().catch((err) => {
  console.error('provision-pilot-org failed:', err.message ?? err)
  process.exit(2)
})
