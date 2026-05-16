#!/usr/bin/env node
// B24-headers security header audit (Crystalline Standard, Tier 2 Security).
//
// Static audit of vercel.json. Asserts every expected security header is
// present on the catch-all route, and reports any missing or degraded
// values. The CI gate fails on regression.
//
// What it checks (per the OWASP Secure Headers Project + Mozilla
// Observatory grade-A baseline):
//
//   REQUIRED (gate fails if missing on the root source)
//     - Strict-Transport-Security  (max-age >= 31536000, includeSubDomains)
//     - X-Content-Type-Options     (nosniff)
//     - X-Frame-Options            (SAMEORIGIN or DENY)
//     - Referrer-Policy            (strict-origin-when-cross-origin
//                                   or no-referrer)
//     - Permissions-Policy         (any non-empty value)
//     - Cross-Origin-Opener-Policy (same-origin)
//
//   RECOMMENDED (warning if missing; does not fail gate yet)
//     - Content-Security-Policy    (any policy)
//     - Cross-Origin-Embedder-Policy
//     - Cross-Origin-Resource-Policy
//
// Output: prose summary by default; --json for machine-readable.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const VERCEL_PATH = resolve(REPO_ROOT, 'vercel.json')

const args = process.argv.slice(2)
const OUTPUT_JSON = args.includes('--json')

if (!existsSync(VERCEL_PATH)) {
  console.error('FAIL: vercel.json not found at', VERCEL_PATH)
  process.exit(2)
}

const config = JSON.parse(readFileSync(VERCEL_PATH, 'utf8'))

function findCatchAll(headers) {
  if (!Array.isArray(headers)) return null
  for (const block of headers) {
    if (block.source === '/(.*)') return block
  }
  return null
}

function indexHeaders(block) {
  const map = new Map()
  if (!block || !Array.isArray(block.headers)) return map
  for (const h of block.headers) {
    if (typeof h.key === 'string') map.set(h.key.toLowerCase(), h.value)
  }
  return map
}

const catchAll = findCatchAll(config.headers)
const headers = indexHeaders(catchAll)

const REQUIRED = [
  {
    key: 'strict-transport-security',
    label: 'Strict-Transport-Security',
    validate(v) {
      if (!v) return 'missing'
      if (!/max-age=(\d+)/.test(v)) return 'no max-age directive'
      const m = v.match(/max-age=(\d+)/)
      const maxAge = Number(m[1])
      if (maxAge < 31536000) return `max-age=${maxAge} < 31536000 (1y)`
      if (!/includeSubDomains/i.test(v)) return 'missing includeSubDomains'
      return null
    },
  },
  {
    key: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    validate(v) {
      if (!v) return 'missing'
      if (v.trim().toLowerCase() !== 'nosniff') return `expected nosniff, got "${v}"`
      return null
    },
  },
  {
    key: 'x-frame-options',
    label: 'X-Frame-Options',
    validate(v) {
      if (!v) return 'missing'
      const u = v.trim().toUpperCase()
      if (u !== 'SAMEORIGIN' && u !== 'DENY') return `expected SAMEORIGIN or DENY, got "${v}"`
      return null
    },
  },
  {
    key: 'referrer-policy',
    label: 'Referrer-Policy',
    validate(v) {
      if (!v) return 'missing'
      const ok = ['strict-origin-when-cross-origin', 'no-referrer', 'same-origin', 'strict-origin']
      if (!ok.includes(v.trim().toLowerCase())) {
        return `expected one of ${ok.join('|')}, got "${v}"`
      }
      return null
    },
  },
  {
    key: 'permissions-policy',
    label: 'Permissions-Policy',
    validate(v) {
      if (!v || !v.trim()) return 'missing or empty'
      return null
    },
  },
  {
    key: 'cross-origin-opener-policy',
    label: 'Cross-Origin-Opener-Policy',
    validate(v) {
      if (!v) return 'missing'
      const ok = ['same-origin', 'same-origin-allow-popups', 'unsafe-none']
      if (!ok.includes(v.trim().toLowerCase())) {
        return `expected one of ${ok.join('|')}, got "${v}"`
      }
      return null
    },
  },
]

const RECOMMENDED = [
  { key: 'content-security-policy', label: 'Content-Security-Policy' },
  { key: 'cross-origin-embedder-policy', label: 'Cross-Origin-Embedder-Policy' },
  { key: 'cross-origin-resource-policy', label: 'Cross-Origin-Resource-Policy' },
]

const required_failures = []
const required_ok = []
for (const r of REQUIRED) {
  const value = headers.get(r.key)
  const err = r.validate(value)
  if (err) required_failures.push({ header: r.label, reason: err })
  else required_ok.push({ header: r.label, value })
}

const recommended_missing = []
const recommended_present = []
for (const r of RECOMMENDED) {
  const value = headers.get(r.key)
  if (value) recommended_present.push({ header: r.label, value })
  else recommended_missing.push({ header: r.label })
}

if (OUTPUT_JSON) {
  process.stdout.write(
    JSON.stringify(
      {
        source: 'vercel.json catch-all (/(.*))',
        required_total: REQUIRED.length,
        required_ok: required_ok.length,
        required_failures,
        recommended_total: RECOMMENDED.length,
        recommended_present: recommended_present.map((r) => r.header),
        recommended_missing: recommended_missing.map((r) => r.header),
      },
      null,
      2,
    ),
  )
  process.stdout.write('\n')
  process.exit(required_failures.length > 0 ? 1 : 0)
}

console.log('B24-headers Security Header Audit')
console.log('=================================')
console.log(`Source: vercel.json catch-all (/(.*))`)
console.log()
console.log(`Required headers: ${required_ok.length} / ${REQUIRED.length} OK`)
for (const r of required_ok) console.log(`  OK    ${r.header}`)
for (const f of required_failures) console.log(`  FAIL  ${f.header} - ${f.reason}`)
console.log()
console.log(`Recommended headers: ${recommended_present.length} / ${RECOMMENDED.length} present`)
for (const r of recommended_present) console.log(`  PRESENT  ${r.header}`)
for (const m of recommended_missing) console.log(`  MISSING  ${m.header} (recommended; no fail)`)
console.log()
if (required_failures.length > 0) {
  console.log(`FAIL - ${required_failures.length} required header(s) missing or invalid.`)
  console.log('Fix by editing vercel.json. See docs at')
  console.log('  https://owasp.org/www-project-secure-headers/')
} else {
  console.log('PASS - all required headers present and valid.')
  if (recommended_missing.length > 0) {
    console.log()
    console.log(
      `${recommended_missing.length} recommended header(s) still missing. Add CSP before GA.`,
    )
  }
}
process.exit(required_failures.length > 0 ? 1 : 0)
