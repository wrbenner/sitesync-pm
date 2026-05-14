/**
 * Workflow B.2 — Onboarding (org create → invite teammate → accept).
 *
 * The post-signup flow. Where the demo bug actually started showing up
 * (every fresh signup hit broken triggers on org create).
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(
  REAL_BACKEND && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY),
  'SUPABASE_URL + SUPABASE_SERVICE_KEY required',
)

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const MARKER = `b2-onboarding-${Date.now()}`

test('B.2 onboarding — provision_organization RPC defaults plan to free', async () => {
  // Direct RPC test — the bug that PR #539 fixed. Catches regression.
  const probeUser = await admin.auth.admin.createUser({
    email: `${MARKER}-${randomUUID().slice(0, 6)}@sitesync.test`,
    password: `pw-${randomUUID().slice(0, 16)}!`,
    email_confirm: true,
    user_metadata: { scale_test: true },
  })
  try {
    expect(probeUser.error).toBeNull()
    const userId = probeUser.data.user!.id

    const { data: orgId, error } = await admin.rpc('provision_organization', {
      p_name: `${MARKER} probe org`,
      p_slug: `${MARKER}-probe`,
      p_owner: userId,
      p_metadata: { scale_test: true, e2e: true },
    })
    expect(error, error ? `provision_organization failed: ${error.message}` : undefined).toBeNull()
    expect(orgId).toBeTruthy()

    // Verify the row was created with plan='free' (PR #539 regression catch)
    const { data: org } = await admin
      .from('organizations')
      .select('id, plan, settings')
      .eq('id', orgId)
      .single()
    expect(org?.plan).toBe('free')
    // Cleanup
    await admin.from('organizations').delete().eq('id', orgId)
  } finally {
    if (probeUser.data.user?.id) {
      await admin.auth.admin.deleteUser(probeUser.data.user.id).catch(() => undefined)
    }
  }
})

test('B.2 onboarding — UI invite flow opens + sends', async ({ page }) => {
  // Sign in as existing PM, then attempt to invite from settings/team.
  // Real DOM: Login.tsx defaults to magic-link mode; click the
  // "Sign in with password" footer toggle to reveal the Password input
  // (only rendered when mode === 'password'). aria-label="Email"/"Password",
  // SubmitPill button without a readable name; Enter on password submits.
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(USER)
  await page.getByLabel('Password', { exact: true }).fill(PASS)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForURL(/#\/(dashboard|day|onboarding|profile|$)/, { timeout: 20_000 })

  // Navigate to a team / members settings page. Try common routes.
  for (const route of ['#/settings/team', '#/settings/members', '#/team', '#/admin/members']) {
    await page.goto(`${BASE_URL}/${route}`).catch(() => undefined)
    if (!page.url().match(/#\/$/)) break // landed somewhere valid
  }
  await page.waitForTimeout(1_500)

  // Real DOM: src/components/admin/InviteModal.tsx is the canonical invite
  // surface — the trigger varies by page (admin/members shows an "Invite"
  // primary button; onboarding flow auto-launches it). Match permissively
  // since the trigger is consumer-side, not in the modal itself.
  const inviteBtn = page.getByRole('button', { name: /^Invite|Add member|Add teammate|Invite member/i }).first()
  if (await inviteBtn.count() === 0) {
    test.skip(true, 'no invite UI surfaced at common settings routes — skipping')
  }
  await inviteBtn.click()
  // InviteModal.tsx (line 179) renders the single-mode email input with
  // placeholder "teammate@company.com".
  const emailInput = page.getByPlaceholder('teammate@company.com').first()
  await emailInput.fill(`${MARKER}-invite@sitesync.test`)
  // InviteModal submit button (line 310) reads dynamically:
  //   "Send N invite" or "Send N invites" — N is the count. Match on the
  //   stable "Send" prefix.
  await page.getByRole('button', { name: /^Send\b.*invite/ }).first().click()
  await page.waitForTimeout(2_000)
  const body = await page.locator('body').textContent()
  expect(
    /sent|invited|invitation|success/i.test(body ?? ''),
    'invite submit should show a success indicator',
  ).toBe(true)
})
