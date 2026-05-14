/**
 * One-shot setup for the Playwright test user on staging.
 *
 * Walker authorized 2026-05-14 in the functional-frog autonomy directive.
 * Idempotent: re-runs reset the password to a freshly-generated value.
 *
 * Outputs:
 *   - .env.scale-test gets STAGING_POLISH_USER + STAGING_POLISH_PASS updated
 *   - Test user has org + project + project_members(role='owner')
 *
 * --- USAGE ---
 *   SUPABASE_URL=<staging> SUPABASE_SERVICE_KEY=<staging-service> \
 *     npx tsx scripts/setup-polish-user.ts
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('FATAL: SUPABASE_URL + SUPABASE_SERVICE_KEY required')
  process.exit(1)
}

if (!SUPABASE_URL.includes('nrsbvqkpxxlonvkmcmxf')) {
  console.error(`FATAL: This script is staging-only. SUPABASE_URL host: ${new URL(SUPABASE_URL).host}`)
  process.exit(2)
}

const EMAIL = 'polish-test@sitesync-staging.local'
const PASSWORD = randomBytes(24).toString('base64url')

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main(): Promise<void> {
  // 1. Create or reset the user via admin API
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) throw new Error(`listUsers failed: ${list.error.message}`)
  const existing = list.data.users.find((u) => u.email === EMAIL)
  let userId: string
  if (existing) {
    const upd = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { polish_test_user: true, scale_test: false },
    })
    if (upd.error) throw new Error(`updateUserById failed: ${upd.error.message}`)
    userId = existing.id
    console.error(`[polish] reset password for existing user ${EMAIL}`)
  } else {
    const c = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { polish_test_user: true, scale_test: false },
    })
    if (c.error || !c.data.user) throw new Error(`createUser failed: ${c.error?.message ?? 'no user'}`)
    userId = c.data.user.id
    console.error(`[polish] created new user ${EMAIL} (id=${userId})`)
  }

  // 2. Provision org via existing RPC
  const { data: orgId, error: provErr } = await admin.rpc('provision_organization', {
    p_name: 'Polish Test Org',
    p_slug: 'polish-test-org',
    p_owner: userId,
    p_metadata: { polish_test: true },
  })
  if (provErr) throw new Error(`provision_organization failed: ${provErr.message}`)
  if (typeof orgId !== 'string') throw new Error('provision_organization returned non-string')
  console.error(`[polish] org=${orgId}`)

  // 3. Project (find existing or create)
  let projectId: string | null = null
  const { data: existingProjects } = await admin
    .from('projects')
    .select('id')
    .eq('organization_id', orgId)
    .eq('owner_id', userId)
    .limit(1)
  if (existingProjects && existingProjects.length > 0) {
    projectId = existingProjects[0].id as string
  } else {
    const { data: newProj, error: projErr } = await admin
      .from('projects')
      .insert({
        organization_id: orgId,
        owner_id: userId,
        name: 'Polish Test Project',
        description: 'For Playwright e2e tests',
        status: 'active',
        project_phase: 'construction',
        is_demo: false,
        timezone: 'UTC',
      })
      .select('id')
      .single()
    if (projErr || !newProj) throw new Error(`project insert failed: ${projErr?.message ?? 'no row'}`)
    projectId = newProj.id as string
  }
  console.error(`[polish] project=${projectId}`)

  // 4. project_members owner role
  const { error: pmErr } = await admin
    .from('project_members')
    .upsert(
      { project_id: projectId, user_id: userId, role: 'owner', accepted_at: new Date().toISOString() },
      { onConflict: 'project_id,user_id', ignoreDuplicates: true },
    )
  if (pmErr) console.error(`[polish] project_members upsert warning: ${pmErr.message}`)

  // 5. Update .env.scale-test with the new password (preserve everything else)
  const envPath = '.env.scale-test'
  const env = readFileSync(envPath, 'utf-8')
  const updated = env
    .replace(/^SCALE_TEST_OWNER_EMAIL=.*/m, `SCALE_TEST_OWNER_EMAIL=${EMAIL}`)
    .replace(/^SCALE_TEST_PASSWORD=.*/m, `SCALE_TEST_PASSWORD=${PASSWORD}`)
  const finalEnv = updated.includes('STAGING_POLISH_USER=')
    ? updated.replace(/^STAGING_POLISH_USER=.*/m, `STAGING_POLISH_USER=${EMAIL}`).replace(/^STAGING_POLISH_PASS=.*/m, `STAGING_POLISH_PASS=${PASSWORD}`)
    : updated + `\nSTAGING_POLISH_USER=${EMAIL}\nSTAGING_POLISH_PASS=${PASSWORD}\n`
  writeFileSync(envPath, finalEnv)
  console.error(`[polish] .env.scale-test updated`)

  // 6. Emit to stdout for gh secret set
  process.stdout.write(`STAGING_POLISH_USER=${EMAIL}\n`)
  process.stdout.write(`STAGING_POLISH_PASS=${PASSWORD}\n`)
  console.error(`[polish] DONE — user=${EMAIL} org=${orgId} project=${projectId}`)
}

main().catch((err) => {
  console.error('[polish] fatal:', err)
  process.exit(1)
})
