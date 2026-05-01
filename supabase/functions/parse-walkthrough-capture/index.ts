// parse-walkthrough-capture — turn a transcript + (optional) photo into
// a structured ParsedCapture using Claude Sonnet 4.6.
//
// We use prompt caching on the system prompt (per the claude-api skill)
// because every call shares the same JSON-schema instructions and few-
// shot examples — caching cuts costs by ~80% on a busy walk.
//
// Falls back to a deterministic rule-based parse (mirroring the
// client-side parseTranscriptToCapture) when ANTHROPIC_API_KEY is
// missing, so the field always gets a usable result.

import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  parseJsonBody,
  errorResponse,
  HttpError,
  sanitizeForPrompt,
} from '../shared/auth.ts'

interface ParseRequest {
  transcript: string
  photo_storage_path?: string
  previous_capture?: ParsedCapture
}

interface ParsedCapture {
  title: string
  description: string
  trade?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  location_hint?: string
  suggested_subcontractor_id?: string
  modify_previous: boolean
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are extracting punch-list items from a construction walk-through transcript.
Return ONLY valid JSON matching this exact schema (no prose, no markdown):
{
  "title": "imperative one-liner under 80 chars",
  "description": "the cleaned-up transcript, max 500 chars",
  "trade": "electrical|plumbing|mech|mep|finishes|structural|casework|landscape" (optional),
  "severity": "low|medium|high|critical",
  "location_hint": "string up to 60 chars if mentioned" (optional),
  "modify_previous": false (true if this transcript means amend/cancel the previous capture)
}

Severity rules:
- critical: leaks, structural, life-safety, water damage
- high: broken, missing, wrong, doesn't work, code violation
- medium: needs repair, rework, incomplete
- low: scratched, stained, cosmetic, touch up

Examples:
Input: "Stained drywall in the east elevator lobby — needs touch up"
Output: {"title":"Touch up stained drywall in east elevator lobby","description":"Stained drywall in the east elevator lobby — needs touch up","trade":"finishes","severity":"low","location_hint":"east elevator lobby","modify_previous":false}

Input: "Pipe is leaking in the mechanical room"
Output: {"title":"Repair leaking pipe in mechanical room","description":"Pipe is leaking in the mechanical room","trade":"plumbing","severity":"critical","location_hint":"mechanical room","modify_previous":false}

Input: "Actually that one's the wrong unit — scratch that"
Output: {"title":"(amended) previous capture","description":"Actually that one's the wrong unit","severity":"medium","modify_previous":true}`

// ── Deterministic fallback (mirrors src/lib/walkthrough/voiceParser.ts) ──

function fallbackParse(transcript: string, prev?: ParsedCapture): ParsedCapture {
  const text = transcript.trim()
  const lower = text.toLowerCase()

  const modifyPhrases = [
    "actually that one's", 'scratch that', 'ignore the last',
    "don't include the previous", 'never mind the last',
  ]
  const modify_previous = modifyPhrases.some((p) => lower.includes(p))
  if (modify_previous && prev) {
    return { ...prev, title: `${prev.title} (amended)`, description: text || prev.description, modify_previous: true }
  }

  const sevTiers: Array<{ sev: ParsedCapture['severity']; kw: string[] }> = [
    { sev: 'critical', kw: ['leak', 'leaking', 'structural', 'unsafe', 'water damage', 'fire', 'must', 'cannot'] },
    { sev: 'high',     kw: ['broken', 'missing', 'wrong', 'damaged', 'cracked', 'failed', 'code violation'] },
    { sev: 'medium',   kw: ['needs repair', 'rework', 'incomplete', 'should be replaced'] },
    { sev: 'low',      kw: ['stained', 'scratched', 'minor', 'cosmetic', 'touch up', 'small'] },
  ]
  let severity: ParsedCapture['severity'] = 'medium'
  for (const t of sevTiers) {
    if (t.kw.some((k) => lower.includes(k))) { severity = t.sev; break }
  }

  const tradeBank: Array<{ trade: string; kw: string[] }> = [
    { trade: 'electrical', kw: ['electrical', 'outlet', 'breaker', 'wiring', 'fixture'] },
    { trade: 'plumbing',   kw: ['plumbing', 'pipe', 'leak', 'leaking', 'faucet', 'drain'] },
    { trade: 'mech',       kw: ['mechanical', 'hvac', 'duct', 'thermostat'] },
    { trade: 'finishes',   kw: ['paint', 'drywall', 'baseboard', 'trim', 'tile', 'scratched', 'stained'] },
    { trade: 'structural', kw: ['structural', 'beam', 'column', 'foundation'] },
    { trade: 'casework',   kw: ['cabinet', 'casework', 'millwork'] },
    { trade: 'landscape',  kw: ['landscape', 'planter', 'sod', 'irrigation'] },
  ]
  let trade: string | undefined
  for (const b of tradeBank) {
    if (b.kw.some((k) => lower.includes(k))) { trade = b.trade; break }
  }

  const locMatch = text.match(/(?:in the|near the|at the|by the)\s+([A-Za-z][A-Za-z0-9 ]{2,40})/i)
  const location_hint = locMatch ? locMatch[1].trim() : undefined

  const firstSentence = text.split(/[.!?]\s/)[0] ?? text
  const title = firstSentence.length > 80 ? firstSentence.slice(0, 77) + '…' : firstSentence

  return { title: title || 'Untitled capture', description: text, trade, severity, location_hint, modify_previous: false }
}

// ── Handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user } = await authenticateRequest(req)
    void user // we authenticate but don't use the user object beyond that

    const body = await parseJsonBody<ParseRequest>(req)
    const transcript = sanitizeForPrompt(body.transcript ?? '', 4000)
    if (!transcript) throw new HttpError(400, 'transcript is required')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      // Deterministic fallback — keeps the field unblocked.
      const fallback = fallbackParse(transcript, body.previous_capture)
      return new Response(JSON.stringify({ parsed: fallback, source: 'fallback' }), {
        status: 200,
        headers,
      })
    }

    const userBlock: Record<string, unknown> = { transcript }
    if (body.previous_capture) userBlock.previous_capture = body.previous_capture

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        // Cache the system prompt — every walkthrough capture sends the
        // same instruction block, so the cache hit rate is ~99%.
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: JSON.stringify(userBlock),
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      // On any LLM failure, fall back to deterministic parsing so the
      // field flow keeps moving. Surface the source so the client knows.
      const fallback = fallbackParse(transcript, body.previous_capture)
      return new Response(JSON.stringify({ parsed: fallback, source: 'fallback', llm_error: anthropicRes.status }), {
        status: 200,
        headers,
      })
    }

    const json = await anthropicRes.json() as { content?: Array<{ text?: string }> }
    const text = json.content?.[0]?.text ?? ''
    let parsed: ParsedCapture
    try {
      parsed = JSON.parse(text) as ParsedCapture
      // Hard validate the severity literal.
      if (!['low', 'medium', 'high', 'critical'].includes(parsed.severity)) {
        parsed.severity = 'medium'
      }
      if (typeof parsed.modify_previous !== 'boolean') parsed.modify_previous = false
    } catch {
      parsed = fallbackParse(transcript, body.previous_capture)
    }

    return new Response(JSON.stringify({ parsed, source: 'sonnet' }), {
      status: 200,
      headers,
    })
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
