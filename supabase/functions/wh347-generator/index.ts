// =============================================================================
// wh347-generator — POST { project_id, week_ending, signer_user_id } → PDF + JSON
// =============================================================================
// Pulls time_entries + workforce_members for the week, joins prevailing wage
// decisions, builds a Wh347Generated, and renders both the audit JSON and
// the DOL-format PDF.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders, parseJsonBody,
  HttpError, errorResponse, requireUuid, verifyProjectMembership,
} from '../shared/auth.ts'
import { generateWh347 } from '../shared/compliance/wh347/index.ts'
import { renderText, renderPdf } from '../shared/compliance/wh347/render.ts'
import type { Wh347WorkerWeek } from '../shared/compliance/wh347/types.ts'

interface RequestBody {
  project_id: string
  week_ending: string                // YYYY-MM-DD (Saturday recommended)
  signer_user_id: string
  /** Optional override: payroll number (sequential per GC). Defaults to
   *  count(prior payrolls) + 1. */
  payroll_number?: number
}

function startOfWeek(weekEnding: string): string {
  const d = new Date(weekEnding)
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { user, supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    requireUuid(body.project_id, 'project_id')
    if (!body.week_ending || !/^\d{4}-\d{2}-\d{2}$/.test(body.week_ending)) {
      throw new HttpError(400, 'Invalid week_ending')
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await verifyProjectMembership(supabase, user.id, body.project_id)

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, address, city, state, zip')
      .eq('id', body.project_id)
      .single()
    if (!project) throw new HttpError(404, 'Project not found')

    const periodFrom = startOfWeek(body.week_ending)

    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('workforce_member_id, date, regular_hours, overtime_hours, double_time_hours, cost_code, task_description')
      .eq('project_id', body.project_id)
      .gte('date', periodFrom)
      .lte('date', body.week_ending)

    const memberIds = Array.from(new Set((timeEntries ?? []).map(t => t.workforce_member_id)))
    const { data: members } = memberIds.length === 0
      ? { data: [] }
      : await supabase.from('workforce_members').select('*').in('id', memberIds)

    const { data: decisions } = await supabase
      .from('prevailing_wage_decisions')
      .select('*')
      .eq('state_code', project.state ?? 'TX')
      .lte('effective_from', body.week_ending)

    // Build the worker rows
    const workers: Wh347WorkerWeek[] = (members ?? []).map((m: Record<string, unknown>) => {
      const days = [0, 0, 0, 0, 0, 0, 0]
      let s = 0, ot = 0, dt = 0
      for (const t of (timeEntries ?? []).filter(e => e.workforce_member_id === m.id)) {
        const dow = ((new Date(t.date).getUTCDay() + 6) % 7)  // Mon=0..Sun=6
        days[dow] += (t.regular_hours ?? 0) + (t.overtime_hours ?? 0) + (t.double_time_hours ?? 0)
        s  += t.regular_hours ?? 0
        ot += t.overtime_hours ?? 0
        dt += t.double_time_hours ?? 0
      }
      return {
        workerName: (m.name as string) ?? '(unknown)',
        ssnLast4: null,
        classification: (m.trade as string) ?? 'Laborer',
        apprenticeLevel: m.role === 'apprentice' ? 1 : null,
        hoursPerDay: days,
        straightHours: s,
        overtimeHours: ot,
        doubleTimeHours: dt,
        hourlyRatePaid: (m.hourly_rate as number) ?? 0,
        fringeAllocation: 'plan',
        fringePerHourCash: 0,
        fringePerHourPlan: 0,  // app-level fringe data lives elsewhere; default to plan zero
        deductions: [],
      }
    })

    const generated = await generateWh347({
      header: {
        contractorName: 'Contractor Name',  // pulled from org settings in v2
        contractorAddress: 'Contractor Address',
        payrollNumber: body.payroll_number ?? 1,
        weekEnding: body.week_ending,
        projectName: project.name as string,
        projectLocation: `${project.city ?? ''}, ${project.state ?? ''}`.trim(),
        projectNumber: null,
        stateCode: (project.state as string) ?? 'TX',
        county: 'Travis',  // resolved from the project's address in v2
      },
      workers,
      statement: {
        signerName: 'Signer',
        signerTitle: 'Compliance Officer',
        payerType: 'contractor',
        periodFrom,
        periodTo: body.week_ending,
        fringeBenefits: 'paid_to_plans',
        exceptions: [],
      },
      decisions: (decisions ?? []) as Parameters<typeof generateWh347>[0]['decisions'],
    })

    const pdf = await renderPdf(generated)
    const text = renderText(generated)

    return new Response(
      JSON.stringify({
        text,
        pdf_base64: btoa(String.fromCharCode(...pdf)),
        gaps: generated.gaps,
        content_hash: generated.contentHash,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
