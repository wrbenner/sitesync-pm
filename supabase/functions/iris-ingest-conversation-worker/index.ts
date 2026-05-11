// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-conversation-worker — Phase 3c scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='conversation'.
//   1. Read conversations row + its messages.
//   2. Scrub PII (signatures, phones, emails inside body) BEFORE chunking.
//   3. Tombstone-on-marked-personal: if thread flagged personal=true,
//      soft-delete its chunks instead of re-embedding.
//   4. chunkConversation(thread + scrubbed messages).
//   5. Embed each chunk; upsert.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface ConversationIngestPayload {
  source_id: string // = thread_id
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: ConversationIngestPayload
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
      message: 'Phase 3c scaffold — PII scrub + chunkConversation + embed lands on first soft-pilot thread',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
