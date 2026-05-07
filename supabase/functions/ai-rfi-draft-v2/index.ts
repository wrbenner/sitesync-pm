// ai-rfi-draft-v2 — Multi-pass Iris draft pipeline
//
// P2b deliverable #1. Layers seven passes on top of the existing
// single-pass `ai-rfi-draft` to produce a fully-cited RFI draft with
// per-field confidence + citations[] per IRIS_CITATIONS_SPEC.
//
// Passes (each pass writes into the in-memory draft and the pass_log):
//   1. Context extraction        — input + photo + drawing region
//   2. Drawing search             — sheet refs in input → drawing rows
//   3. Spec search                — CSI codes in input → spec_sections
//   4. Answerer suggestion        — title-block designer for the trade
//   5. Due-date suggestion        — schedule slack + business calendar
//   6. Impact suggestion          — historical $/days for similar RFIs
//   7. Body composition           — assemble + run through voice linter
//
// Telemetry: every pass logs its model fingerprint + duration. Aggregate
// confidence = min(per-field confidence). Aggregate band:
//   high   ≥ 0.85
//   medium 0.60-0.85
//   low    < 0.60
//
// Output: an `ai_rfi_drafts` row (status='pending') the UI's
// <RFIIrisDraftPreview /> reads.

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

interface DraftV2Request {
  project_id: string
  /** Free-text question or transcript from the FAB voice recorder. */
  description: string
  /** Optional context if Walker is on a drawing sheet. */
  drawing_id?: string | null
  drawing_viewport?: { x?: number; y?: number; w?: number; h?: number } | null
  photo_base64?: string | null
}

type Citation =
  | { kind: 'drawing'; ref: string; drawing_id?: string; snippet?: string; page?: number; bbox?: { x: number; y: number; w: number; h: number } }
  | { kind: 'spec_section'; ref: string; section_title?: string; snippet?: string }
  | { kind: 'rfi_history'; ref: string; rfi_id?: string; snippet?: string }
  | { kind: 'schedule_phase'; ref: string; phase_id?: string; snippet?: string }
  | { kind: 'directory_contact'; ref: string; user_id?: string; snippet?: string }

type ConfidenceBand = 'high' | 'medium' | 'low'

interface DraftV2 {
  suggested_title: string | null
  suggested_body: string | null
  suggested_ball_in_court: string | null
  suggested_due_date: string | null            // ISO
  suggested_priority: string | null
  suggested_drawing_ids: string[]
  suggested_spec_sections: string[]
  suggested_schedule_days: number | null
  suggested_cost_cents_min: number | null
  suggested_cost_cents_max: number | null
  citations: Citation[]
  confidence_by_field: Record<string, number>
}

interface PassLogEntry {
  pass: number
  name: string
  ms: number
  ok: boolean
  notes?: string
}

const SHEET_REF_RE = /\b([A-Z]{1,3}[-]?\d{1,3}\.\d{2,3})\b/g          // A2.02, M-9.02
const SPEC_SECTION_RE = /\b(\d{2})\s?(\d{2})\s?(\d{2})\b/g            // 09 21 16

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function passDrawingSearch(
  projectId: string,
  description: string,
  drawingIdHint: string | null,
  draft: DraftV2,
  citations: Citation[],
): Promise<void> {
  const refs = new Set<string>()
  for (const m of description.matchAll(SHEET_REF_RE)) refs.add(m[1])
  if (drawingIdHint) {
    // Walker viewing a sheet — pull its title-block ref so the citation
    // chips include the drawing he's on even if he didn't type the ref.
    const { data } = await sb
      .from('drawings')
      .select('id, sheet_number, title')
      .eq('id', drawingIdHint)
      .maybeSingle()
    if (data) {
      const ref = (data as { sheet_number?: string }).sheet_number ?? data.id as string
      refs.add(ref)
      draft.suggested_drawing_ids.push(data.id as string)
      citations.push({
        kind: 'drawing',
        ref,
        drawing_id: data.id as string,
        snippet: (data as { title?: string }).title ?? '',
      })
    }
  }
  if (refs.size === 0) return
  const { data } = await sb
    .from('drawings')
    .select('id, sheet_number, title, project_id')
    .eq('project_id', projectId)
    .in('sheet_number', Array.from(refs))
  for (const row of (data ?? []) as Array<{ id: string; sheet_number?: string; title?: string }>) {
    if (!draft.suggested_drawing_ids.includes(row.id)) {
      draft.suggested_drawing_ids.push(row.id)
      citations.push({
        kind: 'drawing',
        ref: row.sheet_number ?? row.id,
        drawing_id: row.id,
        snippet: row.title ?? '',
      })
    }
  }
}

async function passSpecSearch(
  projectId: string,
  description: string,
  draft: DraftV2,
  citations: Citation[],
): Promise<void> {
  const refs = new Set<string>()
  for (const m of description.matchAll(SPEC_SECTION_RE)) {
    refs.add(`${m[1]} ${m[2]} ${m[3]}`)
  }
  if (refs.size === 0) return
  draft.suggested_spec_sections = Array.from(refs)
  // We don't require a `spec_sections` table — many projects don't
  // have one yet. Cite the references regardless; the UI's snippet
  // resolver tries `specifications` next, then renders the raw ref.
  for (const ref of refs) {
    citations.push({
      kind: 'spec_section',
      ref,
      section_title: undefined,
      snippet: undefined,
    })
  }
}

async function passAnswererSuggestion(
  projectId: string,
  draft: DraftV2,
  citations: Citation[],
): Promise<{ confidence: number }> {
  // Priority order: drawing title-block designer → spec responsible
  // party → directory member with matching trade tag.
  if (draft.suggested_drawing_ids.length > 0) {
    const { data } = await sb
      .from('drawings')
      .select('id, designer_user_id, discipline')
      .in('id', draft.suggested_drawing_ids)
      .limit(1)
    const row = (data?.[0] as { designer_user_id?: string; discipline?: string } | undefined)
    if (row?.designer_user_id) {
      draft.suggested_ball_in_court = row.designer_user_id
      citations.push({
        kind: 'directory_contact',
        ref: row.designer_user_id,
        user_id: row.designer_user_id,
        snippet: `Designer of record on ${draft.suggested_drawing_ids[0]}${row.discipline ? ` (${row.discipline})` : ''}`,
      })
      return { confidence: 0.9 }
    }
  }
  // Spec → directory_contacts trade tag heuristic.
  if (draft.suggested_spec_sections.length > 0) {
    const trade = draft.suggested_spec_sections[0].slice(0, 2)
    const { data } = await sb
      .from('directory_contacts')
      .select('user_id, name, trade')
      .eq('project_id', projectId)
      .eq('trade', trade)
      .limit(1)
    const row = (data?.[0] as { user_id?: string; name?: string } | undefined)
    if (row?.user_id) {
      draft.suggested_ball_in_court = row.user_id
      citations.push({
        kind: 'directory_contact',
        ref: row.user_id,
        user_id: row.user_id,
        snippet: `Trade match on spec ${draft.suggested_spec_sections[0]}`,
      })
      return { confidence: 0.7 }
    }
  }
  return { confidence: 0.3 }
}

async function passDueDateSuggestion(projectId: string, draft: DraftV2): Promise<{ confidence: number }> {
  // Default: 12 calendar days out, skip weekends + holidays.
  const today = new Date()
  const candidate = new Date(today.getTime() + 12 * 86400000)

  // Pull holidays once.
  const { data: holidays } = await sb
    .from('project_business_calendar')
    .select('holiday_date')
    .eq('project_id', projectId)
  const holidaySet = new Set(((holidays ?? []) as Array<{ holiday_date: string }>).map((h) => h.holiday_date))

  // Walk forward until we land on a non-weekend non-holiday.
  for (let i = 0; i < 14; i++) {
    const iso = candidate.toISOString().slice(0, 10)
    const dow = candidate.getDay()
    if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) break
    candidate.setDate(candidate.getDate() + 1)
  }
  draft.suggested_due_date = candidate.toISOString().slice(0, 10)
  return { confidence: 0.75 }
}

async function passImpactSuggestion(
  projectId: string,
  draft: DraftV2,
): Promise<{ confidence: number }> {
  // Heuristic: median schedule + cost across last 50 closed RFIs in
  // the same trade. With no data, default to (0 days, $0-$2K).
  if (draft.suggested_spec_sections.length > 0) {
    const trade = draft.suggested_spec_sections[0].slice(0, 2)
    const { data } = await sb
      .from('rfis')
      .select('schedule_days_impact, cost_impact_cents, spec_section')
      .eq('project_id', projectId)
      .eq('status', 'closed')
      .like('spec_section', `${trade}%`)
      .limit(50)
    const rows = (data ?? []) as Array<{ schedule_days_impact?: number | null; cost_impact_cents?: number | null }>
    if (rows.length > 0) {
      const days = rows.map((r) => Number(r.schedule_days_impact ?? 0)).sort((a, b) => a - b)
      const cents = rows.map((r) => Number(r.cost_impact_cents ?? 0)).sort((a, b) => a - b)
      const med = (arr: number[]) => arr[Math.floor(arr.length / 2)] ?? 0
      const p25 = (arr: number[]) => arr[Math.floor(arr.length * 0.25)] ?? 0
      const p75 = (arr: number[]) => arr[Math.floor(arr.length * 0.75)] ?? 0
      draft.suggested_schedule_days = med(days)
      draft.suggested_cost_cents_min = p25(cents)
      draft.suggested_cost_cents_max = p75(cents)
      return { confidence: 0.7 }
    }
  }
  draft.suggested_schedule_days = 0
  draft.suggested_cost_cents_min = 0
  draft.suggested_cost_cents_max = 200_000        // $2K
  return { confidence: 0.4 }
}

async function passComposition(
  description: string,
  draft: DraftV2,
): Promise<{ titleConfidence: number; bodyConfidence: number }> {
  // Title: first 80 chars trimmed at last word boundary.
  const trimmed = description.trim()
  const titleSeed = trimmed.slice(0, 80).replace(/\s+\S*$/, '').trim() || 'RFI'
  draft.suggested_title = titleSeed.charAt(0).toUpperCase() + titleSeed.slice(1)
  // Body: structured composition.
  const sheetRefs = draft.suggested_drawing_ids.length
    ? `Cited drawings: ${draft.citations.filter((c) => c.kind === 'drawing').map((c) => c.ref).join(', ')}.`
    : ''
  const specRefs = draft.suggested_spec_sections.length
    ? `Cited specs: ${draft.suggested_spec_sections.join(', ')}.`
    : ''
  const body = [
    trimmed,
    sheetRefs,
    specRefs,
    'Please review and respond. SiteSync will track the SLA clock.',
  ].filter(Boolean).join('\n\n')
  draft.suggested_body = applyVoiceLinter(body)
  return { titleConfidence: 0.7, bodyConfidence: 0.65 }
}

/**
 * Voice linter (post-process) per ADR-005. Lightweight rules:
 *   • Strip leading/trailing whitespace and double newlines.
 *   • Replace casual contractions ("can't", "won't") with formal forms.
 *   • Replace exclamation marks with periods (RFIs are formal).
 * The full linter lives in src/lib/iris/style.ts on the client; this
 * is a defensible subset for the edge environment.
 */
function applyVoiceLinter(text: string): string {
  return text
    .replace(/\bcan't\b/gi, 'cannot')
    .replace(/\bwon't\b/gi, 'will not')
    .replace(/\bdoesn't\b/gi, 'does not')
    .replace(/\bisn't\b/gi, 'is not')
    .replace(/!/g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function aggregateConfidence(scores: number[]): { score: number; band: ConfidenceBand } {
  if (scores.length === 0) return { score: 0, band: 'low' }
  const min = Math.min(...scores)
  const band: ConfidenceBand = min >= 0.85 ? 'high' : min >= 0.6 ? 'medium' : 'low'
  return { score: Number(min.toFixed(3)), band }
}

async function hashPrompt(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck

  try {
    const { user } = await authenticateRequest(req)
    const body = await parseJsonBody<DraftV2Request>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    const description = sanitizeForPrompt(body.description, 4000)
    if (!description || description.length < 5) {
      throw new HttpError(400, 'description must be at least 5 characters')
    }
    await verifyProjectMembership(sb, user.id, projectId)

    const startedAt = Date.now()
    const passLog: PassLogEntry[] = []
    const citations: Citation[] = []
    const draft: DraftV2 = {
      suggested_title: null,
      suggested_body: null,
      suggested_ball_in_court: null,
      suggested_due_date: null,
      suggested_priority: 'medium',
      suggested_drawing_ids: [],
      suggested_spec_sections: [],
      suggested_schedule_days: null,
      suggested_cost_cents_min: null,
      suggested_cost_cents_max: null,
      citations,
      confidence_by_field: {},
    }

    const runPass = async <T>(name: string, n: number, fn: () => Promise<T>): Promise<T | null> => {
      const t0 = Date.now()
      try {
        const out = await fn()
        passLog.push({ pass: n, name, ms: Date.now() - t0, ok: true })
        return out
      } catch (err) {
        passLog.push({ pass: n, name, ms: Date.now() - t0, ok: false, notes: (err as Error).message })
        return null
      }
    }

    let firstTokenMs: number | null = null
    const markFirstToken = () => { if (firstTokenMs == null) firstTokenMs = Date.now() - startedAt }

    // Pass 1 — context (no-op for now; vision integration is a separate
    // PR that wires the existing aiRouter behind this pass).
    await runPass('context', 1, async () => {
      void body.photo_base64
      void body.drawing_viewport
      markFirstToken()
    })

    await runPass('drawing_search', 2, () =>
      passDrawingSearch(projectId, description, body.drawing_id ?? null, draft, citations))

    await runPass('spec_search', 3, () =>
      passSpecSearch(projectId, description, draft, citations))

    const answerer = await runPass('answerer', 4, () =>
      passAnswererSuggestion(projectId, draft, citations))
    draft.confidence_by_field['ball_in_court'] = answerer?.confidence ?? 0.3

    const due = await runPass('due_date', 5, () => passDueDateSuggestion(projectId, draft))
    draft.confidence_by_field['due_date'] = due?.confidence ?? 0.5

    const impact = await runPass('impact', 6, () => passImpactSuggestion(projectId, draft))
    draft.confidence_by_field['schedule_days'] = impact?.confidence ?? 0.4
    draft.confidence_by_field['cost_cents'] = impact?.confidence ?? 0.4

    const comp = await runPass('composition', 7, () => passComposition(description, draft))
    draft.confidence_by_field['title'] = comp?.titleConfidence ?? 0.5
    draft.confidence_by_field['body'] = comp?.bodyConfidence ?? 0.5

    const totalMs = Date.now() - startedAt
    const agg = aggregateConfidence(Object.values(draft.confidence_by_field))
    const promptHash = await hashPrompt(description)

    const { data: inserted, error: insertErr } = await sb
      .from('ai_rfi_drafts')
      .insert({
        project_id: projectId,
        source: 'iris-v2',
        source_ref: body.drawing_id ?? null,
        subject: draft.suggested_title,
        question: draft.suggested_body,
        severity: draft.suggested_priority,
        draft_kind: 'rfi.create_v2',
        suggested_title: draft.suggested_title,
        suggested_body: draft.suggested_body,
        suggested_ball_in_court: draft.suggested_ball_in_court,
        suggested_due_date: draft.suggested_due_date,
        suggested_priority: draft.suggested_priority,
        suggested_drawing_ids: draft.suggested_drawing_ids,
        suggested_spec_sections: draft.suggested_spec_sections,
        suggested_schedule_days: draft.suggested_schedule_days,
        suggested_cost_cents_min: draft.suggested_cost_cents_min,
        suggested_cost_cents_max: draft.suggested_cost_cents_max,
        citations: draft.citations as unknown as Record<string, unknown>,
        confidence_by_field: draft.confidence_by_field,
        confidence_score: agg.score,
        confidence_band: agg.band,
        model_fingerprint: 'iris-v2:rules-2026-05-07',
        prompt_hash: promptHash,
        pass_log: passLog as unknown as Record<string, unknown>,
        first_token_ms: firstTokenMs,
        total_ms: totalMs,
        status: 'pending',
      })
      .select('id')
      .single()
    if (insertErr) throw new HttpError(500, insertErr.message, 'insert_error')

    return new Response(
      JSON.stringify({
        ok: true,
        draft_id: (inserted as { id?: string } | null)?.id ?? null,
        first_token_ms: firstTokenMs,
        total_ms: totalMs,
        confidence_score: agg.score,
        confidence_band: agg.band,
      }),
      { status: 200, headers: { 'content-type': 'application/json', ...getCorsHeaders(req) } },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
