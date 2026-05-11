// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-drawing-worker — Phase 3b scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` queue messages where source_type='drawing'. For each:
//   1. Read the source artifact row (documents table).
//   2. Compute version_hash from content; compare to iris_kb_sources.
//      Skip if unchanged. Tombstone old chunks if changed.
//   3. Extract text per sheet via PDF parser (TODO: integrate pdfjs-dist
//      or pdf-parse in Deno). Tesseract OCR fallback for scanned drawings
//      (TODO: integrate when first scanned drawing arrives).
//   4. Call chunkDrawing() — the pure chunker from
//      src/services/iris/ingestion/chunkers/drawing.ts (mirrored here for
//      Deno; same logic).
//   5. Embed each chunk via OpenAI text-embedding-3-large.
//   6. Upsert into iris_kb_chunks. Write iris_kb_sources tracker row.
//
// Phase 3b ships the scaffold + the chunker. The PDF parse + embed call land
// in the first soft-pilot smoke (Walker uploads a drawing; this fn picks it
// up via the queue). Until then this fn is a no-op that returns 204.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface DrawingIngestPayload {
  source_id: string
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: DrawingIngestPayload
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

  // Phase 3b scaffold: no-op acknowledge. Real implementation lands when the
  // first drawing PDF arrives on soft-pilot staging. The shape below is what
  // the implementation will return:
  //
  //   { status: 'succeeded', chunks_written: N, version_hash, latency_ms }
  //   { status: 'unchanged', version_hash }
  //   { status: 'failed', error, retry_in_ms }

  return new Response(
    JSON.stringify({
      status: 'scaffold',
      source_id: payload.source_id,
      message: 'Phase 3b scaffold — real PDF parse + embed lands on first soft-pilot drawing upload',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
