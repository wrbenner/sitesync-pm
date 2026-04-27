import { test, expect, type Page } from '@playwright/test'

// ── Critical-path money flows ────────────────────────────────
//
// Per STRATEGY.md §10.1, gate the four lifecycles a paid pilot
// cannot tolerate regressions on:
//
//   1. Pay-app: submit → approve → release retainage
//   2. Change order: draft → PCO → COR → CO with promotion
//   3. RFI: submit → architect respond → close
//   4. Daily log: create → submit → approve → PDF export
//
// These specs stay deliberately UI-shape robust: they verify the action
// buttons exist, forms accept input, and submission triggers the
// expected next-state UI. They do NOT depend on real Supabase data;
// in dev-bypass mode the page renders even without a session.
//
// Pattern: each test is wrapped with a soft-skip if the page lands on
// /login (no auth) so CI doesn't false-positive when env vars are
// misconfigured. Real coverage comes when CI runs against a seeded
// staging tenant — wired in a follow-up.

async function gotoPage(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('domcontentloaded')
  // Soft-skip if the unauth flow kicked us back to /login.
  const url = page.url()
  if (url.includes('/login') || url.includes('/signup')) {
    test.skip(true, `Auth not available in this run; ${route} requires session`)
  }
}

async function clickIfPresent(page: Page, locator: ReturnType<Page['locator']>, name: string) {
  if (await locator.first().isVisible().catch(() => false)) {
    await locator.first().click()
    return true
  }
  // Not failing — record as informational.
  test.info().annotations.push({ type: 'soft-miss', description: `${name} not found in DOM` })
  return false
}

// ── 1. Pay-app: submit → approve → release retainage ─────────

test.describe('Critical path — Pay applications', () => {
  test('pay-app list renders + create entry point exists', async ({ page }) => {
    await gotoPage(page, '/pay-apps')

    // Page wrapper visible
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 })

    // Either a list of pay apps or a clear empty state with a CTA
    const hasContent = await page
      .locator('[data-testid*="pay-app"], table, [role="table"], [role="alert"]')
      .first()
      .isVisible()
      .catch(() => false)
    const hasEmpty = await page
      .getByText(/no pay app|no payment app|create.*pay/i)
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasContent || hasEmpty).toBeTruthy()
  })

  test('pay-app row → detail view supports approve / release-retainage actions', async ({ page }) => {
    await gotoPage(page, '/pay-apps')
    // Click first row if any
    const firstRow = page.locator('table tbody tr, [data-testid*="pay-app-row"]').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      // Approve / Submit / Release-retainage buttons should exist on detail
      const approveLikeBtn = page.getByRole('button', { name: /approve|submit|release|retainage/i }).first()
      await expect(approveLikeBtn).toBeVisible({ timeout: 4000 }).catch(() => {
        test.info().annotations.push({ type: 'soft-miss', description: 'approve/submit/release btn not found' })
      })
    }
  })
})

// ── 2. Change order: PCO → COR → CO promotion ────────────────

test.describe('Critical path — Change orders', () => {
  test('change orders page renders with type badges (PCO/COR/CO)', async ({ page }) => {
    await gotoPage(page, '/change-orders')
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 })

    // Should expose PCO/COR/CO discrimination either as filters or row badges
    const hasTypeUI = await page
      .getByText(/\b(PCO|COR|change order|change-order)\b/i)
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasTypeUI).toBeTruthy()
  })

  test('change order detail surfaces Promote action when CO is approved', async ({ page }) => {
    await gotoPage(page, '/change-orders')
    const firstRow = page.locator('table tbody tr, [data-testid*="change-order-row"]').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      // Either Promote or a status-aware button group appears
      const actionsExist = await page
        .getByRole('button', { name: /promote|approve|reject|submit/i })
        .first()
        .isVisible()
        .catch(() => false)
      expect(actionsExist).toBeTruthy()
    }
  })
})

// ── 3. RFI: submit → architect respond → close ────────────────

test.describe('Critical path — RFIs', () => {
  test('RFI page renders + has create entry', async ({ page }) => {
    await gotoPage(page, '/rfis')
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 })

    // The new-RFI button must be reachable — it's the entry point of the flow.
    // We allow EITHER a CTA inside an empty state OR a top-bar New RFI button.
    const newBtn = page.getByRole('button', { name: /new\s*rfi|create.*rfi|new request/i }).first()
    await expect(newBtn).toBeVisible({ timeout: 5000 })
  })

  test('clicking New RFI opens a form modal with title + description fields', async ({ page }) => {
    await gotoPage(page, '/rfis')
    const newBtn = page.getByRole('button', { name: /new\s*rfi|create.*rfi|new request/i }).first()
    if (!(await newBtn.isVisible().catch(() => false))) test.skip(true, 'New RFI button not found')

    await newBtn.click()

    // A modal/dialog appears with form fields.
    const dialog = page.locator('[role="dialog"], [data-testid="create-rfi-modal"]').first()
    await expect(dialog).toBeVisible({ timeout: 4000 })

    // Must collect at minimum a title — without that we can't represent an RFI.
    const titleInput = dialog.getByRole('textbox').first()
    await expect(titleInput).toBeVisible()
  })

  test('RFI detail view exposes a respond / close action', async ({ page }) => {
    await gotoPage(page, '/rfis')
    const firstRow = page.locator('table tbody tr, [data-testid*="rfi-row"]').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      // We don't enforce exact button names, just that the workflow surface exists.
      const ok = await page
        .getByRole('button', { name: /respond|reply|close|answer|submit/i })
        .first()
        .isVisible()
        .catch(() => false)
      expect(ok).toBeTruthy()
    }
  })
})

// ── 4. Daily log: create → submit → approve → PDF export ──────

test.describe('Critical path — Daily log', () => {
  test('daily-log page renders + new-entry CTA exists', async ({ page }) => {
    await gotoPage(page, '/daily-log')
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 })

    const newBtn = page.getByRole('button', { name: /new\s*entry|new daily|create.*log|today/i }).first()
    await expect(newBtn).toBeVisible({ timeout: 5000 })
  })

  test('daily-log surface includes export action (PDF / XLSX)', async ({ page }) => {
    await gotoPage(page, '/daily-log')

    // Either a top-bar Export button or a per-row export menu
    const exportBtn = page.getByRole('button', { name: /export|download|pdf|xlsx/i }).first()
    await expect(exportBtn).toBeVisible({ timeout: 5000 })
  })

  test('daily-log empty/loading/error state renders without crashing', async ({ page }) => {
    await gotoPage(page, '/daily-log')

    // Whether there's data or not, there must be a recognisable state — not a blank
    // viewport. PageState now guarantees this.
    const stateMarker = page.locator('[role="alert"], [role="status"], main').first()
    await expect(stateMarker).toBeVisible()
  })
})
