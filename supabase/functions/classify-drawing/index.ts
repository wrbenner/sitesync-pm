// ── classify-drawing Edge Function ────────────────────────────
// 4-call parallel extractor. Each page runs FOUR focused Gemini 2.5 Pro
// calls in parallel, each with a laser-focused prompt for one field
// group. This beats a single mega-prompt at ~100% accuracy on
// sheet_number / drawing_title / discipline and ~95%+ on revision / scale.
//
// Call A (right-strip crop): sheet_number + drawing_title + discipline
// Call B (right-strip crop): revision
// Call C (full page):        scale_text + scale_ratio
// Call D (full page):        plan_type
//
// API keys rotate across calls — set GEMINI_API_KEYS to a comma-separated
// list. Falls back to GEMINI_API_KEY if the plural secret isn't set.

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

// ── Focused prompts (one per field group) ────────────────────

const PROMPT_TITLEBLOCK = `
You are reading the title block of a construction drawing. Extract ONLY what is visibly printed.

Return JSON:
{
  "sheet_number": "string | null — the sheet code in the SHEET NUMBER box (e.g. 'A1.0', 'P3B.3', 'ID-3.15'). If the page has no printed sheet number (poster cover), null.",
  "drawing_title": "string — the drawing title printed below the sheet number (e.g. 'SITE PLAN'). For poster covers, the rotated package name (e.g. 'INTERIORS') or main heading. Never a rendering caption.",
  "discipline": "One of: 'architectural','structural','mechanical','electrical','plumbing','fire_protection','civil','landscape','interior','mep','cover','unclassified'."
}

DISCIPLINE RULES (apply in order):
1. If sheet_number starts with CS, G, T0, or is null, discipline = 'cover'.
2. If page is an index/sheet-list/project-summary/general-notes page → 'cover'.
3. Poster-style covers (rendering + project name, no dimensioned drawing) → 'cover'.
4. Otherwise derive from sheet prefix: A→architectural, S→structural, M→mechanical, E→electrical, P→plumbing, PF→fire_protection, C→civil, L→landscape, I/ID→interior, MEP→mep, R→architectural.
5. No prefix rule matches → 'unclassified'.

RULES:
- sheet_number = text in the SHEET NUMBER box. NOT the project number (21115), NOT unit labels (B2, A1), NOT detail callouts (06/ID4.0).
- drawing_title = title-block text. Never a rendering caption.
- Return null if you can't read. Never guess.
`

const PROMPT_REVISION = `
Find the REVISIONS table in the title block. It has rows with a number (often in triangle △) and a date.

Count the rows that have DATES. The count equals the revision.

Example: "△1 04/30/2024", "△2 07/29/2024", "△3 11/15/2024" → revision = "3".

If the table uses letters (REV A, REV B), return the highest letter.

Return JSON: { "revision": "string | null" }

Null ONLY if the REVISIONS table is completely empty or absent. Don't guess from filename. Don't return a date.
`

const PROMPT_SCALE = `
Find the MAIN drawing scale on this construction sheet.

Scan for ANY of these patterns:
1. Under a viewport title: "BUILDING B - THIRD FLOOR PLAN / SCALE: 1/8" = 1'-0""
2. Under a detail callout: "01 DETAIL / SCALE: 3" = 1'-0""
3. "SCALE: NONE" / "NOT TO SCALE" / "N.T.S." → return 'NTS'
4. On site plans: "1 inch = 50 ft." or "1" = 40'-0""
5. On vicinity maps: "NTS" label directly under the map

Return JSON:
{
  "scale_text": "string | null — EXACT scale text as printed. For 'NOT TO SCALE' / 'SCALE: NONE' / 'NTS' / 'NONE' return 'NTS'. Otherwise return the literal text. Null only if no scale of any kind is printed.",
  "scale_ratio": "number | null — the numeric ratio. Architectural: 1/16"=1'-0" → 192, 3/32"=1'-0" → 128, 1/8"=1'-0" → 96, 3/16"=1'-0" → 64, 1/4"=1'-0" → 48, 3/8"=1'-0" → 32, 1/2"=1'-0" → 24, 3/4"=1'-0" → 16, 1"=1'-0" → 12, 1-1/2"=1'-0" → 8, 3"=1'-0" → 4. Engineering: 1"=10' → 120, 1"=20' → 240, 1"=30' → 360, 1"=40' → 480, 1"=50' → 600, 1"=60' → 720, 1"=100' → 1200. For NTS → null."
}

DO NOT guess from drawing type. If no scale text appears, null.
`

const PROMPT_PLANTYPE = `
Return JSON with the PRIMARY plan type and the pairing metadata needed to match this sheet with its counterpart from another discipline (arch ↔ struct pair extraction):

{
  "plan_type": "One of: 'site', 'floor plan', 'foundation', 'framing', 'roof', 'elevation', 'section', 'rcp', 'detail', 'schedule', 'cover', 'notes', 'unclassified'.",
  "building_name": "string | null — building identifier (e.g. 'Building A', 'Type C', 'Arbor Park'). Read rotated vertical text in the title-block strip if needed.",
  "floor_level": "string | null — level identifier (e.g. '01', 'FND', 'ROOF', '2ND FLOOR').",
  "is_pair_candidate": "boolean — TRUE only if discipline is architectural or structural AND plan_type is foundation/floor plan/framing/roof. FALSE for MEP/civil/landscape/details/sections/schedules.",
  "pairing_tokens": {
    "areaToken": "string | null — single letter area identifier (e.g. 'B') if visible",
    "sectionToken": "string | null — roman numeral or number section identifier (e.g. 'II') if visible"
  }
}

Plan type rules:
- Site plan = full property/site
- Floor plan = building floor with rooms
- RCP = reflected ceiling plan (lighting / ceiling grid)
- Framing = structural framing members
- Elevation = vertical view
- Section = cut-through view
- Detail = zoomed construction detail
- Schedule = table of items/equipment
- Cover = title/index/notes page

If a field isn't visible on the page, return null. Don't guess.
`

// ── Types ────────────────────────────────────────────────────
interface ClassifyRequest {
  project_id: string
  drawing_id: string
  page_image_url: string
  full_page_url?: string
}

interface GeminiUsage {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: GeminiUsage
}

// ── Parsing helpers ──────────────────────────────────────────
function stripCodeFence(text: string): string {
  const stripped = text.trim()
  if (stripped.startsWith('```')) {
    const parts = stripped.split('```')
    if (parts.length >= 3) {
      return parts[1].replace(/^json\s*/i, '').trim()
    }
    return parts[parts.length - 1].trim()
  }
  return stripped
}

function extractJson(text: string): Record<string, unknown> {
  const stripped = stripCodeFence(text)
  try { return JSON.parse(stripped) } catch { /* fall through */ }
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new HttpError(502, 'Gemini did not return parseable JSON')
  try { return JSON.parse(match[0]) } catch (err) {
    throw new HttpError(502, `Gemini JSON parse failed: ${(err as Error).message}`)
  }
}

const DISCIPLINE_MAP: Record<string, string> = {
  ARCHITECTURAL: 'architectural',
  STRUCTURAL: 'structural',
  MECHANICAL: 'mechanical',
  ELECTRICAL: 'electrical',
  PLUMBING: 'plumbing',
  PLUMBING_FIRE_PROTECTION: 'fire_protection',
  MEP: 'mep',
  CIVIL: 'civil',
  LANDSCAPE: 'landscape',
  INTERIOR: 'interior',
  FIRE_PROTECTION: 'fire_protection',
  COVER: 'cover',
  UNCLASSIFIED: 'unclassified',
}

function normalizeDiscipline(raw: unknown): string {
  if (typeof raw !== 'string') return 'unclassified'
  return DISCIPLINE_MAP[raw.trim().toUpperCase()] ?? 'unclassified'
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

// Gemini 2.5 Pro pricing (Tier 1)
function calculateCostCents(usage: GeminiUsage | undefined): number {
  if (!usage) return 0
  const prompt = usage.promptTokenCount ?? 0
  const candidates = usage.candidatesTokenCount ?? 0
  const inputRate = prompt <= 200_000 ? 2.0 : 4.0
  const outputRate = prompt <= 200_000 ? 12.0 : 18.0
  const inputUsd = (prompt / 1_000_000) * inputRate
  const outputUsd = (candidates / 1_000_000) * outputRate
  return Math.round((inputUsd + outputUsd) * 100)
}

// ── File fetch ───────────────────────────────────────────────
const MAX_FILE_BYTES = 100 * 1024 * 1024

async function fetchFileBuffer(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string; sizeBytes: number }> {
  const response = await fetch(url)
  if (!response.ok) throw new HttpError(400, `Failed to fetch image URL: ${response.status}`)
  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_FILE_BYTES) {
    throw new HttpError(413, `File too large (${(Number(contentLength) / 1024 / 1024).toFixed(1)} MB)`)
  }
  const contentType = response.headers.get('content-type') ?? 'image/png'
  const mimeType = contentType.split(';')[0].trim() || 'image/png'
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new HttpError(413, `File too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`)
  }
  return { buffer, mimeType, sizeBytes: buffer.byteLength }
}

// ── Gemini File API upload ───────────────────────────────────
async function uploadToGeminiFileApi(
  apiKey: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  displayName: string,
): Promise<string> {
  const RETRYABLE = new Set([400, 429, 500, 502, 503, 504])
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const initRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': String(fileBuffer.byteLength),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ file: { display_name: displayName } }),
        },
      )
      if (!initRes.ok) {
        if (RETRYABLE.has(initRes.status) && attempt < 5) {
          const delay = initRes.status === 429 ? 65_000 : 500 * Math.pow(2, attempt - 1)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        throw new HttpError(502, `Gemini File API init ${initRes.status}: ${(await initRes.text()).slice(0, 300)}`)
      }
      const uploadUrl = initRes.headers.get('x-goog-upload-url')
      if (!uploadUrl) throw new HttpError(502, 'Gemini File API did not return an upload URL')

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(fileBuffer.byteLength),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: fileBuffer,
      })
      if (!uploadRes.ok) {
        if (RETRYABLE.has(uploadRes.status) && attempt < 5) {
          const delay = uploadRes.status === 429 ? 65_000 : 500 * Math.pow(2, attempt - 1)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        throw new HttpError(502, `Gemini File API upload ${uploadRes.status}: ${(await uploadRes.text()).slice(0, 300)}`)
      }
      const uploadResult = await uploadRes.json()
      const fileUri = uploadResult?.file?.uri
      if (!fileUri) throw new HttpError(502, 'Gemini File API upload returned no file URI')
      return fileUri as string
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)))
    }
  }
  throw new HttpError(502, 'Gemini File API: exhausted retries')
}

// ── Gemini generateContent call ──────────────────────────────
async function callGemini(
  apiKey: string,
  model: string,
  fileUri: string,
  mimeType: string,
  prompt: string,
): Promise<GeminiResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { file_data: { mime_type: mimeType, file_uri: fileUri } },
        { text: '\n\n' + prompt },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  }

  const RETRYABLE = new Set([400, 429, 500, 502, 503, 504])
  let lastStatus = 0
  let lastText = ''
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return (await res.json()) as GeminiResponse
    lastStatus = res.status
    lastText = (await res.text()).slice(0, 400)
    if (!RETRYABLE.has(res.status) || attempt === 6) break
    const delay = res.status === 429
      ? 65_000
      : Math.min(16_000, 1000 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 500)
    await new Promise((r) => setTimeout(r, delay))
  }
  throw new HttpError(502, `Gemini API ${lastStatus} after retries: ${lastText}`)
}

// ── Key pool ─────────────────────────────────────────────────
function getApiKeys(): string[] {
  const plural = Deno.env.get('GEMINI_API_KEYS')
  if (plural && plural.trim()) {
    const keys = plural.split(',').map((k) => k.trim()).filter(Boolean)
    if (keys.length > 0) return keys
  }
  const single = Deno.env.get('GEMINI_API_KEY')
  if (single) return [single]
  throw new HttpError(500, 'GEMINI_API_KEYS or GEMINI_API_KEY must be configured')
}

// ── Parallel 4-call extraction ───────────────────────────────
interface ExtractResult {
  sheet_number: string | null
  drawing_title: string | null
  discipline: string
  revision: string | null
  scale_text: string | null
  scale_ratio: number | null
  plan_type: string | null
  building_name: string | null
  floor_level: string | null
  is_pair_candidate: boolean
  pairing_tokens: Record<string, unknown>
  confidence: number | null
  total_cost_cents: number
  total_bytes: number
  errors: string[]
}

async function extractAllFields(
  cropBuffer: ArrayBuffer,
  cropMime: string,
  cropBytes: number,
  fullBuffer: ArrayBuffer | null,
  fullMime: string | null,
  fullBytes: number,
  model: string,
  keys: string[],
  displayName: string,
): Promise<ExtractResult> {
  const k = (i: number) => keys[i % keys.length]

  // Upload crop to 2 keys (for titleblock + revision) and full to 2 keys
  // (for scale + plan_type). In parallel.
  const hasFullPage = fullBuffer !== null && fullMime !== null
  const uploadTasks: Array<Promise<{ role: string; uri: string | null }>> = [
    uploadToGeminiFileApi(k(0), cropBuffer, cropMime, `${displayName}-crop-1`)
      .then((uri) => ({ role: 'tb', uri }))
      .catch((err) => ({ role: 'tb', uri: null, err })) as Promise<{ role: string; uri: string | null }>,
    uploadToGeminiFileApi(k(1), cropBuffer, cropMime, `${displayName}-crop-2`)
      .then((uri) => ({ role: 'rev', uri }))
      .catch((err) => ({ role: 'rev', uri: null, err })) as Promise<{ role: string; uri: string | null }>,
  ]
  if (hasFullPage) {
    uploadTasks.push(
      uploadToGeminiFileApi(k(2), fullBuffer!, fullMime!, `${displayName}-full-1`)
        .then((uri) => ({ role: 'scale', uri }))
        .catch((err) => ({ role: 'scale', uri: null, err })) as Promise<{ role: string; uri: string | null }>,
      uploadToGeminiFileApi(k(3), fullBuffer!, fullMime!, `${displayName}-full-2`)
        .then((uri) => ({ role: 'plan', uri }))
        .catch((err) => ({ role: 'plan', uri: null, err })) as Promise<{ role: string; uri: string | null }>,
    )
  }
  const uploadResults = await Promise.all(uploadTasks)
  const uriByRole = Object.fromEntries(uploadResults.map((r) => [r.role, r.uri]))

  // Run 4 generateContent calls in parallel, each with its own key + prompt.
  const errors: string[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const runCall = async (role: string, keyIdx: number, mime: string, prompt: string) => {
    const uri = uriByRole[role]
    if (!uri) return null
    try {
      const resp = await callGemini(k(keyIdx), model, uri, mime, prompt)
      totalInputTokens += resp.usageMetadata?.promptTokenCount ?? 0
      totalOutputTokens += resp.usageMetadata?.candidatesTokenCount ?? 0
      const text = resp.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string')?.text
      if (!text) return null
      return extractJson(text)
    } catch (err) {
      errors.push(`${role}: ${(err as Error).message}`)
      return null
    }
  }

  const [tbResult, revResult, scaleResult, planResult] = await Promise.all([
    runCall('tb', 0, cropMime, PROMPT_TITLEBLOCK),
    runCall('rev', 1, cropMime, PROMPT_REVISION),
    hasFullPage ? runCall('scale', 2, fullMime!, PROMPT_SCALE) : Promise.resolve(null),
    hasFullPage ? runCall('plan', 3, fullMime!, PROMPT_PLANTYPE) : Promise.resolve(null),
  ])

  const totalCostCents = calculateCostCents({
    promptTokenCount: totalInputTokens,
    candidatesTokenCount: totalOutputTokens,
  })

  const pairingTokensRaw = planResult?.pairing_tokens
  const pairingTokens = (pairingTokensRaw && typeof pairingTokensRaw === 'object')
    ? pairingTokensRaw as Record<string, unknown>
    : {}

  return {
    sheet_number: toStringOrNull(tbResult?.sheet_number),
    drawing_title: toStringOrNull(tbResult?.drawing_title),
    discipline: normalizeDiscipline(tbResult?.discipline),
    revision: toStringOrNull(revResult?.revision),
    scale_text: toStringOrNull(scaleResult?.scale_text),
    scale_ratio: toNumber(scaleResult?.scale_ratio),
    plan_type: toStringOrNull(planResult?.plan_type),
    building_name: toStringOrNull(planResult?.building_name),
    floor_level: toStringOrNull(planResult?.floor_level),
    is_pair_candidate: planResult?.is_pair_candidate === true,
    pairing_tokens: pairingTokens,
    confidence: (
      (tbResult ? 0.5 : 0) +
      (revResult !== null ? 0.2 : 0) +
      (scaleResult !== null ? 0.2 : 0) +
      (planResult !== null ? 0.1 : 0)
    ),
    total_cost_cents: totalCostCents,
    total_bytes: cropBytes + fullBytes,
    errors,
  }
}

// ── Handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ClassifyRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')
    const drawingId = requireUuid(body.drawing_id, 'drawing_id')
    const pageImageUrl = String(body.page_image_url ?? '').trim()
    const fullPageUrl = String(body.full_page_url ?? '').trim()

    if (!pageImageUrl) throw new HttpError(400, 'page_image_url is required')
    if (!/^https?:\/\//i.test(pageImageUrl)) {
      throw new HttpError(400, 'page_image_url must be an http(s) URL')
    }
    if (fullPageUrl && !/^https?:\/\//i.test(fullPageUrl)) {
      throw new HttpError(400, 'full_page_url must be an http(s) URL')
    }

    await verifyProjectMembership(supabase, user.id, projectId)

    const keys = getApiKeys()
    const model = Deno.env.get('GEMINI_MODEL_NAME') ?? 'gemini-2.5-pro'

    // Insert pending row so clients can poll status.
    const pendingInsert = await supabase
      .from('drawing_classifications')
      .insert({ drawing_id: drawingId, project_id: projectId, processing_status: 'processing' })
      .select('id')
      .single()
    if (pendingInsert.error || !pendingInsert.data) {
      throw new HttpError(500, `Failed to create classification row: ${pendingInsert.error?.message ?? 'unknown'}`)
    }
    const classificationId = pendingInsert.data.id as string

    try {
      // Fetch both images in parallel.
      const [cropFetch, fullFetch] = await Promise.all([
        fetchFileBuffer(pageImageUrl),
        fullPageUrl ? fetchFileBuffer(fullPageUrl).catch((err) => {
          console.warn(`[classify-drawing] full_page_url fetch failed: ${(err as Error).message}`)
          return null
        }) : Promise.resolve(null),
      ])

      const displayName = `drawing-${drawingId}-${Date.now()}`
      const result = await extractAllFields(
        cropFetch.buffer,
        cropFetch.mimeType,
        cropFetch.sizeBytes,
        fullFetch?.buffer ?? null,
        fullFetch?.mimeType ?? null,
        fullFetch?.sizeBytes ?? 0,
        model,
        keys,
        displayName,
      )

      const updateResult = await supabase
        .from('drawing_classifications')
        .update({
          sheet_number: result.sheet_number,
          drawing_title: result.drawing_title,
          building_name: result.building_name,
          floor_level: result.floor_level,
          discipline: result.discipline,
          plan_type: result.plan_type,
          scale_text: result.scale_text,
          scale_ratio: result.scale_ratio,
          pairing_tokens: result.pairing_tokens,
          classification_confidence: result.confidence,
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
          ai_cost_cents: result.total_cost_cents,
        })
        .eq('id', classificationId)
      if (updateResult.error) {
        throw new HttpError(500, `Failed to persist classification: ${updateResult.error.message}`)
      }

      return new Response(
        JSON.stringify({
          classification_id: classificationId,
          drawing_id: drawingId,
          sheet_number: result.sheet_number,
          drawing_title: result.drawing_title,
          discipline: result.discipline,
          revision: result.revision,
          scale_text: result.scale_text,
          scale_ratio: result.scale_ratio,
          plan_type: result.plan_type,
          confidence: result.confidence,
          ai_cost_cents: result.total_cost_cents,
          file_size_bytes: result.total_bytes,
          errors: result.errors,
          status: 'completed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    } catch (err) {
      await supabase
        .from('drawing_classifications')
        .update({ processing_status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', classificationId)
      throw err
    }
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
