// ── audit-scales Edge Function ───────────────────────────────
// Phase 7: Cross-modal scale audit between arch/struct drawing pairs.
// Adapted from sitesyncai-backend-main/src/chatbot/tools/scale-audit.service.ts.
//
// ENHANCEMENT: When a critical mismatch is found (e.g. arch and struct off
// by a factor of 2), auto-creates an RFI draft with the specific correction
// needed, saved to ai_rfi_drafts for user review.


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  authenticateRequest,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface AuditRequest {
  project_id: string
  limit?: number
  auto_create_rfi?: boolean
}

interface MismatchedPair {
  pair_id: string
  arch_sheet: string
  struct_sheet: string
  arch_scale: string
  struct_scale: string
  arch_ratio: number | null
  struct_ratio: number | null
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: string
}

function normalizeScale(text: string | null | undefined): string | null {
  if (!text) return null
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/"/g, '')
    .replace(/''/g, '')
    .trim()
}

function severityOf(archRatio: number | null, structRatio: number | null): MismatchedPair['severity'] {
  if (!archRatio || !structRatio) return 'low'
  const ratio = Math.max(archRatio, structRatio) / Math.min(archRatio, structRatio)
  if (ratio >= 2) return 'critical'
  if (ratio >= 1.5) return 'high'
  if (ratio > 1) return 'medium'
  return 'low'
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    await authenticateRequest(req)
    const body = await parseJsonBody<AuditRequest>(req)
    if (!body.project_id) {
      throw new HttpError(400, 'project_id required', 'validation_error')
    }
    const limit = Math.min(body.limit ?? 100, 200)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pairs, error } = await admin
      .from('drawing_pairs')
      .select(
        `id, status,
         arch_classification:arch_classification_id (sheet_number, scale_text, scale_ratio),
         struct_classification:struct_classification_id (sheet_number, scale_text, scale_ratio)`,
      )
      .eq('project_id', body.project_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new HttpError(500, error.message, 'db_error')

    const mismatched: MismatchedPair[] = []
    let matched = 0
    let unscored = 0

    for (const p of pairs ?? []) {
      const pair = p as unknown as {
        id: string
        status: string
        arch_classification: { sheet_number?: string; scale_text?: string; scale_ratio?: number } | null
        struct_classification: { sheet_number?: string; scale_text?: string; scale_ratio?: number } | null
      }
      const a = pair.arch_classification
      const s = pair.struct_classification
      if (!a || !s) {
        unscored++
        continue
      }
      const archScale = normalizeScale(a.scale_text)
      const structScale = normalizeScale(s.scale_text)
      if (!archScale && !structScale) {
        matched++
        continue
      }
      if (archScale === structScale) {
        matched++
        continue
      }
      const severity = severityOf(a.scale_ratio ?? null, s.scale_ratio ?? null)
      mismatched.push({
        pair_id: pair.id,
        arch_sheet: a.sheet_number ?? 'Unknown',
        struct_sheet: s.sheet_number ?? 'Unknown',
        arch_scale: a.scale_text ?? '—',
        struct_scale: s.scale_text ?? '—',
        arch_ratio: a.scale_ratio ?? null,
        struct_ratio: s.scale_ratio ?? null,
        severity,
        status: pair.status,
      })
    }

    const totalChecked = (pairs?.length ?? 0) - unscored
    const matchPct = totalChecked > 0 ? Math.round((matched / totalChecked) * 1000) / 10 : 0

    // Enhancement: auto-create RFI drafts for critical mismatches.
    const rfiDrafts: Array<{ pair_id: string; subject: string }> = []
    if (body.auto_create_rfi) {
      const critical = mismatched.filter((m) => m.severity === 'critical')
      for (const m of critical) {
        const subject = `Scale mismatch: ${m.arch_sheet} (${m.arch_scale}) vs ${m.struct_sheet} (${m.struct_scale})`
        const question = `The architectural sheet ${m.arch_sheet} is drawn at ${m.arch_scale} but the paired structural sheet ${m.struct_sheet} is at ${m.struct_scale}. This is a ${m.severity} cross-discipline scale inconsistency that will cause dimensional errors during coordination. Please confirm the intended scale and reissue the affected sheets.`
        try {
          await admin.from('ai_rfi_drafts').insert({
            project_id: body.project_id,
            source: 'scale_audit',
            source_ref: m.pair_id,
            subject,
            question,
            severity: m.severity,
            metadata: { arch_scale: m.arch_scale, struct_scale: m.struct_scale },
          })
          rfiDrafts.push({ pair_id: m.pair_id, subject })
        } catch {
          // Continue — auto-RFI is best-effort.
        }
      }
    }

    return new Response(
      JSON.stringify({
        project_id: body.project_id,
        match_percentage: matchPct,
        matched_count: matched,
        mismatched_count: mismatched.length,
        mismatched_pairs: mismatched,
        total_checked: totalChecked,
        unscored_count: unscored,
        rfi_drafts_created: rfiDrafts.length,
        rfi_drafts: rfiDrafts,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
