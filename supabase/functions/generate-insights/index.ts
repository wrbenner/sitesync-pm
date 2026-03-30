import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  authenticateCron,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

// ── Risk Assessment Algorithms (server side) ─────────────────

function assessTaskRisk(task: any, predecessors: any[]): { riskLevel: string; riskScore: number; factors: string[] } {
  let score = 0
  const factors: string[] = []
  const now = new Date()

  // Progress vs elapsed time
  if (task.start_date && task.due_date) {
    const start = new Date(task.start_date).getTime()
    const end = new Date(task.due_date).getTime()
    const totalDuration = end - start
    const elapsed = now.getTime() - start
    const elapsedRatio = totalDuration > 0 ? Math.min(1, elapsed / totalDuration) : 0
    const progressRatio = (task.percent_complete || 0) / 100
    if (elapsedRatio > 0.3 && progressRatio < elapsedRatio * 0.5) {
      score += 30
      factors.push(`Progress ${Math.round(progressRatio * 100)}% vs ${Math.round(elapsedRatio * 100)}% time elapsed`)
    } else if (elapsedRatio > 0.5 && progressRatio < elapsedRatio * 0.7) {
      score += 15
      factors.push('Progress behind schedule pace')
    }
  }

  // Overdue
  if (task.due_date && new Date(task.due_date) < now && task.status !== 'done') {
    const daysOverdue = Math.ceil((now.getTime() - new Date(task.due_date).getTime()) / 86400000)
    score += Math.min(40, daysOverdue * 5)
    factors.push(`${daysOverdue} days overdue`)
  }

  // Predecessor status
  if (task.predecessor_ids?.length > 0) {
    const blockedPreds = predecessors.filter(p => task.predecessor_ids.includes(p.id) && p.status !== 'done')
    if (blockedPreds.length > 0) {
      score += blockedPreds.length * 10
      factors.push(`${blockedPreds.length} predecessor(s) incomplete`)
    }
  }

  // Critical path
  if (task.is_critical_path) {
    score += 10
    factors.push('Critical path task')
  }

  score = Math.min(100, score)
  const riskLevel = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low'

  return { riskLevel, riskScore: score, factors }
}

function computeEarnedValue(budgetItems: any[], avgProgress: number, elapsedPercent: number) {
  const BAC = budgetItems.reduce((s: number, b: any) => s + (b.original_amount || 0), 0)
  const AC = budgetItems.reduce((s: number, b: any) => s + (b.actual_amount || 0), 0)
  const PV = BAC * Math.min(1, elapsedPercent / 100)
  const EV = BAC * Math.min(1, avgProgress / 100)
  const CPI = AC > 0 ? EV / AC : 1
  const SPI = PV > 0 ? EV / PV : 1
  const EAC = CPI > 0 ? BAC / CPI : BAC * 1.5
  const VAC = BAC - EAC
  return { BAC, AC, PV, EV, CPI, SPI, EAC, VAC }
}

// Validate numeric values before saving
function safeNum(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    // SECURITY: CRON-only. Not callable by users.
    const supabase = authenticateCron(req)

    // Paginate projects (don't load all at once)
    const { data: projects } = await supabase
      .from('projects')
      .select('id, start_date, target_completion')
      .eq('status', 'active')
      .limit(100) // process 100 projects per invocation
    if (!projects) return new Response(JSON.stringify({ processed: 0 }), { headers: cors })

    let totalInsights = 0

    for (const project of projects) {
      const pid = project.id

      const [phasesRes, budgetRes, rfisRes, punchRes, crewsRes, dailyLogsRes, tasksRes, submittalsRes] = await Promise.all([
        supabase.from('schedule_phases').select('*').eq('project_id', pid),
        supabase.from('budget_items').select('*').eq('project_id', pid),
        supabase.from('rfis').select('*').eq('project_id', pid),
        supabase.from('punch_items').select('*').eq('project_id', pid),
        supabase.from('crews').select('*').eq('project_id', pid),
        supabase.from('daily_logs').select('*').eq('project_id', pid).order('log_date', { ascending: false }).limit(10),
        supabase.from('tasks').select('*').eq('project_id', pid),
        supabase.from('submittals').select('*').eq('project_id', pid),
      ])

      const phases = phasesRes.data || []
      const budget = budgetRes.data || []
      const rfis = rfisRes.data || []
      const punch = punchRes.data || []
      const crews = crewsRes.data || []
      const dailyLogs = dailyLogsRes.data || []
      const tasks = tasksRes.data || []
      const submittals = submittalsRes.data || []
      const now = new Date()
      const insights: Array<Record<string, unknown>> = []

      // ── 1. Schedule Risk: Task-level risk assessment ────────────
      const taskAssessments: Array<{ id: string; riskLevel: string; riskScore: number }> = []
      for (const task of tasks) {
        if (task.status === 'done') continue
        const assessment = assessTaskRisk(task, tasks)
        taskAssessments.push({ id: task.id, riskLevel: assessment.riskLevel, riskScore: assessment.riskScore })

        // Update task risk fields
        if (assessment.riskScore !== task.risk_score || assessment.riskLevel !== task.risk_level) {
          await supabase.from('tasks').update({ risk_score: assessment.riskScore, risk_level: assessment.riskLevel }).eq('id', task.id)
        }
      }

      const criticalTasks = taskAssessments.filter(t => t.riskLevel === 'critical')
      const highRiskTasks = taskAssessments.filter(t => t.riskLevel === 'high')
      if (criticalTasks.length > 0) {
        insights.push({
          project_id: pid, page: 'tasks', severity: 'critical', prediction_type: 'schedule_risk', category: 'schedule',
          message: `${criticalTasks.length} task${criticalTasks.length > 1 ? 's' : ''} at critical risk of delay`,
          expanded_content: `Critical risk tasks detected by schedule prediction algorithm. Review task dependencies and resource allocation immediately.`,
          action_label: 'Review Critical Tasks', action_link: '/tasks',
        })
      }
      if (highRiskTasks.length > 0) {
        insights.push({
          project_id: pid, page: 'tasks', severity: 'warning', prediction_type: 'schedule_risk', category: 'schedule',
          message: `${highRiskTasks.length} task${highRiskTasks.length > 1 ? 's' : ''} at high risk of delay`,
          expanded_content: `High risk tasks identified. Monitor closely and prepare contingency plans.`,
          action_label: 'Review At Risk Tasks', action_link: '/tasks',
        })
      }

      // ── 2. Budget Burn Rate / Earned Value ─────────────────────
      const avgProgress = phases.length > 0
        ? phases.reduce((s: number, p: any) => s + (p.percent_complete || 0), 0) / phases.length
        : 0
      let elapsedPercent = 50
      if (project.start_date && project.target_completion) {
        const start = new Date(project.start_date).getTime()
        const end = new Date(project.target_completion).getTime()
        const total = end - start
        elapsedPercent = total > 0 ? Math.min(100, ((now.getTime() - start) / total) * 100) : 50
      }

      const ev = computeEarnedValue(budget, avgProgress, elapsedPercent)

      if (ev.CPI < 0.90) {
        insights.push({
          project_id: pid, page: 'budget', severity: 'critical', prediction_type: 'budget_burn', category: 'budget',
          message: `CPI at ${ev.CPI.toFixed(2)}: project significantly over budget`,
          expanded_content: `Cost Performance Index of ${ev.CPI.toFixed(2)} means every $1 of work costs $${(1 / ev.CPI).toFixed(2)}. Projected overrun: $${Math.round(Math.abs(ev.VAC)).toLocaleString()}. Estimate at Completion: $${Math.round(ev.EAC).toLocaleString()}.`,
          action_label: 'Review Budget', action_link: '/budget', confidence: ev.CPI > 0.5 ? 0.85 : 0.6,
        })
      } else if (ev.CPI < 0.95) {
        insights.push({
          project_id: pid, page: 'budget', severity: 'warning', prediction_type: 'budget_burn', category: 'budget',
          message: `CPI at ${ev.CPI.toFixed(2)}: trending over budget`,
          expanded_content: `Cost performance below target. EAC: $${Math.round(ev.EAC).toLocaleString()}.`,
          action_label: 'Review Budget', action_link: '/budget', confidence: 0.75,
        })
      }

      if (ev.SPI < 0.85) {
        insights.push({
          project_id: pid, page: 'schedule', severity: 'critical', prediction_type: 'budget_burn', category: 'schedule',
          message: `SPI at ${ev.SPI.toFixed(2)}: project significantly behind schedule`,
          expanded_content: `Schedule Performance Index shows only ${Math.round(ev.SPI * 100)}% of planned value being earned. Recovery plan recommended.`,
          action_label: 'Review Schedule', action_link: '/schedule',
        })
      } else if (ev.SPI < 0.90) {
        insights.push({
          project_id: pid, page: 'schedule', severity: 'warning', prediction_type: 'budget_burn', category: 'schedule',
          message: `SPI at ${ev.SPI.toFixed(2)}: behind planned pace`,
          expanded_content: `Earning value at ${Math.round(ev.SPI * 100)}% of planned rate.`,
          action_label: 'Review Schedule', action_link: '/schedule',
        })
      }

      // ── 3. RFI Bottleneck Detection ────────────────────────────
      const reviewerMap = new Map<string, { overdue: number; total: number; responseTimes: number[]; longest: any }>()
      const allResponseTimes: number[] = []

      for (const rfi of rfis) {
        const reviewer = rfi.assigned_to || 'Unassigned'
        const entry = reviewerMap.get(reviewer) || { overdue: 0, total: 0, responseTimes: [], longest: null }
        const isOpen = rfi.status === 'open' || rfi.status === 'under_review'
        if (isOpen) entry.total++
        if (isOpen && rfi.due_date && new Date(rfi.due_date) < now) entry.overdue++
        if (rfi.responded_at && rfi.created_at) {
          const days = Math.ceil((new Date(rfi.responded_at).getTime() - new Date(rfi.created_at).getTime()) / 86400000)
          entry.responseTimes.push(days)
          allResponseTimes.push(days)
        }
        if (isOpen && rfi.created_at) {
          const daysOpen = Math.ceil((now.getTime() - new Date(rfi.created_at).getTime()) / 86400000)
          if (!entry.longest || daysOpen > entry.longest.daysOpen) {
            entry.longest = { title: rfi.title, daysOpen }
          }
        }
        reviewerMap.set(reviewer, entry)
      }

      const projectAvgResponse = allResponseTimes.length > 0
        ? Math.round(allResponseTimes.reduce((s, t) => s + t, 0) / allResponseTimes.length * 10) / 10
        : 5

      for (const [reviewer, data] of reviewerMap.entries()) {
        const avgResponse = data.responseTimes.length > 0
          ? Math.round(data.responseTimes.reduce((s, t) => s + t, 0) / data.responseTimes.length * 10) / 10
          : 0
        if (data.overdue >= 3 || (avgResponse > projectAvgResponse * 2 && data.total >= 2)) {
          insights.push({
            project_id: pid, page: 'rfis', severity: data.overdue >= 5 ? 'critical' : 'warning',
            prediction_type: 'rfi_bottleneck', category: 'quality',
            message: `Bottleneck: ${reviewer} has ${data.overdue} overdue RFIs. Average response: ${avgResponse} days (project avg: ${projectAvgResponse} days)`,
            expanded_content: data.longest
              ? `Longest open: "${data.longest.title}" (${data.longest.daysOpen} days). Total assigned: ${data.total}. Escalation recommended.`
              : `Total assigned: ${data.total}. Consider workload redistribution.`,
            action_label: 'View RFIs', action_link: '/rfis',
          })
        }
      }

      // Also detect RFIs under review for > 2x average
      for (const rfi of rfis) {
        if (rfi.status === 'under_review' && rfi.created_at) {
          const daysOpen = Math.ceil((now.getTime() - new Date(rfi.created_at).getTime()) / 86400000)
          if (daysOpen > projectAvgResponse * 2 && daysOpen > 10) {
            insights.push({
              project_id: pid, page: 'rfis', severity: 'warning',
              prediction_type: 'rfi_bottleneck', category: 'quality',
              entity_type: 'rfi', entity_id: rfi.id,
              message: `RFI "${rfi.title}" under review for ${daysOpen} days (${Math.round(daysOpen / projectAvgResponse)}x average)`,
              expanded_content: `Assigned to: ${rfi.assigned_to || 'Unknown'}. Average review time is ${projectAvgResponse} days. Consider escalation.`,
              action_label: 'View RFI', action_link: '/rfis',
            })
          }
        }
      }

      // ── 4. Submittal Deadline Risk ─────────────────────────────
      const avgReviewDays = 10
      const defaultLeadTime = 14

      for (const sub of submittals) {
        if (sub.status === 'approved' || sub.status === 'closed') continue
        const requiredDate = sub.required_on_site_date || sub.submit_by_date
        if (!requiredDate) continue

        const daysUntilRequired = Math.ceil((new Date(requiredDate).getTime() - now.getTime()) / 86400000)
        const leadTime = sub.lead_time_days || defaultLeadTime
        let estReview = avgReviewDays
        if (sub.status === 'under_review') estReview = Math.ceil(avgReviewDays * 0.5)
        else if (sub.status === 'resubmit') estReview = avgReviewDays + 5

        const totalNeeded = estReview + leadTime
        const gap = daysUntilRequired - totalNeeded

        if (gap < -14) {
          insights.push({
            project_id: pid, page: 'submittals', severity: 'critical',
            prediction_type: 'submittal_deadline', category: 'schedule',
            entity_type: 'submittal', entity_id: sub.id,
            message: `Submittal "${sub.title}" projected ${Math.abs(gap)} days late for required on site date`,
            expanded_content: `Required: ${requiredDate}. Estimated ${totalNeeded} days needed (${estReview}d review + ${leadTime}d lead time), but only ${Math.max(0, daysUntilRequired)} days remaining.`,
            action_label: 'Review Submittal', action_link: '/submittals',
          })
        } else if (gap < 0) {
          insights.push({
            project_id: pid, page: 'submittals', severity: 'warning',
            prediction_type: 'submittal_deadline', category: 'schedule',
            entity_type: 'submittal', entity_id: sub.id,
            message: `Submittal "${sub.title}" at risk of missing ${requiredDate} deadline`,
            expanded_content: `${totalNeeded} days needed, ${Math.max(0, daysUntilRequired)} days remaining. Expedite review process.`,
            action_label: 'Review Submittal', action_link: '/submittals',
          })
        }
      }

      // ── 5. Existing checks: punch items, crews, safety ─────────
      const openPunch = punch.filter((p: any) => p.status === 'open' || p.status === 'in_progress')
      if (openPunch.length > 20) {
        insights.push({
          project_id: pid, page: 'punchlist', severity: 'warning', prediction_type: 'quality', category: 'quality',
          message: `${openPunch.length} open punch items. Quality trend needs attention.`,
          expanded_content: 'High open count may indicate recurring quality issues.',
          action_label: 'Review Punch List', action_link: '/punch-list',
        })
      }

      const recentIncidents = dailyLogs.reduce((sum: number, log: any) => sum + (log.incidents || 0), 0)
      if (recentIncidents > 0) {
        insights.push({
          project_id: pid, page: 'dashboard', severity: recentIncidents > 2 ? 'critical' : 'warning',
          prediction_type: 'safety', category: 'safety',
          message: `${recentIncidents} safety incident${recentIncidents > 1 ? 's' : ''} in the last 10 days.`,
          expanded_content: 'Review incident reports and ensure corrective actions are in place.',
          action_label: 'Review Daily Logs', action_link: '/daily-log',
        })
      }

      // ── Clear and insert insights ──────────────────────────────
      if (insights.length > 0) {
        await supabase.from('ai_insights').delete().eq('project_id', pid).eq('dismissed', false)
        await supabase.from('ai_insights').insert(insights)
        totalInsights += insights.length
      }

      // ── Create project snapshot ────────────────────────────────
      const totalBudget = budget.reduce((s: number, b: any) => s + (b.original_amount || 0), 0)
      const totalSpent = budget.reduce((s: number, b: any) => s + (b.actual_amount || 0), 0)
      const activeCrews = crews.filter((c: any) => c.status === 'active').length
      const totalWorkers = crews.reduce((s: number, c: any) => s + (c.size || 0), 0)

      await supabase.from('project_snapshots').insert({
        project_id: pid,
        snapshot_date: now.toISOString().slice(0, 10),
        snapshot_type: 'daily',
        data: {
          progress: Math.round(avgProgress),
          budget_spent: totalSpent,
          budget_total: totalBudget,
          open_rfis: rfis.filter((r: any) => r.status === 'open' || r.status === 'under_review').length,
          crew_count: activeCrews,
          workers_on_site: totalWorkers,
          open_punch: openPunch.length,
          incidents: recentIncidents,
        },
        metrics: {
          cpi: safeNum(ev.CPI),
          spi: safeNum(ev.SPI),
          eac: safeNum(ev.EAC),
          vac: safeNum(ev.VAC),
          task_risk_critical: criticalTasks.length,
          task_risk_high: highRiskTasks.length,
          rfi_bottlenecks: Array.from(reviewerMap.entries()).filter(([_, d]) => d.overdue >= 3).length,
        },
        insights_summary: {
          total: insights.length,
          critical: insights.filter((i: any) => i.severity === 'critical').length,
          warning: insights.filter((i: any) => i.severity === 'warning').length,
        },
        key_events: insights.filter((i: any) => i.severity === 'critical').map((i: any) => ({ title: i.message, type: 'insight' })),
      })
    }

    return new Response(
      JSON.stringify({ processed: projects.length, insights: totalInsights }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})
