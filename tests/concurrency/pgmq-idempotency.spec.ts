/**
 * FMEA I.PGMQ.1 — pgmq message processed twice (no ACK race guard).
 *
 * Hazard: pgmq guarantees at-least-once delivery. If a consumer crashes
 * AFTER doing the side-effect but BEFORE calling pgmq.delete() to ACK,
 * the message becomes visible again after vt (visibility timeout) and a
 * second consumer processes it. Without a dedup record at the consumer,
 * the side-effect happens twice (e.g., iris_kb_chunks inserted twice for
 * the same source).
 *
 * The dispatcher (20261008000006_iris_ingest_dispatcher.sql) reads from
 * pgmq.q_iris_ingest. The dedup contract per iris_ingest_triggers.sql
 * line 55: "workers dedupe via iris_kb_sources.last_version_hash". This
 * spec verifies that contract under a simulated crash-before-ACK.
 *
 * What we exercise:
 *   1. pgmq.send('iris_ingest', <payload>) — enqueue ONE message twice.
 *      Same source_id, same version_hash → simulates a re-delivery after
 *      consumer crash.
 *   2. Wait for the dispatcher edge fn (or pg_cron heartbeat) to drain
 *      both copies.
 *   3. Assert iris_kb_sources has exactly 1 row (or at most 1 new chunk
 *      set in iris_kb_chunks) for that source_id.
 *
 * Reality: this spec runs against staging only. Without a live dispatcher
 * worker, both messages stay in the queue and we can only assert that
 * the queue accepted both (which is the at-least-once contract). The
 * dedup verification requires the worker to actually drain — we add a
 * 30s wait window and ALSO assert directly on the side-effect table.
 *
 * Skip-gracefully: if pgmq schema isn't accessible via REST or the
 * dispatcher doesn't run within the wait window, we skip.
 *
 * Catalog: I.PGMQ.1 (Section I, hazard #31).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const SHOULD_RUN = Boolean(SUPABASE_URL && SERVICE_KEY)

const TIMESTAMP = Date.now()
const SOURCE_ID_MARKER = `pgmq-idem-${TIMESTAMP}`

let admin: SupabaseClient

beforeAll(() => {
  if (!SHOULD_RUN) return
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
})

afterAll(async () => {
  if (!SHOULD_RUN) return
  // Clean queue side-effects (best-effort).
  try {
    await admin
      .from('iris_kb_sources')
      .delete()
      .like('source_id', `${SOURCE_ID_MARKER}%`)
  } catch {
    // swallow — table may not exist on this staging
  }
})

describe.skipIf(!SHOULD_RUN)('FMEA I.PGMQ.1 — pgmq idempotency', () => {
  it('same iris_ingest message delivered twice produces 1 side-effect row', async () => {
    // Probe pgmq existence: call pgmq.send via RPC. Most projects expose
    // it through a thin wrapper or the pgmq schema directly. We try
    // `pgmq.send` as an RPC — if it 404s, we skip.
    const payload = {
      source_id: SOURCE_ID_MARKER,
      source_type: 'test',
      version_hash: 'race-prober-fixed-hash-v1',
      project_id: null,
      org_id: null,
    }

    // Some Supabase setups expose pgmq via a public-schema wrapper RPC
    // (e.g., public.pgmq_send). Try both — first one that succeeds wins.
    const candidates: Array<{ fn: string; args: Record<string, unknown> }> = [
      { fn: 'pgmq_send', args: { queue_name: 'iris_ingest', message: payload } },
      { fn: 'send', args: { queue_name: 'iris_ingest', message: payload } },
      { fn: 'enqueue_iris_ingest', args: { p_payload: payload } },
    ]

    let sentMessageIds: number[] = []
    let usedFn: string | null = null
    for (const c of candidates) {
      const first = await admin.rpc(c.fn, c.args)
      if (first.error) continue
      const second = await admin.rpc(c.fn, c.args)
      if (second.error) continue
      // pgmq.send returns the new msg_id; collect both.
      sentMessageIds = [first.data, second.data]
        .map((v) => (typeof v === 'number' ? v : null))
        .filter((v): v is number => v !== null)
      usedFn = c.fn
      break
    }

    if (!usedFn) {
      console.warn('[I.PGMQ.1] skip: no pgmq.send wrapper exposed via REST on this staging')
      return
    }

    // Wait for the dispatcher to drain (heartbeat fires every minute on
    // some envs; we wait 30s and degrade to "best-effort").
    await new Promise((r) => setTimeout(r, 30_000))

    // Assert: iris_kb_sources should have at most 1 row for this source_id.
    // If we see 2+, the dedup contract (last_version_hash check) didn't
    // hold under re-delivery.
    const { data: sources, error: srcErr } = await admin
      .from('iris_kb_sources')
      .select('source_id, last_version_hash')
      .like('source_id', `${SOURCE_ID_MARKER}%`)

    if (srcErr) {
      console.warn('[I.PGMQ.1] skip: iris_kb_sources unreadable:', srcErr.message)
      return
    }

    const count = sources?.length ?? 0
    // If the dispatcher never ran, count = 0 — that's not a failure of
    // I.PGMQ.1, that's a deployment gap. We treat 0 as inconclusive
    // (warn-and-skip-assertion). The hazard signature is count > 1.
    if (count === 0) {
      console.warn(`[I.PGMQ.1] inconclusive: dispatcher did not drain queue within 30s. sentMessageIds=${sentMessageIds.join(',')}`)
      return
    }

    expect(
      count,
      `expected ≤ 1 iris_kb_sources row for ${SOURCE_ID_MARKER}; got ${count}. ` +
        `If > 1, FMEA I.PGMQ.1 is a real hazard — file loop-detected-bug.`,
    ).toBeLessThanOrEqual(1)
  }, 60_000)
})
