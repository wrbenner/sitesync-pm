/**
 * virtualization-audit.ts
 *
 * Scans src/ for non-virtualized lists. Flags any file that:
 *   • Renders a `.map(...)` returning a row component AND
 *   • Doesn't import VirtualDataTable / FixedSizeList / VariableSizeList
 *
 * Heuristic — not perfect — but it surfaces the >100-row lists that
 * silently slow down on customers with 4,200 punch items.
 *
 * Usage:
 *   bun scripts/virtualization-audit.ts            # report
 *   bun scripts/virtualization-audit.ts --fix-list # write candidates to a file
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const ROOT = new URL('../src/', import.meta.url).pathname
const VIRT_IMPORTS = ['VirtualDataTable', 'FixedSizeList', 'VariableSizeList', 'react-window', '@tanstack/virtual']
const ROW_RENDER_PATTERN = /\.map\s*\([^)]*\)\s*=>\s*<[A-Z]/  // .map(... => <Row…)

interface Finding {
  file: string
  reason: string
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(full))
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(full)
  }
  return out
}

async function audit(): Promise<Finding[]> {
  const files = await walk(ROOT)
  const findings: Finding[] = []
  for (const f of files) {
    if (f.includes('__tests__') || f.endsWith('.test.tsx') || f.endsWith('.test.ts')) continue
    if (f.endsWith('VirtualDataTable.tsx')) continue
    const src = await readFile(f, 'utf8')
    const usesVirt = VIRT_IMPORTS.some(v => src.includes(v))
    if (usesVirt) continue
    if (!ROW_RENDER_PATTERN.test(src)) continue
    // Filter out tiny lists by counting array sources defined as constants
    // length < 30 — rough heuristic: if the file's only `.map` is over a
    // hardcoded literal, skip.
    const literalArray = /=\s*\[\s*[^,\]]+(?:,[^,\]]+){0,29}\s*\]/.test(src)
    if (literalArray && !/from supabase\b|use(?:Query|InfiniteQuery)/.test(src)) continue
    findings.push({ file: relative(process.cwd(), f), reason: '.map row-render without virtualization import' })
  }
  return findings
}

async function main() {
  const findings = await audit()
  if (findings.length === 0) {
    console.log('✓ No non-virtualized list candidates found.')
    return
  }
  console.log(`${findings.length} candidate file(s):`)
  for (const f of findings) console.log(`  ${f.file}  — ${f.reason}`)

  if (process.argv.includes('--fix-list')) {
    const out = findings.map(f => `${f.file}\t${f.reason}`).join('\n')
    await writeFile('virtualization-audit.tsv', out)
    console.log('\nWrote virtualization-audit.tsv')
  }

  // Exit non-zero so CI can pick up regressions
  process.exit(findings.length > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(2) })
