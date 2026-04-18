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
    exclude: ['**/node_modules/**', '**/e2e/**', '**/evals/layer3-e2e/**'],
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
        'src/pages/**',
      ],
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
