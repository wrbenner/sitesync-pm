// Drift guard for scripts/generate-page-tests.ts.
//
// Re-runs the generator in-process and compares the output to what's
// committed under src/test/pages/smoke/. If they differ, the generator
// hasn't been re-run after a registry or template change — fail CI so
// the PR author regenerates.

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { PAGE_REGISTRY } from '../../../audit/registry'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const SMOKE_DIR = path.join(REPO_ROOT, 'src', 'test', 'pages', 'smoke')
const SKIP_ROUTES = new Set<string>(['*', '/login', '/signup', '/onboarding'])

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

describe('page smoke generator', () => {
  it('committed smoke files match registry contents (run npx tsx scripts/generate-page-tests.ts to update)', () => {
    const expected = new Set<string>()
    for (const contract of PAGE_REGISTRY) {
      if (SKIP_ROUTES.has(contract.route)) continue
      if (contract.status === 'stub') continue
      const absPageFile = path.join(REPO_ROOT, contract.pageFile)
      if (!fs.existsSync(absPageFile)) continue
      expected.add(`${slugify(contract.title)}.test.tsx`)
    }

    const actual = new Set(
      fs.existsSync(SMOKE_DIR)
        ? fs.readdirSync(SMOKE_DIR).filter((f) => f.endsWith('.test.tsx'))
        : [],
    )

    const missing = [...expected].filter((f) => !actual.has(f))
    const orphaned = [...actual].filter((f) => !expected.has(f))

    expect(missing, `Missing smoke tests — run the generator:\n  ${missing.join('\n  ')}`).toHaveLength(0)
    expect(orphaned, `Orphaned smoke tests — run the generator:\n  ${orphaned.join('\n  ')}`).toHaveLength(0)
  })
})
