// ────────────────────────────────────────────────────────────────────────────
// renderContext — deterministic IrisContext → system-prompt string
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §4.6
// ADR-020: every Iris call's system prompt comes from this function only.
//
// Properties:
//   - Pure function. Same inputs → same output. No I/O, no clock reads.
//   - Null slots are dropped. Never emits the literal string "null".
//   - Slot order is fixed: persona preamble → WHO → WHAT → WHEN → WHERE → WHY.
//   - Token budget is enforced here (not in buildContext). The Fabric's typed
//     object is always complete; the *rendered* prompt is what gets trimmed.

import type {
  IrisContext,
  PersonaSlug,
  SlotName,
  TrimLogEntry,
} from './types/context'
import { SLOT_TOKEN_CEILINGS, TOTAL_FABRIC_TOKEN_BUDGET } from './types/context'
import { estimateTokens } from './contextFabric'
import { getPersonaConfig, type PersonaConfig } from './personas'

export interface RenderResult {
  prompt: string
  tokens_estimated: number
  slot_tokens: Record<SlotName, number>
  trim_log: TrimLogEntry[]
}

export function renderContext(ctx: IrisContext, persona: PersonaSlug | PersonaConfig): RenderResult {
  const personaConfig = typeof persona === 'string' ? getPersonaConfig(persona) : persona
  const trimLog: TrimLogEntry[] = []

  const personaBlock = personaConfig.base_prompt_fragment.trim()

  const whoBlock = renderWhoSlot(ctx, trimLog)
  const whatBlock = renderWhatSlot(ctx, trimLog)
  const whenBlock = renderWhenSlot(ctx, trimLog)
  const whereBlock = renderWhereSlot(ctx, trimLog)
  const whyBlock = renderWhySlot(ctx, trimLog)

  // Compose in the spec's fixed order. Drop null/empty blocks.
  const sections = [personaBlock, whoBlock, whatBlock, whenBlock, whereBlock, whyBlock].filter(
    (s): s is string => Boolean(s && s.length > 0),
  )

  let prompt = sections.join('\n\n')
  let tokens = estimateTokens(prompt)

  // Hard ceiling enforcement: if even after slot-level trims we're over the
  // total budget, truncate the prompt at the budget boundary and log it as
  // a fabric_overflow incident. The renderer never silently exceeds.
  if (tokens > TOTAL_FABRIC_TOKEN_BUDGET) {
    const charBudget = TOTAL_FABRIC_TOKEN_BUDGET * 4
    const truncated = prompt.slice(0, charBudget)
    trimLog.push({
      slot: 'what', // truncated last per spec — but record on the most-likely culprit
      reason: 'over_budget',
      tokens_dropped: tokens - TOTAL_FABRIC_TOKEN_BUDGET,
      fields_dropped: ['_global_truncation'],
    })
    prompt = truncated
    tokens = estimateTokens(prompt)
  }

  return {
    prompt,
    tokens_estimated: tokens,
    slot_tokens: ctx.meta.token_counts,
    trim_log: trimLog,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Per-slot renderers (Phase 1a — minimal, deterministic)
// ────────────────────────────────────────────────────────────────────────────

function renderWhoSlot(ctx: IrisContext, trimLog: TrimLogEntry[]): string {
  const slot = ctx.who
  if (!slot) return ''
  const lines: string[] = ['### WHO']
  lines.push(`- User: ${slot.display_name} (first name: ${slot.first_name})`)
  lines.push(`- Persona: ${slot.persona}`)
  lines.push(`- Project role: ${slot.role}`)
  if (slot.recent_actions.length > 0) {
    const ceiling = SLOT_TOKEN_CEILINGS.who
    const actionLines = slot.recent_actions.map(
      (a) => `  - ${a.occurred_at}: ${a.action} on ${a.entity_ref}`,
    )
    let actionsBlock = ['- Recent actions:', ...actionLines].join('\n')
    while (
      estimateTokens(actionsBlock) + estimateTokens(lines.join('\n')) > ceiling &&
      actionLines.length > 0
    ) {
      actionLines.pop()
      actionsBlock = ['- Recent actions:', ...actionLines].join('\n')
      trimLog.push({
        slot: 'who',
        reason: 'over_budget',
        tokens_dropped: 0,
        fields_dropped: ['recent_actions[oldest]'],
      })
    }
    if (actionLines.length > 0) lines.push(actionsBlock)
  }
  if (slot.permissions.length > 0) {
    const granted = slot.permissions.filter((p) => p.granted).map((p) => p.capability)
    if (granted.length > 0) lines.push(`- Permissions: ${granted.join(', ')}`)
  }
  return lines.join('\n')
}

function renderWhatSlot(ctx: IrisContext, trimLog: TrimLogEntry[]): string {
  const slot = ctx.what
  if (!slot) return ''
  const lines: string[] = ['### WHAT']
  lines.push(`- Current page: ${slot.current_page}`)
  if (slot.entity_type && slot.entity_id) {
    lines.push(`- Entity: ${slot.entity_type} #${slot.entity_id} (state: ${slot.entity_state ?? 'unknown'})`)
  }
  if (slot.entity_summary) {
    // Truncate entity_summary to 80 chars when slot is over budget (spec §4.3).
    const ceiling = SLOT_TOKEN_CEILINGS.what
    let summary = slot.entity_summary
    if (estimateTokens(summary) > ceiling / 2) {
      summary = summary.slice(0, 80) + '…'
      trimLog.push({
        slot: 'what',
        reason: 'over_budget',
        tokens_dropped: estimateTokens(slot.entity_summary) - estimateTokens(summary),
        fields_dropped: ['entity_summary[truncated_80]'],
      })
    }
    lines.push(`- Summary: ${summary}`)
  }
  if (slot.related_entities.length > 0) {
    const refs = slot.related_entities.map(
      (r) => `  - ${r.relation} ${r.entity_type} #${r.entity_id}: ${r.summary}`,
    )
    lines.push('- Related:', refs.join('\n'))
  }
  return lines.join('\n')
}

function renderWhenSlot(ctx: IrisContext, _trimLog: TrimLogEntry[]): string {
  const slot = ctx.when
  if (!slot) return ''
  const lines: string[] = ['### WHEN']
  lines.push(`- Project phase: ${slot.project_phase}`)
  if (slot.days_to_substantial_completion !== null) {
    lines.push(`- Days to substantial completion: ${slot.days_to_substantial_completion}`)
  }
  lines.push(`- Schedule status: ${slot.schedule_status}`)
  if (slot.schedule_variance_days !== null) {
    lines.push(`- Schedule variance (days): ${slot.schedule_variance_days}`)
  }
  if (slot.cycle_position !== 'normal_week') {
    lines.push(`- Cycle position: ${slot.cycle_position}`)
  }
  return lines.join('\n')
}

function renderWhereSlot(ctx: IrisContext, _trimLog: TrimLogEntry[]): string {
  const slot = ctx.where
  if (!slot) return ''
  const lines: string[] = ['### WHERE']
  lines.push(`- Project: ${slot.project_name} (id: ${slot.project_id})`)
  if (slot.area_name) lines.push(`- Area: ${slot.area_name}`)
  if (slot.weather_now) {
    lines.push(
      `- Weather now: ${slot.weather_now.conditions}, ${slot.weather_now.temp_f}°F, ${slot.weather_now.precipitation_pct}% precip`,
    )
  }
  if (slot.weather_5d_forecast && slot.weather_5d_forecast.length > 0) {
    const days = slot.weather_5d_forecast
      .slice(0, 3) // trim tail to first 3 days per spec §4.3
      .map((d) => `  - ${d.date}: ${d.conditions}, ${d.low_f}-${d.high_f}°F, ${d.precipitation_pct}% precip`)
    lines.push('- 3-day forecast:', days.join('\n'))
  }
  return lines.join('\n')
}

function renderWhySlot(ctx: IrisContext, _trimLog: TrimLogEntry[]): string {
  const slot = ctx.why
  if (!slot) return ''
  const lines: string[] = ['### WHY']
  lines.push(`- Invocation intent: ${slot.invocation_intent}`)
  lines.push(`- Page intent: ${slot.page_intent}`)
  if (slot.pinned_context.length > 0) {
    const pins = slot.pinned_context.map((p) => `  - ${p.kind}: ${p.title} (${p.ref})`)
    lines.push('- Pinned context:', pins.join('\n'))
  }
  if (slot.recent_query_history.length > 0) {
    const trimmed = slot.recent_query_history.slice(-3)
    lines.push(`- Recent queries: ${trimmed.map((q) => `"${q}"`).join('; ')}`)
  }
  return lines.join('\n')
}
