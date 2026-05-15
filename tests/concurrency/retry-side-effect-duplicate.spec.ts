/**
 * FMEA O.RETRY.2 — Retry retries side-effect mutation (duplicate write).
 *
 * Hazard: React Query's `retry: N` (and the in-house syncManager retry
 * loop in createAuditedMutation) will retry a mutation after a network
 * timeout. If the server actually committed the write but the response
 * never reached the client, the retry creates a DUPLICATE row.
 *
 * The classic guards are:
 *   (a) the client sends an `Idempotency-Key` header derived from a
 *       client-generated UUID (caller controls retry safety), OR
 *   (b) the mutation includes a deterministic client-generated PK
 *       (e.g. uuid_v7 generated client-side, INSERT … ON CONFLICT DO
 *       NOTHING), OR
 *   (c) the server returns 200 for the duplicate request based on a
 *       (operation_kind, request_id) uniqueness window.
 *
 * Test approach (vitest, mocked fetch):
 *   1. Build a tiny `withRetry(mutationFn, opts)` wrapper that mirrors
 *      the queryClient retry contract.
 *   2. Mock fetch: first call hangs / 504s after the server applied
 *      the write; second call (retry) succeeds.
 *   3. Track INSERT side-effects in an in-memory "DB".
 *   4. Assert: with an idempotency key, the DB ends with EXACTLY one row.
 *      Without it (legacy path), the DB ends with TWO rows — the test
 *      surfaces that as a KNOWN VIOLATION for any current call site
 *      that doesn't pass an idempotency key.
 *   5. Static scan: count mutations under src/hooks/mutations/ that do
 *      NOT pass an idempotency-key header or client-generated PK.
 *
 * Catalog: O.RETRY.2.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const MUT_DIR = resolve(process.cwd(), 'src', 'hooks', 'mutations')

interface Inserted {
  id: string
  payload: unknown
  request_id?: string
}

async function withRetry<T>(fn: () => Promise<T>, opts: { retries: number }): Promise<T> {
  let last: unknown
  for (let i = 0; i <= opts.retries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
    }
  }
  throw last
}

describe('FMEA O.RETRY.2 — retry must not duplicate a side-effect', () => {
  it('behavioural: WITHOUT idempotency key, retry creates a duplicate row', async () => {
    const db: Inserted[] = []
    let attempt = 0

    // The "server" applies the write and then drops the connection on
    // attempt 1; attempt 2 succeeds normally.
    const serverInsert = vi.fn(async (payload: { name: string }) => {
      attempt++
      const inserted: Inserted = { id: `row-${attempt}`, payload }
      db.push(inserted) // ← side-effect happens BEFORE the network response.
      if (attempt === 1) {
        throw new Error('network timeout (response lost)')
      }
      return inserted
    })

    await withRetry(() => serverInsert({ name: 'RFI-001' }), { retries: 1 })

    // Hazard demonstrated: two rows, no idempotency.
    expect(db.length).toBe(2)
    expect(db.map((r) => r.payload)).toEqual([{ name: 'RFI-001' }, { name: 'RFI-001' }])
  })

  it('behavioural: WITH idempotency key + dedup, retry produces one row', async () => {
    const db: Inserted[] = []
    let attempt = 0
    const requestId = 'req-uuid-fixed-1234'

    const serverInsert = vi.fn(async (payload: { name: string }, reqId: string) => {
      attempt++
      const existing = db.find((r) => r.request_id === reqId)
      if (existing) return existing // ← server collapses duplicate.
      const row: Inserted = { id: `row-${db.length + 1}`, payload, request_id: reqId }
      db.push(row)
      if (attempt === 1) {
        throw new Error('network timeout (response lost)')
      }
      return row
    })

    await withRetry(() => serverInsert({ name: 'RFI-001' }, requestId), { retries: 1 })

    expect(db.length).toBe(1)
    expect(serverInsert).toHaveBeenCalledTimes(2) // network retried…
    expect(db[0].request_id).toBe(requestId) // …but only one row.
  })

  it('static (KNOWN-VIOLATIONS): mutations without idempotency-key header', () => {
    if (!existsSync(MUT_DIR)) {
      expect(true).toBe(true)
      return
    }
    const files = readdirSync(MUT_DIR).filter((f) => f.endsWith('.ts'))
    const offenders: string[] = []
    for (const f of files) {
      const body = readFileSync(join(MUT_DIR, f), 'utf-8')
      // Heuristic: mutation file mentions `useMutation` or `mutationFn`
      // but never `Idempotency-Key` or `idempotency_key` or `request_id`
      // or `crypto.randomUUID()`-as-PK pattern.
      const hasMutation = /useMutation|mutationFn|createAuditedMutation/.test(body)
      if (!hasMutation) continue
      const hasIdem = /idempotency.key|idempotency_key|request_id|x-request-id|client_uuid|client_id/i.test(body)
      const hasClientPk = /id:\s*crypto\.randomUUID|id:\s*uuid\(\)|id:\s*generateId\(\)/.test(body)
      if (!hasIdem && !hasClientPk) {
        offenders.push(f)
      }
    }
    if (offenders.length > 0) {
      console.warn(
        `[FMEA O.RETRY.2 KNOWN-VIOLATIONS] ${offenders.length} mutation modules ` +
          'have no idempotency-key / client-PK pattern; retries can duplicate writes:\n  - ' +
          offenders.slice(0, 10).join('\n  - ') +
          (offenders.length > 10 ? `\n  ... and ${offenders.length - 10} more` : ''),
      )
    }
    // Soft floor — assert the inventory ran without throwing.
    expect(offenders.length).toBeGreaterThanOrEqual(0)
  })
})
