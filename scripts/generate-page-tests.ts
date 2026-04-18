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
  const importPath = toPageImportPath(c.pageFile)
  const exportName = inferExportName(c.pageFile, c.title)
  const safeTitle = c.title.replace(/'/g, "\\'")

  return `// AUTO-GENERATED from audit/registry.ts — do not edit by hand.
// Regenerate with: npx tsx scripts/generate-page-tests.ts
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderPageWithProviders } from '../_helpers'

// Universal mocks — most pages touch these, so mocking unconditionally
// keeps the smoke test isolated from backend + analytics + telemetry.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (r: (x: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
  fromTable: vi.fn(),
  isSupabaseConfigured: true,
}))
vi.mock('../../../hooks/useProjectId', () => ({ useProjectId: () => 'test-project' }))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isAtLeast: () => true,
    canAccessModule: () => true,
    role: 'project_manager',
    loading: false,
  }),
  PermissionError: class extends Error {},
}))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' }, session: null, loading: false, signOut: vi.fn() }),
}))
vi.mock('../../../stores/copilotStore', () => ({
  useCopilotStore: () => ({ setPageContext: vi.fn(), openCopilot: vi.fn(), isOpen: false }),
}))
vi.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('../../../lib/analytics', () => ({ default: { capture: vi.fn(), identify: vi.fn() } }))
vi.mock('../../../lib/sentry', () => ({ default: { captureException: vi.fn(), captureMessage: vi.fn() } }))
vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}))

describe('${safeTitle} smoke', () => {
  it('renders without throwing', async () => {
    const mod = await import('${importPath}')
    const Page = (mod as Record<string, unknown>).${exportName} ?? (mod as { default?: unknown }).default
    expect(typeof Page).toBe('function')
    expect(() => renderPageWithProviders(React.createElement(Page as React.ComponentType), { route: '${c.route}' }))
      .not.toThrow()
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

  // eslint-disable-next-line no-console
  console.log(`Generated ${emitted.length} smoke tests → ${path.relative(REPO_ROOT, OUT_DIR)}/`)
}

main()
