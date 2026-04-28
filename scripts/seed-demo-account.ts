/**
 * seed-demo-account.ts
 *
 * Creates the App Store / Google Play reviewer account and joins it to the
 * Riverside Commercial Tower demo project that supabase/seed.sql populates.
 *
 * Run this BEFORE every App Store / TestFlight submission so the reviewer's
 * first sign-in lands in a fully-populated project (logs, RFIs, punch items,
 * drawings) rather than an empty workspace. An empty demo project is the #2
 * cause of B2B SaaS app rejection on Apple's review.
 *
 * IMPORTANT — credentials baked in:
 *   email:    reviewer@sitesync.com
 *   password: ReviewMe!2026
 *   role:     admin on the Riverside Commercial Tower project
 *
 * These same credentials must be supplied in App Store Connect → App Review
 * Information → Sign-In Required.
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  npx tsx scripts/seed-demo-account.ts
 *
 * The script is idempotent: it deletes any existing reviewer user before
 * recreating, so you always start from a clean known state.
 */

import { createClient } from '@supabase/supabase-js'

// ── Reviewer account constants ───────────────────────────
// Hard-coded so the same credentials appear in (a) this script,
// (b) App Store Connect's reviewer-credentials field, and
// (c) the runbook. Three-way consistency = no surprises for the reviewer.

const REVIEWER_EMAIL = 'reviewer@sitesync.com'
const REVIEWER_PASSWORD = 'ReviewMe!2026'
const REVIEWER_FULL_NAME = 'App Store Reviewer'
// Matches the project_id baked into supabase/seed.sql.
const DEMO_PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
// Stable UUID for the reviewer so re-runs map back to the same row.
const REVIEWER_USER_ID = '99999999-9999-9999-9999-999999999999'

// ── Bootstrap ────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error(
    '✖ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
      '  Copy from your Supabase project → Settings → API.',
  )
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Steps ────────────────────────────────────────────────

async function ensureDemoProjectExists(): Promise<void> {
  const { data, error } = await admin
    .from('projects')
    .select('id')
    .eq('id', DEMO_PROJECT_ID)
    .maybeSingle()
  if (error) throw new Error(`projects lookup failed: ${error.message}`)
  if (!data) {
    throw new Error(
      `Demo project ${DEMO_PROJECT_ID} not found. Apply supabase/seed.sql first ` +
        '(supabase db reset, or psql ... -f supabase/seed.sql).',
    )
  }
}

async function deleteExistingReviewer(): Promise<void> {
  // Try by stable id first.
  const { error: byIdErr } = await admin.auth.admin.deleteUser(REVIEWER_USER_ID)
  if (byIdErr && !/not found/i.test(byIdErr.message)) {
    // If id mismatch (someone manually created reviewer@ with a different id),
    // fall back to listing and matching by email.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const users = (list as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? []
    const match = users.find((u) => u.email === REVIEWER_EMAIL)
    if (match) {
      const { error: byEmailErr } = await admin.auth.admin.deleteUser(match.id)
      if (byEmailErr) throw new Error(`failed to delete reviewer: ${byEmailErr.message}`)
    }
  }
}

async function createReviewerAuthUser(): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: REVIEWER_EMAIL,
    password: REVIEWER_PASSWORD,
    email_confirm: true, // skip the confirmation email — reviewer expects to sign in immediately
    user_metadata: {
      full_name: REVIEWER_FULL_NAME,
      role_label: 'App Store Reviewer',
    },
    id: REVIEWER_USER_ID,
  })
  if (error) throw new Error(`createUser failed: ${error.message}`)
  if (!data.user) throw new Error('createUser returned no user')
  return data.user.id
}

async function upsertReviewerProfile(userId: string): Promise<void> {
  // The profiles table has its own row keyed by user_id; we upsert so this
  // tolerates either a fresh DB or a partially-seeded one.
  const { error } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      first_name: 'App Store',
      last_name: 'Reviewer',
      full_name: REVIEWER_FULL_NAME,
      job_title: 'Reviewer',
      company: 'Apple',
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    // Profile table may not have all these columns in all environments;
    // log but don't fail — reviewer can still sign in and use the app.
    console.warn(`⚠ profiles upsert failed (non-fatal): ${error.message}`)
  }
}

async function joinDemoProjectAsAdmin(userId: string): Promise<void> {
  const { error } = await admin.from('project_members').upsert(
    {
      project_id: DEMO_PROJECT_ID,
      user_id: userId,
      role: 'admin',
      company: 'Apple',
      trade: 'Reviewer',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,user_id' },
  )
  if (error) throw new Error(`project_members upsert failed: ${error.message}`)
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  console.log('▸ Verifying demo project exists…')
  await ensureDemoProjectExists()

  console.log('▸ Removing any existing reviewer account…')
  await deleteExistingReviewer()

  console.log('▸ Creating reviewer auth user…')
  const userId = await createReviewerAuthUser()

  console.log('▸ Setting reviewer profile…')
  await upsertReviewerProfile(userId)

  console.log('▸ Joining reviewer to Riverside Commercial Tower demo project…')
  await joinDemoProjectAsAdmin(userId)

  console.log('')
  console.log('✓ Reviewer account ready.')
  console.log('')
  console.log('  Email:    ' + REVIEWER_EMAIL)
  console.log('  Password: ' + REVIEWER_PASSWORD)
  console.log('  Project:  Riverside Commercial Tower (admin)')
  console.log('')
  console.log(
    '  Paste these credentials into App Store Connect →\n' +
      '  App Review Information → Sign-In Required.',
  )
}

main().catch((err) => {
  console.error('✖ Seed failed:', err.message)
  process.exit(1)
})
