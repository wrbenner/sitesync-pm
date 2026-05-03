import { defineConfig, devices } from '@playwright/test'

/**
 * Polish sweep config — captures screenshots of every key page at three
 * viewports (iPhone, iPad, desktop) for visual triage.
 *
 * Entry point:
 *   POLISH_USER='...' POLISH_PASS='...' \
 *     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Captures land in: polish-review/pages/<page>/<viewport>-NN-name.png
 */
export default defineConfig({
  testDir: './e2e/polish',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report/polish' }]],
  use: {
    baseURL: 'http://localhost:5173/sitesync-pm/',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    {
      name: 'page-e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'page-e2e-ipad',
      use: {
        ...devices['iPad Pro'],
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
    command: 'npm run dev',
    url: 'http://localhost:5173/sitesync-pm/',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_DEV_BYPASS: 'true',
    },
  },
  outputDir: 'polish-review',
})
