// Iris RFI response draft — when an architect's reply lands, Sonnet
// drafts a response for the PM to review. Cached system prompt for speed
// + cost.
//
// POST { rfi_id, project_id } → drafted_action row id

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

interface RfiResponseDraftRequest {
  rfi_id: string
  project_id: string
}

const SYSTEM_PROMPT = `You are Iris, the AI co-pilot embedded inside SiteSync.
A construction PM has received an RFI response from the architect. Your job
is to draft a clear, professional acknowledgement that closes the loop with
the field team and references the cited spec/drawing.

Output format:
{
  "subject": "RFI #N — closure / next step",
  "body": "Acknowledged. <verb><detail> ...",
  "next_actions": ["..."],
  "confidence": 0.0
}

Rules:
- Cite the architect's response number/date.
- Mention the impacted spec section or drawing if available.
- Suggest a single concrete next action.
- Keep the body under 200 words.
- If the response is ambiguous, set confidence < 0.7 and ask a follow-up question.`

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<RfiResponseDraftRequest>(req)
    const rfi_id = requireUuid(body.rfi_id, 'rfi_id')
    const project_id = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, project_id)

    const { data: rfi, error } = await supabase
      .from('rfis')
      .select('id, number, title, question, response_body, response_attachments, spec_section, drawing_id')
      .eq('id', rfi_id)
      .single()
    if (error || !rfi) throw new HttpError(404, 'RFI not found')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `RFI ${rfi.number}: ${rfi.title}\nQuestion: ${rfi.question}\nArchitect response: ${rfi.response_body ?? '(empty)'}\nSpec: ${rfi.spec_section ?? 'n/a'}` },
        ],
      },
    ]

    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250930',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      }),
    })
    if (!llmRes.ok) {
      const t = await llmRes.text()
      throw new HttpError(502, `LLM error: ${t}`)
    }
    const llmJson = await llmRes.json()
    const text = (llmJson.content?.[0]?.text ?? '').trim()
    let parsed: { subject?: string; body?: string; confidence?: number; next_actions?: string[] } = {}
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { subject: 'RFI response — review', body: text, confidence: 0.6, next_actions: [] }
    }

    // Write a drafted_action row for the user to approve.
    const { data: draft, error: insErr } = await supabase
      .from('drafted_actions')
      .insert({
        project_id,
        action_type: 'rfi.draft',
        title: parsed.subject ?? 'RFI response — review',
        summary: parsed.body ?? null,
        payload: { title: parsed.subject ?? 'RFI response — review', description: parsed.body ?? '' },
        confidence: parsed.confidence ?? 0.7,
        drafted_by: 'iris.rfi_response_draft',
        draft_reason: `Architect responded to RFI #${rfi.number}`,
        related_resource_type: 'rfi',
        related_resource_id: rfi_id,
      })
      .select('id')
      .single()
    if (insErr) throw new HttpError(500, insErr.message)

    return new Response(JSON.stringify({ drafted_action_id: draft?.id }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return errorResponse(req, e)
  }
})
