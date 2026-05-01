// =============================================================================
// platform-health — single GET that returns deployment + migration + cron + secrets posture
// =============================================================================
// Returns 200 only when everything is green; 503 with detail otherwise.
// Auth required (service role) — never exposes counts to anonymous.
//
// The body shape matches audit/platform-health-baseline.json so dashboards
// + alerting can diff cleanly against the captured baseline.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, getCorsHeaders, errorResponse, HttpError } from '../shared/auth.ts'

interface HealthReport {
  generated_at: string
  project_id: string
  edge_functions: { deployed_count: number; missing_count: number | null }
  migrations: { applied_count: number; expected_count: number | null }
  extensions: { pg_cron: boolean; pg_net: boolean; pg_stat_statements: boolean }
  cron: { jobs_scheduled: number; failures_24h: number | null }
  secrets: { service_role_set: boolean; anthropic_key_set: boolean; resend_key_set: boolean }
  overall_status: 'green' | 'degraded' | 'critical'
  findings: Array<{ severity: 'info' | 'warn' | 'error'; message: string }>
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors

  try {
    // Service-role only. We never reveal posture details to anonymous callers.
    const auth = req.headers.get('authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!auth || !serviceKey || !auth.includes(serviceKey)) {
      throw new HttpError(401, 'service_role required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const projectId = (supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1]) ?? 'unknown'
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const findings: HealthReport['findings'] = []

    // ── Migrations applied ───────────────────────────────────────────
    let appliedCount = 0
    try {
      const { data } = await supabase
        .schema('supabase_migrations' as never as 'public')
        .from('schema_migrations')
        .select('version', { count: 'exact', head: false })
      appliedCount = data?.length ?? 0
    } catch (_) {
      findings.push({ severity: 'warn', message: 'cannot read supabase_migrations.schema_migrations — service role lacks schema grant' })
    }

    // ── Extensions ───────────────────────────────────────────────────
    const exts = { pg_cron: false, pg_net: false, pg_stat_statements: false }
    const { data: extRows } = await supabase
      .from('pg_extension' as never)
      .select('extname')
      .or('extname.eq.pg_cron,extname.eq.pg_net,extname.eq.pg_stat_statements')
      .returns<Array<{ extname: string }>>()
    if (extRows) {
      for (const r of extRows) {
        if (r.extname === 'pg_cron') exts.pg_cron = true
        if (r.extname === 'pg_net') exts.pg_net = true
        if (r.extname === 'pg_stat_statements') exts.pg_stat_statements = true
      }
    }
    if (!exts.pg_cron) findings.push({ severity: 'error', message: 'pg_cron not installed — every cron job is silent' })
    if (!exts.pg_net)  findings.push({ severity: 'error', message: 'pg_net not installed — cron cannot invoke edge functions' })

    // ── Cron status ──────────────────────────────────────────────────
    let jobsScheduled = 0
    let failures24h: number | null = null
    if (exts.pg_cron) {
      const { data: cronJobs } = await supabase.from('cron.job' as never).select('jobid').returns<Array<{ jobid: number }>>()
      jobsScheduled = cronJobs?.length ?? 0
      const { data: failedRuns } = await supabase
        .from('cron.job_run_details' as never)
        .select('runid')
        .neq('status', 'succeeded')
        .gt('end_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .returns<Array<{ runid: number }>>()
      failures24h = failedRuns?.length ?? 0
      if (failures24h > 0) {
        findings.push({ severity: 'warn', message: `${failures24h} cron job failures in the last 24h` })
      }
    }

    // ── Secrets (presence only — never the values) ───────────────────
    const secrets = {
      service_role_set: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      anthropic_key_set: !!Deno.env.get('ANTHROPIC_API_KEY'),
      resend_key_set: !!Deno.env.get('RESEND_API_KEY'),
    }
    if (!secrets.anthropic_key_set) findings.push({ severity: 'warn', message: 'ANTHROPIC_API_KEY not set — AI features degraded' })
    if (!secrets.resend_key_set)    findings.push({ severity: 'warn', message: 'RESEND_API_KEY not set — outbound email disabled' })

    // ── Edge functions deployed: this function can't list itself, so we
    //    rely on the sister `audit-edge-functions.ts` script to count.
    //    The endpoint reports the count it can see (only itself, by definition).
    const edgeDeployedCount = 1  // ourselves; real count comes from MCP-driven CI

    // ── Overall ──────────────────────────────────────────────────────
    const errorFindings = findings.filter(f => f.severity === 'error').length
    const warnFindings  = findings.filter(f => f.severity === 'warn').length
    const overall: HealthReport['overall_status'] =
      errorFindings > 0 ? 'critical' : warnFindings > 0 ? 'degraded' : 'green'

    const report: HealthReport = {
      generated_at: new Date().toISOString(),
      project_id: projectId,
      edge_functions: { deployed_count: edgeDeployedCount, missing_count: null },
      migrations: { applied_count: appliedCount, expected_count: null },
      extensions: exts,
      cron: { jobs_scheduled: jobsScheduled, failures_24h: failures24h },
      secrets,
      overall_status: overall,
      findings,
    }

    return new Response(JSON.stringify(report, null, 2), {
      status: overall === 'green' ? 200 : 503,
      headers: { ...getCorsHeaders(req), 'content-type': 'application/json' },
    })
  } catch (err) {
    return errorResponse(err, req)
  }
})
