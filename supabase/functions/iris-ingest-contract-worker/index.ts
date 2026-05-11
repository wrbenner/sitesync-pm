// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-contract-worker — Phase 3d scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='contract'.
//   1. Read contracts row + raw PDF body.
//   2. PDF parser walks the section tree to produce clause-level input.
//      Supports AIA A201/A101/GMP via heading-pattern templates; custom
//      contracts fall back to numbered-heading detection.
//   3. chunkContract(input) — one chunk per clause; long clauses split.
//   4. Sensitivity = 'finance_only' for pricing/payment articles (8, 9, 14
//      in AIA A201); 'owner_only' for the owner-acceptance article;
//      'gc_only' default for the rest.
//   5. Embed each chunk; upsert.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface ContractIngestPayload {
  source_id: string // = contract_id
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: ContractIngestPayload
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
      message: 'Phase 3d scaffold — clause-tree PDF parse + chunkContract + per-article sensitivity tier + embed lands on first soft-pilot contract',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
