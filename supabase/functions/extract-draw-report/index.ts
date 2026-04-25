// ── extract-draw-report Edge Function ─────────────────────────
// Vision-based structured extraction from AIA G702/G703 draw reports
// (monthly progress billing, pay applications). Supports PDF via Gemini
// vision, or flattened xlsx text via Gemini text.
//
// Input:  {
//   project_id: uuid,
//   user_token: string,        // session access token in body (not header)
//   pdf_base64?: string,       // full PDF bytes as base64
//   xlsx_text?: string,        // client-flattened xlsx rows joined to text
//   filename?: string,
// }
//
// Output: {
//   ok: true,
//   extraction: {
//     application_number?: number,
//     period_from?: string,    // YYYY-MM-DD
//     period_to?: string,      // YYYY-MM-DD
//     contract_sum?: number,
//     contractor_name?: string,
//     project_name?: string,
//     totals?: {
//       total_completed_and_stored?: number,
//       retainage?: number,
//       total_earned_less_retainage?: number,
//       less_previous_certificates?: number,
//       current_payment_due?: number,
//       balance_to_finish?: number,
//     },
//     line_items: Array<{
//       item_number: string,
//       cost_code: string,
//       description: string,
//       scheduled_value: number,
//       previous_completed: number,
//       this_period: number,
//       materials_stored: number,
//       percent_complete: number,       // 0..100
//       retainage: number,
//       balance_to_finish: number,
//       confidence: number,             // 0..1 per-row extraction confidence
//     }>,
//     warnings: string[],
//   },
//   raw_text: string,          // full LLM output, preserved for audit
//   model: string,             // which model produced the extraction
// }
//
// Auth follows the extract-schedule-pdf pattern: raw HTTP to GoTrue +
// PostgREST (bypasses supabase-js ES256 parsing bug). Token lives in the
// body as `user_token`, not the Authorization header.

// ── CORS ──────────────────────────────────────────────────────

const ALLOWED_PRODUCTION_ORIGINS = new Set([
  'https://sitesync.ai',
  'https://app.sitesync.ai',
])

/**
 * Accept any localhost / 127.0.0.1 origin during development — Vite
 * auto-picks a free port (5173, 5174, 5175, ...) when the primary is
 * busy, and hardcoding specific ports causes mysterious CORS failures
 * that waste hours. In production, stick to the explicit allowlist.
 */
function isDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed =
    ALLOWED_PRODUCTION_ORIGINS.has(origin) || isDevOrigin(origin)
      ? origin
      : 'https://app.sitesync.ai'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// ── Error helper ──────────────────────────────────────────────

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

function errorResponse(err: unknown, extra: Record<string, string>): Response {
  const status = err instanceof HttpError ? err.status : 500
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error(`[extract-draw-report] error ${status}: ${message}`)
  return new Response(
    JSON.stringify({ error: { message, status } }),
    { status, headers: { 'Content-Type': 'application/json', ...extra } },
  )
}

// ── Types ─────────────────────────────────────────────────────

interface ExtractRequest {
  project_id?: string
  user_token?: string
  /**
   * Fast path: plain text extracted from the PDF's text layer via pdf.js
   * client-side. When present, we skip vision entirely and send text to
   * Gemini (3-8s vs 15-30s vision). For digital PDFs this is always the
   * right choice; for scans/image-only PDFs this is empty and we fall
   * through to pdf_url.
   */
  pdf_text?: string
  /** Vision fallback: signed URL to the uploaded PDF in Supabase Storage. */
  pdf_url?: string
  /** Tiny-PDF fallback. Bodies over ~6 MB get rejected by the gateway. */
  pdf_base64?: string
  xlsx_text?: string
  filename?: string
}

interface ExtractedLineItem {
  item_number: string
  cost_code: string
  description: string
  /**
   * Inferred CSI MasterFormat division from the description (2-digit
   * string like "03" = Concrete, "26" = Electrical). Lets us match draw
   * line items against budget rows (budget_line_items.csi_code) even
   * when the GC uses internal cost codes like 5010, 7010.
   */
  csi_division: string
  scheduled_value: number
  previous_completed: number
  this_period: number
  materials_stored: number
  percent_complete: number
  retainage: number
  balance_to_finish: number
  confidence: number
  /**
   * Gemini labels each row so we can filter out division subtotals and
   * section headers server-side. Only "detail" rows become line items.
   */
  row_type?: 'detail' | 'subtotal' | 'section_header'
}

interface Reconciliation {
  sum_of_lines: number
  stated_contract_sum: number
  deviation_dollars: number
  deviation_pct: number
  reconciled: boolean
  dropped_subtotal_count: number
}

interface Extraction {
  application_number?: number
  period_from?: string
  period_to?: string
  contract_sum?: number
  contractor_name?: string
  project_name?: string
  totals?: {
    total_completed_and_stored?: number
    retainage?: number
    total_earned_less_retainage?: number
    less_previous_certificates?: number
    current_payment_due?: number
    balance_to_finish?: number
  }
  line_items: ExtractedLineItem[]
  warnings: string[]
  reconciliation: Reconciliation
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
}

// ── Extraction prompt ────────────────────────────────────────

const EXTRACTION_PROMPT = `
You are an expert construction accounts payable analyst. The input is a
construction monthly draw report (AIA G702/G703, HUD 221(d)(4) / 232 /
202 continuation sheet, Textura, GCPay, or a GC-custom progress billing).
Extract EVERY schedule-of-values line item as structured JSON.

═══ COLUMN MAP ═══
Standard G703 columns:
  A. Item Number
  B. Description of Work
  C. Scheduled Value
  D. Previous Applications / Work Completed From Previous Application
  E. This Period / Work Completed This Period
  F. Materials Presently Stored
  G. Total Completed and Stored to Date (= D + E + F)
  H. % (G ÷ C)
  I. Balance to Finish (= C - G)
  J. Retainage

HUD 221(d)(4) and GC variants insert extra columns. Watch for:
  - "Approved Changes" + "Revised Contract Amount" between C and D.
    → For normal trade-line rows, use "Revised Contract Amount" as
      scheduled_value when present (it reflects scheduled value after
      approved COs). If Revised is blank, use the Scheduled Value column.
    → For CHANGE ORDER rows (section after Total Contract / in a "Change
      Orders" section labeled 1-15), the Scheduled Value column is empty
      — the CO dollar amount lives in "Approved Changes". In that case,
      set scheduled_value = the Approved Changes amount (COs add to the
      contract).
  - Two retainage columns like "Retainage Previous 10.0%" and
    "Retainage 2.5%". Use the CURRENTLY-APPLICABLE rate column (usually
    the rightmost / smaller-percentage one for stored work, or match the
    stated retainage rate on the cover sheet).
  - "% (G/C)" vs "% Act" / "% Actual" — both are percent complete; prefer
    "% (G/C)" when both exist.
  - Job Costs Description vs Description of Work — same thing.

Trust column LABELS more than column POSITIONS. Some forms merge header
cells across two rows; reassemble them mentally before parsing data rows.

═══ ROW CLASSIFICATION (CRITICAL — MUST GET RIGHT) ═══
Each row you see is one of three kinds. You MUST label each with
row_type:

  row_type: "detail"
    A real SOV line item. Has a cost code, a specific description
    (e.g. "Concrete Slab & Beam", "Masonry - Brick Material",
    "Framing Labor - Wood"), and its own scheduled value.
    THESE are the ones we want.

  row_type: "subtotal"
    A DIVISION SUMMARY row. The scheduled_value on a subtotal is exactly
    the sum of the preceding detail rows.
    Heuristics for subtotal detection:
      • Description is a broad category with NO cost code of its own:
        "Concrete", "Masonry", "Metals", "Rough Carpentry", "Finish
        Carpentry", "Drywall", "Insulation", "Roofing", "Doors",
        "Windows", "Plumbing", "HVAC", "Electrical", etc.
      • Often numbered in column A (Item No. 1, 2, 3, …) — but the
        detail rows above it have a different numbering or blank Item
        No. Do NOT confuse "the numbered outer row = the real item".
      • The row's numeric values equal the sum of a run of detail rows
        immediately above it.
      • Bold / centered / different-colored styling in the source.
    CRITICAL: Emit subtotals with row_type="subtotal" so I can drop
    them. DO NOT silently skip them (I need to see them to verify), but
    DO NOT treat them as detail.

  row_type: "section_header"
    A category label with NO dollar values (e.g. "DIVISION 3 — CONCRETE"
    on its own row). These are pure labels, no data.

═══ ANTI-EXAMPLE (HUD 221(d)(4) — REAL CASE) ═══
On a Merritt Crossing HUD draw we see this pattern:
    Row:  5010  Concrete Slab & Beam     $1,163,512   →  row_type: detail
    Row:  5020  Lightweight Concrete       $466,692   →  row_type: detail
    Row:  5130  Termite Control             $16,808   →  row_type: detail
    Row:  5190  Testing                     $72,035   →  row_type: detail
    Row:    1        Concrete            $1,719,047   →  row_type: subtotal  (= sum of 5010+5020+5130+5190)

    Row:  7010  Masonry - Brick Material   $426,448   →  row_type: detail
    Row:  7015  Masonry - Labor            $639,672   →  row_type: detail
    Row:    2        Masonry             $1,066,120   →  row_type: subtotal

The rows numbered 1, 2, 3 … in column A with broad category names
("Concrete", "Masonry", "Metals") are DIVISION SUBTOTALS, never
line items. Always label them subtotal.

═══ HUD-SPECIFIC SUBTOTAL TIERS (ALWAYS row_type: "subtotal") ═══
HUD 221(d)(4) forms have THREE tiers of grand totals near the bottom.
ALL of these are subtotals, never line items:
    "Subtotal"                    → row_type: subtotal
    "Subtotal HUD Requisition"    → row_type: subtotal
    "Total Contract"              → row_type: subtotal
    "Grand Total" / "TOTAL"       → row_type: subtotal
    "Change Orders" (section header before CO #1-15) → row_type: section_header

═══ HUD-SPECIFIC DETAIL ROWS (ALWAYS row_type: "detail") ═══
These look summary-ish (bolded, between subtotals) but ARE real SOV items
and must be emitted as detail rows with their dollar values preserved:
    "Builder's Overhead"          → row_type: detail
    "Builder's Profit"            → row_type: detail
    "Material Stored-Onsite"      → row_type: detail
    "Material Stored-Offsite"     → row_type: detail
    "Change Order Reductions"     → row_type: detail
    "Other Fees"                  → row_type: detail
    "Cost Certification"          → row_type: detail
    "Bond Premium"                → row_type: detail
    "Offsite Escrow"              → row_type: detail
    "Unusual Site Conditions"     → row_type: detail
    "General Requirements"        → row_type: detail  (real fee item on HUD, NOT a subtotal)
    "Sprinkler System"            → row_type: detail
    "Lawns and Planting"          → row_type: detail

═══ CHANGE ORDER SECTION RULES ═══
After "Total Contract" there is often a "Change Orders" section with
rows numbered 1-15 (or more). For each numbered CO row:
  - If the row has a description AND a non-zero value in either Approved
    Changes or Revised Contract Amount → emit as row_type: detail with
    scheduled_value = that CO dollar amount (so the total reconciles with
    the Revised Contract total).
  - If the row is a PLACEHOLDER (only a number in column A, blank
    description, all zeros) → DO NOT emit it at all. Skip entirely.
  - If the row describes a time-only CO (description like "180 Day time
    extension" with $0 across the board) → DO NOT emit it. Time-only COs
    have no dollar impact.

═══ CSI DIVISION INFERENCE (for budget propagation) ═══
For every detail row, infer the CSI MasterFormat division as a 2-digit
string. This lets us propagate actuals to the Budget page even when the
GC uses internal cost codes like 5010 or 7010 that don't map to CSI.

Infer from the DESCRIPTION (not the cost code). Reference map:
  "01" General Requirements    → general conditions, overhead, profit, bond, insurance, contingency, fees
  "02" Existing Conditions     → demolition, site survey
  "03" Concrete                → concrete, slab, beam, footing, precast
  "04" Masonry                 → brick, block, CMU, stone veneer
  "05" Metals                  → structural steel, metal stairs, railings, awnings
  "06" Wood/Plastics           → rough/finish carpentry, framing (labor or material), trusses, millwork, trim
  "07" Thermal/Moisture        → roofing, waterproofing, insulation, flashing, sheet metal, gutters
  "08" Openings                → doors, windows, storefront, glass, glazing, hardware
  "09" Finishes                → drywall, tape/bed/texture, tile, flooring, paint, acoustics, plaster
  "10" Specialties             → toilet partitions, signage, lockers, mailboxes, mirrors
  "11" Equipment               → appliances, kitchen equipment
  "12" Furnishings             → window treatments, shower doors
  "13" Special Construction    → pools, saunas, rec facilities
  "14" Conveying               → elevators, escalators
  "21" Fire Suppression        → sprinkler system, fire suppression
  "22" Plumbing                → plumbing, domestic water, waste
  "23" HVAC                    → HVAC, mechanical, ductwork
  "26" Electrical              → electrical, lighting, power
  "27" Communications          → low voltage, data, AV
  "28" Electronic Safety       → fire alarm, security, access control
  "31" Earthwork               → site work, grading, excavation, earthwork, termite control, pest
  "32" Exterior Improvements   → landscaping, lawns, planting, paving, fencing
  "33" Utilities               → water/sewer/storm utilities outside the building

Rules:
  - Return as 2-char zero-padded string: "03" not "3".
  - If the description is ambiguous (e.g. "General Conditions"), pick the
    single best match ("01").
  - If the description is itself a CSI division name, use that division.
  - If the row's description is a fee/overhead item (Builder's Overhead,
    Bond Premium, Other Fees, Cost Certification), use "01".
  - If you genuinely can't tell, use "00" (Unclassified) — do NOT guess.

═══ RETURN FORMAT ═══
Return a SINGLE JSON object with EXACTLY this shape (no prose, no
markdown, no code fences):

{
  "application_number": 14,
  "period_from": "2026-02-01",
  "period_to": "2026-02-20",
  "contract_sum": 18234500,
  "contractor_name": "Acme Construction",
  "project_name": "Merritt Crossing",
  "totals": {
    "total_completed_and_stored": 14820100,
    "retainage": 370500,
    "total_earned_less_retainage": 14449600,
    "less_previous_certificates": 13980000,
    "current_payment_due": 469600,
    "balance_to_finish": 3414400
  },
  "line_items": [
    {
      "item_number": "5010",
      "cost_code": "5010",
      "description": "Concrete Slab & Beam",
      "csi_division": "03",
      "scheduled_value": 1163512,
      "previous_completed": 1163512,
      "this_period": 0,
      "materials_stored": 0,
      "percent_complete": 100,
      "retainage": 29088,
      "balance_to_finish": 0,
      "confidence": 0.98,
      "row_type": "detail"
    },
    {
      "item_number": "1",
      "cost_code": "",
      "description": "Concrete",
      "csi_division": "03",
      "scheduled_value": 1719047,
      "previous_completed": 1587967,
      "this_period": 2782,
      "materials_stored": 0,
      "percent_complete": 92.54,
      "retainage": 39768,
      "balance_to_finish": 128298,
      "confidence": 0.98,
      "row_type": "subtotal"
    }
  ],
  "warnings": ["string — any notable observations"]
}

═══ STRICT RULES ═══
1. Emit EVERY row you see, including subtotals (with row_type="subtotal")
   — the review pipeline filters them out downstream.
2. Dollar fields must be NUMBERS, not strings. Strip "$", ",", and whitespace.
3. percent_complete is a number from 0 to 100, not 0 to 1.
4. "confidence" per row: 0.95+ if every column reads clean; 0.7–0.9 if
   one cell was ambiguous; < 0.7 if you're guessing or the row was
   partially obscured. Be honest — low confidence is more useful than
   fake precision.
5. If a field is genuinely missing from the document, use 0 and add a
   warning like "No materials stored column present".
6. "item_number" is the row label from column A — preserve verbatim.
7. "cost_code" is the GC's internal cost code (column B in HUD forms) or
   the CSI/division code if present. If none, use empty string "".
8. Dates: normalize to YYYY-MM-DD. Leave empty fields as "" (empty string,
   not null) so the downstream Zod parser is happy.
9. Do NOT invent data. If unclear, set confidence low and add a warning.
10. Return ONLY the JSON object. No explanation. No markdown fences.

If the document does NOT look like a draw report / pay application, return:
  { "line_items": [], "warnings": ["Document does not appear to be a G702/G703 draw report."] }
`.trim()

// ── UUID check ────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new HttpError(400, `${field} must be a valid UUID`)
  }
  return value
}

// ── Direct-HTTP auth (bypasses supabase-js ES256 parsing) ─────

async function validateToken(
  supabaseUrl: string,
  anonKey: string,
  token: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-draw-report] GoTrue auth failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(401, 'Invalid or expired authentication token')
  }
  const user = await res.json() as { id?: string; email?: string }
  if (!user?.id) {
    throw new HttpError(401, 'GoTrue returned no user id')
  }
  return { id: user.id, email: user.email || '' }
}

async function checkProjectMembership(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  projectId: string,
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/project_members?user_id=eq.${userId}&project_id=eq.${projectId}&select=role&limit=1`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-draw-report] project_members query failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(500, 'Project membership check failed')
  }
  const rows = await res.json() as Array<{ role?: string }>
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(403, 'User is not a member of this project')
  }
}

// ── PDF size limits ──────────────────────────────────────────

const MAX_PDF_BYTES = 50 * 1024 * 1024
const MAX_XLSX_TEXT_CHARS = 500_000

// ── PDF fetch / decode ────────────────────────────────────────

async function fetchPdfFromUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-draw-report] pdf fetch failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(400, `Could not fetch PDF (HTTP ${res.status}). Check the signed URL hasn't expired.`)
  }
  const buffer = await res.arrayBuffer()
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new HttpError(413, `PDF too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Max ${MAX_PDF_BYTES / 1024 / 1024} MB.`)
  }
  if (buffer.byteLength < 100) {
    throw new HttpError(400, 'PDF body is empty or corrupted.')
  }
  return arrayBufferToBase64(buffer)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  }
  return btoa(parts.join(''))
}

// ── Gemini call with retry + fallback ────────────────────────

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const RETRY_DELAYS_MS = [800, 1500]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function approxBase64Bytes(base64: string): number {
  // base64 encodes 3 bytes per 4 chars; padding overhead is trivial at this scale
  return Math.floor((base64.length * 3) / 4)
}

type GeminiParts = Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>

async function callGeminiOnce(
  apiKey: string,
  model: string,
  parts: GeminiParts,
): Promise<GeminiResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      // Gemini 2.5 Flash's default (8192) truncates dense G703 output
      // mid-JSON on 100+ line-item forms. 32k is well within the model's
      // 65k ceiling and ensures complete output on any realistic draw.
      maxOutputTokens: 32768,
    },
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new HttpError(res.status, `Gemini ${model} ${res.status}: ${text.slice(0, 300)}`)
    ;(err as HttpError & { upstreamStatus: number }).upstreamStatus = res.status
    throw err
  }
  return (await res.json()) as GeminiResponse
}

async function callGeminiWithRetry(
  apiKey: string,
  model: string,
  parts: GeminiParts,
): Promise<GeminiResponse> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        console.log(`[extract-draw-report] retry ${attempt}/${RETRY_DELAYS_MS.length} for ${model} after ${delay}ms`)
        await sleep(delay)
      }
      return await callGeminiOnce(apiKey, model, parts)
    } catch (err) {
      lastErr = err
      const status = (err as { upstreamStatus?: number }).upstreamStatus
      if (!status || !RETRYABLE_STATUS.has(status)) throw err
      console.warn(`[extract-draw-report] ${model} returned ${status}, will retry`)
    }
  }
  throw lastErr
}

async function callGemini(
  apiKey: string,
  primaryModel: string,
  parts: GeminiParts,
): Promise<{ text: string; model: string; finishReason: string }> {
  let resp: GeminiResponse
  let modelUsed = primaryModel
  try {
    resp = await callGeminiWithRetry(apiKey, primaryModel, parts)
  } catch (primaryErr) {
    const status = (primaryErr as { upstreamStatus?: number }).upstreamStatus
    if (!status || !RETRYABLE_STATUS.has(status)) throw primaryErr
    // Fallback chain:
    //   flash (primary, accurate) → flash-lite (fast degraded mode)
    //   flash-lite → flash (promote if Flash-Lite is down)
    const fallbackModel =
      Deno.env.get('GEMINI_FALLBACK_MODEL_NAME') ??
      (primaryModel === 'gemini-2.5-flash' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash')
    console.warn(`[extract-draw-report] primary ${primaryModel} unavailable, falling back to ${fallbackModel}`)
    modelUsed = fallbackModel
    try {
      resp = await callGeminiWithRetry(apiKey, fallbackModel, parts)
    } catch (fallbackErr) {
      const fbStatus = (fallbackErr as { upstreamStatus?: number }).upstreamStatus
      if (fbStatus && RETRYABLE_STATUS.has(fbStatus)) {
        throw new HttpError(
          503,
          'Gemini is currently at capacity. Please try again in 30 seconds.',
        )
      }
      throw fallbackErr
    }
  }
  const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const finishReason = resp.candidates?.[0]?.finishReason ?? 'STOP'
  if (!text) throw new HttpError(502, 'Gemini returned an empty response')
  return { text, model: modelUsed, finishReason }
}

// ── JSON parsing (tolerant) ──────────────────────────────────

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const stripped = raw.trim()
  try { return JSON.parse(stripped) } catch { /* fall through */ }
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end < 0) throw new HttpError(502, 'Gemini did not return parseable JSON')
  try { return JSON.parse(stripped.slice(start, end + 1)) }
  catch (e) { throw new HttpError(502, `Gemini JSON parse failed: ${(e as Error).message}`) }
}

// ── Normalization / validation ───────────────────────────────

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$,\s]/g, '')
    const parsed = Number(cleaned)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function isoDate(v: unknown): string {
  if (typeof v !== 'string') return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''
}

// Broad CSI-division category names that appear as subtotal row
// descriptions on HUD 221(d)(4) and GC-custom draw reports. When a row
// has one of these as its description AND no cost_code of its own, it's
// almost certainly a subtotal even if Gemini didn't label it.
// Canonical CSI MasterFormat 2020 division codes. Any value outside this
// set gets mapped to "00" (Unclassified) to prevent silent query failures.
const VALID_CSI_DIVISIONS = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '14',
  '21', '22', '23', '25', '26', '27', '28',
  '31', '32', '33', '34', '35',
  '40', '41', '42', '43', '44', '45', '46', '48',
])

const SUBTOTAL_CATEGORY_NAMES = new Set([
  // CSI division names used as subtotal labels on two-level GC forms.
  // Note: "general requirements" is intentionally NOT here because on HUD
  // 221(d)(4) forms it appears as a DETAIL row with a real value ($2M+),
  // not a subtotal.
  'general conditions',
  'sitework', 'site work', 'earthwork', 'demolition',
  'concrete', 'masonry', 'metals', 'steel',
  'rough carpentry', 'finish carpentry', 'carpentry', 'millwork',
  'thermal and moisture protection', 'waterproofing', 'insulation',
  'roofing', 'sheet metal',
  'openings', 'doors', 'windows', 'glass', 'glazing',
  'finishes', 'drywall', 'lath and plaster', 'tile', 'flooring',
  'painting', 'wall coverings',
  'specialties', 'equipment', 'furnishings', 'special construction',
  'conveying equipment', 'elevators',
  'plumbing', 'hvac', 'mechanical', 'electrical',
  'fire protection', 'fire suppression', 'sprinkler',
  'communications', 'low voltage', 'security',
  'landscape', 'landscaping', 'exterior improvements', 'paving',
  'utilities',
  // Explicit grand-total / tier labels seen on HUD and standard forms.
  'subtotal', 'sub-total', 'sub total',
  'subtotal hud requisition', 'hud requisition subtotal',
  'total contract', 'total', 'grand total',
  'change orders',  // the section header row above the CO numbered rows
])

function normalizeLineItem(raw: unknown): ExtractedLineItem | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const description = str(r.description).trim()
  let scheduled = num(r.scheduled_value)
  const previous = num(r.previous_completed)
  const thisPeriodVal = num(r.this_period)
  const stored = num(r.materials_stored)
  // Some HUD forms put change-order dollars in an "approved_changes" /
  // "revised_contract_amount" column, leaving scheduled_value blank. If
  // Gemini emits either of those keys and scheduled_value is 0, fold the
  // CO value into scheduled_value so reconciliation math works.
  if (scheduled === 0) {
    const approved = num(r.approved_changes)
    const revised = num(r.revised_contract_amount)
    if (approved > 0) scheduled = approved
    else if (revised > 0) scheduled = revised
  }
  // Drop truly empty rows: no description AND no value anywhere. Catches
  // CO #4–15 placeholder slots and trailing blank lines.
  if (!description && scheduled === 0 && previous === 0 && thisPeriodVal === 0 && stored === 0) {
    return null
  }
  const confRaw = typeof r.confidence === 'number' ? r.confidence : 0.8
  const confidence = Math.max(0, Math.min(1, confRaw))
  const pct = Math.max(0, Math.min(100, num(r.percent_complete)))
  const costCode = str(r.cost_code).trim()
  const itemNumber = str(r.item_number).trim() || '—'

  // Gemini's label (trusted when present).
  const rawType = str(r.row_type).toLowerCase()
  let rowType: ExtractedLineItem['row_type'] | undefined =
    rawType === 'detail' || rawType === 'subtotal' || rawType === 'section_header'
      ? (rawType as ExtractedLineItem['row_type'])
      : undefined

  // Heuristic backup: description is a broad CSI category AND cost_code is
  // empty → almost certainly a subtotal even if Gemini didn't label it.
  if (!rowType) {
    const descLower = description.toLowerCase()
    if (!costCode && SUBTOTAL_CATEGORY_NAMES.has(descLower)) {
      rowType = 'subtotal'
    } else {
      rowType = 'detail'
    }
  }

  // Normalize csi_division to a 2-char zero-padded string ("03" not "3")
  // AND validate against the known CSI MasterFormat division set. Anything
  // outside the set (e.g. Gemini emits "99") becomes "00" (Unclassified)
  // so the budget matching loop cleanly skips rather than querying with
  // an invalid code.
  const csiRaw = str(r.csi_division).trim()
  const csiMatch = csiRaw.match(/^(\d{1,2})$/)
  const csiPadded = csiMatch ? csiMatch[1].padStart(2, '0') : '00'
  const csiDivision = VALID_CSI_DIVISIONS.has(csiPadded) ? csiPadded : '00'

  return {
    item_number: itemNumber,
    cost_code: costCode || itemNumber || '',
    description: description || 'Unlabeled line item',
    csi_division: csiDivision,
    scheduled_value: scheduled,
    previous_completed: previous,
    this_period: thisPeriodVal,
    materials_stored: stored,
    percent_complete: pct,
    retainage: num(r.retainage),
    balance_to_finish: num(r.balance_to_finish),
    confidence,
    row_type: rowType,
  }
}

/**
 * Second-pass subtotal detector: if Gemini didn't flag subtotals but
 * one row's scheduled_value ≈ sum of the N rows immediately before it,
 * that row is almost certainly a subtotal. Conservative threshold so
 * we don't drop real line items that happen to equal a neighbor sum.
 */
function markNumericSubtotals(lines: ExtractedLineItem[]): ExtractedLineItem[] {
  const out = lines.map((l) => ({ ...l }))
  for (let i = 2; i < out.length; i++) {
    if (out[i].row_type === 'subtotal') continue
    for (let windowLen = 2; windowLen <= Math.min(8, i); windowLen++) {
      const start = i - windowLen
      const sum = out.slice(start, i).reduce((s, r) => s + r.scheduled_value, 0)
      const target = out[i].scheduled_value
      if (target === 0) continue
      // Within 0.5% and at least $100 absolute
      const absDiff = Math.abs(sum - target)
      if (absDiff < Math.max(100, target * 0.005)) {
        // Additionally require that all rows in the window are "detail"
        // to avoid chain-labeling already-detected subtotals.
        const allDetail = out.slice(start, i).every((r) => r.row_type === 'detail')
        if (allDetail) {
          out[i] = { ...out[i], row_type: 'subtotal' }
          break
        }
      }
    }
  }
  return out
}

function buildReconciliation(
  detailLines: ExtractedLineItem[],
  statedContractSum: number,
  droppedSubtotalCount: number,
): Reconciliation {
  const sumOfLines = detailLines.reduce((s, l) => s + l.scheduled_value, 0)
  const deviation = sumOfLines - statedContractSum
  const pct = statedContractSum > 0
    ? Math.abs(deviation) / statedContractSum * 100
    : 0
  const reconciled = pct < 0.5 || (statedContractSum === 0 && sumOfLines > 0)
  return {
    sum_of_lines: Math.round(sumOfLines * 100) / 100,
    stated_contract_sum: Math.round(statedContractSum * 100) / 100,
    deviation_dollars: Math.round(deviation * 100) / 100,
    deviation_pct: Math.round(pct * 100) / 100,
    reconciled,
    dropped_subtotal_count: droppedSubtotalCount,
  }
}

function normalizeExtraction(raw: Record<string, unknown>): Extraction {
  const rawLines = Array.isArray(raw.line_items) ? raw.line_items : []
  const allRows = rawLines
    .map(normalizeLineItem)
    .filter((x): x is ExtractedLineItem => x !== null)

  // Second-pass numeric subtotal detection — flags rows Gemini missed.
  const labeled = markNumericSubtotals(allRows)

  // Keep only real line items.
  const detailLines = labeled.filter((l) => l.row_type === 'detail')
  const droppedSubtotalCount = labeled.length - detailLines.length

  const totalsRaw = (raw.totals ?? {}) as Record<string, unknown>
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string')
    : []
  if (droppedSubtotalCount > 0) {
    warnings.push(
      `Dropped ${droppedSubtotalCount} subtotal/header row${droppedSubtotalCount !== 1 ? 's' : ''} from line items to prevent double-counting.`,
    )
  }

  const appNumRaw = raw.application_number
  const applicationNumber = typeof appNumRaw === 'number' && Number.isFinite(appNumRaw)
    ? Math.round(appNumRaw)
    : (typeof appNumRaw === 'string' ? parseInt(appNumRaw, 10) || undefined : undefined)

  // Reconciliation: prefer an explicit contract_sum; fall back to the
  // largest subtotal row we saw (frequently the grand-total line on HUD
  // forms), which gives the banner something useful even when the LLM
  // doesn't emit contract_sum at the top level.
  const explicitContractSum = num(raw.contract_sum)
  const droppedSubtotalMax = labeled
    .filter((l) => l.row_type === 'subtotal')
    .reduce((m, l) => Math.max(m, l.scheduled_value), 0)
  const reconContractSum = explicitContractSum > 0
    ? explicitContractSum
    : droppedSubtotalMax
  const reconciliation = buildReconciliation(detailLines, reconContractSum, droppedSubtotalCount)

  return {
    application_number: applicationNumber,
    period_from: isoDate(raw.period_from) || undefined,
    period_to: isoDate(raw.period_to) || undefined,
    contract_sum: explicitContractSum || reconContractSum || undefined,
    contractor_name: str(raw.contractor_name).trim() || undefined,
    project_name: str(raw.project_name).trim() || undefined,
    totals: {
      total_completed_and_stored: num(totalsRaw.total_completed_and_stored) || undefined,
      retainage: num(totalsRaw.retainage) || undefined,
      total_earned_less_retainage: num(totalsRaw.total_earned_less_retainage) || undefined,
      less_previous_certificates: num(totalsRaw.less_previous_certificates) || undefined,
      current_payment_due: num(totalsRaw.current_payment_due) || undefined,
      balance_to_finish: num(totalsRaw.balance_to_finish) || undefined,
    },
    line_items: detailLines,
    warnings,
    reconciliation,
  }
}

// ── Job-row helpers (service-role PostgREST) ─────────────────
// Direct HTTP to PostgREST for the same reason extract-schedule-pdf does
// it: supabase-js's ES256 anon-key parser is unreliable in this runtime.

async function insertJobRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  row: {
    project_id: string
    user_id: string
    document_id?: string | null
    filename: string
  },
): Promise<string> {
  const res = await fetch(`${supabaseUrl}/rest/v1/draw_report_extraction_jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({ ...row, status: 'queued' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-draw-report] insertJobRow failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(500, `Failed to create job row: HTTP ${res.status}`)
  }
  const rows = await res.json() as Array<{ id?: string }>
  const id = Array.isArray(rows) ? rows[0]?.id : undefined
  if (!id) throw new HttpError(500, 'insertJobRow returned no id')
  return id
}

/**
 * Reclaim zombie job rows — those stuck in status='running' for more than
 * 5 minutes. This happens when EdgeRuntime.waitUntil runs past its 150s
 * budget or crashes silently. Called on every new kickoff so the system
 * self-heals without a cron.
 */
async function reclaimZombieJobs(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
): Promise<void> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const url =
    `${supabaseUrl}/rest/v1/draw_report_extraction_jobs` +
    `?user_id=eq.${userId}&status=eq.running&started_at=lt.${fiveMinAgo}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      status: 'error',
      error_message: 'Extraction did not complete within 5 minutes — marked stale.',
      finished_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`[extract-draw-report] zombie reclaim failed (${res.status}): ${body.slice(0, 200)}`)
    // Non-fatal — we still proceed to create the new job.
  }
}

async function updateJobRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/draw_report_extraction_jobs?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-draw-report] updateJobRow ${jobId} failed (${res.status}): ${body.slice(0, 200)}`)
  }
}

// ── Background extraction task ───────────────────────────────
// Runs after the 202 response is sent. Bounded only by the Edge Runtime's
// wall-clock budget (~150s on free tier), not the 25s gateway timeout.

interface RunExtractionArgs {
  supabaseUrl: string
  serviceRoleKey: string
  geminiKey: string
  model: string
  jobId: string
  pdfText?: string
  pdfUrl?: string
  pdfB64?: string
  xlsxText?: string
  filename: string
}

async function runExtraction(args: RunExtractionArgs): Promise<void> {
  const { supabaseUrl, serviceRoleKey, geminiKey, model, jobId, filename } = args

  await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  try {
    // Resolve PDF bytes for vision fallback when we have no text layer.
    let pdfB64 = args.pdfB64
    if (!args.pdfText && args.pdfUrl && !pdfB64) {
      console.log(`[extract-draw-report] job=${jobId} fetching PDF from signed URL`)
      pdfB64 = await fetchPdfFromUrl(args.pdfUrl)
    }

    const parts: GeminiParts = []
    if (args.pdfText) {
      parts.push({
        text:
          EXTRACTION_PROMPT +
          '\n\nThe following is the extracted text layer from a PDF draw report. Column positions may be flattened — rely on labels (Scheduled Value, Work Completed, etc.) to reassemble the data. Item numbers and cost codes are usually at the left edge of each line.\n\n' +
          args.pdfText,
      })
    } else if (pdfB64) {
      parts.push({ inline_data: { mime_type: 'application/pdf', data: pdfB64 } })
      parts.push({ text: '\n\n' + EXTRACTION_PROMPT })
    } else if (args.xlsxText) {
      parts.push({
        text:
          EXTRACTION_PROMPT +
          '\n\nThe following is the flattened text of an Excel draw report. Column order may be preserved via tab/newline separators. Extract line items as instructed.\n\n' +
          args.xlsxText,
      })
    } else {
      throw new HttpError(400, 'No extraction source in job')
    }

    console.log(`[extract-draw-report] job=${jobId} calling Gemini ${model}`)
    const { text, model: modelUsed, finishReason } = await callGemini(geminiKey, model, parts)
    console.log(`[extract-draw-report] job=${jobId} Gemini returned ${text.length} chars via ${modelUsed}, finishReason=${finishReason}`)

    const parsed = extractJson(text)
    const extraction = normalizeExtraction(parsed)

    // Truncation / safety / recitation — anything other than "STOP" means
    // the model's output may be incomplete. Surface this prominently so
    // the user doesn't commit a partial extraction as if it were whole.
    if (finishReason && finishReason !== 'STOP') {
      const reasonMsg = finishReason === 'MAX_TOKENS'
        ? 'Gemini response truncated — the draw is larger than expected. Re-run extraction before saving (try Flash-Lite via GEMINI_MODEL_NAME if this persists).'
        : `Gemini response incomplete (finishReason=${finishReason}) — re-run extraction before saving.`
      extraction.warnings.unshift(reasonMsg)
    }

    if (extraction.line_items.length === 0) {
      await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
        status: 'error',
        error_message: extraction.warnings[0] || 'No line items could be extracted from this document.',
        finished_at: new Date().toISOString(),
      })
      return
    }

    await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
      status: 'done',
      result_json: { extraction, raw_text: text, model: modelUsed },
      finished_at: new Date().toISOString(),
    })
    console.log(`[extract-draw-report] job=${jobId} done: ${extraction.line_items.length} line items`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error during extraction'
    console.error(`[extract-draw-report] job=${jobId} error: ${message}`)
    await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
      status: 'error',
      error_message: message,
      finished_at: new Date().toISOString(),
    })
  }

  // Keep filename referenced for logs even when unused in the hot path
  void filename
}

// ── Handler ──────────────────────────────────────────────────
//
// Returns 202 + { job_id } in under 2s. Client polls the job row until
// status ∈ {done, error}. This sidesteps Supabase's 25s synchronous
// timeout for multi-page draw reports with 50+ line items.

Deno.serve(async (req) => {
  const headers = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    console.log('[extract-draw-report] request received')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    // Flash by default: stronger accuracy for dense financial data. The
    // async job pattern makes latency (~30-60s on 140-line G703s) a
    // non-issue. For faster extraction on simple draws, override via
    // GEMINI_MODEL_NAME=gemini-2.5-flash-lite.
    const model = Deno.env.get('GEMINI_MODEL_NAME') ?? 'gemini-2.5-flash'

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new HttpError(500, 'Supabase env vars missing')
    }
    if (!geminiKey) {
      throw new HttpError(500, 'GEMINI_API_KEY not configured')
    }

    const contentType = req.headers.get('Content-Type') || ''
    if (!contentType.includes('application/json')) {
      throw new HttpError(415, 'Content-Type must be application/json')
    }
    const body = await req.json() as ExtractRequest & { document_id?: string }
    const projectId = requireUuid(body.project_id, 'project_id')
    const userToken = typeof body.user_token === 'string' ? body.user_token.trim() : ''
    if (!userToken) {
      throw new HttpError(401, 'Missing user_token in body')
    }
    const pdfText = typeof body.pdf_text === 'string' ? body.pdf_text : ''
    const pdfUrl = typeof body.pdf_url === 'string' ? body.pdf_url.trim() : ''
    const pdfB64In = typeof body.pdf_base64 === 'string' ? body.pdf_base64 : ''
    const xlsxText = typeof body.xlsx_text === 'string' ? body.xlsx_text : ''
    const documentId = typeof body.document_id === 'string' && UUID_REGEX.test(body.document_id)
      ? body.document_id
      : null
    const filename = typeof body.filename === 'string' && body.filename.length > 0
      ? body.filename
      : 'draw-report'
    if (!pdfText && !pdfUrl && !pdfB64In && !xlsxText) {
      throw new HttpError(400, 'Either pdf_text, pdf_url, pdf_base64, or xlsx_text is required')
    }
    if (pdfB64In && approxBase64Bytes(pdfB64In) > MAX_PDF_BYTES) {
      throw new HttpError(413, `PDF too large (max ${MAX_PDF_BYTES / 1024 / 1024} MB)`)
    }
    if (pdfText && pdfText.length > MAX_XLSX_TEXT_CHARS) {
      throw new HttpError(413, `pdf text too large (max ${MAX_XLSX_TEXT_CHARS} chars)`)
    }
    if (xlsxText && xlsxText.length > MAX_XLSX_TEXT_CHARS) {
      throw new HttpError(413, `xlsx text too large (max ${MAX_XLSX_TEXT_CHARS} chars)`)
    }

    const mode = pdfText ? 'pdf_text' : pdfUrl ? 'pdf_url' : pdfB64In ? 'pdf_base64' : 'xlsx'
    console.log(`[extract-draw-report] project=${projectId} filename=${filename} mode=${mode}`)

    // Auth fast-fail before any other work.
    const user = await validateToken(supabaseUrl, anonKey, userToken)
    await checkProjectMembership(supabaseUrl, serviceRoleKey, user.id, projectId)

    // Self-heal: reclaim any zombie jobs from prior crashed runs so the
    // user doesn't see their history filled with stale "running" rows.
    await reclaimZombieJobs(supabaseUrl, serviceRoleKey, user.id)

    const jobId = await insertJobRow(supabaseUrl, serviceRoleKey, {
      project_id: projectId,
      user_id: user.id,
      document_id: documentId,
      filename,
    })

    // @ts-expect-error — EdgeRuntime is a global provided by Supabase Edge Functions, not in our TS libs.
    EdgeRuntime.waitUntil(runExtraction({
      supabaseUrl,
      serviceRoleKey,
      geminiKey,
      model,
      jobId,
      pdfText: pdfText || undefined,
      pdfUrl: pdfUrl || undefined,
      pdfB64: pdfB64In || undefined,
      xlsxText: xlsxText || undefined,
      filename,
    }))

    return new Response(
      JSON.stringify({ job_id: jobId, status: 'queued' }),
      { status: 202, headers: { ...headers, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, headers)
  }
})
