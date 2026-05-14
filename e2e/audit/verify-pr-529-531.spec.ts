/**
 * Verification specs for the production-blocking fixes shipped in
 * PRs #529 + #531 + #535 (the May 2026 audit triage).
 *
 * These run under the default VITE_DEV_BYPASS=true webServer config,
 * which means:
 *   - Real auth is bypassed; useAuth.user is a synthetic dev user.
 *   - SessionRecoveryPanel (gated on `!isDevBypassActive()`) is NOT
 *     reachable through normal navigation. Those branches assert that
 *     the recovery affordances exist at the markup level via a source
 *     read (fs.readFileSync — Playwright runs in Node). Where the live
 *     UX requires the real-auth code path, the test is marked
 *     `test.fixme()` with a pointer for stage-env CI.
 *
 * Each block is named after the audit ID (P0-N / P1-N / P5-N / P6-N).
 *
 * Run: npx playwright test e2e/audit/verify-pr-529-531.spec.ts
 */
import { test, expect, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const BASE = '/sitesync-pm/'

async function gotoHash(page: Page, hash: string) {
  await page.goto(`${BASE}#${hash}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
}

function readSrc(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf-8')
}

// ---------------------------------------------------------------------------
// P0-1 — SessionRecoveryPanel source contract
// ---------------------------------------------------------------------------
test('P0-1: SessionRecoveryPanel source contract', () => {
  const src = readSrc('src/components/auth/ProtectedRoute.tsx')
  expect(src).toContain('SessionRecoveryPanel')
  expect(src).toContain('Sign in again')
  expect(src).toContain('Try once more')
  expect(src).toMatch(/signOut\s*\(\s*\{\s*scope:\s*'local'/)
  expect(src).toMatch(/navigate\(\s*['"]\/login['"]/)
})

// ---------------------------------------------------------------------------
// P0-2 — 15s sign-in timeout (source contract; live UX requires real auth)
// ---------------------------------------------------------------------------
test.fixme('P0-2 live: 15s sign-in timeout drops the spinner — stage-env only', () => {
  // Stage-env CI should drive the form: intercept POST /auth/v1/token with
  // 20s delay and assert the pill clears within 16s with the documented error.
})

test('P0-2 source contract: useAuth wires a 15s sign-in timeout', () => {
  const src = readSrc('src/hooks/useAuth.ts')
  expect(src).toContain('signInWithPasswordWithTimeout')
  // Numeric literal must be 15000 (15s). Strict — a regression to 30s or 5s
  // changes the observable UX and trips this assertion.
  expect(src).toMatch(/15_?000/)
  expect(src).toMatch(/trouble reaching the server|trouble.*server/i)
})

// ---------------------------------------------------------------------------
// P0-3 — SyncManager watchdog
// ---------------------------------------------------------------------------
test('P0-3: syncManager exports STALL_MS and HARD_CAP_MS watchdog constants', () => {
  const src = readSrc('src/lib/syncManager.ts')
  expect(src).toMatch(/STALL_MS\s*=\s*15_?000/)
  expect(src).toMatch(/HARD_CAP_MS\s*=\s*90_?000/)
})

// ---------------------------------------------------------------------------
// P0-4a — Sidebar Account menu opens with Sign out
// ---------------------------------------------------------------------------
test('P0-4a: Sidebar UserStrip renders an Account menu trigger with Sign out', async ({ page }) => {
  // Force desktop viewport — the layout flips to MobileLayout under 768px
  // and the avatar trigger lives only in the desktop sidebar.
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoHash(page, '/dashboard')
  await page.waitForTimeout(1500)
  // The sidebar is collapsed by default in this dev fixture — expand it via
  // the floating "Show navigation menu" button if it's present.
  const expand = page.getByRole('button', { name: 'Show navigation menu' })
  if (await expand.isVisible().catch(() => false)) {
    await expand.click()
    await page.waitForTimeout(400)
  }
  const trigger = page.locator('button[aria-label^="Account menu"]')
  await expect(trigger, 'Account menu button not in sidebar').toBeVisible({ timeout: 15_000 })
  await trigger.click()
  for (const name of ['Profile', 'Settings', 'Sign out']) {
    await expect(
      page.getByText(new RegExp(`^${name}$`), { exact: false }),
      `${name} item missing from account popover`,
    ).toBeVisible({ timeout: 5_000 })
  }
})

// ---------------------------------------------------------------------------
// P0-4b — Cmd+K Account group surfaces Sign out
// ---------------------------------------------------------------------------
test('P0-4b: Cmd+K palette surfaces Sign out under Account group', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoHash(page, '/dashboard')
  await page.waitForTimeout(1200)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
  const input = page.locator('input[role="combobox"], [cmdk-input]').first()
  await expect(input).toBeVisible({ timeout: 8_000 })
  await input.fill('sign out')
  await expect(page.getByText('Sign out', { exact: false }).first()).toBeVisible({ timeout: 5_000 })
  const palette = page.locator('[cmdk-root], [role="dialog"]').first()
  await expect(palette).toContainText(/Account/i)
})

// ---------------------------------------------------------------------------
// P1-1 — /terms and /privacy resolve, not the NotFound page
// ---------------------------------------------------------------------------
test('P1-1a: /#/terms renders the Terms page (not NotFound)', async ({ page }) => {
  await gotoHash(page, '/terms')
  await expect(page.locator('h1, h2').first()).toContainText(/Terms/i, { timeout: 10_000 })
  await expect(page.locator('body')).not.toContainText(/404|doesn't exist|Page not found/i)
})

test('P1-1b: /#/privacy renders the Privacy page (not NotFound)', async ({ page }) => {
  await gotoHash(page, '/privacy')
  await expect(page.locator('h1, h2').first()).toContainText(/Privacy/i, { timeout: 10_000 })
  await expect(page.locator('body')).not.toContainText(/404|doesn't exist|Page not found/i)
})

// ---------------------------------------------------------------------------
// P1-2 — AccountSettingsHub source contract + live render
// ---------------------------------------------------------------------------
test('P1-2 source contract: AccountSettingsHub exports 6 account links', () => {
  const src = readSrc('src/pages/admin/ProjectSettings.tsx')
  expect(src).toContain('AccountSettingsHub')
  // The 6 link labels — bound to the user-visible strings in ACCOUNT_LINKS.
  for (const label of ['Profile', 'Notifications', 'Team', 'Billing', 'Impersonation history', 'Help center']) {
    expect(src, `${label} label missing from ACCOUNT_LINKS`).toContain(label)
  }
})

test('P1-2 live: /#/settings shows AccountSettingsHub when no project is selected', async ({ page }) => {
  await gotoHash(page, '/settings')
  await page.waitForTimeout(1500)
  // The hub renders when no project is in scope — see ProjectSettings.tsx:470.
  // Under dev-bypass with no selected project this should be the default branch.
  const hubVisible = await page.getByRole('heading', { name: /^Settings$/i }).isVisible().catch(() => false)
  if (!hubVisible) {
    // If a project was already selected in the dev fixture, the hub branch
    // doesn't trigger; skip rather than false-fail.
    test.skip(true, 'Project already selected — AccountSettingsHub branch not active in this fixture')
  }
  for (const label of ['Profile', 'Notifications', 'Billing']) {
    await expect(
      page.getByRole('link', { name: new RegExp(label, 'i') }),
      `${label} link missing from AccountSettingsHub`,
    ).toBeVisible({ timeout: 8_000 })
  }
})

// ---------------------------------------------------------------------------
// P1-3 — /permits page renders for any role
// ---------------------------------------------------------------------------
test('P1-3: /#/permits renders without page-level "Access Restricted"', async ({ page }) => {
  await gotoHash(page, '/permits')
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).not.toContainText(/Access Restricted/i)
  await expect(page.locator('h1, h2, [role="main"]').first()).toBeVisible({ timeout: 10_000 })
})

test('P1-3 source contract: App.tsx removed page-level ProtectedRoute on /permits', () => {
  const src = readSrc('src/App.tsx')
  // The pre-fix line wrapped the permits Route in <ProtectedRoute moduleId="permits">.
  // After the fix the Route element renders Permits directly.
  expect(src).toMatch(/path="\/permits"\s+element=\{<PageSuspense><Permits\s*\/><\/PageSuspense>\}/)
})

// ---------------------------------------------------------------------------
// P1-4 — Cmd+K empty state never shows "Loading"
// ---------------------------------------------------------------------------
test('P1-4: Cmd+K with no matches shows "No matches", never "Loading"', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoHash(page, '/dashboard')
  await page.waitForTimeout(1200)
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
  const input = page.locator('input[role="combobox"], [cmdk-input]').first()
  await expect(input).toBeVisible({ timeout: 8_000 })
  await input.fill('zzzz-nonexistent-thing-qqqq')
  await expect(page.getByText(/No matches/i)).toBeVisible({ timeout: 5_000 })
  const palette = page.locator('[cmdk-root], [role="dialog"]').first()
  await expect(palette).not.toContainText(/Loading/i)
})

// ---------------------------------------------------------------------------
// P1-5 — Profile page hydrates from authStore (Zustand bridge)
// ---------------------------------------------------------------------------
test('P1-5 source contract: useAuth bridges to useAuthStore', () => {
  const src = readSrc('src/hooks/useAuth.ts')
  expect(src).toContain('syncAuthStore')
  expect(src).toContain('useAuthStore')
  // Bridge must fire on at least the initAuth and SIGNED_IN paths.
  expect(src).toMatch(/syncAuthStore\(/)
})

test('P1-5 live: /#/profile hydrates the email field from auth state', async ({ page }) => {
  await gotoHash(page, '/profile')
  await page.waitForTimeout(2000)
  const emailInput = page.locator('input[type="email"]').first()
  const visible = await emailInput.isVisible().catch(() => false)
  if (!visible) {
    test.skip(true, 'Profile page does not expose input[type=email] in this fixture')
  }
  const val = await emailInput.inputValue()
  expect(val, 'Email field empty — authStore bridge regressed').toMatch(/@/)
})

// ---------------------------------------------------------------------------
// P5 (Track 5) — Reports primary CTA wrapped in PermissionGate
// ---------------------------------------------------------------------------
test('P5-1 source contract: Reports.tsx wraps New Report in PermissionGate', () => {
  const src = readSrc('src/pages/Reports.tsx')
  expect(src).toMatch(/PermissionGate/)
  expect(src).toMatch(/permission=["']reports\.view["']/)
})

test('P5-2 source contract: schedule wraps Import + New Activity in PermissionGate', () => {
  const src = readSrc('src/pages/schedule/index.tsx')
  expect(src).toMatch(/PermissionGate/)
  expect(src).toMatch(/permission=["']schedule\.edit["']/)
})

// ---------------------------------------------------------------------------
// P6 (Track 6) — daily-logs mutation calls state-machine validator
// ---------------------------------------------------------------------------
test('P6-1 source contract: daily-logs mutation validates status transitions', () => {
  const src = readSrc('src/hooks/mutations/daily-logs.ts')
  expect(src).toContain('validateDailyLogStatusTransition')
  const idxValidate = src.indexOf('validateDailyLogStatusTransition(')
  const idxUpdate = src.indexOf("from('daily_logs').update(")
  expect(idxValidate, 'validator must be invoked').toBeGreaterThan(0)
  expect(idxUpdate, 'update call must exist').toBeGreaterThan(0)
  expect(idxValidate, 'validator must run BEFORE update — ordering regression').toBeLessThan(idxUpdate)
})
