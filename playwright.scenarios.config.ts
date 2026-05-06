/**
 * Playwright config for the integration scenarios.
 *
 * Distinct from the main config because:
 *   • The scenarios run with a longer per-test timeout (3 min spec budget)
 *   • Setup + teardown is per-scenario via dbReset, not per-spec
 *   • Tests are sequential (a scenario writes seed data; parallel runs would
 *     stomp on each other unless we used Supabase branches)
 *   • Reporter is a smaller list output (the scenario count is small enough
 *     that an HTML report is overkill — JSON for CI consumption)
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/scenarios',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Per-spec budget per the spec: < 3 min real time.
  timeout: 180_000,
  // Setup/teardown is exposed via test.beforeEach/afterEach in scenarioRunner;
  // we cap setup+teardown at 30s via the helper itself.
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'e2e-scenarios-report.json' }]]
    : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173/sitesync-pm/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // We don't auto-start a webServer here — scenarios assume the dev server
  // is already up (locally) or that CI starts the preview server in a
  // sibling step. This keeps the spec runtime tight.
})
