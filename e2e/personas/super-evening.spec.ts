/**
 * super-evening.spec.ts — Superintendent, 5:30pm wrap-up.
 *
 * Flow: auto-drafted daily log -> review/edit -> sign.
 *
 * The auto-draft flow lives at src/lib/dailyLogDrafting and is called by
 * a daily cron-fed edge function. Today the edge function exists but no
 * cron entry triggers it — manual invocation requires CRON_SECRET.
 */
import { test, expect } from '@playwright/test'
import { authStateFor, requireCronSecretOrSkip } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'super-evening'
test.use({ storageState: authStateFor('super') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('auto-drafted daily log -> review -> sign', async ({ page }) => {
    requireCronSecretOrSkip(
      PERSONA,
      'manually invoke daily-log auto-draft edge fn',
      'docs/DAILY_LOG_AUTO_DRAFT.md',
    )

    await measure(PERSONA, 'open /daily-log', async () => {
      await page.goto('/#/daily-log', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })

    logFinding({
      persona: PERSONA,
      step: 'auto-draft daily log on cron',
      kind: 'expected_unwired',
      citation: 'docs/DAILY_LOG_AUTO_DRAFT.md',
      notes: 'edge fn exists; no pg_cron entry triggers it nightly',
    })

    expect(page.url()).toContain('/daily-log')
    finalize(PERSONA)
  })
})
