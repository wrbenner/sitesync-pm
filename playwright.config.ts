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
      // Bypass mode: no Supabase URL → isDevBypassActive()=true → ProtectedRoute
      // skips auth. Explicitly clear VITE_SUPABASE_URL/KEY so .env.local doesn't
      // override. VITE_ACCEPTANCE_MODE provides placeholder URL so supabase.ts
      // doesn't throw at module init.
      VITE_ACCEPTANCE_MODE: 'true',
      VITE_DEV_BYPASS: 'true',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
})
