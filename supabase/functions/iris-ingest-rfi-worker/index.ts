// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-rfi-worker — Phase 3b scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` queue messages where source_type='rfi'.
//   1. Read the rfis row + responses (rfi_responses table).
//   2. Compute version_hash from RFI body + concatenated response timestamps.
//   3. Call chunkRfi() — emits body chunk + one per response.
//   4. Embed each chunk via OpenAI; upsert into iris_kb_chunks.
//
// RFI ingest doesn't need PDF parsing — the content is already structured.
// This worker is the simplest of the three. Real OpenAI embed call lands
// alongside Phase 3c's full retrieve() implementation.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface RfiIngestPayload {
  source_id: string // = rfi_id
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: RfiIngestPayload
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
      message: 'Phase 3b scaffold — real RFI fetch + chunkRfi + embed lands alongside Phase 3c retrieve() impl',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
