// end-impersonation — BRT sub-6 §4.3
//
// Closes an impersonation session. Callable by:
//   - the impersonating admin (manual end)
//   - an automated cron when the session passes expires_at (scheduled cleanup)
//
// Idempotent: ending an already-ended session returns 200 with closed=false.

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

interface EndImpersonationRequest {
  session_id: string
  reason?: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')

    const { user } = await authenticateRequest(req)
    const body = await parseJsonBody<EndImpersonationRequest>(req)
    if (!body.session_id || typeof body.session_id !== 'string') {
      throw new HttpError(400, 'session_id required')
    }
    const reason = sanitizeString(body.reason ?? 'manual', 200)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Authorization: only the impersonator OR an internal admin can end it.
    const { data: session } = await adminClient
      .from('impersonation_sessions')
      .select('impersonator_user_id, ended_at')
      .eq('id', body.session_id)
      .single()

    type Sess = { impersonator_user_id: string; ended_at: string | null } | null
    const sess = session as Sess
    if (!sess) throw new HttpError(404, 'Session not found')

    if (sess.impersonator_user_id !== user.id) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('is_internal_admin')
        .eq('id', user.id)
        .single()
      if (!(profile as { is_internal_admin?: boolean } | null)?.is_internal_admin) {
        throw new HttpError(403, 'Not authorized to end this session')
      }
    }

    const { data: closed, error } = await adminClient.rpc('end_impersonation_session', {
      p_session_id: body.session_id,
      p_reason: reason,
    })

    if (error) {
      console.error('[end-impersonation] RPC failed:', error)
      throw new HttpError(500, error.message)
    }

    return new Response(
      JSON.stringify({ closed: closed === true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
