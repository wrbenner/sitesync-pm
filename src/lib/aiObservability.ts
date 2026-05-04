// ── AI Observability ─────────────────────────────────────────
// Phase 7: Tracing + cost tracking for every AI API call.
// Adapted from sitesyncai-backend-main/src/langfuse/langfuse.service.ts.
//
// Instead of requiring a separate Langfuse account, we persist traces to
// our existing ai_cost_tracking table. Callers wrap their LLM call with
// `traceLLM` and we record model, tokens, cost, latency, and success.

import { supabase, fromTable } from './supabase'
// Model cost reference, USD per 1K tokens. Update when Anthropic/OpenAI/Google
// publish new pricing. Values are input → output.

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.0008, output: 0.004 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gemini-2.0-flash': { input: 0.00035, output: 0.0014 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
}

export interface TraceInput {
  service: 'gemini' | 'openai' | 'anthropic' | 'other'
  model: string
  operation: string
  feature?: string
  projectId?: string
  userId?: string
  promptPreview?: string
  metadata?: Record<string, unknown>
}

export interface TraceResult<T> {
  output: T
  traceId: string
  usage: { inputTokens: number; outputTokens: number; costCents: number; latencyMs: number }
  modelQuality?: number
}

export function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = MODEL_COSTS[model]
  if (!rates) return 0
  const usd = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output
  return Math.round(usd * 100)
}

async function recordTrace(
  input: TraceInput,
  result: { inputTokens: number; outputTokens: number; error?: string; latencyMs: number },
): Promise<string | null> {
  try {
    const costCents = estimateCostCents(input.model, result.inputTokens, result.outputTokens)
    const { data, error } = await fromTable('ai_cost_tracking')
      .insert({
        project_id: input.projectId ?? null,
        user_id: input.userId ?? null,
        service: input.service,
        operation: input.operation,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        total_cost_cents: costCents,
        model: input.model,
        metadata: {
          feature: input.feature ?? null,
          latency_ms: result.latencyMs,
          error: result.error ?? null,
          prompt_preview: input.promptPreview?.slice(0, 240) ?? null,
          ...input.metadata,
        },
      })
      .select('id')
      .single()
    if (error) {
      console.warn('[aiObservability] failed to record trace', error)
      return null
    }
    return (data as { id: string }).id
  } catch (e) {
    console.warn('[aiObservability] threw', e)
    return null
  }
}

/**
 * Wrap an LLM call. The inner `execute` returns both the model output and
 * the token usage it reports — caller knows the model's response shape.
 */
export async function traceLLM<T>(
  input: TraceInput,
  execute: () => Promise<{ output: T; inputTokens: number; outputTokens: number }>,
): Promise<TraceResult<T>> {
  const started = Date.now()
  try {
    const res = await execute()
    const latencyMs = Date.now() - started
    const traceId = await recordTrace(input, {
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      latencyMs,
    })
    const costCents = estimateCostCents(input.model, res.inputTokens, res.outputTokens)
    return {
      output: res.output,
      traceId: traceId ?? '',
      usage: {
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costCents,
        latencyMs,
      },
    }
  } catch (err) {
    const latencyMs = Date.now() - started
    await recordTrace(input, {
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ─── Quality scoring ─────────────────────────────────────────
// ENHANCEMENT: When a user corrects an AI output, we record the correction so
// that accuracy can be measured over time.

export async function recordCorrection(params: {
  traceId?: string
  projectId?: string
  feature: string
  model: string
  kind: 'edit' | 'reject' | 'accept' | 'rating'
  rating?: number // 1..5
  original?: string
  corrected?: string
}): Promise<void> {
  try {
    await fromTable('training_corrections').insert({
      trace_id: params.traceId ?? null,
      project_id: params.projectId ?? null,
      feature: params.feature,
      model: params.model,
      kind: params.kind,
      rating: params.rating ?? null,
      original: params.original?.slice(0, 4000) ?? null,
      corrected: params.corrected?.slice(0, 4000) ?? null,
    })
  } catch (e) {
    console.warn('[aiObservability] recordCorrection failed', e)
  }
}

// ─── Usage aggregation for the dashboard widget ──────────────
export interface UsageRollup {
  totalCalls: number
  totalCostCents: number
  totalInputTokens: number
  totalOutputTokens: number
  errorRate: number
  byFeature: Array<{ feature: string; calls: number; costCents: number }>
  byModel: Array<{ model: string; calls: number; costCents: number }>
  byDay: Array<{ day: string; calls: number; costCents: number }>
}

export async function getUsageRollup(
  projectId: string | null,
  sinceDays = 30,
): Promise<UsageRollup> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString()
  let query = fromTable('ai_cost_tracking')
    .select('model, operation, input_tokens, output_tokens, total_cost_cents, metadata, created_at')
    .gte('created_at' as never, since)
    .limit(5000)
  if (projectId) query = query.eq('project_id' as never, projectId)
  const { data, error } = await query
  if (error) {
    console.warn('[aiObservability] getUsageRollup failed', error)
    return emptyRollup()
  }

  const rows = (data ?? []) as Array<{
    model: string | null
    operation: string | null
    input_tokens: number
    output_tokens: number
    total_cost_cents: number
    metadata: { feature?: string; error?: string } | null
    created_at: string
  }>

  let totalCostCents = 0
  let totalIn = 0
  let totalOut = 0
  let errors = 0
  const featureMap = new Map<string, { calls: number; costCents: number }>()
  const modelMap = new Map<string, { calls: number; costCents: number }>()
  const dayMap = new Map<string, { calls: number; costCents: number }>()

  for (const r of rows) {
    totalCostCents += r.total_cost_cents
    totalIn += r.input_tokens
    totalOut += r.output_tokens
    if (r.metadata?.error) errors++

    const feature = r.metadata?.feature ?? r.operation ?? 'unknown'
    const fm = featureMap.get(feature) ?? { calls: 0, costCents: 0 }
    fm.calls++
    fm.costCents += r.total_cost_cents
    featureMap.set(feature, fm)

    const model = r.model ?? 'unknown'
    const mm = modelMap.get(model) ?? { calls: 0, costCents: 0 }
    mm.calls++
    mm.costCents += r.total_cost_cents
    modelMap.set(model, mm)

    const day = r.created_at.slice(0, 10)
    const dm = dayMap.get(day) ?? { calls: 0, costCents: 0 }
    dm.calls++
    dm.costCents += r.total_cost_cents
    dayMap.set(day, dm)
  }

  return {
    totalCalls: rows.length,
    totalCostCents,
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    errorRate: rows.length === 0 ? 0 : errors / rows.length,
    byFeature: [...featureMap.entries()].map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.costCents - a.costCents),
    byModel: [...modelMap.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.costCents - a.costCents),
    byDay: [...dayMap.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
  }
}

function emptyRollup(): UsageRollup {
  return {
    totalCalls: 0,
    totalCostCents: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    errorRate: 0,
    byFeature: [],
    byModel: [],
    byDay: [],
  }
}

/** Explicit export so tests can mock the supabase client. */
export const __internal = { supabase }
