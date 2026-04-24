#!/usr/bin/env node
// SiteSync PM — Bundle Size Budget Checker
// Run after `vite build`. Reads dist/assets/ and enforces size limits.
// Exits with code 1 if any budget is exceeded.
//
// Reports:
//   1. Initial JS (app shell, loaded on every route)
//   2. Per-route chunks (must stay small for good TTI)
//   3. Total CSS
//   4. webpack-stats-style summary: bundle grouped by category, sorted by size

import { readdirSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'
import { readFileSync } from 'fs'

const DIST = join(process.cwd(), 'dist', 'assets')

// ── Budgets (gzipped bytes) ─────────────────────────────

const BUDGETS = {
  // Initial JS: vendor-react (~219 KB) + vendor-motion (~40 KB) + index (~125 KB)
  // React 19 + DOM + Router + Framer Motion = ~260 KB gz locked-in baseline.
  // 395 KB gives ~10 KB headroom for the app-shell index chunk.
  initialJs: 395 * 1024,       // 395 KB gzipped
  // Per-route lazy chunk
  perRouteChunk: 130 * 1024,   // 130 KB gzipped
  // Total CSS
  totalCss: 50 * 1024,         // 50 KB gzipped
}

// Chunks that load on every page (initial bundle)
const INITIAL_CHUNKS = ['vendor-react', 'vendor-motion', 'index']

// Heavy vendor chunks excluded from per-route budget (loaded on-demand per feature).
// `vendor-pdf` matches both `vendor-pdf-gen` and `vendor-pdf-viewer` via startsWith.
const VENDOR_CHUNKS = [
  'vendor-react', 'vendor-motion', 'vendor-tanstack', 'vendor-supabase',
  'vendor-three', 'vendor-ifc', 'vendor-jszip', 'vendor-pdf', 'vendor-maps',
  'vendor-editor', 'vendor-charts', 'vendor-dndkit', 'vendor-liveblocks',
  'vendor-ocr', 'vendor-sentry', 'vendor-xlsx', 'vendor-posthog',
  'vendor-xstate', 'vendor-sonner', 'vendor-i18n', 'mutations',
]

// Known-heavy routes: measured, reported, but allowed to exceed the per-route
// budget by an explicit cap. Use sparingly — each entry should have a ticket
// or rationale pointing at future work to slim it down.
const KNOWN_HEAVY_ROUTES = {
  // Drawings page: complex multi-mode viewer + annotation toolbar + revision
  // overlay. Currently ~172 KB gz; allow up to 180 KB while we extract
  // sub-panels and move heavy pdf-viewer plumbing behind a real dynamic import.
  'drawings': 180 * 1024,
}

// ── Helpers ─────────────────────────────────────────────

function gzipSize(filePath) {
  const content = readFileSync(filePath)
  return gzipSync(content).length
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

// Rollup emits `<name>-<hash>.js`. Hashes are short base64url (≈8 chars) and
// may contain dashes themselves, so a naive `-[^.]+$` strip eats the name.
// We match known chunk prefixes directly instead.
function matchChunk(file, chunkList) {
  for (const c of chunkList) {
    if (file === c + '.js') return c
    if (file.startsWith(c + '-') && file.endsWith('.js')) return c
  }
  return null
}

function stripHash(file) {
  // Best-effort display name: drop the trailing hash before `.js`.
  // Rollup hash format: 8 base64url chars, optionally with a single internal dash.
  return file.replace(/-[A-Za-z0-9_-]{6,}\.js$/, '').replace(/\.js$/, '')
}

function categorize(file) {
  if (matchChunk(file, INITIAL_CHUNKS)) return 'initial'
  if (matchChunk(file, VENDOR_CHUNKS)) return 'vendor'
  return 'route'
}

function chunkName(file, category) {
  if (category === 'initial') return matchChunk(file, INITIAL_CHUNKS)
  if (category === 'vendor') return matchChunk(file, VENDOR_CHUNKS)
  return stripHash(file)
}

// ── Scan ────────────────────────────────────────────────

let files
try {
  files = readdirSync(DIST)
} catch {
  console.error('ERROR: dist/assets/ not found. Run `npm run build` first.')
  process.exit(1)
}

const jsFiles = files.filter((f) => f.endsWith('.js') && !f.endsWith('.map'))
const cssFiles = files.filter((f) => f.endsWith('.css') && !f.endsWith('.map'))

const all = jsFiles.map((file) => {
  const category = categorize(file)
  return {
    file,
    name: chunkName(file, category),
    category,
    size: gzipSize(join(DIST, file)),
  }
})

const initialChunks = all.filter((c) => c.category === 'initial')
const vendorChunks = all.filter((c) => c.category === 'vendor')
const routeChunks = all.filter((c) => c.category === 'route')

const initialTotal = initialChunks.reduce((s, c) => s + c.size, 0)
const vendorTotal = vendorChunks.reduce((s, c) => s + c.size, 0)
const routeTotal = routeChunks.reduce((s, c) => s + c.size, 0)
const totalJs = initialTotal + vendorTotal + routeTotal
const cssTotal = cssFiles.reduce((s, f) => s + gzipSize(join(DIST, f)), 0)

// Check per-route chunk budget — with known-heavy exceptions
const routeViolations = []
const routeHeavy = []
for (const chunk of routeChunks) {
  const heavyCap = KNOWN_HEAVY_ROUTES[chunk.name]
  if (heavyCap !== undefined) {
    if (chunk.size > heavyCap) {
      routeViolations.push({ ...chunk, cap: heavyCap })
    } else {
      routeHeavy.push({ ...chunk, cap: heavyCap })
    }
    continue
  }
  if (chunk.size > BUDGETS.perRouteChunk) {
    routeViolations.push({ ...chunk, cap: BUDGETS.perRouteChunk })
  }
}

// ── Report ──────────────────────────────────────────────

let failed = false

console.log('\n📦 SiteSync Bundle Size Report')
console.log('═'.repeat(60))

// Initial JS
const initialStatus = initialTotal <= BUDGETS.initialJs ? '✅' : '❌'
if (initialTotal > BUDGETS.initialJs) failed = true
console.log(`\n${initialStatus} Initial JS: ${formatSize(initialTotal)} / ${formatSize(BUDGETS.initialJs)}`)
for (const chunk of initialChunks.sort((a, b) => b.size - a.size)) {
  console.log(`   ${chunk.file}: ${formatSize(chunk.size)}`)
}

// CSS
const cssStatus = cssTotal <= BUDGETS.totalCss ? '✅' : '❌'
if (cssTotal > BUDGETS.totalCss) failed = true
console.log(`\n${cssStatus} Total CSS: ${formatSize(cssTotal)} / ${formatSize(BUDGETS.totalCss)}`)

// Per-route violations
if (routeViolations.length > 0) {
  failed = true
  console.log('\n❌ Route chunks over budget:')
  for (const v of routeViolations.sort((a, b) => b.size - a.size)) {
    console.log(`   ${v.file}: ${formatSize(v.size)} / ${formatSize(v.cap)}`)
  }
} else {
  console.log(`\n✅ All route chunks within per-route budget (${formatSize(BUDGETS.perRouteChunk)})`)
}

// Known-heavy routes (within exception cap)
if (routeHeavy.length > 0) {
  console.log('\n⚠️  Known-heavy routes (within cap — slim down when feasible):')
  for (const h of routeHeavy.sort((a, b) => b.size - a.size)) {
    console.log(`   ${h.file}: ${formatSize(h.size)} / ${formatSize(h.cap)}`)
  }
}

// ── Webpack-stats-style summary ─────────────────────────

console.log('\n' + '═'.repeat(60))
console.log('📊 Bundle Summary')
console.log('═'.repeat(60))

console.log(`\nTotal JS (gzipped): ${formatSize(totalJs)}`)
console.log(`  Initial (app shell):  ${formatSize(initialTotal).padStart(10)}  (${((initialTotal / totalJs) * 100).toFixed(1)}%)`)
console.log(`  Vendor (on-demand):   ${formatSize(vendorTotal).padStart(10)}  (${((vendorTotal / totalJs) * 100).toFixed(1)}%)`)
console.log(`  Route chunks:         ${formatSize(routeTotal).padStart(10)}  (${((routeTotal / totalJs) * 100).toFixed(1)}%)`)
console.log(`Total CSS (gzipped):  ${formatSize(cssTotal)}`)

console.log('\nTop 10 vendor chunks:')
for (const v of vendorChunks.sort((a, b) => b.size - a.size).slice(0, 10)) {
  console.log(`  ${v.file.padEnd(50)} ${formatSize(v.size).padStart(10)}`)
}

console.log('\nTop 10 route chunks:')
for (const r of routeChunks.sort((a, b) => b.size - a.size).slice(0, 10)) {
  console.log(`  ${r.file.padEnd(50)} ${formatSize(r.size).padStart(10)}`)
}

console.log('\nChunk count: ' + `${jsFiles.length} JS, ${cssFiles.length} CSS`)
console.log('\n' + '═'.repeat(60))

if (failed) {
  console.log('❌ BUNDLE SIZE BUDGET EXCEEDED. Fix before merging.\n')
  process.exit(1)
} else {
  console.log('✅ All budgets passed.\n')
  process.exit(0)
}
