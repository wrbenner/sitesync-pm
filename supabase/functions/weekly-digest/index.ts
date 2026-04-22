
import {
  handleCors,
  getCorsHeaders,
  authenticateCron,
  escapeHtml,
  errorResponse,
} from '../shared/auth.ts'

const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    // SECURITY: CRON-only. Not callable by users.
    const supabase = authenticateCron(req)
    const resendKey = Deno.env.get('RESEND_API_KEY')

    // Paginate projects
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .limit(50)
    if (!projects) return new Response(JSON.stringify({ sent: 0 }), { headers: cors })

    let totalSent = 0
    const now = new Date()
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const today = now.toISOString().slice(0, 10)

    for (const project of projects) {
      const pid = project.id
      // SECURITY: HTML-escape project name to prevent XSS in emails
      const safeProjectName = escapeHtml(project.name || 'Project')

      const [rfis, tasks, budget, phases, dailyLogs, insights, changeOrders, lastWeekSnap] = await Promise.all([
        supabase.from('rfis').select('id, status, created_at').eq('project_id', pid),
        supabase.from('tasks').select('id, status, risk_level, due_date').eq('project_id', pid),
        supabase.from('budget_items').select('original_amount, actual_amount, percent_complete').eq('project_id', pid),
        supabase.from('schedule_phases').select('name, percent_complete, status, end_date').eq('project_id', pid),
        supabase.from('daily_logs').select('workers_onsite, total_hours, incidents, log_date').eq('project_id', pid).gte('log_date', oneWeekAgo),
        supabase.from('ai_insights').select('id, severity, message, prediction_type').eq('project_id', pid).eq('dismissed', false),
        supabase.from('change_orders').select('id, amount, status, type').eq('project_id', pid),
        supabase.from('project_snapshots').select('data').eq('project_id', pid).eq('snapshot_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).limit(1),
      ])

      const allRfis = rfis.data || []
      const allTasks = tasks.data || []
      const allBudget = budget.data || []
      const allPhases = phases.data || []
      const allLogs = dailyLogs.data || []
      const allInsights = insights.data || []
      const allCOs = changeOrders.data || []

      // Calculate metrics
      const openRfis = allRfis.filter((r: any) => r.status === 'open' || r.status === 'under_review').length
      const newRfis = allRfis.filter((r: any) => r.created_at >= oneWeekAgo).length
      const overdueTasks = allTasks.filter((t: any) => t.due_date && t.due_date < today && t.status !== 'done').length
      const criticalRiskTasks = allTasks.filter((t: any) => t.risk_level === 'critical').length
      const avgProgress = allPhases.length > 0
        ? Math.round(allPhases.reduce((s: number, p: any) => s + (p.percent_complete || 0), 0) / allPhases.length) : 0
      const totalBudget = allBudget.reduce((s: number, b: any) => s + (b.original_amount || 0), 0)
      const totalSpent = allBudget.reduce((s: number, b: any) => s + (b.actual_amount || 0), 0)
      const avgWorkers = allLogs.length > 0
        ? Math.round(allLogs.reduce((s: number, l: any) => s + (l.workers_onsite || 0), 0) / allLogs.length) : 0
      const totalHours = allLogs.reduce((s: number, l: any) => s + (l.total_hours || 0), 0)
      const totalIncidents = allLogs.reduce((s: number, l: any) => s + (l.incidents || 0), 0)
      const _pendingCOs = allCOs.filter((co: any) => !['approved', 'rejected', 'void'].includes(co.status)).reduce((s: number, co: any) => s + (co.amount || 0), 0)
      const criticalInsights = allInsights.filter((i: any) => i.severity === 'critical').length
      const warningInsights = allInsights.filter((i: any) => i.severity === 'warning').length

      const lastWeekData = (lastWeekSnap.data?.[0] as any)?.data
      const progressDelta = lastWeekData ? avgProgress - (lastWeekData.progress || 0) : 0
      const spentDelta = lastWeekData ? totalSpent - (lastWeekData.budget_spent || 0) : 0

      // Build safe digest text (all values escaped)
      const digestText = [
        `Weekly Project Health: ${safeProjectName}`,
        `Week of ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        '',
        `Progress: ${avgProgress}%${progressDelta !== 0 ? ` (${progressDelta > 0 ? '+' : ''}${progressDelta}% from last week)` : ''}`,
        `Budget: ${fmt(totalSpent)} of ${fmt(totalBudget)} (${totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0}%)`,
        `Workforce: ${avgWorkers} avg workers/day, ${totalHours.toLocaleString()} total hours`,
        `Safety: ${totalIncidents} incidents`,
        `RFIs: ${openRfis} open, ${newRfis} new`,
        `Tasks: ${overdueTasks} overdue, ${criticalRiskTasks} critical risk`,
        criticalInsights > 0 ? `Critical alerts: ${criticalInsights}` : '',
      ].filter(Boolean).join('\n')

      // Store weekly snapshot
      await supabase.from('project_snapshots').insert({
        project_id: pid,
        snapshot_date: today,
        snapshot_type: 'weekly',
        data: { progress: avgProgress, budget_spent: totalSpent, budget_total: totalBudget, open_rfis: openRfis, workers_avg: avgWorkers, incidents: totalIncidents },
        metrics: { progress_delta: progressDelta, spent_delta: spentDelta, critical_insights: criticalInsights },
        insights_summary: { digest: digestText, total: allInsights.length, critical: criticalInsights, warning: warningInsights },
      })

      // Send to project members (with notification preference check)
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id, role')
        .eq('project_id', pid)
      if (!members) continue

      for (const member of members) {
        // Check notification preferences (if prefs table exists)
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('weekly_digest')
          .eq('user_id', member.user_id)
          .single()
        // Default to sending if no preference set
        if (prefs && prefs.weekly_digest === false) continue

        const { data: userData } = await supabase.auth.admin.getUserById(member.user_id)
        if (!userData?.user?.email) continue

        // In-app notification (always)
        await supabase.from('notifications').insert({
          user_id: member.user_id,
          project_id: pid,
          type: 'weekly_digest',
          title: `Weekly digest: ${safeProjectName}`,
          body: `Progress: ${avgProgress}%.${criticalInsights > 0 ? ` ${criticalInsights} critical alerts.` : ''} ${openRfis} open RFIs. ${overdueTasks} overdue tasks.`,
          link: '/dashboard',
        })

        // Email (if Resend configured)
        if (resendKey) {
          // Build safe HTML email (all user content is escaped)
          const emailHtml = buildDigestEmail(safeProjectName, avgProgress, progressDelta, totalBudget, totalSpent, spentDelta, avgWorkers, totalHours, totalIncidents, openRfis, newRfis, overdueTasks, criticalRiskTasks, criticalInsights, warningInsights, allInsights)

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SiteSync PM <digest@sitesync.pm>',
              to: [userData.user.email],
              subject: `Weekly digest: ${safeProjectName} (${avgProgress}% complete)`,
              html: emailHtml,
            }),
          })
        }

        totalSent++
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})

// ── Email Template (all content pre-escaped) ─────────────

function buildDigestEmail(
  projectName: string, progress: number, progressDelta: number,
  totalBudget: number, totalSpent: number, spentDelta: number,
  avgWorkers: number, totalHours: number, totalIncidents: number,
  openRfis: number, newRfis: number, overdueTasks: number,
  criticalRiskTasks: number, criticalInsights: number, warningInsights: number,
  insights: any[],
): string {
  const criticalAlerts = insights
    .filter((i: any) => i.severity === 'critical')
    .slice(0, 3)
    .map((i: any) => `<li style="color:#C93B3B;margin-bottom:4px;">${escapeHtml(i.message)}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:'Inter',Arial,sans-serif;margin:0;padding:0;background:#F8F9FA;">
<div style="max-width:600px;margin:0 auto;padding:32px;">
  <div style="background:#0C0D0F;color:white;padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:20px;">Weekly Digest</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">${projectName}</p>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #E5E1DC;border-top:none;">
    <div style="display:flex;gap:16px;margin-bottom:20px;">
      <div style="flex:1;text-align:center;padding:12px;background:#F8F9FA;border-radius:8px;">
        <div style="font-size:24px;font-weight:700;">${progress}%</div>
        <div style="font-size:11px;color:#5C5550;">Progress${progressDelta ? ` (${progressDelta > 0 ? '+' : ''}${progressDelta}%)` : ''}</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#F8F9FA;border-radius:8px;">
        <div style="font-size:24px;font-weight:700;">${fmt(totalSpent)}</div>
        <div style="font-size:11px;color:#5C5550;">of ${fmt(totalBudget)}</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:${totalIncidents > 0 ? '#FEF2F2' : '#F8F9FA'};border-radius:8px;">
        <div style="font-size:24px;font-weight:700;color:${totalIncidents > 0 ? '#C93B3B' : '#2D8A6E'};">${totalIncidents}</div>
        <div style="font-size:11px;color:#5C5550;">Incidents</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:8px 0;color:#5C5550;">Open RFIs</td><td style="padding:8px 0;text-align:right;font-weight:600;">${openRfis} (${newRfis} new)</td></tr>
      <tr><td style="padding:8px 0;color:#5C5550;border-top:1px solid #F0EDE9;">Overdue Tasks</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #F0EDE9;color:${overdueTasks > 0 ? '#C93B3B' : '#1A1613'};">${overdueTasks}</td></tr>
      <tr><td style="padding:8px 0;color:#5C5550;border-top:1px solid #F0EDE9;">Critical Risk Tasks</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #F0EDE9;">${criticalRiskTasks}</td></tr>
      <tr><td style="padding:8px 0;color:#5C5550;border-top:1px solid #F0EDE9;">Workforce</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #F0EDE9;">${avgWorkers} avg/day, ${totalHours.toLocaleString()} hrs</td></tr>
    </table>
    ${criticalAlerts ? `<div style="margin-top:16px;padding:12px;background:rgba(201,59,59,0.06);border-radius:8px;border-left:3px solid #C93B3B;"><div style="font-size:12px;font-weight:600;color:#C93B3B;margin-bottom:8px;">Critical Alerts</div><ul style="margin:0;padding-left:16px;font-size:12px;">${criticalAlerts}</ul></div>` : ''}
    <div style="margin-top:20px;text-align:center;">
      <a href="https://app.sitesync.pm/#/dashboard" style="display:inline-block;padding:10px 24px;background:#F47820;color:white;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">View Dashboard</a>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#9A9490;margin-top:16px;">Sent by SiteSync PM. <a href="https://app.sitesync.pm/#/settings" style="color:#9A9490;">Manage preferences</a></p>
</div>
</body></html>`
}
