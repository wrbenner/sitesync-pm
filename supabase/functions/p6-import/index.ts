// p6-import: parses an uploaded Primavera P6 XER file, normalizes it
// to the SiteSync P6Schedule shape, and writes it onto the target
// project's schedule_phases / tasks tables.
//
// Auth: Supabase JWT required. Caller must be project member with
// schedule.edit permission.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  errorResponse,
  HttpError,
  parseJsonBody,
  handleCors,
  getCorsHeaders,
} from '../shared/auth.ts'

interface ImportRequest {
  project_id: string
  xer_content: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const auth = await authenticateRequest(req)
    const body = await parseJsonBody<ImportRequest>(req)
    if (!body.project_id) {
      throw new HttpError(400, 'project_id required')
    }
    if (!body.xer_content) {
      throw new HttpError(400, 'xer_content required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Project membership check.
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', body.project_id)
      .eq('user_id', auth.userId)
      .maybeSingle()
    if (!member) {
      throw new HttpError(403, 'Not a project member')
    }

    // Inline minimal XER parser (same logic as src/lib/integrations/p6Xer/parser.ts).
    const schedule = parseXerInline(body.xer_content)
    if (!schedule) {
      throw new HttpError(400, 'Failed to parse XER')
    }

    // Persist tasks. We treat each P6 task as a schedule_phase row
    // and tag the legacy_payload + external_ids for traceability.
    const phaseInserts = schedule.tasks.map((t) => ({
      project_id: body.project_id,
      name: t.name,
      start_date: t.earlyStart ?? schedule.project.plannedStart,
      end_date: t.earlyFinish ?? schedule.project.plannedFinish,
      percent_complete: t.percentComplete,
      external_ids: { p6_task_id: t.id, p6_code: t.code },
      legacy_payload: { p6: t },
    }))
    if (phaseInserts.length > 0) {
      const { error } = await supabase.from('schedule_phases').insert(phaseInserts)
      if (error) throw new HttpError(500, 'Failed to insert schedule phases: ' + error.message)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        project: schedule.project,
        tasks_imported: schedule.tasks.length,
        predecessors_seen: schedule.predecessors.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      },
    )
  } catch (e) {
    return errorResponse(e, getCorsHeaders(req))
  }
})

interface InlineSchedule {
  project: { id: string; name: string; plannedStart?: string; plannedFinish?: string }
  tasks: Array<{ id: string; code: string; name: string; percentComplete: number; earlyStart?: string; earlyFinish?: string }>
  predecessors: Array<{ taskId: string; predecessorId: string; type: string; lagDays: number }>
}

function parseXerInline(content: string): InlineSchedule | null {
  if (!content) return null
  const lines = content.split(/\r?\n/)
  type Tbl = { name: string; fields: string[]; rows: string[][] }
  const tables = new Map<string, Tbl>()
  let cur: Tbl | null = null
  for (const raw of lines) {
    if (!raw) continue
    if (raw.startsWith('%T')) {
      const name = raw.slice(2).trim().split(/\s+/)[0]
      cur = { name, fields: [], rows: [] }
      tables.set(name, cur)
    } else if (raw.startsWith('%F')) {
      if (!cur) continue
      cur.fields = stripPrefix(raw, '%F').split('\t').map((s) => s.trim()).filter(Boolean)
    } else if (raw.startsWith('%R')) {
      if (!cur) continue
      const cells = stripPrefix(raw, '%R').split('\t')
      while (cells.length > cur.fields.length) cells.pop()
      while (cells.length < cur.fields.length) cells.push('')
      cur.rows.push(cells)
    } else if (raw.startsWith('%E')) {
      break
    }
  }
  const projTbl = tables.get('PROJECT')
  if (!projTbl || projTbl.rows.length === 0) return null
  const projObj = rowToObj(projTbl, 0)
  const taskTbl = tables.get('TASK')
  const tasks: InlineSchedule['tasks'] = !taskTbl ? [] : taskTbl.rows.map((_r, i) => {
    const o = rowToObj(taskTbl, i)
    return {
      id: o.task_id ?? '',
      code: o.task_code ?? '',
      name: o.task_name ?? '',
      percentComplete: numberOrZero(o.phys_complete_pct),
      earlyStart: o.early_start_date || undefined,
      earlyFinish: o.early_end_date || undefined,
    }
  })
  const predTbl = tables.get('TASKPRED')
  const predecessors: InlineSchedule['predecessors'] = !predTbl ? [] : predTbl.rows.map((_r, i) => {
    const o = rowToObj(predTbl, i)
    return {
      taskId: o.task_id ?? '',
      predecessorId: o.pred_task_id ?? '',
      type: (o.pred_type ?? 'PR_FS').replace(/^PR_/, ''),
      lagDays: numberOrZero(o.lag_hr_cnt) / 8,
    }
  })
  return {
    project: {
      id: projObj.proj_id ?? '',
      name: projObj.proj_short_name ?? projObj.proj_name ?? 'Unnamed',
      plannedStart: projObj.plan_start_date || undefined,
      plannedFinish: projObj.plan_end_date || undefined,
    },
    tasks,
    predecessors,
  }
}

function stripPrefix(line: string, marker: string): string {
  const r = line.slice(marker.length)
  if (r.startsWith('\t') || r.startsWith(' ')) return r.slice(1)
  return r
}

function rowToObj(t: { fields: string[]; rows: string[][] }, idx: number): Record<string, string> {
  const out: Record<string, string> = {}
  const row = t.rows[idx] ?? []
  for (let i = 0; i < t.fields.length; i++) out[t.fields[i]] = row[i] ?? ''
  return out
}

function numberOrZero(s: string | undefined): number {
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
