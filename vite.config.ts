import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAnalyze = process.env.ANALYZE === 'true'

  return {
    base: '/sitesync-pm/',
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

    build: {
      chunkSizeWarningLimit: 600,
      sourcemap: mode === 'production' ? 'hidden' : true,
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
            if (id.includes('/@react-pdf/') || id.includes('/pdfjs-dist/')) return 'vendor-pdf'
            if (id.includes('/maplibre-gl/') || id.includes('/react-map-gl/')) return 'vendor-maps'
            if (id.includes('/@tiptap/') || id.includes('/prosemirror') || id.includes('/yjs/')) return 'vendor-editor'
            if (id.includes('/@nivo/') || id.includes('/d3-')) return 'vendor-charts'
            if (id.includes('/@dnd-kit/')) return 'vendor-dndkit'
            if (id.includes('/@liveblocks/')) return 'vendor-liveblocks'
            if (id.includes('/tesseract/')) return 'vendor-ocr'
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
