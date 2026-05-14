/**
 * src/lib/observability/langfuse.ts — minimal Langfuse REST client.
 *
 * Why a hand-rolled client instead of the @langfuse/node SDK:
 *   1. Zero new dependencies. The SDK pulls 8+ transitive packages for
 *      a feature that's a single POST. Our bundle is already at the
 *      .quality-floor.json ceiling and adding a dep deserves more
 *      ROI than this.
 *   2. Env-gated no-op when keys are absent — matches the existing
 *      `traceLLM` (src/lib/aiObservability.ts) pattern. Local dev,
 *      tests, CI without LANGFUSE_HOST set: silently skips.
 *   3. The Langfuse `/api/public/ingestion` endpoint is the same shape
 *      the SDK uses; docs at https://langfuse.com/docs/api.
 *
 * Trace shape:
 *   - One `trace` per iris-call invocation (correlated by audit_id).
 *   - One `generation` event per LLM call inside the trace (typically
 *     1:1 with a single iris-call but the schema supports nested calls).
 *   - User feedback (accept/reject/reword) becomes a `score` event
 *     against the trace.
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md § Langfuse
 *            docs/audits/ADR_022_LANGFUSE_SELF_HOST_2026-05-08.md
 */

interface LangfuseEnv {
  host: string
  publicKey: string
  secretKey: string
}

function readEnv(): LangfuseEnv | null {
  // Browser/Vite: import.meta.env.VITE_*. Node (scripts, tests):
  // process.env. We support both — the calling surface uses whichever
  // is populated first.
  //
  // SECURITY: LANGFUSE_SECRET_KEY has NO `VITE_` fallback on purpose.
  // Vite inlines VITE_-prefixed vars into the browser bundle, so a
  // VITE_LANGFUSE_SECRET_KEY would leak. By only reading the
  // non-prefixed name, browser builds always return null here →
  // recordIrisTrace becomes a no-op in the browser. Server-side
  // (Node scripts, edge functions via the Deno mirror) reads the
  // process.env / Deno.env name and the trace fires normally.
  const host = readVar('LANGFUSE_HOST') ?? readVar('VITE_LANGFUSE_HOST')
  const publicKey = readVar('LANGFUSE_PUBLIC_KEY') ?? readVar('VITE_LANGFUSE_PUBLIC_KEY')
  const secretKey = readVar('LANGFUSE_SECRET_KEY')
  if (!host || !publicKey || !secretKey) return null
  return { host: host.replace(/\/$/, ''), publicKey, secretKey }
}

function readVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name]
  // Vite injects VITE_* env vars at build time onto import.meta.env.
  // We read them dynamically so this module is safe to import in Node.
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> }
    return meta.env?.[name]
  } catch {
    return undefined
  }
}

export interface TraceContext {
  /** Correlates with audit_log.id from iris-call. Required for joinability. */
  auditId: string
  /** Project the call belongs to. */
  projectId?: string | null
  userId?: string | null
  /** True for soft-pilot orgs (per ADR-006); used for telemetry tagging. */
  isSoftPilot?: boolean
  /** drafted_action.id when the call produced a draft. */
  draftedActionId?: string | null
  /** action_type when the call produced a draft. */
  actionType?: string | null
  /** Free-form additional tags. */
  tags?: string[]
  /** Free-form metadata. */
  metadata?: Record<string, unknown>
}

export interface GenerationEvent {
  /** Provider (anthropic, openai, etc.). */
  provider: string
  /** Model id (claude-sonnet-4-6, etc.). */
  model: string
  /** The user-message content (truncated to 50KB by ingestion). */
  input: string
  /** Optional system prompt. */
  systemPrompt?: string
  /** Final output (post voice-lint when applicable). */
  output: string
  inputTokens: number
  outputTokens: number
  /** Wall-clock ms from request start to done event. */
  latencyMs: number
  /** Optional pre-computed cost in cents. */
  costCents?: number
}

interface IngestionEvent {
  id: string
  type: string
  timestamp: string
  body: Record<string, unknown>
}

function uuid(): string {
  return globalThis.crypto.randomUUID()
}

function basicAuth(env: LangfuseEnv): string {
  const token = `${env.publicKey}:${env.secretKey}`
  if (typeof btoa === 'function') return `Basic ${btoa(token)}`
  return `Basic ${Buffer.from(token).toString('base64')}`
}

async function ingest(
  env: LangfuseEnv,
  events: IngestionEvent[],
): Promise<void> {
  try {
    await fetch(`${env.host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(env),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ batch: events }),
    })
  } catch (err) {
    // Telemetry must NEVER break the user-facing call. Swallow + log.
    console.warn('[langfuse] ingest failed (non-fatal):', (err as Error).message)
  }
}

/**
 * Record a complete iris-call as a Langfuse trace + generation event.
 * No-op when env vars are absent — safe to call unconditionally.
 *
 * Returns the trace id (or `null` when disabled) so the caller can
 * surface it to the UI for later score writes (user feedback).
 */
export async function recordIrisTrace(
  ctx: TraceContext,
  generation: GenerationEvent,
): Promise<string | null> {
  const env = readEnv()
  if (!env) return null

  const traceId = ctx.auditId
  const generationId = uuid()
  const now = new Date().toISOString()

  const tags = [
    ...(ctx.tags ?? []),
    ctx.isSoftPilot ? 'soft_pilot' : 'self_serve',
  ]

  const events: IngestionEvent[] = [
    {
      id: uuid(),
      type: 'trace-create',
      timestamp: now,
      body: {
        id: traceId,
        name: ctx.actionType ?? 'iris-call',
        userId: ctx.userId ?? undefined,
        sessionId: ctx.projectId ?? undefined,
        tags,
        metadata: {
          ...(ctx.metadata ?? {}),
          drafted_action_id: ctx.draftedActionId ?? null,
          action_type: ctx.actionType ?? null,
          is_soft_pilot: ctx.isSoftPilot ?? false,
        },
      },
    },
    {
      id: uuid(),
      type: 'generation-create',
      timestamp: now,
      body: {
        id: generationId,
        traceId,
        name: ctx.actionType ?? 'iris-call:generate',
        startTime: new Date(Date.now() - generation.latencyMs).toISOString(),
        endTime: now,
        model: generation.model,
        modelParameters: { provider: generation.provider },
        input: generation.systemPrompt
          ? [
              { role: 'system', content: generation.systemPrompt },
              { role: 'user', content: generation.input },
            ]
          : generation.input,
        output: generation.output,
        usage: {
          input: generation.inputTokens,
          output: generation.outputTokens,
          total: generation.inputTokens + generation.outputTokens,
          unit: 'TOKENS',
        },
      },
    },
  ]

  await ingest(env, events)
  return traceId
}

/**
 * Create a parent trace with metadata only (no child generation). Use
 * when a single user request fans out to multiple LLM calls.
 */
export async function recordIrisTraceMeta(ctx: TraceContext): Promise<string | null> {
  const env = readEnv()
  if (!env) return null
  const tags = [
    ...(ctx.tags ?? []),
    ctx.isSoftPilot ? 'soft_pilot' : 'self_serve',
  ]
  const event: IngestionEvent = {
    id: uuid(),
    type: 'trace-create',
    timestamp: new Date().toISOString(),
    body: {
      id: ctx.auditId,
      name: ctx.actionType ?? 'iris-call',
      userId: ctx.userId ?? undefined,
      sessionId: ctx.projectId ?? undefined,
      tags,
      metadata: {
        ...(ctx.metadata ?? {}),
        drafted_action_id: ctx.draftedActionId ?? null,
        action_type: ctx.actionType ?? null,
        is_soft_pilot: ctx.isSoftPilot ?? false,
      },
    },
  }
  await ingest(env, [event])
  return ctx.auditId
}

/**
 * Record a child generation event under an existing trace. Used when a
 * single user request fans out to multiple LLM calls (e.g. the
 * agent-orchestrator's intent → specialist → synthesis chain), so all
 * three calls show up under one parent trace in the Langfuse UI.
 */
export async function recordIrisGeneration(
  traceId: string,
  generation: GenerationEvent & { name: string },
): Promise<void> {
  const env = readEnv()
  if (!env) return
  const event: IngestionEvent = {
    id: uuid(),
    type: 'generation-create',
    timestamp: new Date().toISOString(),
    body: {
      id: uuid(),
      traceId,
      name: generation.name,
      startTime: new Date(Date.now() - generation.latencyMs).toISOString(),
      endTime: new Date().toISOString(),
      model: generation.model,
      modelParameters: { provider: generation.provider },
      input: generation.systemPrompt
        ? [
            { role: 'system', content: generation.systemPrompt },
            { role: 'user', content: generation.input },
          ]
        : generation.input,
      output: generation.output,
      usage: {
        input: generation.inputTokens,
        output: generation.outputTokens,
        total: generation.inputTokens + generation.outputTokens,
        unit: 'TOKENS',
      },
    },
  }
  await ingest(env, [event])
}

/**
 * Record a user-feedback score against a previously recorded trace.
 * Called from the draft accept/reject/reword UI so we can grade real
 * production output against PM behavior.
 */
export async function recordIrisScore(params: {
  traceId: string
  name: 'accept' | 'reject' | 'reword' | 'rating'
  value: number
  comment?: string
}): Promise<void> {
  const env = readEnv()
  if (!env) return
  const event: IngestionEvent = {
    id: uuid(),
    type: 'score-create',
    timestamp: new Date().toISOString(),
    body: {
      id: uuid(),
      traceId: params.traceId,
      name: params.name,
      value: params.value,
      comment: params.comment,
    },
  }
  await ingest(env, [event])
}

/** Returns true when Langfuse is configured. UI uses this to gate buttons. */
export function isLangfuseEnabled(): boolean {
  return readEnv() !== null
}
