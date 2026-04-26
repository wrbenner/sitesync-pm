// Generates one smoke test per production/beta route declared in
// audit/registry.ts. Output lives under src/test/pages/smoke/ (committed,
// not gitignored) so PR diffs surface page regressions visually.
//
//   npx tsx scripts/generate-page-tests.ts
//
// A drift-guard test (src/test/audit/generated-smoke.test.ts) re-runs
// this generator and fails CI if any emitted file diverges from what's
// committed.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PAGE_REGISTRY, type PageContract } from '../audit/registry'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'src', 'test', 'pages', 'smoke')

/** Routes that don't warrant a smoke test: catch-all wildcard, auth pages,
 *  onboarding (pre-auth), and catalogued stubs. */
const SKIP_ROUTES = new Set<string>(['*', '/login', '/signup', '/onboarding'])

/** Map entry → filesystem-safe slug based on title. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toPageImportPath(pageFile: string): string {
  // pageFile is 'src/pages/RFIs.tsx' → '../../../pages/RFIs'
  const relFromTest = path.relative('src/test/pages/smoke', pageFile)
  return relFromTest.replace(/\\/g, '/').replace(/\.tsx?$/, '')
}

function inferExportName(pageFile: string, title: string): string {
  // Use default-or-named import; emit a flexible two-variant import.
  void title
  const base = path.basename(pageFile, path.extname(pageFile))
  if (base === 'index') {
    const parent = path.basename(path.dirname(pageFile))
    return parent.charAt(0).toUpperCase() + parent.slice(1).replace(/-./g, (m) => m[1].toUpperCase())
  }
  return base
}

function renderTest(c: PageContract): string {
  const exportName = inferExportName(c.pageFile, c.title)
  const safeTitle = c.title.replace(/'/g, "\\'")

  // Static-smoke scope: confirms the page's source file exists AND declares a
  // React-component export. Avoids dynamic `await import()` because 18 pages
  // in this repo have module-level side effects (IndexedDB, realtime subs,
  // syncManager) that hang or throw in jsdom without an exhaustive mock set.
  // The existing registry drift test already guarantees the page file exists;
  // here we assert its shape. Deeper render tests live in hand-written files
  // like src/test/pages/RFIs.test.tsx.
  return `// AUTO-GENERATED from audit/registry.ts — do not edit by hand.
// Regenerate with: npx tsx scripts/generate-page-tests.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const PAGE_FILE = path.resolve(__dirname, '..', '..', '..', '..', '${c.pageFile}')

describe('${safeTitle} smoke', () => {
  it('page source exists on disk', () => {
    expect(fs.existsSync(PAGE_FILE)).toBe(true)
  })

  it('declares a React-component export', () => {
    const src = fs.readFileSync(PAGE_FILE, 'utf8')
    // Matches:
    //   export default <expr>                                (default export)
    //   export const ${exportName} = …                        (named const arrow)
    //   export function ${exportName}(…)                      (named function)
    //   export { ${exportName} } from '…'                     (re-export)
    const hasDefault = /export\\s+default\\s+/.test(src)
    const hasNamed = new RegExp(
      'export\\\\s+(?:const|function|async\\\\s+function)\\\\s+${exportName}\\\\b',
    ).test(src)
    const hasReexport = new RegExp('export\\\\s*\\\\{[^}]*\\\\b${exportName}\\\\b').test(src)
    expect(hasDefault || hasNamed || hasReexport).toBe(true)
  })
})
`
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Purge stale files so renames don't leave orphans on disk.
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (file.endsWith('.test.tsx') || file.endsWith('.test.ts')) {
      fs.unlinkSync(path.join(OUT_DIR, file))
    }
  }

  const emitted: string[] = []
  for (const contract of PAGE_REGISTRY) {
    if (SKIP_ROUTES.has(contract.route)) continue
    if (contract.status === 'stub') continue
    if (!fs.existsSync(path.join(REPO_ROOT, contract.pageFile))) continue

    const fileName = `${slugify(contract.title)}.test.tsx`
    const filePath = path.join(OUT_DIR, fileName)
    fs.writeFileSync(filePath, renderTest(contract), 'utf8')
    emitted.push(fileName)
  }

   
  console.log(`Generated ${emitted.length} smoke tests → ${path.relative(REPO_ROOT, OUT_DIR)}/`)
}

main()
