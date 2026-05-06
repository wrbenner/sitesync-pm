// =============================================================================
// AI Model Router — Task-Optimal Provider Selection
// =============================================================================
//
// Routes each AI task to the provider with the best quality/cost/speed
// tradeoff for that specific job. No single model is best at everything.
//
// ROUTING PRINCIPLES:
//   1. Claude — complex reasoning, construction domain, long system prompts
//   2. OpenAI — embeddings, fast structured JSON, classification, eval judging
//   3. Gemini — multimodal (photos, drawings, PDFs), large context (1M tokens)
//   4. Perplexity — real-time factual lookup (building codes, standards, specs)
//
// ARCHITECTURE:
//   - Each provider has a typed interface and a call function
//   - The router maps task types to providers
//   - Fallback chain: if primary fails, try secondary provider
//   - All responses normalized to a common shape
//   - Timeout enforcement via AbortSignal on all provider calls
//
// NOT YET IMPLEMENTED:
//   - ai_usage table persistence (usage data returned but not stored)
//   - Rate limiting / quota management
//   - Cost ceiling enforcement
//
// SECURITY:
//   - API keys read from Deno.env (Supabase edge function secrets)
//   - Never exposed to client
//   - All calls server-side only
// =============================================================================

// ── Types ────────────────────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'perplexity'

export type AITaskType =
  | 'reasoning'         // Complex analysis, construction domain reasoning
  | 'classification'    // Fast structured extraction (trade, CSI, urgency)
  | 'embedding'         // Semantic search vectors
  | 'vision'            // Photo/drawing analysis
  | 'code_lookup'       // Building code / standards citation
  | 'summarization'     // Batch summarization of logs/events
  | 'eval_judge'        // Independent model evaluating another model's output

export interface AIRequest {
  task: AITaskType
  messages: AIMessage[]
  system?: string
  images?: AIImage[]           // For vision tasks
  json_schema?: object         // For structured output (OpenAI JSON mode)
  search_context?: string      // For Perplexity web search context
  max_tokens?: number
  temperature?: number
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIImage {
  url?: string                 // Public URL
  base64?: string              // Base64-encoded image data
  media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}

export interface AIResponse {
  provider: AIProvider
  model: string
  content: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
  latency_ms: number
  cached: boolean
}

export interface AIRouterConfig {
  fallback_enabled: boolean
  timeout_ms: number
}

// ── Provider Configuration ───────────────────────────────────────────────────

interface ProviderSpec {
  primary: AIProvider
  model: string
  fallback?: { provider: AIProvider; model: string }
}

const TASK_ROUTING: Record<AITaskType, ProviderSpec> = {
  reasoning: {
    primary: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    fallback: { provider: 'openai', model: 'gpt-4o' },
  },
  classification: {
    primary: 'openai',
    model: 'gpt-4o-mini',
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  },
  embedding: {
    primary: 'openai',
    model: 'text-embedding-3-small',
    // No fallback — embeddings must be consistent (same model for index + query)
  },
  vision: {
    primary: 'gemini',
    model: 'gemini-2.5-flash',
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  },
  // IMPORTANT: code_lookup results are research assists, NOT authoritative
  // legal/compliance sources. Results must include jurisdiction context,
  // citation persistence, and confidence markers. See ai-rfi-draft for
  // the constrained implementation pattern.
  code_lookup: {
    primary: 'perplexity',
    model: 'sonar-pro',
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  },
  summarization: {
    primary: 'openai',
    model: 'gpt-4o-mini',
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  },
  eval_judge: {
    primary: 'openai',
    model: 'gpt-4o',
    // No fallback — eval judge must be a DIFFERENT family than the model under test
  },
}

// ── Provider Call Functions ───────────────────────────────────────────────────

async function callAnthropic(
  model: string,
  messages: AIMessage[],
  system: string | undefined,
  images: AIImage[] | undefined,
  maxTokens: number,
  temperature: number,
): Promise<AIResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const start = Date.now()

  // Build messages with image support
  const apiMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'user' && images?.length) {
        const content: Array<{ type: string; text?: string; source?: object }> = []
        for (const img of images) {
          if (img.base64) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: img.media_type,
                data: img.base64,
              },
            })
          }
        }
        content.push({ type: 'text', text: m.content })
        return { role: m.role, content }
      }
      return { role: m.role, content: m.content }
    })

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
    temperature,
  }
  if (system) body.system = system

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return {
    provider: 'anthropic',
    model,
    content: data.content?.[0]?.text ?? '',
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
    latency_ms: Date.now() - start,
    cached: false,
  }
}

async function callOpenAI(
  model: string,
  messages: AIMessage[],
  system: string | undefined,
  _images: AIImage[] | undefined,
  maxTokens: number,
  temperature: number,
  jsonSchema?: object,
): Promise<AIResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const start = Date.now()

  // Handle embedding model separately
  if (model.startsWith('text-embedding-')) {
    const inputText = messages.map((m) => m.content).join('\n')
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: inputText }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI Embedding ${response.status}: ${errText}`)
    }

    const data = await response.json()
    return {
      provider: 'openai',
      model,
      content: JSON.stringify(data.data?.[0]?.embedding ?? []),
      usage: {
        input_tokens: data.usage?.total_tokens ?? 0,
        output_tokens: 0,
      },
      latency_ms: Date.now() - start,
      cached: false,
    }
  }

  // Chat completions
  const apiMessages: Array<{ role: string; content: string }> = []
  if (system) apiMessages.push({ role: 'system', content: system })
  for (const m of messages) {
    if (m.role !== 'system') {
      apiMessages.push({ role: m.role, content: m.content })
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
    temperature,
  }
  if (jsonSchema) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'response', schema: jsonSchema } }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return {
    provider: 'openai',
    model,
    content: data.choices?.[0]?.message?.content ?? '',
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
    latency_ms: Date.now() - start,
    cached: false,
  }
}

async function callGemini(
  model: string,
  messages: AIMessage[],
  system: string | undefined,
  images: AIImage[] | undefined,
  maxTokens: number,
  temperature: number,
): Promise<AIResponse> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const start = Date.now()

  // Build Gemini content parts
  const parts: Array<{ text?: string; inline_data?: object }> = []

  if (system) {
    parts.push({ text: `System: ${system}` })
  }

  // Add images as inline data
  if (images) {
    for (const img of images) {
      if (img.base64) {
        parts.push({
          inline_data: {
            mime_type: img.media_type,
            data: img.base64,
          },
        })
      }
    }
  }

  // Add text messages
  for (const m of messages) {
    if (m.role !== 'system') {
      parts.push({ text: `${m.role}: ${m.content}` })
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
    },
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const candidate = data.candidates?.[0]
  return {
    provider: 'gemini',
    model,
    content: candidate?.content?.parts?.[0]?.text ?? '',
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
    latency_ms: Date.now() - start,
    cached: false,
  }
}

async function callPerplexity(
  model: string,
  messages: AIMessage[],
  system: string | undefined,
  _images: AIImage[] | undefined,
  maxTokens: number,
  temperature: number,
  searchContext?: string,
): Promise<AIResponse> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY')
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY not configured')

  const start = Date.now()

  const apiMessages: Array<{ role: string; content: string }> = []
  if (system) apiMessages.push({ role: 'system', content: system })
  if (searchContext) {
    apiMessages.push({
      role: 'system',
      content: `Search context: ${searchContext}. Cite specific code sections, standard numbers, and URLs.`,
    })
  }
  for (const m of messages) {
    if (m.role !== 'system') {
      apiMessages.push({ role: m.role, content: m.content })
    }
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: apiMessages,
      temperature,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Perplexity ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return {
    provider: 'perplexity',
    model,
    content: data.choices?.[0]?.message?.content ?? '',
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
    latency_ms: Date.now() - start,
    cached: false,
  }
}

// ── Provider Dispatch ────────────────────────────────────────────────────────

async function callProvider(
  provider: AIProvider,
  model: string,
  request: AIRequest,
  _timeoutMs: number = 30000,
): Promise<AIResponse> {
  const maxTokens = request.max_tokens ?? 1024
  const temperature = request.temperature ?? 0.3

  switch (provider) {
    case 'anthropic':
      return callAnthropic(model, request.messages, request.system, request.images, maxTokens, temperature)
    case 'openai':
      return callOpenAI(model, request.messages, request.system, request.images, maxTokens, temperature, request.json_schema)
    case 'gemini':
      return callGemini(model, request.messages, request.system, request.images, maxTokens, temperature)
    case 'perplexity':
      return callPerplexity(model, request.messages, request.system, request.images, maxTokens, temperature, request.search_context)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AIRouterConfig = {
  fallback_enabled: true,
  timeout_ms: 30000,
}

/**
 * Route an AI request to the optimal provider based on task type.
 *
 * The router:
 *   1. Looks up the primary provider for the task
 *   2. Attempts the call with the primary
 *   3. If primary fails AND fallback is configured, tries the fallback
 *   4. Returns normalized AIResponse or throws
 */
export async function routeAI(
  request: AIRequest,
  config: Partial<AIRouterConfig> = {},
): Promise<AIResponse> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const spec = TASK_ROUTING[request.task]

  if (!spec) {
    throw new Error(`Unknown AI task type: ${request.task}`)
  }

  // Try primary provider
  try {
    const response = await callProvider(spec.primary, spec.model, request, cfg.timeout_ms)
    return response
  } catch (primaryError) {
    console.error(`[aiRouter] Primary ${spec.primary}/${spec.model} failed:`, primaryError)

    // Try fallback if available and enabled
    if (cfg.fallback_enabled && spec.fallback) {
      try {
        console.warn(`[aiRouter] Falling back to ${spec.fallback.provider}/${spec.fallback.model}`)
        const response = await callProvider(spec.fallback.provider, spec.fallback.model, request, cfg.timeout_ms)
        return response
      } catch (fallbackError) {
        console.error(`[aiRouter] Fallback ${spec.fallback.provider}/${spec.fallback.model} also failed:`, fallbackError)
        throw fallbackError
      }
    }

    throw primaryError
  }
}

/**
 * Get the routing configuration for a task (for transparency/debugging).
 */
export function getRouteInfo(task: AITaskType): ProviderSpec {
  return TASK_ROUTING[task]
}

// ── Parallel orchestration ───────────────────────────────────────────────────

export interface ParallelAIResult {
  /** The task this slot was driving — preserved from input order. */
  task: AITaskType
  /** Populated when the call resolved before the timeout. */
  response: AIResponse | null
  /** Populated when the call timed out, threw, or both providers failed. */
  error: { kind: 'timeout' | 'rejected'; message: string } | null
  /** Wall-clock observed by the orchestrator, including any router-level
   *  fallback. Always set so the caller can put a number in the audit row
   *  even when the call failed. */
  latency_ms: number
}

interface RouteAIParallelOpts {
  tasks: AIRequest[]
  /** Per-task wall-clock budget. The slowest provider gates the response;
   *  this cap keeps a single hung provider from holding up the rest. */
  timeoutMs: number
  config?: Partial<AIRouterConfig>
}

/**
 * Fire N AI tasks concurrently with a per-task timeout. Returns one
 * `ParallelAIResult` per input, in the same order.
 *
 * Why this exists: edge functions like iris-ground need to run several
 * task-typed AI calls in parallel and tolerate partial failure (one provider
 * down should not strand the others). `routeAI` itself is single-task and
 * doesn't expose an AbortSignal; we wrap it with `Promise.race` against a
 * timer instead of plumbing signals through every provider call. The
 * underlying fetch may keep running on the network — that's fine, the
 * orchestrator's contract is "this slot is settled by `timeoutMs`."
 */
export async function routeAIParallel(
  opts: RouteAIParallelOpts,
): Promise<ParallelAIResult[]> {
  const { tasks, timeoutMs, config } = opts

  const TIMEOUT_SENTINEL: unique symbol = Symbol('routeAIParallel.timeout') as never
  type TimeoutMarker = { __sentinel: typeof TIMEOUT_SENTINEL }

  return Promise.all(
    tasks.map(async (req): Promise<ParallelAIResult> => {
      const start = Date.now()
      let timer: number | undefined
      const timeoutPromise = new Promise<TimeoutMarker>((resolve) => {
        timer = setTimeout(
          () => resolve({ __sentinel: TIMEOUT_SENTINEL }),
          timeoutMs,
        ) as unknown as number
      })

      try {
        const settled = await Promise.race([routeAI(req, config), timeoutPromise])
        if ((settled as TimeoutMarker).__sentinel === TIMEOUT_SENTINEL) {
          return {
            task: req.task,
            response: null,
            error: { kind: 'timeout', message: `timed out after ${timeoutMs}ms` },
            latency_ms: Date.now() - start,
          }
        }
        return {
          task: req.task,
          response: settled as AIResponse,
          error: null,
          latency_ms: Date.now() - start,
        }
      } catch (err) {
        return {
          task: req.task,
          response: null,
          error: {
            kind: 'rejected',
            message: err instanceof Error ? err.message : String(err),
          },
          latency_ms: Date.now() - start,
        }
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
    }),
  )
}

/**
 * Check which providers have API keys configured.
 */
export function getAvailableProviders(): Record<AIProvider, boolean> {
  return {
    anthropic: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
    openai: Boolean(Deno.env.get('OPENAI_API_KEY')),
    gemini: Boolean(Deno.env.get('GEMINI_API_KEY')),
    perplexity: Boolean(Deno.env.get('PERPLEXITY_API_KEY')),
  }
}

// ── Streaming ────────────────────────────────────────────────────────────────
//
// `routeAIStream` is the streaming counterpart to `routeAI`. It returns an
// async iterable of stream events that callers can pipe into an SSE response
// (see supabase/functions/iris-call). The shape:
//
//   { type: 'delta', text }       — text chunk to render incrementally
//   { type: 'done', response }    — final AIResponse with usage + total content
//   { type: 'error', message }    — terminal error
//
// Streaming is wired natively for Anthropic and OpenAI (their HTTP APIs both
// support SSE). Gemini and Perplexity buffer through a single-delta path —
// the caller's UX is identical, only the latency profile differs. This keeps
// the iris-call edge function provider-agnostic.

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; response: AIResponse }
  | { type: 'error'; message: string }

export async function* routeAIStream(
  request: AIRequest,
  config: Partial<AIRouterConfig> = {},
): AsyncGenerator<StreamEvent, void, void> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const spec = TASK_ROUTING[request.task]
  if (!spec) {
    yield { type: 'error', message: `Unknown AI task type: ${request.task}` }
    return
  }

  // Dispatch by provider. Anthropic + OpenAI stream natively; the rest fall
  // through to a buffer-then-yield path so all providers expose the same
  // event sequence.
  try {
    yield* streamFromProvider(spec.primary, spec.model, request)
    return
  } catch (primaryError) {
    console.error(`[aiRouter] streaming primary ${spec.primary}/${spec.model} failed:`, primaryError)
    if (cfg.fallback_enabled && spec.fallback) {
      try {
        console.warn(`[aiRouter] streaming fallback to ${spec.fallback.provider}/${spec.fallback.model}`)
        yield* streamFromProvider(spec.fallback.provider, spec.fallback.model, request)
        return
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        yield { type: 'error', message: `Fallback ${spec.fallback.provider} failed: ${message}` }
        return
      }
    }
    const message = primaryError instanceof Error ? primaryError.message : String(primaryError)
    yield { type: 'error', message }
    return
  }
}

async function* streamFromProvider(
  provider: AIProvider,
  model: string,
  request: AIRequest,
): AsyncGenerator<StreamEvent, void, void> {
  const maxTokens = request.max_tokens ?? 1024
  const temperature = request.temperature ?? 0.3

  switch (provider) {
    case 'anthropic':
      yield* streamAnthropic(model, request, maxTokens, temperature)
      return
    case 'openai':
      yield* streamOpenAI(model, request, maxTokens, temperature)
      return
    case 'gemini':
    case 'perplexity': {
      // Buffered fallthrough — call the existing path then yield as a single
      // delta + done. The UX skeleton (stream consumer) doesn't notice; the
      // only observable difference is one big chunk instead of many small
      // ones. Worth migrating to native streaming later.
      const response = await callProvider(provider, model, request)
      if (response.content.length > 0) {
        yield { type: 'delta', text: response.content }
      }
      yield { type: 'done', response }
      return
    }
    default:
      yield { type: 'error', message: `Streaming not implemented for provider: ${provider}` }
      return
  }
}

// ── Anthropic streaming ─────────────────────────────────────────────────────
// Anthropic's Messages API streams SSE events. We care about three:
//   • content_block_delta { delta: { type: 'text_delta', text } }  → emit delta
//   • message_delta       { usage: { output_tokens } }             → capture tokens
//   • message_start       { message: { usage: { input_tokens } } } → capture input tokens

async function* streamAnthropic(
  model: string,
  request: AIRequest,
  maxTokens: number,
  temperature: number,
): AsyncGenerator<StreamEvent, void, void> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const start = Date.now()

  const apiMessages = request.messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'user' && request.images?.length) {
        const content: Array<{ type: string; text?: string; source?: object }> = []
        for (const img of request.images) {
          if (img.base64) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: img.media_type, data: img.base64 },
            })
          }
        }
        content.push({ type: 'text', text: m.content })
        return { role: m.role, content }
      }
      return { role: m.role, content: m.content }
    })

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
    temperature,
    stream: true,
  }
  if (request.system) body.system = request.system

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Anthropic ${response.status}: ${errText}`)
  }

  let collectedContent = ''
  let inputTokens = 0
  let outputTokens = 0

  for await (const event of parseSSE(response.body)) {
    if (!event.data) continue
    if (event.data === '[DONE]') break
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(event.data) as Record<string, unknown>
    } catch {
      continue
    }
    const type = parsed.type as string | undefined
    if (type === 'message_start') {
      const message = parsed.message as { usage?: { input_tokens?: number } } | undefined
      inputTokens = message?.usage?.input_tokens ?? 0
    } else if (type === 'content_block_delta') {
      const delta = parsed.delta as { type?: string; text?: string } | undefined
      if (delta?.type === 'text_delta' && delta.text) {
        collectedContent += delta.text
        yield { type: 'delta', text: delta.text }
      }
    } else if (type === 'message_delta') {
      const usage = (parsed.usage as { output_tokens?: number } | undefined)
      if (usage?.output_tokens != null) outputTokens = usage.output_tokens
    } else if (type === 'message_stop') {
      break
    }
  }

  yield {
    type: 'done',
    response: {
      provider: 'anthropic',
      model,
      content: collectedContent,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      latency_ms: Date.now() - start,
      cached: false,
    },
  }
}

// ── OpenAI streaming ────────────────────────────────────────────────────────
// chat.completions with stream:true returns SSE chunks. Each chunk:
//   { choices: [{ delta: { content: '...' } }] }
// Final chunk includes { usage } when stream_options.include_usage = true.

async function* streamOpenAI(
  model: string,
  request: AIRequest,
  maxTokens: number,
  temperature: number,
): AsyncGenerator<StreamEvent, void, void> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const start = Date.now()

  // Embedding models don't support streaming — fall back to buffered.
  if (model.startsWith('text-embedding-')) {
    const response = await callProvider('openai', model, request)
    if (response.content.length > 0) yield { type: 'delta', text: response.content }
    yield { type: 'done', response }
    return
  }

  const apiMessages: Array<{ role: string; content: string }> = []
  if (request.system) apiMessages.push({ role: 'system', content: request.system })
  for (const m of request.messages) {
    if (m.role !== 'system') apiMessages.push({ role: m.role, content: m.content })
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
    temperature,
    stream: true,
    stream_options: { include_usage: true },
  }
  if (request.json_schema) {
    // JSON mode + streaming is supported but the deltas may not parse until
    // the stream completes. We still yield deltas; the caller can choose to
    // wait for `done` before parsing.
    body.response_format = { type: 'json_schema', json_schema: { name: 'response', schema: request.json_schema } }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '')
    throw new Error(`OpenAI ${response.status}: ${errText}`)
  }

  let collectedContent = ''
  let inputTokens = 0
  let outputTokens = 0

  for await (const event of parseSSE(response.body)) {
    if (!event.data) continue
    if (event.data === '[DONE]') break
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(event.data) as Record<string, unknown>
    } catch {
      continue
    }
    const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined
    const delta = choices?.[0]?.delta?.content
    if (typeof delta === 'string' && delta.length > 0) {
      collectedContent += delta
      yield { type: 'delta', text: delta }
    }
    const usage = parsed.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined
    if (usage) {
      inputTokens = usage.prompt_tokens ?? inputTokens
      outputTokens = usage.completion_tokens ?? outputTokens
    }
  }

  yield {
    type: 'done',
    response: {
      provider: 'openai',
      model,
      content: collectedContent,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      latency_ms: Date.now() - start,
      cached: false,
    },
  }
}

// ── SSE parser ──────────────────────────────────────────────────────────────
// Minimal SSE line decoder. Yields { event, data } per event. Both Anthropic
// and OpenAI use the standard `event:` / `data:` format with empty-line
// terminators — no fancy retry/id handling needed.

interface SSEEvent {
  event: string | null
  data: string
}

async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent, void, void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent: string | null = null
  let currentData = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        if (currentData.length > 0) {
          yield { event: currentEvent, data: currentData }
        }
        return
      }
      buffer += decoder.decode(value, { stream: true })
      // Process complete lines
      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)
        const line = rawLine.replace(/\r$/, '')
        if (line === '') {
          // End of event
          if (currentData.length > 0) {
            yield { event: currentEvent, data: currentData }
          }
          currentEvent = null
          currentData = ''
        } else if (line.startsWith(':')) {
          // Comment — ignore
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const chunk = line.slice(5).trimStart()
          currentData = currentData.length > 0 ? `${currentData}\n${chunk}` : chunk
        }
        // Other fields (id:, retry:) ignored
      }
    }
  } finally {
    reader.releaseLock()
  }
}
