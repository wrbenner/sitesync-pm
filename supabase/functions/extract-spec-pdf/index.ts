// extract-spec-pdf — Sonnet 4.6 with cached system prompt. Returns a
// confidence-gated extraction; persists to ai_extraction_results.

import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface ExtractRequest {
  project_id: string
  storage_path: string
  pdf_text: string // pre-extracted by caller (use extract-pdf-page first)
  pdf_page?: number
}

const SYSTEM_PROMPT = `You are extracting structured data from a construction
spec section PDF. Return JSON with fields:
{
  "spec_section": "03 30 00",
  "title": "Cast-in-place concrete",
  "reference_standards": ["ACI 318", "ASTM C39"],
  "product_substitutions_allowed": true,
  "acceptance_criteria": ["..."],
  "confidence": 0.0,
  "field_confidence": { "spec_section": 0.95, ... }
}

Rules:
- spec_section must follow CSI MasterFormat (NN NN NN).
- Set field_confidence < 0.7 for any field you're inferring rather than reading.
- Set overall confidence to the minimum of your field confidences.`

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ExtractRequest>(req)
    const project_id = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, project_id)
    if (!body.pdf_text || body.pdf_text.length < 50) throw new HttpError(400, 'pdf_text required')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')
    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250930',
        max_tokens: 2048,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'text', text: body.pdf_text }] }],
      }),
    })
    if (!llmRes.ok) throw new HttpError(502, `LLM error: ${await llmRes.text()}`)
    const llmJson = await llmRes.json()
    const text = (llmJson.content?.[0]?.text ?? '').trim()
    let parsed: { confidence?: number; field_confidence?: Record<string, number>; [k: string]: unknown }
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new HttpError(502, 'LLM returned non-JSON')
    }
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
    const status =
      confidence >= 0.85 ? 'auto_apply' : confidence >= 0.7 ? 'auto_apply_with_warning' : 'manual_review'

    const { data: row } = await supabase
      .from('ai_extraction_results')
      .insert({
        project_id,
        source_storage_path: body.storage_path,
        source_kind: 'spec_pdf',
        extracted_payload: parsed,
        confidence,
        field_confidence: parsed.field_confidence ?? null,
        pdf_page: body.pdf_page ?? null,
        status,
      })
      .select('id')
      .single()

    return new Response(
      JSON.stringify({ id: row?.id, status, confidence, payload: parsed }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return errorResponse(req, e)
  }
})
