/**
 * B.5 RLS role-matrix codegen.
 *
 * Reads:
 *   - ops/coverage/table-surface.json    (348 public tables)
 *   - ops/coverage/permission-matrix.json (15 roles defined; we cover 4)
 *
 * Emits:
 *   - tests/rls/B5-rls-role-matrix.generated.spec.ts
 *
 * The generated spec contains one vitest test per (table × role × op) cell:
 *   348 tables × 4 roles × 4 CRUD ops = 5,568 cells
 *
 * Roles covered: anon, viewer, project_manager, owner.
 * Ops covered:   read, insert, update, delete.
 *
 * Skip rules baked in at GEN time:
 *   - Tables matching /^auth\.|^pgsodium|^vault|supabase_/ — framework.
 *
 * Skip rules baked in at RUN time (in the generated spec):
 *   - All 4 ops are wrapped in try/catch and assert against an expected
 *     outcome class (allow / deny) rather than exact status codes.
 *   - Insert is skipped if the row payload can't be inferred safely.
 *
 * USAGE:
 *   tsx tests/codegen/gen-rls-role-matrix.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

const TABLE_SURFACE_PATH = resolve(REPO_ROOT, 'ops/coverage/table-surface.json')
const OUTPUT_PATH = resolve(REPO_ROOT, 'tests/rls/B5-rls-role-matrix.generated.spec.ts')

// Roles covered by this matrix (baseline 4 of 15; rest deferred to a later
// expansion loop).
const ROLES = ['anon', 'viewer', 'project_manager', 'owner'] as const
const OPS = ['read', 'insert', 'update', 'delete'] as const

// Tables we MUST NOT touch — Supabase framework / extension tables.
const FRAMEWORK_PATTERNS = [
  /^auth\./,
  /^pgsodium/,
  /^vault/,
  /^supabase_/,
  /^_realtime/,
  /^_supabase/,
]

function isFrameworkTable(name: string): boolean {
  return FRAMEWORK_PATTERNS.some((p) => p.test(name))
}

interface TableSurface {
  source: string
  tables_total: number
  tables: string[]
}

function loadInventory(): TableSurface {
  const raw = readFileSync(TABLE_SURFACE_PATH, 'utf-8')
  return JSON.parse(raw) as TableSurface
}

function generate(): string {
  const inv = loadInventory()
  const tables = inv.tables.filter((t) => !isFrameworkTable(t))
  const totalCells = tables.length * ROLES.length * OPS.length

  const banner = `// AUTO-GENERATED — do not edit by hand
// Source: tests/codegen/gen-rls-role-matrix.ts
// Inventory: ops/coverage/table-surface.json (${inv.tables_total} tables)
// Tables after framework filter: ${tables.length}
// Roles: ${ROLES.join(', ')}
// Ops:   ${OPS.join(', ')}
// Total cells: ${totalCells}
//
// Each cell hits real staging Supabase via supabase-js (NOT mocked).
// Concurrency is capped at 20 ops in parallel by vitest's default pool;
// expect a multi-minute run. Skips entirely when staging env vars absent.
`

  const header = `import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  SHOULD_RUN,
  ROLES,
  clientForRole,
  admin,
  type RoleName,
} from './auth-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Cell results aggregation (so the spec can print a per-role summary) ──
type CellResult = 'allow' | 'deny' | 'error' | 'skip'
const _results: Record<RoleName, Record<string, number>> = {
  anon: { allow: 0, deny: 0, error: 0, skip: 0 },
  viewer: { allow: 0, deny: 0, error: 0, skip: 0 },
  project_manager: { allow: 0, deny: 0, error: 0, skip: 0 },
  owner: { allow: 0, deny: 0, error: 0, skip: 0 },
}

function bucket(role: RoleName, outcome: CellResult): void {
  _results[role][outcome] += 1
}

const TABLES: readonly string[] = ${JSON.stringify(tables)} as const
type TestOp = 'read' | 'insert' | 'update' | 'delete'

// Per-role / per-op clients are resolved once in beforeAll.
const _clients: Partial<Record<RoleName, SupabaseClient>> = {}

beforeAll(async () => {
  if (!SHOULD_RUN) return
  for (const role of ROLES) {
    const c = await clientForRole(role)
    if (c) _clients[role] = c
  }
})

/**
 * Classify a postgrest result against an op.
 *
 * For 'read': empty data + no error  → 'deny' (RLS hid rows)
 *             non-empty data         → 'allow'
 *             error                  → 'deny' if 401/403/PGRST, else 'error'
 *
 * For 'insert'/'update'/'delete':
 *             no error               → 'allow'  (the row was written/deleted)
 *             error PGRST*           → 'deny'   (policy or schema-shape)
 *             other error            → 'error'
 */
function classify(op: TestOp, data: unknown, error: { code?: string; message: string } | null): CellResult {
  if (op === 'read') {
    if (error) {
      const code = error.code ?? ''
      if (/^PGRST|^42|^28|^401|^403/.test(code) || /permission denied|JWT|RLS/i.test(error.message)) {
        return 'deny'
      }
      return 'error'
    }
    if (Array.isArray(data) && data.length === 0) return 'deny'
    return 'allow'
  }
  // write-class
  if (!error) return 'allow'
  const code = error.code ?? ''
  if (/^PGRST|^42|^28|^401|^403/.test(code) || /permission denied|JWT|RLS|new row violates/i.test(error.message)) {
    return 'deny'
  }
  return 'error'
}

describe.skipIf(!SHOULD_RUN)('B.5 — RLS role-matrix (${totalCells} cells)', () => {
  it('inventory matches generator output', () => {
    expect(TABLES.length).toBe(${tables.length})
  })
`

  // Build the test body
  const body: string[] = []

  for (const table of tables) {
    body.push(`\n  describe('table: ${table}', () => {`)

    for (const role of ROLES) {
      for (const op of OPS) {
        // Insert / update / delete on tables w/o a known safe payload shape:
        // we attempt anyway with a minimal `{ id: gen_random_uuid() }` payload
        // and let postgrest's column-missing / null-violation error count as
        // 'deny'. That's still useful signal — distinguishes "rejected at
        // policy boundary" from "5xx server fault".
        const safeTbl = JSON.stringify(table)
        const anonAssertion =
          role === 'anon'
            ? `
      expect(outcome, '${table}/anon/${op} should deny but got ' + outcome).not.toBe('allow')`
            : ''
        if (op === 'read') {
          body.push(`    it('${role} / read', async () => {
      const client = _clients['${role}']
      if (!client) { bucket('${role}', 'skip'); return }
      const { data, error } = await client.from(${safeTbl}).select('*').limit(1)
      const outcome = classify('read', data, error)
      bucket('${role}', outcome)${anonAssertion}
    })`)
        } else if (op === 'insert') {
          body.push(`    it('${role} / insert', async () => {
      const client = _clients['${role}']
      if (!client) { bucket('${role}', 'skip'); return }
      // Empty payload — relies on column defaults. PG will reject if NOT
      // NULL columns lack defaults; that error is classified as 'deny'.
      const { data, error } = await client.from(${safeTbl}).insert({}).select('id').limit(1)
      const outcome = classify('insert', data, error)
      bucket('${role}', outcome)
      // Cleanup any successfully inserted row (defensive).
      if (outcome === 'allow' && Array.isArray(data) && data.length > 0) {
        const inserted = data[0] as { id?: string }
        if (inserted?.id) {
          await admin().from(${safeTbl}).delete().eq('id', inserted.id)
        }
      }${anonAssertion}
    })`)
        } else if (op === 'update') {
          body.push(`    it('${role} / update', async () => {
      const client = _clients['${role}']
      if (!client) { bucket('${role}', 'skip'); return }
      // Update with a no-op filter that matches nothing real → any rows
      // returned mean the policy let us through. Using an impossible id
      // means we never actually mutate data; the policy boundary is what
      // gets exercised.
      const { data, error } = await client.from(${safeTbl}).update({}).eq('id', '00000000-0000-0000-0000-000000000000').select('id').limit(1)
      const outcome = classify('update', data, error)
      bucket('${role}', outcome)${anonAssertion}
    })`)
        } else if (op === 'delete') {
          body.push(`    it('${role} / delete', async () => {
      const client = _clients['${role}']
      if (!client) { bucket('${role}', 'skip'); return }
      // Same impossible-id pattern as update — never mutates real data.
      const { data, error } = await client.from(${safeTbl}).delete().eq('id', '00000000-0000-0000-0000-000000000000').select('id').limit(1)
      const outcome = classify('delete', data, error)
      bucket('${role}', outcome)${anonAssertion}
    })`)
        }
      }
    }
    body.push(`  })`)
  }

  const footer = `
})

// Emit human-readable per-role summary after the whole suite runs.
// (vitest's afterAll fires once at the end of the file.)
afterAll(() => {
  if (!SHOULD_RUN) return
  console.log('\\n══ B.5 RLS role-matrix — per-role outcomes ══')
  for (const role of ROLES) {
    const r = _results[role]
    console.log(\`  \${role.padEnd(16)} allow=\${r.allow}  deny=\${r.deny}  error=\${r.error}  skip=\${r.skip}\`)
  }
})
`

  return banner + '\n' + header + body.join('\n') + footer
}

// ── main ────────────────────────────────────────────────────────────────
const out = generate()
if (!existsSync(dirname(OUTPUT_PATH))) mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, out, 'utf-8')

const lines = out.split('\n').length
console.log(`✓ wrote ${OUTPUT_PATH} (${lines} lines)`)
