/**
 * Playwright config dedicated to the polish audit.
 *
 * Extends the base config but adds a setup-project that authenticates
 * once, saves the storage state, and lets the main audit spec reuse it.
 *
 * Run:
 *   POLISH_USER=...  POLISH_PASS=...  \
 *     npx playwright test --config=playwright.polish.config.ts
 */
import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

const STORAGE_STATE = 'playwright/.auth/user.json'

export default defineConfig({
  ...baseConfig,
  testDir: './e2e',
  // Force serial so the setup runs before the audit and we don't race.
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  projects: [
    {
      name: 'polish-setup',
      testMatch: /polish-audit\.setup\.ts$/,
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
      },
    },
    {
      name: 'polish-audit',
      testMatch: /polish-audit\.spec\.ts$/,
      dependencies: ['polish-setup'],
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
        storageState: STORAGE_STATE,
      },
    },
    {
      // Walks each surface's productive lifecycle (not just landing
      // states). Captures named screenshots at every meaningful step
      // so we can polish workflow states, not just pages.
      name: 'polish-workflow',
      testMatch: /polish-workflow\.spec\.ts$/,
      dependencies: ['polish-setup'],
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
        storageState: STORAGE_STATE,
      },
    },
    {
      // Wave-1 walk — captures the new homepage + demo-critical pages
      // for the investor-readiness review. Uses the saved storage state
      // directly; does NOT depend on polish-setup so it can run without
      // POLISH_USER/POLISH_PASS env vars when a recent session already
      // exists at playwright/.auth/user.json.
      name: 'wave1-walk',
      testMatch: /wave1-walk\.spec\.ts$/,
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
        storageState: STORAGE_STATE,
      },
    },
    {
      // Page-by-page e2e walks. Each page-N-name.spec.ts drives a real
      // user flow with assertions and captures every state along the
      // way. NOT dependent on storageState — we want to hit cold pages.
      //
      // Per-spec timeout is 300s in cloud containers. A fresh Chromium
      // context must parse and execute hundreds of unminified Vite modules
      // (~2MB of JS). On slow containers this browser-side execution phase
      // alone can take 90-115s before the spec starts its assertions.
      // 300s gives a 185s margin for the actual test work (~60s) while
      // still being a finite safety net against true hangs.
      name: 'page-e2e',
      testMatch: /page-\d+-[a-z-]+\.spec\.ts$/,
      timeout: 300_000,
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
      },
    },
  ],
  webServer: baseConfig.webServer,
})
