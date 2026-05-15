/**
 * FMEA M.FORM.1 — Double-submit creates duplicate
 *
 * Hazard: a create form's submit button isn't disabled while the
 *         mutation is in flight, so a rapid double-click — or
 *         Enter+click on the form — fires the mutation twice. Without
 *         idempotency keys the server creates two records and the user
 *         has phantom-duplicate RFIs/tasks/etc. floating around.
 *
 * Test approach (Playwright):
 *   1. Sign in via mode-toggle pattern (dev-bypass).
 *   2. Navigate to /#/rfis.
 *   3. Open the create flow.
 *   4. Slow-down the POST to /rest/v1/rfis with a 1500 ms delay so we
 *      have a deterministic window to double-fire.
 *   5. Fire the submit twice in rapid succession (Enter + click).
 *   6. Assert exactly ONE POST was issued during the in-flight window.
 *      (Either the button disabled itself, or the submit handler
 *      no-op'd on second call, or an idempotency key collapses the
 *      pair — any of those satisfy the hazard contract.)
 *
 * Skip-gracefully when the dev server isn't running. Works against
 * dev-bypass — we count POSTs hitting the interceptor.
 */
import { test, expect } from '@playwright/test'
import { signIn, settle, waitLoad } from '../../e2e/_helpers'

const USER = process.env.POLISH_USER ?? 'dev@sitesync.test'
const PASS = process.env.POLISH_PASS ?? 'devpassword'

test.describe('FMEA M.FORM.1 — double-submit produces ≤ 1 row', () => {
  test('rapid Enter+click on RFI create does not POST twice', async ({
    page,
  }) => {
    test.setTimeout(45_000)

    let createCount = 0
    const idempotencyKeys = new Set<string>()

    // Slow create endpoint so we have a window to fire twice.
    await page.route(
      /\/rest\/v1\/(rfis(\?|$)|rpc\/create_rfi)/,
      async (route) => {
        const req = route.request()
        if (req.method() === 'POST') {
          createCount++
          // Capture an idempotency key if the client sends one — that's
          // a legitimate "double POST but server collapses" branch.
          const idk =
            req.headers()['idempotency-key'] ??
            req.headers()['x-idempotency-key'] ??
            ''
          if (idk) idempotencyKeys.add(idk)

          await new Promise((r) => setTimeout(r, 1_500))
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: 'created-1', number: 1, title: 'forced-test' },
            ]),
          })
          return
        }
        await route.continue()
      },
    )

    await signIn(page, USER, PASS)
    await page.goto('#/rfis')
    await waitLoad(page)
    await settle(page, 500)

    // Open create flow.
    const newButton = page
      .getByRole('button', { name: /^(new|create)\s*rfi/i })
      .or(page.getByRole('button', { name: /^new$/i }))
      .first()
    const haveOpen = await newButton.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!haveOpen) {
      test.skip(true, 'RFIs page has no recognized create affordance')
      return
    }
    await newButton.click().catch(() => undefined)
    await settle(page, 400)

    // Find a title input. RFI flows typically have "Subject" or "Title".
    const titleInput = page
      .getByLabel(/^(title|subject|question)/i)
      .or(page.getByPlaceholder(/title|subject|question/i))
      .first()
    if (!(await titleInput.isVisible({ timeout: 2_000 }).catch(() => false))) {
      test.skip(true, 'RFI create form did not expose a title/subject input')
      return
    }
    await titleInput.fill(`wave2-double-submit-${Date.now()}`)

    // Try to locate the submit. We want to fire Enter on the input AND
    // click the submit button as close together as possible.
    const submit = page
      .getByRole('button', { name: /^(create|submit|save|send)/i })
      .first()

    // Fire both in parallel — Enter on the input + click on the submit.
    // If the button disables on first submit, the click is a no-op.
    // If the form handler doesn't guard, the click fires a second POST.
    await Promise.all([
      titleInput.press('Enter').catch(() => undefined),
      submit.click({ timeout: 3_000 }).catch(() => undefined),
    ])

    // Let the slow-mocked endpoint resolve.
    await page.waitForTimeout(2_500)

    // Contract: ≤ 1 POST OR > 1 POSTs all carrying the same idempotency
    // key (server-side dedup is the correct architectural fix).
    if (createCount > 1) {
      const dedupViaKey = idempotencyKeys.size === 1
      expect(
        dedupViaKey,
        `multiple POSTs (${createCount}) without a shared idempotency key`,
      ).toBe(true)
    } else {
      expect(createCount).toBeLessThanOrEqual(1)
    }
  })
})
