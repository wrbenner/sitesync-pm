/**
 * playwright.polish.config.ts — Visual polish sweep configuration.
 *
 * Usage:
 *   POLISH_USER='user@example.com' POLISH_PASS='password' \
 *     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Screenshots land in: polish-review/pages/<page>/<viewport>-NN-name.png
 * Auth: uses real credentials from POLISH_USER / POLISH_PASS env vars.
 * Dev bypass: set VITE_DEV_BYPASS=true for local testing without credentials.
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const BASE_URL = process.env.POLISH_BASE_URL ?? 'http://localhost:5173/sitesync-pm/'
const SCREENSHOT_DIR = path.resolve('polish-review/pages')

export default defineConfig({
  testDir: './e2e/polish',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'polish-review/report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    // Pass auth credentials through the test fixture (see e2e/polish/fixtures.ts)
  },

  projects: [
    {
      name: 'page-e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: process.env.CI ? undefined : '.auth/desktop.json',
      },
      testMatch: /page-.*\.spec\.ts/,
    },
    {
      name: 'ipad',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
        storageState: process.env.CI ? undefined : '.auth/ipad.json',
      },
      testMatch: /page-.*\.spec\.ts/,
    },
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
        storageState: process.env.CI ? undefined : '.auth/iphone.json',
      },
      testMatch: /page-.*\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    env: {
      // Use bypass for local dev; omit for CI with real credentials.
      VITE_DEV_BYPASS: process.env.POLISH_USER ? 'false' : 'true',
    },
    timeout: 60_000,
  },
})

export { SCREENSHOT_DIR }
