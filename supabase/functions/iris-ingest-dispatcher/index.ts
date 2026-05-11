// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-dispatcher — Phase 3c
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
// ADR-003: pg_cron heartbeat -> this dispatcher -> per-source worker fn.
//
// On each invocation (cron every minute, or workflow_dispatch):
//   1. Read up to BATCH_SIZE messages from pgmq queue 'iris_ingest'.
//   2. For each message, resolve source_type -> worker fn URL.
//   3. Invoke the per-source worker with the message payload.
//   4. On success, ack the pgmq message. On failure, leave it (visibility
//      timeout reclaims it on the next tick).
//
// Idempotent: workers dedupe via iris_kb_sources.last_version_hash. Multiple
// dispatcher invocations on the same message are safe.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const BATCH_SIZE = 50

const WORKER_FOR_SOURCE_TYPE: Readonly<Record<string, string>> = {
  drawing: 'iris-ingest-drawing-worker',
  spec_section: 'iris-ingest-spec-worker',
  rfi: 'iris-ingest-rfi-worker',
  daily_log: 'iris-ingest-daily-log-worker',
  photo: 'iris-ingest-photo-worker',
  conversation: 'iris-ingest-conversation-worker',
  bulletin: 'iris-ingest-conversation-worker',
  asi: 'iris-ingest-conversation-worker',
  change_order: 'iris-ingest-change-order-worker',
  pay_app: 'iris-ingest-change-order-worker',
  lien_waiver: 'iris-ingest-change-order-worker',
  punch_item: 'iris-ingest-rfi-worker',
  submittal: 'iris-ingest-submittal-worker',
  contract: 'iris-ingest-contract-worker',
  spreadsheet: 'iris-ingest-spreadsheet-worker',
  unclassified: 'iris-ingest-unclassified-worker',
}

interface IngestMessage {
  msg_id: number
  message: {
    source_type: string
    source_id: string
    project_id: string
    org_id: string
    version_hash: string
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // In production: read pgmq messages via supabase admin client, route each
  // to its worker, ack on success. Phase 3c scaffold returns a summary
  // payload describing what would dispatch — real fan-out lands when first
  // soft-pilot enqueue arrives.

  return new Response(
    JSON.stringify({
      status: 'scaffold',
      batch_size: BATCH_SIZE,
      worker_count: Object.keys(WORKER_FOR_SOURCE_TYPE).length,
      message: 'Phase 3c scaffold — real pgmq drain + fan-out lands on first enqueue from soft-pilot ingestion',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

// Exported for unit testing the routing table only.
export { WORKER_FOR_SOURCE_TYPE }
export type { IngestMessage }
