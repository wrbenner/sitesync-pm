// ── Owner Pay App Preview Edge Function ───────────────────────
// PUBLIC endpoint — no Supabase session. The token IS the auth.
//
//   GET  /owner-payapp-preview?id=<preview_id>&t=<token>
//        → returns read-only pay-app payload + comments. Rotates expires_at
//          24h on first access.
//
//   POST /owner-payapp-preview/comment
//        body: { id, t, comment, cost_code_anchor?, author_email }
//        → appends a comment to the thread.
//
//   POST /owner-payapp-preview/approve
//        body: { id, t, approved_by_email }
//        → marks the preview approved.
//
// Token validation: SHA-256 the URL token, compare against magic_token_hash
// stored on payapp_owner_previews. Constant-time string comparison via
// hash equality. Expired tokens 401.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(supabaseUrl, serviceKey)
}

interface PreviewRow {
  id: string
  pay_app_id: string
  project_id: string
  magic_token_hash: string
  expires_at: string
  accessed_at: string | null
  approved_at: string | null
  approved_by_email: string | null
}

async function loadPreview(id: string, token: string): Promise<PreviewRow> {
  if (!id || !token) throw new HttpError(401, 'Missing preview id or token')
  const tokenHash = await sha256Hex(token)
  const supa = adminClient()
  const { data, error } = await supa
    .from('payapp_owner_previews')
    .select('id, pay_app_id, project_id, magic_token_hash, expires_at, accessed_at, approved_at, approved_by_email')
    .eq('id', id)
    .single()
  if (error || !data) throw new HttpError(404, 'Preview not found')
  // Constant-time equality via hash compare.
  if ((data.magic_token_hash ?? '') !== tokenHash) {
    throw new HttpError(401, 'Invalid token')
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new HttpError(401, 'Token expired')
  }
  return data as PreviewRow
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').filter(Boolean).pop() ?? ''

    if (req.method === 'GET') {
      const id = url.searchParams.get('id') ?? ''
      const token = url.searchParams.get('t') ?? ''
      const preview = await loadPreview(id, token)

      const supa = adminClient()
      const [payAppQ, linesQ, commentsQ, reconQ] = await Promise.all([
        supa
          .from('payment_applications')
          .select('id, application_number, period_to, period_from, original_contract_sum, net_change_orders, total_completed_and_stored, retainage_percent, retainage_amount, less_previous_certificates, current_payment_due, status, project:projects(name, address, owner_name)')
          .eq('id', preview.pay_app_id)
          .single(),
        supa
          .from('payment_line_items')
          .select('id, item_number, description, scheduled_value, previous_completed, this_period, materials_stored, percent_complete')
          .eq('payment_application_id', preview.pay_app_id)
          .order('item_number'),
        supa
          .from('payapp_owner_preview_comments')
          .select('id, author_email, author_role, comment, cost_code_anchor, resolved, created_at')
          .eq('preview_id', preview.id)
          .order('created_at'),
        supa
          .from('pay_app_reconciliations')
          .select('status, blocked, blocked_dollars_at_risk, variance_lines')
          .eq('pay_app_id', preview.pay_app_id)
          .maybeSingle(),
      ])

      // 24h auto-extension on first access.
      const newExpiry = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      await supa
        .from('payapp_owner_previews')
        .update({ accessed_at: new Date().toISOString(), expires_at: newExpiry })
        .eq('id', preview.id)

      return new Response(
        JSON.stringify({
          preview: { ...preview, expires_at: newExpiry },
          pay_app: payAppQ.data ?? null,
          line_items: linesQ.data ?? [],
          comments: commentsQ.data ?? [],
          reconciliation: reconQ.data ?? null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody<{ id: string; t: string; [k: string]: unknown }>(req)
      const preview = await loadPreview(String(body.id ?? ''), String(body.t ?? ''))
      const supa = adminClient()

      if (path === 'comment') {
        const author = String(body.author_email ?? '').trim()
        const comment = String(body.comment ?? '').trim()
        const anchor = body.cost_code_anchor != null ? String(body.cost_code_anchor) : null
        if (!author || !comment) throw new HttpError(400, 'author_email and comment are required')
        const { data, error } = await supa
          .from('payapp_owner_preview_comments')
          .insert({
            preview_id: preview.id,
            pay_app_id: preview.pay_app_id,
            project_id: preview.project_id,
            author_email: author,
            author_role: 'owner',
            comment,
            cost_code_anchor: anchor,
          })
          .select('id, created_at')
          .single()
        if (error) throw new HttpError(500, `Comment insert failed: ${error.message}`)
        return new Response(JSON.stringify({ ok: true, comment_id: data?.id }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (path === 'approve') {
        const approvedBy = String(body.approved_by_email ?? '').trim()
        if (!approvedBy) throw new HttpError(400, 'approved_by_email is required')
        await supa
          .from('payapp_owner_previews')
          .update({ approved_at: new Date().toISOString(), approved_by_email: approvedBy })
          .eq('id', preview.id)
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      throw new HttpError(404, 'Unknown subroute')
    }

    throw new HttpError(405, 'Method not allowed')
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
