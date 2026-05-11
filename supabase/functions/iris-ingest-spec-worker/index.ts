// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-spec-worker — Phase 3b scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` queue messages where source_type='spec_section'.
//   1. Read the spec document row.
//   2. Compute version_hash; compare to iris_kb_sources.
//   3. Parse PDF / DOCX to text (TODO: integrate pdfjs in Deno).
//   4. Run detectCsiSections() to split by CSI heading; for each section
//      call chunkSpec() (the pure chunker).
//   5. Embed each chunk via OpenAI; upsert into iris_kb_chunks.
//
// Real implementation lands when the first spec PDF is uploaded to soft pilot.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface SpecIngestPayload {
  source_id: string
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: SpecIngestPayload
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
      message: 'Phase 3b scaffold — real spec parse + CSI detect + embed lands on first soft-pilot spec upload',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
