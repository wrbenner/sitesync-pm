// ────────────────────────────────────────────────────────────────────────────
// iris-ingest-photo-worker — Phase 3c scaffold
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
//
// Drains `iris_ingest` messages where source_type='photo'.
//   1. Read media_assets row.
//   2. Daily quota check: bail if project hit 500 photos/day cap (audit_log
//      gets a daily_quota_exceeded incident).
//   3. Vision-LLM caption the image (cached by content hash for idempotency).
//   4. chunkPhoto(caption + tags) — emits 0 or 1 chunk.
//   5. Embed the caption text via OpenAI; upsert.
//
// The cost cap is critical — without it, a project with 8K photos blows
// through the $2/project/month budget on backfill alone.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface PhotoIngestPayload {
  source_id: string // = asset_id
  project_id: string
  org_id: string
  version_hash: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: PhotoIngestPayload
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
      message: 'Phase 3c scaffold — vision-caption + cost-cap + embed lands on first soft-pilot photo',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
