// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-submittal-worker — Phase 3d scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='submittal'.
//   1. Read submittals row + sub_items + review_notes.
//   2. Cross-reference the spec section the submittal satisfies (lets the
//      Code specialist resolve "what submittal satisfies spec 09 22 16?").
//   3. chunkSubmittal(input).
//   4. Embed each chunk; upsert.
//
// Sensitivity defaults to 'gc_only' for review notes; 'public_to_project'
// for header + sub_items. The chunker emits part='header'|'sub_item'|
// 'review_notes' in metadata; the worker maps part -> sensitivity at upsert.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface SubmittalIngestPayload {
  source_id: string // = submittal_id
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: SubmittalIngestPayload
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
      message: 'Phase 3d scaffold — submittal fetch + chunkSubmittal + sensitivity-tier mapping + embed lands on first soft-pilot submittal',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
