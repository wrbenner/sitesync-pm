// =============================================================================
// draft-change-order — RFI answered → drafted CO
// =============================================================================
// Triggered:
//   1. By the RFI status-flip handler when an RFI moves to 'answered'.
//   2. Manually via POST { rfi_id } from the UI's "Re-evaluate" debug action.
//
// Flow:
//   load RFI + thread
//   ↓
//   project.auto_co_drafting_enabled?  (skip if false)
//   ↓
//   already a CO with source_rfi_id = this RFI?  (skip — PM is on it)
//   ↓
//   answer matches a 'no_change' pattern?  (short-circuit; skip AI)
//   ↓
//   call routeAI('reasoning')  (model returns line items, no money)
//   ↓
//   validate: scope_change=true AND answer has a scope-change signal
//   ↓
//   estimateCost(line_items)  (cost_database lookups in our code)
//   ↓
//   draft into change_orders WITH source_rfi_id and confidence in payload
//   ↓
//   draftAction()  (Iris inbox card, related_resource_id = co.id)
//
// All writes are idempotent — uniqueness on (source_rfi_id, status IN
// pending/draft/submitted) prevents duplicate drafts; the change_orders
// migration enforces this.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  sanitizeForPrompt,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'
import { routeAI } from '../shared/aiRouter.ts'
import { buildPrompt, isAllowedKind } from './promptBuilder.ts'
import {
  answerHasScopeSignal,
  answerIsExplicitNoChange,
} from '../shared/coAutoDraft/scopeChangePatterns.ts'
import { estimateCostFromCandidates } from '../shared/coAutoDraft/costEstimator.ts'
import type {
  ScopeClassification,
  ScopeChangeKind,
  ScopeConfidence,
  ScopeLineItem,
} from '../shared/coAutoDraft/types.ts'

interface RequestBody {
  rfi_id: string
}

function reasonCodeForKind(kind: ScopeChangeKind):
  'design_change' | 'owner_directive' | 'unforeseen_condition' | 'rfi_clarification' {
  switch (kind) {
    case 'material_substitution':
    case 'detail_change':
    case 'sequence_change':
      return 'design_change'
    case 'quantity_change':
    case 'new_scope_element':
    case 'no_change':
      return 'rfi_clarification'
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { user, supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    requireUuid(body.rfi_id, 'rfi_id')

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── 1. Load RFI ─────────────────────────────────────────
    const { data: rfi, error: rfiErr } = await supabase
      .from('rfis')
      .select('id, project_id, title, description, drawing_reference, status, created_by, assigned_to')
      .eq('id', body.rfi_id)
      .maybeSingle()
    if (rfiErr) throw rfiErr
    if (!rfi) throw new HttpError(404, 'RFI not found')

    await verifyProjectMembership(supabase, user.id, rfi.project_id)

    // ── 2. Project opt-out + duplicate check ────────────────
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, organization_id, auto_co_drafting_enabled')
      .eq('id', rfi.project_id)
      .single()
    if (projErr) throw projErr
    if (project.auto_co_drafting_enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'auto_co_drafting_disabled' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }

    const { data: existingCo } = await supabase
      .from('change_orders')
      .select('id, status')
      .eq('source_rfi_id', body.rfi_id)
      .in('status', ['pending_review', 'draft', 'submitted', 'approved'])
      .limit(1)
      .maybeSingle()
    if (existingCo) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'co_exists', co_id: existingCo.id }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }

    // ── 3. Load thread (responses) ──────────────────────────
    const { data: responses } = await supabase
      .from('rfi_responses')
      .select('id, author_id, content, created_at')
      .eq('rfi_id', body.rfi_id)
      .order('created_at', { ascending: true })

    const thread = (responses ?? []).map(r => ({
      author: r.author_id ?? 'unknown',
      content: sanitizeForPrompt(r.content ?? ''),
      createdAt: r.created_at,
    }))
    if (thread.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no_responses_yet' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }

    const lastReply = thread[thread.length - 1].content

    // ── 4. Short-circuit on explicit no-change ──────────────
    if (answerIsExplicitNoChange(lastReply)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no_change_signal' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }

    // ── 5. Call the model ───────────────────────────────────
    const { system, user: prompt } = buildPrompt({
      rfiTitle: sanitizeForPrompt(rfi.title ?? '', 240),
      rfiDescription: sanitizeForPrompt(rfi.description ?? '', 4000),
      rfiDrawingReference: rfi.drawing_reference,
      thread,
    })

    const aiResp = await routeAI({
      task: 'reasoning',
      system,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.1,  // low — classification, not creative writing
    })

    let parsed: {
      scope_change?: boolean
      kind?: unknown
      reasoning?: string
      confidence?: string
      title?: string
      narrative?: string
      schedule_impact_likely?: boolean
      line_items?: Array<{ description?: string; quantity?: number | null; unit?: string | null; csi_code?: string | null }>
    }
    try {
      parsed = JSON.parse(aiResp.content.trim().replace(/^```json|```$/g, '').trim())
    } catch {
      throw new HttpError(502, 'Model returned non-JSON response')
    }

    // ── 6. Validate model output against safety net ─────────
    const modelKind = parsed.kind
    if (!isAllowedKind(modelKind)) {
      throw new HttpError(502, 'Model returned invalid kind')
    }
    const claimedScope = !!parsed.scope_change
    const corroboratedBySignal = answerHasScopeSignal(lastReply)
    const finalConfidence: ScopeConfidence =
      parsed.confidence === 'high' && corroboratedBySignal ? 'high'
      : parsed.confidence === 'low' ? 'low'
      : 'medium'

    if (!claimedScope || modelKind === 'no_change') {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'model_says_no_scope_change', confidence: finalConfidence }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }
    if (!corroboratedBySignal && finalConfidence !== 'high') {
      // Model claimed a scope change but the answer text has no anchor signal.
      // Conservative: don't draft a CO — leave the PM an Iris inbox card.
      return new Response(
        JSON.stringify({ skipped: true, reason: 'model_claim_unsupported_by_signal' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }

    // ── 7. Cost estimation (cost_database) ──────────────────
    const lineItems: ScopeLineItem[] = (parsed.line_items ?? []).map(li => ({
      description: String(li.description ?? '').slice(0, 240),
      quantity: typeof li.quantity === 'number' && Number.isFinite(li.quantity) ? li.quantity : null,
      unit: typeof li.unit === 'string' ? li.unit.slice(0, 16) : null,
      csiCode: typeof li.csi_code === 'string' ? li.csi_code.slice(0, 12) : null,
    }))

    const csiCodes = Array.from(
      new Set(lineItems.map(l => l.csiCode).filter((v): v is string => !!v)),
    )
    let costRows: unknown[] = []
    if (lineItems.length > 0) {
      let q = supabase.from('cost_database').select('*')
      if (project.organization_id) q = q.eq('organization_id', project.organization_id)
      if (csiCodes.length > 0) q = q.in('csi_code', csiCodes)
      const { data } = await q.limit(200)
      costRows = data ?? []
    }
    const costEstimate = estimateCostFromCandidates(
      lineItems,
      costRows as Parameters<typeof estimateCostFromCandidates>[1],
    )

    // ── 8. Insert CO row ────────────────────────────────────
    const classification: ScopeClassification = {
      scopeChange: true,
      kind: modelKind,
      reasoning: String(parsed.reasoning ?? '').slice(0, 1000),
      confidence: finalConfidence,
      lineItems,
    }

    const coTitle = String(parsed.title || `RFI ${body.rfi_id.slice(0, 8)} — scope change`).slice(0, 240)
    const coNarrative = String(parsed.narrative ?? '').slice(0, 4000)

    const { data: co, error: coErr } = await supabase
      .from('change_orders')
      .insert({
        project_id: rfi.project_id,
        title: coTitle,
        description: coNarrative,
        amount: costEstimate.total ?? 0,
        estimated_cost: costEstimate.total,
        schedule_impact_days: 0,  // never invented; PM enters or a downstream calc fills this
        status: 'pending_review',
        type: 'owner',
        reason_code: reasonCodeForKind(modelKind),
        reason: classification.reasoning,
        source_rfi_id: body.rfi_id,
        requested_by: 'auto-draft (Iris)',
        requested_date: new Date().toISOString().slice(0, 10),
      } as never)
      .select('id, number, title')
      .single()
    if (coErr) {
      // The unique partial index will fire when a duplicate sneaks past the
      // pre-check above (race between two triggers). Not an error condition —
      // the existing draft is fine.
      if (coErr.code === '23505') {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'co_already_drafted_concurrently' }),
          { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
        )
      }
      throw coErr
    }

    // ── 9. Iris inbox card (graceful skip if drafted_actions absent) ─
    let draftedActionId: string | null = null
    try {
      const { data: ia, error: iaErr } = await supabase
        .from('drafted_actions')
        .insert({
          project_id: rfi.project_id,
          action_type: 'change_order_draft',
          title: `Drafted CO: ${coTitle}`,
          summary: classification.reasoning,
          payload: {
            co_id: co.id,
            co_number: co.number,
            classification,
            cost: costEstimate,
          },
          citations: [{ kind: 'rfi', id: body.rfi_id }],
          confidence:
            finalConfidence === 'high' ? 0.9 : finalConfidence === 'medium' ? 0.65 : 0.4,
          drafted_by: 'iris/draft-change-order',
          related_resource_type: 'change_order',
          related_resource_id: co.id,
          status: 'pending',
        } as never)
        .select('id')
        .single()
      if (!iaErr && ia) draftedActionId = (ia as { id: string }).id
    } catch (_) { /* drafted_actions table may not exist on older deployments */ }

    return new Response(
      JSON.stringify({
        co_id: co.id,
        co_number: co.number,
        co_title: coTitle,
        cost_total: costEstimate.total,
        cost_provenance: costEstimate.provenance,
        confidence: finalConfidence,
        kind: modelKind,
        drafted_action_id: draftedActionId,
        ai_provider: aiResp.provider,
        ai_model: aiResp.model,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
