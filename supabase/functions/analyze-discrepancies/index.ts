// ── analyze-discrepancies Edge Function ───────────────────────
// Phase 3, Module 4 Step 4.2 (CROWN JEWEL): Dimensional discrepancy
// analyzer. Adapted from:
//   services/dimensional-discrepancy-analysis/helper_functions/discrepancy_detector.py
//   services/dimensional-discrepancy-analysis/app.py
//
// Workflow:
//   1. Fetch the drawing_pair (edges already detected in prior step).
//   2. Send arch & struct images + edge boxes to Gemini with the dimension
//      extraction + comparison prompt.
//   3. Parse JSON of dimension pairs with tolerance comparison.
//   4. Classify severity using thresholds from the Python source:
//        minor_threshold = 0.25 in  (< medium)
//        medium_threshold = 1.0 in
//        major_threshold  = 3.0 in  (>= major is "high")
//   5. Insert rows into drawing_discrepancies.
//   6. For any discrepancy with severity="high", auto-create a draft RFI
//      linked back to the discrepancy.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

interface AnalyzeRequest {
  pair_id: string
  arch_image_url?: string | null
  struct_image_url?: string | null
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

// Severity thresholds copied from discrepancy_detector.py
const MINOR_THRESHOLD_INCHES = 0.25
const MEDIUM_THRESHOLD_INCHES = 1.0
const MAJOR_THRESHOLD_INCHES = 3.0

// ── Dimension parsing (adapts parse_dim behaviour from Python source) ─
function parseArchitecturalDim(raw: string | null | undefined): number | null {
  if (!raw) return null
  const text = String(raw).trim()
  // 108'-3 1/4"
  const mixed = text.match(/(\d+)\s*'\s*-?\s*(\d+)?\s*(\d+\/\d+)?\s*"?/i)
  if (mixed) {
    const feet = parseInt(mixed[1] || '0', 10)
    const inches = parseInt(mixed[2] || '0', 10)
    let frac = 0
    if (mixed[3]) {
      const [num, den] = mixed[3].split('/').map((n) => parseInt(n, 10))
      if (den !== 0) frac = num / den
    }
    return feet * 12 + inches + frac
  }
  const inchesOnly = text.match(/^(\d+)(?:\s+(\d+\/\d+))?\s*"?$/)
  if (inchesOnly) {
    const inches = parseInt(inchesOnly[1], 10)
    let frac = 0
    if (inchesOnly[2]) {
      const [num, den] = inchesOnly[2].split('/').map((n) => parseInt(n, 10))
      if (den !== 0) frac = num / den
    }
    return inches + frac
  }
  const numeric = parseFloat(text.replace(/[^0-9.]/g, ''))
  return Number.isFinite(numeric) ? numeric : null
}

function classifySeverity(diffInches: number): 'high' | 'medium' | 'low' {
  if (diffInches >= MAJOR_THRESHOLD_INCHES) return 'high'
  if (diffInches >= MEDIUM_THRESHOLD_INCHES) return 'medium'
  return 'low'
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new HttpError(400, `Failed to fetch image URL: ${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? 'image/png'
  const mimeType = contentType.split(';')[0].trim() || 'image/png'
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { base64: btoa(binary), mimeType }
}

const DIMENSION_PROMPT = `You are an expert AEC dimension analyzer. You are given an ARCHITECTURAL drawing image and its corresponding STRUCTURAL drawing image, plus bounding boxes of detected building edges.

TASK:
1. Read the exterior building dimensions on BOTH drawings.
2. Match corresponding edges between arch and struct (same wall / same side).
3. For each matched edge, compute the numeric dimensions in inches.
4. Classify whether they disagree beyond 0.25 inch tolerance.

Return ONLY a valid JSON object:
{
  "pairs": [
    {
      "description": "North wall overall dimension",
      "arch_dimension": "108'-3 1/4\\"",
      "struct_dimension": "108'-4\\"",
      "arch_inches": 1299.25,
      "struct_inches": 1300.0,
      "location": { "x": 120, "y": 40, "w": 600, "h": 80 },
      "confidence": 0.87
    }
  ]
}

RULES:
- Only include pairs where you could read BOTH values with confidence >= 0.4.
- Do NOT hallucinate; if you cannot read, OMIT the pair.
- Express location as integer pixel coords on the arch drawing.
- Return no commentary outside the JSON.`

function stripCodeFence(text: string): string {
  const stripped = text.trim()
  if (stripped.startsWith('```')) {
    const parts = stripped.split('```')
    if (parts.length >= 3) {
      return parts[1].replace(/^json\s*/i, '').trim()
    }
  }
  return stripped
}

interface ParsedDimensionPair {
  description: string
  arch_dimension: string
  struct_dimension: string
  arch_inches?: number | null
  struct_inches?: number | null
  location?: { x?: number; y?: number; w?: number; h?: number }
  confidence?: number
}

function extractPairs(raw: string): ParsedDimensionPair[] {
  const stripped = stripCodeFence(raw)
  try {
    const parsed = JSON.parse(stripped)
    if (Array.isArray(parsed?.pairs)) return parsed.pairs as ParsedDimensionPair[]
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed?.pairs)) return parsed.pairs as ParsedDimensionPair[]
      } catch {
        /* ignore */
      }
    }
  }
  return []
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<AnalyzeRequest>(req)
    const pairId = requireUuid(body.pair_id, 'pair_id')

    const { data: pair, error: pairErr } = await supabase
      .from('drawing_pairs')
      .select(
        'id, project_id, arch_drawing_id, struct_drawing_id, detected_edges, pairing_reason, status',
      )
      .eq('id', pairId)
      .single()

    if (pairErr || !pair) {
      throw new HttpError(404, `drawing_pair ${pairId} not found`)
    }

    await verifyProjectMembership(supabase, user.id, pair.project_id)

    const archUrl = (body.arch_image_url ?? '').trim()
    const structUrl = (body.struct_image_url ?? '').trim()
    if (!archUrl || !structUrl) {
      throw new HttpError(400, 'arch_image_url and struct_image_url are required')
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new HttpError(500, 'GEMINI_API_KEY not configured')
    }
    const model = Deno.env.get('GEMINI_MODEL_NAME') ?? 'gemini-2.5-pro'

    await supabase
      .from('drawing_pairs')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', pairId)

    try {
      const [archImg, structImg] = await Promise.all([
        fetchImageAsBase64(archUrl),
        fetchImageAsBase64(structUrl),
      ])

      const edgeContext = pair.detected_edges
        ? `\n\nDetected edges JSON:\n${JSON.stringify(pair.detected_edges).slice(0, 4000)}`
        : ''

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'ARCHITECTURAL DRAWING:' },
              { inline_data: { mime_type: archImg.mimeType, data: archImg.base64 } },
              { text: '\nSTRUCTURAL DRAWING:' },
              { inline_data: { mime_type: structImg.mimeType, data: structImg.base64 } },
              { text: '\n\n' + DIMENSION_PROMPT + edgeContext },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new HttpError(502, `Gemini error ${resp.status}: ${text.slice(0, 400)}`)
      }
      const gemini = (await resp.json()) as GeminiResponse
      const geminiText =
        gemini.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string')?.text ?? ''
      const rawPairs = extractPairs(geminiText)

      const discrepancyInserts: Array<Record<string, unknown>> = []
      const createdRfis: string[] = []

      for (const p of rawPairs) {
        const archInches = typeof p.arch_inches === 'number'
          ? p.arch_inches
          : parseArchitecturalDim(p.arch_dimension)
        const structInches = typeof p.struct_inches === 'number'
          ? p.struct_inches
          : parseArchitecturalDim(p.struct_dimension)
        if (archInches === null || structInches === null) continue

        const diffInches = Math.abs(archInches - structInches)
        if (diffInches < MINOR_THRESHOLD_INCHES) continue // within tolerance, skip

        const severity = classifySeverity(diffInches)
        discrepancyInserts.push({
          pair_id: pairId,
          project_id: pair.project_id,
          description: p.description ?? 'Dimension mismatch',
          arch_dimension: p.arch_dimension ?? null,
          struct_dimension: p.struct_dimension ?? null,
          location_on_drawing: p.location ?? null,
          severity,
          confidence: typeof p.confidence === 'number' ? p.confidence : null,
        })
      }

      let inserted: Array<{ id: string; severity: string; description: string }> = []
      if (discrepancyInserts.length > 0) {
        const { data: insertData, error: insertErr } = await supabase
          .from('drawing_discrepancies')
          .insert(discrepancyInserts)
          .select('id, severity, description')
        if (insertErr) {
          throw new HttpError(500, `Failed to insert discrepancies: ${insertErr.message}`)
        }
        inserted = (insertData ?? []) as Array<{ id: string; severity: string; description: string }>
      }

      // Auto-draft RFIs for high-severity discrepancies.
      for (const d of inserted) {
        if (d.severity !== 'high') continue
        const rfiTitle = `AI: ${d.description.slice(0, 120)}`
        const rfiDescription = `Auto-generated by SiteSync AI drawing intelligence.\n\nDiscrepancy: ${d.description}\n\nReview the clash-detection panel for arch vs struct dimensions.`

        const { data: rfiRow, error: rfiErr } = await supabase
          .from('rfis')
          .insert({
            project_id: pair.project_id,
            title: rfiTitle,
            description: rfiDescription,
            priority: 'high',
            status: 'open',
            created_by: user.id,
            is_auto_generated: true,
            source_discrepancy_id: d.id,
          })
          .select('id')
          .single()

        if (!rfiErr && rfiRow?.id) {
          await supabase
            .from('drawing_discrepancies')
            .update({ auto_rfi_id: rfiRow.id })
            .eq('id', d.id)
          createdRfis.push(rfiRow.id)
        }
      }

      await supabase
        .from('drawing_pairs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', pairId)

      return new Response(
        JSON.stringify({
          pair_id: pairId,
          candidate_pairs: rawPairs.length,
          discrepancy_count: inserted.length,
          high_severity_count: inserted.filter((d) => d.severity === 'high').length,
          auto_rfi_count: createdRfis.length,
          status: 'completed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    } catch (err) {
      await supabase
        .from('drawing_pairs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', pairId)
      throw err
    }
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
