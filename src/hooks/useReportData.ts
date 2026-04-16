// Report data assembly layer.
// Combines TanStack Query hooks into report-ready data shapes.
// Each report type has a dedicated assembler that maps DB entities to report props.

import {
  useRFIs,
  useSubmittals,
  usePunchItems,
  useTasks,
  useDailyLogs,
  useBudgetItems,
  useChangeOrders,
  useSchedulePhases,
  useProject,
} from './queries'
import { useProjectId } from './useProjectId'

// ── Types ────────────────────────────────────────────────

export type ReportType =
  | 'owner_report'
  | 'executive_summary'
  | 'monthly_progress'
  | 'cost_report'
  | 'schedule_report'
  | 'subcontractor_performance'
  | 'rfi_log'
  | 'submittal_log'
  | 'punch_list'
  | 'daily_log_summary'
  | 'safety_report'
  | 'budget_report'

export interface ReportConfig {
  type: ReportType
  label: string
  description: string
  estimatedPages: string
}

export const REPORT_TYPES: ReportConfig[] = [
  { type: 'owner_report', label: 'Owner Report', description: 'AI-generated progress narrative, schedule and budget dashboards, risk flags, photo comparison, 3-week lookahead', estimatedPages: '3-6' },
  { type: 'executive_summary', label: 'Executive Summary', description: 'Project health, milestones, budget, risks', estimatedPages: '1-2' },
  { type: 'monthly_progress', label: 'Monthly Progress', description: 'Progress by phase, financials, schedule, safety', estimatedPages: '5-10' },
  { type: 'cost_report', label: 'Cost Report', description: 'Budget vs actual, earned value analysis, contingency burn', estimatedPages: '3-6' },
  { type: 'schedule_report', label: 'Schedule Report', description: 'Critical path, lookahead, milestones, delay analysis', estimatedPages: '3-5' },
  { type: 'subcontractor_performance', label: 'Subcontractor Performance', description: 'RFI response, submittal rejection, punch closure by sub', estimatedPages: '2-4' },
  { type: 'rfi_log', label: 'RFI Log', description: 'All RFIs with status, dates, response', estimatedPages: '2-5' },
  { type: 'submittal_log', label: 'Submittal Log', description: 'All submittals with review chain, dates', estimatedPages: '2-5' },
  { type: 'punch_list', label: 'Punch List', description: 'Open items, location, responsible party', estimatedPages: '2-8' },
  { type: 'daily_log_summary', label: 'Daily Log Summary', description: 'Crew hours, weather, incidents by date', estimatedPages: '3-6' },
  { type: 'safety_report', label: 'Safety Report', description: 'TRIR, incidents, inspections, corrective actions', estimatedPages: '2-4' },
  { type: 'budget_report', label: 'Budget Report', description: 'Cost breakdown by division, change orders', estimatedPages: '3-5' },
]

// ── Helpers ──────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRFINumber(n: number | null | undefined, id?: string): string {
  if (n) return `RFI-${String(n).padStart(3, '0')}`
  return id?.slice(0, 8) || ''
}

function fmtSubmittalNumber(n: number | null | undefined, id?: string): string {
  if (n) return `SUB-${String(n).padStart(3, '0')}`
  return id?.slice(0, 8) || ''
}

// ── Data Assembly Hooks ──────────────────────────────────

export function useExecutiveSummaryData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const rfis = useRFIs(projectId)
  const submittals = useSubmittals(projectId)
  const punchItems = usePunchItems(projectId)
  const budgetItems = useBudgetItems(projectId)
  const schedulePhases = useSchedulePhases(projectId)

  const loading = project.isLoading || rfis.isLoading || submittals.isLoading || punchItems.isLoading || budgetItems.isLoading
  const error = project.error || rfis.error || submittals.error

  if (loading || error || !project.data) return { data: null, loading, error }

  const rfiList = rfis.data ?? []
  const submittalList = submittals.data ?? []
  const punchList = punchItems.data ?? []
  const budget = budgetItems.data ?? []
  const phases = schedulePhases.data ?? []

  const budgetTotal = budget.reduce((s, b) => s + (b.original_amount ?? 0), 0)
  const budgetSpent = budget.reduce((s, b) => s + (b.actual_amount ?? 0), 0)
  const budgetVariance = budgetTotal > 0 ? ((budgetTotal - budgetSpent) / budgetTotal) * 100 : 0

  const openRfis = rfiList.filter((r) => r.status === 'open' || r.status === 'under_review').length
  const openSubmittals = submittalList.filter((s) => s.status !== 'approved' && s.status !== 'closed').length
  const openPunchItems = punchList.filter((p) => p.status !== 'verified').length

  const milestones = phases.slice(0, 8).map((p) => ({
    name: p.name ?? 'Unnamed Phase',
    status: p.status ?? 'in_progress',
    date: fmtDate(p.end_date ?? p.start_date),
  }))

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      overallStatus: ((project.data as Record<string, unknown>).health_status as string) ?? 'on_track',
      progress: ((project.data as Record<string, unknown>).percent_complete as number) ?? 62,
      budgetTotal,
      budgetSpent,
      budgetVariance,
      milestones,
      risks: [],
      lookahead: phases.filter((p) => p.status === 'not_started').slice(0, 5).map((p) => ({
        activity: p.name ?? '',
        start: fmtDate(p.start_date),
        end: fmtDate(p.end_date),
      })),
      openRfis,
      openSubmittals,
      openPunchItems,
      safetyIncidents: 0,
      daysWithoutIncident: 30,
    },
    loading: false,
    error: null,
  }
}

export function useRFILogData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const rfis = useRFIs(projectId)

  const loading = project.isLoading || rfis.isLoading
  const error = project.error || rfis.error

  if (loading || error || !project.data) return { data: null, loading, error }

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      rfis: (rfis.data ?? []).map((r) => ({
        number: fmtRFINumber(r.rfi_number ?? r.number, r.id),
        title: r.title ?? '',
        priority: r.priority ?? 'medium',
        status: r.status ?? 'open',
        from: r.created_by ?? '',
        assignedTo: r.assigned_to ?? '',
        dueDate: fmtDate(r.due_date),
        createdAt: fmtDate(r.created_at),
      })),
    },
    loading: false,
    error: null,
  }
}

export function useSubmittalLogData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const submittals = useSubmittals(projectId)

  const loading = project.isLoading || submittals.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      submittals: (submittals.data ?? []).map((s) => ({
        number: fmtSubmittalNumber(s.submittal_number ?? s.number, s.id),
        title: s.title ?? '',
        specSection: s.spec_section ?? '',
        subcontractor: s.subcontractor ?? s.created_by ?? '',
        status: s.status ?? 'draft',
        revision: String(s.revision_number ?? 1),
        leadTime: s.lead_time_weeks ? `${s.lead_time_weeks}w` : '',
        dueDate: fmtDate(s.due_date),
      })),
    },
    loading: false,
    error: null,
  }
}

export function usePunchListData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const punchItems = usePunchItems(projectId)

  const loading = project.isLoading || punchItems.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      items: (punchItems.data ?? []).map((p) => ({
        number: String(p.number ?? p.id?.slice(0, 6)),
        area: p.area ?? p.location ?? '',
        description: p.title ?? p.description ?? '',
        assignedTo: p.assigned_to ?? '',
        priority: p.priority ?? 'medium',
        status: p.status ?? 'open',
        dueDate: fmtDate(p.due_date),
      })),
    },
    loading: false,
    error: null,
  }
}

export function useBudgetReportData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const budgetItems = useBudgetItems(projectId)
  const changeOrders = useChangeOrders(projectId)

  const loading = project.isLoading || budgetItems.isLoading || changeOrders.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  const budget = budgetItems.data ?? []
  const cos = changeOrders.data ?? []

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      budgetTotal: budget.reduce((s, b) => s + (b.original_amount ?? 0), 0),
      budgetSpent: budget.reduce((s, b) => s + (b.actual_amount ?? 0), 0),
      budgetCommitted: budget.reduce((s, b) => s + (b.committed_amount ?? 0), 0),
      divisions: budget.map((b) => ({
        division: b.division ?? 'General',
        budget: b.original_amount ?? 0,
        spent: b.actual_amount ?? 0,
        committed: b.committed_amount ?? 0,
        percentComplete: b.percent_complete ?? 0,
      })),
      changeOrders: cos.map((co) => ({
        number: `CO-${String(co.number ?? '').padStart(3, '0')}`,
        description: co.title ?? co.description ?? '',
        amount: co.amount ?? 0,
        status: co.status ?? 'draft',
      })),
    },
    loading: false,
    error: null,
  }
}

export function useDailyLogSummaryData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const dailyLogs = useDailyLogs(projectId)

  const loading = project.isLoading || dailyLogs.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  const logs = dailyLogs.data ?? []

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      entries: logs.map((log) => ({
        date: fmtDate(log.log_date ?? log.created_at),
        workers: log.workers_onsite ?? 0,
        manHours: log.total_hours ?? 0,
        incidents: log.incidents ?? 0,
        weather: log.weather ?? '',
        summary: log.summary ?? '',
      })),
      totalManHours: logs.reduce((s, l) => s + (l.total_hours ?? 0), 0),
      avgWorkers: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + (l.workers_onsite ?? 0), 0) / logs.length) : 0,
      totalIncidents: logs.reduce((s, l) => s + (l.incidents ?? 0), 0),
    },
    loading: false,
    error: null,
  }
}

export function useMonthlyProgressData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const rfis = useRFIs(projectId)
  const submittals = useSubmittals(projectId)
  const budgetItems = useBudgetItems(projectId)
  const changeOrders = useChangeOrders(projectId)
  const schedulePhases = useSchedulePhases(projectId)
  const dailyLogs = useDailyLogs(projectId)

  const loading = project.isLoading || rfis.isLoading || submittals.isLoading || budgetItems.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  const budget = budgetItems.data ?? []
  const cos = changeOrders.data ?? []
  const phases = schedulePhases.data ?? []
  const rfiList = rfis.data ?? []
  const subList = submittals.data ?? []
  const logs = dailyLogs.data ?? []

  const originalContract = budget.reduce((s, b) => s + (b.original_amount ?? 0), 0)
  const coNet = cos.filter((c) => c.status === 'approved').reduce((s, c) => s + (c.amount ?? 0), 0)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      periodStart: fmtDate(monthStart.toISOString()),
      periodEnd: fmtDate(now.toISOString()),
      scheduledProgress: 65,
      actualProgress: ((project.data as Record<string, unknown>).percent_complete as number) ?? 62,
      milestonesAchieved: phases.filter((p) => p.status === 'complete').slice(0, 5).map((p) => ({
        name: p.name ?? '', date: fmtDate(p.end_date),
      })),
      milestonesUpcoming: phases.filter((p) => p.status === 'not_started' || p.status === 'in_progress').slice(0, 5).map((p) => ({
        name: p.name ?? '', date: fmtDate(p.start_date),
      })),
      originalContract,
      changeOrdersNet: coNet,
      currentContract: originalContract + coNet,
      billedToDate: budget.reduce((s, b) => s + (b.actual_amount ?? 0), 0),
      costToDate: budget.reduce((s, b) => s + (b.actual_amount ?? 0), 0),
      manpowerByTrade: [],
      totalManHours: logs.reduce((s, l) => s + (l.total_hours ?? 0), 0),
      avgDailyWorkers: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + (l.workers_onsite ?? 0), 0) / logs.length) : 0,
      incidentsThisPeriod: 0,
      nearMissesThisPeriod: 0,
      safetyInspections: 0,
      trir: 0,
      rfisOpened: rfiList.filter((r) => r.created_at && new Date(r.created_at) >= monthStart).length,
      rfisClosed: rfiList.filter((r) => r.status === 'closed' || r.status === 'answered').length,
      rfisOverdue: rfiList.filter((r) => r.due_date && new Date(r.due_date) < now && r.status !== 'closed').length,
      submittalsSubmitted: subList.filter((s) => s.status !== 'draft').length,
      submittalsApproved: subList.filter((s) => s.status === 'approved').length,
      submittalsRejected: subList.filter((s) => s.status === 'rejected').length,
      changeOrders: cos.map((co) => ({
        number: `CO-${String(co.number ?? '').padStart(3, '0')}`,
        description: co.title ?? co.description ?? '',
        amount: co.amount ?? 0,
        status: co.status ?? 'draft',
      })),
      workPerformed: phases.filter((p) => p.status === 'in_progress').slice(0, 10).map((p) => ({
        area: p.name ?? '',
        description: '',
        percentComplete: p.percent_complete ?? 50,
      })),
    },
    loading: false,
    error: null,
  }
}

// ── Cost Report with Earned Value Analysis ──────────────

export function useCostReportData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const budgetItems = useBudgetItems(projectId)
  const changeOrders = useChangeOrders(projectId)
  const schedulePhases = useSchedulePhases(projectId)

  const loading = project.isLoading || budgetItems.isLoading || changeOrders.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  const budget = budgetItems.data ?? []
  const cos = changeOrders.data ?? []
  const phases = schedulePhases.data ?? []

  const originalBudget = budget.reduce((s, b) => s + (b.original_amount ?? 0), 0)
  const approvedChanges = cos.filter((c) => c.status === 'approved').reduce((s, c) => s + (c.amount ?? 0), 0)
  const currentBudget = originalBudget + approvedChanges
  const actualCost = budget.reduce((s, b) => s + (b.actual_amount ?? 0), 0)
  const committedCost = budget.reduce((s, b) => s + (b.committed_amount ?? 0), 0)

  // Schedule % (from phases)
  const totalPhases = phases.length || 1
  const completedPhases = phases.filter((p) => p.status === 'complete').length
  const scheduledPct = totalPhases > 0 ? completedPhases / totalPhases : 0
  const projectRecord = project.data as Record<string, unknown>
  const rawPctComplete = projectRecord.percent_complete as number | undefined
  const actualPct = rawPctComplete ? rawPctComplete / 100 : scheduledPct

  // Earned Value calculations
  const bac = currentBudget // Budget at Completion
  const ev = bac * actualPct // Earned Value = BAC * % complete
  const pv = bac * scheduledPct // Planned Value = BAC * scheduled %
  const ac = actualCost // Actual Cost

  const cpi = ac > 0 ? ev / ac : 1 // Cost Performance Index
  const spi = pv > 0 ? ev / pv : 1 // Schedule Performance Index
  const eac = cpi > 0 ? bac / cpi : bac // Estimate at Completion
  const etc = eac - ac // Estimate to Complete
  const vac = bac - eac // Variance at Completion
  const cv = ev - ac // Cost Variance
  const sv = ev - pv // Schedule Variance

  // Contingency tracking
  const contingencyBudget = budget.filter((b) => (b.division ?? '').toLowerCase().includes('contingency')).reduce((s, b) => s + (b.original_amount ?? 0), 0)
  const contingencyUsed = budget.filter((b) => (b.division ?? '').toLowerCase().includes('contingency')).reduce((s, b) => s + (b.actual_amount ?? 0), 0)

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      originalBudget,
      approvedChanges,
      currentBudget,
      actualCost,
      committedCost,
      forecastCost: eac,
      // Earned Value
      bac, ev, pv, ac, cpi, spi, eac, etc, vac, cv, sv,
      // Cost codes
      costCodes: budget.map((b) => ({
        code: b.cost_code ?? b.division ?? 'General',
        description: b.description ?? '',
        budget: b.original_amount ?? 0,
        actual: b.actual_amount ?? 0,
        committed: b.committed_amount ?? 0,
        variance: (b.original_amount ?? 0) - (b.actual_amount ?? 0),
        percentSpent: (b.original_amount ?? 0) > 0 ? ((b.actual_amount ?? 0) / (b.original_amount ?? 0)) * 100 : 0,
      })),
      changeOrders: cos.map((co) => ({
        number: `CO-${String(co.number ?? '').padStart(3, '0')}`,
        description: co.title ?? co.description ?? '',
        amount: co.amount ?? 0,
        status: co.status ?? 'draft',
        date: fmtDate(co.created_at),
      })),
      contingencyBudget,
      contingencyUsed,
      contingencyRemaining: contingencyBudget - contingencyUsed,
      contingencyBurnRate: contingencyBudget > 0 ? (contingencyUsed / contingencyBudget) * 100 : 0,
    },
    loading: false,
    error: null,
  }
}

// ── Schedule Report with Delay Analysis ─────────────────

export function useScheduleReportData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const phases = useSchedulePhases(projectId)
  const tasks = useTasks(projectId)

  const loading = project.isLoading || phases.isLoading || tasks.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  const phaseList = phases.data ?? []
  const taskList = tasks.data ?? []
  const now = new Date()
  const threeWeeksOut = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

  // Critical path: phases that are not complete and have tight timelines
  const criticalPath = phaseList
    .filter((p) => p.status !== 'complete')
    .sort((a, b) => {
      const aEnd = a.end_date ? new Date(a.end_date).getTime() : Infinity
      const bEnd = b.end_date ? new Date(b.end_date).getTime() : Infinity
      return aEnd - bEnd
    })
    .slice(0, 15)
    .map((p) => ({
      name: p.name ?? '',
      startDate: fmtDate(p.start_date),
      endDate: fmtDate(p.end_date),
      status: p.status ?? 'not_started',
      percentComplete: p.percent_complete ?? 0,
      isCritical: true,
      totalFloat: 0,
    }))

  // 3-week lookahead
  const lookahead = phaseList
    .filter((p) => {
      const start = p.start_date ? new Date(p.start_date) : null
      return start && start <= threeWeeksOut && p.status !== 'complete'
    })
    .slice(0, 20)
    .map((p) => ({
      name: p.name ?? '',
      startDate: fmtDate(p.start_date),
      endDate: fmtDate(p.end_date),
      status: p.status ?? 'not_started',
      assignedTo: ((p as Record<string, unknown>).assigned_to as string) ?? '',
    }))

  // Milestones
  const milestones = phaseList
    .filter((p) => (p as Record<string, unknown>).is_milestone || p.status === 'complete')
    .slice(0, 15)
    .map((p) => {
      const planned = p.end_date ? new Date(p.end_date) : null
      const phaseRecord = p as Record<string, unknown>
      const actualEndDate = phaseRecord.actual_end_date as string | null | undefined
      const actual = p.status === 'complete' ? actualEndDate ? new Date(actualEndDate) : planned : null
      const variance = planned && actual ? Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24)) : 0
      return {
        name: p.name ?? '',
        plannedDate: fmtDate(p.end_date),
        actualDate: actual ? fmtDate(actual.toISOString()) : '',
        status: p.status === 'complete' ? 'achieved' : (planned && planned < now ? 'late' : 'upcoming'),
        varianceDays: variance,
      }
    })

  // Delay analysis: tasks/phases that are behind schedule
  const delays = phaseList
    .filter((p) => {
      if (p.status === 'complete') return false
      const end = p.end_date ? new Date(p.end_date) : null
      return end && end < now
    })
    .map((p) => {
      const end = new Date(p.end_date!)
      const daysLate = Math.round((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24))
      return {
        activity: p.name ?? '',
        plannedFinish: fmtDate(p.end_date),
        daysLate,
        causeCode: ((p as Record<string, unknown>).delay_cause as string) ?? 'TBD',
        responsibleParty: ((p as Record<string, unknown>).assigned_to as string) ?? 'TBD',
        impact: daysLate > 14 ? 'Critical' : daysLate > 7 ? 'Major' : 'Minor',
      }
    })
    .sort((a, b) => b.daysLate - a.daysLate)

  // Summary
  const totalActivities = phaseList.length
  const completedActivities = phaseList.filter((p) => p.status === 'complete').length
  const behindSchedule = delays.length
  const overallProgress = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      overallProgress,
      totalActivities,
      completedActivities,
      behindSchedule,
      criticalPath,
      lookahead,
      milestones,
      delays,
    },
    loading: false,
    error: null,
  }
}

// ── Subcontractor Performance Report ────────────────────

export function useSubcontractorPerformanceData() {
  const projectId = useProjectId()
  const project = useProject(projectId)
  const rfis = useRFIs(projectId)
  const submittals = useSubmittals(projectId)
  const punchItems = usePunchItems(projectId)

  const loading = project.isLoading || rfis.isLoading || submittals.isLoading || punchItems.isLoading
  if (loading || !project.data) return { data: null, loading, error: null }

  const rfiList = rfis.data ?? []
  const subList = submittals.data ?? []
  const punchList = punchItems.data ?? []

  // Aggregate by subcontractor/assignee
  const subMap = new Map<string, {
    name: string
    rfiCount: number
    rfiResponseDays: number[]
    submittalCount: number
    submittalRejections: number
    punchCount: number
    punchClosed: number
  }>()

  function getSub(name: string) {
    if (!name) return null
    if (!subMap.has(name)) {
      subMap.set(name, { name, rfiCount: 0, rfiResponseDays: [], submittalCount: 0, submittalRejections: 0, punchCount: 0, punchClosed: 0 })
    }
    return subMap.get(name)!
  }

  // RFI response times by assignee
  for (const rfi of rfiList) {
    const sub = getSub(rfi.assigned_to ?? '')
    if (!sub) continue
    sub.rfiCount++
    if (rfi.status === 'answered' || rfi.status === 'closed') {
      const created = rfi.created_at ? new Date(rfi.created_at) : null
      const answered = rfi.updated_at ? new Date(rfi.updated_at) : null
      if (created && answered) {
        const days = Math.round((answered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        sub.rfiResponseDays.push(days)
      }
    }
  }

  // Submittal rejection rates by subcontractor
  for (const s of subList) {
    const subName = s.subcontractor ?? s.created_by ?? ''
    const sub = getSub(subName)
    if (!sub) continue
    sub.submittalCount++
    if (s.status === 'rejected' || s.status === 'resubmit') {
      sub.submittalRejections++
    }
  }

  // Punch item closure by assignee
  for (const p of punchList) {
    const sub = getSub(p.assigned_to ?? '')
    if (!sub) continue
    sub.punchCount++
    if (p.status === 'resolved' || p.status === 'verified') {
      sub.punchClosed++
    }
  }

  const subcontractors = Array.from(subMap.values())
    .filter((s) => s.name)
    .map((s) => ({
      name: s.name,
      rfiCount: s.rfiCount,
      avgRFIResponseDays: s.rfiResponseDays.length > 0
        ? Math.round(s.rfiResponseDays.reduce((a, b) => a + b, 0) / s.rfiResponseDays.length)
        : null,
      submittalCount: s.submittalCount,
      submittalRejectionRate: s.submittalCount > 0
        ? Math.round((s.submittalRejections / s.submittalCount) * 100)
        : 0,
      punchCount: s.punchCount,
      punchClosureRate: s.punchCount > 0
        ? Math.round((s.punchClosed / s.punchCount) * 100)
        : 0,
    }))
    .sort((a, b) => b.rfiCount + b.submittalCount + b.punchCount - (a.rfiCount + a.submittalCount + a.punchCount))

  return {
    data: {
      projectName: project.data.name ?? 'Project',
      subcontractors,
      totalSubs: subcontractors.length,
      avgRFIResponseDays: subcontractors.filter((s) => s.avgRFIResponseDays !== null).length > 0
        ? Math.round(subcontractors.filter((s) => s.avgRFIResponseDays !== null).reduce((a, s) => a + (s.avgRFIResponseDays ?? 0), 0) / subcontractors.filter((s) => s.avgRFIResponseDays !== null).length)
        : 0,
      avgSubmittalRejectionRate: subcontractors.length > 0
        ? Math.round(subcontractors.reduce((a, s) => a + s.submittalRejectionRate, 0) / subcontractors.length)
        : 0,
      avgPunchClosureRate: subcontractors.length > 0
        ? Math.round(subcontractors.reduce((a, s) => a + s.punchClosureRate, 0) / subcontractors.length)
        : 0,
    },
    loading: false,
    error: null,
  }
}
