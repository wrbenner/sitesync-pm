import { defineConfig, devices } from '@playwright/test'

/**
 * Polish sweep configuration.
 *
 * Usage:
 *   POLISH_USER='email' POLISH_PASS='pass' \
 *     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Screenshots land in polish-review/pages/<page>/<viewport>-NN-name.png
 * (directory is gitignored).
 */
export default defineConfig({
  testDir: './e2e/pages',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report/polish' }], ['list']],
  use: {
    baseURL: process.env.POLISH_BASE_URL || 'http://localhost:5173/sitesync-pm/',
    trace: 'on-first-retry',
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
        ...devices['Desktop Chrome'],
        viewport: { width: 393, height: 852 },
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/sitesync-pm/',
    reuseExistingServer: true,
    env: {
      VITE_DEV_BYPASS: 'true',
    },
  },
  outputDir: 'test-results/polish',
})
