// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-change-order-worker — Phase 3c scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='change_order' (also
// receives pay_app + lien_waiver per WORKER_NAMES routing).
//   1. Read change_orders row + line items + approval narrative.
//   2. Cross-reference co_pricing rows for Money specialist provenance.
//   3. chunkChangeOrder() — emits header + line-item batches + approval.
//   4. Sensitivity tier is 'finance_only' for the line items, 'gc_only' for
//      the narrative; the chunker tags each chunk with the right tier.
//   5. Embed each chunk; upsert.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface CoIngestPayload {
  source_id: string // = co_id (or pay_app_id, lien_waiver_id)
  project_id: string
  org_id: string
  version_hash: string
  source_type?: 'change_order' | 'pay_app' | 'lien_waiver'
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: CoIngestPayload
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
      source_type: payload.source_type ?? 'change_order',
      message: 'Phase 3c scaffold — chunkChangeOrder + sensitivity-tier tagging + embed lands on first soft-pilot CO',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
