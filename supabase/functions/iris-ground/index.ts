// ─────────────────────────────────────────────────────────────────────────────
// iris-ground — three-LLM parallel grounding for an entity (RFI / Submittal / CO)
// ─────────────────────────────────────────────────────────────────────────────
// Returns three lanes for a single entity, computed concurrently and capped at
// a 4-second per-call timeout so the function lands well under 5s p95:
//
//   • project   — Claude reasoning over the entity's project context.
//   • world     — Perplexity code/standards lookup with jurisdiction +
//                 spec-section search context (real-time web).
//   • structure — GPT-4o classification with a JSON schema for cost +
//                 citation extraction.
//
// Partial failures are intentional: one provider down should not strand the
// other two. The UI (Session A) renders each lane independently and shows a
// "lane unavailable" placeholder for any slot that returned null.
//
// Audit: every successful invocation writes one row to `activity_feed` with
// `type='iris_ground'`, mirroring the shape of `runSubmittalApprovedChain`
// in src/lib/crossFeatureWorkflows.ts. Metadata records the provider/model
// IDs, per-call latency, and the entity reference so downstream UI can
// surface "grounded N times" without re-querying the providers.
//
// Schema notes (Session C owns migrations):
//   • activity_feed.type has a CHECK constraint that may not yet include
//     'iris_ground'. The insert is fail-soft — we log the error and still
//     return the lanes to the caller. This matches the `runSubmittalApproved
//     Chain` pattern; the constraint is widened in a separate migration.
//   • iris_grounding_cache (Session C migration 20260430_iris_grounding_cache):
//     consulted on every request. Hit + fresh (<24h, fingerprint match)
//     returns immediately with `cached: true`. Miss falls through to the
//     live three-lane fan-out, then upserts the result. Cache writes are
//     fail-soft — a write failure must not break a successful response.
//
// ─────────────────────────────────────────────────────────────────────────────
// Verification (run after `supabase functions deploy iris-ground` to staging):
//
//   JWT=$(supabase auth ... | jq -r .access_token)
//   RFI_ID=<demo RFI #15 uuid>
//
//   curl -s -w '\n[%{time_total}s]' \
//     -X POST "$SUPABASE_URL/functions/v1/iris-ground" \
//     -H "Authorization: Bearer $JWT" \
//     -H "Content-Type: application/json" \
//     -d "{\"entity_type\":\"rfi\",\"entity_id\":\"$RFI_ID\"}" | jq
//
// Expected:
//   • Status 200, latency_ms < 5000 (p95).
//   • Three keys: project, world, structure — each either an AIResponse
//     object or null with a sibling `error` field.
//   • A new row in activity_feed where metadata->>'source' = 'iris_ground'
//     and metadata->'lanes' contains three provider/model IDs.
// ─────────────────────────────────────────────────────────────────────────────

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
import {
  routeAIParallel,
  type AIRequest,
  type AIResponse,
  type ParallelAIResult,
} from '../shared/aiRouter.ts'

// ── Request / Response shapes ────────────────────────────────────────────────

type EntityType = 'rfi' | 'submittal' | 'co'

interface GroundRequest {
  entity_type: EntityType
  entity_id: string
}

interface LaneResult {
  /** Provider response when the call settled; null on timeout/rejection. */
  response: AIResponse | null
  /** Mutually exclusive with response. */
  error: { kind: 'timeout' | 'rejected'; message: string } | null
  latency_ms: number
}

interface GroundResponse {
  project: LaneResult
  world: LaneResult
  structure: LaneResult
  latency_ms: number
  cached: boolean
}

// Loaded entity rows are loose-typed; field availability differs per table.
// The three prompt builders pull only what they need.
type EntityRow = Record<string, unknown>

// ── Constants ────────────────────────────────────────────────────────────────

// 4s per call leaves headroom for the audit insert + JSON serialization
// before the 5s p95 budget. Tuned for staging; adjust if Perplexity gets
// slower in prod.
const PER_CALL_TIMEOUT_MS = 4000

// 24h TTL for cached grounding results. Enforced in code (not the schema)
// so a future fingerprint bump or schema change can invalidate retroactively
// without a backfill. See migration 20260430_iris_grounding_cache.sql.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// JSON schema for the structure lane. Strict mode is intentional — we want
// the model to refuse rather than fabricate when it can't extract.
const STRUCTURE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['citations', 'impact_dollars', 'confidence', 'sources'],
  properties: {
    citations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Code sections, spec paragraphs, drawing refs cited in the entity.',
    },
    impact_dollars: {
      type: ['number', 'null'],
      description: 'Estimated dollar impact, null if not inferable.',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Model self-rated confidence in the extraction.',
    },
    sources: {
      type: 'array',
      items: { type: 'string' },
      description: 'Source labels — RFI numbers, drawing refs, spec sections.',
    },
  },
} as const

// ── Entity loading ───────────────────────────────────────────────────────────

interface LoadedEntity {
  row: EntityRow
  project_id: string
  display_label: string
  spec_section: string | null
  jurisdiction: string | null
  applicable_codes: string[]
}

async function loadEntity(
  // Loose-typed because Supabase generated types lag behind some columns
  // (e.g. jurisdiction / applicable_codes added in later migrations).
  // deno-lint-ignore no-explicit-any
  supabase: any,
  entityType: EntityType,
  entityId: string,
): Promise<LoadedEntity> {
  let row: EntityRow | null = null

  if (entityType === 'rfi') {
    const { data, error } = await supabase
      .from('rfis')
      .select('id, project_id, number, title, description, spec_section, jurisdiction, applicable_codes, drawing_reference, status, priority')
      .eq('id', entityId)
      .maybeSingle()
    if (error) throw new HttpError(500, `Failed to load RFI: ${error.message}`)
    row = data
  } else if (entityType === 'submittal') {
    const { data, error } = await supabase
      .from('submittals')
      .select('id, project_id, number, title, spec_section, subcontractor, status, lead_time_weeks, jurisdiction, applicable_codes')
      .eq('id', entityId)
      .maybeSingle()
    if (error) throw new HttpError(500, `Failed to load submittal: ${error.message}`)
    row = data
  } else if (entityType === 'co') {
    const { data, error } = await supabase
      .from('change_orders')
      .select('id, project_id, number, title, description, type, reason, amount, status, jurisdiction, applicable_codes')
      .eq('id', entityId)
      .maybeSingle()
    if (error) throw new HttpError(500, `Failed to load change order: ${error.message}`)
    row = data
  } else {
    throw new HttpError(400, `Unsupported entity_type: ${entityType}`)
  }

  if (!row) {
    throw new HttpError(404, `${entityType} ${entityId} not found`)
  }

  const projectId = row.project_id as string | undefined
  if (!projectId) {
    throw new HttpError(500, `${entityType} ${entityId} has no project_id`)
  }

  // Build a stable display label so the audit row is human-scannable.
  const numberPart = row.number != null ? `#${String(row.number)}` : ''
  const titlePart = (row.title as string | undefined) ?? ''
  const display_label = `${entityType.toUpperCase()}${numberPart ? ' ' + numberPart : ''}${titlePart ? ' — ' + titlePart : ''}`.trim()

  return {
    row,
    project_id: projectId,
    display_label,
    spec_section: (row.spec_section as string | null) ?? null,
    jurisdiction: (row.jurisdiction as string | null) ?? null,
    applicable_codes: Array.isArray(row.applicable_codes)
      ? (row.applicable_codes as string[])
      : [],
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildProjectPrompt(entityType: EntityType, entity: LoadedEntity): AIRequest {
  const desc =
    (entity.row.description as string | undefined) ??
    (entity.row.body as string | undefined) ??
    ''
  return {
    task: 'reasoning',
    system:
      'You are a construction project analyst. Read the entity below and write 2–3 short paragraphs grounding it in the project: what it depends on, who is in the ball-in-court, the most likely failure modes if it stalls. Cite drawing refs and spec sections inline. No hedging, no lists.',
    messages: [
      {
        role: 'user',
        content:
          `Entity: ${entity.display_label}\n` +
          `Spec section: ${entity.spec_section ?? 'n/a'}\n` +
          `Drawing reference: ${(entity.row.drawing_reference as string | null) ?? 'n/a'}\n` +
          `Status: ${(entity.row.status as string | null) ?? 'n/a'}\n` +
          `Priority: ${(entity.row.priority as string | null) ?? 'n/a'}\n\n` +
          `Description / body:\n${desc || '(none provided)'}`,
      },
    ],
    max_tokens: 600,
    temperature: 0.3,
  }
}

function buildWorldPrompt(_entityType: EntityType, entity: LoadedEntity): AIRequest {
  const codes = entity.applicable_codes.length > 0
    ? entity.applicable_codes.join(', ')
    : 'IBC 2021, NFPA 13'
  const searchContextParts: string[] = []
  if (entity.jurisdiction) searchContextParts.push(`Jurisdiction: ${entity.jurisdiction}`)
  if (entity.spec_section) searchContextParts.push(`CSI spec section: ${entity.spec_section}`)
  if (entity.applicable_codes.length > 0) searchContextParts.push(`Applicable codes: ${codes}`)
  const searchContext = searchContextParts.join(' · ')

  return {
    task: 'code_lookup',
    system:
      'You are a construction code researcher. Find the authoritative code, standard, or jurisdictional rule that governs the entity below. Cite section numbers, year of publication, and source URLs. If multiple jurisdictions apply, name them. Keep it under 200 words.',
    messages: [
      {
        role: 'user',
        content:
          `Entity: ${entity.display_label}\n` +
          `Spec section: ${entity.spec_section ?? 'n/a'}\n` +
          `Jurisdiction: ${entity.jurisdiction ?? 'unspecified'}\n` +
          `Applicable codes: ${codes}\n\n` +
          `Question: which code/standard sections govern this work, and what do they require?`,
      },
    ],
    search_context: searchContext || undefined,
    max_tokens: 600,
    temperature: 0.2,
  }
}

function buildStructurePrompt(entityType: EntityType, entity: LoadedEntity): AIRequest {
  const desc =
    (entity.row.description as string | undefined) ??
    (entity.row.body as string | undefined) ??
    ''
  // For change orders we surface the recorded amount as a hint; the model
  // can override it if context implies a different impact.
  const amountHint =
    entityType === 'co' && entity.row.amount != null
      ? `Recorded amount (cents, may be inaccurate): ${String(entity.row.amount)}`
      : null

  return {
    task: 'classification',
    system:
      'Extract structured fields from the construction entity below. Return STRICT JSON matching the provided schema — no prose, no markdown. confidence must be your honest self-rating in [0,1]. impact_dollars is null when no dollar impact is inferable.',
    messages: [
      {
        role: 'user',
        content:
          `Entity: ${entity.display_label}\n` +
          `Spec section: ${entity.spec_section ?? 'n/a'}\n` +
          (amountHint ? `${amountHint}\n` : '') +
          `\nDescription:\n${desc || '(none provided)'}`,
      },
    ],
    json_schema: STRUCTURE_JSON_SCHEMA,
    max_tokens: 400,
    temperature: 0.0,
  }
}

// ── Cache layer (iris_grounding_cache) ──────────────────────────────────────
// Stable hash of the entity content the providers would see. An RFI edit
// changes the fingerprint, invalidating the cache without a separate bust.
async function fingerprintEntity(entity: LoadedEntity): Promise<string> {
  const desc =
    (entity.row.description as string | undefined) ??
    (entity.row.body as string | undefined) ??
    ''
  const material = [
    entity.display_label,
    entity.spec_section ?? '',
    entity.jurisdiction ?? '',
    [...entity.applicable_codes].sort().join('|'),
    desc,
  ].join('\n')
  const bytes = new TextEncoder().encode(material)
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

interface CacheRow {
  response: GroundResponse
  fingerprint: string
  created_at: string
}

async function readCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  entityType: EntityType,
  entityId: string,
): Promise<CacheRow | null> {
  const { data, error } = await supabase
    .from('iris_grounding_cache')
    .select('response, fingerprint, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (error || !data) return null
  return data as CacheRow
}

function isCacheFresh(row: CacheRow, fingerprint: string): boolean {
  if (row.fingerprint !== fingerprint) return false
  const age = Date.now() - new Date(row.created_at).getTime()
  return age >= 0 && age < CACHE_TTL_MS
}

async function writeCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  entityType: EntityType,
  entityId: string,
  response: GroundResponse,
  fingerprint: string,
): Promise<void> {
  const { error } = await supabase.from('iris_grounding_cache').upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      response,
      fingerprint,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'entity_type,entity_id' },
  )
  if (error) {
    // Cache write failures must not turn a successful grounding into a 500.
    console.warn('[iris-ground] cache write failed (non-fatal):', error.message)
  }
}

// ── Audit insert ─────────────────────────────────────────────────────────────
// Mirrors runSubmittalApprovedChain shape: project_id, type, title, body,
// metadata. Fail-soft: a CHECK constraint mismatch on `type` is logged, not
// thrown — the caller still gets the lane response.
async function recordAudit(params: {
  // deno-lint-ignore no-explicit-any
  supabase: any
  userId: string
  projectId: string
  entityType: EntityType
  entityId: string
  displayLabel: string
  results: ParallelAIResult[]
  totalLatencyMs: number
}): Promise<void> {
  const lanes = params.results.map((r) => ({
    task: r.task,
    provider: r.response?.provider ?? null,
    model: r.response?.model ?? null,
    latency_ms: r.latency_ms,
    ok: r.response !== null,
    error: r.error,
  }))

  const body =
    `Iris grounded ${params.displayLabel} across ${lanes.length} lanes ` +
    `(${lanes.filter((l) => l.ok).length} succeeded) in ${params.totalLatencyMs}ms.`

  const { error } = await params.supabase
    .from('activity_feed')
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      type: 'iris_ground',
      title: `Grounded — ${params.displayLabel}`,
      body,
      metadata: {
        source: 'iris_ground',
        entity_type: params.entityType,
        entity_id: params.entityId,
        total_latency_ms: params.totalLatencyMs,
        lanes,
      },
    })

  if (error) {
    // Most likely cause: activity_feed.type CHECK constraint hasn't been
    // widened to include 'iris_ground' yet. Session C owns the migration.
    // We log and continue — the demo path doesn't depend on the audit row
    // landing for the response to be useful.
    console.warn('[iris-ground] audit insert failed (non-fatal):', error.message)
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  const requestStart = Date.now()

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<GroundRequest>(req)

    // Validate inputs.
    const entityType = body.entity_type
    if (entityType !== 'rfi' && entityType !== 'submittal' && entityType !== 'co') {
      throw new HttpError(400, "entity_type must be 'rfi', 'submittal', or 'co'")
    }
    const entityId = requireUuid(body.entity_id, 'entity_id')

    // Load entity + verify project membership before spending tokens.
    const entity = await loadEntity(supabase, entityType, entityId)
    await verifyProjectMembership(supabase, user.id, entity.project_id)

    // ── Cache check ────────────────────────────────────────────────────────
    // Demo-grade safety net: a fresh cache row turns a 5s three-provider
    // fan-out into a <50ms read. RLS on the table is project-scoped, but we
    // already verified membership above so the service-role read is safe.
    const fingerprint = await fingerprintEntity(entity)
    const cached = await readCache(supabase, entityType, entityId)
    if (cached && isCacheFresh(cached, fingerprint)) {
      const payload: GroundResponse = { ...cached.response, cached: true }
      return new Response(JSON.stringify(payload), {
        headers: {
          ...getCorsHeaders(req),
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=60',
        },
      })
    }

    // Build the three task-specific requests in input order:
    //   [0] reasoning  → project lane
    //   [1] code_lookup → world lane
    //   [2] classification → structure lane
    const tasks: AIRequest[] = [
      buildProjectPrompt(entityType, entity),
      buildWorldPrompt(entityType, entity),
      buildStructurePrompt(entityType, entity),
    ]

    const results = await routeAIParallel({
      tasks,
      timeoutMs: PER_CALL_TIMEOUT_MS,
      // Disable router-level fallbacks so the per-call timeout caps wall
      // clock cleanly — we'd rather return a partial than silently chain
      // through a slower secondary on the critical path.
      config: { fallback_enabled: false },
    })

    const [project, world, structure] = results

    const totalLatencyMs = Date.now() - requestStart

    // Fire-and-forget audit row. We wait for it (cheap insert) so the
    // response payload has the same view of "grounded N times" the UI
    // would re-fetch — but the await is bounded by Supabase, not by
    // any external provider.
    await recordAudit({
      supabase,
      userId: user.id,
      projectId: entity.project_id,
      entityType,
      entityId,
      displayLabel: entity.display_label,
      results,
      totalLatencyMs,
    })

    const response: GroundResponse = {
      project: laneOf(project),
      world: laneOf(world),
      structure: laneOf(structure),
      latency_ms: totalLatencyMs,
      cached: false,
    }

    // Cache the fresh result for the next ≤24h. Only cache when at least one
    // lane succeeded — otherwise we'd serve a useless "all lanes failed"
    // payload to subsequent demo clicks. Fail-soft on cache write.
    const anyLaneOk =
      response.project.response !== null ||
      response.world.response !== null ||
      response.structure.response !== null
    if (anyLaneOk) {
      await writeCache(supabase, entityType, entityId, response, fingerprint)
    }

    return new Response(JSON.stringify(response), {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }
})

function laneOf(r: ParallelAIResult): LaneResult {
  return {
    response: r.response,
    error: r.error,
    latency_ms: r.latency_ms,
  }
}
