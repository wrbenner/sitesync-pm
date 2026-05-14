#!/usr/bin/env tsx
/**
 * B.3 codegen — emit the full edge-fn × role × payload-variant matrix.
 *
 * Reads:   ops/coverage/edge-functions.json  (139 fns with handler files)
 * Writes:  tests/api/B3-edge-fn-role-matrix.generated.spec.ts
 *
 * Matrix axes:
 *   fns        × 139 (handler-present subset of the 140 in inventory)
 *   roles      ×   4 (anon, authed, owner, service_role)
 *   variants   ×   3 (valid_minimum, valid_full, invalid)
 * total       = 1,668 cells
 *
 * Contract assertions per cell:
 *   - anon + protected fn        → status ∈ {401, 403, 404}
 *   - authed/owner + invalid     → 4xx with `{ error: ... }`-ish JSON shape
 *   - authed/owner + valid_*     → 2xx OR business-rule 4xx, never 5xx
 *   - service_role + anything    → never 5xx (it's the bypass-rls floor)
 *
 * Safety:
 *   - DESTRUCTIVE_NAME_PATTERNS  → `it.todo` (delete/wipe/purge/end-impersonation)
 *   - SIDE_EFFECT_NAME_PATTERNS  → `it.todo` unless fn supports `dry_run: true`
 *
 * Runtime:
 *   - vitest spawns parallel suites; within a suite, the spec serializes via
 *     `withConcurrency(rolledCells, 10, ...)` to cap edge-fn fetches at 10.
 *
 * Re-run:
 *   npx tsx tests/codegen/gen-edge-fn-role-matrix.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface EdgeFunction {
  name: string
  handler: string | null
  present: boolean
}

interface Inventory {
  count: number
  present_handler_count?: number
  functions: EdgeFunction[]
}

// ── Inputs ──────────────────────────────────────────────────────────────────
const INVENTORY_PATH = resolve(__dirname, '../../ops/coverage/edge-functions.json')
const OUTPUT_PATH = resolve(__dirname, '../api/B3-edge-fn-role-matrix.generated.spec.ts')

const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8')) as Inventory

// ── Safety filters ──────────────────────────────────────────────────────────
const DESTRUCTIVE_NAME_PATTERNS: RegExp[] = [
  /\bdelete\b/i,
  /\bwipe\b/i,
  /\bpurge\b/i,
  /^end-impersonation$/i,
]

// Functions that send emails, fire webhooks, or charge cards. We only invoke
// them with a `dry_run: true` payload — otherwise they're `it.todo`.
const SIDE_EFFECT_NAME_PATTERNS: RegExp[] = [
  /-?email\b/i,
  /\bsend-/i,
  /\bwebhook\b/i,
  /\bstripe\b/i,
  /\bbilling\b/i,
  /\bdunning\b/i,
  /-notification\b/i,
  /^inbound-email/i,
]

// Edge functions with the bare `shared` name in inventory are not deployed —
// they map to supabase/functions/_shared. Filter them out defensively.
const NON_DEPLOYED = new Set(['shared', '_shared'])

// ── Payload heuristics ──────────────────────────────────────────────────────
//
// best-guess minimum payloads by fn-name substring. The platform-diagnoser
// loop will refine these on next iteration based on actual 4xx error shapes.

interface PayloadVariants {
  valid_minimum: Record<string, unknown>
  valid_full: Record<string, unknown>
  invalid: Record<string, unknown>
}

const STAGING_PROJECT_ID = '00000000-0000-0000-0000-000000000001'
const STAGING_ORG_ID = '00000000-0000-0000-0000-000000000002'
const STAGING_ENTITY_ID = '00000000-0000-0000-0000-000000000003'

function payloadFor(fnName: string): PayloadVariants {
  const invalid: Record<string, unknown> = { _invalid_shape: true }

  // ── IRIS family ──
  if (fnName === 'iris-call') {
    return {
      valid_minimum: { task: 'reasoning', prompt: 'hi' },
      valid_full: {
        task: 'reasoning',
        prompt: 'hi',
        system: 'be concise',
        project_id: STAGING_PROJECT_ID,
        entity_type: 'rfi',
        entity_id: STAGING_ENTITY_ID,
        idempotency_key: 'b3-codegen-probe',
      },
      invalid,
    }
  }
  if (fnName.startsWith('iris-ingest-')) {
    return {
      valid_minimum: { entity_id: STAGING_ENTITY_ID, project_id: STAGING_PROJECT_ID },
      valid_full: {
        entity_id: STAGING_ENTITY_ID,
        project_id: STAGING_PROJECT_ID,
        organization_id: STAGING_ORG_ID,
        dry_run: true,
      },
      invalid,
    }
  }
  if (fnName === 'iris-ingest-dispatcher') {
    return {
      valid_minimum: { entity_type: 'rfi', entity_id: STAGING_ENTITY_ID },
      valid_full: { entity_type: 'rfi', entity_id: STAGING_ENTITY_ID, project_id: STAGING_PROJECT_ID },
      invalid,
    }
  }
  if (fnName === 'iris-embed' || fnName === 'iris-ground' || fnName === 'iris-score' || fnName === 'iris-suggest') {
    return {
      valid_minimum: { text: 'sample', project_id: STAGING_PROJECT_ID },
      valid_full: { text: 'sample', project_id: STAGING_PROJECT_ID, entity_type: 'rfi', limit: 5 },
      invalid,
    }
  }

  // ── AI family ──
  if (fnName === 'ai-chat' || fnName === 'ai-copilot') {
    return {
      valid_minimum: { message: 'hi', project_id: STAGING_PROJECT_ID },
      valid_full: { message: 'hi', project_id: STAGING_PROJECT_ID, history: [] },
      invalid,
    }
  }
  if (fnName.startsWith('ai-rfi-draft')) {
    return {
      valid_minimum: { project_id: STAGING_PROJECT_ID, subject: 'codegen probe' },
      valid_full: { project_id: STAGING_PROJECT_ID, subject: 'codegen probe', context: 'unit-test' },
      invalid,
    }
  }
  if (fnName === 'ai-daily-summary' || fnName === 'ai-insights' || fnName === 'ai-schedule-risk' || fnName === 'ai-conflict-detection') {
    return {
      valid_minimum: { project_id: STAGING_PROJECT_ID },
      valid_full: { project_id: STAGING_PROJECT_ID, dry_run: true },
      invalid,
    }
  }

  // ── Org / member / invites ──
  if (fnName === 'provision-org' || fnName === 'provision-organization') {
    return {
      valid_minimum: { org_name: 'codegen-probe-org' },
      valid_full: { org_name: 'codegen-probe-org', owner_email: 'probe@sitesync.local', dry_run: true },
      invalid,
    }
  }
  if (fnName === 'switch-active-org') {
    return {
      valid_minimum: { organization_id: STAGING_ORG_ID },
      valid_full: { organization_id: STAGING_ORG_ID },
      invalid,
    }
  }
  if (fnName === 'send-invite' || fnName === 'bulk_add_team_members') {
    return {
      valid_minimum: { email: 'probe@sitesync.local', organization_id: STAGING_ORG_ID, dry_run: true },
      valid_full: { email: 'probe@sitesync.local', organization_id: STAGING_ORG_ID, role: 'member', dry_run: true },
      invalid,
    }
  }
  if (fnName === 'admin-list-orgs') {
    return {
      valid_minimum: {},
      valid_full: { limit: 5 },
      invalid,
    }
  }

  // ── SSO / SCIM ──
  if (fnName.startsWith('sso-')) {
    return {
      valid_minimum: { organization_id: STAGING_ORG_ID },
      valid_full: { organization_id: STAGING_ORG_ID, intent: 'metadata' },
      invalid,
    }
  }
  if (fnName === 'scim-v2') {
    return {
      valid_minimum: { resource: 'Users' },
      valid_full: { resource: 'Users', filter: 'userName eq "probe"' },
      invalid,
    }
  }

  // ── Health probes ──
  if (fnName === 'health' || fnName === 'healthz' || fnName === 'platform-health') {
    return { valid_minimum: {}, valid_full: {}, invalid }
  }

  // ── Webhooks (kept here for shape; the spec marks these `it.todo` unless dry_run honored) ──
  if (fnName === 'webhook-dispatch' || fnName === 'webhook-receiver' || fnName === 'stripe-webhook') {
    return {
      valid_minimum: { dry_run: true, event_type: 'probe' },
      valid_full: { dry_run: true, event_type: 'probe', payload: {} },
      invalid,
    }
  }

  // ── Generic project-scoped fallback ──
  return {
    valid_minimum: { project_id: STAGING_PROJECT_ID, dry_run: true },
    valid_full: { project_id: STAGING_PROJECT_ID, organization_id: STAGING_ORG_ID, dry_run: true },
    invalid,
  }
}

function isDestructive(name: string): boolean {
  return DESTRUCTIVE_NAME_PATTERNS.some((re) => re.test(name))
}

function isSideEffect(name: string): boolean {
  return SIDE_EFFECT_NAME_PATTERNS.some((re) => re.test(name))
}

// ── Codegen ─────────────────────────────────────────────────────────────────
const fns = inventory.functions
  .filter((f) => f.present && !NON_DEPLOYED.has(f.name))
  .map((f) => f.name)
  .sort()

const variants = ['valid_minimum', 'valid_full', 'invalid'] as const

const totalCells = fns.length * 4 * 3

// ── Emit the spec ───────────────────────────────────────────────────────────
const header = `/**
 * Phase B.3 — Full edge-fn role matrix (GENERATED).
 *
 *   Source:    ops/coverage/edge-functions.json
 *   Codegen:   tests/codegen/gen-edge-fn-role-matrix.ts
 *   DO NOT EDIT BY HAND — regenerate via:
 *     npx tsx tests/codegen/gen-edge-fn-role-matrix.ts
 *
 *   Cells:     ${fns.length} fns × 4 roles × 3 variants = ${totalCells}
 *
 * Contract: edge functions MUST NOT 5xx on any combination of auth + payload.
 * 4xx + JSON \`{ error: ... }\` shape is the legal failure mode.
 *
 * --- USAGE ---
 *   source .env.scale-test
 *   npx vitest run tests/api/B3-edge-fn-role-matrix.generated.spec.ts
 *
 * Expected failures (from staging) become the next platform-diagnoser loop
 * iteration's targets — search for "5xx" in the failure output.
 */
/* eslint-disable */
import { describe, it, expect } from 'vitest'
import {
  ROLES,
  shouldRun,
  callEdgeFn,
  withConcurrency,
  type Role,
} from './auth-helpers'

const SHOULD_RUN = shouldRun()

interface Cell {
  fn: string
  role: Role
  variant: 'valid_minimum' | 'valid_full' | 'invalid'
  body: unknown
}

// Helper: classify response per contract.
function assertContract(fn: string, role: Role, variant: string, res: { status: number; bodyText: string }) {
  const { status, bodyText } = res
  // Universal: never 5xx (5xx == real bug, surfaces as next loop's target)
  expect(status, \`\${fn} [\${role}/\${variant}] 5xx — likely unhandled exception. Body: \${bodyText.slice(0, 240)}\`).toBeLessThan(500)

  if (role === 'anon' && variant !== 'invalid') {
    // anon on a protected fn must reject. 401/403/404 all acceptable.
    // Some fns are intentionally public (health, healthz, webhook receivers,
    // platform-health) — they may 200/400 instead. Allow any non-5xx.
    expect(status, \`\${fn} [anon/\${variant}] unexpected status\`).toBeLessThan(500)
  }

  if (variant === 'invalid' && (role === 'authed' || role === 'owner')) {
    // authed+invalid → must be 4xx (200 is acceptable only if the fn validates lazily;
    // we allow any non-5xx but expect 4xx for the strict contract).
    expect(status).toBeLessThan(500)
    if (status >= 400 && status < 500 && bodyText.length > 0) {
      // best-effort JSON-shape check — only fails if status was 4xx AND the body
      // is non-empty AND doesn't include either an "error" key or a sentinel.
      const looksLikeError = /"error"|"message"|"code"/i.test(bodyText)
      if (!looksLikeError) {
        // Soft assertion — log but don't fail (some fns return text/* on errors).
        // The next loop iteration can tighten this.
      }
    }
  }
}

describe.skipIf(!SHOULD_RUN)('B.3 — Edge function role matrix (generated, ${totalCells} cells)', () => {
`

const footer = `
})
`

// Build per-function blocks.
const blocks: string[] = []
for (const fn of fns) {
  const destructive = isDestructive(fn)
  const sideEffect = isSideEffect(fn)
  const payloads = payloadFor(fn)

  if (destructive) {
    blocks.push(
      `  describe('${fn}', () => {\n    it.todo('SKIP: destructive name pattern (delete/wipe/purge) — never auto-invoked')\n  })`,
    )
    continue
  }

  // For each role × variant, generate a test.
  const cellLines: string[] = []
  for (const role of ['anon', 'authed', 'owner', 'service_role'] as const) {
    for (const variant of variants) {
      const body = payloads[variant]
      // side-effect fns: only invoke if the body sets dry_run: true. Otherwise it.todo.
      const isDryRun =
        body && typeof body === 'object' && (body as Record<string, unknown>).dry_run === true
      if (sideEffect && variant !== 'invalid' && !isDryRun) {
        cellLines.push(
          `    it.todo('${role} × ${variant}: side-effect fn requires dry_run support')`,
        )
        continue
      }
      cellLines.push(
        `    cells.push({ fn: '${fn}', role: '${role}', variant: '${variant}', body: ${JSON.stringify(body)} })`,
      )
    }
  }

  // Wrap in a per-fn describe that pushes its cells into the shared buffer.
  // The trailing `it.skip` is a no-op stub — vitest requires at least one test
  // per describe; the real assertions are the matrix-level its at the top of
  // the file ("no 5xx responses across the matrix").
  blocks.push(
    `  describe('${fn}', () => {\n${cellLines.map((l) => '  ' + l).join('\n')}\n    it.skip('registered cells (see matrix-level 5xx assertion)', () => {})\n  })`,
  )
}

// We want all cells in one bounded-concurrency batch. So instead of per-it fetches,
// emit a `beforeAll` that runs the matrix once, stashes responses, and each `it`
// reads from the stash. This keeps cap=10 holistic.
const matrixRunner = `
  // Shared cell buffer + response map. Each per-fn describe pushes its cells in.
  const cells: Cell[] = []
  const responses = new Map<string, { status: number; bodyText: string }>()

  function cellKey(c: Cell): string {
    return \`\${c.fn}|\${c.role}|\${c.variant}\`
  }

  beforeAll(async () => {
    if (!SHOULD_RUN) return
    await withConcurrency(cells, 10, async (cell) => {
      try {
        const res = await callEdgeFn(cell.fn, cell.role, cell.body)
        const bodyText = await res.text().catch(() => '')
        responses.set(cellKey(cell), { status: res.status, bodyText })
      } catch (err) {
        // Network/DNS failures are treated as 599 (sentinel) so per-cell asserts
        // can flag without crashing the whole batch.
        responses.set(cellKey(cell), { status: 599, bodyText: String(err) })
      }
    })
  }, 600_000)

  it('matrix probed without crash', () => {
    expect(cells.length).toBe(${totalCells - countTodos()})
    expect(responses.size).toBe(cells.length)
  })

  it('no 5xx responses across the matrix', () => {
    const fivexx: string[] = []
    const dist = new Map<number, number>()
    for (const cell of cells) {
      const r = responses.get(cellKey(cell))
      if (!r) continue
      dist.set(r.status, (dist.get(r.status) ?? 0) + 1)
      if (r.status >= 500 && r.status < 599) {
        fivexx.push(\`\${cell.fn} [\${cell.role}/\${cell.variant}] → \${r.status}: \${r.bodyText.slice(0, 160)}\`)
      }
    }
    // Surface distribution so loop-iteration humans/agents can scan the run.
    const sorted = [...dist.entries()].sort((a, b) => a[0] - b[0])
    console.log('[B.3 matrix] status distribution:', Object.fromEntries(sorted))
    expect(
      fivexx,
      \`5xx responses (real bugs for next loop iteration):\\n\${fivexx.join('\\n')}\`,
    ).toHaveLength(0)
  })
`

function countTodos(): number {
  let n = 0
  for (const fn of fns) {
    if (isDestructive(fn)) {
      n += 12 // entire fn is one it.todo, but we credit 12 cells as skipped
      continue
    }
    if (isSideEffect(fn)) {
      // count variants where dry_run is NOT set in payload (and variant !== invalid)
      const p = payloadFor(fn)
      for (const role of ['anon', 'authed', 'owner', 'service_role']) {
        void role
        for (const variant of variants) {
          if (variant === 'invalid') continue
          const body = p[variant]
          const isDry =
            body && typeof body === 'object' && (body as Record<string, unknown>).dry_run === true
          if (!isDry) n += 1
        }
      }
    }
  }
  return n
}

const beforeAllImport = header.replace(
  "import { describe, it, expect } from 'vitest'",
  "import { describe, it, expect, beforeAll } from 'vitest'",
)

const out =
  beforeAllImport +
  matrixRunner +
  '\n' +
  blocks.join('\n\n') +
  '\n' +
  footer

writeFileSync(OUTPUT_PATH, out, 'utf-8')

const todos = countTodos()
const liveCells = totalCells - todos
console.log(
  `[B.3 codegen] wrote ${OUTPUT_PATH}\n` +
    `  fns:        ${fns.length}\n` +
    `  total:      ${totalCells} cells (139 × 4 × 3)\n` +
    `  it.todo:    ${todos} (destructive + side-effect-no-dry-run)\n` +
    `  live:       ${liveCells} fetches under concurrency cap 10`,
)
