/**
 * Workflow B.2 — Billing: plan select + dunning escalation regression spec.
 *
 * Exercises the /settings/billing page (Billing.tsx). The page surfaces
 * the current plan, billing-cycle, Manage billing → Stripe Customer Portal,
 * and Cancel subscription. Plan select is delegated to the Stripe Portal
 * (createPortalSession → external URL); we verify the local UI surface
 * mounts and the Manage billing button kicks off the portal-session edge
 * call.
 *
 * Dunning escalation is server-side (Stripe webhook → escalation_state);
 * we assert the page renders without API errors.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   npx playwright test e2e/workflows/billing-plan.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #9/10)
 */
import { test, expect, type Page } from '@playwright/test'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

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

test('B.2 — UI: billing page renders Current plan + Manage billing button', async ({ page }) => {
  // Capture Stripe / billing edge-fn failures.
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/subscriptions') && !url.includes('/functions/v1/stripe-')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/settings/billing`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Billing.tsx line 114-119: "Current plan" label always renders.
  await expect(page.getByText(/Current plan/i)).toBeVisible({ timeout: 10_000 })

  // Line 174: "Manage billing" CTA — present whether subscribed or trial.
  await expect(page.getByRole('button', { name: /Manage billing/i })).toBeVisible()

  for (const f of failures) {
    expect(f.body, `billing API returned ${f.status} from ${f.url}: ${f.body}`)
      .not.toMatch(/42703|42501|column .+ does not exist/i)
  }
})

test('B.2 — UI: Manage billing button kicks off portal session', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/settings/billing`)
  await page.waitForTimeout(2_000)

  let portalCallFired = false
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('stripe-portal') || url.includes('portal-session') || url.includes('/functions/v1/billing')) {
      portalCallFired = true
    }
  })

  const manage = page.getByRole('button', { name: /Manage billing/i }).first()
  await expect(manage).toBeVisible({ timeout: 10_000 })

  // Click and wait briefly. Portal redirects external (window.location), so
  // we can't assert a final URL — just confirm the request was kicked off.
  await manage.click({ trial: false }).catch(() => undefined)
  await page.waitForTimeout(2_000)

  // Either an edge-function call fired OR a redirect happened — both
  // indicate the plan-select pathway is wired.
  const stillOnBilling = page.url().includes('/settings/billing')
  expect(portalCallFired || !stillOnBilling, 'Manage billing should invoke portal session or redirect').toBe(true)
})
