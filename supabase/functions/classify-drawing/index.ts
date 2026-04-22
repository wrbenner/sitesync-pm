// ── classify-drawing Edge Function ────────────────────────────
// Phase 2, Module 3: Sends a drawing page image to Gemini 2.5 Pro,
// parses the structured JSON response, and persists it in
// drawing_classifications. Prompt copied EXACTLY from the production
// plan-classification-v2 microservice (combined_processor.py MASTER_PROMPT).

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

// ── Gemini prompt (copied EXACTLY from combined_processor.py) ─
// DO NOT modify — production battle-tested.
const MASTER_PROMPT = `
You are an expert AEC drawing analyzer. Perform a deep multi-pass analysis.

Return a SINGLE JSON object containing a 'designDescription' object, a 'viewportDetails'
object, and 'pairingTokens'.

{
  "designDescription": {
    "sheetNumber": "Main sheet ID (e.g. S211B). Check all corners.",
    "drawingTitle": "The exact title in the title block (e.g. 'FOUNDATION PLAN AREA B').",
    "projectName": "The specific name of the project.",
    "projectAddress": "The site address found immediately below the Project Name.",
    "buildingName": "Building identifier (e.g. 'Arbor Park'). Check vertical text.",
    "buildingType": "Infer type (e.g. 'Housing', 'Commercial', 'School', 'Mixed-Use').",
    "buildingBlock": "Full zoning string (e.g. 'Area B', 'Wing C').",
    "floorLevel": "Standardized level ID (e.g. '01', 'FND', 'ROOF').",
    "levelNumber": "Integer (Basement=-1, FND=0, 1st=1, 2nd=2).",
    "discipline": "Strictly: 'ARCHITECTURAL', 'STRUCTURAL', 'MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'PLUMBING_FIRE_PROTECTION', 'CIVIL', 'LANDSCAPE', 'INTERIOR', 'MEP', or 'UNCLASSIFIED'.",
    "planType": "Strictly: 'FOUNDATION', 'FLOOR PLAN', 'FRAMING', 'ROOF', 'ELEVATION', 'DETAIL', 'SCHEDULE', 'SITE', 'RCP', 'SHEARWALL'.",
    "hasDimensions": true/false,
    "planTypeConfidence": 0.0 to 1.0,
    "levelConfidence": 0.0 to 1.0,
    "notes": "Brief summary of observations.",
    "scaleText": "The EXACT string found (e.g. '1/8\\" = 1'-0\\"'). If ambiguous/blurry, return null.",
    "scaleRatio": "Float value (e.g. 96.0). Return null if text is not clearly readable."
  },
  "classification_features": {
      "detected_pattern": "Extract the prefix letter code (e.g. 'A', 'S', 'M', 'E', 'P', 'C', 'L', 'I').",
      "discipline": "Strictly choose one: 'ARCHITECTURAL', 'STRUCTURAL', 'MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'PLUMBING_FIRE_PROTECTION', 'CIVIL', 'LANDSCAPE', 'INTERIOR', 'FIRE_PROTECTION', 'MEP', or 'UNCLASSIFIED'. Based on sheet prefix (A, S, M, E, P, PF, C, L, I, F, MEP).",
      "is_pair_candidate": true/false (Set TRUE only if discipline is ARCHITECTURAL or STRUCTURAL and plan_type is FOUNDATION/FLOOR/FRAMING/ROOF. Set FALSE for MEP/CIVIL/LANDSCAPE or DETAILS/SECTIONS/SCHEDULES/SHEARWALL.)
    },
  "viewportDetails": {
    "hasMultipleDesigns": true/false,
    "designBlocks": [
      {
        "title": "Title of this view",
        "scale": "Scale of this view",
        "floorId": "Floor ID (e.g. 01)"
      }
    ]
  },
  "pairingTokens": {
     "areaToken": "Letter only (e.g. 'B') if found.",
     "sectionToken": "Roman/Number only (e.g. 'II') if found."
  }
}

INSTRUCTIONS:
1.**Address Logic (CRITICAL):**
   - Look for the 'Project Name' first.
   - The 'project_address' is the text block **immediately below** or **around** the Project Name.
   - **EXCLUDE** addresses found near the Architect's logo, Engineer's logo, or top-left corners. Only extract the SITE address.
2. **Vertical Text:** You must read text rotated 90 degrees on the borders for 'building_name' or 'client'.
3.  **MULTIPLE DESIGNS LOGIC (CRITICAL):**
   - **Set 'has_multiple_designs': true ONLY if:** The sheet contains **two or more MAJOR** diagrams of comparable size (e.g. a Split Sheet with Floor 2 on top and Floor 3 on bottom).
   - **Set 'has_multiple_designs': false if:** The sheet contains one main diagram surrounded by small details, legends, key plans, or notes. Treat these as a SINGLE design.
   - **Design Blocks:** If 'has_multiple_designs' is true, capture the Title/Scale/Floor for each MAJOR diagram. If false, capture only the main one.
4. **Design Blocks:** Create one entry in "design_blocks" for EVERY major drawing on the sheet.
5. **Spatial Matching:** Ensure the Scale and Title you extract in "design_blocks" are visually close to each other on the page.
6. **Vertical Text:** Read text rotated 90 degrees on borders for 'building_name'.
7.CLASSIFICATION RULES:
- Map sheet prefixes to Disciplines strictly:
  * A### -> ARCHITECTURAL
  * S### -> STRUCTURAL
  * M### -> MECHANICAL
  * E### -> ELECTRICAL
  * PF### -> PLUMBING_FIRE_PROTECTION
  * P### -> PLUMBING
  * C### -> CIVIL
  * L### -> LANDSCAPE
  * I### or ID### -> INTERIOR
  * F### or FP### -> FIRE_PROTECTION
  * MEP### -> MEP
- If the sheet number does not fit these standard prefixes, mark discipline as 'UNCLASSIFIED'.
8.**SCALE EXTRACTION RULES (STRICT):**
   - **Target:** Find the MAIN/GENERAL scale. Prioritize the text under the Main Viewport Title over the Title Block box if they differ.
   - **Math Check:**
     * 1/4" = 1'-0" -> Ratio: 48.0
     * 1/8" = 1'-0" -> Ratio: 96.0
     * 1/16" = 1'-0" -> Ratio: 192.0
     * 3/32" = 1'-0" -> Ratio: 128.0
     * 1" = 20' -> Ratio: 240.0
   - **Anti-Hallucination:** Do not guess based on drawing type. If the text is pixelated or unreadable, return NULL.
   - **Ignore:** Parking area scales, Enlarged plan scales, Detail scales. Only grab the scale for the full building plan.
9. **hasDimensions Rules (STRICT GEOMETRY CHECK):**
   - **True Condition:** Set "hasDimensions": true ONLY if you detect **"Dimension Strings"**.
     * Visual Cue: Look for long, continuous lines running parallel to the exterior walls, distinct from the building outline.
     * Visual Cue: These lines must be interrupted by tick marks, arrows, or dots.
     * Syntax Cue: The text MUST define lengths/distances (e.g., 164'-2 1/2", 11'-4").
   - **False Condition (The "Framing Plan" Trap):** Set "hasDimensions": false if the numbers are primarily:
     * Material sizes (e.g., "2x4", "8x12", "W12x14").
     * Spacing instructions (e.g., "@ 24\\" O.C.", "SIM").
     * Reference tags inside shapes (e.g., numbers inside hexagons or circles).
     * Grid line labels (e.g., bubbles with 1, 2, A, B).
   - **Logic:** If you see numbers describing WHAT the object is made of (wood, steel), but NO lines measuring HOW LONG the walls are, return "false".

`

// ── Types ────────────────────────────────────────────────────
interface ClassifyRequest {
  project_id: string
  drawing_id: string
  page_image_url: string
}

interface GeminiUsage {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  usageMetadata?: GeminiUsage
}

// ── Response-parsing helpers (from pair_extractor.py pattern) ─
function stripCodeFence(text: string): string {
  const stripped = text.trim()
  if (stripped.startsWith('```')) {
    const parts = stripped.split('```')
    if (parts.length >= 3) {
      const candidate = parts[1].replace(/^json\s*/i, '').trim()
      return candidate
    }
    return parts[parts.length - 1].trim()
  }
  return stripped
}

function extractJson(text: string): Record<string, unknown> {
  // First try: stripped code fence.
  const stripped = stripCodeFence(text)
  try {
    return JSON.parse(stripped)
  } catch { /* fall through to regex */ }

  // Regex fallback — find the first balanced JSON object.
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new HttpError(502, 'Gemini did not return parseable JSON')
  }
  try {
    return JSON.parse(match[0])
  } catch (err) {
    throw new HttpError(502, `Gemini JSON parse failed: ${(err as Error).message}`)
  }
}

// ── Discipline mapping (microservice -> DB enum) ──────────────
const DISCIPLINE_MAP: Record<string, string> = {
  ARCHITECTURAL: 'architectural',
  STRUCTURAL: 'structural',
  MECHANICAL: 'mechanical',
  ELECTRICAL: 'electrical',
  PLUMBING: 'plumbing',
  PLUMBING_FIRE_PROTECTION: 'plumbing',
  MEP: 'mep',
  CIVIL: 'civil',
  LANDSCAPE: 'civil',
  INTERIOR: 'interior_design',
  FIRE_PROTECTION: 'mep',
  UNCLASSIFIED: 'unclassified',
}

function normalizeDiscipline(raw: unknown): string {
  if (typeof raw !== 'string') return 'unclassified'
  const key = raw.trim().toUpperCase()
  return DISCIPLINE_MAP[key] ?? 'unclassified'
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

// ── Cost calculation (Gemini 2.5 Pro tier pricing) ────────────
function calculateCostCents(usage: GeminiUsage | undefined): number {
  if (!usage) return 0
  const prompt = usage.promptTokenCount ?? 0
  const candidates = usage.candidatesTokenCount ?? 0
  const inputRate = prompt <= 200_000 ? 2.0 : 4.0   // USD per 1M tokens
  const outputRate = prompt <= 200_000 ? 12.0 : 18.0
  const inputUsd = (prompt / 1_000_000) * inputRate
  const outputUsd = (candidates / 1_000_000) * outputRate
  return Math.round((inputUsd + outputUsd) * 100)
}

// ── File fetch helper ───────────────────────────────────────

// Edge function memory cap is ~150 MB. We allow files up to 100 MB
// (construction drawing PDFs are commonly 20-80 MB). The Gemini File
// API accepts up to 2 GB, so file size is no longer the bottleneck.
const MAX_FILE_BYTES = 100 * 1024 * 1024

async function fetchFileBuffer(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string; sizeBytes: number }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new HttpError(400, `Failed to fetch page_image_url: ${response.status}`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_FILE_BYTES) {
    throw new HttpError(
      413,
      `File too large (${(Number(contentLength) / 1024 / 1024).toFixed(1)} MB). ` +
      `Maximum is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    )
  }

  const contentType = response.headers.get('content-type') ?? 'image/png'
  const mimeType = contentType.split(';')[0].trim() || 'image/png'
  const buffer = await response.arrayBuffer()

  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new HttpError(
      413,
      `File too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). ` +
      `Maximum is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    )
  }

  return { buffer, mimeType, sizeBytes: buffer.byteLength }
}

// ── Gemini File Upload API ──────────────────────────────────
// Mirrors the production pattern from combined_processor.py:
//   1. Upload file to Gemini via File API (supports up to 2 GB)
//   2. Reference the uploaded file URI in generateContent
// This eliminates the base64 inline_data 20 MB limit entirely.

async function uploadToGeminiFileApi(
  apiKey: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  displayName: string,
): Promise<string> {
  // Step 1: Initiate resumable upload to get an upload URI
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
    const text = await initRes.text()
    throw new HttpError(502, `Gemini File API init failed (${initRes.status}): ${text.slice(0, 300)}`)
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url')
  if (!uploadUrl) {
    throw new HttpError(502, 'Gemini File API did not return an upload URL')
  }

  // Step 2: Upload the actual bytes
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
    const text = await uploadRes.text()
    throw new HttpError(502, `Gemini File API upload failed (${uploadRes.status}): ${text.slice(0, 300)}`)
  }

  const uploadResult = await uploadRes.json()
  const fileUri = uploadResult?.file?.uri
  if (!fileUri) {
    throw new HttpError(502, 'Gemini File API upload succeeded but returned no file URI')
  }

  return fileUri as string
}

// ── Gemini generateContent call ─────────────────────────────
// Uses file_data (File API reference) instead of inline_data (base64).
// This is the same pattern as the production microservice.

async function callGemini(
  apiKey: string,
  model: string,
  fileUri: string,
  mimeType: string,
): Promise<GeminiResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { file_data: { mime_type: mimeType, file_uri: fileUri } },
          { text: '\n\n' + MASTER_PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
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
    throw new HttpError(502, `Gemini API error ${res.status}: ${text.slice(0, 400)}`)
  }
  return (await res.json()) as GeminiResponse
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

    if (!pageImageUrl) {
      throw new HttpError(400, 'page_image_url is required')
    }
    if (!/^https?:\/\//i.test(pageImageUrl)) {
      throw new HttpError(400, 'page_image_url must be an http(s) URL')
    }

    await verifyProjectMembership(supabase, user.id, projectId)

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new HttpError(500, 'GEMINI_API_KEY not configured')
    }
    const model = Deno.env.get('GEMINI_MODEL_NAME') ?? 'gemini-2.5-pro'

    // Insert a pending row so clients can poll status.
    const pendingInsert = await supabase
      .from('drawing_classifications')
      .insert({
        drawing_id: drawingId,
        project_id: projectId,
        processing_status: 'processing',
      })
      .select('id')
      .single()

    if (pendingInsert.error || !pendingInsert.data) {
      throw new HttpError(500, `Failed to create classification row: ${pendingInsert.error?.message ?? 'unknown'}`)
    }
    const classificationId = pendingInsert.data.id as string

    try {
      // Production pattern (from combined_processor.py):
      // 1. Download file bytes
      // 2. Upload to Gemini File API (no size limit)
      // 3. Reference file URI in generateContent
      const { buffer, mimeType, sizeBytes } = await fetchFileBuffer(pageImageUrl)
      const displayName = `drawing-${drawingId}-${Date.now()}`
      const fileUri = await uploadToGeminiFileApi(geminiKey, buffer, mimeType, displayName)
      const gemini = await callGemini(geminiKey, model, fileUri, mimeType)

      const textPart = gemini.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string')?.text
      if (!textPart) {
        throw new HttpError(502, 'Gemini response missing text payload')
      }

      const parsed = extractJson(textPart)
      const design = (parsed.designDescription ?? parsed.design_description ?? {}) as Record<string, unknown>
      const features = (parsed.classification_features ?? parsed.classificationFeatures ?? {}) as Record<string, unknown>
      const viewport = (parsed.viewportDetails ?? parsed.viewport_details ?? {}) as Record<string, unknown>
      const pairing = (parsed.pairingTokens ?? parsed.pairing_tokens ?? {}) as Record<string, unknown>

      const disciplineRaw = features.discipline ?? design.discipline
      const discipline = normalizeDiscipline(disciplineRaw)

      const planType = typeof design.planType === 'string'
        ? (design.planType as string).toLowerCase()
        : null

      const confidence = toNumber(design.planTypeConfidence)
      const scaleRatio = toNumber(design.scaleRatio)
      const scaleText = typeof design.scaleText === 'string' ? (design.scaleText as string) : null
      const sheetNumber = typeof design.sheetNumber === 'string' ? (design.sheetNumber as string) : null
      const drawingTitle = typeof design.drawingTitle === 'string' ? (design.drawingTitle as string) : null
      const buildingName = typeof design.buildingName === 'string' ? (design.buildingName as string) : null
      const floorLevel = typeof design.floorLevel === 'string' ? (design.floorLevel as string) : null

      const costCents = calculateCostCents(gemini.usageMetadata)

      const updateResult = await supabase
        .from('drawing_classifications')
        .update({
          sheet_number: sheetNumber,
          drawing_title: drawingTitle,
          building_name: buildingName,
          floor_level: floorLevel,
          discipline,
          plan_type: planType,
          scale_text: scaleText,
          scale_ratio: scaleRatio,
          design_description: design,
          viewport_details: viewport,
          pairing_tokens: pairing,
          classification_confidence: confidence,
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
          ai_cost_cents: costCents,
        })
        .eq('id', classificationId)

      if (updateResult.error) {
        throw new HttpError(500, `Failed to persist classification: ${updateResult.error.message}`)
      }

      return new Response(
        JSON.stringify({
          classification_id: classificationId,
          drawing_id: drawingId,
          discipline,
          plan_type: planType,
          sheet_number: sheetNumber,
          drawing_title: drawingTitle,
          scale_text: scaleText,
          scale_ratio: scaleRatio,
          confidence,
          ai_cost_cents: costCents,
          file_size_bytes: sizeBytes,
          status: 'completed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    } catch (err) {
      // Mark row as failed so UI can show retry.
      await supabase
        .from('drawing_classifications')
        .update({
          processing_status: 'failed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', classificationId)
      throw err
    }
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
