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
      // Per-spec timeout is 90s instead of the default 30s because
      // cold-load pages routinely consume 15-25s in `waitLoad` alone
      // before the spec gets to its assertions; default 30s was hitting
      // "Target page, context or browser has been closed" on the slower
      // pages (Daily Log, Equipment, Permits) without it being a real
      // regression. 90s also gives flaky-but-recoverable pages a chance
      // to settle on the second wait.
      name: 'page-e2e',
      testMatch: /page-\d+-[a-z-]+\.spec\.ts$/,
      timeout: 90_000,
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
      },
    },
  ],
  webServer: baseConfig.webServer,
})
