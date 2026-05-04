// Registry integrity — guards against silent drift between src/App.tsx and
// audit/registry.ts, and against mutation hooks being deleted without updating
// the registry's expectations. When this test fails, either the change should
// be reverted or the registry/App.tsx updated to match.

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { PAGE_REGISTRY, ENTITY_MUTATIONS } from '../../../audit/registry'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

describe('PAGE_REGISTRY ↔ src/App.tsx', () => {
  const appTsx = readSource('src/App.tsx')
  // Two views of App.tsx routes:
  //   - `pageRoutes`   — routes whose element is a real page component.
  //                      These NEED a PAGE_REGISTRY contract.
  //   - `allRoutes`    — every <Route path=…> declared, including pure
  //                      redirects (`<Navigate to=…>`). A registry entry
  //                      is "stale" only when its path doesn't appear
  //                      here at all — redirected routes still count.
  const pageRoutes = new Set<string>()
  const allRoutes = new Set<string>()
  const routeMatches = appTsx.matchAll(/<Route\s+path=["']([^"']+)["']\s+element=\{([^}]*)\}/g)
  for (const match of routeMatches) {
    const route = match[1]
    const element = match[2] ?? ''
    allRoutes.add(route)
    if (!/<Navigate\b/.test(element)) pageRoutes.add(route)
  }

  it('every App.tsx route has a registry entry', () => {
    const registered = new Set(PAGE_REGISTRY.map((p) => p.route))
    const missing = [...pageRoutes].filter((r) => !registered.has(r))
    expect(missing, `Missing registry entries for routes: ${missing.join(', ')}`).toHaveLength(0)
  })

  it('every registry route (except the duplicate /crews stub) exists in App.tsx', () => {
    const stale = PAGE_REGISTRY
      .filter((p) => p.status !== 'stub' && p.route !== '*' && !allRoutes.has(p.route))
      .map((p) => p.route)
    expect(stale, `Registry has routes not in App.tsx: ${stale.join(', ')}`).toHaveLength(0)
  })

  it('every registered pageFile exists on disk', () => {
    const missing: string[] = []
    for (const p of PAGE_REGISTRY) {
      const abs = path.join(REPO_ROOT, p.pageFile)
      if (!fs.existsSync(abs)) missing.push(`${p.route} → ${p.pageFile}`)
    }
    expect(missing, `Page files missing:\n${missing.join('\n')}`).toHaveLength(0)
  })
})

describe('ENTITY_MUTATIONS hook presence', () => {
  it('every declared hook is actually exported by its module', () => {
    const missing: string[] = []
    for (const [entity, mapping] of Object.entries(ENTITY_MUTATIONS)) {
      if (!mapping.module) continue
      const abs = path.join(REPO_ROOT, mapping.module)
      if (!fs.existsSync(abs)) continue // tolerate stub-entity missing modules
      const src = fs.readFileSync(abs, 'utf8')
      for (const kind of ['create', 'update', 'delete'] as const) {
        const hook = mapping[kind]
        if (!hook) continue
        const re = new RegExp(`export\\s+(?:function|const|async\\s+function)\\s+${hook}\\b`)
        if (!re.test(src)) missing.push(`${entity}.${kind}: ${hook}() not exported by ${mapping.module}`)
      }
    }
    expect(missing, `Missing hook exports:\n${missing.join('\n')}`).toHaveLength(0)
  })
})
