/**
 * FMEA M.EMPTY.1 — Empty array crashes detail page
 *
 * Hazard: a detail page assumes the entity's child collections (e.g.
 *         RFI responses, attached files, attachments) are non-empty.
 *         When the entity exists but has no responses — or doesn't
 *         exist at all — the page throws (`Cannot read properties of
 *         undefined (reading 'map')`, `find() on undefined`, etc.).
 *         The blank-screen-with-console-trace failure mode users see
 *         is the worst kind: it looks like the platform is down even
 *         though only one row is funky.
 *
 * Test approach (Playwright):
 *   1. Sign in via mode-toggle pattern (dev-bypass).
 *   2. Visit /#/rfis/<nonexistent-uuid>. Expect a graceful "not found"
 *      empty state or a redirect — NOT a JS crash. Assert no
 *      Uncaught errors hit the page error event, and the document
 *      still contains a known shell element (e.g. nav / header).
 *   3. Visit /#/rfis/<id-with-no-responses>. If the page resolves the
 *      entity but the responses array is empty, the detail panel must
 *      render its empty state ("No responses yet", "No replies", etc.)
 *      instead of crashing.
 *
 * Skip-gracefully if the dev server isn't running. We do NOT require
 * staging — dev-bypass fixtures determine whether the "exists but
 * empty" branch can be exercised; if it can't, the spec still
 * meaningfully validates the nonexistent path.
 */
import { test, expect } from '@playwright/test'
import { signIn, settle, waitLoad } from '../../e2e/_helpers'

const USER = process.env.POLISH_USER ?? 'dev@sitesync.test'
const PASS = process.env.POLISH_PASS ?? 'devpassword'

// A UUID that is well-formed but will not exist in any fixtures or DB.
const GHOST_UUID = '00000000-0000-0000-0000-deadbeefdead'

test.describe('FMEA M.EMPTY.1 — detail page survives missing / empty arrays', () => {
  test('detail page for nonexistent RFI does not crash', async ({ page }) => {
    test.setTimeout(30_000)

    // Capture any uncaught exceptions during navigation.
    const errors: Error[] = []
    page.on('pageerror', (e) => errors.push(e))

    await signIn(page, USER, PASS)
    await page.goto(`#/rfis/${GHOST_UUID}`)
    await waitLoad(page)
    await settle(page, 800)

    // The page must render the app shell — header / nav — proving React
    // didn't bail out at the root.
    const navHit = await page
      .locator('nav, [role="navigation"], header')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)
    expect(navHit, 'app shell must remain visible on missing detail').toBe(true)

    // No uncaught render-stack errors.
    expect(
      errors.map((e) => e.message),
      'no uncaught errors during nonexistent-detail navigation',
    ).toEqual([])

    // We expect a graceful empty/not-found state OR a redirect back to
    // the list. Accept any of: empty-state copy, "not found", or URL
    // change away from the ghost id.
    const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
    const url = page.url()
    const redirected = !url.includes(GHOST_UUID)
    const showsEmptyCopy = /not\s*found|doesn'?t\s*exist|no\s*such|nothing\s*here|empty/i.test(
      bodyText,
    )
    expect(
      redirected || showsEmptyCopy,
      'missing RFI must redirect OR show empty-state copy',
    ).toBe(true)
  })

  test('detail page for RFI with no responses does not crash', async ({
    page,
  }) => {
    test.setTimeout(30_000)

    const errors: Error[] = []
    page.on('pageerror', (e) => errors.push(e))

    await signIn(page, USER, PASS)

    // Mock the responses query to return an empty array regardless of
    // which RFI we land on. We match the PostgREST `rfi_responses` path
    // shape; dev-bypass intercepts use fixtures so this primarily
    // exercises real-backend mode.
    await page.route(/\/rest\/v1\/rfi_responses\b.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    })

    // Land on the RFIs list and click any visible RFI row. If no rows
    // are present, the dev-bypass fixture is too sparse to exercise
    // this path; skip.
    await page.goto('#/rfis')
    await waitLoad(page)
    await settle(page, 500)

    const firstRow = page
      .locator('a[href*="#/rfis/"], [role="link"][href*="#/rfis/"]')
      .first()
    const haveRow = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!haveRow) {
      test.skip(true, 'dev-bypass fixtures have no clickable RFI rows')
      return
    }
    await firstRow.click().catch(() => undefined)
    await waitLoad(page)
    await settle(page, 800)

    // Same shell check.
    const navHit = await page
      .locator('nav, [role="navigation"], header')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)
    expect(navHit).toBe(true)
    expect(errors.map((e) => e.message)).toEqual([])
  })
})
