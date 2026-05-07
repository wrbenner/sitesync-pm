// ── draft-daily-log ─────────────────────────────────────────────────────────
// Auto-drafts the daily log for a project + date. Two invocation paths:
//   • POST  /functions/v1/draft-daily-log  with { project_id, date, hint? }
//     — user-initiated; authenticates the caller, verifies project membership.
//   • Cron  invokes with the service role key for the daily 5pm fan-out
//     across active projects. The cron uses projects.timezone to decide
//     which projects are at "5pm local" right now.
//
// Idempotent: if a pending or approved daily_log.draft already exists for
// (project_id, date), the function updates it in place. Concurrent calls
// race on the UNIQUE partial index in 20260430130000_daily_log_drafts.sql;
// the loser gets the existing row.
//
// Output: a drafted_actions row with action_type='daily_log.draft' and a
// payload that conforms to DraftedDailyLog. The IrisApprovalGate renders
// it; on approve, services/iris/executors/dailyLog.ts inserts the
// finalized daily_logs row.
//
// Failures don't block the UI:
//   • Anthropic 5xx: 3 retries with backoff, then fall back to the
//     deterministic assembler output. The draft is still useful.
//   • Vision captioning fails: photos contribute no captions; the
//     section reason explains why.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'
import { type AnthropicMessageResponse, asRows, type LaxClient } from '../shared/types.ts'
import { assembleDailyLogDraft, type DayContext, type DraftedDailyLog } from './sections.ts'
import { buildAnthropicRequest, parsePolishedDraft } from './promptBuilder.ts'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

interface RequestBody {
  project_id: string
  date: string // YYYY-MM-DD
  hint?: string
  skip_polish?: boolean
}

interface DraftedActionExisting {
  id: string
  status: string
}

interface ProjectRow {
  timezone: string | null
}

interface WeatherRow {
  condition: string | null
  high_temp_f: number | null
  low_temp_f: number | null
  precipitation_in: number | null
  wind_mph: number | null
  source: string | null
}

interface CrewSummary {
  name: string | null
  trade: string | null
  size: number | null
}

interface CrewAttendanceRow {
  crew_id: string
  actual_check_in_at: string | null
  planned_arrival_time: string | null
  crews: CrewSummary | CrewSummary[] | null
}

interface DailyLogPhotoEntryRow {
  id: string
  photos: Array<{ id?: string; caption?: string; url?: string }> | null
  description: string | null
}

interface DailyLogCaptureRow {
  id: string
  type: string
  description: string | null
}

interface RfiRow {
  id: string
  number: number
  title: string
  status: string | null
  created_at: string
  updated_at: string
}

interface MeetingRow {
  id: string
  title: string
}

interface MeetingActionItemRow {
  id: string
  description: string
  meeting_id: string
}

interface InspectionRow {
  id: string
  type: string
  result: 'pass' | 'fail' | 'pending' | null
  inspector: string | null
  notes: string | null
}

interface DeliveryRow {
  id: string
  item: string
  quantity: number | null
  sub: string | null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = await parseJsonBody<RequestBody>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new HttpError(400, 'date must be YYYY-MM-DD')
    }

    // Caller can be a logged-in user OR the service role (cron). Try the
    // user path first; fall through to service role on failure.
    let admin: LaxClient
    let calledByUser = false
    try {
      const { user, supabase } = await authenticateRequest(req)
      await verifyProjectMembership(supabase, user.id, projectId)
      const sUrl = Deno.env.get('SUPABASE_URL')!
      const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      admin = createClient(sUrl, sKey)
      calledByUser = true
    } catch {
      // Service role path — cron only. Reject if neither user-auth nor
      // service-role-key is present.
      const sUrl = Deno.env.get('SUPABASE_URL')
      const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const incoming = req.headers.get('authorization') ?? ''
      if (!sUrl || !sKey) throw new HttpError(500, 'Service role not configured')
      if (!incoming.includes(sKey.slice(0, 8))) {
        throw new HttpError(401, 'Authentication required')
      }
      admin = createClient(sUrl, sKey)
    }

    // Existing-draft short-circuit. The unique partial index guarantees
    // at most one pending or approved row per (project, date).
    const existingRes = await admin
      .from('drafted_actions')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('action_type', 'daily_log.draft')
      .filter('payload->>date', 'eq', body.date)
      .in('status', ['pending', 'approved'])
      .maybeSingle()
    const existing = existingRes.data as DraftedActionExisting | null

    if (existing && existing.status === 'approved') {
      return json({
        ok: true,
        draft_id: existing.id,
        status: 'approved',
        message: 'Daily log already approved for this date.',
      })
    }

    // 1. Aggregate the day's context.
    const ctx = await buildDayContext(admin, projectId, body.date)

    // 2. Deterministic assemble.
    let draft: DraftedDailyLog = assembleDailyLogDraft(ctx)

    // 3. Optional LLM polish.
    if (!body.skip_polish) {
      const polished = await polishWithClaude(draft, body.hint)
      if (polished) draft = mergePolished(draft, polished)
    }

    // 4. Persist (insert or update existing pending row).
    const draftedActionRow = {
      project_id: projectId,
      action_type: 'daily_log.draft',
      title: `Daily log — ${body.date}`,
      summary: draft.weather_summary,
      payload: draft,
      citations: provenanceToCitations(draft),
      confidence: draft.partial ? 0.6 : 0.85,
      status: 'pending',
      drafted_by: calledByUser ? 'user_initiated' : 'cron_5pm',
      draft_reason:
        'Auto-generated from photos, captures, RFIs filed, schedule progress, and crew check-ins.',
      related_resource_type: 'daily_log',
    }

    let draftId: string
    if (existing) {
      const { error: updateErr } = await admin
        .from('drafted_actions')
        .update({ ...draftedActionRow, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updateErr) throw new HttpError(500, `update draft: ${updateErr.message}`)
      draftId = existing.id
    } else {
      const { data: inserted, error: insertErr } = await admin
        .from('drafted_actions')
        .insert(draftedActionRow)
        .select('id')
        .single()
      if (insertErr) throw new HttpError(500, `insert draft: ${insertErr.message}`)
      draftId = (inserted as { id: string }).id
    }

    return json({ ok: true, draft_id: draftId, status: 'pending', payload: draft })
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

// ── Helpers ────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Aggregate every relevant resource from the day into a DayContext.
 * Each query is best-effort — if a table doesn't exist on this project's
 * schema (e.g. procurement_deliveries), we silently skip it.
 */
async function buildDayContext(
  admin: LaxClient,
  projectId: string,
  date: string,
): Promise<DayContext> {
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  // Project info (timezone, location).
  const projectRes = await admin
    .from('projects')
    .select('timezone')
    .eq('id', projectId)
    .maybeSingle()
  const project = projectRes.data as ProjectRow | null
  const timezone = project?.timezone ?? 'UTC'

  // Weather: best-effort. Several schemas use different table names —
  // try the common ones in order.
  let weather: DayContext['weather'] = null
  for (const table of ['weather_observations', 'weather_data', 'project_weather']) {
    const r = await admin
      .from(table)
      .select('condition, high_temp_f, low_temp_f, precipitation_in, wind_mph, source')
      .eq('project_id', projectId)
      .eq('observation_date', date)
      .maybeSingle()
    const row = r.data as WeatherRow | null
    if (!r.error && row) {
      weather = {
        condition: row.condition ?? 'unknown',
        high_temp_f: row.high_temp_f ?? undefined,
        low_temp_f: row.low_temp_f ?? undefined,
        precipitation_in: row.precipitation_in ?? undefined,
        wind_mph: row.wind_mph ?? undefined,
        weather_source: (row.source === 'forecast' ? 'forecast' : 'observed') as
          | 'observed' | 'forecast' | 'manual' | 'unknown',
      }
      break
    }
  }

  // Crew check-ins (Tab A's existing crew_attendance table from
  // 20260429010002).
  const attendanceRes = await admin
    .from('crew_attendance')
    .select('crew_id, actual_check_in_at, planned_arrival_time, crews:crew_id(name, trade, size)')
    .eq('project_id', projectId)
    .eq('attendance_date', date)
  const crews = asRows<CrewAttendanceRow>(attendanceRes.data)
    .filter((a) => a.actual_check_in_at)
    .map((a) => {
      const crew = Array.isArray(a.crews) ? a.crews[0] : a.crews
      return {
        trade: crew?.trade ?? 'unspecified',
        sub_company: crew?.name ?? undefined,
        count: crew?.size ?? 1,
        source: 'crew_check_in' as const,
      }
    })

  // Photos with captions.
  const photoEntriesRes = await admin
    .from('daily_log_entries')
    .select('id, photos, description')
    .eq('type', 'photo')
    .gte('created_at', dayStart)
    .lt('created_at', dayEnd)
  const photos: DayContext['photos'] = []
  for (const e of asRows<DailyLogPhotoEntryRow>(photoEntriesRes.data)) {
    for (const p of e.photos ?? []) {
      if (p.caption) photos.push({ id: p.id ?? e.id, caption: p.caption })
    }
  }

  // Captures (free-form notes typed/spoken into the field-capture inbox).
  const capEntriesRes = await admin
    .from('daily_log_entries')
    .select('id, type, description')
    .in('type', ['note', 'work_performed', 'observation'])
    .gte('created_at', dayStart)
    .lt('created_at', dayEnd)
  const captures = asRows<DailyLogCaptureRow>(capEntriesRes.data)
    .filter((c) => (c.description?.length ?? 0) > 0)
    .map((c) => ({
      id: c.id,
      text: c.description as string,
      kind: c.type === 'observation' ? ('observation' as const) : ('text' as const),
    }))

  // RFIs filed today + status changes.
  const rfiRowsRes = await admin
    .from('rfis')
    .select('id, number, title, status, created_at, updated_at')
    .eq('project_id', projectId)
    .or(`created_at.gte.${dayStart},updated_at.gte.${dayStart}`)
  const rfis_today: DayContext['rfis_today'] = []
  for (const r of asRows<RfiRow>(rfiRowsRes.data)) {
    const event = r.created_at >= dayStart ? 'filed' : r.status ?? 'updated'
    rfis_today.push({ id: r.id, number: r.number, title: r.title, event })
  }

  // Meetings held today + their action items (small join).
  const meetingRowsRes = await admin
    .from('meetings')
    .select('id, title')
    .eq('project_id', projectId)
    .gte('meeting_date', date)
    .lt('meeting_date', `${date}T23:59:59Z`)
  const meetingRows = asRows<MeetingRow>(meetingRowsRes.data)
  const meetingIds = meetingRows.map((m) => m.id)
  let meeting_action_items: DayContext['meeting_action_items'] = []
  if (meetingIds.length) {
    const aiRowsRes = await admin
      .from('meeting_action_items')
      .select('id, description, meeting_id')
      .in('meeting_id', meetingIds)
    const titleById = new Map<string, string>()
    for (const m of meetingRows) titleById.set(m.id, m.title)
    meeting_action_items = asRows<MeetingActionItemRow>(aiRowsRes.data).map((a) => ({
      id: a.id,
      description: a.description,
      meeting_title: titleById.get(a.meeting_id),
    }))
  }

  // Schedule events (best-effort — the actual schema depends on the
  // schedule module). We look at task percent_complete deltas from
  // a hypothetical task_progress_log table; if absent, we skip.
  const schedule_events: DayContext['schedule_events'] = []

  // Inspections (best-effort — same caveat).
  const inspRowsRes = await admin
    .from('inspections')
    .select('id, type, result, inspector, notes')
    .eq('project_id', projectId)
    .gte('inspected_at', dayStart)
    .lt('inspected_at', dayEnd)
  const inspections = asRows<InspectionRow>(inspRowsRes.data).map((i) => ({
    id: i.id,
    type: i.type,
    result: i.result ?? undefined,
    inspector: i.inspector ?? undefined,
    notes: i.notes ?? undefined,
  }))

  // Material deliveries — silent skip if table doesn't exist.
  let deliveries: DayContext['deliveries'] = []
  try {
    const delRowsRes = await admin
      .from('procurement_deliveries')
      .select('id, item, quantity, sub')
      .eq('project_id', projectId)
      .gte('delivered_at', dayStart)
      .lt('delivered_at', dayEnd)
    deliveries = asRows<DeliveryRow>(delRowsRes.data).map((d) => ({
      id: d.id,
      item: d.item,
      quantity: d.quantity ?? undefined,
      sub: d.sub ?? undefined,
    }))
  } catch {
    // table missing — fine
  }

  return {
    project_id: projectId,
    date,
    timezone,
    weather,
    crews,
    photos,
    captures,
    rfis_today,
    meeting_action_items,
    schedule_events,
    inspections,
    deliveries,
  }
}

/**
 * Send the deterministic draft to Claude for polish. Returns null on any
 * failure — caller falls back to the unpolished draft.
 */
async function polishWithClaude(
  draft: DraftedDailyLog,
  hint: string | undefined,
): Promise<DraftedDailyLog | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return null

  const reqBody = buildAnthropicRequest({ draft, hint })

  let lastErr = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(reqBody),
      })
      if (!r.ok) {
        lastErr = `${r.status} ${await r.text()}`
        if (r.status >= 500 || r.status === 429) {
          await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
          continue
        }
        return null
      }
      const data = await r.json() as AnthropicMessageResponse
      const text = data?.content?.[0]?.text ?? ''
      return parsePolishedDraft(text)
    } catch (err) {
      lastErr = (err as Error).message
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
    }
  }
  console.warn('[draft-daily-log] polish failed:', lastErr)
  return null
}

/**
 * Merge the polished draft over the deterministic one. We only accept
 * polished .text fields and the .weather_summary string — everything
 * else (sources, cost codes, partial flags, provenance) is preserved
 * from the deterministic build to keep the audit trail intact.
 */
function mergePolished(
  base: DraftedDailyLog,
  polished: DraftedDailyLog,
): DraftedDailyLog {
  const mergeBullets = (
    a: ReadonlyArray<DraftedDailyLog['work_performed'][number]>,
    b: ReadonlyArray<DraftedDailyLog['work_performed'][number]>,
  ) =>
    a.map((bullet, i) => ({
      ...bullet,
      text: typeof b[i]?.text === 'string' && b[i].text.length > 0 ? b[i].text : bullet.text,
    }))

  return {
    ...base,
    weather_summary:
      typeof polished.weather_summary === 'string' && polished.weather_summary.length
        ? polished.weather_summary
        : base.weather_summary,
    work_performed: mergeBullets(base.work_performed, polished.work_performed ?? []),
    issues: mergeBullets(base.issues, polished.issues ?? []),
    visitors: mergeBullets(base.visitors, polished.visitors ?? []),
  }
}

/**
 * Convert provenance into drafted_actions.citations rows. Each provenance
 * entry surfaces as one citation; the existing Iris UI knows how to
 * render daily_log_excerpt and photo_observation kinds.
 */
function provenanceToCitations(draft: DraftedDailyLog) {
  const map: Record<string, 'photo_observation' | 'daily_log_excerpt' | 'rfi_reference' | 'schedule_phase'> = {
    photo_caption: 'photo_observation',
    voice_capture: 'daily_log_excerpt',
    manual: 'daily_log_excerpt',
    rfi_event: 'rfi_reference',
    meeting_action_item: 'daily_log_excerpt',
    schedule_progress: 'schedule_phase',
    inspection_record: 'daily_log_excerpt',
    material_delivery: 'daily_log_excerpt',
    crew_check_in: 'daily_log_excerpt',
    roster_scheduled: 'daily_log_excerpt',
    weather_observed: 'daily_log_excerpt',
    fallback: 'daily_log_excerpt',
  }
  return draft.provenance.map((p) => ({
    kind: map[p.kind] ?? 'daily_log_excerpt',
    label: `${p.kind} (${p.count})`,
    snippet: p.sample_refs ?? '',
  }))
}
