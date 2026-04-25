// ── Voice Extract Edge Function ───────────────────────────────
// Receives voice transcripts (+ optional photos) and extracts
// structured construction data using Claude.
//
// POST /functions/v1/voice-extract
// Body: { transcript, messages?, hasPhoto?, projectId?, language? }
// Returns: { entities[], detected_language }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32'
import {
  verifyProjectMembership,
  isValidUuid,
  sanitizeForPrompt,
  HttpError,
} from '../shared/auth.ts'

// ── Rate Limiting (in-memory, 20 extractions/hour per user) ──

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 3600_000

function checkRateLimit(userId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return
  }

  entry.count++
  if (entry.count > RATE_LIMIT) {
    throw new HttpError(429, 'Rate limit exceeded: 20 voice extractions per hour')
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a construction field report parser for SiteSync PM. Superintendents and foremen speak naturally on job sites. You extract structured data from their voice transcripts.

EXTRACTION RULES:
1. Identify ALL entities: daily log activities, RFI drafts, punch items, safety observations
2. One transcript can produce MULTIPLE entities of different types
3. Normalize locations: "level 3" → "Level 3", "east wing" → "East Wing"
4. Convert spoken numbers: "eighty percent" → 80, "six guys" → 6
5. Identify company names and crew headcounts
6. Extract weather data if mentioned (condition + temperature)
7. Safety concerns get HIGH priority automatically
8. Spanish input → translate output to English, keep proper nouns
9. Mixed language (Spanglish) → extract meaning from both languages
10. Construction vocabulary:
    - "mud" = drywall compound
    - "J-box" = junction box
    - "mudsill" = foundation plate
    - "romex" = NM-B electrical cable
    - "sheetrock" = drywall
    - "thinset" = tile adhesive mortar
    - "vaciado/colado" = concrete pour
    - "cimbra" = formwork
    - "varilla/fierro" = rebar

When a photo is included, combine visual analysis with the voice description:
- Identify visible trades, materials, and conditions
- Note any safety concerns visible in the photo
- Cross reference what the user says with what you see

Respond with ONLY valid JSON:
{
  "entities": [
    {
      "type": "daily_log | rfi_draft | punch_item | safety_observation | general_note",
      "data": {
        // daily_log fields:
        "activities": [{ "trade": "string", "location": "string", "description": "string", "progress": number|null }],
        "crew": [{ "company": "string", "headcount": number, "trade": "string" }],
        "weather": { "condition": "string", "temp_f": number } | null,
        "equipment": ["string"] | null,
        "materials": ["string"] | null,

        // rfi_draft fields:
        "subject": "string",
        "location": "string",
        "question": "string (formal RFI question based on what user described)",
        "priority": "low|medium|high|critical",
        "spec_section": "string (CSI section if identifiable)" | null,

        // punch_item fields:
        "title": "string",
        "location": "string",
        "trade": "string",
        "priority": "low|medium|high|critical",
        "description": "string",

        // safety_observation fields:
        "description": "string",
        "location": "string",
        "severity": "low|medium|high|critical",
        "corrective_action": "string (recommended action)" | null,
        "osha_reference": "string (relevant 29 CFR 1926 section)" | null
      },
      "confidence": 0.0-1.0,
      "source": "quoted section of transcript that generated this entity"
    }
  ],
  "detected_language": "en|es|mixed"
}`

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://sitesync-pm.vercel.app'

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const body = await req.json()
    const { transcript, messages, hasPhoto, projectId, language } = body

    // Validate projectId
    if (!projectId || typeof projectId !== 'string' || !isValidUuid(projectId)) {
      return new Response(JSON.stringify({ error: 'Valid projectId is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Validate transcript
    if (!transcript || typeof transcript !== 'string' || transcript.length < 3) {
      return new Response(JSON.stringify({ error: 'Transcript is required (min 3 characters)' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    if (transcript.length > 10000) {
      return new Response(JSON.stringify({ error: 'Transcript too long (max 10000 characters)' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Verify user is a member of the project
    await verifyProjectMembership(supabaseClient, user.id, projectId)

    // Rate limit expensive AI calls (20/hour per user)
    checkRateLimit(user.id)

    // Sanitize transcript before sending to AI
    const sanitizedTranscript = sanitizeForPrompt(transcript)

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    // Build messages for Claude
    let claudeMessages: Anthropic.Messages.MessageParam[]

    if (hasPhoto && messages && messages.length > 0) {
      // Photo + voice: use the pre-built multimodal message
      claudeMessages = messages.map((m: { role: string; content: unknown }) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }))
    } else {
      // Voice only
      claudeMessages = [
        {
          role: 'user',
          content: `Parse this construction field report transcript into structured entities. The speaker's language is ${language || 'English'}.\n\nTranscript:\n"${sanitizedTranscript}"`,
        },
      ]
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: claudeMessages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({
          entities: [{
            type: 'general_note',
            data: { description: transcript },
            confidence: 0.3,
            source: transcript,
          }],
          detected_language: language || 'en',
        }),
        { headers: corsHeaders },
      )
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])

      // Validate and sanitize entities
      const entities = Array.isArray(parsed.entities)
        ? parsed.entities.map((e: Record<string, unknown>) => ({
            type: ['daily_log', 'rfi_draft', 'punch_item', 'safety_observation', 'general_note'].includes(e.type as string)
              ? e.type
              : 'general_note',
            data: typeof e.data === 'object' && e.data !== null ? e.data : { description: transcript },
            confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.5,
            source: typeof e.source === 'string' ? e.source.substring(0, 500) : '',
          }))
        : []

      // Audit trail
      await supabaseClient.from('ai_agent_actions').insert({
        project_id: projectId || null,
        agent_type: 'voice_extract',
        action_type: 'extraction',
        description: `Voice extraction: ${entities.length} entities from ${transcript.length} char transcript`,
        status: 'completed',
        confidence: Math.round(
          entities.reduce((sum: number, e: { confidence: number }) => sum + e.confidence, 0) /
            Math.max(entities.length, 1) * 100,
        ),
        metadata: {
          language: parsed.detected_language || language,
          entityCount: entities.length,
          entityTypes: entities.map((e: { type: string }) => e.type),
          hasPhoto: !!hasPhoto,
          transcriptLength: transcript.length,
        },
      }).then(() => {}) // Fire and forget

      return new Response(
        JSON.stringify({
          entities,
          detected_language: parsed.detected_language || language || 'en',
        }),
        { headers: corsHeaders },
      )
    } catch {
      // JSON parse failed, return general note
      return new Response(
        JSON.stringify({
          entities: [{
            type: 'general_note',
            data: { description: transcript },
            confidence: 0.3,
            source: transcript,
          }],
          detected_language: language || 'en',
        }),
        { headers: corsHeaders },
      )
    }
  } catch (err) {
    console.error('Voice extract error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN } },
    )
  }
})
