// admin-list-orgs — BRT subsystem 6 §4.4
//
// Internal-admin-only endpoint that returns the full org list with
// summary stats. Used by the AdminOrgList page.
//
// Auth: caller must have profiles.is_internal_admin=true. Service-role
// client is used to bypass RLS for the listing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed')
    }

    const { user } = await authenticateRequest(req)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Gate: is_internal_admin
    const { data: profile, error: pErr } = await adminClient
      .from('profiles')
      .select('is_internal_admin')
      .eq('user_id', user.id)
      .single()
    if (pErr) throw new HttpError(500, 'Could not verify admin status')
    if (!profile?.is_internal_admin) {
      throw new HttpError(403, 'Internal admin access required')
    }

    const { data: orgs, error: oErr } = await adminClient
      .from('organizations')
      .select('id, name, slug, plan, created_at, settings')
      .order('created_at', { ascending: false })
      .limit(500)
    if (oErr) throw new HttpError(500, oErr.message)

    return new Response(
      JSON.stringify({ ok: true, organizations: orgs ?? [] }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
