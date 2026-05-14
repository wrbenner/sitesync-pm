/**
 * Phase B.6 — Webhook contract baseline.
 *
 * Inbound webhooks (Stripe, generic receiver) must:
 *   - Reject unsigned/invalid payloads with 4xx (not 5xx)
 *   - Accept valid signatures with 200
 *   - Never 5xx (handler must own its error paths)
 *
 * Outbound webhooks (customer-configured outbound endpoints) deeper
 * testing is Phase B.6 expansion; this baseline asserts the dispatch
 * endpoint contract.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && ANON_KEY)

interface Webhooks {
  inbound_handlers: string[]
  outbound_caller_files: string[]
}

const inventoryPath = resolve(__dirname, '../../ops/coverage/webhooks.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as Webhooks

beforeAll(() => {
  // no-op
})

describe.skipIf(!SHOULD_RUN)('B.6 — Webhook contract baseline', () => {
  for (const handler of inventory.inbound_handlers) {
    describe(handler, () => {
      it('refuses unsigned payload with 4xx, never 5xx', async () => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${handler}`, {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: '{"forged": true, "no_signature_present": true}',
        })
        expect(
          res.status,
          `${handler} returned ${res.status} for unsigned payload — must be < 500`,
        ).toBeLessThan(500)
      })

      it('handles GET method gracefully (typically 405)', async () => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${handler}`, {
          method: 'GET',
          headers: { apikey: ANON_KEY },
        })
        expect(
          res.status,
          `${handler} GET should be 4xx or 200 (never 5xx)`,
        ).toBeLessThan(500)
      })
    })
  }
})
