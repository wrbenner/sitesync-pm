// ── extract-schedule-pdf Edge Function ────────────────────────
// Vision-based schedule extraction from Gantt PDFs using Gemini 2.5 Pro.
// Handles the messy reality of construction schedules — hatched bars,
// multi-row headers (month + week), zone-code cells (A1/CL/A2), custom
// Excel-as-Gantt layouts, mixed colors — that heuristic vector parsers miss.
//
// Input:  { project_id, pdf_url | pdf_base64, filename? }
// Output: { activities, projectName, dataDate, warnings, format: 'pdf', calendars: [] }
//         (shape-compatible with src/lib/scheduleImport.ts ImportResult)
//
// IMPORTANT — NO supabase-js dependency.
// We use raw fetch against Supabase's Auth and REST APIs because the
// supabase-js version available via esm.sh mishandles ES256 (asymmetric)
// JWT keys — parsing the anon key during createClient() throws
// "Unsupported JWT algorithm ES256". Direct HTTP avoids every client-side
// JWT-parsing landmine; validation still happens server-side at GoTrue
// and PostgREST, which are configured with the project's correct keys.

// ── CORS ──────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://sitesync.ai',
  'https://app.sitesync.ai',
]

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
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
  console.error(`[extract-schedule-pdf] error ${status}: ${message}`)
  return new Response(
    JSON.stringify({ error: { message, status } }),
    { status, headers: { 'Content-Type': 'application/json', ...extra } },
  )
}

// ── Types ────────────────────────────────────────────────────

interface TileRequest {
  signed_url: string
  page: number
  band: number
}

interface ExtractRequest {
  project_id: string
  /** Legacy single-image path (still supported). */
  pdf_url?: string
  pdf_base64?: string
  /** Preferred path: multiple tiles processed in parallel and merged. */
  tiles?: TileRequest[]
  filename?: string
  /**
   * User's session access token. Passed in the body instead of the
   * Authorization header so the Supabase Edge Runtime's JWT parser
   * (which rejects ES256 with UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM)
   * never sees it. We validate it in-function via direct GoTrue fetch,
   * which handles any algorithm natively.
   */
  user_token?: string
}

interface ExtractedActivity {
  id: string
  name: string
  wbs: string | null
  startDate: string
  endDate: string
  duration: number
  percentComplete: number
  predecessors: Array<{ activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }>
  isCritical: boolean
  isMilestone: boolean
  isBehind: boolean
  totalFloat: number | null
}

interface ExtractedSchedule {
  projectName: string
  dataDate: string
  activities: ExtractedActivity[]
  warnings: string[]
}

interface ImportResult {
  activities: ExtractedActivity[]
  calendars: Array<{ id: string; name: string }>
  projectName: string
  dataDate: string
  warnings: string[]
  format: 'pdf'
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
}

// ── Gemini extraction prompt ──────────────────────────────────

const EXTRACTION_PROMPT = `
You are viewing one slice of a Gantt-style construction schedule. The
timeline header (months + weeks) is at the top. The body below shows
activity rows. Extract the schedule as structured JSON.

Output one "row" object per VISIBLE ACTIVITY ROW in the image. Inside
each row, output a "runs" array describing each distinct zone/section
the row covers.

CRITICAL — YOUR JOB IS TO EXTRACT STRUCTURE, NOT TO JUDGE PROGRESS.

This PDF uses hatched / cross-hatched / striped bars drawn in a single
color (usually green). The hatched pattern does NOT mean "done" — it's
just the visual style for a scheduled bar. A bar that is hatched green
is simply a SCHEDULED run. Its completion status is determined entirely
by the data date, not by whether the hatching is green.

Therefore, DO NOT attempt to set percentComplete from bar color. Leave
percentComplete at 0 for every run. The server will compute the correct
percent from each run's date range vs the schedule's data date.

There are only TWO visual signals you need to detect and report:

1. isBehind — true ONLY if the bar/cell or zone code is colored RED
   (any shade of red, or a red outline, or red text showing "behind",
   "late", or similar). If there is no red color on or near the run,
   leave isBehind at false.

2. explicitComplete — true ONLY if the PDF shows an UNAMBIGUOUS "done"
   marker on the run: a solid-fill overlay that covers the run, a
   checkmark icon on the bar, a "100%" label printed on the bar itself,
   or the cell is inside an explicit "Completed" row/section. A
   standard hatched-green bar alone is NOT explicit-complete.
   (Put this on the row object, not per-run.)

Every other "progress" guess must be left for the server.

ZONE CODES (CRITICAL — READ CAREFULLY):
Many cells contain short labels like "A1", "CL", "A2", "A3", "B2", "B3",
"B4", "C3", "D1", "D2". These are zone codes indicating which building /
section the activity is being worked on THAT week. Decode them:
  - A single letter (A, B, C, D, …) is the BUILDING.
  - A following digit (1, 2, 3, …) is the SECTION within that building.
    So "A1" = "Building A / Section 1". "B2" = "Building B / Section 2".
  - "CL" is the CLUBHOUSE (special). wbs for a CL cell = "Clubhouse".
  - Other two-letter codes that aren't a building+section (e.g. "CL") are
    named areas — use them verbatim as the wbs.

RUNS ARRAY (CRITICAL):
For each PDF row, fill runs[] with ONE entry per contiguous zone-code run.

Example — a CARPET row whose cells, reading left to right, are labelled
A1 A1 CL A2 A2 A3 A3 ... B2 B2 D1 D2 produces SEVEN runs for that one row,
with these wbs values and the zone-specific date ranges for each:
  1) "Building A / Section 1" — covers the Monday of the first A1 cell
     through the Sunday of the last A1 cell in that contiguous run.
  2) "Clubhouse" — covers the CL week only.
  3) "Building A / Section 2" — covers the contiguous A2 run.
  4) "Building A / Section 3" — covers the contiguous A3 run.
  5) "Building B / Section 2" — covers the contiguous B2 run.
  6) "Building D / Section 1" — covers the D1 week only.
  7) "Building D / Section 2" — covers the D2 week only.

If the same zone code appears in TWO non-contiguous runs on one row, emit
TWO separate run entries (one per run).

For rows WITHOUT any zone codes in cells — typical of early site-work like
DEMOLITION, CLEARING, EXCAVATION, and late rows like FINAL CLEAN and
DEMOBILIZATION — emit EXACTLY ONE run entry with wbs=null and
startDate/endDate covering the full colored bar.

BOLD SECTION HEADERS:
If the PDF also has bold group headers ("BUILDING A", "PHASE 1", etc.) that
span multiple rows, use them as a wbs prefix joined with " / " (e.g.
"Building A / Section 1 / Carpet" would be wrong — the section header
replaces the building-letter, not adds to it). In this project the zone
codes ARE the hierarchy; only prefix a bold header if one is visible.

DATES:
- "Nov-24" = Nov 2024. "wk.1" = first week of month.
- Week cells typically start Monday. Prefer Mondays for startDate and
  the following Sunday for endDate of a single-week cell.
- A contiguous run of cells for the same zone → startDate = Monday of the
  first cell, endDate = Sunday of the last cell.

OUTPUT SHAPE (enforced by schema — follow exactly):
- projectName: string
- dataDate: string ("YYYY-MM-DD")
- rows: array of { name, isCritical, isMilestone, runs }
    where each run is { wbs (string or null), startDate, endDate,
    percentComplete, isBehind }
- warnings: array of strings

RULES:
1. One rows[] entry per VISIBLE PDF row. Do NOT emit multiple rows with
   the same name — the zone breakdown goes inside runs[].
2. Each rows[].runs[] MUST have at least one entry (use wbs=null for
   zoneless rows).
3. isCritical: only true if the PDF explicitly marks critical path. A
   red bar means the run has isBehind=true, not isCritical=true.
4. isMilestone: only true for single-day markers (diamond/triangle).
5. If a run is unreadable, include it with empty startDate/endDate
   rather than dropping the whole row.
6. Return JSON only, no prose, no markdown.
`.trim()

// ── Gemini structured-output schema (compact shape) ──────────
// Gemini emits one object per visible PDF row, with a `runs` array that
// enumerates each zone/section the row covers. We expand runs → per-zone
// activity rows server-side after parsing. Advantages:
//   1. Cuts Gemini's output tokens ~60% (shared name/fields per row).
//   2. The schema's required `runs` array forces the model to break each
//      row down; lazy one-per-row emission isn't representable.
//   3. Deterministic expansion — no risk of the model "forgetting" a zone.

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    projectName: { type: 'STRING' },
    dataDate: { type: 'STRING' },
    rows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          isCritical: { type: 'BOOLEAN' },
          isMilestone: { type: 'BOOLEAN' },
          explicitComplete: { type: 'BOOLEAN' },
          runs: {
            type: 'ARRAY',
            description: 'One entry per distinct zone-code run (or exactly one entry with wbs=null for rows with no zone codes).',
            items: {
              type: 'OBJECT',
              properties: {
                wbs: { type: 'STRING', nullable: true },
                startDate: { type: 'STRING' },
                endDate: { type: 'STRING' },
                isBehind: { type: 'BOOLEAN' },
              },
              required: ['startDate', 'endDate', 'isBehind'],
            },
          },
        },
        required: ['name', 'runs'],
      },
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['projectName', 'dataDate', 'rows', 'warnings'],
} as const

// ── UUID check ────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new HttpError(400, `${field} must be a valid UUID`)
  }
  return value
}

// ── Direct-HTTP auth (bypasses supabase-js JWT parsing) ──────

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
    console.error(`[extract-schedule-pdf] GoTrue auth failed (${res.status}): ${body.slice(0, 200)}`)
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
  // Service role bypasses RLS. We manually filter by user_id + project_id,
  // so we're explicitly enforcing membership — no privilege escalation.
  const url = `${supabaseUrl}/rest/v1/project_members?user_id=eq.${userId}&project_id=eq.${projectId}&select=role&limit=1`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-schedule-pdf] project_members query failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(500, 'Project membership check failed')
  }
  const rows = await res.json() as Array<{ role?: string }>
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(403, 'User is not a member of this project')
  }
}

// ── PDF fetch / decode ────────────────────────────────────────

const MAX_PDF_BYTES = 50 * 1024 * 1024

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.replace(/^data:[^;]+;base64,/, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function fetchFromUrl(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[extract-schedule-pdf] fetch failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(400, `Failed to fetch from signed URL (HTTP ${res.status})`)
  }
  const rawMime = (res.headers.get('content-type') || '').split(';')[0].trim()
  // Infer from URL path if server didn't send a useful content-type
  const inferredMime = (() => {
    const path = new URL(url).pathname.toLowerCase()
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
    if (path.endsWith('.png')) return 'image/png'
    if (path.endsWith('.webp')) return 'image/webp'
    if (path.endsWith('.pdf')) return 'application/pdf'
    return ''
  })()
  const mimeType = rawMime && rawMime !== 'application/octet-stream' ? rawMime : (inferredMime || 'application/pdf')
  const buffer = await res.arrayBuffer()
  return { buffer, mimeType }
}

// ── Gemini inline-data call ──────────────────────────────────
// We send the PDF as base64 inline_data instead of via the File API.
// The File API adds a 5-10s upload round-trip that pushes us past
// Supabase's 25s wall-clock limit. Inline data is capped at ~20 MB per
// request, which comfortably covers real-world Gantt PDFs.

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  }
  return btoa(parts.join(''))
}

// Retry + fallback wrapper around Gemini. Handles transient 503/429s
// (model overloaded, rate-limited) with exponential backoff, and falls
// through to a secondary model if the primary's capacity pool is out.

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const RETRY_DELAYS_MS = [800, 1500]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Supabase kills the function instance around 150s. We abort the Gemini
// call earlier so our catch block can write status='error' to the job row
// before the process is force-killed (otherwise the job row would stay
// in 'running' forever, with no error message).
const GEMINI_CALL_TIMEOUT_MS = 220_000  // Pro is slower than Flash; keep headroom under 400s wall-clock
const TILE_CONCURRENCY = 4              // Pro is heavier; reduce concurrency to stay within rate limits

async function callGeminiOnce(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
): Promise<GeminiResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: '\n\n' + EXTRACTION_PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 32_000,
    },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_CALL_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const err = new HttpError(res.status, `Gemini ${model} ${res.status}: ${text.slice(0, 300)}`)
      ;(err as HttpError & { upstreamStatus: number }).upstreamStatus = res.status
      throw err
    }
    return (await res.json()) as GeminiResponse
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new HttpError(
        504,
        `Gemini ${model} did not respond within ${GEMINI_CALL_TIMEOUT_MS / 1000}s. The PDF may be too dense for the current model — try a smaller or split PDF.`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function callGeminiWithRetry(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
): Promise<GeminiResponse> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[attempt - 1]
        console.log(`[extract-schedule-pdf] retry ${attempt}/${RETRY_DELAYS_MS.length} for ${model} after ${delay}ms`)
        await sleep(delay)
      }
      return await callGeminiOnce(apiKey, model, base64, mimeType)
    } catch (err) {
      lastErr = err
      const status = (err as { upstreamStatus?: number }).upstreamStatus
      if (!status || !RETRYABLE_STATUS.has(status)) {
        throw err // non-transient, don't retry
      }
      console.warn(`[extract-schedule-pdf] ${model} returned ${status}, will retry`)
    }
  }
  throw lastErr
}

async function callGeminiInline(
  apiKey: string,
  primaryModel: string,
  pdfBuffer: ArrayBuffer,
  mimeType: string,
): Promise<GeminiResponse> {
  const base64 = arrayBufferToBase64(pdfBuffer)

  try {
    return await callGeminiWithRetry(apiKey, primaryModel, base64, mimeType)
  } catch (primaryErr) {
    const status = (primaryErr as { upstreamStatus?: number }).upstreamStatus
    // Only fall back on capacity errors, not on bad-request / auth errors.
    if (!status || !RETRYABLE_STATUS.has(status)) throw primaryErr

    // Choose a fallback model in a separate capacity pool.
    const fallbackModel =
      Deno.env.get('GEMINI_FALLBACK_MODEL_NAME') ??
      (primaryModel === 'gemini-2.5-flash' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash')
    console.warn(`[extract-schedule-pdf] primary model ${primaryModel} unavailable, falling back to ${fallbackModel}`)

    try {
      return await callGeminiWithRetry(apiKey, fallbackModel, base64, mimeType)
    } catch (fallbackErr) {
      const fbStatus = (fallbackErr as { upstreamStatus?: number }).upstreamStatus
      if (fbStatus && RETRYABLE_STATUS.has(fbStatus)) {
        throw new HttpError(
          503,
          'Both primary and fallback Gemini models are currently at capacity. This is a temporary Google-side issue — please try again in 30 seconds.',
        )
      }
      throw fallbackErr
    }
  }
}

// ── JSON response parsing ────────────────────────────────────

function stripCodeFence(text: string): string {
  const stripped = text.trim()
  if (stripped.startsWith('```')) {
    const parts = stripped.split('```')
    if (parts.length >= 3) return parts[1].replace(/^json\s*/i, '').trim()
    return parts[parts.length - 1].trim()
  }
  return stripped
}

// Best-effort repair for near-valid JSON. We expect a root object with
// either a "rows" array (compact shape) or an "activities" array (legacy).
// If the root parse fails, find the first array start and scan for
// well-formed objects inside it. Losing a few tail entries is much better
// than losing a whole tile.
function repairPartialJson(text: string): Record<string, unknown> | null {
  const stripped = stripCodeFence(text)

  // Pick whichever array marker appears first in the text.
  const rowsMarker = stripped.indexOf('"rows"')
  const actsMarker = stripped.indexOf('"activities"')
  const arrayKind: 'rows' | 'activities' =
    rowsMarker >= 0 && (actsMarker < 0 || rowsMarker < actsMarker) ? 'rows' : 'activities'
  const markerIdx = arrayKind === 'rows' ? rowsMarker : actsMarker
  if (markerIdx < 0) return null

  const startIdx = stripped.indexOf('[', markerIdx)
  if (startIdx < 0) return null

  const items: unknown[] = []
  let depth = 0
  let inString = false
  let escape = false
  let objStart = -1

  for (let i = startIdx + 1; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        const fragment = stripped.slice(objStart, i + 1)
        try {
          items.push(JSON.parse(fragment))
        } catch { /* skip this one */ }
        objStart = -1
      }
    } else if (ch === ']' && depth === 0) {
      break
    }
  }

  if (items.length === 0) return null

  const head = stripped.slice(0, markerIdx)
  const pnMatch = head.match(/"projectName"\s*:\s*"([^"]*)"/)
  const ddMatch = head.match(/"dataDate"\s*:\s*"([^"]*)"/)

  const envelope: Record<string, unknown> = {
    projectName: pnMatch?.[1] ?? 'PDF Schedule Import',
    dataDate: ddMatch?.[1] ?? new Date().toISOString().split('T')[0],
    warnings: [`Recovered ${items.length} ${arrayKind} entries from partial JSON.`],
  }
  envelope[arrayKind] = items
  return envelope
}

function extractJson(text: string): Record<string, unknown> {
  const stripped = stripCodeFence(text)
  try { return JSON.parse(stripped) } catch { /* fall through */ }
  const match = stripped.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* fall through to repair */ }
  }
  const repaired = repairPartialJson(text)
  if (repaired) return repaired
  throw new HttpError(502, 'Gemini did not return parseable JSON')
}

// ── Activity normalization ────────────────────────────────────

function normalizeActivity(raw: unknown, idx: number): ExtractedActivity {
  const a = (raw ?? {}) as Record<string, unknown>
  const name = typeof a.name === 'string' ? a.name.trim() : ''
  const startDate = typeof a.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.startDate) ? a.startDate : ''
  const endDate = typeof a.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.endDate) ? a.endDate : ''
  let duration = 0
  if (startDate && endDate) {
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
    duration = Math.max(0, Math.round(ms / 86400000))
  }
  if (typeof a.duration === 'number' && Number.isFinite(a.duration) && a.duration > 0) {
    duration = Math.round(a.duration)
  }
  const pct = typeof a.percentComplete === 'number' && Number.isFinite(a.percentComplete)
    ? Math.max(0, Math.min(100, Math.round(a.percentComplete)))
    : 0
  return {
    id: typeof a.id === 'string' && a.id.length > 0 ? a.id : `pdf_${idx + 1}`,
    name,
    wbs: canonicalizeWbs(typeof a.wbs === 'string' ? a.wbs : null),
    startDate,
    endDate,
    duration,
    percentComplete: pct,
    predecessors: [],
    isCritical: a.isCritical === true,
    isMilestone: a.isMilestone === true,
    isBehind: a.isBehind === true,
    totalFloat: typeof a.totalFloat === 'number' ? a.totalFloat : null,
  }
}

// Compute percent complete and derived status for a run, based on the
// schedule's data date and two explicit flags Gemini provides (isBehind
// from red coloring; explicitComplete from an unambiguous "done" marker).
//
// This is the heart of the extraction-truthfulness fix. Gemini is bad at
// inferring % from hatched bar pixels; data-date math is exact.
interface DerivedProgress {
  percentComplete: number;
  status: 'completed' | 'delayed' | 'active' | 'upcoming' | 'upcoming';
  isBehind: boolean;
}

function deriveProgress(args: {
  startDate: string;
  endDate: string;
  dataDate: string | null;
  isBehind: boolean;
  explicitComplete: boolean;
}): DerivedProgress {
  const { startDate, endDate, dataDate, isBehind, explicitComplete } = args
  if (!startDate || !endDate) {
    return { percentComplete: 0, status: 'upcoming', isBehind }
  }
  if (explicitComplete) {
    return { percentComplete: 100, status: 'completed', isBehind: false }
  }
  if (!dataDate) {
    // No data date available — fall back to 0 so we don't fabricate progress.
    return { percentComplete: 0, status: isBehind ? 'delayed' : 'upcoming', isBehind }
  }

  const startMs = new Date(startDate).getTime()
  const endMs = new Date(endDate).getTime()
  const ddMs = new Date(dataDate).getTime()

  // Run entirely in the future → definitely 0%.
  if (startMs > ddMs) {
    return { percentComplete: 0, status: 'upcoming', isBehind: false }
  }
  // Run entirely in the past: either done or behind.
  if (endMs < ddMs) {
    if (isBehind) return { percentComplete: 50, status: 'delayed', isBehind: true }
    return { percentComplete: 100, status: 'completed', isBehind: false }
  }
  // Run straddles data date → linearly interpolate.
  const total = Math.max(1, endMs - startMs)
  const elapsed = Math.max(0, ddMs - startMs)
  const pct = Math.max(1, Math.min(99, Math.round((elapsed / total) * 100)))
  return { percentComplete: pct, status: isBehind ? 'delayed' : 'active', isBehind }
}

// Server-side expansion of Gemini's compact row-shape output into the flat
// activities list the rest of the pipeline expects. Each runs[] entry
// becomes its own ExtractedActivity: same name, different wbs/dates. The
// percentComplete field is ALWAYS computed server-side from dataDate +
// run dates — we do not trust Gemini's guess.
function expandRow(rawRow: unknown, startIdx: number, dataDate: string | null): ExtractedActivity[] {
  const row = (rawRow ?? {}) as Record<string, unknown>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!name) return []

  const isCritical = row.isCritical === true
  const isMilestone = row.isMilestone === true
  const explicitComplete = row.explicitComplete === true

  const runsRaw = Array.isArray(row.runs) ? row.runs : []
  const runs = runsRaw.length > 0
    ? runsRaw
    // If the model forgot to emit runs[], synthesize one from any top-level
    // fields it may have dropped in by accident.
    : [{
        wbs: row.wbs,
        startDate: row.startDate,
        endDate: row.endDate,
        isBehind: row.isBehind,
      }]

  const out: ExtractedActivity[] = []
  runs.forEach((r, i) => {
    const run = (r ?? {}) as Record<string, unknown>
    const startDate = typeof run.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(run.startDate) ? run.startDate : ''
    const endDate = typeof run.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(run.endDate) ? run.endDate : ''
    let duration = 0
    if (startDate && endDate) {
      const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
      duration = Math.max(0, Math.round(ms / 86_400_000))
    }
    const wbs = canonicalizeWbs(typeof run.wbs === 'string' ? run.wbs : null)
    const rawIsBehind = run.isBehind === true
    const derived = deriveProgress({
      startDate, endDate, dataDate,
      isBehind: rawIsBehind, explicitComplete,
    })

    out.push({
      id: `pdf_${startIdx + i + 1}`,
      name,
      wbs,
      startDate,
      endDate,
      duration,
      percentComplete: derived.percentComplete,
      predecessors: [],
      isCritical,
      isMilestone,
      isBehind: derived.isBehind,
      totalFloat: null,
    })
  })
  return out
}

// Canonicalize wbs strings so Gemini's inconsistent tile outputs all end up
// in the same bucket on the client. Handles:
//   "A1"  → "Building A / Section 1"
//   "CL"  → "Clubhouse"
//   "Building A/Section 1" → "Building A / Section 1"  (spacing fix)
//   "Building A / Section 1" → unchanged
//   null / ''  → null
function canonicalizeWbs(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  // Short-form zone codes: single letter + digit, e.g. "A1", "B2", "D4".
  const zone = /^([A-Z])\s*([1-9])$/i.exec(s)
  if (zone) {
    return `Building ${zone[1].toUpperCase()} / Section ${zone[2]}`
  }
  // Clubhouse code.
  if (/^(cl|clubhouse)$/i.test(s)) return 'Clubhouse'
  // Normalize spacing around slash.
  const parts = s.split('/').map((p) => p.trim()).filter((p) => p.length > 0)
  if (parts.length >= 2) return parts.join(' / ')
  // Fall through: return trimmed as-is.
  return s
}

function normalizeResponse(raw: Record<string, unknown>): ExtractedSchedule {
  // Extract dataDate first so expandRow can use it for progress derivation.
  const dataDate = typeof raw.dataDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dataDate)
    ? raw.dataDate
    : null

  // Compact (preferred) shape: top-level rows[] with nested runs[].
  const rawRows = Array.isArray(raw.rows) ? raw.rows : null
  // Legacy shape: flat activities[]. Still supported in case Gemini ignores
  // the schema or the partial-JSON repair recovers from an older run.
  const rawActs = !rawRows && Array.isArray(raw.activities) ? raw.activities : null

  let activities: ExtractedActivity[] = []

  if (rawRows) {
    let idx = 0
    for (const row of rawRows) {
      const expanded = expandRow(row, idx, dataDate)
      activities.push(...expanded)
      idx += expanded.length
    }
  } else if (rawActs) {
    // Legacy path: still rewrite percentComplete from dates vs dataDate so
    // we don't trust Gemini's pixel guess even in the fallback.
    activities = rawActs
      .map((a, i) => normalizeActivity(a, i))
      .filter((a) => a.name.length > 0)
      .map((a) => {
        const derived = deriveProgress({
          startDate: a.startDate,
          endDate: a.endDate,
          dataDate,
          isBehind: a.isBehind,
          explicitComplete: a.percentComplete >= 100, // best guess
        })
        return { ...a, percentComplete: derived.percentComplete, isBehind: derived.isBehind }
      })
  }

  activities = activities.filter((a) => a.name.length > 0)

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string')
    : []

  return {
    projectName: typeof raw.projectName === 'string' ? raw.projectName : 'PDF Schedule Import',
    dataDate: dataDate ?? new Date().toISOString().split('T')[0],
    activities,
    warnings,
  }
}

// ── Job row helpers (service-role REST against PostgREST) ─────
// We write to schedule_import_jobs via direct HTTP because the supabase-js
// client mishandles ES256 anon keys (see top-of-file comment).

async function insertJobRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  row: {
    project_id: string
    user_id: string
    filename: string
  },
): Promise<string> {
  const res = await fetch(`${supabaseUrl}/rest/v1/schedule_import_jobs`, {
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
    console.error(`[extract-schedule-pdf] insertJobRow failed (${res.status}): ${body.slice(0, 200)}`)
    throw new HttpError(500, `Failed to create job row: HTTP ${res.status}`)
  }
  const rows = await res.json() as Array<{ id?: string }>
  const id = Array.isArray(rows) ? rows[0]?.id : undefined
  if (!id) throw new HttpError(500, 'insertJobRow returned no id')
  return id
}

async function updateJobRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/schedule_import_jobs?id=eq.${jobId}`, {
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
    console.error(`[extract-schedule-pdf] updateJobRow ${jobId} failed (${res.status}): ${body.slice(0, 200)}`)
  }
}

// ── Background extraction task ────────────────────────────────
// Runs after the 202 response is sent. Bounded only by the Edge Runtime's
// wall-clock budget (~150s on free tier), not by the 25s gateway timeout.

// ── Single-source extraction (one Gemini call) ────────────────
// Factored out so both the legacy pdf_url path and the new per-tile path
// share the same fetch → base64 → Gemini → normalize pipeline.

async function extractOneSource(args: {
  geminiKey: string
  model: string
  sourceUrl?: string
  sourceB64?: string
  label: string // for logging, e.g. "p1/b0" or "pdf"
}): Promise<ExtractedSchedule> {
  const { geminiKey, model, sourceUrl, sourceB64, label } = args

  let fileBuffer: ArrayBuffer
  let mimeType: string
  if (sourceUrl) {
    const fetched = await fetchFromUrl(sourceUrl)
    fileBuffer = fetched.buffer
    mimeType = fetched.mimeType
  } else if (sourceB64) {
    fileBuffer = base64ToArrayBuffer(sourceB64)
    mimeType = 'application/pdf'
  } else {
    throw new HttpError(400, 'No source URL or base64 for tile ' + label)
  }

  if (fileBuffer.byteLength > MAX_PDF_BYTES) {
    throw new HttpError(
      413,
      `File too large (${(fileBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Max ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
    )
  }
  if (fileBuffer.byteLength < 100) {
    throw new HttpError(400, `Tile ${label} is empty or too small to be valid`)
  }

  console.log(`[extract-schedule-pdf] tile=${label} loaded ${(fileBuffer.byteLength / 1024).toFixed(0)} KB, calling Gemini ${model}`)
  const geminiResp = await callGeminiInline(geminiKey, model, fileBuffer, mimeType)
  const candidate = geminiResp.candidates?.[0]
  const text = candidate?.content?.parts?.[0]?.text ?? ''
  const finishReason = candidate?.finishReason ?? 'UNKNOWN'
  console.log(`[extract-schedule-pdf] tile=${label} finishReason=${finishReason} textLen=${text.length}`)
  if (!text) {
    throw new GeminiExtractError(
      502,
      `Gemini returned an empty response for tile ${label} (finishReason=${finishReason})`,
      '',
      finishReason,
    )
  }

  try {
    const parsed = extractJson(text)
    const normalized = normalizeResponse(parsed)
    console.log(
      `[extract-schedule-pdf] tile=${label} parsedRows=${Array.isArray((parsed as Record<string, unknown>).rows) ? ((parsed as { rows: unknown[] }).rows.length) : 'n/a'} ` +
      `expandedActivities=${normalized.activities.length}`,
    )
    return normalized
  } catch (err) {
    // Surface the raw Gemini text so we can diagnose schema drift/truncation
    // from the job row's error_message without re-running.
    const msg = err instanceof Error ? err.message : String(err)
    throw new GeminiExtractError(
      502,
      `Tile ${label} parse failed (finishReason=${finishReason}): ${msg}`,
      text,
      finishReason,
    )
  }
}

// Error type that carries the raw Gemini response text. Used to surface
// forensic info in job row error_message + tile warnings.
class GeminiExtractError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly rawText: string,
    public readonly finishReason: string,
  ) {
    super(message)
  }
}

// Concurrency-limited Promise.allSettled. Keeps us from burst-firing
// 10 Gemini calls at once and tripping rate limits.
async function allSettledWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<unknown>,
): Promise<Array<PromiseSettledResult<unknown>>> {
  const results: Array<PromiseSettledResult<unknown>> = new Array(items.length)
  let nextIdx = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = nextIdx++
      if (i >= items.length) return
      try {
        const value = await fn(items[i], i)
        results[i] = { status: 'fulfilled', value }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  })
  await Promise.all(workers)
  return results
}

// Merge the ExtractedSchedule outputs of multiple tiles. Dedupe by
// (lower(name) + startDate), preferring entries with non-null wbs and
// longer (more specific) wbs strings. Renumbers ids sequentially.
function mergeExtractedSchedules(parts: ExtractedSchedule[]): ExtractedSchedule {
  type Key = string
  const byKey = new Map<Key, ExtractedActivity>()

  const keyOf = (a: ExtractedActivity): Key => {
    const n = a.name.trim().toLowerCase()
    const w = (a.wbs ?? '').trim().toLowerCase()
    // Include wbs in the key so per-zone rows ("CARPET" in A1 vs B2) stay
    // distinct even though they share a name. Overlap dedupe still works
    // because both tiles emit the same (name, wbs, startDate) triple.
    return a.startDate ? `${n}|${w}|${a.startDate}` : `n:${n}|${w}`
  }

  for (const part of parts) {
    for (const a of part.activities) {
      const k = keyOf(a)
      const existing = byKey.get(k)
      if (!existing) {
        byKey.set(k, a)
        continue
      }
      // Merge: prefer non-null wbs; between two non-null, prefer the longer one.
      const mergedWbs = (() => {
        if (!existing.wbs) return a.wbs
        if (!a.wbs) return existing.wbs
        return a.wbs.length > existing.wbs.length ? a.wbs : existing.wbs
      })()
      // Prefer existing for everything else — first occurrence wins.
      byKey.set(k, { ...existing, wbs: mergedWbs })
    }
  }

  // Second pass: within each (name, wbs) group, collapse date ranges that
  // touch or overlap (≤7 day gap). Handles the case where a per-zone run
  // like "CARPET in Building A / Section 1" straddles a band boundary and
  // gets emitted as two fragments from adjacent tiles.
  const dedupedList = Array.from(byKey.values())
  type GroupKey = string
  const groupOf = (a: ExtractedActivity): GroupKey => {
    const n = a.name.trim().toLowerCase()
    const w = (a.wbs ?? '').trim().toLowerCase()
    return `${n}|${w}`
  }
  const groups = new Map<GroupKey, ExtractedActivity[]>()
  for (const a of dedupedList) {
    const g = groupOf(a)
    const list = groups.get(g) ?? []
    list.push(a)
    groups.set(g, list)
  }

  const daysBetween = (a: string, b: string): number => {
    if (!a || !b) return Number.POSITIVE_INFINITY
    const d = new Date(b).getTime() - new Date(a).getTime()
    return Math.floor(d / 86_400_000)
  }

  const collapsed: ExtractedActivity[] = []
  for (const list of groups.values()) {
    if (list.length === 1) {
      collapsed.push(list[0])
      continue
    }
    // Sort by startDate asc (empty dates last).
    list.sort((x, y) => {
      if (!x.startDate) return 1
      if (!y.startDate) return -1
      return x.startDate.localeCompare(y.startDate)
    })
    let cur = { ...list[0] }
    for (let i = 1; i < list.length; i++) {
      const next = list[i]
      const gap = daysBetween(cur.endDate, next.startDate)
      if (gap <= 7) {
        // Merge: extend endDate to the latest, keep earliest startDate.
        cur = {
          ...cur,
          endDate: (next.endDate && next.endDate > cur.endDate) ? next.endDate : cur.endDate,
          percentComplete: Math.max(cur.percentComplete, next.percentComplete),
          isBehind: cur.isBehind || next.isBehind,
          isCritical: cur.isCritical || next.isCritical,
          isMilestone: cur.isMilestone || next.isMilestone,
        }
      } else {
        collapsed.push(cur)
        cur = { ...next }
      }
    }
    collapsed.push(cur)
  }

  const merged = collapsed.map((a, i) => ({ ...a, id: `pdf_${i + 1}` }))

  const projectName = parts.find((p) => p.projectName && p.projectName !== 'PDF Schedule Import')?.projectName
    ?? parts[0]?.projectName ?? 'PDF Schedule Import'
  const dataDate = parts.find((p) => p.dataDate)?.dataDate ?? new Date().toISOString().split('T')[0]
  const warnings = parts.flatMap((p) => p.warnings)

  return { projectName, dataDate, activities: merged, warnings }
}

async function runExtraction(args: {
  supabaseUrl: string
  serviceRoleKey: string
  jobId: string
  geminiKey: string
  model: string
  pdfUrl?: string
  pdfB64?: string
  tiles?: TileRequest[]
  filename: string
}): Promise<void> {
  const {
    supabaseUrl, serviceRoleKey, jobId, geminiKey, model, pdfUrl, pdfB64, tiles, filename,
  } = args

  await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  try {
    let merged: ExtractedSchedule
    const failureWarnings: string[] = []

    if (tiles && tiles.length > 0) {
      // Tile mode — fan out with concurrency cap, merge on the way out.
      console.log(`[extract-schedule-pdf] job=${jobId} fanning out ${tiles.length} tiles`)
      const perTile: ExtractedSchedule[] = []
      const settled = await allSettledWithConcurrency(tiles, TILE_CONCURRENCY, async (t) => {
        return await extractOneSource({
          geminiKey,
          model,
          sourceUrl: t.signed_url,
          label: `p${t.page}/b${t.band}`,
        })
      })
      settled.forEach((r, idx) => {
        const t = tiles[idx]
        const label = `p${t.page}/b${t.band}`
        if (r.status === 'fulfilled') {
          perTile.push(r.value as ExtractedSchedule)
        } else {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.warn(`[extract-schedule-pdf] job=${jobId} tile ${label} failed: ${reason}`)
          failureWarnings.push(`Skipped tile ${label}: ${reason.slice(0, 200)}`)

          // If this was a GeminiExtractError, capture the first 2 KB of the
          // raw Gemini response so we can diagnose schema drift / truncation
          // from the job row's error_message / result_json.warnings without
          // re-running.
          if (r.reason instanceof GeminiExtractError && r.reason.rawText) {
            const snippet = r.reason.rawText.slice(0, 2048).replace(/\s+/g, ' ')
            console.warn(`[extract-schedule-pdf] job=${jobId} tile ${label} rawGemini=${snippet}`)
            failureWarnings.push(
              `Tile ${label} raw Gemini (finishReason=${r.reason.finishReason}): ${snippet}`,
            )
          }
        }
      })

      if (perTile.length === 0) {
        throw new HttpError(502, `All ${tiles.length} tiles failed. First error: ${failureWarnings[0] ?? 'unknown'}`)
      }

      merged = mergeExtractedSchedules(perTile)
    } else {
      // Legacy single-source path.
      merged = await extractOneSource({ geminiKey, model, sourceUrl: pdfUrl, sourceB64: pdfB64, label: 'pdf' })
    }

    if (merged.activities.length === 0) {
      throw new HttpError(
        422,
        'No schedule activities could be extracted from this PDF. ' +
        'The document may not contain a Gantt chart, or the quality may be too low.',
      )
    }

    const result: ImportResult = {
      activities: merged.activities,
      calendars: [],
      projectName: merged.projectName,
      dataDate: merged.dataDate,
      warnings: [
        `AI-extracted ${merged.activities.length} activities from ${filename}.`,
        ...failureWarnings,
        ...merged.warnings,
      ],
      format: 'pdf',
    }

    await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
      status: 'done',
      result_json: result,
      finished_at: new Date().toISOString(),
    })
    console.log(`[extract-schedule-pdf] job=${jobId} done (${merged.activities.length} activities)`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error during extraction'
    console.error(`[extract-schedule-pdf] job=${jobId} error: ${message}`)
    await updateJobRow(supabaseUrl, serviceRoleKey, jobId, {
      status: 'error',
      error_message: message,
      finished_at: new Date().toISOString(),
    })
  }
}

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  const headers = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    console.log('[extract-schedule-pdf] request received')

    // Required env
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    // Default to Pro — Flash's vision accuracy on hatched-Gantt bars is not
    // sufficient for construction schedules; Pro reads cells correctly.
    // Per-tile timeout (150s) + Pro wall-clock (400s) gives plenty of runway.
    // Override via GEMINI_MODEL_NAME env var.
    const model = Deno.env.get('GEMINI_MODEL_NAME') ?? 'gemini-2.5-pro'

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new HttpError(500, 'Supabase env vars missing')
    }
    if (!geminiKey) {
      throw new HttpError(500, 'GEMINI_API_KEY not configured')
    }

    // Body parse — user token lives in the body, NOT the Authorization header.
    // This keeps the ES256 user JWT away from the Edge Runtime's boot-level
    // parser (which throws UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM). The
    // apikey header identifies the project at the gateway layer.
    const contentType = req.headers.get('Content-Type') || ''
    if (!contentType.includes('application/json')) {
      throw new HttpError(415, 'Content-Type must be application/json')
    }
    const body = await req.json() as ExtractRequest
    const projectId = requireUuid(body.project_id, 'project_id')
    const userToken = typeof body.user_token === 'string' ? body.user_token.trim() : ''
    if (!userToken) {
      throw new HttpError(401, 'Missing user_token in body')
    }
    const pdfUrl = typeof body.pdf_url === 'string' ? body.pdf_url.trim() : ''
    const pdfB64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64 : ''
    const tiles = Array.isArray(body.tiles)
      ? body.tiles
          .filter((t): t is TileRequest =>
            !!t && typeof t.signed_url === 'string' && t.signed_url.length > 0
            && Number.isFinite(t.page) && Number.isFinite(t.band))
      : []
    const filename = typeof body.filename === 'string' && body.filename.length > 0
      ? body.filename
      : 'schedule.pdf'
    if (tiles.length === 0 && !pdfUrl && !pdfB64) {
      throw new HttpError(400, 'Either tiles[], pdf_url, or pdf_base64 is required')
    }

    const mode = tiles.length > 0 ? `tiles:${tiles.length}` : (pdfUrl ? 'url' : 'base64')
    console.log(`[extract-schedule-pdf] project=${projectId} filename=${filename} mode=${mode}`)

    // Validate token + membership synchronously so we can fail fast with 401/403.
    const user = await validateToken(supabaseUrl, anonKey, userToken)
    await checkProjectMembership(supabaseUrl, serviceRoleKey, user.id, projectId)

    // Create a job row and kick off the Gemini extraction in the background.
    // The client subscribes to this row via Supabase realtime and waits for
    // status=done|error.
    const jobId = await insertJobRow(supabaseUrl, serviceRoleKey, {
      project_id: projectId,
      user_id: user.id,
      filename,
    })

    // @ts-expect-error — EdgeRuntime is a global provided by Supabase Edge Runtime
    EdgeRuntime.waitUntil(runExtraction({
      supabaseUrl,
      serviceRoleKey,
      jobId,
      geminiKey,
      model,
      pdfUrl: pdfUrl || undefined,
      pdfB64: pdfB64 || undefined,
      tiles: tiles.length > 0 ? tiles : undefined,
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
