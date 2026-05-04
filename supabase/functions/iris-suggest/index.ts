// Iris suggest — queries entity state, runs the pure suggestPolicy lib,
// returns 0-3 suggestions for the given entity. Idempotent dedup via
// iris_suggestion_history.
//
// POST { entity_type, entity_id, project_id } → Suggestion[]

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

interface SuggestRequest {
  entity_type: 'rfi' | 'submittal' | 'change_order' | 'punch_item' | 'daily_log'
  entity_id: string
  project_id: string
}

const DAY_MS = 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<SuggestRequest>(req)
    const project_id = requireUuid(body.project_id, 'project_id')
    const entity_id = requireUuid(body.entity_id, 'entity_id')
    await verifyProjectMembership(supabase, user.id, project_id)

    // Load preferences (suggestion_frequency drives the throttle).
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('suggestion_frequency')
      .eq('user_id', user.id)
      .maybeSingle()
    const frequency: 'off' | 'occasional' | 'always' =
      (prefs?.suggestion_frequency as 'off' | 'occasional' | 'always') ?? 'occasional'
    if (frequency === 'off') {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Load entity-relevant fields.
    const fields = await loadEntityFields(supabase, body.entity_type, entity_id)

    // Load last 24h of suggestion history for dedup.
    const since = new Date(Date.now() - DAY_MS).toISOString()
    const { data: history = [] } = await supabase
      .from('iris_suggestion_history')
      .select('user_id, entity_type, entity_id, suggestion_kind, suggested_at')
      .eq('user_id', user.id)
      .eq('entity_id', entity_id)
      .gte('suggested_at', since)

    // Run the pure policy in-line (deno can't import from the React app).
    const suggestions = runSuggestPolicy(
      { entity_type: body.entity_type, entity_id, project_id, fields },
      history ?? [],
      frequency,
      new Date(),
    )

    // Persist newly-suggested rows for audit + future dedup.
    if (suggestions.length > 0) {
      await supabase.from('iris_suggestion_history').insert(
        suggestions.map((s: { kind: string }) => ({
          user_id: user.id,
          entity_type: body.entity_type,
          entity_id,
          suggestion_kind: s.kind,
        })),
      )
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return errorResponse(req, e)
  }
})

async function loadEntityFields(
  supabase: { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } } } },
  entity_type: string,
  entity_id: string,
): Promise<Record<string, unknown>> {
  // Map entity_type → table + column projection. Each table only returns the
  // fields suggestPolicy inspects.
  if (entity_type === 'rfi') {
    const { data } = await supabase.from('rfis').select('sent_at, status').eq('id', entity_id).maybeSingle()
    return data ?? {}
  }
  if (entity_type === 'punch_item') {
    const { data } = await supabase.from('punch_items').select('created_at, status').eq('id', entity_id).maybeSingle()
    return data ?? {}
  }
  if (entity_type === 'daily_log') {
    const { data } = await supabase.from('daily_logs').select('log_date').eq('id', entity_id).maybeSingle()
    return data ?? {}
  }
  if (entity_type === 'submittal') {
    const { data } = await supabase.from('submittals').select('submitted_at, status').eq('id', entity_id).maybeSingle()
    return data ?? {}
  }
  if (entity_type === 'change_order') {
    const { data } = await supabase.from('change_orders').select('cost_impact').eq('id', entity_id).maybeSingle()
    return data ?? {}
  }
  return {}
}

// Inlined suggest policy (mirrors src/lib/iris/suggestPolicy.ts). Edge
// functions can't import from src/, so we duplicate the logic. Tests
// against the lib version cover correctness; this is just the shipping copy.
function runSuggestPolicy(
  entity: { entity_type: string; entity_id: string; project_id: string; fields: Record<string, unknown> },
  history: Array<{ suggestion_kind: string; suggested_at: string }>,
  frequency: 'off' | 'occasional' | 'always',
  now: Date,
): Array<{ kind: string; entity_type: string; entity_id: string; title: string; rationale: string; confidence: number }> {
  if (frequency === 'off') return []
  const candidates: Array<{ kind: string; entity_type: string; entity_id: string; title: string; rationale: string; confidence: number }> = []
  const f = entity.fields

  if (entity.entity_type === 'rfi' && f.sent_at && f.status !== 'answered' && f.status !== 'closed') {
    const days = (now.getTime() - new Date(f.sent_at as string).getTime()) / DAY_MS
    if (days > 5) {
      const conf = Math.min(0.95, 0.6 + (days - 5) * 0.03)
      candidates.push({
        kind: 'rfi.draft_response',
        entity_type: 'rfi',
        entity_id: entity.entity_id,
        title: 'Iris drafted a response — review?',
        rationale: `RFI has been open ${Math.floor(days)} days without response`,
        confidence: Math.round(conf * 100) / 100,
      })
    }
  }
  if (entity.entity_type === 'punch_item' && f.created_at && f.status !== 'closed' && f.status !== 'verified') {
    const days = (now.getTime() - new Date(f.created_at as string).getTime()) / DAY_MS
    if (days > 7) {
      const conf = Math.min(0.92, 0.65 + (days - 7) * 0.025)
      candidates.push({
        kind: 'punch_item.follow_up',
        entity_type: 'punch_item',
        entity_id: entity.entity_id,
        title: 'Iris drafted a follow-up to the sub',
        rationale: `Punch item open ${Math.floor(days)} days`,
        confidence: Math.round(conf * 100) / 100,
      })
    }
  }
  if (entity.entity_type === 'submittal' && f.status === 'pending_review' && f.submitted_at) {
    const days = (now.getTime() - new Date(f.submitted_at as string).getTime()) / DAY_MS
    if (days > 14) {
      const conf = Math.min(0.9, 0.7 + (days - 14) * 0.015)
      candidates.push({
        kind: 'submittal.nudge_architect',
        entity_type: 'submittal',
        entity_id: entity.entity_id,
        title: 'Iris drafted an architect nudge',
        rationale: `Submittal in pending review ${Math.floor(days)} days`,
        confidence: Math.round(conf * 100) / 100,
      })
    }
  }
  if (entity.entity_type === 'change_order' && (f.cost_impact as number) > 50000 && !f.quote_attached) {
    candidates.push({
      kind: 'change_order.request_backup',
      entity_type: 'change_order',
      entity_id: entity.entity_id,
      title: 'Iris suggested asking the sub for backup',
      rationale: 'CO over $50k with no quote attached',
      confidence: 0.88,
    })
  }
  // 24h dedup
  const cutoff = new Date(now.getTime() - DAY_MS)
  const recent = new Set(history.filter((h) => new Date(h.suggested_at) >= cutoff).map((h) => h.suggestion_kind))
  const fresh = candidates.filter((c) => !recent.has(c.kind))
  fresh.sort((a, b) => b.confidence - a.confidence)
  if (frequency === 'occasional') return fresh.filter((s) => s.confidence >= 0.8).slice(0, 1)
  return fresh.filter((s) => s.confidence >= 0.5).slice(0, 3)
}
