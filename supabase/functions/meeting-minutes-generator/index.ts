// meeting-minutes-generator — converts a transcript into structured minutes
// via Sonnet 4.6 with cached system prompt.

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

interface GenerateRequest {
  project_id: string
  meeting_title: string
  meeting_date: string
  attendees: Array<{ name: string; role?: string }>
  transcript: string
}

const SYSTEM_PROMPT = `You convert raw meeting transcripts into structured
minutes. Return JSON:
{
  "decisions": ["..."],
  "action_items": [{"owner":"...","description":"...","due":"YYYY-MM-DD"}],
  "open_questions": ["..."]
}

Rules:
- Owners must be names from the attendee list.
- Action items are imperative.
- Skip filler/small talk.`

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<GenerateRequest>(req)
    const project_id = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, project_id)
    if (!body.transcript || body.transcript.length < 50) throw new HttpError(400, 'transcript too short')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')

    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250930',
        max_tokens: 4096,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: `Attendees:\n${body.attendees.map((a) => `- ${a.name}${a.role ? ' (' + a.role + ')' : ''}`).join('\n')}\n\nTranscript:\n${body.transcript}`,
          }],
        }],
      }),
    })
    if (!llmRes.ok) throw new HttpError(502, `LLM error: ${await llmRes.text()}`)
    const llmJson = await llmRes.json()
    const text = (llmJson.content?.[0]?.text ?? '').trim()
    let extracted: { decisions: string[]; action_items: Array<{ owner: string; description: string; due?: string }>; open_questions: string[] }
    try {
      extracted = JSON.parse(text)
    } catch {
      throw new HttpError(502, 'LLM returned non-JSON')
    }

    const snapshotAt = new Date()
    const sections: Array<{ heading: string; bullets?: string[]; rows?: Array<Record<string, unknown>> }> = []
    sections.push({ heading: 'Attendees', bullets: body.attendees.map((a) => (a.role ? `${a.name} (${a.role})` : a.name)) })
    if (extracted.decisions?.length) sections.push({ heading: 'Decisions', bullets: extracted.decisions })
    if (extracted.action_items?.length) sections.push({ heading: 'Action items', rows: extracted.action_items.map((a) => ({ Owner: a.owner, Action: a.description, Due: a.due ?? '—' })) })
    if (extracted.open_questions?.length) sections.push({ heading: 'Open questions', bullets: extracted.open_questions })

    const doc = {
      title: body.meeting_title,
      subtitle: body.meeting_date,
      as_of: snapshotAt.toISOString(),
      sections,
    }

    const enc = new TextEncoder()
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(doc)))
    const contentHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')

    const { data: runRow } = await supabase
      .from('document_gen_runs')
      .insert({
        project_id,
        kind: 'meeting_minutes',
        snapshot_at: snapshotAt.toISOString(),
        completed_at: new Date().toISOString(),
        content_hash: contentHash,
        triggered_by: user.id,
      })
      .select('id')
      .single()

    return new Response(JSON.stringify({ run_id: runRow?.id, document: doc }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return errorResponse(req, e)
  }
})
