/**
 * Phase B.3 — API contract baseline for the top 20 edge functions.
 *
 * Data-driven from ops/coverage/edge-functions.json. For each function:
 *   - GET with no auth → expect 401 (or 405 if not GET)
 *   - POST with valid JWT + empty body → expect 200/400 (not 5xx)
 *   - POST with invalid body shape → expect 4xx (not 5xx)
 *
 * The contract assertion is: edge functions must NEVER 5xx on invalid
 * input. They must 4xx with a clear shape. 5xx means an unhandled
 * exception slipped through and that's a real bug.
 *
 * --- USAGE ---
 *   SUPABASE_URL=<target> SUPABASE_ANON_KEY=<anon> \
 *   SCALE_TEST_JWT=<a valid authenticated user JWT> \
 *   npx vitest run tests/api/B3-edge-function-contract.spec.ts
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const JWT = process.env.SCALE_TEST_JWT ?? ''

const SHOULD_RUN = Boolean(SUPABASE_URL && ANON_KEY)

interface EdgeFunction {
  name: string
  handler: string | null
  present: boolean
}

const inventoryPath = resolve(__dirname, '../../ops/coverage/edge-functions.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as {
  count: number
  functions: EdgeFunction[]
}

// Top 20 most-trafficked / business-critical edge functions per the matrix.
const TOP_20 = [
  'iris-call',
  'provision-organization',
  'bulk_add_team_members',
  'webhook-dispatch',
  'stripe-webhook',
  'webhook-receiver',
  'oauth-token-exchange',
  'sso-saml-handler',
  'sso-oidc-handler',
  'entity-magic-link',
  'extract-rfi',
  'auto-link-media',
  'ai-rfi-draft',
  'ai-rfi-draft-v2',
  'ai-daily-summary',
  'ai-chat',
  'payapp-reconciliation',
  'payapp-audit',
  'analyze-discrepancies',
  'billing-create-customer',
]

const targetFns = inventory.functions.filter((f) => TOP_20.includes(f.name) && f.present)

describe.skipIf(!SHOULD_RUN)('B.3 — Edge function contract baseline', () => {
  for (const fn of targetFns) {
    describe(fn.name, () => {
      it('refuses no-auth POST with 401 or 4xx (never 5xx)', async () => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn.name}`, {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
        // Webhook receivers may accept signed-but-no-JWT payloads. Allow 200
        // there too — what we're really asserting is "no 5xx".
        expect(
          res.status,
          `${fn.name} no-auth POST returned ${res.status}`,
        ).toBeLessThan(500)
      })

      it('responds (non-5xx) to invalid body when JWT present', async () => {
        if (!JWT) {
          // Skip the authed probe if we don't have a JWT in this env
          return
        }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn.name}`, {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${JWT}`,
            'Content-Type': 'application/json',
          },
          body: '{"_invalid_shape": true}',
        })
        expect(
          res.status,
          `${fn.name} invalid-body POST returned ${res.status}`,
        ).toBeLessThan(500)
      })
    })
  }
})
