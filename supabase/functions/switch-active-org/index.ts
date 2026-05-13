// switch-active-org — BRT subsystem 1 §4.3
//
// Switches the caller's active org. Validates membership server-side via
// the set_active_org() SQL function (which is SECURITY DEFINER + checks
// organization_members), then returns 200 on success. The client refreshes
// its session after this call so the JWT picks up the new `org_id` claim
// (injected by the custom_access_token_hook).
//
// Request:
//   POST /functions/v1/switch-active-org
//   Authorization: Bearer <user JWT>
//   { "target_org_id": "uuid" }
//
// Response (200): { "ok": true, "org_id": "uuid" }
// Errors:
//   401 — missing/invalid auth
//   403 — caller is not a member of target_org_id
//   400 — missing/invalid target_org_id

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface SwitchRequest {
  target_org_id: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')

    const { user } = await authenticateRequest(req)
    const body = await parseJsonBody<SwitchRequest>(req)

    if (typeof body.target_org_id !== 'string' || !UUID_RE.test(body.target_org_id)) {
      throw new HttpError(400, 'target_org_id must be a valid UUID')
    }

    // Service-role client so the membership check + write happens in one
    // SECURITY DEFINER call. The SQL fn itself enforces auth.uid() membership.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      },
    )

    const { data, error } = await adminClient.rpc('set_active_org', {
      p_target_org_id: body.target_org_id,
    })

    if (error) {
      const msg = error.message || ''
      if (msg.includes('not a member') || error.code === '42501') {
        throw new HttpError(403, 'You are not a member of that organization')
      }
      console.error('set_active_org RPC failed:', error)
      throw new HttpError(500, 'Failed to switch active organization')
    }

    return new Response(
      JSON.stringify({ ok: true, org_id: data, user_id: user.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
