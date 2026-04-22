// ── highlight-conflicts Edge Function ─────────────────────────
// Adapted from SiteSync AI:
//   sitesync-ai-utils-backend/app/routers/conflict_polygon.py
//   sitesync-ai-utils-backend/app/services/conflict_polygon.py
//
// Accepts architectural and structural drawing image URLs, uses Gemini Vision
// to identify regions where structural elements don't align, draws red
// polygons around mismatches on an SVG overlay, stores the overlay in
// Supabase Storage, returns the public URLs plus per-conflict bounding boxes.


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

interface HighlightConflictsRequest {
  pair_id: string
  arch_image_url: string
  struct_image_url: string
  output_bucket?: string
}

interface Bbox {
  x: number
  y: number
  width: number
  height: number
}

interface Conflict {
  arch_bbox: Bbox
  struct_bbox: Bbox
  description: string
  severity: 'high' | 'medium' | 'low'
}

interface GeminiConflictsResponse {
  conflicts: Conflict[]
  image_width?: number
  image_height?: number
}

const GEMINI_MODEL = 'gemini-2.5-flash'

const CONFLICT_PROMPT = `You are a structural drawing clash detector. Compare the two images:
- Image 1 = architectural plan
- Image 2 = structural plan (same drawing area, same scale)

Identify regions where structural elements (columns, beams, walls, slab edges)
don't align with architectural features. For each conflict, return a bounding
box in PIXEL coordinates relative to each image.

Return STRICT JSON only (no markdown fences):
{
  "image_width": <int>,
  "image_height": <int>,
  "conflicts": [
    {
      "arch_bbox":   {"x": <int>, "y": <int>, "width": <int>, "height": <int>},
      "struct_bbox": {"x": <int>, "y": <int>, "width": <int>, "height": <int>},
      "description": "<one-sentence clash summary>",
      "severity": "high" | "medium" | "low"
    }
  ]
}
`

async function fetchImageAsBase64(url: string): Promise<{ data: string; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new HttpError(502, `Failed to fetch image: ${res.status}`)
  const mime = res.headers.get('content-type') || 'image/png'
  const buf = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  }
  return { data: btoa(binary), mime }
}

async function callGeminiVision(
  apiKey: string,
  archImg: { data: string; mime: string },
  structImg: { data: string; mime: string },
): Promise<GeminiConflictsResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`

  const body = {
    contents: [
      {
        parts: [
          { text: CONFLICT_PROMPT },
          { inline_data: { mime_type: archImg.mime, data: archImg.data } },
          { inline_data: { mime_type: structImg.mime, data: structImg.data } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(502, `Gemini error ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  try {
    return JSON.parse(text) as GeminiConflictsResponse
  } catch {
    throw new HttpError(502, 'Gemini returned non-JSON response')
  }
}

function buildSvgOverlay(
  width: number,
  height: number,
  conflicts: Conflict[],
  side: 'arch' | 'struct',
): string {
  const severityStroke: Record<Conflict['severity'], string> = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#FACC15',
  }
  const rects = conflicts
    .map((c, i) => {
      const b = side === 'arch' ? c.arch_bbox : c.struct_bbox
      if (!b) return ''
      const color = severityStroke[c.severity] ?? '#EF4444'
      return `<g>
        <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"
              fill="${color}" fill-opacity="0.18"
              stroke="${color}" stroke-width="4" stroke-dasharray="8 4"/>
        <text x="${b.x + 6}" y="${b.y + 18}" fill="${color}"
              font-family="monospace" font-size="14" font-weight="700">#${i + 1}</text>
      </g>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${rects}
</svg>`
}

async function uploadOverlay(
  supabaseUrl: string,
  serviceKey: string,
  bucket: string,
  path: string,
  svg: string,
): Promise<string> {
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'image/svg+xml',
      'x-upsert': 'true',
    },
    body: svg,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(502, `Storage upload failed: ${text.slice(0, 300)}`)
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<HighlightConflictsRequest>(req)
    const pairId = requireUuid(body.pair_id, 'pair_id')

    const { data: pair, error: fetchErr } = await supabase
      .from('drawing_pairs')
      .select('id, project_id')
      .eq('id', pairId)
      .single()
    if (fetchErr || !pair) throw new HttpError(404, `drawing_pair ${pairId} not found`)
    await verifyProjectMembership(supabase, user.id, pair.project_id)

    const archUrl = (body.arch_image_url ?? '').trim()
    const structUrl = (body.struct_image_url ?? '').trim()
    if (!/^https?:\/\//i.test(archUrl) || !/^https?:\/\//i.test(structUrl)) {
      throw new HttpError(400, 'image URLs must be http(s)')
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY')
    if (!geminiKey) throw new HttpError(500, 'GEMINI_API_KEY not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      throw new HttpError(500, 'Supabase storage credentials not configured')
    }

    const [archImg, structImg] = await Promise.all([
      fetchImageAsBase64(archUrl),
      fetchImageAsBase64(structUrl),
    ])
    const result = await callGeminiVision(geminiKey, archImg, structImg)
    const width = result.image_width ?? 2000
    const height = result.image_height ?? 1500

    const bucket = body.output_bucket ?? 'drawings'
    const archSvg = buildSvgOverlay(width, height, result.conflicts, 'arch')
    const structSvg = buildSvgOverlay(width, height, result.conflicts, 'struct')

    const timestamp = Date.now()
    const [archOverlayUrl, structOverlayUrl] = await Promise.all([
      uploadOverlay(
        supabaseUrl,
        serviceKey,
        bucket,
        `overlays/${pairId}/arch-${timestamp}.svg`,
        archSvg,
      ),
      uploadOverlay(
        supabaseUrl,
        serviceKey,
        bucket,
        `overlays/${pairId}/struct-${timestamp}.svg`,
        structSvg,
      ),
    ])

    return new Response(
      JSON.stringify({
        pair_id: pairId,
        arch_overlay_url: archOverlayUrl,
        struct_overlay_url: structOverlayUrl,
        conflict_count: result.conflicts.length,
        conflicts: result.conflicts,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
