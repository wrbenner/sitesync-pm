// ── extract-floor-outline Edge Function ───────────────────────
// Adapted from SiteSync AI:
//   sitesync-ai-utils-backend/app/routers/outer_walls_extractor.py
//   sitesync-ai-utils-backend/app/services/outer_walls_extractor.py
//
// Uses Gemini Vision to identify the outer walls / footprint of a floor plan
// from a drawing image. Returns polygon coordinates plus derived metrics
// (length, width, area, perimeter, aspect_ratio, building_type). This data
// feeds BIM-lite features and area calculations.


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

interface ExtractFloorOutlineRequest {
  drawing_id: string
  image_url: string
  extraction_mode?: 'outer_dimensions_only' | 'key_measurements_only'
}

interface Point {
  x: number
  y: number
}

interface GeminiOutlineResponse {
  polygon: Point[]
  image_width: number
  image_height: number
  scale_ratio?: number | null
  scale_text?: string | null
  notes?: string
}

const GEMINI_MODEL = 'gemini-2.5-flash'

const OUTLINE_PROMPT = `You are an AEC drawing analyzer. Identify the OUTER WALLS
(building footprint / envelope) of the floor plan in the image.

Return STRICT JSON only (no markdown fences):
{
  "image_width":  <int, in pixels>,
  "image_height": <int, in pixels>,
  "polygon": [ {"x": <int>, "y": <int>}, ... ],
  "scale_ratio": <float or null>,
  "scale_text": "<e.g. '1/8\\" = 1'-0\\"' or null>",
  "notes": "<short observation>"
}

Rules:
- Use PIXEL coordinates. Top-left is (0,0).
- Return the polygon as an ordered list of 4–24 vertices walking the outer
  wall perimeter clockwise.
- Ignore interior walls, dimension strings, title block, and annotations.
- If the outline is clearly rectangular, return exactly 4 points.
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

async function callGemini(
  apiKey: string,
  img: { data: string; mime: string },
): Promise<GeminiOutlineResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`

  const body = {
    contents: [
      {
        parts: [
          { text: OUTLINE_PROMPT },
          { inline_data: { mime_type: img.mime, data: img.data } },
        ],
      },
    ],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.1 },
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
  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  try {
    return JSON.parse(text) as GeminiOutlineResponse
  } catch {
    throw new HttpError(502, 'Gemini returned non-JSON response')
  }
}

function shoelaceArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

function polygonPerimeter(points: Point[]): number {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

function boundingBox(points: Point[]) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function classifyBuilding(points: Point[]): 'rectangular' | 'simple_polygon' | 'complex_shape' {
  if (points.length === 4) return 'rectangular'
  if (points.length <= 8) return 'simple_polygon'
  return 'complex_shape'
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ExtractFloorOutlineRequest>(req)
    const drawingId = requireUuid(body.drawing_id, 'drawing_id')

    const { data: drawing, error: fetchErr } = await supabase
      .from('drawings')
      .select('id, project_id')
      .eq('id', drawingId)
      .single()
    if (fetchErr || !drawing) throw new HttpError(404, `drawing ${drawingId} not found`)
    await verifyProjectMembership(supabase, user.id, drawing.project_id)

    const imageUrl = (body.image_url ?? '').trim()
    if (!/^https?:\/\//i.test(imageUrl)) {
      throw new HttpError(400, 'image_url must be http(s)')
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY')
    if (!geminiKey) throw new HttpError(500, 'GEMINI_API_KEY not configured')

    const img = await fetchImageAsBase64(imageUrl)
    const gemini = await callGemini(geminiKey, img)
    const polygon = Array.isArray(gemini.polygon) ? gemini.polygon : []

    const bbox = boundingBox(polygon)
    const areaPx = shoelaceArea(polygon)
    const perimeterPx = polygonPerimeter(polygon)

    const scale = typeof gemini.scale_ratio === 'number' ? gemini.scale_ratio : null
    const mode = body.extraction_mode ?? 'outer_dimensions_only'

    const realLength = scale ? bbox.width / scale : null
    const realWidth = scale ? bbox.height / scale : null
    const realArea = scale ? areaPx / (scale * scale) : null
    const realPerimeter = scale ? perimeterPx / scale : null

    const base = {
      drawing_id: drawingId,
      polygon,
      bounding_box: bbox,
      image_width: gemini.image_width,
      image_height: gemini.image_height,
      scale_ratio: scale,
      scale_text: gemini.scale_text ?? null,
      building_type: classifyBuilding(polygon),
      notes: gemini.notes ?? null,
    }

    const payload = mode === 'key_measurements_only'
      ? {
          ...base,
          overall_length_ft: realLength,
          overall_width_ft: realWidth,
          building_area_sqft: realArea,
          building_footprint_ratio:
            gemini.image_width && gemini.image_height
              ? areaPx / (gemini.image_width * gemini.image_height)
              : null,
        }
      : {
          ...base,
          length_px: bbox.width,
          width_px: bbox.height,
          area_px: areaPx,
          perimeter_px: perimeterPx,
          length_ft: realLength,
          width_ft: realWidth,
          area_sqft: realArea,
          perimeter_ft: realPerimeter,
          aspect_ratio: bbox.height > 0 ? bbox.width / bbox.height : null,
        }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
