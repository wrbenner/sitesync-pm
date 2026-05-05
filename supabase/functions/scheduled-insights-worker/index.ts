// scheduled-insights-worker — Tier 3a worker for the hybrid cron pipeline.
//
// Pulls jobs from pgmq.q_insights_jobs, runs the matching detector against
// the project's data, promotes eligible insights to drafted_actions via
// the promote_insight_to_draft RPC, withdraws stale drafts, and logs to
// scheduled_insights_log.
//
// Day 31 scope: aging detector only. Cascade/variance/staffing/weather
// land Days 32-35 by adding handlers in DETECTORS below — the worker
// shell stays the same.
//
// Reference: docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md
//            docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md
//
// Trigger: cron every 5 minutes via pg_cron + net.http_post (see
//   20260504020000_scheduled_insights_heartbeat.sql).
//
// Why each piece:
//   - Pull N jobs at once: cuts edge-fn invocations 10x. 60s timeout
//     budget is 5s/job × 10 = 50s, with 10s slack.
//   - SECURITY DEFINER RPC for promotion: enforces the spec's gates
//     atomically; we trust the SQL rather than reimplementing the
//     gates in TS where we'd risk drift.
//   - Exponential backoff via vt: retried jobs become invisible for
//     2^attempt minutes, capped at 15 min. After 3 attempts the job
//     archives and a row lands in scheduled_insights_log with
//     outcome='abandoned'.
//   - Per-detector log row: lets us answer "did the aging detector
//     run today" with a single SQL query, independent of the queue
//     state.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildAgingEnvelope,
  buildCascadeEnvelope,
  buildStaffingEnvelope,
  buildVarianceEnvelope,
  buildWeatherEnvelope,
  inferCascadeSlip,
  inferSlipDays,
} from './insightEnvelope.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const BATCH_SIZE = Number(Deno.env.get('SCHEDULED_INSIGHTS_BATCH') ?? '10')
const VISIBILITY_TIMEOUT_SEC = Number(Deno.env.get('SCHEDULED_INSIGHTS_VT') ?? '60')
const MAX_ATTEMPTS = 3
const PER_JOB_TIMEOUT_MS = 5_000

interface PgmqMessage {
  msg_id: number
  read_ct: number
  enqueued_at: string
  vt: string
  message: {
    project_id: string
    detector_kind: 'aging' | 'cascade' | 'variance' | 'staffing' | 'weather'
    scheduled_for: string
    attempt?: number
  }
}

interface DetectorResult {
  computed: number
  promoted: number
  withdrawn: number
}

type Detector = (
  supabase: SupabaseClient,
  projectId: string,
) => Promise<DetectorResult>

// Days 31–35: aging, cascade, variance, staffing, weather all live.
// Each detector (a) queries the data it needs, (b) builds an envelope
// via insightEnvelope.ts, (c) calls promote_insight_to_draft. The
// queue contract is unchanged across detectors; new ones just drop
// in here.
const DETECTORS: Record<string, Detector> = {
  aging: detectAndPromoteAgingRfis,
  cascade: detectAndPromoteCascades,
  variance: detectAndPromoteVariance,
  staffing: detectAndPromoteStaffing,
  weather: detectAndPromoteWeather,
}

Deno.serve(async (req) => {
  // Auth: cron-shared secret OR service-role bearer (matches the
  // existing edge-fn auth pattern in notification-queue-worker).
  const auth = req.headers.get('Authorization') ?? ''
  const valid =
    (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) ||
    (SERVICE_ROLE_KEY && auth === `Bearer ${SERVICE_ROLE_KEY}`)
  if (!valid) return new Response('unauthorized', { status: 401 })

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response('server misconfigured: SUPABASE_URL or SERVICE_ROLE_KEY missing', { status: 500 })
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Pull a batch from pgmq.
  const { data: jobs, error: pullErr } = await supabase.rpc('pgmq_read', {
    queue_name: 'insights_jobs',
    vt: VISIBILITY_TIMEOUT_SEC,
    qty: BATCH_SIZE,
  })
  if (pullErr) {
    console.error('pgmq_read failed:', pullErr)
    return Response.json({ error: pullErr.message }, { status: 500 })
  }
  const messages = (jobs ?? []) as PgmqMessage[]
  if (messages.length === 0) return Response.json({ processed: 0 })

  const summary = await Promise.allSettled(
    messages.map((msg) => processJob(supabase, msg)),
  )

  // Ack succeeded; retry/abandon failed.
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const result = summary[i]
    try {
      if (result.status === 'fulfilled') {
        await supabase.rpc('pgmq_delete', {
          queue_name: 'insights_jobs',
          msg_id: msg.msg_id,
        })
      } else {
        const attempt = (msg.message.attempt ?? 1) + 1
        if (attempt > MAX_ATTEMPTS) {
          await logRun(supabase, msg, {
            outcome: 'abandoned',
            error: errorMessage(result.reason),
            attempt,
          })
          await supabase.rpc('pgmq_archive', {
            queue_name: 'insights_jobs',
            msg_id: msg.msg_id,
          })
        } else {
          // Exponential backoff (capped 15 min).
          const newVt = Math.min(900, 60 * 2 ** attempt)
          await supabase.rpc('pgmq_set_vt', {
            queue_name: 'insights_jobs',
            msg_id: msg.msg_id,
            vt: newVt,
          })
        }
      }
    } catch (err) {
      // Don't let an ack failure crash the whole batch.
      console.error('ack failed for msg', msg.msg_id, err)
    }
  }

  const processed = messages.length
  const succeeded = summary.filter((r) => r.status === 'fulfilled').length
  return Response.json({ processed, succeeded, failed: processed - succeeded })
})

async function processJob(
  supabase: SupabaseClient,
  msg: PgmqMessage,
): Promise<DetectorResult> {
  const { project_id, detector_kind } = msg.message
  const detector = DETECTORS[detector_kind]
  if (!detector) {
    // Day 31 only ships aging. Other detector kinds enqueue but no-op
    // until their handler lands. Log + ack so the queue drains.
    await logRun(supabase, msg, { outcome: 'success', detectorMissing: true })
    return { computed: 0, promoted: 0, withdrawn: 0 }
  }

  const start = Date.now()
  try {
    const result = await withTimeout(
      detector(supabase, project_id),
      PER_JOB_TIMEOUT_MS,
      `detector ${detector_kind} timed out`,
    )
    await logRun(supabase, msg, {
      outcome: 'success',
      durationMs: Date.now() - start,
      computed: result.computed,
      promoted: result.promoted,
      withdrawn: result.withdrawn,
    })
    return result
  } catch (err) {
    await logRun(supabase, msg, {
      outcome: 'failed',
      durationMs: Date.now() - start,
      error: errorMessage(err),
    })
    throw err
  }
}

// ─── Aging detector — Day 31 ─────────────────────────────────────────
// Mirrors src/services/iris/insights.ts:detectAgingRfis. Emits a draft
// for each RFI overdue ≥ 5 days that's linked to a critical-path
// activity. Severity is keyed on the inferred schedule-slip (≥ 10
// days = critical, ≥ 5 = high, otherwise medium → not promoted).
//
// Why this query and not the existing detector function: edge fns
// can't import from src/. Re-implementing the SQL-shaped query here
// keeps the worker single-file and matches the pattern already used
// by notification-queue-worker.

async function detectAndPromoteAgingRfis(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DetectorResult> {
  // Pull open RFIs that are at least 5 days overdue, joined to their
  // critical-path activity (if any). The query is intentionally small
  // — the detector logic stays in TS where we can unit-test it.
  const { data: rfis, error: rfiErr } = await supabase
    .from('rfis')
    .select(
      'id, number, title, due_date, status, schedule_impact_days, linked_activity_id',
    )
    .eq('project_id', projectId)
    .in('status', ['open', 'pending', 'in_review'])
    .lte('due_date', isoDaysAgo(5))

  if (rfiErr) throw new Error(`rfis query: ${rfiErr.message}`)
  const aging = rfis ?? []
  if (aging.length === 0) {
    return await sweepStaleAgingDrafts(supabase, projectId, 0, 0)
  }

  // Pull only the activities we need.
  const activityIds = aging
    .map((r) => r.linked_activity_id)
    .filter((x): x is string => !!x)
  const activities = activityIds.length
    ? (
        await supabase
          .from('schedule_activities')
          .select('id, name, is_critical_path, float_days')
          .in('id', activityIds)
      ).data ?? []
    : []
  const activityById = new Map(activities.map((a) => [a.id, a]))

  let computed = 0
  let promoted = 0
  for (const rfi of aging) {
    if (!rfi.linked_activity_id) continue
    const activity = activityById.get(rfi.linked_activity_id)
    if (!activity || activity.is_critical_path !== true) continue
    computed++

    const overdueDays = daysSince(rfi.due_date)
    const slip = inferSlipDays(
      overdueDays,
      Number(activity.float_days ?? 0),
      Number(rfi.schedule_impact_days ?? 0) || undefined,
    )
    if (slip < 5) continue // medium severity drops below the promotion floor

    const rfiNumber = String(rfi.number ?? rfi.id)
    const rfiTitle = rfi.title ?? `RFI ${rfiNumber}`
    const insight = buildAgingEnvelope({
      rfiId: rfi.id,
      rfiNumber,
      rfiTitle,
      overdueDays,
      activityId: activity.id,
      activityName: activity.name,
      slipDays: slip,
    })

    if (await callPromote(supabase, insight, projectId)) promoted++
  }

  return await sweepStaleAgingDrafts(supabase, projectId, computed, promoted)
}

// ─── Cascade detector — Day 32 ───────────────────────────────────────
// Mirrors src/services/iris/insights.ts:detectCascades. At-risk or
// rejected submittals whose linked activity hits its baseline within
// 21 days. Critical-path activities are promoted at 'critical';
// near-baseline (≤ 7 days) off-critical promote at 'high'; further-out
// fall below the floor and aren't promoted.

async function detectAndPromoteCascades(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DetectorResult> {
  const { data: submittals, error: subErr } = await supabase
    .from('submittals')
    .select('id, number, title, status, linked_activity_id')
    .eq('project_id', projectId)
    .in('status', ['rejected', 'revise_resubmit', 'revise_and_resubmit', 'at_risk', 'overdue'])

  if (subErr) throw new Error(`submittals query: ${subErr.message}`)
  const atRisk = (submittals ?? []).filter((s) => !!s.linked_activity_id)
  if (atRisk.length === 0) {
    return await sweepStaleCascadeDrafts(supabase, projectId, 0, 0)
  }

  const activityIds = atRisk.map((s) => s.linked_activity_id as string)
  const { data: activities } = await supabase
    .from('schedule_activities')
    .select('id, name, baseline_end, end_date, is_critical_path, float_days')
    .in('id', activityIds)
  const activityById = new Map((activities ?? []).map((a) => [a.id, a]))

  const now = Date.now()
  let computed = 0
  let promoted = 0
  for (const sub of atRisk) {
    const activity = activityById.get(sub.linked_activity_id as string)
    if (!activity) continue
    const baselineIso = activity.baseline_end ?? activity.end_date ?? null
    if (!baselineIso) continue
    const t = Date.parse(baselineIso)
    if (isNaN(t)) continue
    const daysToBaseline = Math.round((t - now) / 86_400_000)
    if (daysToBaseline < 0 || daysToBaseline > 21) continue
    computed++

    const slip = inferCascadeSlip(
      String(sub.status ?? ''),
      Number(activity.float_days ?? 0),
    )
    const isCriticalPath = activity.is_critical_path === true
    // Promotion floor: critical-path or daysToBaseline ≤ 7 (severity ≥ high).
    if (!isCriticalPath && daysToBaseline > 7) continue

    const subNumber = String(sub.number ?? sub.id)
    const insight = buildCascadeEnvelope({
      submittalId: sub.id,
      submittalNumber: subNumber,
      submittalTitle: sub.title ?? `Submittal ${subNumber}`,
      submittalStatus: String(sub.status ?? ''),
      activityId: activity.id,
      activityName: activity.name,
      isCriticalPath,
      daysToBaseline,
      slipDays: slip,
    })

    if (await callPromote(supabase, insight, projectId)) promoted++
  }

  return await sweepStaleCascadeDrafts(supabase, projectId, computed, promoted)
}

// Withdraw cascade drafts whose underlying submittal has moved out
// of the at-risk band (e.g. now 'approved' or 'closed').
async function sweepStaleCascadeDrafts(
  supabase: SupabaseClient,
  projectId: string,
  computed: number,
  promoted: number,
): Promise<DetectorResult> {
  const { data: openDrafts } = await supabase
    .from('drafted_actions')
    .select('id, related_resource_id, payload')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .eq('drafted_by', 'iris-scheduled-insights')

  const cascadeDrafts = (openDrafts ?? []).filter(
    (d) =>
      typeof d.payload === 'object' &&
      d.payload !== null &&
      (d.payload as { insightKind?: string }).insightKind === 'cascade',
  )
  if (cascadeDrafts.length === 0) return { computed, promoted, withdrawn: 0 }

  const subIds = cascadeDrafts
    .map((d) => d.related_resource_id)
    .filter((x): x is string => !!x)
  const { data: currentSubs } = await supabase
    .from('submittals')
    .select('id, status')
    .in('id', subIds)
  const statusById = new Map(
    (currentSubs ?? []).map((s) => [s.id, String(s.status ?? '').toLowerCase()]),
  )

  const atRiskStatuses = new Set([
    'rejected',
    'revise_resubmit',
    'revise_and_resubmit',
    'at_risk',
    'overdue',
  ])

  let withdrawn = 0
  for (const draft of cascadeDrafts) {
    if (!draft.related_resource_id) continue
    const status = statusById.get(draft.related_resource_id)
    // Leave drafts alone when the status is unknown (transient query
    // failure, deletion, etc.) — withdraw only on confirmed transitions.
    if (status === undefined) continue
    if (atRiskStatuses.has(status)) continue
    const { error } = await supabase.rpc('withdraw_stale_draft', {
      p_draft_id: draft.id,
      p_reason: `cascade submittal moved to status='${status}'`,
    })
    if (!error) withdrawn++
  }

  return { computed, promoted, withdrawn }
}

// Shared promotion shim — single point of error handling so each
// detector stays focused on the data shape, not the RPC boilerplate.
async function callPromote(
  supabase: SupabaseClient,
  insight: unknown,
  projectId: string,
): Promise<boolean> {
  const { data: draftId, error } = await supabase.rpc('promote_insight_to_draft', {
    p_insight: insight,
    p_project_id: projectId,
  })
  if (error) {
    console.error('promote_insight_to_draft failed:', error)
    return false
  }
  return !!draftId
}

// Withdraw drafts whose underlying RFI moved out of an open state.
async function sweepStaleAgingDrafts(
  supabase: SupabaseClient,
  projectId: string,
  computed: number,
  promoted: number,
): Promise<DetectorResult> {
  const { data: openDrafts } = await supabase
    .from('drafted_actions')
    .select('id, related_resource_id, payload')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .eq('drafted_by', 'iris-scheduled-insights')

  const agingDrafts = (openDrafts ?? []).filter(
    (d) =>
      typeof d.payload === 'object' &&
      d.payload !== null &&
      (d.payload as { insightKind?: string }).insightKind === 'aging',
  )
  if (agingDrafts.length === 0) return { computed, promoted, withdrawn: 0 }

  const rfiIds = agingDrafts
    .map((d) => d.related_resource_id)
    .filter((x): x is string => !!x)
  const { data: currentRfis } = await supabase
    .from('rfis')
    .select('id, status')
    .in('id', rfiIds)
  const statusById = new Map(
    (currentRfis ?? []).map((r) => [r.id, String(r.status ?? '').toLowerCase()]),
  )

  let withdrawn = 0
  for (const draft of agingDrafts) {
    if (!draft.related_resource_id) continue
    const status = statusById.get(draft.related_resource_id)
    // "Still relevant" when the RFI is still open.
    const stillOpen =
      status === 'open' ||
      status === 'pending' ||
      status === 'in_review' ||
      status === undefined // can't determine; leave the draft alone
    if (stillOpen) continue
    const { error } = await supabase.rpc('withdraw_stale_draft', {
      p_draft_id: draft.id,
      p_reason: `aging RFI moved to status='${status}'`,
    })
    if (!error) withdrawn++
  }

  return { computed, promoted, withdrawn }
}

// ─── Variance detector — Day 33 ──────────────────────────────────────
// Reads weekly aggregates from budget_snapshots, computes the latest
// week's commit-delta as a fraction of total_budget, compares against
// the trailing 4-week average. Promotes when:
//   - latestDelta / avgTrailing >= 2 (acceleration)
//   - percentCommitted >= 60
// Severity is keyed on percentCommitted (≥100 → critical, ≥90 → high).

interface BudgetSnapshotRow {
  id: string
  snapshot_date: string
  total_budget: number
  total_committed: number
}

async function detectAndPromoteVariance(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DetectorResult> {
  // Pull last ~6 weeks of snapshots.
  const { data: snapshots, error } = await supabase
    .from('budget_snapshots')
    .select('id, snapshot_date, total_budget, total_committed')
    .eq('project_id', projectId)
    .gte('snapshot_date', isoDaysAgo(45))
    .order('snapshot_date', { ascending: true })
  if (error) throw new Error(`budget_snapshots query: ${error.message}`)

  // Bucket to one snapshot per week (Monday). Take the latest snapshot
  // per week to mirror the existing in-app detector's "weekly" semantic.
  const byWeek = bucketByMondayWeek((snapshots ?? []) as BudgetSnapshotRow[])
  if (byWeek.length < 5) return { computed: 0, promoted: 0, withdrawn: 0 }

  const latest = byWeek[byWeek.length - 1]
  if (latest.total_budget <= 0) return { computed: 0, promoted: 0, withdrawn: 0 }

  // Week-over-week deltas as % of total_budget.
  const deltas: number[] = []
  for (let i = 1; i < byWeek.length; i++) {
    const prev = byWeek[i - 1]
    if (prev.total_budget <= 0) {
      deltas.push(0)
      continue
    }
    deltas.push(((byWeek[i].total_committed - prev.total_committed) / prev.total_budget) * 100)
  }
  const latestDelta = deltas[deltas.length - 1] ?? 0
  const trailing = deltas.slice(-5, -1)
  if (trailing.length === 0) return { computed: 0, promoted: 0, withdrawn: 0 }
  const avgTrailing = trailing.reduce((a, b) => a + b, 0) / trailing.length

  const percentCommitted = (latest.total_committed / latest.total_budget) * 100
  const accelFactor = avgTrailing > 0 ? latestDelta / avgTrailing : 0

  // Promotion gates: acceleration ≥ 2× AND ≥ 60% committed.
  if (accelFactor < 2 || percentCommitted < 60) {
    return await sweepStaleVarianceDrafts(supabase, projectId, 1, 0)
  }

  // Severity floor: variance only promotes at high or critical.
  if (percentCommitted < 90) {
    return await sweepStaleVarianceDrafts(supabase, projectId, 1, 0)
  }

  const exposureDollars = Math.max(0, latest.total_committed - latest.total_budget)
  const insight = buildVarianceEnvelope({
    snapshotId: latest.id,
    snapshotDate: latest.snapshot_date,
    weekDeltaPct: latestDelta,
    averageWeeklyPct: avgTrailing,
    percentCommitted,
    exposureDollars,
  })
  const promoted = (await callPromote(supabase, insight, projectId)) ? 1 : 0
  return await sweepStaleVarianceDrafts(supabase, projectId, 1, promoted)
}

// Withdraw variance drafts when percent-committed drops back below 90%
// (e.g. a CO got approved that lifted the budget).
async function sweepStaleVarianceDrafts(
  supabase: SupabaseClient,
  projectId: string,
  computed: number,
  promoted: number,
): Promise<DetectorResult> {
  const { data: openDrafts } = await supabase
    .from('drafted_actions')
    .select('id, payload')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .eq('drafted_by', 'iris-scheduled-insights')

  const varianceDrafts = (openDrafts ?? []).filter(
    (d) =>
      typeof d.payload === 'object' &&
      d.payload !== null &&
      (d.payload as { insightKind?: string }).insightKind === 'variance',
  )
  if (varianceDrafts.length === 0) return { computed, promoted, withdrawn: 0 }

  // Withdraw if today's snapshot shows percent-committed < 90.
  const { data: latestSnap } = await supabase
    .from('budget_snapshots')
    .select('total_budget, total_committed')
    .eq('project_id', projectId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestSnap || latestSnap.total_budget <= 0) {
    return { computed, promoted, withdrawn: 0 }
  }
  const currentPct = (latestSnap.total_committed / latestSnap.total_budget) * 100
  if (currentPct >= 90) return { computed, promoted, withdrawn: 0 }

  let withdrawn = 0
  for (const draft of varianceDrafts) {
    const { error } = await supabase.rpc('withdraw_stale_draft', {
      p_draft_id: draft.id,
      p_reason: `variance recovered: percent-committed back to ${currentPct.toFixed(1)}%`,
    })
    if (!error) withdrawn++
  }
  return { computed, promoted, withdrawn }
}

// ─── Staffing detector — Day 34 ──────────────────────────────────────
// Project-level staffing gap: if today's active activities require
// significant hours and crew_checkins for today is below 50% of an
// 8h-day estimate, draft an RFI to flag the gap.
//
// This is intentionally simpler than the per-trade in-app detector:
// the data shape required for trade-level inference (workforce_members
// joined to trades joined to crew_checkins) isn't fully stable yet, so
// the cron worker uses the project-level approximation. Lap 3 will
// refine to per-trade once the join is hardened.

async function detectAndPromoteStaffing(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DetectorResult> {
  const todayIso = new Date().toISOString().slice(0, 10)
  const startOfDay = new Date(`${todayIso}T00:00:00Z`).toISOString()

  // Active activities today with required_hours_today.
  const { data: activities, error: actErr } = await supabase
    .from('schedule_activities')
    .select('id, name, required_hours_today, start_date, end_date')
    .eq('project_id', projectId)
    .lte('start_date', todayIso)
    .gte('end_date', todayIso)
  if (actErr) throw new Error(`schedule_activities query: ${actErr.message}`)

  const scheduledHours = (activities ?? [])
    .map((a) => Number(a.required_hours_today ?? 0))
    .filter((h) => h > 0)
    .reduce((sum, h) => sum + h, 0)
  if (scheduledHours <= 0) {
    return await sweepStaleStaffingDrafts(supabase, projectId, todayIso, 0, 0)
  }

  // Approximate available hours: count distinct check-ins today × 8h.
  const { count: checkinCount } = await supabase
    .from('crew_checkins')
    .select('user_id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .gte('checked_in_at', startOfDay)

  const availableHours = (checkinCount ?? 0) * 8
  if (availableHours >= scheduledHours * 0.5) {
    return await sweepStaleStaffingDrafts(supabase, projectId, todayIso, 1, 0)
  }

  const example = (activities ?? []).find(
    (a) => Number(a.required_hours_today ?? 0) > 0,
  )
  const insight = buildStaffingEnvelope({
    syntheticEntityId: `staffing-${projectId}-${todayIso}`,
    todayIso,
    scheduledHours,
    availableHours,
    exampleActivityId: example?.id,
    exampleActivityName: example?.name,
  })
  const promoted = (await callPromote(supabase, insight, projectId)) ? 1 : 0
  return await sweepStaleStaffingDrafts(supabase, projectId, todayIso, 1, promoted)
}

// Withdraw a staffing draft if check-ins caught up later in the day.
async function sweepStaleStaffingDrafts(
  supabase: SupabaseClient,
  projectId: string,
  todayIso: string,
  computed: number,
  promoted: number,
): Promise<DetectorResult> {
  const { data: openDrafts } = await supabase
    .from('drafted_actions')
    .select('id, payload, related_resource_id, created_at')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .eq('drafted_by', 'iris-scheduled-insights')

  const staffingDrafts = (openDrafts ?? []).filter((d) => {
    if (typeof d.payload !== 'object' || d.payload === null) return false
    return (d.payload as { insightKind?: string }).insightKind === 'staffing'
  })
  if (staffingDrafts.length === 0) return { computed, promoted, withdrawn: 0 }

  // Re-check today's hours.
  const startOfDay = new Date(`${todayIso}T00:00:00Z`).toISOString()
  const { count: checkinCount } = await supabase
    .from('crew_checkins')
    .select('user_id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .gte('checked_in_at', startOfDay)
  if ((checkinCount ?? 0) === 0) return { computed, promoted, withdrawn: 0 }

  let withdrawn = 0
  for (const draft of staffingDrafts) {
    // Withdraw any prior-day draft that's still open (tomorrow's
    // schedule will get its own staffing check).
    const draftDay = (draft.created_at ?? '').slice(0, 10)
    if (draftDay && draftDay !== todayIso) {
      const { error } = await supabase.rpc('withdraw_stale_draft', {
        p_draft_id: draft.id,
        p_reason: `staffing draft from ${draftDay} stale; today is ${todayIso}`,
      })
      if (!error) withdrawn++
    }
  }
  return { computed, promoted, withdrawn }
}

// ─── Weather detector — Day 35 ───────────────────────────────────────
// Reads project's weather_cache forecast_data, looks for rain/storm
// in the next 3 days, cross-references outdoor schedule_activities
// in that window. Severity = high when ≥ 3 bad days; medium otherwise
// (drops below the floor).

interface WeatherCacheRow {
  forecast_data: unknown
}

interface ForecastDay {
  date?: string
  conditions?: string
  condition?: string
  summary?: string
}

async function detectAndPromoteWeather(
  supabase: SupabaseClient,
  projectId: string,
): Promise<DetectorResult> {
  const { data: cacheRow } = await supabase
    .from('weather_cache')
    .select('forecast_data')
    .eq('project_id', projectId)
    .order('cached_at', { ascending: false })
    .limit(1)
    .maybeSingle<WeatherCacheRow>()
  if (!cacheRow || !cacheRow.forecast_data) {
    return await sweepStaleWeatherDrafts(supabase, projectId, 0, 0)
  }

  const forecast = parseForecast(cacheRow.forecast_data)
  const todayIso = new Date().toISOString().slice(0, 10)
  const horizonIso = isoDaysAhead(3)
  const RAIN_RE = /rain|thunderstorm|storm|snow/i
  const badDays = forecast.filter((d) => {
    if (!d.date) return false
    if (d.date < todayIso || d.date > horizonIso) return false
    const cond = String(d.conditions ?? d.condition ?? d.summary ?? '')
    return RAIN_RE.test(cond)
  })
  if (badDays.length === 0) {
    return await sweepStaleWeatherDrafts(supabase, projectId, 1, 0)
  }

  // Outdoor activities in the same window.
  const { data: activities } = await supabase
    .from('schedule_activities')
    .select('id, name, start_date, end_date, outdoor_activity')
    .eq('project_id', projectId)
    .eq('outdoor_activity', true)
    .lte('start_date', horizonIso)
    .gte('end_date', todayIso)
  const outdoor = activities ?? []
  if (outdoor.length === 0) {
    return await sweepStaleWeatherDrafts(supabase, projectId, 1, 0)
  }

  // Severity floor: variance only promotes at high (≥ 3 bad days).
  if (badDays.length < 3) {
    return await sweepStaleWeatherDrafts(supabase, projectId, 1, 0)
  }

  const conditions = badDays.map((d) =>
    String(d.conditions ?? d.condition ?? d.summary ?? '').toLowerCase(),
  )
  const conditionsLabel = Array.from(new Set(conditions)).slice(0, 2).join(' / ')
  const sortedDates = badDays.map((d) => d.date as string).sort()

  const insight = buildWeatherEnvelope({
    syntheticEntityId: `weather-${projectId}-${sortedDates[0]}-${sortedDates[sortedDates.length - 1]}`,
    conditionsLabel,
    badDayCount: badDays.length,
    outdoorActivityCount: outdoor.length,
    exampleActivityId: outdoor[0]?.id,
    exampleActivityName: outdoor[0]?.name,
    firstBadDate: sortedDates[0],
    lastBadDate: sortedDates[sortedDates.length - 1],
  })
  const promoted = (await callPromote(supabase, insight, projectId)) ? 1 : 0
  return await sweepStaleWeatherDrafts(supabase, projectId, 1, promoted)
}

// Withdraw weather drafts whose forecast window has passed.
async function sweepStaleWeatherDrafts(
  supabase: SupabaseClient,
  projectId: string,
  computed: number,
  promoted: number,
): Promise<DetectorResult> {
  const { data: openDrafts } = await supabase
    .from('drafted_actions')
    .select('id, related_resource_id, payload, created_at')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .eq('drafted_by', 'iris-scheduled-insights')

  const weatherDrafts = (openDrafts ?? []).filter(
    (d) =>
      typeof d.payload === 'object' &&
      d.payload !== null &&
      (d.payload as { insightKind?: string }).insightKind === 'weather',
  )
  if (weatherDrafts.length === 0) return { computed, promoted, withdrawn: 0 }

  const todayIso = new Date().toISOString().slice(0, 10)
  let withdrawn = 0
  for (const draft of weatherDrafts) {
    // related_resource_id encodes the synthetic id 'weather-<proj>-<first>-<last>'.
    // If today is past the last date, the window has closed.
    const id = String(draft.related_resource_id ?? '')
    const m = id.match(/-(\d{4}-\d{2}-\d{2})$/)
    const lastBadDate = m?.[1]
    if (!lastBadDate) continue
    if (lastBadDate >= todayIso) continue
    const { error } = await supabase.rpc('withdraw_stale_draft', {
      p_draft_id: draft.id,
      p_reason: `weather window closed (last bad day ${lastBadDate} < today ${todayIso})`,
    })
    if (!error) withdrawn++
  }
  return { computed, promoted, withdrawn }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function isoDaysAhead(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Bucket budget snapshots by ISO week (Monday-anchored). Keeps only
 * the latest snapshot per week — matches the in-app variance
 * detector's "weekly" semantic without requiring a SQL-side aggregate.
 */
function bucketByMondayWeek(snapshots: Array<{
  id: string
  snapshot_date: string
  total_budget: number
  total_committed: number
}>): Array<{ id: string; snapshot_date: string; total_budget: number; total_committed: number }> {
  const byWeek = new Map<string, { id: string; snapshot_date: string; total_budget: number; total_committed: number }>()
  for (const s of snapshots) {
    const monday = mondayOf(s.snapshot_date)
    const existing = byWeek.get(monday)
    if (!existing || existing.snapshot_date < s.snapshot_date) {
      byWeek.set(monday, s)
    }
  }
  return Array.from(byWeek.values()).sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date),
  )
}

function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const dow = d.getUTCDay() // 0 = Sun, 1 = Mon, ...
  const offset = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * Parse the weather_cache.forecast_data JSON into a normalized list of
 * forecast days. The schema is loose ({} default); we accept either a
 * top-level array or a `daily` / `forecast` key, and tolerate missing
 * fields gracefully.
 */
function parseForecast(data: unknown): Array<{ date?: string; conditions?: string; condition?: string; summary?: string }> {
  if (Array.isArray(data)) return data as Array<{ date?: string; conditions?: string }>
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.daily)) return obj.daily as Array<{ date?: string; conditions?: string }>
    if (Array.isArray(obj.forecast)) return obj.forecast as Array<{ date?: string; conditions?: string }>
    if (Array.isArray(obj.days)) return obj.days as Array<{ date?: string; conditions?: string }>
  }
  return []
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (isNaN(t)) return 0
  return Math.floor((Date.now() - t) / 86_400_000)
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return JSON.stringify(err).slice(0, 500)
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

interface RunLogEntry {
  outcome: 'success' | 'partial' | 'failed' | 'abandoned'
  durationMs?: number
  computed?: number
  promoted?: number
  withdrawn?: number
  attempt?: number
  error?: string
  detectorMissing?: boolean
}

async function logRun(
  supabase: SupabaseClient,
  msg: PgmqMessage,
  entry: RunLogEntry,
): Promise<void> {
  const { error } = await supabase.from('scheduled_insights_log').insert({
    project_id: msg.message.project_id,
    detector_kind: msg.message.detector_kind,
    computed_count: entry.computed ?? 0,
    promoted_count: entry.promoted ?? 0,
    withdrawn_count: entry.withdrawn ?? 0,
    duration_ms: entry.durationMs ?? null,
    job_msg_id: msg.msg_id,
    attempt: entry.attempt ?? msg.message.attempt ?? 1,
    outcome: entry.outcome,
    error_message: entry.error ?? (entry.detectorMissing ? 'detector handler not yet implemented' : null),
  })
  if (error) {
    // Logging is best-effort — don't crash the worker on log failures.
    console.error('logRun failed:', error)
  }
}
