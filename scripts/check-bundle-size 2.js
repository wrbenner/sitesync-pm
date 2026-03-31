#!/usr/bin/env node
// SiteSync AI — Bundle Size Budget Checker
// Run after `vite build`. Reads dist/assets/ and enforces size limits.
// Exits with code 1 if any budget is exceeded.

import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'
import { readFileSync } from 'fs'

const DIST = join(process.cwd(), 'dist', 'assets')

// ── Budgets (gzipped bytes) ─────────────────────────────

const BUDGETS = {
  // Initial JS: vendor-react (208KB) + vendor-motion (40KB) + index chunk
  // React 19 + DOM + Router = 208KB gzipped baseline; 380KB is tight but real
  initialJs: 380 * 1024,       // 380 KB gzipped
  // Per-route lazy chunk
  perRouteChunk: 100 * 1024,   // 100 KB gzipped
  // Total CSS
  totalCss: 50 * 1024,         // 50 KB gzipped
}

// Chunks that load on every page (initial bundle)
const INITIAL_CHUNKS = ['vendor-react', 'vendor-motion', 'index']

// Heavy vendor chunks excluded from per-route budget (loaded on-demand)
const VENDOR_CHUNKS = [
  'vendor-react', 'vendor-motion', 'vendor-tanstack', 'vendor-supabase',
  'vendor-three', 'vendor-pdf', 'vendor-maps', 'vendor-editor',
  'vendor-charts', 'vendor-dndkit', 'vendor-liveblocks', 'vendor-ocr',
  'vendor-sentry', 'vendor-xlsx', 'vendor-posthog', 'vendor-xstate',
  'vendor-sonner', 'vendor-i18n', 'mutations',
]

// ── Helpers ─────────────────────────────────────────────

function gzipSize(filePath) {
  const content = readFileSync(filePath)
  return gzipSync(content).length
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

// ── Scan ────────────────────────────────────────────────

let files
try {
  files = readdirSync(DIST)
} catch {
  console.error('ERROR: dist/assets/ not found. Run `npm run build` first.')
  process.exit(1)
}

const jsFiles = files.filter((f) => f.endsWith('.js'))
const cssFiles = files.filter((f) => f.endsWith('.css'))

// Calculate initial JS bundle size
let initialTotal = 0
const initialDetails = []

for (const file of jsFiles) {
  const isInitial = INITIAL_CHUNKS.some((chunk) => file.startsWith(chunk + '-') || file === chunk + '.js')
  if (isInitial) {
    const size = gzipSize(join(DIST, file))
    initialTotal += size
    initialDetails.push({ file, size })
  }
}

// Check per-route chunks
const routeViolations = []
for (const file of jsFiles) {
  const isVendor = VENDOR_CHUNKS.some((chunk) => file.startsWith(chunk + '-') || file === chunk + '.js')
  const isInitial = INITIAL_CHUNKS.some((chunk) => file.startsWith(chunk + '-') || file === chunk + '.js')
  if (isVendor || isInitial) continue

  const size = gzipSize(join(DIST, file))
  if (size > BUDGETS.perRouteChunk) {
    routeViolations.push({ file, size })
  }
}

// Calculate total CSS size
let cssTotal = 0
for (const file of cssFiles) {
  cssTotal += gzipSize(join(DIST, file))
}

// ── Report ──────────────────────────────────────────────

let failed = false

console.log('\n📦 SiteSync Bundle Size Report')
console.log('═'.repeat(50))

// Initial JS
const initialStatus = initialTotal <= BUDGETS.initialJs ? '✅' : '❌'
if (initialTotal > BUDGETS.initialJs) failed = true
console.log(`\n${initialStatus} Initial JS: ${formatSize(initialTotal)} / ${formatSize(BUDGETS.initialJs)}`)
for (const { file, size } of initialDetails) {
  console.log(`   ${file}: ${formatSize(size)}`)
}

// CSS
const cssStatus = cssTotal <= BUDGETS.totalCss ? '✅' : '❌'
if (cssTotal > BUDGETS.totalCss) failed = true
console.log(`\n${cssStatus} Total CSS: ${formatSize(cssTotal)} / ${formatSize(BUDGETS.totalCss)}`)

// Per-route violations
if (routeViolations.length > 0) {
  failed = true
  console.log(`\n❌ Route chunks over ${formatSize(BUDGETS.perRouteChunk)}:`)
  for (const { file, size } of routeViolations) {
    console.log(`   ${file}: ${formatSize(size)}`)
  }
} else {
  console.log(`\n✅ All route chunks under ${formatSize(BUDGETS.perRouteChunk)}`)
}

console.log('\n' + '═'.repeat(50))

if (failed) {
  console.log('❌ BUNDLE SIZE BUDGET EXCEEDED. Fix before merging.\n')
  process.exit(1)
} else {
  console.log('✅ All budgets passed.\n')
  process.exit(0)
}
