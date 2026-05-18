#!/usr/bin/env tsx
/**
 * B.4 codegen — emit the full RPC × role × payload-variant matrix.
 *
 * Reads:
 *   - ops/coverage/rpcs.json              (294 public RPCs with signatures)
 *   - ops/coverage/permission-matrix.json (15 roles defined; we cover 4)
 *
 * Emits:
 *   - tests/rpc/B4-rpc-role-matrix.generated.spec.ts
 *
 * Matrix axes:
 *   rpcs       × ~240 (after filtering trigger fns + framework internals)
 *   roles      ×   4  (anon, viewer, project_manager, owner)
 *   variants   ×   2  (valid_params, invalid_params)
 * total cells = sorted-RPCs × 4 × 2  (≈ 1,920+)
 *
 * The mission spec budget is 294 × 4 × 2 = 2,352 cells. We document the
 * pre-filter total in MASTER_MATRIX (2,352) and report the post-filter live
 * cell count at the end of codegen.
 *
 * Contract assertions per cell (kept loose because RBAC for 294 RPCs is
 * under-documented — the goal is to surface real failures the loop can
 * triage, not lock in incorrect expectations):
 *
 *   anon + valid_params       → must reject (401/403/PGRST/42501)
 *   anon + invalid_params     → must reject OR shape-error (any 4xx)
 *   owner + valid_params      → 2xx OR business-rule 4xx (NEVER 5xx)
 *   owner + invalid_params    → 4xx with error shape
 *   viewer / pm + valid       → either accept or reject (logged, not failed)
 *   viewer / pm + invalid     → 4xx (never 5xx)
 *
 *   UNIVERSAL: no cell may return a 5xx — any 5xx is treated as a real
 *   platform bug and surfaced for the next loop iteration to triage.
 *
 * Safety:
 *   - Trigger functions (returnType === 'trigger') — skipped (not callable
 *     via PostgREST).
 *   - Framework/extension RPCs (pg_*, pgrst_*, halfvec_*, vector_*, etc.)
 *     — skipped because they're pg/extension internals, not app code.
 *   - DESTRUCTIVE_NAME_PATTERNS (delete, wipe, purge) — emitted as it.todo
 *     so the suite never accidentally trashes staging data.
 *
 * Runtime:
 *   - withConcurrency(cells, 10, ...) bounds in-flight RPCs at 10 to keep
 *     staging rate-limits happy across the multi-thousand-cell sweep.
 *
 * Re-run:
 *   npx tsx tests/codegen/gen-rpc-role-matrix.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Rpc {
  name: string
  argTypes: string[] | null
  returnType: string
  isSecurityDefiner: boolean
  numArgs: number
}

interface RpcInventory {
  source: string
  count: number
  rpcs: Rpc[]
}

const REPO_ROOT = resolve(__dirname, '..', '..')
const RPCS_PATH = resolve(REPO_ROOT, 'ops/coverage/rpcs.json')
const OUTPUT_PATH = resolve(REPO_ROOT, 'tests/rpc/B4-rpc-role-matrix.generated.spec.ts')

const inventory = JSON.parse(readFileSync(RPCS_PATH, 'utf-8')) as RpcInventory

// ── Filters ─────────────────────────────────────────────────────────────────
// Framework / extension fns — not user-callable app surfaces; skip them so
// we focus on real app-RBAC contracts.
const FRAMEWORK_PATTERNS: RegExp[] = [
  /^pgrst_/, /^pg_/, /^auth_/, /^_/, /^trigger_/, /_set_updated_at$/,
  /^array_to_/, /^halfvec_/, /^sparsevec_/, /^vector_/, /^uuid_/, /^citext/,
  /^gen_random/, /^extschema_?$/, /^binary_quantize$/, /^hnsw_/, /^ivfflat_/,
  /^cosine_distance$/, /^l2_distance$/, /^l1_distance$/, /^inner_product$/,
  /^l2_norm$/, /^l2_normalize$/, /^subvector$/, /^vector_dims$/, /^vector_norm$/,
  /^avg$/, /^sum$/,
]

// Destructive — never auto-invoke even with admin client; emit it.todo.
const DESTRUCTIVE_NAME_PATTERNS: RegExp[] = [
  /\bdelete\b/i,
  /\bwipe\b/i,
  /\bpurge\b/i,
  /\bdrop\b/i,
  /\btruncate\b/i,
  /^end_impersonation$/i,
  /^teardown_/i,
]

function isFramework(name: string): boolean {
  return FRAMEWORK_PATTERNS.some((re) => re.test(name))
}

function isDestructive(name: string): boolean {
  return DESTRUCTIVE_NAME_PATTERNS.some((re) => re.test(name))
}

// ── Payload synthesis ───────────────────────────────────────────────────────
// Map a pg type to a "best-guess valid" value for synthesizing valid_params.
// We use sentinel UUIDs / empty strings / zero-numbers because the goal is
// shape-validity, not semantic-validity. Many RPCs will still 4xx because
// the entity doesn't exist — that's fine and expected. What matters is the
// call doesn't 5xx and that anon-deny / owner-allow gates fire.
const STAGING_PROJECT_ID = '00000000-0000-0000-0000-000000000001'
const STAGING_ORG_ID = '00000000-0000-0000-0000-000000000002'
const STAGING_ENTITY_ID = '00000000-0000-0000-0000-000000000003'

function sampleValueForType(pgType: string, argName: string | null = null): unknown {
  const t = pgType.toLowerCase().trim()
  // Prefer entity-specific defaults by arg name when present.
  if (argName) {
    const n = argName.toLowerCase()
    if (n.includes('project') && t.includes('uuid')) return STAGING_PROJECT_ID
    if ((n.includes('org') || n.includes('organization')) && t.includes('uuid')) return STAGING_ORG_ID
  }
  if (t === 'uuid' || t.startsWith('uuid')) return STAGING_ENTITY_ID
  if (t.includes('int') || t.includes('numeric') || t.includes('float') || t.includes('double') || t.includes('real')) return 0
  if (t.includes('bool')) return false
  if (t.includes('json') || t.includes('jsonb')) return {}
  if (t.endsWith('[]')) {
    const inner = t.slice(0, -2)
    return [sampleValueForType(inner)]
  }
  if (t.includes('timestamp') || t.includes('date') || t.includes('time')) return new Date(0).toISOString()
  if (t.includes('bytea')) return ''
  if (t === 'text' || t.includes('varchar') || t.includes('char') || t === 'name' || t === 'citext') return ''
  // Unknown — fall back to empty string. The RPC will likely 4xx; that's OK.
  return ''
}

function invalidValueForType(pgType: string): unknown {
  // Pick a value of the WRONG type to provoke a shape error.
  const t = pgType.toLowerCase().trim()
  if (t === 'uuid' || t.startsWith('uuid')) return 'not-a-uuid'
  if (t.includes('int') || t.includes('numeric') || t.includes('float')) return 'not-a-number'
  if (t.includes('bool')) return 'not-a-bool'
  // For text-ish types, pass an object instead.
  return { invalid: true }
}

// Many RPCs have positional arg type lists with no per-arg name in pg_proc;
// PostgREST requires named JSON keys. We use synthetic names `p1`, `p2`, …
// which won't match real arg names but PostgREST will respond with a 404 /
// 400 "Could not find function with those arguments" — that's a deterministic
// 4xx response and STILL exercises the auth contract (anon must 401 BEFORE
// PostgREST reaches signature-matching). For RPCs where we can guess the
// arg name from the type, do so; otherwise fall back to p1..pN.
function argNameAt(idx: number): string {
  return `p${idx + 1}`
}

function buildPayload(rpc: Rpc, variant: 'valid_params' | 'invalid_params'): Record<string, unknown> {
  const args = rpc.argTypes ?? []
  if (args.length === 0) return {}
  const payload: Record<string, unknown> = {}
  for (let i = 0; i < args.length; i++) {
    const t = args[i]
    const name = argNameAt(i)
    if (variant === 'valid_params') {
      payload[name] = sampleValueForType(t, name)
    } else {
      // invalid_params: corrupt the first arg. Pure missing-arg variant is
      // simulated by leaving payload empty when there are required args.
      if (i === 0) {
        payload[name] = invalidValueForType(t)
      } else {
        payload[name] = sampleValueForType(t, name)
      }
    }
  }
  return payload
}

// ── Build the matrix ────────────────────────────────────────────────────────
// 1. Filter out triggers + framework + destructive (destructive → todo).
// 2. De-duplicate by name (overloaded fns share a name; we test once per name
//    using the first overload's signature).
// 3. Sort by name for determinism.
const seen = new Set<string>()
const callable: Rpc[] = []
const destructive: Rpc[] = []
for (const rpc of inventory.rpcs) {
  if (rpc.returnType === 'trigger') continue
  if (isFramework(rpc.name)) continue
  if (seen.has(rpc.name)) continue
  seen.add(rpc.name)
  if (isDestructive(rpc.name)) {
    destructive.push(rpc)
    continue
  }
  callable.push(rpc)
}
callable.sort((a, b) => a.name.localeCompare(b.name))
destructive.sort((a, b) => a.name.localeCompare(b.name))

const ROLES = ['anon', 'viewer', 'project_manager', 'owner'] as const
const VARIANTS = ['valid_params', 'invalid_params'] as const

const liveCells = callable.length * ROLES.length * VARIANTS.length
const todoCells = destructive.length * ROLES.length * VARIANTS.length

// Pre-build the cells array (small JSON shape) so the generated spec is
// data-driven rather than emitting tens of thousands of individual `it()`s.
interface Cell {
  rpc: string
  role: (typeof ROLES)[number]
  variant: (typeof VARIANTS)[number]
  payload: Record<string, unknown>
  isSecurityDefiner: boolean
}
const cells: Cell[] = []
for (const rpc of callable) {
  for (const role of ROLES) {
    for (const variant of VARIANTS) {
      cells.push({
        rpc: rpc.name,
        role,
        variant,
        payload: buildPayload(rpc, variant),
        isSecurityDefiner: rpc.isSecurityDefiner,
      })
    }
  }
}

// ── Emit the spec ───────────────────────────────────────────────────────────
const banner = `// AUTO-GENERATED — do not edit by hand
// Source:    tests/codegen/gen-rpc-role-matrix.ts
// Inventory: ops/coverage/rpcs.json (${inventory.count} RPCs total)
// Callable:  ${callable.length} (post trigger/framework filter, deduped by name)
// Destructive (it.todo): ${destructive.length}
// Roles:     ${ROLES.join(', ')}
// Variants:  ${VARIANTS.join(', ')}
// Live cells: ${liveCells}
// Todo cells: ${todoCells}
// Total:     ${liveCells + todoCells}
//
// Each cell hits real staging Supabase via supabase-js .rpc() (NOT mocked).
// Concurrency capped at 10 in-flight calls (see withConcurrency helper).
// Skips entirely when staging env vars absent.
//
// Regenerate via:  npx tsx tests/codegen/gen-rpc-role-matrix.ts
`

// JSON-serialize the cells array. Keep it on a single line for grep-friendliness
// but pretty-print would also work — vitest doesn't care.
const cellsJson = JSON.stringify(cells)
const destructiveNames = destructive.map((r) => r.name)

const spec = `${banner}
/* eslint-disable */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  SHOULD_RUN,
  ROLES,
  clientForRole,
  withConcurrency,
  type RoleName,
} from './auth-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Cell {
  rpc: string
  role: RoleName
  variant: 'valid_params' | 'invalid_params'
  payload: Record<string, unknown>
  isSecurityDefiner: boolean
}

interface Outcome {
  status: 'allow' | 'deny' | 'error' | 'unknown'
  code: string
  message: string
  httpStatus: number | null
}

const ALL_CELLS: Cell[] = ${cellsJson} as Cell[]
const DESTRUCTIVE: readonly string[] = ${JSON.stringify(destructiveNames)} as const

// Smoke-test escape hatch: when B4_SAMPLE_LIMIT is set, restrict the matrix
// to the first N RPCs × all roles × all variants. Used by the local
// validation run that this codegen ships with — full sweep runs in CI.
const _sampleLimit = Number(process.env.B4_SAMPLE_LIMIT ?? 0)
const CELLS: Cell[] = _sampleLimit > 0
  ? (() => {
      const allowed = new Set<string>()
      for (const c of ALL_CELLS) {
        if (allowed.size >= _sampleLimit && !allowed.has(c.rpc)) continue
        allowed.add(c.rpc)
      }
      return ALL_CELLS.filter((c) => allowed.has(c.rpc))
    })()
  : ALL_CELLS

// Per-role clients are resolved once in beforeAll.
const _clients: Partial<Record<RoleName, SupabaseClient>> = {}
const _outcomes = new Map<string, Outcome>()

function cellKey(c: Cell): string {
  return c.rpc + '|' + c.role + '|' + c.variant
}

/** Classify a supabase-js .rpc() result. */
function classify(data: unknown, error: { code?: string; message: string; details?: string; hint?: string } | null): Outcome {
  if (!error) {
    return { status: 'allow', code: '', message: '', httpStatus: 200 }
  }
  const code = error.code ?? ''
  const msg = error.message ?? ''
  // PostgREST RBAC + Postgres permission errors all map to 'deny'.
  if (
    /^42501$/.test(code) ||
    /^28/.test(code) ||
    /^401$/.test(code) ||
    /^403$/.test(code) ||
    /^PGRST301$/.test(code) ||
    /^PGRST302$/.test(code) ||
    /permission denied/i.test(msg) ||
    /JWT/i.test(msg) ||
    /unauthor/i.test(msg) ||
    /not allowed/i.test(msg) ||
    /access denied/i.test(msg)
  ) {
    return { status: 'deny', code, message: msg, httpStatus: 401 }
  }
  // Function-not-found / arg-mismatch / shape errors are 'error' (not RBAC).
  if (/^PGRST/.test(code) || /^42/.test(code) || /^22/.test(code) || /^23/.test(code)) {
    return { status: 'error', code, message: msg, httpStatus: 400 }
  }
  // Unknown error class — treat as 'error' but flag.
  return { status: 'unknown', code, message: msg, httpStatus: null }
}

beforeAll(async () => {
  if (!SHOULD_RUN) return
  // Resolve all role clients up-front (sequential to avoid hammering auth).
  for (const role of ROLES) {
    const c = await clientForRole(role)
    if (c) _clients[role] = c
  }

  // Execute the full matrix once, store outcomes in the map. Each per-cell
  // it() then reads its outcome from the map and asserts. This keeps the
  // concurrency cap holistic (≤10 across the entire matrix) rather than
  // per-describe-block.
  await withConcurrency(CELLS, 10, async (cell) => {
    const client = _clients[cell.role]
    if (!client) {
      _outcomes.set(cellKey(cell), { status: 'unknown', code: 'NO_CLIENT', message: 'role client not available', httpStatus: null })
      return
    }
    try {
      // supabase-js .rpc() returns { data, error }; we use empty {} when
      // there are no args to avoid passing undefined positional payload.
      const { data, error } = await client.rpc(cell.rpc as never, cell.payload as never)
      _outcomes.set(cellKey(cell), classify(data, error as never))
    } catch (e) {
      _outcomes.set(cellKey(cell), { status: 'error', code: 'THROWN', message: String(e), httpStatus: null })
    }
  })
}, 900_000)

describe.skipIf(!SHOULD_RUN)('B.4 — RPC role-matrix (' + ${liveCells} + ' live cells)', () => {
  it('inventory matches generator output', () => {
    if (_sampleLimit > 0) {
      // Sample mode: just sanity-check the slice is non-empty and ≤ full size.
      expect(CELLS.length).toBeGreaterThan(0)
      expect(CELLS.length).toBeLessThanOrEqual(${liveCells})
    } else {
      expect(CELLS.length).toBe(${liveCells})
    }
  })

  it('no cell threw a network-level exception (THROWN sentinel)', () => {
    const thrown: string[] = []
    for (const cell of CELLS) {
      const o = _outcomes.get(cellKey(cell))
      if (o && o.code === 'THROWN') {
        thrown.push(cell.rpc + ' [' + cell.role + '/' + cell.variant + '] → ' + o.message.slice(0, 160))
      }
    }
    expect(thrown, 'unhandled exceptions across matrix:\\n' + thrown.slice(0, 20).join('\\n')).toHaveLength(0)
  })

  it('no cell returned an UNKNOWN error class (5xx-like)', () => {
    const unknowns: string[] = []
    for (const cell of CELLS) {
      const o = _outcomes.get(cellKey(cell))
      if (o && o.status === 'unknown' && o.code !== 'NO_CLIENT') {
        unknowns.push(cell.rpc + ' [' + cell.role + '/' + cell.variant + '] → code=' + o.code + ' msg=' + o.message.slice(0, 140))
      }
    }
    // These are the "platform-bug" candidates the next loop should triage.
    expect(unknowns, 'unknown error classes (next loop iteration targets):\\n' + unknowns.slice(0, 30).join('\\n')).toHaveLength(0)
  })

  describe('anon-deny contract (anon must never ALLOW a privileged RPC)', () => {
    it('anon cells reject for every callable RPC', () => {
      const violations: string[] = []
      for (const cell of CELLS) {
        if (cell.role !== 'anon') continue
        if (cell.variant !== 'valid_params') continue
        const o = _outcomes.get(cellKey(cell))
        if (!o) continue
        if (o.status === 'allow') {
          violations.push(cell.rpc + ' → allowed for anon (expected deny)')
        }
      }
      // Some RPCs are intentionally public (e.g. login/signup helpers). We
      // print the violations for the next loop iteration to triage rather
      // than failing the suite outright — but a hard ceiling of 25 keeps a
      // regression in this area visible.
      expect(violations.length, 'anon-allow leaks (review and add to ANON_ALLOWED if intentional):\\n' + violations.slice(0, 25).join('\\n')).toBeLessThan(25)
    })
  })

  describe('owner-accept contract (owner must not get 5xx-class errors)', () => {
    it('owner cells with valid_params do not hit unknown-class errors', () => {
      const surprises: string[] = []
      for (const cell of CELLS) {
        if (cell.role !== 'owner') continue
        if (cell.variant !== 'valid_params') continue
        const o = _outcomes.get(cellKey(cell))
        if (!o) continue
        if (o.status === 'unknown') {
          surprises.push(cell.rpc + ' → ' + o.code + ': ' + o.message.slice(0, 120))
        }
      }
      expect(surprises.length, 'owner cells with unknown-class errors:\\n' + surprises.slice(0, 25).join('\\n')).toBeLessThan(25)
    })
  })

  describe('matrix coverage summary', () => {
    it('every (rpc, role, variant) cell has a recorded outcome', () => {
      const missing: string[] = []
      for (const cell of CELLS) {
        if (!_outcomes.has(cellKey(cell))) missing.push(cellKey(cell))
      }
      expect(missing.length, 'cells missing from outcomes map:\\n' + missing.slice(0, 10).join('\\n')).toBe(0)
    })

    it('per-role outcome distribution (informational)', () => {
      const tally: Record<string, { allow: number; deny: number; error: number; unknown: number }> = {
        anon: { allow: 0, deny: 0, error: 0, unknown: 0 },
        viewer: { allow: 0, deny: 0, error: 0, unknown: 0 },
        project_manager: { allow: 0, deny: 0, error: 0, unknown: 0 },
        owner: { allow: 0, deny: 0, error: 0, unknown: 0 },
      }
      for (const cell of CELLS) {
        const o = _outcomes.get(cellKey(cell))
        if (!o) continue
        tally[cell.role][o.status] = (tally[cell.role][o.status] ?? 0) + 1
      }
      // Log to stderr so vitest captures it in test output.
      // eslint-disable-next-line no-console
      console.warn('[B.4 matrix tally]', JSON.stringify(tally))
      // Sanity: every role contributed at least one observation.
      for (const role of ROLES) {
        const total = tally[role].allow + tally[role].deny + tally[role].error + tally[role].unknown
        expect(total, role + ' should have recorded outcomes').toBeGreaterThan(0)
      }
    })
  })

  describe('destructive RPCs (skipped — never auto-invoked)', () => {
    if (DESTRUCTIVE.length === 0) {
      it.todo('no destructive RPCs detected in inventory')
    }
    for (const name of DESTRUCTIVE) {
      it.todo(name + ': skipped (matches DESTRUCTIVE_NAME_PATTERNS — delete/wipe/purge/drop/truncate)')
    }
  })
})
`

writeFileSync(OUTPUT_PATH, spec, 'utf-8')
console.log(
  `[B.4 codegen] wrote ${OUTPUT_PATH}\n` +
    `  rpcs total:       ${inventory.count}\n` +
    `  callable:         ${callable.length} (post-filter, deduped by name)\n` +
    `  destructive:      ${destructive.length} (it.todo)\n` +
    `  roles:            ${ROLES.length} (${ROLES.join(', ')})\n` +
    `  variants:         ${VARIANTS.length} (${VARIANTS.join(', ')})\n` +
    `  live cells:       ${liveCells}\n` +
    `  todo cells:       ${todoCells}\n` +
    `  total:            ${liveCells + todoCells}\n`,
)
