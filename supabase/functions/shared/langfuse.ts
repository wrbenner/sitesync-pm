// supabase/functions/shared/langfuse.ts
//
// Deno-side mirror of `src/lib/observability/langfuse.ts`. Edge functions
// can't import from src/, so this file is the canonical edge-function
// copy. Kept intentionally minimal — same surface (recordIrisTrace +
// recordIrisScore + isLangfuseEnabled) so the calling code is identical.
//
// Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md § Langfuse
//            docs/audits/ADR_022_LANGFUSE_SELF_HOST_2026-05-08.md
//
// IMPORTANT — KEEPING IN SYNC:
//   When you change the trace shape here, change it in
//   `src/lib/observability/langfuse.ts`. Drift between the two would
//   leave production traces inconsistent across server-emitted events
//   (this file) and browser-emitted score events (the src/ file).

interface LangfuseEnv {
  host: string
  publicKey: string
  secretKey: string
}

function readEnv(): LangfuseEnv | null {
  const host = Deno.env.get('LANGFUSE_HOST')
  const publicKey = Deno.env.get('LANGFUSE_PUBLIC_KEY')
  const secretKey = Deno.env.get('LANGFUSE_SECRET_KEY')
  if (!host || !publicKey || !secretKey) return null
  return { host: host.replace(/\/$/, ''), publicKey, secretKey }
}

export interface TraceContext {
  auditId: string
  projectId?: string | null
  userId?: string | null
  isSoftPilot?: boolean
  draftedActionId?: string | null
  actionType?: string | null
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface GenerationEvent {
  provider: string
  model: string
  input: string
  systemPrompt?: string
  output: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costCents?: number
}

interface IngestionEvent {
  id: string
  type: string
  timestamp: string
  body: Record<string, unknown>
}

function uuid(): string {
  return crypto.randomUUID()
}

function basicAuth(env: LangfuseEnv): string {
  return `Basic ${btoa(`${env.publicKey}:${env.secretKey}`)}`
}

async function ingest(env: LangfuseEnv, events: IngestionEvent[]): Promise<void> {
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
    // Telemetry must NEVER break the iris-call response.
    console.warn('[langfuse] ingest failed (non-fatal):', (err as Error).message)
  }
}

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
 * Create a parent trace with metadata only (no child generation). Used
 * when a single user request fans out to multiple LLM calls — emit one
 * trace at request start, then recordIrisGeneration per call.
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
 * Record a child generation event under an existing trace. Used by
 * agent-orchestrator (one parent trace per user request, three
 * generation children for intent → specialist → synthesis) and any
 * future multi-call edge function. Caller chooses the parent traceId
 * (typically a uuid generated at request entry, then passed to
 * recordIrisTrace once + recordIrisGeneration N times).
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

export function isLangfuseEnabled(): boolean {
  return readEnv() !== null
}
