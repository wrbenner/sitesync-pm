/**
 * Iris tool definitions — the bridge from LLM tool-calls to the
 * `drafted_actions` substrate.
 *
 * The /copilot chat (and any future agent loop) uses these as the
 * "what can I do?" surface. The LLM emits a tool call → we validate
 * the args → we write a row to `drafted_actions` → the user sees the
 * draft in the Iris Inbox and approves it.
 *
 * The LLM never directly executes a mutation. Approval is always a
 * human step. This is the safety property that lets us trust an AI
 * super on real construction projects.
 *
 * Tool schemas use the JSON Schema dialect that AI SDK / OpenAI tools
 * accept. Keep them small, opinionated, and exhaustively-typed; an
 * LLM can fill in vague schemas with plausible nonsense.
 */

import { draftAction } from './draftAction'
import type {
  DraftedAction,
  DraftedActionCitation,
  DraftedActionType,
  DraftedRfiPayload,
  DraftedDailyLogPayload,
  DraftedPayAppPayload,
} from '../../types/draftedActions'

// ── Tool schemas ──────────────────────────────────────────────────────

export const irisTools = [
  {
    name: 'iris.draft_rfi',
    description:
      'Draft an RFI to the architect/engineer. Use when you spot a question on the drawings, a code conflict, or a missing detail. Always include at least one citation explaining why.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title — what the RFI is asking. e.g. "Confirm column dimensions at line 7"' },
        description: { type: 'string', description: 'Full RFI body. Be specific. Include drawing refs and exact location.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'critical = work is stopped; high = blocks within a week; medium = within 2 weeks; low = soon-ish.' },
        discipline: { type: 'string', description: 'Architectural / Structural / MEP / Civil / etc.' },
        spec_section: { type: 'string', description: 'CSI division code, e.g. "03 30 00".' },
        drawing_id: { type: 'string', description: 'UUID of the cited drawing if any.' },
        due_date: { type: 'string', format: 'date', description: 'Requested response by date (ISO yyyy-mm-dd).' },
        confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Your confidence (0-1) that this RFI is needed and well-formed. Below 0.5 will be flagged "needs review".' },
        citations: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/citation' },
          description: 'At least one citation explaining why this RFI exists.',
        },
      },
      required: ['title', 'description', 'citations'],
    },
  },
  {
    name: 'iris.draft_daily_log',
    description:
      'Draft a daily log narration from photos, crew check-ins, weather, and GPS. The super reviews and signs.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', format: 'date' },
        notes: { type: 'string', description: 'The narrative. Trades onsite, work performed, deliveries, issues, weather impact.' },
        weather: {
          type: 'object',
          properties: {
            condition: { type: 'string' },
            high_temp: { type: 'number' },
            low_temp: { type: 'number' },
            precipitation: { type: 'string' },
          },
        },
        manpower_count: { type: 'integer', minimum: 0 },
        trades: {
          type: 'array',
          items: {
            type: 'object',
            properties: { trade: { type: 'string' }, count: { type: 'integer', minimum: 0 } },
            required: ['trade', 'count'],
          },
        },
        photo_ids: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        citations: { type: 'array', items: { $ref: '#/definitions/citation' } },
      },
      required: ['date', 'notes'],
    },
  },
  {
    name: 'iris.draft_pay_app',
    description:
      'Draft an AIA G702/G703 pay application from the schedule of values, approved change orders, and per-line completion %. Returns a draft for the PM to review and sign.',
    input_schema: {
      type: 'object',
      properties: {
        application_number: { type: 'integer', minimum: 1 },
        period_from: { type: 'string', format: 'date' },
        period_to: { type: 'string', format: 'date' },
        total_completed_and_stored: { type: 'number' },
        retainage: { type: 'number' },
        amount_due: { type: 'number' },
        line_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item_no: { type: 'string' },
              description: { type: 'string' },
              scheduled_value: { type: 'number' },
              work_completed_this_period: { type: 'number' },
              materials_stored: { type: 'number' },
              percent_complete: { type: 'number', minimum: 0, maximum: 100 },
            },
            required: ['description', 'scheduled_value', 'work_completed_this_period', 'percent_complete'],
          },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        citations: { type: 'array', items: { $ref: '#/definitions/citation' } },
      },
      required: ['application_number', 'period_from', 'period_to', 'line_items'],
    },
  },
] as const

export type IrisToolName = (typeof irisTools)[number]['name']

// ── Tool dispatcher ───────────────────────────────────────────────────

interface ToolCallContext {
  projectId: string
  modelLabel: string // e.g. "claude-sonnet-4-6@2026-04-27"
}

interface ToolCallResult {
  ok: boolean
  draftId?: string
  draft?: DraftedAction
  error?: string
}

export async function dispatchIrisTool(
  name: IrisToolName,
  args: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  switch (name) {
    case 'iris.draft_rfi':
      return await draftRfiFromTool(args, ctx)
    case 'iris.draft_daily_log':
      return await draftDailyLogFromTool(args, ctx)
    case 'iris.draft_pay_app':
      return await draftPayAppFromTool(args, ctx)
    default:
      return { ok: false, error: `Unknown tool: ${name}` }
  }
}

// ── Per-tool dispatchers ──────────────────────────────────────────────

async function draftRfiFromTool(
  args: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  const a = args as Partial<DraftedRfiPayload> & { confidence?: number; citations?: DraftedActionCitation[] }
  if (!a.title || !a.description) return { ok: false, error: 'title and description required' }

  const result = await draftAction<DraftedActionType & 'rfi.draft'>({
    project_id: ctx.projectId,
    action_type: 'rfi.draft' as const,
    title: a.title,
    summary: a.description.slice(0, 280),
    payload: {
      title: a.title,
      description: a.description,
      priority: a.priority,
      discipline: a.discipline,
      spec_section: a.spec_section,
      drawing_id: a.drawing_id,
      due_date: a.due_date,
    },
    citations: a.citations ?? [],
    confidence: a.confidence,
    drafted_by: ctx.modelLabel,
  })

  return { ok: result.ok, draftId: result.draft?.id, draft: result.draft, error: result.error }
}

async function draftDailyLogFromTool(
  args: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  const a = args as Partial<DraftedDailyLogPayload> & { confidence?: number; citations?: DraftedActionCitation[] }
  if (!a.date || !a.notes) return { ok: false, error: 'date and notes required' }

  const result = await draftAction<DraftedActionType & 'daily_log.draft'>({
    project_id: ctx.projectId,
    action_type: 'daily_log.draft' as const,
    title: `Daily log — ${a.date}`,
    summary: a.notes.slice(0, 280),
    payload: {
      date: a.date,
      notes: a.notes,
      weather: a.weather,
      manpower_count: a.manpower_count,
      trades: a.trades,
      photo_ids: a.photo_ids,
    },
    citations: a.citations ?? [],
    confidence: a.confidence,
    drafted_by: ctx.modelLabel,
  })

  return { ok: result.ok, draftId: result.draft?.id, draft: result.draft, error: result.error }
}

async function draftPayAppFromTool(
  args: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  const a = args as Partial<DraftedPayAppPayload> & { confidence?: number; citations?: DraftedActionCitation[] }
  if (!a.application_number || !a.line_items) return { ok: false, error: 'application_number and line_items required' }

  const result = await draftAction<DraftedActionType & 'pay_app.draft'>({
    project_id: ctx.projectId,
    action_type: 'pay_app.draft' as const,
    title: `Pay App #${a.application_number} — ${a.period_to}`,
    summary: `${a.line_items.length} line items · $${(a.amount_due ?? 0).toLocaleString()} due`,
    payload: {
      application_number: a.application_number,
      period_from: a.period_from ?? new Date().toISOString().slice(0, 10),
      period_to: a.period_to ?? new Date().toISOString().slice(0, 10),
      total_completed_and_stored: a.total_completed_and_stored ?? 0,
      retainage: a.retainage ?? 0,
      amount_due: a.amount_due ?? 0,
      line_items: a.line_items.map((li) => ({
        item_no: li.item_no ?? '',
        description: li.description ?? '',
        scheduled_value: li.scheduled_value ?? 0,
        work_completed_this_period: li.work_completed_this_period ?? 0,
        materials_stored: li.materials_stored ?? 0,
        percent_complete: li.percent_complete ?? 0,
      })),
    },
    citations: a.citations ?? [],
    confidence: a.confidence,
    drafted_by: ctx.modelLabel,
  })

  return { ok: result.ok, draftId: result.draft?.id, draft: result.draft, error: result.error }
}
