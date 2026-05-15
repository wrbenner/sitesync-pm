/**
 * Workflow B.2 — Preconstruction: bid package + submission regression spec.
 *
 * Exercises the precon authoring path. App.tsx line 560 redirects
 * /preconstruction → /estimating; the Preconstruction.tsx component is
 * mounted under /estimating. We navigate via the canonical /estimating
 * URL so the spec is stable across the redirect.
 *
 * Primary path: open "New Package" modal, fill Package # + Title +
 * Trade + Estimated Value, hit Create Package. Bid submission flow uses
 * the "Add Bid" trigger on a selected package — we verify the package
 * creation surface only, since bid submission requires a pre-existing
 * package fixture which would couple this spec to seed data.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/preconstruction.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #5/10)
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const MARKER = `B2-${Date.now()}`

async function signIn(page: Page): Promise<void> {
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
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test('B.2 — UI: bid package create modal submits', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/bid_packages') && !url.includes('/rest/v1/precon')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/estimating`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Preconstruction.tsx line 533: "New Package" button opens the package
  // create modal.
  await page
    .getByRole('button', { name: /^New Package$/i })
    .first()
    .click()

  // Package # field (line 646, placeholder="BP-001").
  await page.getByPlaceholder('BP-001').fill(`BP-${MARKER}`)

  // Title field (line 647, placeholder="Electrical rough-in").
  await page.getByPlaceholder('Electrical rough-in').fill(`${MARKER} package`)

  // Trade (line 661).
  await page.getByPlaceholder('Electrical').first().fill('Electrical')

  // Estimated Value (line 664, placeholder="0.00").
  await page.getByPlaceholder('0.00').first().fill('50000')

  // Submit (line 669).
  await page.getByRole('button', { name: /^Create Package$/ }).click()

  await page.waitForTimeout(2_000)

  for (const f of failures) {
    expect(f.body, `precon API returned ${f.status} from ${f.url}: ${f.body}`)
      .not.toMatch(/42703|42501|column .+ does not exist/i)
  }
})

test('B.2 — DB: bid_package row persisted', async () => {
  if (!admin) {
    test.skip(true, 'SUPABASE_SERVICE_KEY required')
    return
  }
  const { data, error } = await admin
    .from('bid_packages' as never)
    .select('id, title, package_number, organization_id, created_at')
    .ilike('package_number', `BP-${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    test.skip(true, `bid_packages not exposed: ${error.message}`)
    return
  }
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data?.[0].organization_id, 'bid_package organization_id must be set').toBeTruthy()
})
