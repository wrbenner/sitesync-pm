// extract-quote-pdf — Sonnet 4.6 with cached system prompt.

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
  pdf_text: string
  pdf_page?: number
}

const SYSTEM_PROMPT = `Extract structured data from a construction subcontractor
quote PDF. Return JSON:
{
  "vendor": "...",
  "date": "YYYY-MM-DD",
  "total_amount": 12500,
  "line_items": [{"description":"...","qty":1,"unit_price":1000,"subtotal":1000}],
  "validity_days": 30,
  "confidence": 0.0,
  "field_confidence": {...}
}

Rules: total_amount must equal sum of line_item subtotals. Flag if mismatch.`

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
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
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
    let parsed: { confidence?: number; field_confidence?: Record<string, number>; total_amount?: number; line_items?: Array<{ subtotal: number }>; [k: string]: unknown }
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new HttpError(502, 'LLM returned non-JSON')
    }
    let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5

    // Sanity check: total must match line items.
    if (parsed.total_amount && parsed.line_items) {
      const sum = parsed.line_items.reduce((s, l) => s + (l.subtotal ?? 0), 0)
      if (Math.abs(sum - parsed.total_amount) > 0.5) {
        confidence = Math.min(confidence, 0.65) // demote to manual_review tier
      }
    }
    const status =
      confidence >= 0.85 ? 'auto_apply' : confidence >= 0.7 ? 'auto_apply_with_warning' : 'manual_review'

    const { data: row } = await supabase
      .from('ai_extraction_results')
      .insert({
        project_id,
        source_storage_path: body.storage_path,
        source_kind: 'quote_pdf',
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
