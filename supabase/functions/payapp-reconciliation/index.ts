// ── Pay App Reconciliation Edge Function ──────────────────────
// POST { pay_app_id: string, force?: boolean }
//
// Computes the schedule-vs-pay-app reconciliation snapshot for one pay app
// and persists it idempotently. Re-runs replace prior output for the same
// pay_app_id. The compute itself is a pure function in
// `src/lib/reconciliation/scheduleVsPayApp.ts` — this edge function is the
// I/O wrapper: load activities + line items, call the pure function,
// upsert the rollup + per-line projection.
//
// Returns the computed report (mirrors ReconciliationReport).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  requireUuid,
  verifyProjectMembership,
} from '../shared/auth.ts'

interface ReconcileRequest {
  pay_app_id: string
  force?: boolean
}

interface PayAppLine {
  id: string
  cost_code: string | null
  description: string | null
  scheduled_value: number | null
  percent_complete: number | null
}

interface ScheduleActivity {
  id: string
  cost_code: string | null
  name: string
  percent_complete: number | null
}

// ── Pure variance classifier (mirror of scheduleVsPayApp.ts) ────
type Severity = 'ok' | 'minor' | 'material' | 'critical'

interface ReconLine {
  cost_code: string
  description: string
  schedule_pct: number | null
  pay_app_pct: number | null
  scheduled_value: number
  variance_pct: number | null
  severity: Severity
  reason: string
  blocked: boolean
}

const MINOR = 5
const MATERIAL = 10
const CRITICAL = 20

function classify(
  variance: number | null,
  schedulePct: number | null,
  payPct: number,
): { severity: Severity; reason: string; blocked: boolean } {
  if (variance == null || schedulePct == null) {
    if (payPct > 0) {
      return { severity: 'material', reason: 'Pay-app line has no matching schedule activity.', blocked: true }
    }
    return { severity: 'ok', reason: 'Pay-app line not yet started.', blocked: false }
  }
  const abs = Math.abs(variance)
  if (abs >= CRITICAL) {
    return { severity: 'critical', reason: `${variance > 0 ? 'Over' : 'Under'}-billed by ${abs.toFixed(1)}pp.`, blocked: true }
  }
  if (abs >= MATERIAL) {
    return { severity: 'material', reason: `${variance > 0 ? 'Over' : 'Under'}-billed by ${abs.toFixed(1)}pp.`, blocked: true }
  }
  if (abs >= MINOR) {
    return { severity: 'minor', reason: `${abs.toFixed(1)}pp variance vs schedule.`, blocked: false }
  }
  return { severity: 'ok', reason: 'Schedule and pay-app agree within tolerance.', blocked: false }
}

function clampPct(p: number | null | undefined): number {
  if (p == null || !Number.isFinite(p)) return 0
  if (p < 0) return 0
  if (p > 100) return 100
  return p
}

function reconcile(
  payAppLines: PayAppLine[],
  scheduleActivities: ScheduleActivity[],
): { lines: ReconLine[]; blocked: boolean; blocked_dollars: number } {
  const actByCode = new Map<string, ScheduleActivity[]>()
  for (const a of scheduleActivities) {
    const key = (a.cost_code ?? '').trim().toLowerCase()
    if (!key) continue
    const list = actByCode.get(key) ?? []
    list.push(a)
    actByCode.set(key, list)
  }

  const seen = new Set<string>()
  const lines: ReconLine[] = []

  for (const li of payAppLines) {
    const cc = li.cost_code ?? ''
    const key = cc.trim().toLowerCase()
    seen.add(key)
    const acts = actByCode.get(key)
    const schedulePct = acts && acts.length > 0
      ? acts.reduce((s, a) => s + clampPct(a.percent_complete), 0) / acts.length
      : null
    const payPct = clampPct(li.percent_complete)
    const variance = schedulePct == null ? null : payPct - schedulePct
    const cls = classify(variance, schedulePct, payPct)
    lines.push({
      cost_code: cc,
      description: li.description ?? '',
      schedule_pct: schedulePct,
      pay_app_pct: payPct,
      scheduled_value: li.scheduled_value ?? 0,
      variance_pct: variance,
      severity: cls.severity,
      reason: cls.reason,
      blocked: cls.blocked,
    })
  }

  for (const [key, acts] of actByCode.entries()) {
    if (seen.has(key)) continue
    const schedulePct = acts.reduce((s, a) => s + clampPct(a.percent_complete), 0) / acts.length
    lines.push({
      cost_code: acts[0].cost_code ?? '',
      description: acts[0].name,
      schedule_pct: schedulePct,
      pay_app_pct: null,
      scheduled_value: 0,
      variance_pct: null,
      severity: 'minor',
      reason: 'Schedule activity has no matching pay-app SOV line.',
      blocked: false,
    })
  }

  const blocked_dollars = lines
    .filter(l => l.blocked)
    .reduce((s, l) => s + l.scheduled_value, 0)

  return { lines, blocked: lines.some(l => l.blocked), blocked_dollars }
}

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed')
    }
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ReconcileRequest>(req)
    const payAppId = requireUuid(body.pay_app_id, 'pay_app_id')

    // Load pay app + project for membership check.
    const { data: payApp, error: paErr } = await supabase
      .from('payment_applications')
      .select('id, project_id')
      .eq('id', payAppId)
      .single()
    if (paErr || !payApp) {
      throw new HttpError(404, 'Pay application not found')
    }
    await verifyProjectMembership(supabase, user.id, payApp.project_id)

    // Load line items + schedule activities.
    const [{ data: lines }, { data: activities }] = await Promise.all([
      supabase
        .from('payment_line_items')
        .select('id, cost_code, description, scheduled_value, percent_complete')
        .eq('payment_application_id', payAppId),
      supabase
        .from('schedule_activities')
        .select('id, cost_code, name, percent_complete')
        .eq('project_id', payApp.project_id),
    ])

    const report = reconcile(
      (lines ?? []) as PayAppLine[],
      (activities ?? []) as ScheduleActivity[],
    )

    const status = report.lines.some(l => l.severity === 'critical') ? 'critical'
      : report.lines.some(l => l.severity === 'material') ? 'material'
      : report.lines.some(l => l.severity === 'minor') ? 'minor'
      : 'ok'

    // Service-role client for the upsert (bypasses RLS to write the snapshot).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: upserted, error: upErr } = await adminClient
      .from('pay_app_reconciliations')
      .upsert(
        {
          pay_app_id: payAppId,
          project_id: payApp.project_id,
          status,
          blocked: report.blocked,
          blocked_dollars_at_risk: report.blocked_dollars,
          variance_lines: report.lines,
          applied_tolerance_pct: MATERIAL,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'pay_app_id' },
      )
      .select('id')
      .single()
    if (upErr || !upserted) {
      throw new HttpError(500, `Failed to persist reconciliation: ${upErr?.message ?? ''}`)
    }

    // Replace per-line projection.
    await adminClient
      .from('pay_app_reconciliation_lines')
      .delete()
      .eq('reconciliation_id', upserted.id)
    if (report.lines.length > 0) {
      await adminClient.from('pay_app_reconciliation_lines').insert(
        report.lines.map(l => ({
          reconciliation_id: upserted.id,
          pay_app_id: payAppId,
          project_id: payApp.project_id,
          cost_code: l.cost_code,
          description: l.description,
          schedule_pct: l.schedule_pct,
          pay_app_pct: l.pay_app_pct,
          scheduled_value: l.scheduled_value,
          variance_pct: l.variance_pct,
          severity: l.severity,
          blocked: l.blocked,
          reason: l.reason,
        })),
      )
    }

    return new Response(
      JSON.stringify({
        reconciliation_id: upserted.id,
        status,
        blocked: report.blocked,
        blocked_dollars: report.blocked_dollars,
        lines: report.lines,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
