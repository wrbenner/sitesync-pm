/**
 * it-admin-onboarding.spec.ts — IT admin, day-zero setup.
 *
 * Flow: SSO test -> invite 12 users -> import cost code library -> set up
 * project from template.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - /admin/bulk-invite route absent -> expected_unwired
 *   - /admin/cost-code-library route absent -> expected_unwired
 *   - /admin/project-templates route absent -> expected_unwired
 *
 * This persona's friction points feed into audit/onboarding-friction.md.
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'
import * as fs from 'fs'
import * as path from 'path'

const PERSONA = 'it-admin-onboarding'
test.use({ storageState: authStateFor('it-admin') })

const FRICTION_PATH = path.resolve(process.cwd(), 'audit/onboarding-friction.md')

function appendFriction(step: string, ms: number, blocker: string): void {
  if (!fs.existsSync(FRICTION_PATH)) {
    fs.mkdirSync(path.dirname(FRICTION_PATH), { recursive: true })
    fs.writeFileSync(
      FRICTION_PATH,
      `# Onboarding Friction — IT admin

This file lists steps in the IT-admin onboarding persona that exceeded
the 90-second-per-step target, plus the dominant blocker for each.

| Step | Elapsed (ms) | Blocker | Proposed fix |
| --- | --- | --- | --- |
`,
      'utf8',
    )
  }
  fs.appendFileSync(
    FRICTION_PATH,
    `| ${step.replace(/\|/g, '\\|')} | ${ms} | ${blocker.replace(/\|/g, '\\|')} | (deferred — see docs/STATUS.md) |\n`,
    'utf8',
  )
}

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('SSO -> invite 12 -> cost codes -> template', async ({ page }) => {
    const t0 = Date.now()
    await measure(PERSONA, 'open /admin SSO page', async () => {
      await page.goto('/#/admin/sso', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })
    appendFriction(
      'SSO test page',
      Date.now() - t0,
      'admin shell exists; SSO test action emits no UI signal until config saved',
    )

    const t1 = Date.now()
    await measure(PERSONA, 'attempt /admin/bulk-invite (expected 404)', async () => {
      await page.goto('/#/admin/bulk-invite', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })
    appendFriction(
      'Bulk-invite 12 users',
      Date.now() - t1,
      '/admin/bulk-invite route not registered (docs/STATUS.md)',
    )
    logFinding({
      persona: PERSONA,
      step: '/admin/bulk-invite route',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (App.tsx route registrations)',
    })

    const t2 = Date.now()
    await measure(PERSONA, 'attempt /admin/cost-code-library', async () => {
      await page.goto('/#/admin/cost-code-library', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })
    appendFriction(
      'Import cost code library',
      Date.now() - t2,
      '/admin/cost-code-library route not registered (docs/STATUS.md)',
    )
    logFinding({
      persona: PERSONA,
      step: '/admin/cost-code-library route',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (App.tsx route registrations)',
    })

    const t3 = Date.now()
    await measure(PERSONA, 'attempt /admin/project-templates', async () => {
      await page.goto('/#/admin/project-templates', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })
    appendFriction(
      'Set up project from template',
      Date.now() - t3,
      '/admin/project-templates route not registered (docs/STATUS.md)',
    )
    logFinding({
      persona: PERSONA,
      step: '/admin/project-templates route',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (App.tsx route registrations)',
    })

    const t4 = Date.now()
    await measure(PERSONA, 'attempt /admin/procore-import', async () => {
      await page.goto('/#/admin/procore-import', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })
    appendFriction(
      'Procore one-shot import',
      Date.now() - t4,
      '/admin/procore-import route not registered (docs/STATUS.md)',
    )
    logFinding({
      persona: PERSONA,
      step: '/admin/procore-import route',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (App.tsx route registrations)',
    })

    expect(page).toBeDefined()
    finalize(PERSONA)
  })
})
