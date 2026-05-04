// Playwright config for the Lap 1 acceptance gate.
//
// This is a SEPARATE config from `playwright.config.ts` because the
// acceptance gate has different fixture requirements:
//   - Runs against the production build (`vite preview`), not dev server.
//     This is what makes the bundle measurement load-bearing.
//   - Forces dev-bypass on by clearing Supabase env vars. Without this,
//     `/#/day` is auth-walled and first-paint can't be measured.
//   - Longer webServer timeout (build + preview cold-start).
//
// Run: npx playwright test --config=playwright.acceptance.config.ts
//
// Spec: docs/audits/LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md
// Receipt: docs/audits/DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['lap-1-acceptance.spec.ts'],
  fullyParallel: false,         // Sequential — bundle test counts requests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'html',
  use: {
    baseURL: 'http://localhost:4173/sitesync-pm/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    url: 'http://localhost:4173/sitesync-pm/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,            // 3 min — build + preview cold-start on CI
    env: {
      VITE_DEV_BYPASS: 'true',
      // Force isDevBypassActive() in src/lib/devBypass.ts to return true.
      // Without these clears, `/#/day` is auth-walled and the gate can't
      // measure first paint on a cold session.
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
})
