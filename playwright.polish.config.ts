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
      // Page-by-page e2e walks. Each page-N-name.spec.ts drives a real
      // user flow with assertions and captures every state along the
      // way. NOT dependent on storageState — we want to hit cold pages.
      name: 'page-e2e',
      testMatch: /page-\d+-[a-z-]+\.spec\.ts$/,
      use: {
        ...baseConfig.use,
        baseURL: baseConfig.use?.baseURL,
      },
    },
  ],
  webServer: baseConfig.webServer,
})
