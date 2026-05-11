import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173/sitesync-pm/',
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
    command: 'npm run dev',
    url: 'http://localhost:5173/sitesync-pm/',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_DEV_BYPASS: 'true',
      // Prevents supabase.ts from throwing at module load when no real
      // credentials are present. devBypass still activates because
      // VITE_SUPABASE_URL raw env var remains unset.
      VITE_ACCEPTANCE_MODE: 'true',
    },
  },
})
