import { defineConfig, devices } from '@playwright/test'

// When E2E_REAL_BACKEND=true, the dev server boots against real Supabase
// (staging by default — controlled via VITE_SUPABASE_URL/ANON_KEY env)
// and dev-bypass is OFF so auth/RLS/triggers are exercised end-to-end.
const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'

const webServerEnv: Record<string, string> = REAL_BACKEND
  ? {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY:
        process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
      VITE_DEV_BYPASS: 'false',
    }
  : {
      VITE_DEV_BYPASS: 'true',
    }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173/sitesync-pm/',
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
    url: process.env.E2E_BASE_URL ?? 'http://localhost:5173/sitesync-pm/',
    reuseExistingServer: !process.env.CI,
    env: webServerEnv,
  },
})
