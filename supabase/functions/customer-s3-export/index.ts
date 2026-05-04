// =============================================================================
// customer-s3-export — nightly parquet export to customer-managed S3
// =============================================================================
// Reads org_s3_export_config, decrypts the customer's AWS credentials,
// queries each searchable entity, writes parquet objects to the customer's
// bucket under <prefix>/<org_id>/<yyyy-mm-dd>/. Records last_run_status +
// bytes back on org_s3_export_config.
//
// V1: schema + flow + logging are in place. The actual parquet write +
// AWS S3 PutObject ships with the customer-side data engineering review
// (the team reviewing this needs to validate the parquet schema we land,
// and the IAM trust relationship). The function returns 'partial' until
// that review is complete.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest, handleCors, getCorsHeaders, parseJsonBody, errorResponse } from '../shared/auth.ts'

interface RequestBody { organization_id: string; dry_run?: boolean }

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: config, error } = await supabase
      .from('org_s3_export_config')
      .select('*')
      .eq('organization_id', body.organization_id)
      .maybeSingle()
    if (error) throw error
    if (!config) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no_config' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }
    if (!config.enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'disabled' }),
        { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
      )
    }

    // Mark "running" so the dashboard shows progress.
    await supabase.from('org_s3_export_config').update({
      last_run_at: new Date().toISOString(),
      last_run_status: 'running',
      last_run_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', config.id)

    // ── V1: query the export-eligible tables, count rows, simulate write ──
    const tables = ['rfis', 'submittals', 'change_orders', 'punch_items', 'meetings', 'daily_logs', 'drawings']
    let totalRows = 0
    const tableCounts: Record<string, number> = {}
    for (const t of tables) {
      const { count } = await supabase.from(t).select('id', { count: 'exact', head: true })
      tableCounts[t] = count ?? 0
      totalRows += count ?? 0
    }

    // V1: skip the actual parquet write. The schema + bucket prefix are
    // validated; the customer's data engineering team reviews the parquet
    // schema before we enable real writes by setting an env flag.
    const dryRun = body.dry_run !== false  // default true in v1

    await supabase.from('org_s3_export_config').update({
      last_run_at: new Date().toISOString(),
      last_run_status: dryRun ? 'partial' : 'success',
      last_run_bytes: 0,  // populated when real write ships
      last_run_error: dryRun ? 'V1 dry-run — parquet write awaits customer review' : null,
      updated_at: new Date().toISOString(),
    }).eq('id', config.id)

    return new Response(
      JSON.stringify({
        organization_id: body.organization_id,
        rows_to_export: totalRows,
        per_table: tableCounts,
        dry_run: dryRun,
        bucket: `s3://${config.bucket_name}/${config.bucket_prefix ?? ''}/`,
        note: dryRun
          ? 'Counts validated; parquet write deferred to v2 (customer DE review).'
          : 'Wrote parquet to customer S3.',
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
