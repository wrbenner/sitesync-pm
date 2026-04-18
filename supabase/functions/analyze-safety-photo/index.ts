// analyze-safety-photo — OSHA-trained safety analysis of a construction job site photo.
// Uses Gemini Vision with structured JSON output. Falls back to Claude vision if Gemini missing.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireUuid,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

interface Body {
  project_id?: string
  photo_url?: string
}

interface Violation {
  category: string
  description: string
  osha_reference: string
  severity: 'Critical' | 'Serious' | 'Other'
  corrective_action: string
}

interface Analysis {
  is_construction_site: boolean
  scene_description: string
  safety_score: number
  summary: string
  violations: Violation[]
}

const SYSTEM_PROMPT = `You are an OSHA-certified construction safety inspector (OSHA 500 trained) analyzing a job site photograph.

Identify ALL safety violations visible. For each violation provide:
- category: one of [Fall Protection, PPE, Scaffolding, Electrical, Excavation, Housekeeping, Fire Protection, Hot Work, Confined Space, Struck-by/Caught-in, Ladder Safety, Hazard Communication]
- description: specific, observed violation
- osha_reference: specific standard (e.g., "29 CFR 1926.501(b)(1)")
- severity: "Critical" | "Serious" | "Other"
- corrective_action: concrete, actionable fix

Also provide:
- is_construction_site: boolean (false if image is not a construction site)
- scene_description: one-sentence description of what's visible
- safety_score: 0-100 integer (100 = perfect, 0 = imminent danger). Penalize Critical violations heavily.
- summary: 1-2 sentence overall safety assessment

Return ONLY valid JSON with this exact schema:
{
  "is_construction_site": boolean,
  "scene_description": string,
  "safety_score": number,
  "summary": string,
  "violations": [ { "category": string, "description": string, "osha_reference": string, "severity": string, "corrective_action": string } ]
}`

function extractJson(text: string): unknown {
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

async function fetchImageAsBase64(url: string): Promise<{ b64: string; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new HttpError(400, `Image fetch failed (${res.status})`)
  const mime = res.headers.get('content-type') || 'image/jpeg'
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { b64: btoa(binary), mime }
}

async function analyzeWithGemini(url: string, apiKey: string): Promise<Analysis> {
  const { b64, mime } = await fetchImageAsBase64(url)
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          { inline_data: { mime_type: mime, data: b64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new HttpError(502, `Gemini failed: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const parsed = extractJson(text) as Analysis | null
  if (!parsed) throw new HttpError(502, 'Gemini returned non-JSON')
  return parsed
}

async function analyzeWithClaude(url: string, apiKey: string): Promise<Analysis> {
  const { b64, mime } = await fetchImageAsBase64(url)
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
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: 'Analyze this image per the system instructions. Return JSON only.' },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new HttpError(502, `Claude vision failed: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const parsed = extractJson(text) as Analysis | null
  if (!parsed) throw new HttpError(502, 'Claude returned non-JSON')
  return parsed
}

function clampScore(n: unknown): number {
  const num = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(num)) return 50
  return Math.max(0, Math.min(100, Math.round(num)))
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<Body>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, projectId)

    const photoUrl = (body.photo_url || '').toString()
    if (!photoUrl.startsWith('http')) throw new HttpError(400, 'Valid photo_url required')

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    let analysis: Analysis
    let analyzedBy = 'gemini-vision'
    if (geminiKey) {
      analysis = await analyzeWithGemini(photoUrl, geminiKey)
    } else if (anthropicKey) {
      analysis = await analyzeWithClaude(photoUrl, anthropicKey)
      analyzedBy = 'claude-vision'
    } else {
      throw new HttpError(500, 'Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY configured')
    }

    if (analysis.is_construction_site === false) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: 'not_a_construction_site',
          scene_description: analysis.scene_description || 'Image does not appear to show a construction site',
        }),
        { status: 200, headers },
      )
    }

    const safety_score = clampScore(analysis.safety_score)
    const violations = Array.isArray(analysis.violations) ? analysis.violations.slice(0, 20) : []

    const { data: saved, error: insertErr } = await supabase
      .from('safety_photo_analyses')
      .insert({
        project_id: projectId,
        photo_url: photoUrl,
        safety_score,
        violations,
        summary: analysis.summary || '',
        scene_description: analysis.scene_description || '',
        analyzed_by: analyzedBy,
        created_by: user.id,
      })
      .select('id, analyzed_at')
      .single()
    if (insertErr) throw new HttpError(500, `Insert failed: ${insertErr.message}`)

    return new Response(
      JSON.stringify({
        ok: true,
        id: saved?.id,
        safety_score,
        summary: analysis.summary,
        scene_description: analysis.scene_description,
        violations,
        analyzed_by: analyzedBy,
        analyzed_at: saved?.analyzed_at,
      }),
      { status: 200, headers },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
