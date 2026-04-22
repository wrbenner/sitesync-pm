// ── export-training-data Edge Function ───────────────────
// Phase 5, Module 9: Aggregates un-exported rows from
// ai_training_corrections and POSTs them to Roboflow as a new
// training batch. Adapted from
// sitesyncai-backend-main/src/training/training.service.ts.
//
// Request body (all optional):
//   { project_id?: string, correction_type?: 'classification'|'discrepancy'|'edge_detection'|'entity', dry_run?: boolean, limit?: number }
//
// Response:
//   { batch_id, exported: n, roboflow_upload_count: n, status }


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface CorrectionRow {
  id: string
  project_id: string | null
  correction_type: string
  original_value: Record<string, unknown> | null
  corrected_value: Record<string, unknown> | null
  drawing_id: string | null
  page_image_url: string | null
  annotation_coordinates: Record<string, unknown> | null
}

interface RoboflowBatchResult {
  success: number
  failed: number
  errors: string[]
}

const ROBOFLOW_API_BASE = 'https://api.roboflow.com'

async function uploadToRoboflow(
  row: CorrectionRow,
  apiKey: string,
  datasetId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!row.page_image_url) {
    return { ok: false, error: 'Missing page_image_url' }
  }

  // Roboflow hosted image upload endpoint. Batched into single calls to avoid
  // the per-request overhead; real production pipeline would use
  // Roboflow bulk upload, but this Edge Function keeps the flow simple.
  const uploadUrl = `${ROBOFLOW_API_BASE}/dataset/${datasetId}/upload?api_key=${apiKey}&image=${encodeURIComponent(
    row.page_image_url,
  )}&split=train`

  try {
    const res = await fetch(uploadUrl, { method: 'POST' })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Roboflow ${res.status}: ${text.slice(0, 200)}` }
    }
    const body = await res.json().catch(() => null)
    if (body?.id) {
      const label =
        (row.corrected_value?.discipline as string | undefined) ||
        (row.corrected_value?.label as string | undefined) ||
        row.correction_type
      const annotations = {
        annotations: [
          {
            class: label,
            bbox: row.annotation_coordinates ?? null,
          },
        ],
      }
      const annotateUrl = `${ROBOFLOW_API_BASE}/dataset/${datasetId}/annotate/${body.id}?api_key=${apiKey}`
      await fetch(annotateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annotations),
      }).catch(() => undefined)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    const { user } = await authenticateRequest(req)

    const body = await parseJsonBody<{
      project_id?: string
      correction_type?: string
      dry_run?: boolean
      limit?: number
    }>(req)

    const limit = Math.min(Math.max(body.limit ?? 500, 1), 2000)
    const dryRun = body.dry_run === true

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, 'Service configuration missing', 'config_error')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    let query = supabase
      .from('ai_training_corrections')
      .select(
        'id, project_id, correction_type, original_value, corrected_value, drawing_id, page_image_url, annotation_coordinates',
      )
      .eq('is_exported', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (body.project_id) query = query.eq('project_id', body.project_id)
    if (body.correction_type) query = query.eq('correction_type', body.correction_type)

    const { data: rows, error: fetchError } = await query
    if (fetchError) {
      throw new HttpError(500, `Fetch corrections failed: ${fetchError.message}`)
    }

    const corrections = (rows ?? []) as CorrectionRow[]
    const batchId = crypto.randomUUID()

    if (corrections.length === 0) {
      return new Response(
        JSON.stringify({
          batch_id: batchId,
          exported: 0,
          roboflow_upload_count: 0,
          status: 'nothing_to_export',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const roboflowKey = Deno.env.get('ROBOFLOW_API_KEY')
    const roboflowDataset = Deno.env.get('ROBOFLOW_DATASET_ID') || 'sitesync-v2'

    const result: RoboflowBatchResult = { success: 0, failed: 0, errors: [] }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          batch_id: batchId,
          exported: corrections.length,
          roboflow_upload_count: 0,
          status: 'dry_run',
          preview: corrections.slice(0, 5),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    if (!roboflowKey) {
      throw new HttpError(500, 'ROBOFLOW_API_KEY not configured', 'config_error')
    }

    for (const row of corrections) {
      const upload = await uploadToRoboflow(row, roboflowKey, roboflowDataset)
      if (upload.ok) {
        result.success += 1
      } else {
        result.failed += 1
        if (upload.error) result.errors.push(`${row.id}: ${upload.error}`)
      }
    }

    const exportedIds = corrections.slice(0, result.success).map((r) => r.id)
    if (exportedIds.length > 0) {
      const { error: updateError } = await supabase
        .from('ai_training_corrections')
        .update({
          is_exported: true,
          exported_at: new Date().toISOString(),
          export_batch_id: batchId,
        })
        .in('id', exportedIds)
      if (updateError) {
        console.error('[export-training-data] mark-exported failed', updateError.message)
      }
    }

    return new Response(
      JSON.stringify({
        batch_id: batchId,
        exported: result.success,
        failed: result.failed,
        roboflow_upload_count: result.success,
        errors: result.errors.slice(0, 10),
        status: 'complete',
        requested_by: user.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
