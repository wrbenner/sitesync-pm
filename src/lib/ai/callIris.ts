// ─────────────────────────────────────────────────────────────────────────────
// callIris — typed browser client for the iris-call edge function
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the canonical AI entry point for everything that runs in the
// browser: Iris drafts, Owner Update, future natural-language Q&A. It wraps
// the SSE protocol exposed by `supabase/functions/iris-call/index.ts` so
// callers get a clean async API with streaming callbacks.
//
// Why this file exists:
//   • Server-side keys. The previous browser-direct path (which used
//     @ai-sdk/anthropic with a VITE_ANTHROPIC_API_KEY) leaked the Anthropic
//     key into the bundle. This wrapper holds zero secrets — it just forwards
//     the user's session JWT.
//   • Audit chain. Every successful call writes a row to audit_log with the
//     SHA-256 hash chain. The wrapper exposes the audit_id back to the caller
//     so UIs can deep-link to "the row that proves this AI moment happened."
//   • Idempotency + rate limit. Both are server-enforced. The wrapper exposes
//     a rate-limit error so UIs can surface a coherent message.
//   • Streaming UX. The drawer/textarea fills incrementally via onDelta.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../supabase'

// Mirrors the AITaskType union in supabase/functions/shared/aiRouter.ts. The
// embedding/eval_judge/vision tasks are intentionally NOT exposed to the
// browser — they live behind dedicated server functions.
export type IrisCallTask =
  | 'reasoning'
  | 'classification'
  | 'code_lookup'
  | 'summarization'

export interface IrisCallRequest {
  /** Routing hint — which provider best handles this task. */
  task: IrisCallTask
  /** User-message content. Sanitized server-side. */
  prompt: string
  /** Optional system prompt prepended to the conversation. */
  system?: string
  /** Project this call relates to. Required for project-scoped audit linkage. */
  projectId?: string
  /** Entity this call is operating on (e.g. an RFI). Joined into audit_log. */
  entityType?: string
  entityId?: string
  /** Caps. Defaults applied server-side. */
  maxTokens?: number
  temperature?: number
  /** Search context for code_lookup (jurisdiction, spec section). */
  searchContext?: string
  /** JSON schema for classification tasks (forces structured output). */
  jsonSchema?: object
  /**
   * Idempotency key — if the same value is replayed within 24h with the
   * same inputs, the cached response is returned without re-billing the
   * provider. Defaults to a hash of the inputs, so replays are caught even
   * when the caller doesn't supply a key explicitly.
   */
  idempotencyKey?: string
  /** Allow callers to abort an in-flight stream. */
  signal?: AbortSignal
}

export interface IrisCallMeta {
  auditId: string | null
  idempotencyKey: string
  cached: boolean
  provider?: string
  model?: string
}

export interface IrisCallDone {
  content: string
  usage: { inputTokens: number; outputTokens: number }
  latencyMs: number
  provider: string
  model: string
  auditId: string
}

export interface IrisCallCallbacks {
  /** Fires once before any deltas. Tells the UI which provider answered. */
  onMeta?: (meta: IrisCallMeta) => void
  /** Fires for every text delta from the provider. */
  onDelta?: (text: string) => void
  /** Fires once on successful completion. */
  onDone?: (done: IrisCallDone) => void
  /**
   * Fires on terminal error. `retryable=false` means the request was rejected
   * for a permanent reason (auth, validation, rate limit) — don't auto-retry.
   */
  onError?: (error: IrisCallError) => void
}

export class IrisCallError extends Error {
  readonly retryable: boolean
  readonly status: number | null
  constructor(message: string, opts: { retryable?: boolean; status?: number | null } = {}) {
    super(message)
    this.name = 'IrisCallError'
    this.retryable = opts.retryable ?? false
    this.status = opts.status ?? null
  }
}

/**
 * Call the iris-call edge function and stream the response.
 *
 * Returns a Promise that resolves with the final IrisCallDone payload (also
 * delivered via onDone). Rejects with IrisCallError on failure (also delivered
 * via onError). AbortController support: pass `signal` to cancel mid-stream.
 *
 * Example:
 *   const result = await callIris({
 *     task: 'reasoning',
 *     prompt: 'Summarize the latest field log',
 *     projectId,
 *     entityType: 'daily_log',
 *     entityId: dailyLogId,
 *   }, {
 *     onDelta: (text) => setDraft((d) => d + text),
 *   })
 */
export async function callIris(
  request: IrisCallRequest,
  callbacks: IrisCallCallbacks = {},
): Promise<IrisCallDone> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  if (!supabaseUrl) {
    throw new IrisCallError('VITE_SUPABASE_URL is not configured', { retryable: false })
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new IrisCallError('Not signed in. Sign in to use Iris.', { retryable: false, status: 401 })
  }

  const url = `${supabaseUrl}/functions/v1/iris-call`
  const requestBody: Record<string, unknown> = {
    task: request.task,
    prompt: request.prompt,
  }
  if (request.system) requestBody.system = request.system
  if (request.projectId) requestBody.project_id = request.projectId
  if (request.entityType) requestBody.entity_type = request.entityType
  if (request.entityId) requestBody.entity_id = request.entityId
  if (request.maxTokens != null) requestBody.max_tokens = request.maxTokens
  if (request.temperature != null) requestBody.temperature = request.temperature
  if (request.searchContext) requestBody.search_context = request.searchContext
  if (request.jsonSchema) requestBody.json_schema = request.jsonSchema
  if (request.idempotencyKey) requestBody.idempotency_key = request.idempotencyKey

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      signal: request.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new IrisCallError('Request was aborted.', { retryable: false })
    }
    throw new IrisCallError(`Network error: ${(err as Error).message}`, { retryable: true })
  }

  // 4xx/5xx responses come back as JSON (errorResponse() in shared/auth.ts).
  if (!response.ok) {
    const status = response.status
    let message = `iris-call returned ${status}`
    try {
      const json = await response.json()
      message = json?.error?.message ?? message
    } catch {
      // body wasn't JSON — keep the default message
    }
    const error = new IrisCallError(message, {
      retryable: status >= 500 || status === 429,
      status,
    })
    callbacks.onError?.(error)
    throw error
  }

  if (!response.body) {
    const error = new IrisCallError('iris-call returned no body', { retryable: true })
    callbacks.onError?.(error)
    throw error
  }

  // ── Consume SSE stream ──────────────────────────────────────────────────
  return await consumeSSE(response.body, callbacks)
}

// ── SSE consumer ────────────────────────────────────────────────────────────

interface SSEParsedEvent {
  event: string | null
  data: string
}

async function consumeSSE(
  body: ReadableStream<Uint8Array>,
  callbacks: IrisCallCallbacks,
): Promise<IrisCallDone> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent: string | null = null
  let currentData = ''
  let result: IrisCallDone | null = null
  let terminalError: IrisCallError | null = null

  const handleEvent = (ev: SSEParsedEvent) => {
    if (!ev.data) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(ev.data) as Record<string, unknown>
    } catch {
      return
    }
    switch (ev.event) {
      case 'meta': {
        callbacks.onMeta?.({
          auditId: (parsed.audit_id as string | null) ?? null,
          idempotencyKey: parsed.idempotency_key as string,
          cached: Boolean(parsed.cached),
          provider: parsed.provider as string | undefined,
          model: parsed.model as string | undefined,
        })
        return
      }
      case 'delta': {
        const text = parsed.text as string | undefined
        if (text) callbacks.onDelta?.(text)
        return
      }
      case 'done': {
        const usage = parsed.usage as { input_tokens?: number; output_tokens?: number } | undefined
        result = {
          content: (parsed.content as string) ?? '',
          usage: {
            inputTokens: usage?.input_tokens ?? 0,
            outputTokens: usage?.output_tokens ?? 0,
          },
          latencyMs: (parsed.latency_ms as number) ?? 0,
          provider: (parsed.provider as string) ?? '',
          model: (parsed.model as string) ?? '',
          auditId: (parsed.audit_id as string) ?? '',
        }
        callbacks.onDone?.(result)
        return
      }
      case 'error': {
        terminalError = new IrisCallError(
          (parsed.message as string) ?? 'Unknown error',
          { retryable: Boolean(parsed.retryable) },
        )
        return
      }
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        // Flush any trailing event without a terminating blank line.
        if (currentData.length > 0) {
          handleEvent({ event: currentEvent, data: currentData })
        }
        break
      }
      buffer += decoder.decode(value, { stream: true })
      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)
        const line = rawLine.replace(/\r$/, '')
        if (line === '') {
          if (currentData.length > 0) {
            handleEvent({ event: currentEvent, data: currentData })
          }
          currentEvent = null
          currentData = ''
        } else if (line.startsWith(':')) {
          // SSE comment — ignored
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const chunk = line.slice(5).trimStart()
          currentData = currentData.length > 0 ? `${currentData}\n${chunk}` : chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (terminalError) {
    callbacks.onError?.(terminalError)
    throw terminalError
  }
  if (!result) {
    const err = new IrisCallError('iris-call stream ended without a done event', { retryable: true })
    callbacks.onError?.(err)
    throw err
  }
  return result
}
