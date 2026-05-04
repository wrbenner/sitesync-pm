// e2e/iris-ground.spec.ts
//
// Captures the cockpit Iris "Ground in the world" pill flow as a webm so
// we have a backup recording for the investor demo. Modeled on
// e2e/_polish-shot.spec.ts (auth via storageState, hash-route navigation).
//
// Spec-local config — does NOT touch playwright.config.ts:
//   * video: 'on'      — every test produces a .webm
//   * screenshot: 'on' — first paint is captured for the email send-out
//
// Output:
//   * test-results/<test>/video.webm — Playwright's per-test recording
//   * polish-review/iris-ground.webm — final copy used by DEMO_BACKUP.md

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const STATE = path.resolve(process.cwd(), 'e2e/.auth/state.json')
const APP_BASE = 'http://localhost:5173/sitesync-pm/'
const RFI_15_ID = 'demo-rfi-015'
const POLISH_REVIEW_DIR = path.resolve(process.cwd(), 'polish-review')
const POLISH_VIDEO_DEST = path.join(POLISH_REVIEW_DIR, 'iris-ground.webm')

test.use({
  storageState: STATE,
  video: 'on',
  screenshot: 'on',
})

test('iris ground-in-the-world pill on RFI #15', async ({ page }) => {
  test.setTimeout(60_000)
  if (!fs.existsSync(POLISH_REVIEW_DIR)) fs.mkdirSync(POLISH_REVIEW_DIR, { recursive: true })

  try {
    // 1. Sign in via storageState + land on the cockpit.
    await page.goto(APP_BASE, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    // 2. Navigate to RFI #15 detail (deterministic id from demoData.ts seed).
    await page.goto(APP_BASE + '#/rfis/' + RFI_15_ID, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    // 3. Click the "Ground in the world" pill.
    const pill = page.getByRole('button', { name: /ground in the world/i })
    await expect(pill).toBeVisible({ timeout: 10_000 })
    await pill.click()

    // 4. Wait for the substrate to mount.
    await expect(page.locator('[data-demo-step="iris-ground"]')).toBeVisible({
      timeout: 10_000,
    })

    // 5. Three lane eyebrows present + the action CTA enables within 6s.
    await expect(page.getByText(/jurisdiction/i)).toBeVisible()
    await expect(page.getByText(/applicable codes/i)).toBeVisible()
    await expect(page.getByText(/precedent|prior rfis|history/i)).toBeVisible()
    await expect(page.locator('text=Use this in my response')).toBeEnabled({
      timeout: 6_000,
    })

    // Hold the frame for the recording — the pill landing is the moment the
    // backup clip needs to capture cleanly.
    await page.waitForTimeout(1500)
  } finally {
    // 6. Always promote the recording to polish-review/iris-ground.webm
    //    (DEMO_BACKUP.md expected location), even on assertion failure so
    //    the failure mode is itself reviewable.
    const videoPath = await page.video()?.path()
    await page.close()
    if (videoPath && fs.existsSync(videoPath)) {
      fs.copyFileSync(videoPath, POLISH_VIDEO_DEST)
    }
  }
})
