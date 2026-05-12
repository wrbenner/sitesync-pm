// start-impersonation — BRT sub-6 §4.3
//
// Opens an impersonation session for an internal admin. Hard contract:
//
//   1. Authenticate caller (must be is_internal_admin = true).
//   2. Queue customer notification (in-app + email) and capture the
//      notification_sent_at timestamp.
//   3. ONLY THEN call start_impersonation_session() with that timestamp.
//
// If step 2 fails for any reason — bad email config, queue down, network
// blip — step 3 never runs. The session is refused. The customer is
// always notified before the session JWT exists.
//
// Returns:
//   { session_id, expires_at }
//
// Caller is expected to use the session_id to mint a Supabase JWT that
// resolves to the target user's identity (via supabase.auth.admin.generateLink
// or similar). That JWT-minting step is intentionally separate so this
// function focuses on the safety contract.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  sanitizeString,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface StartImpersonationRequest {
  target_user_id: string
  target_org_id: string
  reason: string
  duration_minutes?: number
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')

    // 1. Authenticate caller.
    const { user } = await authenticateRequest(req)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // 1b. Confirm caller is an internal admin (defense in depth — the SQL
    //     function checks too, but failing here is a 403 instead of a 500).
    const { data: profile } = await adminClient
      .from('profiles')
      .select('is_internal_admin')
      .eq('id', user.id)
      .single()

    if (!(profile as { is_internal_admin?: boolean } | null)?.is_internal_admin) {
      // Use 404, not 403, to avoid disclosing that internal-admin gating exists.
      throw new HttpError(404, 'Not found')
    }

    // 2. Parse + validate body.
    const body = await parseJsonBody<StartImpersonationRequest>(req)
    const targetUserId = body.target_user_id
    const targetOrgId = body.target_org_id
    if (!targetUserId || typeof targetUserId !== 'string') throw new HttpError(400, 'target_user_id required')
    if (!targetOrgId || typeof targetOrgId !== 'string') throw new HttpError(400, 'target_org_id required')
    const reason = sanitizeString(body.reason ?? '', 1000)
    if (reason.length < 10) throw new HttpError(400, 'reason must be at least 10 characters describing why')
    const duration = Math.min(60, Math.max(1, body.duration_minutes ?? 30))

    // 3. Queue customer notification BEFORE any session is created.
    //    The notification table writes are atomic; a failure here means we
    //    refuse to issue the session.
    const notificationSentAt = new Date().toISOString()
    const { error: notifyErr } = await adminClient
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'impersonation_started',
        title: 'A SiteSync support engineer signed into your account',
        body: `${user.email ?? 'Support'} started a session at ${notificationSentAt}. Reason: "${reason.slice(0, 200)}"`,
        link: '/settings/security/impersonation-history',
      })

    if (notifyErr) {
      console.error('[start-impersonation] notify failed; refusing session:', notifyErr)
      throw new HttpError(503, 'Notification queue unavailable; session refused. This is by design.')
    }

    // 4. NOW open the session.
    const { data: sessionId, error: sessionErr } = await adminClient.rpc(
      'start_impersonation_session',
      {
        p_impersonator_id: user.id,
        p_target_user_id: targetUserId,
        p_target_org_id: targetOrgId,
        p_reason: reason,
        p_notification_sent_at: notificationSentAt,
        p_duration_minutes: duration,
        p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        p_user_agent: req.headers.get('user-agent') ?? null,
      },
    )

    if (sessionErr || !sessionId) {
      console.error('[start-impersonation] RPC failed:', sessionErr)
      throw new HttpError(500, sessionErr?.message ?? 'Failed to open session')
    }

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        expires_at: new Date(Date.now() + duration * 60_000).toISOString(),
      }),
      { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
