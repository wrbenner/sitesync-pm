// p6-export: serializes the SiteSync schedule for a given project
// back into a P6 XER file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  errorResponse,
  HttpError,
  handleCors,
  getCorsHeaders,
} from '../shared/auth.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const auth = await authenticateRequest(req)
    const url = new URL(req.url)
    const projectId = url.searchParams.get('project_id')
    if (!projectId) {
      throw new HttpError(400, 'project_id query param required')
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!member) throw new HttpError(403, 'Not a project member')

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, start_date, end_date')
      .eq('id', projectId)
      .single()
    const { data: phases } = await supabase
      .from('schedule_phases')
      .select('id, name, start_date, end_date, percent_complete, external_ids')
      .eq('project_id', projectId)

    const xer = emitXer({
      project,
      phases: phases ?? [],
    })
    return new Response(xer, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${project?.name ?? 'project'}.xer"`,
        ...getCorsHeaders(req),
      },
    })
  } catch (e) {
    return errorResponse(e, getCorsHeaders(req))
  }
})

function emitXer(input: {
  project: { id: string; name: string; start_date?: string; end_date?: string } | null
  phases: Array<{ id: string; name: string; start_date?: string; end_date?: string; percent_complete?: number; external_ids?: Record<string, unknown> }>
}): string {
  const lines: string[] = []
  lines.push('ERMHDR\t8.0\t' + new Date().toISOString().slice(0, 10))
  lines.push('%T\tPROJECT')
  lines.push('%F\tproj_id\tproj_short_name\tplan_start_date\tplan_end_date')
  lines.push('%R\t' + [
    input.project?.id ?? '',
    input.project?.name ?? '',
    input.project?.start_date ?? '',
    input.project?.end_date ?? '',
  ].join('\t'))
  lines.push('%T\tTASK')
  lines.push('%F\ttask_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\tphys_complete_pct\tearly_start_date\tearly_end_date')
  for (const p of input.phases) {
    const code = (p.external_ids?.p6_code as string | undefined) ?? p.id
    lines.push('%R\t' + [
      p.id,
      code,
      p.name,
      '0',
      String(p.percent_complete ?? 0),
      p.start_date ?? '',
      p.end_date ?? '',
    ].join('\t'))
  }
  lines.push('%E')
  return lines.join('\n')
}
