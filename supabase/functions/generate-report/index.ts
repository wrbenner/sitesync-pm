// Scheduled Report Generation Edge Function
// Called by pg_cron to process due report schedules.
// Generates report data, stores as PDF in Supabase Storage, emails to recipients.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, handleCors, getCorsHeaders, errorResponse } from '../shared/auth.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const cors = getCorsHeaders(req)

  try {
    const supabase = authenticateCron(req)

    // Find all due schedules
    const { data: dueSchedules, error: fetchError } = await supabase
      .from('report_schedules')
      .select(`
        id, frequency, day_of_week, day_of_month, time_utc, recipients, project_id, run_count,
        template:template_id (id, name, report_type, config, format)
      `)
      .eq('active', true)
      .lte('next_run_at', new Date().toISOString())
      .limit(20) // Process batch of 20 per invocation

    if (fetchError) throw fetchError
    if (!dueSchedules || dueSchedules.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    let processed = 0
    let errors = 0

    for (const schedule of dueSchedules) {
      const template = schedule.template as Record<string, unknown> | null
      if (!template) continue

      const reportType = template.report_type as string
      const format = (template.format as string) || 'pdf'
      const templateName = (template.name as string) || reportType

      try {
        // Create run record
        const { data: run, error: runError } = await supabase
          .from('report_runs')
          .insert({
            template_id: template.id,
            schedule_id: schedule.id,
            project_id: schedule.project_id,
            report_type: reportType,
            format,
            status: 'generating',
          })
          .select('id')
          .single()

        if (runError) throw runError

        // Fetch report data based on type
        const reportData = await fetchReportData(supabase, schedule.project_id, reportType)

        // For PDF generation: in production, this would use a headless browser or
        // a PDF generation service. For now, we store the data as JSON and let
        // the client render the PDF on demand.
        const storagePath = `reports/${schedule.project_id}/${run.id}.json`

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(storagePath, JSON.stringify({
            type: reportType,
            format,
            generatedAt: new Date().toISOString(),
            data: reportData,
          }), {
            contentType: 'application/json',
            upsert: true,
          })

        if (uploadError) throw uploadError

        // Update run as completed
        await supabase.from('report_runs').update({
          status: 'completed',
          storage_path: storagePath,
        }).eq('id', run.id)

        // Send email notifications to recipients
        if (schedule.recipients && (schedule.recipients as string[]).length > 0) {
          await sendReportEmail(
            schedule.recipients as string[],
            templateName,
            schedule.project_id,
            run.id,
          )
        }

        // Advance schedule to next_run_at
        await supabase.from('report_schedules').update({
          last_run_at: new Date().toISOString(),
          run_count: (schedule.run_count ?? 0) + 1,
          last_error: null,
          // next_run_at is auto-calculated by trigger
          frequency: schedule.frequency, // Trigger recalculation
        }).eq('id', schedule.id)

        processed++
      } catch (err) {
        errors++
        // Mark schedule with error but keep it active
        await supabase.from('report_schedules').update({
          last_error: (err as Error).message,
        }).eq('id', schedule.id)
      }
    }

    return new Response(
      JSON.stringify({ processed, errors, total: dueSchedules.length }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})

// ── Data Fetching ───────────────────────────────────────

async function fetchReportData(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  reportType: string,
): Promise<Record<string, unknown>> {
  const { data: project } = await supabase
    .from('projects')
    .select('name, percent_complete, health_status')
    .eq('id', projectId)
    .single()

  const projectName = project?.name ?? 'Project'

  switch (reportType) {
    case 'executive_summary': {
      const [rfis, submittals, punchItems, budgetItems, phases] = await Promise.all([
        supabase.from('rfis').select('*').eq('project_id', projectId),
        supabase.from('submittals').select('*').eq('project_id', projectId),
        supabase.from('punch_items').select('*').eq('project_id', projectId),
        supabase.from('budget_items').select('*').eq('project_id', projectId),
        supabase.from('schedule_phases').select('*').eq('project_id', projectId),
      ])
      return {
        projectName,
        rfis: rfis.data?.length ?? 0,
        submittals: submittals.data?.length ?? 0,
        punchItems: punchItems.data?.length ?? 0,
        budgetItems: budgetItems.data ?? [],
        phases: phases.data ?? [],
      }
    }
    case 'rfi_log': {
      const { data } = await supabase.from('rfis').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      return { projectName, rfis: data ?? [] }
    }
    case 'submittal_log': {
      const { data } = await supabase.from('submittals').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      return { projectName, submittals: data ?? [] }
    }
    case 'budget_report':
    case 'cost_report': {
      const [items, cos] = await Promise.all([
        supabase.from('budget_items').select('*').eq('project_id', projectId),
        supabase.from('change_orders').select('*').eq('project_id', projectId),
      ])
      return { projectName, budgetItems: items.data ?? [], changeOrders: cos.data ?? [] }
    }
    case 'schedule_report': {
      const { data } = await supabase.from('schedule_phases').select('*').eq('project_id', projectId).order('start_date')
      return { projectName, phases: data ?? [] }
    }
    default:
      return { projectName }
  }
}

// ── Email Notification ──────────────────────────────────

async function sendReportEmail(
  recipients: string[],
  reportName: string,
  projectId: string,
  runId: string,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return

  const appUrl = Deno.env.get('APP_URL') || 'https://app.sitesync.pm'

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="border-bottom: 2px solid #F47820; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1A1613; margin: 0;">SiteSync PM</h2>
      </div>
      <h3 style="color: #1A1613; margin: 0 0 8px;">Your Scheduled Report is Ready</h3>
      <p style="color: #5C5550; font-size: 14px; margin: 0 0 16px;">
        The <strong>${reportName}</strong> report has been generated and is ready for review.
      </p>
      <a href="${appUrl}/#/reports?run=${runId}" style="display: inline-block; padding: 10px 24px; background-color: #F47820; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
        View Report
      </a>
      <p style="color: #9A9490; font-size: 12px; margin: 24px 0 0; border-top: 1px solid #E5E1DC; padding-top: 12px;">
        You are receiving this because you are subscribed to scheduled reports. Manage your subscriptions in SiteSync PM settings.
      </p>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SiteSync PM <reports@sitesync.pm>',
      to: recipients,
      subject: `Report Ready: ${reportName}`,
      html,
    }),
  })
}
