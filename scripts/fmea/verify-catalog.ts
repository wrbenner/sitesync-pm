#!/usr/bin/env tsx
/**
 * verify-catalog.ts — Gate 27 ratchet for the FMEA catalog.
 *
 * Parses `docs/audits/FMEA_CATALOG_<DATE>.md`, counts entries by status,
 * compares against the previous baseline at `.agent/fmea-baseline.json`,
 * and fails CI if VALIDATED count regressed.
 *
 * On main: updates the baseline to the new count.
 * On PR: requires VALIDATED count >= baseline (ratchet upward only).
 *
 * Usage:
 *   npx tsx scripts/fmea/verify-catalog.ts [--update-baseline]
 *
 * Exit codes:
 *   0 = catalog parsed cleanly + no regression
 *   1 = regression: VALIDATED count dropped below baseline
 *   2 = parse error or catalog missing
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const AUDIT_DIR = resolve(REPO_ROOT, 'docs/audits')
const BASELINE_PATH = resolve(REPO_ROOT, '.agent/fmea-baseline.json')

interface Counts {
  uncovered: number
  partial: number
  validated: number
  out_of_scope: number
  total: number
}

interface Baseline {
  catalog: string
  validated: number
  total_in_scope: number
  recorded_at: string
}

function findLatestCatalog(): string {
  const files = readdirSync(AUDIT_DIR).filter((f) =>
    /^FMEA_CATALOG_\d{4}-\d{2}-\d{2}\.md$/.test(f),
  )
  if (files.length === 0) {
    throw new Error('no FMEA_CATALOG_<DATE>.md found in docs/audits/')
  }
  return files.sort().reverse()[0]
}

function parseCounts(md: string): Counts {
  // Count occurrences of `| <id> | ... | UNCOVERED |` etc. in the markdown tables.
  // Each catalog entry appears at least once with its status; we count distinct IDs.
  // For the top-50 table, status is in the last column.
  // For section-by-section enumerations, status defaults to UNCOVERED unless noted.
  //
  // We use a conservative approach: count VALIDATED / PARTIAL / OUT_OF_SCOPE explicit
  // occurrences, treat everything else as UNCOVERED.

  const c: Counts = {
    uncovered: 0,
    partial: 0,
    validated: 0,
    out_of_scope: 0,
    total: 0,
  }

  // Count by status keyword in markdown body (case-sensitive marker words).
  const validatedRx = /\bVALIDATED\b/g
  const partialRx = /\bPARTIAL\b/g
  const oosRx = /\bOUT_OF_SCOPE\b/g
  const uncoveredRx = /\bUNCOVERED\b/g

  c.validated = (md.match(validatedRx) ?? []).length
  c.partial = (md.match(partialRx) ?? []).length
  c.out_of_scope = (md.match(oosRx) ?? []).length
  c.uncovered = (md.match(uncoveredRx) ?? []).length

  c.total = c.uncovered + c.partial + c.validated + c.out_of_scope
  return c
}

function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline
  } catch {
    return null
  }
}

function writeBaseline(b: Baseline): void {
  writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2) + '\n', 'utf-8')
}

function main(): void {
  const updateBaseline = process.argv.includes('--update-baseline')

  let catalogFile: string
  try {
    catalogFile = findLatestCatalog()
  } catch (e) {
    console.error('::error::' + (e as Error).message)
    process.exit(2)
  }

  const catalogPath = resolve(AUDIT_DIR, catalogFile)
  const md = readFileSync(catalogPath, 'utf-8')
  const c = parseCounts(md)

  const inScopeTotal = c.uncovered + c.partial + c.validated
  const percentValidated = inScopeTotal > 0
    ? Math.round((c.validated / inScopeTotal) * 1000) / 10
    : 0

  console.log(`Catalog: ${catalogFile}`)
  console.log(`  VALIDATED:    ${c.validated}`)
  console.log(`  PARTIAL:      ${c.partial}`)
  console.log(`  UNCOVERED:    ${c.uncovered}`)
  console.log(`  OUT_OF_SCOPE: ${c.out_of_scope}`)
  console.log(`  in-scope total: ${inScopeTotal}`)
  console.log(`  ${percentValidated}% validated`)

  const baseline = readBaseline()

  if (updateBaseline) {
    writeBaseline({
      catalog: catalogFile,
      validated: c.validated,
      total_in_scope: inScopeTotal,
      recorded_at: new Date().toISOString(),
    })
    console.log(`baseline updated to ${c.validated} validated`)
    return
  }

  if (baseline == null) {
    console.log('::warning::no baseline found; run with --update-baseline on main')
    return
  }

  if (c.validated < baseline.validated) {
    console.error(
      `::error::FMEA validated count regressed: ${c.validated} < baseline ${baseline.validated}`,
    )
    process.exit(1)
  }

  if (c.validated > baseline.validated) {
    console.log(
      `gain: +${c.validated - baseline.validated} VALIDATED since baseline (${baseline.recorded_at})`,
    )
  }
}

main()
