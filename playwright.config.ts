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
      // Give the dev server 4 GB on large suites — the full 84-test page-e2e
      // sweep accumulates enough HMR / module-graph state to OOM the default
      // ~2 GB Node heap on memory-constrained CI runners and cloud containers.
      NODE_OPTIONS: '--max-old-space-size=4096',
    }
  : {
      VITE_DEV_BYPASS: 'true',
      NODE_OPTIONS: '--max-old-space-size=4096',
    }

export default defineConfig({
  // Phase B Playwright suites live under tests/{a11y,mobile,visual}/; the
  // original e2e/ folder still hosts workflows + coverage sweeps.
  testDir: '.',
  testMatch: [
    'e2e/**/*.spec.ts',
    'tests/a11y/**/*.spec.ts',
    'tests/mobile/**/*.spec.ts',
    'tests/visual/**/*.spec.ts',
    // FMEA Wave 2 — UI hazard coverage (modal-error, empty-state,
    // optimistic-rollback, double-submit). Playwright runtime.
    'tests/ui/**/*.spec.ts',
    // FMEA Wave-1 race specs: only the double-submit spec is Playwright;
    // the other tests/concurrency/* specs are vitest (excluded below).
    'tests/concurrency/double-submit.spec.ts',
  ],
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
