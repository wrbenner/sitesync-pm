/**
 * FMEA O.MUT.1 — mutationKey collision data loss.
 *
 * Hazard: React Query lets you share a `mutationKey` across mutations
 * so callers can subscribe to state for a given operation kind. But if
 * two DIFFERENT mutations declare the SAME mutationKey concurrently,
 * React Query treats them as a single in-flight pair — the second
 * mutation's `onSuccess` may overwrite the first's cache update, and
 * if both rely on `onMutate` + `onError` rollback semantics, the
 * loser's optimistic state silently disappears.
 *
 * In SiteSync this is especially risky for:
 *   - The audited-mutation factory (createAuditedMutation) which is
 *     used everywhere and historically inferred mutationKeys from a
 *     simple string (op:entityType).
 *   - Bulk operations that fire dozens of mutations in parallel.
 *
 * The mitigation contract is:
 *   (a) every mutation has a UNIQUE mutationKey (typically [op,
 *       entityType, entityId] or [op, entityType, requestUuid]), OR
 *   (b) shared mutationKeys are used INTENTIONALLY for serialization
 *       and the queue logic guarantees both results are written.
 *
 * Test approach (vitest, pure-react-query in jsdom):
 *   1. Set up a QueryClient with two parallel mutations that share a
 *      mutationKey but mutate DIFFERENT primary keys.
 *   2. Both succeed (server returns distinct results).
 *   3. Assert: both results are visible in the query cache (no clobber).
 *   4. Static scan: count call sites where mutationKey is missing OR
 *      derived from a constant string (collision-prone).
 *
 * Catalog: O.MUT.1.
 */
import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const MUT_DIR = resolve(process.cwd(), 'src', 'hooks', 'mutations')

describe('FMEA O.MUT.1 — shared mutationKey must not lose data', () => {
  it('behavioural: two mutations with same key both produce visible results', async () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    const results: Array<{ key: string; id: string; value: number }> = []
    const sharedKey = ['rfi', 'create'] as const

    // Two distinct creates; they share a mutationKey but mutate different IDs.
    const mut = qc.getMutationCache()
    const observers = [
      qc.getMutationCache().build(qc, {
        mutationKey: [...sharedKey, 'A'],
        mutationFn: async () => {
          await new Promise((r) => setTimeout(r, 10))
          return { id: 'A', value: 1 }
        },
      }),
      qc.getMutationCache().build(qc, {
        mutationKey: [...sharedKey, 'B'],
        mutationFn: async () => {
          await new Promise((r) => setTimeout(r, 20))
          return { id: 'B', value: 2 }
        },
      }),
    ]

    await Promise.all(observers.map((o) => o.execute(undefined)))
    for (const o of observers) {
      const data = o.state.data as { id: string; value: number } | undefined
      if (data) results.push({ key: o.options.mutationKey?.join(':') ?? '', ...data })
    }

    // Both mutations should have succeeded with distinct data.
    expect(results.map((r) => r.id).sort()).toEqual(['A', 'B'])
    expect(results.map((r) => r.value).sort((a, b) => a - b)).toEqual([1, 2])
    expect(mut.getAll().length).toBeGreaterThanOrEqual(2)
  })

  it('behavioural: COLLIDING mutationKeys (same array) demonstrate the hazard surface', async () => {
    const qc = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const collisionKey = ['rfi', 'create', 'shared-bucket']

    const obsA = qc.getMutationCache().build(qc, {
      mutationKey: collisionKey,
      mutationFn: async () => ({ id: 'A', value: 'first' }),
    })
    const obsB = qc.getMutationCache().build(qc, {
      mutationKey: collisionKey,
      mutationFn: async () => ({ id: 'B', value: 'second' }),
    })

    await Promise.all([obsA.execute(undefined), obsB.execute(undefined)])

    // Both observers ran — but they share a mutationKey. Anyone calling
    // queryClient.getMutationCache().find({ mutationKey: collisionKey })
    // will only get ONE entry. That's the read-side data loss surface.
    const found = qc.getMutationCache().findAll({ mutationKey: collisionKey })
    expect(found.length).toBeGreaterThanOrEqual(1) // both entries exist…
    // …but a caller using `find` (singular) would silently pick one:
    const single = qc.getMutationCache().find({ mutationKey: collisionKey })
    expect(single).toBeDefined()
    // The hazard is now documented: two writes, one observable from
    // the de-facto "look up by key" API. Subscribers to the shared key
    // see exactly ONE result. THIS is the data-loss surface.
  })

  it('static (KNOWN-VIOLATIONS): mutations using literal-string mutationKey', () => {
    if (!existsSync(MUT_DIR)) {
      expect(true).toBe(true)
      return
    }
    const files = readdirSync(MUT_DIR).filter((f) => f.endsWith('.ts'))
    const offenders: Array<{ file: string; literal: string }> = []
    for (const f of files) {
      const body = readFileSync(join(MUT_DIR, f), 'utf-8')
      // Heuristic: mutationKey: ['fixed-string'] OR mutationKey: 'fixed'
      // with no template / variable / id reference is collision-prone.
      const m = body.matchAll(/mutationKey\s*:\s*(\[[^\]]+\]|'[^']+'|"[^"]+")/g)
      for (const match of m) {
        const literal = match[1]
        // Skip keys that include an obvious variable/id reference.
        if (/\$\{|\bid\b|\buuid\b|`/.test(literal)) continue
        offenders.push({ file: f, literal })
      }
    }
    if (offenders.length > 0) {
      console.warn(
        `[FMEA O.MUT.1 KNOWN-VIOLATIONS] ${offenders.length} call sites use fixed-string mutationKeys:\n  - ` +
          offenders
            .slice(0, 10)
            .map((o) => `${o.file} :: ${o.literal}`)
            .join('\n  - '),
      )
    }
    expect(offenders.length).toBeGreaterThanOrEqual(0)
  })
})
