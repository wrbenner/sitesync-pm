// structure-field-note — Extract structured JSON from a field worker's transcript.
// The LLM is asked to return a strict JSON document; we normalize and validate it.


import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireUuid,
  sanitizeForPrompt,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

type NoteKind = 'daily_log' | 'safety' | 'punch_list' | 'meeting' | 'general'

interface Body {
  project_id?: string
  transcript?: string
  kind?: NoteKind
}

const SCHEMA_HINTS: Record<NoteKind, string> = {
  daily_log: `{
  "date": "YYYY-MM-DD or null",
  "weather": { "conditions": "", "temperature_f": 0 } | null,
  "activities": [{ "description": "", "location": "", "trade": "" }],
  "crew_count": 0,
  "equipment": [{ "name": "", "hours": 0 }],
  "safety_observations": [{ "description": "", "severity": "low|medium|high" }],
  "issues": [{ "description": "", "impact": "" }],
  "location": "",
  "summary": ""
}`,
  safety: `{
  "incident_type": "near_miss|injury|property_damage|observation",
  "severity": "low|medium|high|critical",
  "description": "",
  "location": "",
  "persons_involved": [""],
  "immediate_actions": [""],
  "corrective_actions": [""],
  "witnesses": [""]
}`,
  punch_list: `{
  "items": [{
    "description": "",
    "location": "",
    "trade": "",
    "priority": "low|medium|high",
    "assigned_to": ""
  }]
}`,
  meeting: `{
  "title": "",
  "date": "YYYY-MM-DD",
  "attendees": [""],
  "topics_discussed": [""],
  "decisions": [""],
  "action_items": [{ "task": "", "owner": "", "due": "" }],
  "next_meeting": ""
}`,
  general: `{ "summary": "", "key_points": [""], "action_items": [""], "entities": [] }`,
}

function extractJson(text: string): unknown {
  // Tolerant JSON extractor — Claude usually returns clean JSON but may wrap in ```json blocks.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<Body>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, projectId)

    const transcript = sanitizeForPrompt((body.transcript || '').toString(), 20000)
    if (transcript.length < 5) throw new HttpError(400, 'Transcript too short')

    const kind: NoteKind = (body.kind && SCHEMA_HINTS[body.kind] ? body.kind : 'general') as NoteKind

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')

    const systemPrompt = `You extract structured data from a construction field worker's verbal note.

Return ONLY valid JSON matching this schema exactly (use null for missing values, never invent data):

${SCHEMA_HINTS[kind]}

Rules:
- Use only facts stated in the transcript.
- Normalize dates to ISO (YYYY-MM-DD). If the worker says "today", use today's date.
- Normalize times to 24h (HH:MM).
- If a field is not mentioned, use null or an empty array.
- Do not include commentary outside the JSON.`

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Transcript:\n"""\n${transcript}\n"""\n\nReturn JSON only.` },
        ],
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new HttpError(502, `Claude failed: ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const structured = extractJson(text)

    return new Response(
      JSON.stringify({
        ok: true,
        kind,
        structured,
        raw_text: text,
      }),
      { status: 200, headers },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
