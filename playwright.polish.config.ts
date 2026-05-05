import { defineConfig } from '@playwright/test'

/**
 * Polish sweep config — captures screenshots of every key page at three
 * viewports so visual regressions (clipped text, layout overlap, skeleton
 * stalls) can be reviewed after each session.
 *
 * Usage:
 *   POLISH_USER='...' POLISH_PASS='...' \
 *     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Screenshots land in: polish-review/pages/<page>/<viewport>-NN-<name>.png
 */
export default defineConfig({
  testDir: './e2e/page-e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'polish-review/html-report' }],
  ],
  outputDir: 'polish-review/test-results',
  projects: [
    {
      name: 'page-e2e',
      use: {
        // Default viewport (desktop) — specs override per-viewport internally
        viewport: { width: 1440, height: 900 },
        // Persist screenshots unconditionally so we always have captures
        screenshot: 'on',
        baseURL: 'http://localhost:5173/sitesync-pm/',
        // Keep traces for failures
        trace: 'on-first-retry',
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
})
