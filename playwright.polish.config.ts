/**
 * Playwright Polish Config — visual regression sweep for all 28 demo pages.
 *
 * Entry point (from CLAUDE.md):
 *   POLISH_USER='...' POLISH_PASS='...' \
 *   npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Captures land in: polish-review/pages/<page>/<viewport>-NN-name.png
 * Auth: uses VITE_DEV_BYPASS=true so the sweep runs without real Supabase creds.
 */

import { defineConfig, devices } from '@playwright/test'

const BASE = 'http://localhost:5174/sitesync-pm/'

export default defineConfig({
  testDir: './e2e/polish',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: [['html', { outputFolder: 'polish-review/report', open: 'never' }]],

  use: {
    baseURL: BASE,
    screenshot: 'on',
    trace: 'off',
    // Save each screenshot to polish-review/pages/<test-title>/<project>-NN.png
    // The page-sweep spec writes them manually so names are deterministic.
  },

  projects: [
    {
      name: 'page-e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'page-e2e-ipad',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 1024, height: 1366 },
      },
    },
    {
      name: 'page-e2e-iphone',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 393, height: 852 },
      },
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 5174',
    url: BASE,
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_DEV_BYPASS: 'true',
    },
  },
})
