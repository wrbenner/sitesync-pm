/**
 * Workflow B.2 — Settings · SSO: config + provision-test-user regression spec.
 *
 * Exercises the admin SSO configuration page (SsoAdminPage). The page lets
 * an org admin pick SAML/OIDC, paste IdP metadata, then "Save". The
 * test-mode toggle / provision-test-user flow runs after Save against a
 * single user — we assert the form mount + protocol toggle works; the
 * actual IdP roundtrip is out-of-scope for an e2e baseline.
 *
 * The SsoAdminPage component is admin-gated and mounted under a custom
 * /admin route — we navigate to /admin/sso and accept a redirect to
 * /dashboard when the test user lacks is_internal_admin (BRT sub-6 §4.4).
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   npx playwright test e2e/workflows/settings-sso.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #8/10)
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

test('B.2 — UI: SSO config page mounts with SAML/OIDC protocol toggle', async ({ page }) => {
  await signIn(page)
  // SsoAdminPage is admin-only and mounted via AdminPageShell. Try the
  // canonical admin route; if redirected, the user lacks is_internal_admin
  // and we skip rather than fail.
  await page.goto(`${BASE_URL}/#/admin/sso`)
  await page.waitForTimeout(2_000)

  if (page.url().includes('/dashboard') || page.url().includes('/login')) {
    test.skip(true, 'Test user lacks is_internal_admin — SSO admin redirected away')
    return
  }

  // SsoAdminPage line 78: title "Single Sign-On (SAML / OIDC)".
  await expect(page.getByText(/Single Sign-On/i)).toBeVisible({ timeout: 10_000 })

  // line 86-104: protocol fieldset with SAML 2.0 + OIDC radio options.
  await expect(page.getByText(/SAML 2\.0/)).toBeVisible()
  await expect(page.getByText(/^OIDC$/)).toBeVisible()
})

test('B.2 — UI: switching to OIDC reveals Issuer + Client ID fields', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/admin/sso`)
  await page.waitForTimeout(2_000)

  if (page.url().includes('/dashboard') || page.url().includes('/login')) {
    test.skip(true, 'Test user lacks is_internal_admin — SSO admin redirected away')
    return
  }

  // Click the OIDC radio (label text "OIDC"). Real DOM: radios are
  // wrapped in <label>; click the label text.
  await page.getByText(/^OIDC$/).first().click()
  await page.waitForTimeout(300)

  // SsoAdminPage line 133-143: OIDC fieldset renders Issuer + Client ID
  // + Authorization endpoint + Token endpoint + JWKS URI inputs.
  await expect(page.getByText(/^Issuer$/i)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText(/Client ID/i)).toBeVisible()
})
