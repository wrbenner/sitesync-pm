// rls-policy-drift — BRT subsystem 1 §4.4
//
// Nightly cron that asks the DB whether any org_id-bearing table is missing
// SELECT/INSERT/UPDATE/DELETE policies. If yes, posts a P0 page to the
// SLACK_PAGE_WEBHOOK channel — this is the I1 cross-tenant safety
// invariant in cron form.
//
// Auth: cron-secret-gated.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'
import { postSlackAlert } from '../_shared/slackAlert.ts'

interface UnprotectedRow {
  table_name: string
  rls_enabled: boolean
  policy_count: number
  missing_cmds: string | null
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

    const { data: rows, error } = await supabase.rpc('find_unprotected_tables')
    if (error) {
      throw new HttpError(502, `find_unprotected_tables failed: ${error.message}`)
    }

    const unprotected = (rows ?? []) as UnprotectedRow[]
    const ranAt = new Date().toISOString()

    if (unprotected.length > 0) {
      const summary = unprotected
        .slice(0, 10)
        .map((u) => `• \`${u.table_name}\`: missing ${u.missing_cmds ?? 'unknown'}`)
        .join('\n')

      const more = unprotected.length > 10 ? `\n…and ${unprotected.length - 10} more.` : ''

      await postSlackAlert({
        severity: 'page',
        title: `I1 cross-tenant invariant: ${unprotected.length} unprotected table${unprotected.length === 1 ? '' : 's'}`,
        body:
`The following \`organization_id\`-bearing tables lack one or more required RLS policies. \
This is the ship-stopper invariant from BRT_INDEX §3 — investigate immediately.

${summary}${more}

Run \`npx tsx scripts/rls-matrix-audit.ts --check\` locally to reproduce + diff against baseline.`,
      })
    }

    return new Response(
      JSON.stringify({
        ran_at: ranAt,
        unprotected_count: unprotected.length,
        sample: unprotected.slice(0, 3),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
