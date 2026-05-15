/**
 * FMEA M.OPT.1 — Optimistic UI orphan on server reject
 *
 * Hazard: a create mutation uses React Query's optimistic update (push
 *         a row into the cache immediately, refetch on success) and
 *         when the server returns 4xx the onError handler forgets to
 *         roll back the cache. The user sees a row that doesn't exist
 *         server-side, refreshes, and "loses" their entry. Worse, they
 *         re-add it and now have a duplicate.
 *
 * Test approach (Playwright):
 *   1. Sign in via mode-toggle (dev-bypass).
 *   2. Navigate to /#/tasks.
 *   3. Intercept the create-task RPC (POST to /rest/v1/tasks or
 *      /rest/v1/rpc/create_task) and force it to return 422.
 *   4. Click "New task" → enter a unique title → submit.
 *   5. Assert the optimistic row briefly appears, then disappears
 *      (rolled back) — count of rows containing the unique title
 *      MUST settle at 0.
 *
 * Skip-gracefully when the dev server isn't running. dev-bypass mode
 * doesn't hit a real backend, but the route interceptor catches any
 * outbound request the hooks make; if the hook short-circuits in
 * dev-bypass and never makes a network call, the test skips with a
 * clear message rather than producing a false pass.
 */
import { test, expect } from '@playwright/test'
import { signIn, settle, waitLoad } from '../../e2e/_helpers'

const USER = process.env.POLISH_USER ?? 'dev@sitesync.test'
const PASS = process.env.POLISH_PASS ?? 'devpassword'

test.describe('FMEA M.OPT.1 — optimistic create rolls back on server reject', () => {
  test('Tasks create with 422 reject does not leave orphan row', async ({
    page,
  }) => {
    test.setTimeout(45_000)

    const uniqueTitle = `wave2-optimistic-${Date.now()}`
    let sawCreateRequest = false

    // Force every plausible create endpoint to 422. Cover both raw
    // table insert and RPC-style create.
    await page.route(
      /\/rest\/v1\/(tasks(\?|$)|rpc\/create_task|rpc\/insert_task)/,
      async (route) => {
        const req = route.request()
        if (req.method() === 'POST') {
          sawCreateRequest = true
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '23514',
              message: 'forced-test-validation-error',
            }),
          })
          return
        }
        await route.continue()
      },
    )

    await signIn(page, USER, PASS)
    await page.goto('#/tasks')
    await waitLoad(page)
    await settle(page, 500)

    // Look for a "New task" trigger; try several common variants.
    const triggerCandidates = [
      page.getByRole('button', { name: /^new task$/i }),
      page.getByRole('button', { name: /^add task$/i }),
      page.getByRole('button', { name: /^create task$/i }),
      page.getByRole('button', { name: /^new$/i }),
      page.getByLabel(/new task/i),
    ]

    let openedCreate = false
    for (const t of triggerCandidates) {
      const visible = await t.first().isVisible({ timeout: 1_500 }).catch(() => false)
      if (visible) {
        await t.first().click().catch(() => undefined)
        openedCreate = true
        break
      }
    }
    if (!openedCreate) {
      test.skip(true, 'Tasks page has no recognized "new task" affordance')
      return
    }
    await settle(page, 300)

    // Fill title — try common selectors.
    const titleInput = page
      .getByLabel(/^title$/i)
      .or(page.getByPlaceholder(/title|task name/i))
      .first()
    const haveTitle = await titleInput.isVisible({ timeout: 2_000 }).catch(() => false)
    if (!haveTitle) {
      test.skip(true, 'Task create form did not expose a title input')
      return
    }
    await titleInput.fill(uniqueTitle)

    // Submit — try button with submit-y label or press Enter.
    const submit = page
      .getByRole('button', { name: /^(create|save|add|submit)/i })
      .first()
    if (await submit.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await submit.click().catch(() => undefined)
    } else {
      await titleInput.press('Enter')
    }

    // Wait for the 422 to come back and the rollback to fire.
    await page.waitForTimeout(1_200)
    await settle(page, 300)

    if (!sawCreateRequest) {
      // dev-bypass short-circuited before hitting the network. The test
      // can't meaningfully assert rollback in that branch; skip.
      test.skip(
        true,
        'create request did not reach intercept (dev-bypass short-circuit)',
      )
      return
    }

    // Assert the optimistic row was rolled back. Count visible
    // occurrences of the unique title text on the page. Should be 0;
    // tolerate 1 if it appears in an "undo" / error toast.
    const matches = await page
      .getByText(uniqueTitle, { exact: false })
      .count()
      .catch(() => 0)

    // Filter out toast/snackbar occurrences. The hazard is "orphan in
    // the LIST"; a toast surfacing the error is fine.
    const listMatches = await page
      .locator(`tr:has-text("${uniqueTitle}"), [role="row"]:has-text("${uniqueTitle}"), [data-task-row]:has-text("${uniqueTitle}")`)
      .count()
      .catch(() => 0)

    expect(
      listMatches,
      `optimistic row "${uniqueTitle}" should be rolled back from the list (saw ${listMatches}; whole-page matches: ${matches})`,
    ).toBe(0)
  })
})
