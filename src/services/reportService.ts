// Owner Report service layer.
// Compiles project data into the owner/OAC meeting report shape.
// Narrative generation calls the AI edge function; everything else is pure data assembly.

import { supabase } from '../lib/supabase'

// ── Types ────────────────────────────────────────────────

export interface OwnerReportData {
  projectName: string
  projectAddress: string
  reportDate: string
  overallStatus: string
  percentComplete: number

  // Schedule
  scheduleSummary: ScheduleSummary
  // Budget
  budgetSummary: BudgetSummary
  // Risk flags
  riskFlags: RiskFlag[]
  // Photos
  progressPhotos: ProgressPhoto[]
  // 3-week lookahead
  lookahead: LookaheadItem[]
  // Milestones for timeline
  milestones: MilestoneItem[]
  // AI narrative
  narrative: string
}

export interface ScheduleSummary {
  daysAheadBehind: number
  totalPhases: number
  completedPhases: number
  inProgressPhases: number
  criticalPathItems: CriticalPathItem[]
}

export interface CriticalPathItem {
  name: string
  endDate: string
  status: string
  percentComplete: number
}

export interface BudgetSummary {
  originalContract: number
  approvedChanges: number
  currentContract: number
  committed: number
  spent: number
  forecast: number
  changeOrders: ChangeOrderSummary[]
}

export interface ChangeOrderSummary {
  number: string
  description: string
  amount: number
  status: string
}

export interface RiskFlag {
  type: 'rfi' | 'submittal' | 'schedule' | 'budget' | 'subcontractor'
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

export interface ProgressPhoto {
  id: string
  url: string
  caption: string
  capturedAt: string
  location: string
}

export interface LookaheadItem {
  name: string
  startDate: string
  endDate: string
  status: string
  riskLevel: 'green' | 'yellow' | 'red'
  blockers: string[]
}

export interface MilestoneItem {
  name: string
  date: string
  status: 'complete' | 'on_track' | 'at_risk' | 'behind'
  percentComplete: number
}

// ── Helper ───────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Generate Owner Report ────────────────────────────────

export async function generateOwnerReport(projectId: string): Promise<OwnerReportData> {
  // Fetch all data in parallel
  const [
    projectRes,
    phasesRes,
    budgetRes,
    changeOrdersRes,
    rfisRes,
    submittalsRes,
    photosRes,
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('schedule_phases').select('*').eq('project_id', projectId).order('start_date', { ascending: true }),
    supabase.from('budget_items').select('*').eq('project_id', projectId),
    supabase.from('change_orders').select('*').eq('project_id', projectId),
    supabase.from('rfis').select('*').eq('project_id', projectId),
    supabase.from('submittals').select('*').eq('project_id', projectId),
    supabase.from('field_captures').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
  ])

  const project = projectRes.data as Record<string, unknown> | null
  const phases = (phasesRes.data ?? []) as Record<string, unknown>[]
  const budget = (budgetRes.data ?? []) as Record<string, unknown>[]
  const changeOrders = (changeOrdersRes.data ?? []) as Record<string, unknown>[]
  const rfis = (rfisRes.data ?? []) as Record<string, unknown>[]
  const submittals = (submittalsRes.data ?? []) as Record<string, unknown>[]
  const photos = (photosRes.data ?? []) as Record<string, unknown>[]

  const now = new Date()
  const threeWeeksOut = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)

  // ── Schedule Summary ───────────────────────────────────
  const completedPhases = phases.filter((p) => p.status === 'complete')
  const inProgressPhases = phases.filter((p) => p.status === 'in_progress')
  const behindPhases = phases.filter((p) => {
    if (p.status === 'complete') return false
    const end = p.end_date ? new Date(p.end_date as string) : null
    return end && end < now
  })

  const daysAheadBehind = behindPhases.length > 0
    ? -Math.round(behindPhases.reduce((sum, p) => {
        const end = new Date(p.end_date as string)
        return sum + daysBetween(end, now)
      }, 0) / behindPhases.length)
    : completedPhases.length > 0 ? 2 : 0

  const criticalPathItems = phases
    .filter((p) => p.status !== 'complete')
    .sort((a, b) => {
      const aEnd = a.end_date ? new Date(a.end_date as string).getTime() : Infinity
      const bEnd = b.end_date ? new Date(b.end_date as string).getTime() : Infinity
      return aEnd - bEnd
    })
    .slice(0, 5)
    .map((p) => ({
      name: (p.name as string) ?? '',
      endDate: fmtDate(p.end_date as string),
      status: (p.status as string) ?? 'not_started',
      percentComplete: (p.percent_complete as number) ?? 0,
    }))

  const scheduleSummary: ScheduleSummary = {
    daysAheadBehind,
    totalPhases: phases.length,
    completedPhases: completedPhases.length,
    inProgressPhases: inProgressPhases.length,
    criticalPathItems,
  }

  // ── Budget Summary ─────────────────────────────────────
  const originalContract = budget.reduce((s, b) => s + ((b.original_amount as number) ?? 0), 0)
  const approvedChanges = changeOrders
    .filter((c) => c.status === 'approved')
    .reduce((s, c) => s + ((c.amount as number) ?? 0), 0)
  const currentContract = originalContract + approvedChanges
  const committed = budget.reduce((s, b) => s + ((b.committed_amount as number) ?? 0), 0)
  const spent = budget.reduce((s, b) => s + ((b.actual_amount as number) ?? 0), 0)
  const forecast = currentContract > 0 && spent > 0
    ? currentContract * (1 + (spent / committed - 1) * 0.5 || 0)
    : currentContract

  const budgetSummary: BudgetSummary = {
    originalContract,
    approvedChanges,
    currentContract,
    committed,
    spent,
    forecast,
    changeOrders: changeOrders.map((co) => ({
      number: `CO-${String((co.number as number) ?? '').toString().padStart(3, '0')}`,
      description: (co.title as string) ?? (co.description as string) ?? '',
      amount: (co.amount as number) ?? 0,
      status: (co.status as string) ?? 'draft',
    })),
  }

  // ── Risk Flags ─────────────────────────────────────────
  const riskFlags: RiskFlag[] = []

  // Overdue RFIs
  const overdueRfis = rfis.filter((r) => {
    const due = r.due_date ? new Date(r.due_date as string) : null
    return due && due < now && r.status !== 'closed' && r.status !== 'answered'
  })
  if (overdueRfis.length > 0) {
    riskFlags.push({
      type: 'rfi',
      severity: overdueRfis.length >= 3 ? 'critical' : 'warning',
      title: `${overdueRfis.length} Overdue RFI${overdueRfis.length > 1 ? 's' : ''}`,
      detail: `RFI${overdueRfis.length > 1 ? 's' : ''} ${overdueRfis.slice(0, 3).map((r) => `#${(r.rfi_number as number) ?? (r.number as number) ?? ''}`).join(', ')} past due date`,
    })
  }

  // Stalled submittals
  const stalledSubmittals = submittals.filter((s) => {
    const created = s.created_at ? new Date(s.created_at as string) : null
    return created && daysBetween(created, now) > 14 && s.status !== 'approved' && s.status !== 'closed'
  })
  if (stalledSubmittals.length > 0) {
    riskFlags.push({
      type: 'submittal',
      severity: stalledSubmittals.length >= 3 ? 'critical' : 'warning',
      title: `${stalledSubmittals.length} Stalled Submittal${stalledSubmittals.length > 1 ? 's' : ''}`,
      detail: `Submittals pending review for more than 14 days`,
    })
  }

  // Behind schedule phases
  if (behindPhases.length > 0) {
    riskFlags.push({
      type: 'schedule',
      severity: behindPhases.length >= 3 ? 'critical' : 'warning',
      title: `${behindPhases.length} Phase${behindPhases.length > 1 ? 's' : ''} Behind Schedule`,
      detail: behindPhases.slice(0, 3).map((p) => (p.name as string) ?? '').join(', '),
    })
  }

  // Budget overrun risk
  if (spent > 0 && originalContract > 0 && spent / originalContract > 0.9) {
    riskFlags.push({
      type: 'budget',
      severity: spent / originalContract > 1 ? 'critical' : 'warning',
      title: 'Budget Near Limit',
      detail: `${Math.round((spent / originalContract) * 100)}% of original contract spent`,
    })
  }

  // ── Progress Photos ────────────────────────────────────
  const progressPhotos: ProgressPhoto[] = photos.slice(0, 10).map((p) => ({
    id: (p.id as string) ?? '',
    url: (p.photo_url as string) ?? (p.file_url as string) ?? '',
    caption: (p.notes as string) ?? (p.description as string) ?? '',
    capturedAt: fmtDate(p.captured_at as string ?? p.created_at as string),
    location: (p.location as string) ?? '',
  }))

  // ── 3-Week Lookahead ──────────────────────────────────
  const lookahead: LookaheadItem[] = phases
    .filter((p) => {
      const start = p.start_date ? new Date(p.start_date as string) : null
      return start && start <= threeWeeksOut && p.status !== 'complete'
    })
    .slice(0, 12)
    .map((p) => {
      const end = p.end_date ? new Date(p.end_date as string) : null
      const hasOverdueRfi = overdueRfis.some((r) =>
        (r.title as string)?.toLowerCase().includes(((p.name as string) ?? '').toLowerCase().split(' ')[0])
      )
      const isBehind = end ? end < now : false
      const riskLevel = isBehind || hasOverdueRfi ? 'red' as const : end && daysBetween(now, end) < 7 ? 'yellow' as const : 'green' as const

      const blockers: string[] = []
      if (hasOverdueRfi) blockers.push('Blocked by overdue RFI')
      if (isBehind) blockers.push('Past due date')

      return {
        name: (p.name as string) ?? '',
        startDate: fmtDate(p.start_date as string),
        endDate: fmtDate(p.end_date as string),
        status: (p.status as string) ?? 'not_started',
        riskLevel,
        blockers,
      }
    })

  // ── Milestones ─────────────────────────────────────────
  const milestones: MilestoneItem[] = phases
    .filter((p) => p.end_date)
    .map((p) => {
      const end = p.end_date ? new Date(p.end_date as string) : null
      const pct = (p.percent_complete as number) ?? 0
      let status: MilestoneItem['status'] = 'on_track'
      if (p.status === 'complete') status = 'complete'
      else if (end && end < now) status = 'behind'
      else if (pct > 0 && pct < 50 && end && daysBetween(now, end) < 14) status = 'at_risk'
      return {
        name: (p.name as string) ?? '',
        date: fmtDate(p.end_date as string),
        status,
        percentComplete: pct,
      }
    })

  // ── Narrative ──────────────────────────────────────────
  const narrative = await generateNarrative({
    projectName: (project?.name as string) ?? 'Project',
    percentComplete: (project?.percent_complete as number) ?? 0,
    daysAheadBehind,
    openRfis: rfis.filter((r) => r.status === 'open' || r.status === 'under_review').length,
    overdueRfis: overdueRfis.length,
    originalContract,
    spent,
    changeOrderCount: changeOrders.length,
    behindPhaseCount: behindPhases.length,
    riskFlags,
  })

  return {
    projectName: (project?.name as string) ?? 'Project',
    projectAddress: (project?.address as string) ?? '',
    reportDate: fmtDate(now.toISOString()),
    overallStatus: (project?.health_status as string) ?? 'on_track',
    percentComplete: (project?.percent_complete as number) ?? 0,
    scheduleSummary,
    budgetSummary,
    riskFlags,
    progressPhotos,
    lookahead,
    milestones,
    narrative,
  }
}

// ── AI Narrative Generation ──────────────────────────────

interface NarrativeInput {
  projectName: string
  percentComplete: number
  daysAheadBehind: number
  openRfis: number
  overdueRfis: number
  originalContract: number
  spent: number
  changeOrderCount: number
  behindPhaseCount: number
  riskFlags: RiskFlag[]
}

export async function generateNarrative(input: NarrativeInput): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-narrative', {
      body: input,
    })
    if (!error && data?.narrative) {
      return data.narrative as string
    }
  } catch {
    // Fall back to template-based narrative
  }

  return buildTemplateNarrative(input)
}

function buildTemplateNarrative(input: NarrativeInput): string {
  const {
    projectName, percentComplete, daysAheadBehind,
    openRfis, overdueRfis, originalContract, spent,
    changeOrderCount, behindPhaseCount, riskFlags,
  } = input

  const scheduleStatus = daysAheadBehind >= 0
    ? `${daysAheadBehind} day${daysAheadBehind !== 1 ? 's' : ''} ahead of schedule`
    : `${Math.abs(daysAheadBehind)} day${Math.abs(daysAheadBehind) !== 1 ? 's' : ''} behind schedule`

  const budgetPct = originalContract > 0 ? Math.round((spent / originalContract) * 100) : 0

  const parts: string[] = []
  parts.push(`${projectName} is ${percentComplete}% complete and currently ${scheduleStatus}.`)

  if (openRfis > 0 || overdueRfis > 0) {
    const rfiNote = overdueRfis > 0
      ? `There are ${openRfis} open RFIs, ${overdueRfis} of which are overdue and require immediate attention.`
      : `There are ${openRfis} open RFIs, all within their response window.`
    parts.push(rfiNote)
  }

  parts.push(`Budget utilization is at ${budgetPct}% of the original contract value ($${(originalContract / 1_000_000).toFixed(1)}M), with ${changeOrderCount} change order${changeOrderCount !== 1 ? 's' : ''} processed to date.`)

  if (behindPhaseCount > 0) {
    parts.push(`${behindPhaseCount} schedule phase${behindPhaseCount !== 1 ? 's are' : ' is'} currently behind their planned completion date.`)
  }

  const criticalRisks = riskFlags.filter((r) => r.severity === 'critical')
  if (criticalRisks.length > 0) {
    parts.push(`Critical items requiring owner attention: ${criticalRisks.map((r) => r.title.toLowerCase()).join('; ')}.`)
  }

  return parts.join(' ')
}

// ── Progress Photos ──────────────────────────────────────

export async function getProgressPhotos(
  projectId: string,
  dateRange?: { start: Date; end: Date },
): Promise<ProgressPhoto[]> {
  let query = supabase
    .from('field_captures')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
  }

  const { data } = await query.limit(20)
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: (p.id as string) ?? '',
    url: (p.photo_url as string) ?? (p.file_url as string) ?? '',
    caption: (p.notes as string) ?? (p.description as string) ?? '',
    capturedAt: fmtDate((p.captured_at as string) ?? (p.created_at as string)),
    location: (p.location as string) ?? '',
  }))
}

// ── PDF Export (placeholder) ─────────────────────────────

export async function exportPDF(_reportData: OwnerReportData): Promise<Blob> {
  // Placeholder: in production this would use @react-pdf/renderer
  // to generate a polished PDF from the report data.
  // For now, returns an empty blob — the UI will show "Export PDF" button
  // and call this when the PDF pipeline is wired up.
  return new Blob(['Owner Report PDF — generation coming soon'], { type: 'application/pdf' })
}
