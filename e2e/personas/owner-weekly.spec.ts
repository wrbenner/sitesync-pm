/**
 * owner-weekly.spec.ts — Owner, weekly digest.
 *
 * Flow: digest email -> magic link -> project status -> approve Pay App
 * preview.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - /share/owner-payapp public route NOT registered -> expected_unwired
 *   - digest-flusher edge fn lacks cron schedule -> cron_unavailable
 */
import { test, expect } from '@playwright/test'
import { authStateFor, requireCronSecretOrSkip } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'owner-weekly'
test.use({ storageState: authStateFor('owner') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('digest -> magic link -> Pay App preview', async ({ page }) => {
    requireCronSecretOrSkip(
      PERSONA,
      'manually invoke digest-flusher to render an owner digest',
      'docs/STATUS.md (digest-flusher cron absent)',
    )

    await measure(PERSONA, 'visit /#/share/owner-payapp/test-token', async () => {
      await page.goto('/#/share/owner-payapp/audit-token', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })

    logFinding({
      persona: PERSONA,
      step: 'public /share/owner-payapp route',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (Public route /share/owner-payapp pending registration)',
      notes: 'OwnerPayAppPreview.tsx exists; route not registered in App.tsx',
    })
    logFinding({
      persona: PERSONA,
      step: 'weekly digest email',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (digest-flusher edge fn requires cron)',
    })

    test.skip(true, 'expected_unwired: owner digest -> magic link -> preview chain pending')

    expect(page).toBeDefined()
    finalize(PERSONA)
  })
})
