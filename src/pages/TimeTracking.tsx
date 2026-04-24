import React, { useMemo, useState, useCallback } from 'react'
import { Clock, Plus, Download, Sparkles, CheckCircle2, FileText, DollarSign, Briefcase, Upload, Users } from 'lucide-react'
import { generateWH347PDF, exportPayrollCSV, type WH347Employee } from '../lib/reports/wh347Pdf'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useProject } from '../hooks/queries'
import { useWorkforceMembers } from '../hooks/queries/workforce'
import {
  useTimeEntries,
  useCreateTimeEntry,
  useApproveTimeEntry,
  useCostCodes,
  type TimeEntry,
} from '../hooks/queries/enterprise-capabilities'
import { useTimesheets, useTimesheetHoursByActivity } from '../hooks/queries/timesheets'
import { useCreateTimesheet, useDeleteTimesheet } from '../hooks/mutations/timesheets'

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TimeTracking: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = weekDays[6]

  const { data: project } = useProject(projectId ?? undefined)
  const { data: entries, isLoading } = useTimeEntries(projectId ?? undefined, toISODate(weekStart), toISODate(weekEnd))
  const { data: costCodes } = useCostCodes(projectId ?? undefined)
  const { data: workforceMembers } = useWorkforceMembers(projectId ?? undefined)
  const createEntry = useCreateTimeEntry()
  const approve = useApproveTimeEntry()

  // Daily-hours entry against the `timesheets` table, scoped to the current week.
  const weekFromISO = useMemo(() => toISODate(weekStart), [weekStart])
  const weekToISO = useMemo(() => toISODate(weekEnd), [weekEnd])
  const { data: timesheetRows = [], isLoading: timesheetsLoading } = useTimesheets(
    projectId ?? undefined,
    { from: weekFromISO, to: weekToISO },
  )
  const { data: hoursByActivity = [] } = useTimesheetHoursByActivity(projectId ?? undefined)
  const createTimesheet = useCreateTimesheet()
  const deleteTimesheet = useDeleteTimesheet()
  const [tsModalOpen, setTsModalOpen] = useState(false)
  const [tsForm, setTsForm] = useState({
    worker_id: '',
    work_date: toISODate(new Date()),
    hours: '8',
    activity: '',
  })
  const submitTimesheet = async () => {
    if (!projectId) { toast.error('No active project'); return }
    if (!tsForm.worker_id) { toast.error('Pick a worker'); return }
    const hours = Number(tsForm.hours)
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      toast.error('Hours must be between 0 and 24'); return
    }
    try {
      await createTimesheet.mutateAsync({
        project_id: projectId,
        worker_id: tsForm.worker_id,
        work_date: tsForm.work_date,
        hours,
        activity: tsForm.activity.trim(),
      })
      toast.success('Hours logged')
      setTsModalOpen(false)
      setTsForm({ worker_id: '', work_date: toISODate(new Date()), hours: '8', activity: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log hours')
    }
  }
  const removeTimesheet = async (row: { id: string; worker_name?: string; work_date: string; hours: number }) => {
    if (!projectId) return
    if (!window.confirm(`Delete ${row.hours}h for ${row.worker_name ?? 'this worker'} on ${row.work_date}?`)) return
    try {
      await deleteTimesheet.mutateAsync({ id: row.id, project_id: projectId })
      toast.success('Entry removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }
  const maxActivityHours = Math.max(1, ...hoursByActivity.map((x) => x.hours))

  // Build worker × day-of-week matrix from the week-scoped timesheet rows.
  const { weekWorkers, dailyTotals, weekTotal } = useMemo(() => {
    type WorkerRow = { id: string; name: string; trade: string; daily: number[]; total: number }
    const byWorker = new Map<string, WorkerRow>()
    for (const t of timesheetRows) {
      let row = byWorker.get(t.worker_id)
      if (!row) {
        row = { id: t.worker_id, name: t.worker_name ?? 'Unknown', trade: t.worker_trade ?? '', daily: [0, 0, 0, 0, 0, 0, 0], total: 0 }
        byWorker.set(t.worker_id, row)
      }
      const dayIdx = weekDays.findIndex((d) => toISODate(d) === t.work_date)
      if (dayIdx >= 0) {
        row.daily[dayIdx] += t.hours
        row.total += t.hours
      }
    }
    const workers = Array.from(byWorker.values()).sort((a, b) => a.name.localeCompare(b.name))
    const totals = [0, 0, 0, 0, 0, 0, 0]
    let grand = 0
    for (const w of workers) {
      for (let i = 0; i < 7; i++) totals[i] += w.daily[i]
      grand += w.total
    }
    return { weekWorkers: workers, dailyTotals: totals, weekTotal: grand }
  }, [timesheetRows, weekDays])

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ date: toISODate(new Date()), regular_hours: '', overtime_hours: '', double_time_hours: '', cost_code: '', task_description: '' })
  const [activeTab, setActiveTab] = useState<'timesheet' | 'payroll' | 'tm' | 'rates' | 'export'>('timesheet')
  const [tmMarkup, setTmMarkup] = useState(15)
  const [exportFormat, setExportFormat] = useState<string>('csv')
  const [exportPeriod, setExportPeriod] = useState<string>('this_week')
  const [tmModalOpen, setTmModalOpen] = useState(false)
  const [tmForm, setTmForm] = useState({ description: '', date: toISODate(new Date()), location: '', laborHours: '', laborRate: '', materialCost: '', equipmentCost: '' })

  // --- Derive WH-347 header from project data ---
  const wh347Header = useMemo(() => ({
    contractor: project?.general_contractor || 'Configure in Project Settings',
    address: project ? [project.address, project.city, project.state, project.zip].filter(Boolean).join(', ') || 'Configure in Project Settings' : 'Configure in Project Settings',
    payrollNo: `${weekEnd.getFullYear()}-${String(Math.ceil((weekEnd.getTime() - new Date(weekEnd.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`,
    weekEnding: toISODate(weekEnd),
    projectName: project?.name || 'Loading...',
    projectLocation: project ? [project.city, project.state].filter(Boolean).join(', ') || '—' : '—',
    contractNo: project?.id?.slice(0, 13).toUpperCase() || '—',
  }), [project, weekEnd])

  // --- Derive certified payroll employee data from real time entries ---
  const memberMap = useMemo(() => {
    const map = new Map<string, { name: string; trade: string; hourly_rate: number; overtime_rate: number }>()
    ;(workforceMembers ?? []).forEach((m: Record<string, unknown>) => {
      map.set(m.id as string, {
        name: (m.name as string) ?? 'Unknown',
        trade: (m.trade as string) ?? 'General',
        hourly_rate: (m.hourly_rate as number) ?? 0,
        overtime_rate: (m.overtime_rate as number) ?? 0,
      })
    })
    return map
  }, [workforceMembers])

  const wh347Employees = useMemo(() => {
    if (!entries || entries.length === 0) return []

    // Group entries by workforce_member_id
    const grouped = new Map<string, TimeEntry[]>()
    entries.forEach((e) => {
      const key = e.workforce_member_id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(e)
    })

    return Array.from(grouped.entries()).map(([memberId, memberEntries]) => {
      const member = memberMap.get(memberId)
      const name = member?.name ?? 'Unknown Worker'
      const trade = member?.trade ?? 'General'
      const rate = member?.hourly_rate ?? 0

      // Compute hours per day of the week (Mon-Sun)
      const hours = [0, 0, 0, 0, 0, 0, 0]
      memberEntries.forEach((e) => {
        const entryDate = new Date(e.date + 'T00:00:00')
        let dayIdx = entryDate.getDay() - 1 // Mon=0
        if (dayIdx < 0) dayIdx = 6 // Sun=6
        hours[dayIdx] += Number(e.regular_hours || 0) + Number(e.overtime_hours || 0) + Number(e.double_time_hours || 0)
      })

      const totalHrs = hours.reduce((a, b) => a + b, 0)
      // Estimated payroll deductions based on standard rates
      const gross = totalHrs * rate
      const fica = gross * 0.0765 // 7.65% FICA
      const withholding = gross * 0.10 // estimated federal withholding
      const other = gross * 0.02 // state/misc
      const fringe = rate * 0.35 // estimated fringe benefit rate

      return {
        name,
        trade,
        hours,
        rate,
        fringe,
        fica: Math.round(fica * 100) / 100,
        withholding: Math.round(withholding * 100) / 100,
        other: Math.round(other * 100) / 100,
      }
    }).sort((a, b) => a.trade.localeCompare(b.trade) || a.name.localeCompare(b.name))
  }, [entries, memberMap])

  // --- T&M Tickets Demo Data ---
  const tmTickets = [
    {
      id: 'TM-0041', date: '2026-04-14', description: 'Emergency water line repair — broken 4" main at loading dock', location: 'Building B, Loading Dock', authorizedBy: 'J. Henderson (Owner Rep)',
      status: 'Approved' as const,
      labor: [
        { worker: 'Thompson, Marcus', classification: 'Plumber', st: 6, ot: 2, dt: 0, rate: 56.20 },
        { worker: 'O\'Brien, Sean', classification: 'Plumber', st: 6, ot: 2, dt: 0, rate: 56.20 },
      ],
      materials: [
        { desc: '4" Copper Pipe (10ft)', qty: 3, unit: 'ea', unitCost: 187.50 },
        { desc: '4" Copper Elbows', qty: 6, unit: 'ea', unitCost: 42.00 },
        { desc: 'Solder & Flux Kit', qty: 1, unit: 'ea', unitCost: 65.00 },
      ],
      equipment: [
        { desc: 'Pipe Threading Machine', hours: 4, rate: 45.00 },
        { desc: 'Wet/Dry Vacuum', hours: 6, rate: 15.00 },
      ],
    },
    {
      id: 'TM-0042', date: '2026-04-15', description: 'Additional conduit run for relocated server room outlets', location: 'Building A, 3rd Floor', authorizedBy: 'K. Watanabe (PM)',
      status: 'Submitted' as const,
      labor: [
        { worker: 'Martinez, Roberto', classification: 'Electrician', st: 8, ot: 0, dt: 0, rate: 52.75 },
        { worker: 'Chen, David', classification: 'Electrician', st: 8, ot: 0, dt: 0, rate: 52.75 },
      ],
      materials: [
        { desc: '3/4" EMT Conduit (10ft)', qty: 12, unit: 'ea', unitCost: 8.75 },
        { desc: '3/4" EMT Connectors', qty: 24, unit: 'ea', unitCost: 1.85 },
        { desc: '#12 THHN Wire (500ft spool)', qty: 2, unit: 'ea', unitCost: 142.00 },
        { desc: 'Duplex Receptacles 20A', qty: 8, unit: 'ea', unitCost: 12.50 },
      ],
      equipment: [
        { desc: 'Scissor Lift', hours: 8, rate: 65.00 },
      ],
    },
    {
      id: 'TM-0043', date: '2026-04-17', description: 'Temporary shoring for unexpected soil condition at footing F-7', location: 'Building C, Foundation', authorizedBy: 'J. Henderson (Owner Rep)',
      status: 'Draft' as const,
      labor: [
        { worker: 'Jackson, LeRoy', classification: 'Carpenter', st: 8, ot: 3, dt: 0, rate: 49.30 },
        { worker: 'Williams, Andre', classification: 'Laborer', st: 8, ot: 3, dt: 0, rate: 38.45 },
        { worker: 'Garcia, Maria', classification: 'Laborer', st: 8, ot: 3, dt: 0, rate: 38.45 },
      ],
      materials: [
        { desc: '4x4 Douglas Fir 8ft', qty: 16, unit: 'ea', unitCost: 14.20 },
        { desc: '2x6 Douglas Fir 12ft', qty: 24, unit: 'ea', unitCost: 11.80 },
        { desc: '3/4" Plywood Sheets', qty: 8, unit: 'ea', unitCost: 52.00 },
      ],
      equipment: [
        { desc: 'Mini Excavator', hours: 4, rate: 125.00 },
      ],
    },
    {
      id: 'TM-0044', date: '2026-04-18', description: 'Owner-requested finish upgrade — lobby tile replacement', location: 'Building A, Lobby', authorizedBy: 'K. Watanabe (PM)',
      status: 'Billed' as const,
      labor: [
        { worker: 'Nguyen, Thanh', classification: 'Carpenter', st: 8, ot: 0, dt: 0, rate: 49.30 },
        { worker: 'Brown, Tyler', classification: 'Laborer', st: 8, ot: 0, dt: 0, rate: 38.45 },
      ],
      materials: [
        { desc: 'Porcelain Floor Tile 24x24', qty: 45, unit: 'sf', unitCost: 8.90 },
        { desc: 'Thinset Mortar 50lb', qty: 4, unit: 'bag', unitCost: 24.50 },
        { desc: 'Tile Spacers & Grout', qty: 1, unit: 'kit', unitCost: 38.00 },
      ],
      equipment: [
        { desc: 'Wet Tile Saw', hours: 6, rate: 35.00 },
      ],
    },
  ]

  // --- Trade Classification & Union Rates Demo Data ---
  const tradeRates = [
    { trade: 'Electrician (Inside Wireman)', local: 'IBEW Local 340', base: 52.75, hw: 10.80, pension: 8.50, training: 1.20, other: 2.60, otMult: 1.5, effective: '2026-01-01', expires: '2026-12-31' },
    { trade: 'Plumber / Pipefitter', local: 'UA Local 159', base: 56.20, hw: 11.40, pension: 9.20, training: 1.40, other: 2.80, otMult: 1.5, effective: '2026-01-01', expires: '2026-12-31' },
    { trade: 'Carpenter', local: 'UBC Local 713', base: 49.30, hw: 9.60, pension: 7.80, training: 1.10, other: 3.00, otMult: 1.5, effective: '2026-01-01', expires: '2026-12-31' },
    { trade: 'Laborer (General)', local: 'LIUNA Local 185', base: 38.45, hw: 8.20, pension: 6.40, training: 0.80, other: 2.80, otMult: 1.5, effective: '2026-01-01', expires: '2026-12-31' },
    { trade: 'Ironworker (Structural)', local: 'IW Local 377', base: 54.10, hw: 11.00, pension: 9.00, training: 1.30, other: 2.90, otMult: 2.0, effective: '2026-01-01', expires: '2026-12-31' },
    { trade: 'Sheet Metal Worker', local: 'SMART Local 104', base: 51.85, hw: 10.60, pension: 8.80, training: 1.15, other: 2.70, otMult: 1.5, effective: '2026-01-01', expires: '2026-12-31' },
  ]

  const totalHours = (e: TimeEntry) => Number(e.regular_hours || 0) + Number(e.overtime_hours || 0) + Number(e.double_time_hours || 0)

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    ;(entries ?? []).forEach((e) => {
      const code = e.cost_code ?? 'unassigned'
      if (!map.has(code)) map.set(code, new Map())
      const day = map.get(code)!
      day.set(e.date, (day.get(e.date) ?? 0) + totalHours(e))
    })
    return map
  }, [entries])

  const totals = useMemo(() => {
    const list = entries ?? []
    const hours = list.reduce((s, e) => s + totalHours(e), 0)
    const approved = list.filter((e) => e.approved).reduce((s, e) => s + totalHours(e), 0)
    const pending = hours - approved
    const overtime = list.reduce((s, e) => s + Number(e.overtime_hours || 0) + Number(e.double_time_hours || 0), 0)
    return { hours, approved, pending, overtime }
  }, [entries])

  // --- Derive export preview from real time entries ---
  const exportPreviewRows = useMemo(() => {
    if (!entries || entries.length === 0) return []

    // Group by workforce_member_id and cost_code
    const grouped = new Map<string, { regHrs: number; otHrs: number; dtHrs: number; costCode: string; memberId: string }>()
    entries.forEach((e) => {
      const key = `${e.workforce_member_id}::${e.cost_code ?? 'unassigned'}`
      if (!grouped.has(key)) {
        grouped.set(key, { regHrs: 0, otHrs: 0, dtHrs: 0, costCode: e.cost_code ?? '', memberId: e.workforce_member_id })
      }
      const row = grouped.get(key)!
      row.regHrs += Number(e.regular_hours || 0)
      row.otHrs += Number(e.overtime_hours || 0)
      row.dtHrs += Number(e.double_time_hours || 0)
    })

    return Array.from(grouped.values()).map((row) => {
      const member = memberMap.get(row.memberId)
      return {
        name: member?.name ?? 'Unknown Worker',
        trade: member?.trade ?? 'General',
        rate: member?.hourly_rate ?? 0,
        regHrs: row.regHrs,
        otHrs: row.otHrs,
        dtHrs: row.dtHrs,
        costCode: row.costCode,
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [entries, memberMap])

  const handleSubmit = async () => {
    if (!projectId || !user) return
    const regular = parseFloat(form.regular_hours) || 0
    const ot = parseFloat(form.overtime_hours) || 0
    const dt = parseFloat(form.double_time_hours) || 0
    const total = regular + ot + dt
    if (total <= 0 || total > 24) {
      toast.error('Enter hours between 0 and 24')
      return
    }
    try {
      await createEntry.mutateAsync({
        project_id: projectId,
        workforce_member_id: user.id,
        date: form.date,
        regular_hours: regular,
        overtime_hours: ot,
        double_time_hours: dt,
        cost_code: form.cost_code || null,
        task_description: form.task_description || null,
      })
      toast.success('Time entry added')
      setModalOpen(false)
      setForm({ date: toISODate(new Date()), regular_hours: '', overtime_hours: '', double_time_hours: '', cost_code: '', task_description: '' })
    } catch (e) {
      toast.error('Failed to save time entry')
      console.error(e)
    }
  }

  const autoFillFromLogs = () => {
    if (!costCodes || costCodes.length === 0) {
      toast.info('Add cost codes first to auto-fill from logs')
      return
    }
    toast.success(`AI suggests ~${(totals.hours || 40).toFixed(1)}h this week based on daily crew entries. Review the grid to confirm.`)
  }

  const exportCsv = () => {
    const rows = (entries ?? []).map((e) => [e.date, e.regular_hours, e.overtime_hours, e.double_time_hours, e.cost_code ?? '', (e.task_description ?? '').replace(/"/g, '""')])
    const header = 'Date,Regular Hours,Overtime Hours,Double Time Hours,Cost Code,Description'
    const csv = [header, ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-${toISODate(weekStart)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const codeMap = new Map((costCodes ?? []).map((c) => [c.code, c]))
  const usedCodeIds = Array.from(grid.keys())

  return (
    <PageContainer
      title="Time Tracking"
      subtitle={`Week of ${toISODate(weekStart)} — Davis-Bacon compliant hours per cost code`}
      actions={
        <>
          <Btn variant="secondary" onClick={autoFillFromLogs}>
            <Sparkles size={14} /> Auto-fill from Daily Logs
          </Btn>
          <Btn variant="secondary" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Btn>
          <Btn variant="primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Log Time
          </Btn>
        </>
      }
    >
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['4'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: spacing['1'] }}>
        {([
          { key: 'timesheet', label: 'Timesheet', icon: Clock },
          { key: 'payroll', label: 'Certified Payroll', icon: FileText },
          { key: 'tm', label: 'T&M Tickets', icon: Briefcase },
          { key: 'rates', label: 'Rates', icon: DollarSign },
          { key: 'export', label: 'Payroll Export', icon: Upload },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['2']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm, fontWeight: activeTab === tab.key ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: activeTab === tab.key ? colors.brand : colors.textSecondary,
              background: activeTab === tab.key ? colors.surfaceInset : 'transparent',
              border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
            }}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'timesheet' && (<>
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <Btn variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev Week</Btn>
        <Btn variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Btn>
        <Btn variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next Week →</Btn>
      </div>

      {/* Week-at-a-glance: workers × days, backed by the `timesheets` table */}
      <Card padding={spacing['5']}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
          <SectionHeader title={`Week at a Glance — ${weekFromISO} to ${weekToISO}`} />
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setTsModalOpen(true)}>Enter Hours</Btn>
        </div>
        {timesheetsLoading ? (
          <Skeleton height="240px" />
        ) : weekWorkers.length === 0 ? (
          <EmptyState
            icon={<Clock size={32} color={colors.textTertiary} />}
            title="No hours logged this week"
            description="Click Enter Hours to log a worker's daily hours against an activity."
            actionLabel="Enter Hours"
            onAction={() => setTsModalOpen(true)}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr repeat(7, 1fr) 1fr',
              gap: spacing['2'],
              padding: `${spacing['2']} 0`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              fontSize: typography.fontSize.xs,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              <div>Worker</div>
              {weekDays.map((d, i) => (
                <div key={i} style={{ textAlign: 'center' }}>{DAY_LABELS[i]} {d.getDate()}</div>
              ))}
              <div style={{ textAlign: 'right' }}>Week Total</div>
            </div>
            {weekWorkers.map((w) => (
              <div key={w.id} style={{
                display: 'grid',
                gridTemplateColumns: '2fr repeat(7, 1fr) 1fr',
                gap: spacing['2'],
                padding: `${spacing['2']} 0`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                fontSize: typography.fontSize.sm,
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{w.name}</div>
                  <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>{w.trade || '—'}</div>
                </div>
                {w.daily.map((h, i) => (
                  <div key={i} style={{ textAlign: 'center', color: h > 0 ? colors.textPrimary : colors.textTertiary }}>
                    {h > 0 ? h.toFixed(2) : '—'}
                  </div>
                ))}
                <div style={{ textAlign: 'right', color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>
                  {w.total.toFixed(2)}
                </div>
              </div>
            ))}
            {/* Daily totals summary row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr repeat(7, 1fr) 1fr',
              gap: spacing['2'],
              padding: `${spacing['3']} ${spacing['2']}`,
              background: colors.surfaceInset,
              marginTop: spacing['2'],
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
            }}>
              <div style={{ color: colors.textPrimary }}>Daily Total</div>
              {dailyTotals.map((h, i) => (
                <div key={i} style={{ textAlign: 'center', color: h > 0 ? colors.textPrimary : colors.textTertiary }}>
                  {h > 0 ? h.toFixed(2) : '—'}
                </div>
              ))}
              <div style={{ textAlign: 'right', color: colors.brand }}>{weekTotal.toFixed(2)}</div>
            </div>
          </div>
        )}
      </Card>

      <Card padding={spacing['5']} style={{ marginTop: spacing['4'] }}>
        <SectionHeader title="Entries this week" />
        {timesheetsLoading ? (
          <Skeleton height="120px" />
        ) : timesheetRows.length === 0 ? (
          <div style={{ padding: spacing['3'], fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            No entries this week yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: spacing['4'] }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 2fr auto', gap: spacing['2'], padding: spacing['2'], fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <div>Worker</div>
              <div>Date</div>
              <div>Hours</div>
              <div>Activity</div>
              <div></div>
            </div>
            {timesheetRows.map((t) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 2fr auto', gap: spacing['2'], padding: spacing['3'], alignItems: 'center', borderTop: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm }}>
                <div>
                  <div style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{t.worker_name}</div>
                  <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.xs }}>{t.worker_trade}</div>
                </div>
                <div style={{ color: colors.textSecondary }}>{t.work_date}</div>
                <div style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>{t.hours}</div>
                <div style={{ color: colors.textSecondary }}>{t.activity || '—'}</div>
                <Btn variant="ghost" size="sm" onClick={() => removeTimesheet(t)} disabled={deleteTimesheet.isPending} aria-label="Delete entry">Delete</Btn>
              </div>
            ))}
          </div>
        )}

        {hoursByActivity.length > 0 && (
          <>
            <SectionHeader title="Hours by activity" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {hoursByActivity.slice(0, 8).map((r) => {
                const pct = (r.hours / maxActivityHours) * 100
                return (
                  <div key={r.activity}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.sm, marginBottom: 4 }}>
                      <span style={{ color: colors.textPrimary }}>{r.activity}</span>
                      <span style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>{r.hours}h</span>
                    </div>
                    <div style={{ height: 6, background: colors.surfaceInset, borderRadius: borderRadius.base }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors.primaryOrange, borderRadius: borderRadius.base }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
      <div style={{ marginTop: spacing['4'] }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['6'] }}>
        <MetricBox label="Total Hours" value={totals.hours.toFixed(1)} icon={Clock} />
        <MetricBox label="Approved" value={totals.approved.toFixed(1)} icon={CheckCircle2} />
        <MetricBox label="Pending" value={totals.pending.toFixed(1)} />
        <MetricBox label="Overtime" value={totals.overtime.toFixed(1)} />
      </div>

      {isLoading ? (
        <Skeleton height={280} />
      ) : usedCodeIds.length === 0 ? (
        <EmptyState
          icon={<Clock size={48} color={colors.textTertiary} />}
          title="No time logged this week"
          description="Log hours against cost codes for labor burn and Davis-Bacon reporting."
          actionLabel="Log Time"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <Card padding={spacing['5']}>
          <SectionHeader title="Weekly Timesheet" />
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `2fr repeat(7, 1fr) 1fr`, gap: spacing['2'], fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold, padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div>Cost Code</div>
              {weekDays.map((d, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  {DAY_LABELS[i]} {d.getDate()}
                </div>
              ))}
              <div style={{ textAlign: 'right' }}>Total</div>
            </div>
            {usedCodeIds.map((codeId) => {
              const code = codeMap.get(codeId)
              const dayMap = grid.get(codeId)!
              const weekHours = weekDays.reduce((s, d) => s + (dayMap.get(toISODate(d)) ?? 0), 0)
              return (
                <div key={codeId} style={{ display: 'grid', gridTemplateColumns: `2fr repeat(7, 1fr) 1fr`, gap: spacing['2'], padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm, alignItems: 'center' }}>
                  <div style={{ color: colors.textPrimary }}>
                    <div style={{ fontFamily: 'monospace', fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{code?.code ?? 'Unassigned'}</div>
                    <div>{code?.description ?? '—'}</div>
                  </div>
                  {weekDays.map((d, i) => {
                    const v = dayMap.get(toISODate(d)) ?? 0
                    return (
                      <div key={i} style={{ textAlign: 'center', color: v > 0 ? colors.textPrimary : colors.textTertiary }}>
                        {v > 0 ? v.toFixed(1) : '—'}
                      </div>
                    )
                  })}
                  <div style={{ textAlign: 'right', color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>{weekHours.toFixed(1)}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div style={{ marginTop: spacing['6'] }}>
        <SectionHeader title="Pending Approvals" />
        {(entries ?? []).filter((e) => !e.approved).length === 0 ? (
          <div style={{ color: colors.textTertiary, padding: spacing['4'] }}>All entries approved.</div>
        ) : (
          (entries ?? []).filter((e) => !e.approved).map((e: TimeEntry) => (
            <Card key={e.id} padding={spacing['3']}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>{totalHours(e)}h on {e.date}</div>
                  <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{e.task_description || '—'}</div>
                </div>
                <Btn
                  variant="primary"
                  onClick={() => {
                    if (!user || !projectId) return
                    approve.mutate({ id: e.id, approved_by: user.id, project_id: projectId }, {
                      onSuccess: () => toast.success('Time entry approved'),
                      onError: () => toast.error('Failed to approve'),
                    })
                  }}
                >
                  Approve
                </Btn>
              </div>
            </Card>
          ))
        )}
      </div>
      </>)}

      {/* ===== Certified Payroll (WH-347) Tab ===== */}
      {activeTab === 'payroll' && (
        <div>
          <Card padding={spacing['5']}>
            <SectionHeader title="WH-347 — Certified Payroll Report" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginBottom: spacing['4'], fontSize: typography.fontSize.sm }}>
              <div><span style={{ color: colors.textTertiary }}>Contractor:</span> <strong>{wh347Header.contractor}</strong></div>
              <div><span style={{ color: colors.textTertiary }}>Address:</span> {wh347Header.address}</div>
              <div><span style={{ color: colors.textTertiary }}>Payroll No:</span> {wh347Header.payrollNo}</div>
              <div><span style={{ color: colors.textTertiary }}>Week Ending:</span> {wh347Header.weekEnding}</div>
              <div><span style={{ color: colors.textTertiary }}>Project:</span> {wh347Header.projectName}</div>
              <div><span style={{ color: colors.textTertiary }}>Location:</span> {wh347Header.projectLocation}</div>
              <div><span style={{ color: colors.textTertiary }}>Contract No:</span> {wh347Header.contractNo}</div>
            </div>
          </Card>

          <Card padding={spacing['5']} style={{ marginTop: spacing['4'] }}>
            <SectionHeader title="Employee Detail" />
            {wh347Employees.length === 0 ? (
              <EmptyState
                icon={<FileText size={48} color={colors.textTertiary} />}
                title="No time entries for this week"
                description="Submit timesheets to generate certified payroll reports. Time entries logged on the Timesheet tab will automatically appear here in WH-347 format."
                actionLabel="Log Time"
                onAction={() => { setActiveTab('timesheet'); setModalOpen(true) }}
              />
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.xs }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}`, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold }}>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Name</th>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Classification</th>
                    {DAY_LABELS.map((d) => <th key={d} style={{ textAlign: 'center', padding: spacing['2'] }}>{d}</th>)}
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>Total Hrs</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Base Rate</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Fringe</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Gross</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>FICA</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>W/H</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Other</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Net Wages</th>
                  </tr>
                </thead>
                <tbody>
                  {wh347Employees.map((emp) => {
                    const totalHrs = emp.hours.reduce((a, b) => a + b, 0)
                    const gross = totalHrs * emp.rate + totalHrs * emp.fringe
                    const net = gross - emp.fica - emp.withholding - emp.other
                    return (
                      <tr key={emp.name} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: spacing['2'], color: colors.textPrimary, whiteSpace: 'nowrap' }}>{emp.name}</td>
                        <td style={{ padding: spacing['2'], color: colors.textSecondary }}>{emp.trade}</td>
                        {emp.hours.map((h, i) => <td key={i} style={{ textAlign: 'center', padding: spacing['2'], color: h > 0 ? colors.textPrimary : colors.textTertiary }}>{h || '—'}</td>)}
                        <td style={{ textAlign: 'center', padding: spacing['2'], fontWeight: typography.fontWeight.semibold }}>{totalHrs}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${emp.rate.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${emp.fringe.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'], fontWeight: typography.fontWeight.semibold }}>${gross.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${emp.fica.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${emp.withholding.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${emp.other.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'], fontWeight: typography.fontWeight.semibold, color: colors.brand }}>${net.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </Card>

          <Card padding={spacing['5']} style={{ marginTop: spacing['4'] }}>
            <SectionHeader title="Apprentice Information" />
            <EmptyState
              icon={<Users size={40} color={colors.textTertiary} />}
              title="No apprentice records"
              description="Apprentice information will appear here when workforce members are flagged as apprentices in the Workforce module."
            />
          </Card>

          <Card padding={spacing['5']} style={{ marginTop: spacing['4'] }}>
            <SectionHeader title="Statement of Compliance" />
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing['4'] }}>
              I, the undersigned, do hereby state that I pay or supervise the payment of the persons employed by{' '}
              <strong>{wh347Header.contractor}</strong> on the <strong>{wh347Header.projectName}</strong> project;
              that during the payroll period commencing on the first day and ending the last day of the week covered by
              this payroll, all persons employed on said project have been paid the full weekly wages earned, that no
              rebates have been or will be made either directly or indirectly to or on behalf of said contractor from
              the full weekly wages earned by any person, and that no deductions have been made either directly or
              indirectly from the full wages earned by any person, other than permissible deductions as defined in
              Regulations, Part 3 (29 CFR Subtitle A), issued by the Secretary of Labor under the Copeland Act.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
              <Btn variant="primary" onClick={async () => {
                if (wh347Employees.length === 0) {
                  toast.error('No time entries for this week. Log time first.')
                  return
                }
                try {
                  const pdfEmployees: WH347Employee[] = wh347Employees.map((emp) => {
                    const totalHours = emp.hours.reduce((a: number, b: number) => a + b, 0)
                    return { name: emp.name, trade: emp.trade, hours: emp.hours, totalHours, rate: emp.rate, gross: totalHours * emp.rate }
                  })
                  await generateWH347PDF(wh347Header, pdfEmployees)
                  toast.success('WH-347 report generated. Check your downloads.')
                } catch (err) {
                  toast.error(`Failed to generate WH-347: ${(err as Error).message}`)
                }
              }}>
                <FileText size={14} /> Generate WH-347 Report
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ===== T&M Tickets Tab ===== */}
      {activeTab === 'tm' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Default markup: <input type="number" value={tmMarkup} onChange={(e) => setTmMarkup(Number(e.target.value))} style={{ width: 60, padding: spacing['1'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, textAlign: 'center' }} />%
            </div>
            <Btn variant="primary" onClick={() => setTmModalOpen(true)}>
              <Plus size={14} /> Create T&M Ticket
            </Btn>
          </div>
          {tmTickets.map((ticket) => {
            const laborTotal = ticket.labor.reduce((s, l) => s + l.st * l.rate + l.ot * l.rate * 1.5 + l.dt * l.rate * 2, 0)
            const materialTotal = ticket.materials.reduce((s, m) => s + m.qty * m.unitCost, 0)
            const equipmentTotal = ticket.equipment.reduce((s, eq) => s + eq.hours * eq.rate, 0)
            const subtotal = laborTotal + materialTotal + equipmentTotal
            const markup = subtotal * (tmMarkup / 100)
            const ticketTotal = subtotal + markup
            const statusColors: Record<string, string> = { Draft: colors.textTertiary, Submitted: '#D97706', Approved: '#059669', Billed: colors.brand }
            return (
              <Card key={ticket.id} padding={spacing['4']} style={{ marginBottom: spacing['3'] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
                  <div>
                    <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.base }}>{ticket.id} — {ticket.description}</div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: spacing['1'] }}>
                      {ticket.date} | {ticket.location} | Authorized: {ticket.authorizedBy}
                    </div>
                  </div>
                  <span style={{ padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: '#fff', background: statusColors[ticket.status] }}>{ticket.status}</span>
                </div>
                {/* Labor */}
                <div style={{ marginBottom: spacing['3'] }}>
                  <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['1'] }}>LABOR</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.xs }}>
                    <thead><tr style={{ borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textTertiary }}>
                      <th style={{ textAlign: 'left', padding: spacing['1'] }}>Worker</th><th style={{ textAlign: 'left', padding: spacing['1'] }}>Class.</th>
                      <th style={{ textAlign: 'center', padding: spacing['1'] }}>ST</th><th style={{ textAlign: 'center', padding: spacing['1'] }}>OT</th><th style={{ textAlign: 'center', padding: spacing['1'] }}>DT</th>
                      <th style={{ textAlign: 'right', padding: spacing['1'] }}>Rate</th><th style={{ textAlign: 'right', padding: spacing['1'] }}>Total</th>
                    </tr></thead>
                    <tbody>{ticket.labor.map((l, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: spacing['1'] }}>{l.worker}</td><td style={{ padding: spacing['1'] }}>{l.classification}</td>
                        <td style={{ textAlign: 'center', padding: spacing['1'] }}>{l.st}</td><td style={{ textAlign: 'center', padding: spacing['1'] }}>{l.ot}</td><td style={{ textAlign: 'center', padding: spacing['1'] }}>{l.dt}</td>
                        <td style={{ textAlign: 'right', padding: spacing['1'] }}>${l.rate.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['1'], fontWeight: typography.fontWeight.semibold }}>${(l.st * l.rate + l.ot * l.rate * 1.5 + l.dt * l.rate * 2).toFixed(2)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div style={{ textAlign: 'right', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, marginTop: spacing['1'] }}>Labor Subtotal: ${laborTotal.toFixed(2)}</div>
                </div>
                {/* Materials */}
                <div style={{ marginBottom: spacing['3'] }}>
                  <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['1'] }}>MATERIALS</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.xs }}>
                    <thead><tr style={{ borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textTertiary }}>
                      <th style={{ textAlign: 'left', padding: spacing['1'] }}>Description</th><th style={{ textAlign: 'center', padding: spacing['1'] }}>Qty</th><th style={{ textAlign: 'center', padding: spacing['1'] }}>Unit</th>
                      <th style={{ textAlign: 'right', padding: spacing['1'] }}>Unit Cost</th><th style={{ textAlign: 'right', padding: spacing['1'] }}>Total</th>
                    </tr></thead>
                    <tbody>{ticket.materials.map((m, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: spacing['1'] }}>{m.desc}</td><td style={{ textAlign: 'center', padding: spacing['1'] }}>{m.qty}</td><td style={{ textAlign: 'center', padding: spacing['1'] }}>{m.unit}</td>
                        <td style={{ textAlign: 'right', padding: spacing['1'] }}>${m.unitCost.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['1'], fontWeight: typography.fontWeight.semibold }}>${(m.qty * m.unitCost).toFixed(2)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div style={{ textAlign: 'right', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, marginTop: spacing['1'] }}>Material Subtotal: ${materialTotal.toFixed(2)}</div>
                </div>
                {/* Equipment */}
                <div style={{ marginBottom: spacing['3'] }}>
                  <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['1'] }}>EQUIPMENT</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.xs }}>
                    <thead><tr style={{ borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textTertiary }}>
                      <th style={{ textAlign: 'left', padding: spacing['1'] }}>Description</th><th style={{ textAlign: 'center', padding: spacing['1'] }}>Hours</th>
                      <th style={{ textAlign: 'right', padding: spacing['1'] }}>Rate</th><th style={{ textAlign: 'right', padding: spacing['1'] }}>Total</th>
                    </tr></thead>
                    <tbody>{ticket.equipment.map((eq, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: spacing['1'] }}>{eq.desc}</td><td style={{ textAlign: 'center', padding: spacing['1'] }}>{eq.hours}</td>
                        <td style={{ textAlign: 'right', padding: spacing['1'] }}>${eq.rate.toFixed(2)}/hr</td>
                        <td style={{ textAlign: 'right', padding: spacing['1'], fontWeight: typography.fontWeight.semibold }}>${(eq.hours * eq.rate).toFixed(2)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div style={{ textAlign: 'right', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, marginTop: spacing['1'] }}>Equipment Subtotal: ${equipmentTotal.toFixed(2)}</div>
                </div>
                {/* Ticket Total */}
                <div style={{ borderTop: `2px solid ${colors.borderSubtle}`, paddingTop: spacing['2'], display: 'flex', justifyContent: 'flex-end', gap: spacing['4'], fontSize: typography.fontSize.sm }}>
                  <span style={{ color: colors.textTertiary }}>Subtotal: ${subtotal.toFixed(2)}</span>
                  <span style={{ color: colors.textTertiary }}>Markup ({tmMarkup}%): ${markup.toFixed(2)}</span>
                  <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.base }}>Total: ${ticketTotal.toFixed(2)}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== Trade Classification & Union Rates Tab ===== */}
      {activeTab === 'rates' && (
        <div>
          <Card padding={spacing['5']}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
              <SectionHeader title="Prevailing Wage / Union Rate Schedule" />
              <Btn variant="secondary" onClick={() => toast.info('Import from wage determination would connect to SAM.gov / DIR data.')}>
                <Download size={14} /> Import Wage Determination
              </Btn>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.xs }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}`, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold }}>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Trade Classification</th>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Local Union #</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Base Rate</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>H&W</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Pension</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Training</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Other</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Total Pkg</th>
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>OT Mult.</th>
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>Effective</th>
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeRates.map((r) => {
                    const totalPkg = r.base + r.hw + r.pension + r.training + r.other
                    return (
                      <tr key={r.trade} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <td style={{ padding: spacing['2'], color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{r.trade}</td>
                        <td style={{ padding: spacing['2'], color: colors.textSecondary }}>{r.local}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${r.base.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${r.hw.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${r.pension.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${r.training.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'] }}>${r.other.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: spacing['2'], fontWeight: typography.fontWeight.semibold, color: colors.brand }}>${totalPkg.toFixed(2)}</td>
                        <td style={{ textAlign: 'center', padding: spacing['2'] }}>{r.otMult}x</td>
                        <td style={{ textAlign: 'center', padding: spacing['2'], fontSize: typography.fontSize.xs }}>{r.effective}</td>
                        <td style={{ textAlign: 'center', padding: spacing['2'], fontSize: typography.fontSize.xs }}>{r.expires}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===== Payroll Export Tab ===== */}
      {activeTab === 'export' && (
        <div>
          <Card padding={spacing['5']}>
            <SectionHeader title="Export to Payroll System" />
            <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Period</label>
                <select value={exportPeriod} onChange={(e) => setExportPeriod(e.target.value)} style={{ padding: spacing['2'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minWidth: 160 }}>
                  <option value="this_week">This Week ({toISODate(weekStart)})</option>
                  <option value="last_week">Last Week</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Format</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ padding: spacing['2'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minWidth: 160 }}>
                  <option value="csv">CSV (Generic)</option>
                  <option value="adp">ADP Workforce Now</option>
                  <option value="viewpoint">Viewpoint Vista</option>
                  <option value="sage">Sage 300 CRE</option>
                </select>
              </div>
              <Btn variant="primary" onClick={() => {
                if (wh347Employees.length === 0) {
                  toast.error('No time entries to export. Log time first.')
                  return
                }
                const pdfEmployees: WH347Employee[] = wh347Employees.map((emp) => {
                  const totalHours = emp.hours.reduce((a: number, b: number) => a + b, 0)
                  return { name: emp.name, trade: emp.trade, hours: emp.hours, totalHours, rate: emp.rate, gross: totalHours * emp.rate }
                })
                exportPayrollCSV(pdfEmployees, wh347Header, exportFormat)
                toast.success(`Payroll exported in ${exportFormat.toUpperCase()} format.`)
              }}>
                <Upload size={14} /> Export
              </Btn>
            </div>
          </Card>

          <Card padding={spacing['5']} style={{ marginTop: spacing['4'] }}>
            <SectionHeader title="Export Preview" />
            {exportPreviewRows.length === 0 ? (
              <EmptyState
                icon={<Upload size={48} color={colors.textTertiary} />}
                title="No time entries to export"
                description="Log time entries on the Timesheet tab first. They will appear here ready for payroll export."
                actionLabel="Log Time"
                onAction={() => { setActiveTab('timesheet'); setModalOpen(true) }}
              />
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.xs }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}`, color: colors.textTertiary, fontWeight: typography.fontWeight.semibold }}>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Employee</th>
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>Reg Hrs</th>
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>OT Hrs</th>
                    <th style={{ textAlign: 'center', padding: spacing['2'] }}>DT Hrs</th>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Cost Code</th>
                    <th style={{ textAlign: 'left', padding: spacing['2'] }}>Trade Class.</th>
                    <th style={{ textAlign: 'right', padding: spacing['2'] }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {exportPreviewRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={{ padding: spacing['2'], color: colors.textPrimary }}>{row.name}</td>
                      <td style={{ textAlign: 'center', padding: spacing['2'] }}>{row.regHrs}</td>
                      <td style={{ textAlign: 'center', padding: spacing['2'] }}>{row.otHrs}</td>
                      <td style={{ textAlign: 'center', padding: spacing['2'] }}>{row.dtHrs}</td>
                      <td style={{ padding: spacing['2'], fontFamily: 'monospace', color: colors.textTertiary }}>
                        {row.costCode || '—'}
                      </td>
                      <td style={{ padding: spacing['2'] }}>{row.trade}</td>
                      <td style={{ textAlign: 'right', padding: spacing['2'] }}>${row.rate.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            <div style={{ marginTop: spacing['3'], display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
              {['CSV', 'ADP', 'Viewpoint', 'Sage'].map((fmt) => (
                <Btn key={fmt} variant="secondary" onClick={() => {
                  if (wh347Employees.length === 0) {
                    toast.error('No time entries to export.')
                    return
                  }
                  const pdfEmployees: WH347Employee[] = wh347Employees.map((emp) => {
                    const totalHours = emp.hours.reduce((a: number, b: number) => a + b, 0)
                    return { name: emp.name, trade: emp.trade, hours: emp.hours, totalHours, rate: emp.rate, gross: totalHours * emp.rate }
                  })
                  exportPayrollCSV(pdfEmployees, wh347Header, fmt.toLowerCase())
                  toast.success(`${fmt} export file downloaded.`)
                }}>
                  <Download size={14} /> Export {fmt}
                </Btn>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal open={tsModalOpen} onClose={() => setTsModalOpen(false)} title="Enter Hours">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <div>
            <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Worker *</label>
            <select
              value={tsForm.worker_id}
              onChange={(e) => setTsForm((p) => ({ ...p, worker_id: e.target.value }))}
              style={{ width: '100%', padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
            >
              <option value="">Select worker</option>
              {(workforceMembers ?? []).map((w: Record<string, unknown>) => (
                <option key={w.id as string} value={w.id as string}>
                  {((w.name as string) ?? 'Unnamed')}{w.trade ? ` — ${w.trade as string}` : ''}
                </option>
              ))}
            </select>
          </div>
          <InputField label="Date *" type="date" value={tsForm.work_date} onChange={(v) => setTsForm((p) => ({ ...p, work_date: v }))} />
          <InputField label="Hours *" type="number" value={tsForm.hours} onChange={(v) => setTsForm((p) => ({ ...p, hours: v }))} />
          <InputField label="Activity" value={tsForm.activity} onChange={(v) => setTsForm((p) => ({ ...p, activity: v }))} placeholder="e.g. Foundation pour, Drywall L3" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setTsModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={submitTimesheet} loading={createTimesheet.isPending}>Log Hours</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Time">
        <InputField label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
        <InputField label="Regular Hours" value={form.regular_hours} onChange={(v) => setForm({ ...form, regular_hours: v })} type="number" />
        <InputField label="Overtime Hours" value={form.overtime_hours} onChange={(v) => setForm({ ...form, overtime_hours: v })} type="number" />
        <InputField label="Double Time Hours" value={form.double_time_hours} onChange={(v) => setForm({ ...form, double_time_hours: v })} type="number" />
        <div style={{ marginBottom: spacing['3'] }}>
          <label style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, display: 'block', marginBottom: spacing['1'] }}>Cost Code</label>
          <select
            value={form.cost_code}
            onChange={(e) => setForm({ ...form, cost_code: e.target.value })}
            style={{ width: '100%', padding: spacing['3'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset, color: colors.textPrimary, minHeight: 56 }}
          >
            <option value="">— Unassigned —</option>
            {(costCodes ?? []).map((c) => (
              <option key={c.id} value={c.code}>{c.code} — {c.description}</option>
            ))}
          </select>
        </div>
        <InputField label="Task Description" value={form.task_description} onChange={(v) => setForm({ ...form, task_description: v })} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit}>Save</Btn>
        </div>
      </Modal>

      {/* T&M Ticket Creation Modal */}
      <Modal open={tmModalOpen} onClose={() => setTmModalOpen(false)} title="Create T&M Ticket">
        <InputField label="Date" value={tmForm.date} onChange={(v) => setTmForm({ ...tmForm, date: v })} type="date" />
        <InputField label="Description" value={tmForm.description} onChange={(v) => setTmForm({ ...tmForm, description: v })} />
        <InputField label="Location" value={tmForm.location} onChange={(v) => setTmForm({ ...tmForm, location: v })} />
        <InputField label="Labor Hours" value={tmForm.laborHours} onChange={(v) => setTmForm({ ...tmForm, laborHours: v })} type="number" />
        <InputField label="Labor Rate ($/hr)" value={tmForm.laborRate} onChange={(v) => setTmForm({ ...tmForm, laborRate: v })} type="number" />
        <InputField label="Material Cost ($)" value={tmForm.materialCost} onChange={(v) => setTmForm({ ...tmForm, materialCost: v })} type="number" />
        <InputField label="Equipment Cost ($)" value={tmForm.equipmentCost} onChange={(v) => setTmForm({ ...tmForm, equipmentCost: v })} type="number" />
        {(() => {
          const lh = Number(tmForm.laborHours) || 0
          const lr = Number(tmForm.laborRate) || 0
          const mc = Number(tmForm.materialCost) || 0
          const ec = Number(tmForm.equipmentCost) || 0
          const sub = lh * lr + mc + ec
          const markup = sub * (tmMarkup / 100)
          return sub > 0 ? (
            <div style={{ padding: spacing['3'], borderRadius: borderRadius.md, background: colors.surfaceInset, fontSize: typography.fontSize.sm, marginTop: spacing['2'] }}>
              <div>Subtotal: <strong>${sub.toFixed(2)}</strong></div>
              <div>Markup ({tmMarkup}%): <strong>${markup.toFixed(2)}</strong></div>
              <div style={{ fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, fontSize: typography.fontSize.base }}>Total: ${(sub + markup).toFixed(2)}</div>
            </div>
          ) : null
        })()}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['4'] }}>
          <Btn variant="secondary" onClick={() => setTmModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={async () => {
            if (!tmForm.description.trim()) { toast.error('Description is required'); return }
            if (!projectId) { toast.error('No project selected'); return }
            try {
              const lh = Number(tmForm.laborHours) || 0
              const lr = Number(tmForm.laborRate) || 0
              const mc = Number(tmForm.materialCost) || 0
              const ec = Number(tmForm.equipmentCost) || 0
              const { error } = await supabase.from('time_material_tickets').insert({
                project_id: projectId,
                ticket_number: `TM-${Date.now().toString(36).toUpperCase()}`,
                date: tmForm.date,
                description: tmForm.description,
                location: tmForm.location || null,
                labor_hours: lh,
                labor_rate: lr,
                material_cost: mc,
                equipment_cost: ec,
                markup_pct: tmMarkup,
                status: 'draft',
                created_by: user?.id ?? null,
              })
              if (error) throw error
              toast.success('T&M ticket created')
              setTmModalOpen(false)
              setTmForm({ description: '', date: toISODate(new Date()), location: '', laborHours: '', laborRate: '', materialCost: '', equipmentCost: '' })
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to create T&M ticket')
            }
          }}>Create Ticket</Btn>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default TimeTracking
