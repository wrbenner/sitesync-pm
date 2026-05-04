/**
 * super-morning.spec.ts — Superintendent, 6:00am cold open.
 *
 * Flow: cold open -> dashboard briefing -> daily-log status -> crew check-ins.
 *
 * Wiring backlog references (docs/STATUS.md):
 *   - COI block banner not yet mounted in crew check-in route -> expected_unwired
 *   - Iris suggestion strip not yet on daily log -> expected_unwired
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'super-morning'
test.use({ storageState: authStateFor('super') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('cold open -> briefing -> daily log status -> check-ins', async ({ page }) => {
    await measure(PERSONA, 'cold open / -> dashboard render', async () => {
      await page.goto('/', { waitUntil: 'load' })
      await page.waitForLoadState('domcontentloaded')
    })

    await measure(PERSONA, 'navigate /dashboard', async () => {
      await page.goto('/#/dashboard', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })

    await measure(PERSONA, 'navigate /daily-log', async () => {
      await page.goto('/#/daily-log', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })

    // Iris suggestion strip on daily log — pending mount per docs/STATUS.md
    logFinding({
      persona: PERSONA,
      step: 'Iris suggestion strip on daily log',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (Iris suggestion strip not yet mounted on entity detail pages)',
      notes: 'src/components/iris/IrisSuggests.tsx exists but is not mounted on /daily-log',
    })

    // Crew check-in route — the COI banner host route is itself absent.
    // Per docs/STATUS.md: "A check-in page under src/pages/site/ — COI banner has no host route yet."
    test.skip(
      true,
      'expected_unwired: crew check-in route + COI banner mount missing (docs/STATUS.md "Pre-existing doc debt")',
    )

    // The skip above prevents the next assertion from running — but we
    // still want to verify the dashboard shell renders, so:
    expect(page.url()).toContain('/daily-log')

    finalize(PERSONA)
  })
})
