import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAnalyze = process.env.ANALYZE === 'true'

  return {
    base: process.env.VERCEL ? '/' : '/sitesync-pm/',
    plugins: [
      react(),
      // Bundle visualizer: run ANALYZE=true npm run build to generate stats.html
      isAnalyze &&
        import('rollup-plugin-visualizer').then((m) =>
          m.visualizer({
            filename: 'dist/stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ),
    ].filter(Boolean),

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Ensure CJS-only deps are pre-bundled in dev mode so that dynamic
    // import('pdfjs-dist') resolves cleanly instead of hitting CJS/ESM
    // interop issues that surface as "Failed to fetch dynamically imported
    // module" errors.
    optimizeDeps: {
      include: ['pdfjs-dist', 'jszip'],
    },

    build: {
      chunkSizeWarningLimit: 250,
      sourcemap: mode === 'production' ? 'hidden' : true,
      // Don't auto-preload heavy route-specific chunks. The default Vite
      // behavior emits <link rel="modulepreload"> for every transitive
      // dependency of the entry — which pulls vendor-pdf-gen (532 KB) and
      // vendor-pdf-viewer (220 KB) into the demo-path even though /day
      // doesn't use them. Filter these so they only load when their
      // route's dynamic import fires. Lap-1 acceptance gate at
      // docs/audits/DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md.
      modulePreload: {
        // Only preload the always-eager core. Heavy libs (pdf, charts, three,
        // ifc, editor, xlsx, jszip) are no longer named-split — they ride along
        // with their lazy-route chunks and load only when the route mounts.
        // We still defensively filter any remaining route-shape chunks that
        // shouldn't preload before their route renders.
        resolveDependencies: (_filename, deps) => {
          const ROUTE_LAZY = [
            'drawings-',
            'BIMViewerPage-',
            'OwnerReportPage-',
            'ExportCenter-',
            'TimeTracking-',
            'compliance-',
            'payment-applications-',
            'daily-log-',
            'submittals-',
          ]
          return deps.filter((dep) => !ROUTE_LAZY.some((s) => dep.includes(s)))
        },
      },
      rollupOptions: {
        output: {
          // Manual chunks for the always-eager core only. Heavy route-specific
          // libs (recharts, @react-pdf, pdf-lib, pdfjs-dist, react-pdf, three,
          // web-ifc, xlsx, jszip, tiptap, dnd-kit, liveblocks, sentry, posthog)
          // are deliberately NOT split here — letting Rollup co-locate them
          // with their lazy-route consumers prevents chunk-graph entanglement
          // (e.g., vendor-react ending up with a static `import` from
          // vendor-charts because of d3/recharts shared internals). Day-30
          // bundle gate proved that named-chunk splitting was pulling all
          // four heavy vendors into the cold path even when no eager call
          // site touched them. Receipt: docs/audits/DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            // Core framework (always loaded)
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react-router') || id.includes('/scheduler/')) return 'vendor-react'
            // Animation (used by app shell; opt-in could remove later)
            if (id.includes('/framer-motion/')) return 'vendor-motion'
            // Data layer (used in entry — auth + queries)
            if (id.includes('/@tanstack/')) return 'vendor-tanstack'
            if (id.includes('/@supabase/')) return 'vendor-supabase'
            // Toast UI used app-wide
            if (id.includes('/sonner/')) return 'vendor-sonner'
            // i18n loaded eagerly
            if (id.includes('/i18next/') || id.includes('/react-i18next/')) return 'vendor-i18n'
            // xstate is tiny and used by many machines — keep it grouped
            if (id.includes('/xstate/') || id.includes('/@xstate/')) return 'vendor-xstate'
          },
        },
      },
    },
  }
})
