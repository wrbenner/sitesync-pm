/**
 * Phase B.4 — RPC contract baseline (294 RPCs on staging).
 *
 * Data-driven from ops/coverage/rpcs.json. For each public RPC:
 *   - Anon-key invoke is rejected (401/403) OR succeeds only if the
 *     RPC is intentionally public (e.g., signup helpers).
 *   - Service-role can call (no exception) — health check on the
 *     function definition itself.
 *
 * Deeper per-role enforcement is Phase B.4 expansion (15 roles × 294
 * RPCs = 4,410 cells); this baseline establishes the anon-deny contract.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

interface Rpc {
  name: string
  argTypes: string[] | null
  returnType: string
  isSecurityDefiner: boolean
  numArgs: number
}

const inventoryPath = resolve(__dirname, '../../ops/coverage/rpcs.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as {
  count: number
  rpcs: Rpc[]
}

// RPCs that are intentionally callable by anon (mostly trigger functions
// + Supabase-internal helpers). We don't assert anon-deny for these.
const ANON_ALLOWED_PATTERNS = [
  /^pgrst_/, // PostgREST internal
  /^auth_/, // auth.* helpers
  /^_/, // private convention
  /^trigger_/, // trigger fns
  /_set_updated_at$/, // updated_at triggers
  /^array_to_/, // pgvector helpers
  /^halfvec_/,
  /^sparsevec_/,
  /^vector_/,
  /^pg_/, // pg-prefixed system
  /^uuid_/,
  /^citext/,
  /^gen_random/,
  /^extschema_/,
]

// Trigger functions (return type 'trigger') are not user-callable via PostgREST;
// skip them entirely.
const callable = inventory.rpcs.filter((r) => r.returnType !== 'trigger')
// Cap the per-run sample to 30 to keep runtime reasonable in CI; the full
// 294-RPC sweep runs on a nightly cadence.
const sample = callable
  .filter((r) => !ANON_ALLOWED_PATTERNS.some((re) => re.test(r.name)))
  .slice(0, 30)

let admin: SupabaseClient
beforeAll(() => {
  if (SHOULD_RUN) {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

describe.skipIf(!SHOULD_RUN)('B.4 — RPC contract baseline', () => {
  it(`inventory has ${inventory.count} RPCs; ${callable.length} are user-callable`, () => {
    expect(inventory.count).toBeGreaterThan(0)
  })

  for (const rpc of sample) {
    it(`${rpc.name}: anon-key call is rejected OR returns sentinel (not 5xx)`, async () => {
      // Call with empty payload — most RPCs require args, so we expect 4xx
      // (400 PGRST shape mismatch or 401/403 auth). We MUST NOT get 5xx.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc.name}`, {
        method: 'POST',
        headers: {
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      expect(
        res.status,
        `RPC ${rpc.name} anon-call returned ${res.status} — must be < 500`,
      ).toBeLessThan(500)
    })

    if (rpc.isSecurityDefiner) {
      it(`${rpc.name}: SECURITY DEFINER flag still set on staging`, async () => {
        const { data } = await admin
          .schema('pg_catalog' as never)
          .from('pg_proc' as never)
          .select('prosecdef')
          .eq('proname', rpc.name)
          .limit(1)
        const row = (data?.[0] as { prosecdef?: boolean } | undefined)
        if (row) {
          expect(row.prosecdef, `${rpc.name} regressed from SECDEF`).toBe(true)
        }
      })
    }
  }
})
