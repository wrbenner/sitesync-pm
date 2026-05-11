// ────────────────────────────────────────────────────────────────────────────
// iris-embed — Phase 3c edge fn
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
// ADR-017: text-embedding-3-large @ 1536 dimensions.
//
// One-shot embedding endpoint. Browser-side retrieve() invokes this from
// outside the Deno runtime; workers also use it to embed chunk text.
//
// Why split this out vs inlining the OpenAI call into each worker:
//   - Single place to read OPENAI_API_KEY from edge secrets.
//   - Single place to apply rate-limit retry + cost cap.
//   - retrieve() doesn't bundle the OpenAI client into the browser.
//
// Phase 3c scaffold returns a deterministic null embedding for callers; the
// retrieve() RPC falls back to ts_rank-only retrieval when embedding is
// null. Real OpenAI call lands on first soft-pilot upload (same moment the
// workers go live), keeping API spend at $0 during the scaffold window.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface EmbedRequest {
  text: string
  model?: string
}

interface EmbedResponse {
  embedding: number[] | null
  model: string
  dimensions: number
  scaffold: boolean
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: EmbedRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.text || body.text.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'text_required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (body.text.length > 8000) {
    return new Response(JSON.stringify({ error: 'text_too_long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const response: EmbedResponse = {
    embedding: null,
    model: body.model ?? 'text-embedding-3-large',
    dimensions: 1536,
    scaffold: true,
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
