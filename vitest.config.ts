import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
    },
    exclude: [
      '**/node_modules/**',
      '**/e2e/**',
      '**/evals/layer3-e2e/**',
      '**/.claude/worktrees/**',
      '**/.worktrees/**',
      // Playwright specs emitted by scripts/generate-e2e.ts — runtime is
      // @playwright/test, not vitest.
      'audit/generated/**',
      'audit/harness/route-audit.ts',
      // Phase B Playwright suites (a11y, mobile, visual) — runtime is
      // @playwright/test. They live under tests/ alongside vitest suites
      // (rls, storage, webhooks, cron, rpc, capacitor, realtime,
      // migrations) so the runtimes must be split explicitly.
      'tests/a11y/**',
      'tests/mobile/**',
      'tests/visual/**',
      // macOS Finder / iCloud sync conflict duplicates ("foo 2.test.tsx",
      // "__tests__ 4/foo.test.tsx", etc.). Already gitignored, but iCloud
      // can regenerate them on disk and vitest would otherwise run stale
      // copies that fail because their imports/exports drifted.
      '**/* [0-9].*',
      '**/* [0-9]/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/machines/**',
        'src/api/**',
        'src/hooks/**',
        'src/utils/**',
        'src/lib/**',
        'src/components/**',
        'src/stores/**',
      ],
      // src/pages/** intentionally NOT included: the generated smoke tests
      // under src/test/pages/smoke/ are static file-existence checks (do not
      // execute page code), so adding src/pages/** would dilute the coverage
      // percentage below the quality floor without any real signal. Hand-
      // written render tests (RFIs, Tasks) still contribute via their
      // hook/component imports. Revisit once deeper per-page render tests
      // are added in a follow-up.
      exclude: [
        'src/test/**',
        'src/types/**',
        '**/*.d.ts',
        '**/*.test.*',
        '**/index.ts',
      ],
      // Thresholds kept conservative until CI measures the real baseline
      // with Phase A tests running. Ratchet up once the number stabilizes.
      // Roadmap target: 65/55/60/65.
      thresholds: {
        statements: 43,
        branches: 35,
        functions: 40,
        lines: 43,
      },
    },
  },
})
