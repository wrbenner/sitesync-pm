import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const outputDir = path.resolve('./polish-review')

export default defineConfig({
  testDir: './e2e/pages',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(outputDir, 'report') }]],
  use: {
    baseURL: 'http://localhost:5173/sitesync-pm/',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  outputDir: path.join(outputDir, 'test-results'),
  snapshotDir: path.join(outputDir, 'snapshots'),
  projects: [
    {
      name: 'page-e2e-iphone',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 393, height: 852 },
        screenshot: 'on',
        screenshotsDir: path.join(outputDir, 'pages'),
      },
    },
    {
      name: 'page-e2e-ipad',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 1024, height: 1366 },
        screenshot: 'on',
        screenshotsDir: path.join(outputDir, 'pages'),
      },
    },
    {
      name: 'page-e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        screenshot: 'on',
        screenshotsDir: path.join(outputDir, 'pages'),
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
