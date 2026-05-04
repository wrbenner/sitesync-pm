# Bundle Attack Spec

**Date:** 2026-05-01
**Status:** Spec ready for autonomous execution
**Scope:** Days 27–29 of Lap 1
**Target:** Demo-path bundle ≤ 500 KB (gzipped main chunk), Lighthouse perf ≥ 90

---

## Heavy Dependencies Inventory

These are the libraries that bloat the bundle. Each must be **dynamically
imported behind its route** so it's not in the main chunk.

| Library | Used in | Action |
|---|---|---|
| `three` (~600 KB minified) | `pages/SiteMap.tsx`, `pages/digital-twin/DigitalTwinPage.tsx`, `components/bim/BIMViewer.tsx`, `pages/dashboard/DashboardSiteMapMini.tsx` | Lazy-load all 4. Mini map uses `<Suspense fallback={...}>`. |
| `@react-pdf/*` or `jspdf` (~400 KB) | `services/pdf/paymentAppPdf.ts`, `lib/payApp/g702Audited.ts`, `lib/payApp/g703Audited.ts`, all `components/export/*Report.tsx` | All export components must be `React.lazy()`. PDFs only generated on user click → safe. |
| `pdfjs-dist` (~300 KB) | `lib/pdfPageSplitter.ts`, `lib/titleBlockDetector.ts` | Already used at the drawing-upload boundary; route-split the drawings page. |
| `@uppy/*` (~200 KB) | `components/files/UppyUploader.tsx` | Used in upload modals only. Lazy-load behind upload trigger. |
| `chart.js` / `recharts` / `d3` | DataTable, dashboard widgets | Lazy-load each widget; main dashboard renders skeletons until widget code arrives. |
| `react-three-fiber` (transitive on `three`) | BIM viewer | Same chunk as `three`. |
| `tesseract.js` (~3 MB if used) | OCR if present | Verify presence; if used, MUST be lazy-loaded — never in main chunk. |

---

## Day 27 — Identify the heavy paths + dynamic-import three.js + PDF
**Goal:** First wave of route-splits. Two heavy libraries off main chunk.
**Steps:**

### Step 1 — Establish baseline
1. `npm run build` — output goes to `dist/`.
2. `du -h dist/assets/*.js | sort -h` — print every chunk size, largest last.
3. Save the output to `docs/audits/BUNDLE_BASELINE_2026-05-01.txt`.
4. Identify the main chunk (largest `index-*.js`). Record its size.

### Step 2 — Three.js lazy-load
For each of the 4 files using `three`:

```tsx
// Before
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

export function BIMViewer() {
  return <Canvas>...</Canvas>
}

// After
import { lazy, Suspense } from 'react'
const BIMViewerInner = lazy(() => import('./BIMViewerInner'))

export function BIMViewer() {
  return (
    <Suspense fallback={<BIMViewerSkeleton />}>
      <BIMViewerInner />
    </Suspense>
  )
}

// And move the actual three.js code into BIMViewerInner.tsx
```

Apply this pattern to: `SiteMap.tsx`, `DigitalTwinPage.tsx`, `BIMViewer.tsx`,
`DashboardSiteMapMini.tsx`.

### Step 3 — PDF lazy-load
For each `components/export/*Report.tsx` and the PDF services, the import
should happen **only when the user clicks "Export"** — never at module load.

```ts
// Before (in some component)
import { generateG702PDF } from '../../services/pdf/paymentAppPdf'
const handleExport = () => generateG702PDF(payApp)

// After
const handleExport = async () => {
  const { generateG702PDF } = await import('../../services/pdf/paymentAppPdf')
  return generateG702PDF(payApp)
}
```

Apply this pattern to every PDF generator entry point.

### Step 4 — Verify
1. `npm run build` again.
2. Save new chunk sizes to `BUNDLE_AFTER_DAY_27_2026-05-01.txt`.
3. Confirm main chunk shrank by at least 800 KB (raw, not gzipped).
4. Confirm `three.js` and PDF code are in separate chunks.

**Acceptance:** Main chunk size dropped substantially. Document the delta in DAY_27_RECEIPT.

---

## Day 28 — Sunday read (no execution work)
Per Lap 1 plan: Sunday-night read of Eleven Nevers + Lap + retro + decision + vision.

---

## Day 29 — Bundle measurement run
**Goal:** Hit ≤ 500 KB on demo path, Lighthouse perf ≥ 90.

### Step 1 — Define "demo path"
The demo flow is:
1. `/login` → `/dashboard` → `/projects/[id]/rfis` → click an RFI → drawer opens

For this path, only these chunks should download:
- main vendor (React, Zustand, react-router)
- main app
- dashboard chunk
- RFI list chunk
- RFI drawer chunk

Three.js, PDF, BIM, OCR, file upload — none of these should load.

### Step 2 — Measure
1. Build: `npm run build`.
2. Use `vite-bundle-visualizer` or equivalent to get a treemap. If not in deps:
   ```
   npm install --save-dev vite-bundle-visualizer
   ```
3. Sum the chunks in the demo path. Target: ≤ 500 KB gzipped.

### Step 3 — Lighthouse
1. `npm run build && npm run preview`.
2. Run Lighthouse on `/dashboard` route in headless Chrome:
   ```
   npx lighthouse http://localhost:4173/dashboard --output json --quiet > lighthouse-dashboard.json
   ```
3. Parse `categories.performance.score` — must be ≥ 0.90.
4. If not, identify the worst-offending Lighthouse audit (LCP, TBT, CLS) and fix it specifically.

### Step 4 — Document baseline
Save final numbers to `docs/audits/BUNDLE_FINAL_2026-05-01.txt`. Include:
- Main chunk size (raw + gzipped)
- Demo-path total size (raw + gzipped)
- Lighthouse perf score
- LCP, TBT, CLS values

**Acceptance:**
- Demo-path bundle ≤ 500 KB gzipped
- Lighthouse perf ≥ 90
- DAY_29_RECEIPT shipped with concrete numbers

---

## Common Failure Modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `three` still in main chunk after lazy-load | Import is at module top of a non-lazy file | Find the offending file; move three import into the lazy boundary |
| PDF chunk bigger than expected | Importing all of `@react-pdf/renderer` at top | Use named imports + check tree-shaking; consider `pdfMake` as alternative |
| Lighthouse perf < 90 with bundle ≤ 500 KB | LCP issue (hero image, blocking font, etc.) | Audit the LCP element. Preload hero. Defer non-critical CSS. |
| TypeScript errors after lazy import refactor | Default export shape mismatch | `lazy()` requires `default` export; rename `export const X` → `export default function X()` |

---

## Vite Config Tuning

If chunk splitting needs tuning, edit `vite.config.ts`:

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'pdf-vendor': ['jspdf', '@react-pdf/renderer', 'pdfjs-dist'],
          'chart-vendor': ['chart.js', 'recharts', 'd3'],
        }
      }
    }
  }
})
```

This guarantees the heavy libs go into their own chunks. Without manual
hints, Rollup may inline them based on its heuristics.

---

## Day 30 — Acceptance Gate (Walker, not the organism)

Programmatic version of the gate is in `LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md`.
Manual version: open the demo URL on a real iPhone connected to a 4G hotspot.
Time the cold open. Note the audit-row drawer time. Either pass — or learn
what to fix in Lap 2.
