// ── Pay App Audit Edge Function ─────────────────────────────
// POST { payment_application_id: string, override?: { reason: string, check_ids: string[] } }
//
// Server-side mirror of `auditChecks.ts`. The client also runs the audit so
// the UI can show ✗ icons immediately, but we re-run authoritatively here
// before allowing a status transition to 'submitted'. This way the gate is
// not bypassable by editing client state.
//
// On pass:                       transitions payment_applications.status → 'submitted'
// On fail without override:      returns 412 Precondition Failed with the failed checks
// On fail WITH valid override:   logs payapp_audit_overrides + transitions anyway
//
// Always writes a payapp_audit_runs row for provenance.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface AuditRequest {
  payment_application_id: string
  override?: {
    reason: string
    check_ids: string[]
  }
}

interface CheckResult {
  id: string
  label: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  detail?: string
  fix_link?: string
  evidence?: Record<string, unknown>
}

function namesMatch(a: string, b: string): boolean {
  const an = (a ?? '').trim().toLowerCase()
  const bn = (b ?? '').trim().toLowerCase()
  if (!an || !bn) return false
  if (an === bn) return true
  return an.includes(bn) || bn.includes(an)
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), cors)
  }

  try {
    const auth = await authenticateRequest(req)
    const body = await parseJsonBody<AuditRequest>(req)
    if (!body.payment_application_id) {
      throw new HttpError(400, 'payment_application_id required', 'validation_error')
    }
    if (body.override) {
      if (typeof body.override.reason !== 'string' || body.override.reason.trim().length < 12) {
        throw new HttpError(400, 'override.reason must be at least 12 characters', 'validation_error')
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    // ── Load pay app ──
    const { data: payApp, error: paErr } = await admin
      .from('payment_applications')
      .select('*')
      .eq('id', body.payment_application_id)
      .maybeSingle()
    if (paErr) throw new HttpError(500, paErr.message, 'db_error')
    if (!payApp) throw new HttpError(404, 'Payment application not found', 'not_found')

    // ── Load line items ──
    const { data: lineItems } = await admin
      .from('payment_line_items')
      .select('*')
      .eq('application_id', body.payment_application_id)

    // ── Load lien waivers for this app ──
    const { data: waivers } = await admin
      .from('lien_waivers')
      .select('id, contractor_name, application_id, amount, status, through_date')
      .eq('application_id', body.payment_application_id)

    // ── Load insurance certs for the project ──
    const { data: insurance } = await admin
      .from('insurance_certificates')
      .select('id, company, policy_type, expiration_date, effective_date, verified')
      .eq('project_id', payApp.project_id)

    // ── Aggregate contractors with billed work this period ──
    // We do a name-based aggregation off the line items + waiver names.
    // (A future migration could persist a sub_id on line items; see
    // COMPLIANCE_GATE.md "Known limitations".)
    const periodSubs = new Map<string, { name: string; billed: number }>()
    for (const w of waivers ?? []) {
      const key = (w.contractor_name ?? '').trim().toLowerCase()
      if (!key) continue
      const existing = periodSubs.get(key) ?? { name: w.contractor_name, billed: 0 }
      existing.billed += Number(w.amount ?? 0)
      periodSubs.set(key, existing)
    }
    // If no waivers exist yet but we still have contractors via subcontractor_id
    // on insurance, fall back to a single bucket against contractor_name on the
    // payment_applications row (legacy GC contracts).
    if (periodSubs.size === 0 && payApp.contractor_name) {
      periodSubs.set((payApp.contractor_name as string).toLowerCase(), {
        name: payApp.contractor_name,
        billed: Number(payApp.total_completed_and_stored ?? 0),
      })
    }
    const contractorsThisPeriod = Array.from(periodSubs.values()).map((v) => ({
      contractor_id: null,
      contractor_name: v.name,
      billed_amount_this_period: v.billed,
    }))

    // ── Run checks (server-side mirror of auditChecks.ts) ──
    const results: CheckResult[] = []

    // Lien waivers
    {
      const missing: string[] = []
      for (const c of contractorsThisPeriod) {
        if (c.billed_amount_this_period <= 0) continue
        const has = (waivers ?? []).some(
          (w) => namesMatch(w.contractor_name ?? '', c.contractor_name) && w.status !== 'pending',
        )
        if (!has) missing.push(c.contractor_name)
      }
      results.push({
        id: 'lien_waivers_present',
        label: 'Lien waiver from every sub with billed work',
        status: missing.length === 0 ? 'pass' : 'fail',
        detail: missing.length > 0 ? `${missing.length} missing: ${missing.slice(0, 3).join(', ')}` : undefined,
      })
    }

    // COI coverage
    {
      const periodEnd = new Date(payApp.period_to as string).getTime()
      const periodStart = payApp.period_from
        ? new Date(payApp.period_from as string).getTime()
        : Number.NEGATIVE_INFINITY
      const uncovered: string[] = []
      for (const c of contractorsThisPeriod) {
        if (c.billed_amount_this_period <= 0) continue
        const certs = (insurance ?? []).filter((i) => namesMatch(i.company ?? '', c.contractor_name))
        if (certs.length === 0) {
          uncovered.push(`${c.contractor_name} (no COI)`)
          continue
        }
        const ok = certs.some((cert) => {
          if (!cert.verified) return false
          const exp = cert.expiration_date ? new Date(cert.expiration_date).getTime() : NaN
          const eff = cert.effective_date ? new Date(cert.effective_date).getTime() : NaN
          if (Number.isNaN(exp)) return false
          const effOk = Number.isNaN(eff) || eff <= periodStart
          return effOk && exp >= periodEnd
        })
        if (!ok) uncovered.push(c.contractor_name)
      }
      results.push({
        id: 'coi_active_for_period',
        label: 'COI active for every sub for the entire period',
        status: uncovered.length === 0 ? 'pass' : 'fail',
        detail: uncovered.length > 0 ? `${uncovered.length} gaps: ${uncovered.slice(0, 3).join(', ')}` : undefined,
      })
    }

    // G702/G703 reconcile
    {
      const lineSum = (lineItems ?? []).reduce(
        (s, li) =>
          s +
          (Number(li.previous_completed ?? 0) +
            Number(li.this_period ?? 0) +
            Number(li.materials_stored ?? 0)),
        0,
      )
      const headerTotal = Number(payApp.total_completed_and_stored ?? 0)
      const drift = Math.abs(lineSum - headerTotal)
      results.push({
        id: 'g702_g703_reconcile',
        label: 'G702 / G703 totals reconcile',
        status: drift <= 1 ? 'pass' : 'fail',
        detail: drift > 1 ? `Off by $${drift.toFixed(2)}` : undefined,
      })
    }

    // SOV % under 100
    {
      const overruns: string[] = []
      for (const li of lineItems ?? []) {
        const sv = Number(li.scheduled_value ?? 0)
        if (sv <= 0) continue
        const billed =
          Number(li.previous_completed ?? 0) +
          Number(li.this_period ?? 0) +
          Number(li.materials_stored ?? 0)
        const pct = (billed / sv) * 100
        if (pct > 100.5) overruns.push(`#${li.item_number}`)
      }
      results.push({
        id: 'sov_percent_under_100',
        label: 'No SOV line bills over 100%',
        status: overruns.length === 0 ? 'pass' : 'fail',
        detail: overruns.length > 0 ? `${overruns.length} over: ${overruns.slice(0, 2).join(', ')}` : undefined,
      })
    }

    // Retainage math
    {
      const expected =
        Number(payApp.total_completed_and_stored ?? 0) *
        (Number(payApp.retainage_percent ?? 0) / 100)
      const actual = Number(payApp.retainage_amount ?? 0)
      const drift = Math.abs(expected - actual)
      results.push({
        id: 'retainage_math_correct',
        label: 'Retainage math reconciles',
        status: drift <= 1 ? 'pass' : 'fail',
        detail: drift > 1 ? `Expected $${expected.toFixed(2)}, got $${actual.toFixed(2)}` : undefined,
      })
    }

    const failed = results.filter((r) => r.status === 'fail')
    const warned = results.filter((r) => r.status === 'warn')
    const overallStatus: 'pass' | 'warn' | 'fail' =
      failed.length > 0 ? 'fail' : warned.length > 0 ? 'warn' : 'pass'

    // ── Audit run row (always) ──
    const { data: runRow } = await admin
      .from('payapp_audit_runs')
      .insert({
        project_id: payApp.project_id,
        payment_application_id: payApp.id,
        status: overallStatus,
        total_checks: results.length,
        failed_checks: failed.length,
        warned_checks: warned.length,
        results,
        ran_by: auth.user.id,
        created_via: 'edge_function',
      })
      .select('id')
      .single()

    // ── Decide submission ──
    if (overallStatus === 'fail' && !body.override) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: 'fail',
          summary: { results, failed: failed.length, warned: warned.length, total: results.length },
          message: 'Pay app has unresolved compliance gaps. Override required to submit.',
        }),
        { status: 412, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // If override supplied, log it and proceed.
    if (overallStatus === 'fail' && body.override) {
      await admin.from('payapp_audit_overrides').insert({
        project_id: payApp.project_id,
        payment_application_id: payApp.id,
        audit_run_id: runRow?.id,
        overridden_check_ids: body.override.check_ids,
        reason: body.override.reason.trim(),
        overridden_by: auth.user.id,
        created_via: 'edge_function',
      })
    }

    // Transition status if currently 'draft'
    if (payApp.status === 'draft') {
      await admin
        .from('payment_applications')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: auth.user.id,
        })
        .eq('id', payApp.id)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: overallStatus,
        overrode: overallStatus === 'fail' && !!body.override,
        summary: { results, failed: failed.length, warned: warned.length, total: results.length },
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return errorResponse(e, cors)
  }
})
