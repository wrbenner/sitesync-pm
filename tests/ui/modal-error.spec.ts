/**
 * FMEA M.MOD.2 — Modal stuck open after mutation error
 *
 * Hazard: a modal whose confirm handler awaits a mutation, but the
 *         component sets `submitting=true` before the await and never
 *         resets it if the mutation throws. The destructive button
 *         stays disabled; Cancel is still wired but the user (and
 *         keyboard users) can no longer Escape because the spinner
 *         logic gates Escape on `!submitting`. Real users see a stuck
 *         dialog and reload the page, losing in-flight context.
 *
 * Test approach (Playwright + dev-bypass dev server):
 *   1. Sign in via the mode-toggle pattern (dev-bypass mode skips auth).
 *   2. Navigate to a page that wires ConfirmDialog — RFIs (delete) is
 *      the canonical user-visible call site.
 *   3. Intercept the underlying DELETE/PATCH mutation and force it to
 *      reject with a 500.
 *   4. Trigger the destructive action; observe the dialog handles the
 *      error gracefully — the modal MUST remain closable (Cancel
 *      clickable AND Escape works) AND the destructive button MUST
 *      re-enable (isSubmitting flips back to false in the finally
 *      block).
 *
 * Skip-gracefully when the dev server isn't running (E2E_BASE_URL
 * unreachable). The mode-toggle login flow is reused so this spec
 * doesn't require staging — dev-bypass uses fixture data.
 */
import { test, expect } from '@playwright/test'
import { signIn, settle, waitLoad } from '../../e2e/_helpers'

const USER = process.env.POLISH_USER ?? 'dev@sitesync.test'
const PASS = process.env.POLISH_PASS ?? 'devpassword'

test.describe('FMEA M.MOD.2 — modal recovers from mutation error', () => {
  test('ConfirmDialog re-enables Confirm + remains closable after server 500', async ({
    page,
  }) => {
    test.setTimeout(45_000)

    await signIn(page, USER, PASS)

    // Intercept all DELETE/PATCH requests to PostgREST `rfis` and force a 500.
    // We do this before navigation so the route is armed for the eventual
    // click. The mode-toggle dev-bypass might short-circuit before the
    // network is hit; the test handles both branches below.
    await page.route(/\/rest\/v1\/rfis\b.*/, async (route) => {
      const req = route.request()
      if (req.method() === 'DELETE' || req.method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'forced-test-error' }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('#/rfis')
    await waitLoad(page)
    await settle(page, 500)

    // Find ANY row action that opens a ConfirmDialog. We try common
    // labels in order of likelihood; if none surface, skip rather than
    // fail (dev-bypass fixtures may not include RFIs).
    const triggers = [
      page.getByRole('button', { name: /^delete( rfi)?$/i }).first(),
      page.getByRole('menuitem', { name: /^delete/i }).first(),
      page.getByLabel(/^delete/i).first(),
    ]

    let triggered = false
    for (const t of triggers) {
      const visible = await t.isVisible({ timeout: 1_500 }).catch(() => false)
      if (visible) {
        await t.click().catch(() => undefined)
        triggered = true
        break
      }
    }
    if (!triggered) {
      test.skip(true, 'No delete affordance found in dev-bypass fixtures')
      return
    }

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Click the destructive button — handler will await the mocked
    // 500. The dialog implementation sets submitting=true then resets
    // in finally. If the hazard is present, the dialog stays disabled.
    const confirmBtn = dialog
      .getByRole('button')
      .filter({ hasText: /delete|confirm|remove/i })
      .first()
    await confirmBtn.click().catch(() => undefined)

    // Give the failed-request promise time to settle.
    await page.waitForTimeout(800)

    // The dialog must still be open (no auto-close on error — caller
    // controls open state) AND interactable. Cancel must NOT be disabled.
    await expect(dialog).toBeVisible()
    const cancel = dialog.getByRole('button', { name: /cancel/i })
    await expect(cancel).toBeEnabled({ timeout: 3_000 })

    // Confirm button must have flipped isSubmitting back to false →
    // the button is no longer disabled by the submitting gate. (If a
    // typeToConfirm requirement makes it disabled for a different
    // reason, that's fine — we only assert the submitting bit is off.)
    const confirmDisabledAttr = await confirmBtn.getAttribute('disabled').catch(() => null)
    const ariaDisabled = await confirmBtn.getAttribute('aria-disabled').catch(() => null)
    const stuckOnSubmit =
      confirmDisabledAttr === 'true' || ariaDisabled === 'true'
    expect(
      stuckOnSubmit,
      'Confirm button must re-enable after mutation error (finally block)',
    ).toBe(false)

    // Escape closes a non-submitting dialog.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 3_000 })
  })
})
