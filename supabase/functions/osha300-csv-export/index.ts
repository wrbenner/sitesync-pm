// =============================================================================
// osha300-csv-export — POST { project_id, year } → ITA-portal CSV
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders, parseJsonBody,
  HttpError, errorResponse, requireUuid, verifyProjectMembership,
} from '../shared/auth.ts'
import { buildForm300, buildForm300A, exportItaCsv } from '../shared/compliance/osha300/index.ts'

interface RequestBody { project_id: string; year: number; total_hours_worked?: number; average_employee_count?: number }

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { user, supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    requireUuid(body.project_id, 'project_id')
    if (!body.year) throw new HttpError(400, 'year required')

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await verifyProjectMembership(supabase, user.id, body.project_id)

    const yearStart = `${body.year}-01-01`
    const yearEnd = `${body.year}-12-31`
    const { data: incidents } = await supabase
      .from('incidents')
      .select('id, type, severity, date, location, description, injured_party_name, injured_party_company, injured_party_trade, osha_recordable')
      .eq('project_id', body.project_id)
      .gte('date', yearStart)
      .lte('date', yearEnd + 'T23:59:59Z')

    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', body.project_id)
      .single()

    const rows = buildForm300((incidents ?? []) as Parameters<typeof buildForm300>[0])
    const summary = buildForm300A(rows, {
      year: body.year,
      establishment: project?.name ?? '(unknown project)',
      totalHoursWorked: body.total_hours_worked ?? null,
      averageEmployeeCount: body.average_employee_count ?? null,
    })
    const csv = exportItaCsv(rows, summary)

    return new Response(
      JSON.stringify({ csv, summary, recordable_cases: rows.length }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
