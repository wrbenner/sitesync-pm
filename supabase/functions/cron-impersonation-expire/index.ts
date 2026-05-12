// cron-impersonation-expire — BRT subsystem 6 §4.3
//
// Hourly cron that closes any impersonation_session whose expires_at has
// passed but whose ended_at is still NULL. Defends against a frontend
// crash that left a session "open" without the user clicking the
// End-impersonation button.
//
// Auth: cron-secret-gated.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'

interface ExpiredSession {
  id: string
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    authenticateCron(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: expired } = await supabase
      .from('impersonation_sessions')
      .select('id')
      .is('ended_at', null)
      .lt('expires_at', new Date().toISOString())

    let closed = 0
    let errors = 0
    for (const s of (expired ?? []) as ExpiredSession[]) {
      const { data, error } = await supabase.rpc('end_impersonation_session', {
        p_session_id: s.id,
        p_reason: 'auto_expired',
      })
      if (error) {
        errors++
        console.error(`[impersonation-expire] failed to close ${s.id}:`, error)
      } else if (data === true) {
        closed++
      }
    }

    return new Response(
      JSON.stringify({
        ran_at: new Date().toISOString(),
        scanned: expired?.length ?? 0,
        closed,
        errors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
