// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-daily-log-worker — Phase 3c scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='daily_log'.
//   1. Read daily_logs row + its 5 section blobs.
//   2. Compute version_hash from concatenated section text + log_date + status.
//   3. Call chunkDailyLog() — emits up to 5 chunks (one per section).
//   4. Embed each via OpenAI; upsert into iris_kb_chunks.
//
// Real embed + upsert lands alongside Phase 3c's full retrieve() impl. The
// chunker is pure-function complete; this scaffold validates payload shape
// and returns a deferred-acknowledge response.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface DailyLogIngestPayload {
  source_id: string
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: DailyLogIngestPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!payload.source_id || !payload.project_id) {
    return new Response(JSON.stringify({ error: 'missing_required_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      status: 'scaffold',
      source_id: payload.source_id,
      message: 'Phase 3c scaffold — real daily-log fetch + chunkDailyLog + embed lands on first soft-pilot artifact',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
