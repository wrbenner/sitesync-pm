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
        resolveDependencies: (_filename, deps) => {
          const SKIP = [
            'vendor-pdf-gen',     // @react-pdf/renderer + pdf-lib (ExportCenter, payApp PDF, wh347)
            'vendor-pdf-viewer',  // pdfjs-dist + react-pdf (drawing viewer)
            'vendor-three',       // three.js + react-three-fiber (BIM viewer)
            'vendor-ifc',         // web-ifc WASM loader (BIM)
            'vendor-charts',      // recharts + d3 (dashboard widgets)
            'vendor-editor',      // tiptap + prosemirror (rich text)
            'vendor-xlsx',        // xlsx (export center)
            'vendor-jszip',       // jszip (drawings bulk upload)
          ]
          return deps.filter((dep) => !SKIP.some((s) => dep.includes(s)))
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            // Core framework (always loaded)
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react-router')) return 'vendor-react'
            // Animation (loaded with app shell)
            if (id.includes('/framer-motion/')) return 'vendor-motion'
            // Data layer
            if (id.includes('/@tanstack/')) return 'vendor-tanstack'
            if (id.includes('/@supabase/')) return 'vendor-supabase'
            // Heavy libs (lazy loaded per page)
            if (id.includes('/three/') || id.includes('/@react-three/')) return 'vendor-three'
            // BIM / IFC WASM loader — only needed on /bim
            if (id.includes('/web-ifc/') || id.includes('/web-ifc-three/')) return 'vendor-ifc'
            // Zip handling (drawings bulk upload) — only pulled on drawings/upload paths
            if (id.includes('/jszip/')) return 'vendor-jszip'
            // Split the PDF stack: generator (@react-pdf/renderer + pdf-lib) vs viewer (pdfjs-dist + react-pdf)
            if (id.includes('/@react-pdf/') || id.includes('/pdf-lib/')) return 'vendor-pdf-gen'
            if (id.includes('/pdfjs-dist/') || id.includes('/react-pdf/')) return 'vendor-pdf-viewer'
            if (id.includes('/@tiptap/') || id.includes('/prosemirror') || id.includes('/yjs/')) return 'vendor-editor'
            if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-charts'
            if (id.includes('/@dnd-kit/')) return 'vendor-dndkit'
            if (id.includes('/@liveblocks/')) return 'vendor-liveblocks'
            if (id.includes('/@sentry/')) return 'vendor-sentry'
            if (id.includes('/xlsx/')) return 'vendor-xlsx'
            if (id.includes('/posthog/')) return 'vendor-posthog'
            if (id.includes('/xstate/') || id.includes('/@xstate/')) return 'vendor-xstate'
            if (id.includes('/sonner/')) return 'vendor-sonner'
            if (id.includes('/i18next/') || id.includes('/react-i18next/')) return 'vendor-i18n'
          },
        },
      },
    },
  }
})
