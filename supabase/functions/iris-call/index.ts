// ─────────────────────────────────────────────────────────────────────────────
// iris-call — canonical AI call path for the SiteSync browser
// ─────────────────────────────────────────────────────────────────────────────
//
// Every browser-originated AI request flows through this function. It is the
// single chokepoint where:
//
//   1. Auth is verified (Bearer JWT → GoTrue).
//   2. Project membership is verified for project-scoped calls.
//   3. Rate limit is enforced (sliding window over audit_log).
//   4. Idempotency is honored (request hash → 24h cache).
//   5. The aiRouter selects the optimal provider per task type.
//   6. The response streams back to the browser via Server-Sent Events.
//   7. A row is appended to the audit_log hash chain on completion.
//
// API keys (Anthropic, OpenAI, Gemini, Perplexity) live in Supabase function
// secrets and are NEVER bundled into the browser. This is the security
// foundation of the deposition-grade story we sell investors.
//
// ── SSE protocol ────────────────────────────────────────────────────────────
// The function returns text/event-stream with these event types:
//
//   event: meta
//   data: { audit_id, idempotency_key, cached: bool, provider?, model? }
//
//   event: delta
//   data: { text }
//
//   event: done
//   data: { content, usage, latency_ms, provider, model, audit_id }
//
//   event: error
//   data: { message, retryable: bool }
//
// The client wrapper (src/lib/ai/callIris.ts) consumes these and exposes
// onMeta / onDelta / onDone / onError callbacks.
//
// ── Request shape ───────────────────────────────────────────────────────────
//
// POST /iris-call
// Authorization: Bearer <jwt>
// Content-Type: application/json
//
// {
//   task: 'reasoning' | 'classification' | 'code_lookup' | 'summarization' | ...,
//   prompt: string,                              // user message content
//   system?: string,                             // system prompt
//   project_id?: string,                         // for project-scoped audit + RLS
//   entity_type?: string,                        // for audit chain linkage
//   entity_id?: string,                          // for audit chain linkage
//   max_tokens?: number,
//   temperature?: number,
//   search_context?: string,                     // for code_lookup tasks
//   json_schema?: object,                        // for classification tasks
//   idempotency_key?: string,                    // optional caller-supplied key
// }
// ─────────────────────────────────────────────────────────────────────────────

import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  isValidUuid,
  sanitizeForPrompt,
} from '../shared/auth.ts'
import {
  routeAIStream,
  type AIRequest,
  type AITaskType,
  type StreamEvent,
} from '../shared/aiRouter.ts'

// ── Tunables ─────────────────────────────────────────────────────────────────

// Per-user sliding-window rate limit. 30 calls / 60 seconds is generous for
// interactive use (a user can't physically click that fast) but blocks a
// runaway script in the console. Bumped via env if a customer needs more.
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_CALLS = Number(Deno.env.get('IRIS_CALL_RATE_LIMIT') ?? '30')

// 24h idempotency TTL — long enough that retries within a working day hit
// cache, short enough that genuinely repeat questions get a fresh answer.
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

// Tasks the browser is allowed to invoke. `embedding` and `eval_judge` are
// server-internal; `vision` requires base64 images which are heavy to ship
// over the wire — push those callers to dedicated edge functions if needed.
const ALLOWED_TASKS: AITaskType[] = [
  'reasoning',
  'classification',
  'code_lookup',
  'summarization',
]

// ── Request types ────────────────────────────────────────────────────────────

interface CallRequest {
  task: AITaskType
  prompt: string
  system?: string
  project_id?: string
  entity_type?: string
  entity_id?: string
  max_tokens?: number
  temperature?: number
  search_context?: string
  json_schema?: object
  idempotency_key?: string
}

// ── Hashing ──────────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Deterministic request fingerprint. The idempotency key the client sends is
// trusted as a high-level identifier (a user's "I clicked Send once" token);
// the request_hash adds a second layer that catches identical inputs even
// when the client forgets to send a key.
async function fingerprintRequest(req: CallRequest, userId: string): Promise<string> {
  const material = JSON.stringify({
    user: userId,
    task: req.task,
    system: req.system ?? '',
    prompt: req.prompt,
    project_id: req.project_id ?? '',
    entity_type: req.entity_type ?? '',
    entity_id: req.entity_id ?? '',
    max_tokens: req.max_tokens ?? null,
    temperature: req.temperature ?? null,
    search_context: req.search_context ?? '',
    json_schema: req.json_schema ?? null,
  })
  return await sha256Hex(material)
}

// ── Idempotency ──────────────────────────────────────────────────────────────

interface CachedResponse {
  content: string
  usage: { input_tokens: number; output_tokens: number }
  latency_ms: number
  provider: string
  model: string
  audit_id: string
}

async function readIdempotencyCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  idempotencyKey: string,
  requestHash: string,
): Promise<CachedResponse | null> {
  const { data, error } = await supabase
    .from('iris_call_idempotency')
    .select('response, request_hash, created_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error || !data) return null

  // Belt-and-suspenders: an idempotency key that points at a different
  // payload should NOT serve the cached response — the client may have
  // reused the key for a new prompt by mistake. Treat as cache miss.
  if (data.request_hash !== requestHash) return null

  const age = Date.now() - new Date(data.created_at).getTime()
  if (age < 0 || age > IDEMPOTENCY_TTL_MS) return null

  return data.response as CachedResponse
}

async function writeIdempotencyCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  idempotencyKey: string,
  userId: string,
  requestHash: string,
  response: CachedResponse,
): Promise<void> {
  const { error } = await supabase.from('iris_call_idempotency').upsert(
    {
      idempotency_key: idempotencyKey,
      user_id: userId,
      request_hash: requestHash,
      response,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'idempotency_key' },
  )
  if (error) {
    // Cache write failures must not turn a successful call into a 500.
    console.warn('[iris-call] idempotency write failed (non-fatal):', error.message)
  }
}

// ── Rate limiting ────────────────────────────────────────────────────────────

async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('iris_call_count_recent', {
    p_user_id: userId,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  })
  if (error) {
    // If the rate-limit lookup fails we fail OPEN, not closed — a transient
    // DB hiccup shouldn't black out AI for users. Log loudly so it shows up
    // in Sentry / log review.
    console.warn('[iris-call] rate limit check failed (allowing through):', error.message)
    return
  }
  const count = typeof data === 'number' ? data : Number(data ?? 0)
  if (count >= RATE_LIMIT_MAX_CALLS) {
    throw new HttpError(
      429,
      `Rate limit exceeded: ${count}/${RATE_LIMIT_MAX_CALLS} calls in the last ${RATE_LIMIT_WINDOW_SECONDS}s. Try again in a minute.`,
      'rate_limit_exceeded',
    )
  }
}

// ── Audit write ──────────────────────────────────────────────────────────────
//
// Writes one row to audit_log with action='iris_call.generate'. The
// audit_log_hash_chain trigger SHA-256s it into the same chain that protects
// RFI / Submittal / CO history. Caller's user_id, the entity reference, the
// model used, the token usage, and the prompt + output hashes are all on the
// row so a future deposition can prove "user X asked Y at time T, model Z
// returned W."
//
// Returns the audit_log row id so the SSE response can include it.

async function writeAuditEntry(params: {
  // deno-lint-ignore no-explicit-any
  supabase: any
  userId: string
  userEmail: string | null
  projectId: string | null
  task: AITaskType
  provider: string
  model: string
  promptHash: string
  outputHash: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  entityType: string | null
  entityId: string | null
  cached: boolean
}): Promise<string> {
  const auditEntityType = params.entityType ?? 'iris_call'
  const auditEntityId = params.entityId ?? crypto.randomUUID()

  const { data, error } = await params.supabase
    .from('audit_log')
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      user_email: params.userEmail,
      entity_type: auditEntityType,
      entity_id: auditEntityId,
      action: 'iris_call.generate',
      metadata: {
        source: 'iris_call',
        task: params.task,
        provider: params.provider,
        model: params.model,
        prompt_hash: params.promptHash,
        output_hash: params.outputHash,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        latency_ms: params.latencyMs,
        cached: params.cached,
      },
    })
    .select('id')
    .single()

  if (error) {
    // The hash chain is load-bearing for the deposition story. If we can't
    // write to audit_log, we should NOT silently succeed — surface it.
    throw new HttpError(500, `Failed to write audit entry: ${error.message}`)
  }
  return data.id as string
}

// ── SSE helpers ──────────────────────────────────────────────────────────────

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function sseHeaders(req: Request): Record<string, string> {
  return {
    ...getCorsHeaders(req),
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  let body: CallRequest
  let user: { id: string; email: string }
  // deno-lint-ignore no-explicit-any
  let supabase: any

  try {
    const auth = await authenticateRequest(req)
    user = auth.user
    supabase = auth.supabase
    body = await parseJsonBody<CallRequest>(req)

    // Validate task type.
    if (!ALLOWED_TASKS.includes(body.task)) {
      throw new HttpError(
        400,
        `task must be one of ${ALLOWED_TASKS.join(', ')} — got '${body.task}'`,
      )
    }

    // Validate prompt.
    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      throw new HttpError(400, 'prompt is required and must be a non-empty string')
    }

    // Sanitize free-text inputs so a hostile prompt can't carry HTML/script
    // through the audit log into a downstream surface that renders metadata.
    body.prompt = sanitizeForPrompt(body.prompt, 50_000)
    if (body.system) body.system = sanitizeForPrompt(body.system, 10_000)
    if (body.search_context) body.search_context = sanitizeForPrompt(body.search_context, 5_000)

    // Validate optional UUIDs.
    if (body.project_id != null && !isValidUuid(body.project_id)) {
      throw new HttpError(400, 'project_id must be a valid UUID')
    }
    if (body.entity_id != null && !isValidUuid(body.entity_id)) {
      throw new HttpError(400, 'entity_id must be a valid UUID')
    }

    // Project-scoped calls require membership. Project-less calls (rare) are
    // permitted — they still get audit-logged with a null project_id.
    if (body.project_id) {
      await verifyProjectMembership(supabase, user.id, body.project_id)
    }

    // Rate limit BEFORE doing any provider work.
    await checkRateLimit(supabase, user.id)
  } catch (error) {
    return errorResponse(error, getCorsHeaders(req))
  }

  // From here on, we stream. Errors past this point go down the SSE channel
  // as `event: error` rather than HTTP errors so the client gets a coherent
  // signal even mid-stream.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseLine(event, data)))
      }

      try {
        const requestStart = Date.now()
        const requestHash = await fingerprintRequest(body, user.id)
        const idempotencyKey = body.idempotency_key ?? requestHash

        // ── Idempotency cache check ─────────────────────────────────────────
        const cached = await readIdempotencyCache(supabase, idempotencyKey, requestHash)
        if (cached) {
          send('meta', {
            audit_id: cached.audit_id,
            idempotency_key: idempotencyKey,
            cached: true,
            provider: cached.provider,
            model: cached.model,
          })
          // Replay the cached content as a single delta so the client UX
          // is identical (skeleton → text). For very long cached responses
          // we could chunk this, but a single delta is fine in practice.
          if (cached.content.length > 0) {
            send('delta', { text: cached.content })
          }
          send('done', {
            content: cached.content,
            usage: cached.usage,
            latency_ms: cached.latency_ms,
            provider: cached.provider,
            model: cached.model,
            audit_id: cached.audit_id,
          })
          controller.close()
          return
        }

        // ── Build router request ────────────────────────────────────────────
        const routerRequest: AIRequest = {
          task: body.task,
          messages: [{ role: 'user', content: body.prompt }],
          system: body.system,
          search_context: body.search_context,
          json_schema: body.json_schema,
          max_tokens: body.max_tokens,
          temperature: body.temperature,
        }

        // Send an early `meta` event so the client knows the call is live.
        // Provider/model are filled in when `done` lands.
        send('meta', {
          audit_id: null,
          idempotency_key: idempotencyKey,
          cached: false,
        })

        // ── Stream from provider ────────────────────────────────────────────
        let finalContent = ''
        let finalUsage = { input_tokens: 0, output_tokens: 0 }
        let finalProvider = ''
        let finalModel = ''
        let finalLatencyMs = 0
        let streamErrored = false

        for await (const ev of routeAIStream(routerRequest)) {
          if (ev.type === 'delta') {
            finalContent += ev.text
            send('delta', { text: ev.text })
          } else if (ev.type === 'done') {
            finalUsage = ev.response.usage
            finalProvider = ev.response.provider
            finalModel = ev.response.model
            finalLatencyMs = ev.response.latency_ms
          } else {
            streamErrored = true
            send('error', { message: ev.message, retryable: true })
            controller.close()
            return
          }
        }

        if (streamErrored) {
          controller.close()
          return
        }

        // ── Audit + idempotency write ───────────────────────────────────────
        const outputHash = await sha256Hex(finalContent)
        const auditId = await writeAuditEntry({
          supabase,
          userId: user.id,
          userEmail: user.email || null,
          projectId: body.project_id ?? null,
          task: body.task,
          provider: finalProvider,
          model: finalModel,
          promptHash: requestHash,
          outputHash,
          inputTokens: finalUsage.input_tokens,
          outputTokens: finalUsage.output_tokens,
          latencyMs: finalLatencyMs,
          entityType: body.entity_type ?? null,
          entityId: body.entity_id ?? null,
          cached: false,
        })

        const cacheable: CachedResponse = {
          content: finalContent,
          usage: finalUsage,
          latency_ms: finalLatencyMs,
          provider: finalProvider,
          model: finalModel,
          audit_id: auditId,
        }

        // Fail-soft idempotency write — the response already shipped.
        await writeIdempotencyCache(supabase, idempotencyKey, user.id, requestHash, cacheable)

        const totalLatencyMs = Date.now() - requestStart
        send('done', {
          content: finalContent,
          usage: finalUsage,
          latency_ms: totalLatencyMs,
          provider: finalProvider,
          model: finalModel,
          audit_id: auditId,
        })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // Mark non-retryable for client-side errors (4xx-style); otherwise
        // assume a transient provider/network issue and let the client retry.
        const retryable = !(err instanceof HttpError && err.status >= 400 && err.status < 500)
        send('error', { message, retryable })
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: sseHeaders(req) })
})
