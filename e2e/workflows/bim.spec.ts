/**
 * Workflow B.2 — BIM: model upload + clash-detect regression spec.
 *
 * Exercises the BIM viewer page mount: route is feature-flag gated
 * (FLAGS.bimViewer); when on, the page renders a drop-zone for
 * .glb/.gltf/.ifc with the prompt "Drop a .glb / .gltf / .ifc file here, or
 * click to upload". Without the flag the route redirects to /dashboard —
 * we accept that redirect as a graceful skip.
 *
 * Clash-detect / IFC-parse pipelines run server-side; we assert the upload
 * surface is alive and the model loader scaffold mounts.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   npx playwright test e2e/workflows/bim.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #4/10)
 */
import { test, expect, type Page } from '@playwright/test'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(USER)
  await page.getByLabel('Password', { exact: true }).fill(PASS)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test('B.2 — UI: BIM viewer mounts and exposes IFC/GLTF drop-zone', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/bim`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // If the bimViewer flag is off, App.tsx line 492 redirects to /dashboard.
  // Bail gracefully so this doesn't fail when the flag is dark in an env.
  if (page.url().includes('/dashboard')) {
    test.skip(true, 'BIM viewer flag is OFF in this environment (redirected to /dashboard)')
    return
  }

  // BIMViewerPage.tsx line 191: drop-zone literal text. Confirms the IFC
  // parse / clash-detect upload entry-point is present.
  await expect(page.getByText(/Drop a \.glb \/ \.gltf \/ \.ifc file here/i))
    .toBeVisible({ timeout: 10_000 })
})

test('B.2 — UI: demo building scaffold renders (markers visible)', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/bim`)
  await page.waitForTimeout(2_000)

  if (page.url().includes('/dashboard')) {
    test.skip(true, 'BIM viewer flag is OFF (route redirected)')
    return
  }

  // BIMViewerPage line 211: when no modelUrl is loaded, the page shows a
  // demo building hint banner. Confirms the viewer scaffold (3D canvas +
  // markers) mounts before a user-supplied file is provided.
  await expect(page.getByText(/Demo building shown below/i)).toBeVisible({ timeout: 10_000 })
})
