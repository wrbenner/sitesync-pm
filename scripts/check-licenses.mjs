#!/usr/bin/env node
// B41 supply chain — license compliance scanner.
//
// Walks node_modules/, reads each package's license field, classifies
// against the allowlist in ops/coverage/license-allowlist.json, and
// fails CI on any production dep with a disallowed license.
//
// Allowed by default: MIT, ISC, BSD variants, Apache-2.0, MPL-2.0,
// Unlicense, 0BSD, CC0-1.0.
//
// Disallowed by default: GPL-*, AGPL-*, LGPL-*, SSPL, BSL — these
// require legal review before introducing.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const NODE_MODULES = join(REPO_ROOT, 'node_modules')
const ALLOWLIST_PATH = join(REPO_ROOT, 'ops/coverage/license-allowlist.json')

const args = process.argv.slice(2)
const OUTPUT_JSON = args.includes('--json')

if (!existsSync(NODE_MODULES)) {
  console.error('node_modules/ not found. Run `npm ci` first.')
  process.exit(2)
}

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
const allowedLicenses = new Set(allowlist.allowed_licenses.map((s) => s.toLowerCase()))
const allowedPackages = new Set(
  (allowlist.allowed_packages || []).map((e) =>
    typeof e === 'string' ? e : e.name,
  ),
)

// Read production dep set from package.json
const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
const prodDeps = new Set(Object.keys(rootPkg.dependencies || {}))

function normalizeLicense(raw) {
  if (!raw) return 'UNKNOWN'
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw.map((l) => normalizeLicense(l)).join(' OR ')
  if (raw.type) return raw.type
  return 'UNKNOWN'
}

function extractLicenseSpdx(pkgJson) {
  if (pkgJson.license) return normalizeLicense(pkgJson.license)
  if (pkgJson.licenses) return normalizeLicense(pkgJson.licenses)
  return 'UNKNOWN'
}

function isAllowed(licenseStr) {
  if (!licenseStr || licenseStr === 'UNKNOWN') return false
  // Handle SPDX expressions like "(MIT OR Apache-2.0)"
  const cleaned = licenseStr.replace(/[()]/g, '').toLowerCase()
  if (allowedLicenses.has(cleaned)) return true
  // OR-expressions: any one alternative allowed is sufficient.
  if (cleaned.includes(' or ')) {
    return cleaned.split(' or ').some((l) => allowedLicenses.has(l.trim()))
  }
  // AND-expressions: all must be allowed.
  if (cleaned.includes(' and ')) {
    return cleaned.split(' and ').every((l) => allowedLicenses.has(l.trim()))
  }
  return false
}

function walkNodeModules(dir, results = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry === '.bin' || entry === '.cache' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue

    if (entry.startsWith('@')) {
      // Scoped namespace - recurse one level.
      for (const scoped of readdirSync(full)) {
        const scopedFull = join(full, scoped)
        if (statSync(scopedFull).isDirectory()) {
          inspectPackage(scopedFull, `${entry}/${scoped}`, results)
        }
      }
    } else {
      inspectPackage(full, entry, results)
    }
  }
  return results
}

function inspectPackage(pkgDir, name, results) {
  const pkgJsonPath = join(pkgDir, 'package.json')
  if (!existsSync(pkgJsonPath)) return
  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  } catch {
    return
  }
  const license = extractLicenseSpdx(pkg)
  results.push({ name, version: pkg.version || '?', license, dir: pkgDir })
}

const all = walkNodeModules(NODE_MODULES)

// Filter to production-reachable deps (best-effort: just check direct prod deps + their direct deps)
const prodReachable = new Set()
function markReachable(name) {
  if (prodReachable.has(name)) return
  prodReachable.add(name)
  const pkgPath = join(NODE_MODULES, name, 'package.json')
  if (!existsSync(pkgPath)) return
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    for (const dep of Object.keys(pkg.dependencies || {})) markReachable(dep)
  } catch {}
}
for (const dep of prodDeps) markReachable(dep)

const prodPackages = all.filter((p) => prodReachable.has(p.name))
const violations = prodPackages.filter(
  (p) => !allowedPackages.has(p.name) && !isAllowed(p.license),
)

if (OUTPUT_JSON) {
  process.stdout.write(JSON.stringify({
    total_prod_packages: prodPackages.length,
    violations: violations.length,
    details: violations.map((v) => ({ name: v.name, version: v.version, license: v.license })),
  }, null, 2))
  process.stdout.write('\n')
} else {
  console.log(`B41 License Compliance`)
  console.log(`======================`)
  console.log(`Production-reachable packages: ${prodPackages.length}`)
  console.log(`Violations (disallowed license): ${violations.length}`)
  console.log()
  if (violations.length === 0) {
    console.log('PASS — all production deps have an allowlisted license.')
  } else {
    console.log(`FAIL — ${violations.length} package(s) with disallowed or unknown license:`)
    console.log()
    for (const v of violations.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${v.name}@${v.version}  license: ${v.license}`)
    }
    console.log()
    console.log('Resolve each by:')
    console.log('  - Removing the dependency, OR')
    console.log('  - Adding to ops/coverage/license-allowlist.json allowed_packages with reason, OR')
    console.log('  - Adding the SPDX license to allowed_licenses after legal review.')
  }
}

process.exit(violations.length > 0 ? 1 : 0)
