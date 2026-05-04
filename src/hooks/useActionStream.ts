// ─────────────────────────────────────────────────────────────────────────────
// useActionStream — Unified prioritized stream
// ─────────────────────────────────────────────────────────────────────────────
// Aggregates every actionable item across the project into one sorted,
// role-filtered array. The data backbone of the homepage redesign.
//
// Reads (only): existing query hooks. Does NOT add new Supabase queries.
// Writes: nothing — pure derivation + Iris decoration.
//
// Role flow:
//   1. If `role` arg is provided, use it directly.
//   2. Otherwise read the user's ProjectRole via usePermissions and convert
//      with toStreamRole().
//   3. Magic-link subs flow through the same path with companyId from
//      ActorContext, so the subcontractor filter works in both auth modes.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useEffect } from 'react'
import type {
  ActionStreamResult,
  StreamItem,
  StreamRole,
  StreamAction,
  SourceReference,
  SnoozeDuration,
} from '../types/stream'
import { toStreamRole } from '../types/stream'
import { ROLE_FILTERS } from '../config/roleFilters'
import { useStreamStore } from '../stores/streamStore'
import { useActor } from '../contexts/ActorContext'
import { useAuth } from './useAuth'
import { usePermissions } from './usePermissions'
import { useProjectId } from './useProjectId'
import { useRFIs } from './queries/rfis'
import { usePunchItems } from './queries/punch-items'
import { useSubmittals } from './queries/submittals'
import { useTasks } from './queries/tasks'
import { useIncidents } from './queries/incidents'
import { useDailyLogs } from './queries/daily-logs'
import { useScheduleActivities } from './useScheduleActivities'
import { detectIrisEnhancements } from '../services/iris'

// ── Date helpers ────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isoDateOnly(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10)
}

function pastDue(due: string | null | undefined, now: Date): boolean {
  if (!due) return false
  const t = Date.parse(due)
  if (!Number.isFinite(t)) return false
  return t < now.getTime()
}

function daysOverdue(due: string | null | undefined, now: Date): number {
  if (!due) return 0
  const t = Date.parse(due)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_DAY))
}

function dueWithinDays(due: string | null | undefined, days: number, now: Date): boolean {
  if (!due) return false
  const t = Date.parse(due)
  if (!Number.isFinite(t)) return false
  const diff = t - now.getTime()
  return diff >= 0 && diff <= days * MS_PER_DAY
}

function formatRelativeDue(due: string | null | undefined, now: Date): string {
  if (!due) return 'No due date'
  const t = Date.parse(due)
  if (!Number.isFinite(t)) return 'No due date'
  const dayDiff = Math.round((startOfDay(new Date(t)).getTime() - startOfDay(now).getTime()) / MS_PER_DAY)
  if (dayDiff === 0) return 'Due today'
  if (dayDiff === 1) return 'Due tomorrow'
  if (dayDiff > 1) return `Due in ${dayDiff} days`
  if (dayDiff === -1) return '1 day overdue'
  return `${-dayDiff} days overdue`
}

// ── Per-source transformers ─────────────────────────────────────────────────
// Each transformer returns 0..N StreamItems. The hook concatenates them all.

interface RFIRow {
  id: string
  number: number
  title: string
  status: string | null
  due_date: string | null
  response_due_date: string | null
  assigned_to: string | null
  ball_in_court: string | null
  cost_impact: number | null
  schedule_impact: string | null
  created_at: string | null
  drawing_reference: string | null
  spec_section: string | null
}

const RFI_TERMINAL: ReadonlyArray<string> = ['closed', 'answered', 'void', 'voided']

function transformRFI(row: RFIRow, now: Date): StreamItem {
  const due = row.response_due_date ?? row.due_date
  const overdue = pastDue(due, now)
  const status = (row.status ?? '').toLowerCase()
  const waitingOnYou = ['open', 'under_review', 'draft', ''].includes(status)
  const urgency: StreamItem['urgency'] = overdue
    ? 'critical'
    : dueWithinDays(due, 2, now) ? 'high'
    : 'medium'
  const reason = overdue
    ? `${daysOverdue(due, now)} days overdue`
    : formatRelativeDue(due, now)

  const sourceTrail: SourceReference[] = []
  if (row.drawing_reference) {
    sourceTrail.push({
      type: 'drawing',
      id: row.drawing_reference,
      title: `Drawing ${row.drawing_reference}`,
      url: `/drawings?ref=${encodeURIComponent(row.drawing_reference)}`,
    })
  }
  if (row.spec_section) {
    sourceTrail.push({
      type: 'spec',
      id: row.spec_section,
      title: `Spec ${row.spec_section}`,
      url: `/documents?spec=${encodeURIComponent(row.spec_section)}`,
    })
  }
  sourceTrail.push({
    type: 'rfi',
    id: row.id,
    title: `RFI #${row.number}`,
    url: `/rfis/${row.id}`,
  })

  const actions: StreamAction[] = [
    { label: 'Respond', type: 'primary', handler: 'respond', permissionKey: 'rfis.respond' },
    { label: 'Reassign', type: 'secondary', handler: 'reassign', permissionKey: 'rfis.edit' },
    { label: 'Snooze', type: 'dismiss', handler: 'snooze' },
  ]

  return {
    id: `rfi-${row.id}`,
    type: 'rfi',
    cardType: overdue ? 'risk' : 'action',
    title: `RFI #${row.number} — ${row.title}`,
    reason,
    urgency,
    dueDate: due ?? null,
    assignedTo: row.ball_in_court ?? row.assigned_to ?? null,
    waitingOnYou,
    overdue,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    sourceData: row,
    sourceTrail,
    actions,
    costImpact: row.cost_impact ?? undefined,
  }
}

interface PunchRow {
  id: string
  number: number
  title: string
  status: string | null
  due_date: string | null
  assigned_to: string | null
  created_at: string | null
}

const PUNCH_TERMINAL: ReadonlyArray<string> = ['verified', 'closed', 'completed']

function transformPunch(row: PunchRow, now: Date): StreamItem {
  const overdue = pastDue(row.due_date, now)
  const status = (row.status ?? '').toLowerCase()
  const urgency: StreamItem['urgency'] = overdue
    ? 'high'
    : status === 'open' || status === '' ? 'medium' : 'low'

  return {
    id: `punch-${row.id}`,
    type: 'punch',
    cardType: 'action',
    title: `Punch #${row.number} — ${row.title}`,
    reason: overdue
      ? `${daysOverdue(row.due_date, now)} days overdue`
      : formatRelativeDue(row.due_date, now),
    urgency,
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    waitingOnYou: status === 'open',
    overdue,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    sourceData: row,
    sourceTrail: [{
      type: 'rfi',
      id: row.id,
      title: `Punch #${row.number}`,
      url: `/punch/${row.id}`,
    }],
    actions: [
      { label: 'Mark Complete', type: 'primary', handler: 'complete', permissionKey: 'punch_list.edit' },
      { label: 'Reassign', type: 'secondary', handler: 'reassign', permissionKey: 'punch_list.edit' },
      { label: 'Snooze', type: 'dismiss', handler: 'snooze' },
    ],
  }
}

interface SubmittalRow {
  id: string
  number: number
  title: string
  status: string | null
  due_date: string | null
  assigned_to: string | null
  created_at: string | null
  spec_section: string | null
}

const SUBMITTAL_INCLUDE: ReadonlyArray<string> = ['pending_review', 'in_review', 'submitted', 'draft']

function transformSubmittal(row: SubmittalRow, now: Date): StreamItem {
  const overdue = pastDue(row.due_date, now)
  return {
    id: `sub-${row.id}`,
    type: 'submittal',
    cardType: overdue ? 'risk' : 'action',
    title: `Submittal #${row.number} — ${row.title}`,
    reason: overdue
      ? `${daysOverdue(row.due_date, now)} days overdue`
      : formatRelativeDue(row.due_date, now),
    urgency: overdue ? 'high' : 'medium',
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    waitingOnYou: (row.status ?? '').toLowerCase() === 'pending_review',
    overdue,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    sourceData: row,
    sourceTrail: row.spec_section
      ? [
          { type: 'spec', id: row.spec_section, title: `Spec ${row.spec_section}`, url: `/documents?spec=${encodeURIComponent(row.spec_section)}` },
          { type: 'submittal', id: row.id, title: `Submittal #${row.number}`, url: `/submittals/${row.id}` },
        ]
      : [{ type: 'submittal', id: row.id, title: `Submittal #${row.number}`, url: `/submittals/${row.id}` }],
    actions: [
      { label: 'Review', type: 'primary', handler: 'review', permissionKey: 'submittals.approve' },
      { label: 'Reassign', type: 'secondary', handler: 'reassign', permissionKey: 'submittals.edit' },
      { label: 'Snooze', type: 'dismiss', handler: 'snooze' },
    ],
  }
}

interface TaskRow {
  id: string
  title: string
  status: string | null
  due_date: string | null
  assigned_to: string | null
  created_at: string | null
}

const TASK_TERMINAL: ReadonlyArray<string> = ['done', 'completed', 'cancelled']

function transformTask(row: TaskRow, now: Date): StreamItem {
  const overdue = pastDue(row.due_date, now)
  const todayStr = isoDateOnly(now)
  const dueOnlyDate = row.due_date ? row.due_date.slice(0, 10) : null
  const dueToday = dueOnlyDate === todayStr
  const dueThisWeek = dueWithinDays(row.due_date, 7, now)

  const urgency: StreamItem['urgency'] = overdue || dueToday
    ? 'high'
    : dueThisWeek ? 'medium' : 'low'

  return {
    id: `task-${row.id}`,
    type: 'task',
    cardType: 'action',
    title: row.title,
    reason: overdue
      ? `${daysOverdue(row.due_date, now)} days overdue`
      : formatRelativeDue(row.due_date, now),
    urgency,
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    waitingOnYou: !!row.assigned_to,
    overdue,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    sourceData: row,
    sourceTrail: [],
    actions: [
      { label: 'Complete', type: 'primary', handler: 'complete', permissionKey: 'tasks.edit' },
      { label: 'Reassign', type: 'secondary', handler: 'reassign', permissionKey: 'tasks.edit' },
      { label: 'Snooze', type: 'dismiss', handler: 'snooze' },
    ],
  }
}

interface IncidentRow {
  id: string
  type: string | null
  date: string
  investigation_status: string | null
  description: string
  created_at: string | null
}

const INCIDENT_TERMINAL: ReadonlyArray<string> = ['closed', 'completed', 'resolved']

function transformIncident(row: IncidentRow, now: Date): StreamItem {
  return {
    id: `incident-${row.id}`,
    type: 'incident',
    cardType: 'risk',
    title: `Safety Incident — ${row.type || 'Reported'}`,
    reason: row.description?.slice(0, 80) ?? 'Awaiting investigation',
    urgency: 'critical',
    dueDate: null,
    assignedTo: null,
    waitingOnYou: true,
    overdue: false,
    createdAt: row.created_at ?? row.date ?? now.toISOString(),
    sourceData: row,
    sourceTrail: [{
      type: 'inspection',
      id: row.id,
      title: 'Safety incident report',
      url: `/safety/incidents/${row.id}`,
    }],
    actions: [
      { label: 'Review', type: 'primary', handler: 'review', permissionKey: 'safety.manage' },
      { label: 'Assign', type: 'secondary', handler: 'assign', permissionKey: 'safety.manage' },
    ],
  }
}

interface DailyLogRow {
  log_date: string
  status: string | null
}

function deriveDailyLogItems(rows: DailyLogRow[], now: Date): StreamItem[] {
  const todayStr = isoDateOnly(now)
  const yesterday = new Date(now.getTime() - MS_PER_DAY)
  const yesterdayStr = isoDateOnly(yesterday)

  const items: StreamItem[] = []

  const yesterdayLog = rows.find((r) => r.log_date === yesterdayStr)
  const yesterdaySubmitted = yesterdayLog && (yesterdayLog.status ?? '').toLowerCase() === 'submitted'
  if (now.getHours() >= 6 && !yesterdaySubmitted) {
    items.push({
      id: `log-${yesterdayStr}`,
      type: 'daily_log',
      cardType: 'action',
      title: `Daily Log — ${yesterdayStr}`,
      reason: "Yesterday's log not submitted",
      urgency: 'high',
      dueDate: yesterdayStr,
      assignedTo: null,
      waitingOnYou: true,
      overdue: true,
      createdAt: yesterday.toISOString(),
      sourceData: { log_date: yesterdayStr },
      sourceTrail: [],
      actions: [
        { label: 'Start Log', type: 'primary', handler: 'create_log', permissionKey: 'daily_log.create' },
      ],
    })
  }

  const todayLog = rows.find((r) => r.log_date === todayStr)
  if (now.getHours() >= 14 && !todayLog) {
    items.push({
      id: `log-${todayStr}`,
      type: 'daily_log',
      cardType: 'action',
      title: `Daily Log — ${todayStr}`,
      reason: "Today's log not started",
      urgency: 'medium',
      dueDate: todayStr,
      assignedTo: null,
      waitingOnYou: true,
      overdue: false,
      createdAt: now.toISOString(),
      sourceData: { log_date: todayStr },
      sourceTrail: [],
      actions: [
        { label: 'Start Log', type: 'primary', handler: 'create_log', permissionKey: 'daily_log.create' },
      ],
    })
  }

  return items
}

interface ScheduleRow {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  percent_complete: number | null
  is_critical_path: boolean | null
  status: string | null
  created_at: string | null
}

function expectedPercentComplete(start: string | null, end: string | null, now: Date): number | null {
  if (!start || !end) return null
  const s = Date.parse(start)
  const e = Date.parse(end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
  const ratio = (now.getTime() - s) / (e - s)
  if (ratio <= 0) return 0
  if (ratio >= 1) return 100
  return ratio * 100
}

function transformSchedule(row: ScheduleRow, now: Date): StreamItem | null {
  const expected = expectedPercentComplete(row.start_date, row.end_date, now)
  const actual = row.percent_complete ?? 0
  const behind = expected != null && actual + 1 < expected   // >=1pp under is "behind"
  const critical = !!row.is_critical_path

  if (!behind && !critical) return null
  if (!behind && critical) {
    // On-track critical path activity is informational, not actionable.
    return null
  }

  // Behind by N days = (deficit% / 100) * total duration in days, capped.
  let delayDays = 0
  if (expected != null && row.start_date && row.end_date) {
    const total = (Date.parse(row.end_date) - Date.parse(row.start_date)) / MS_PER_DAY
    delayDays = Math.max(0, Math.round(((expected - actual) / 100) * total))
  }

  return {
    id: `schedule-${row.id}`,
    type: 'schedule',
    cardType: 'risk',
    title: `Schedule — ${row.name}`,
    reason: critical && behind ? 'Critical path at risk' : `${delayDays} days behind`,
    urgency: critical && behind ? 'critical' : 'high',
    dueDate: row.end_date,
    assignedTo: null,
    waitingOnYou: false,
    overdue: pastDue(row.end_date, now),
    createdAt: row.created_at ?? new Date(0).toISOString(),
    sourceData: row,
    sourceTrail: [{
      type: 'schedule_activity',
      id: row.id,
      title: row.name,
      url: `/schedule?activity=${encodeURIComponent(row.id)}`,
    }],
    actions: [
      { label: 'View Schedule', type: 'primary', handler: 'view_schedule', permissionKey: 'schedule.view' },
      { label: 'Add to Report', type: 'secondary', handler: 'add_to_report', permissionKey: 'reports.view' },
    ],
    scheduleImpactDays: delayDays || undefined,
  }
}

// ── Sort ────────────────────────────────────────────────────────────────────

const URGENCY_ORDER: Record<StreamItem['urgency'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function sortStream(items: StreamItem[]): StreamItem[] {
  return [...items].sort((a, b) => {
    if (URGENCY_ORDER[a.urgency] !== URGENCY_ORDER[b.urgency]) {
      return URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    }
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    if (a.waitingOnYou !== b.waitingOnYou) return a.waitingOnYou ? -1 : 1
    if (a.dueDate && b.dueDate) {
      const ta = Date.parse(a.dueDate)
      const tb = Date.parse(b.dueDate)
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
    }
    if (a.dueDate && !b.dueDate) return -1
    if (!a.dueDate && b.dueDate) return 1
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useActionStream(role?: StreamRole): ActionStreamResult {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { role: projectRole } = usePermissions()
  const actor = useActor()

  const rfisQ = useRFIs(projectId)
  const punchQ = usePunchItems(projectId)
  const submittalsQ = useSubmittals(projectId)
  const tasksQ = useTasks(projectId)
  const incidentsQ = useIncidents(projectId)
  const dailyLogsQ = useDailyLogs(projectId)
  const scheduleQ = useScheduleActivities(projectId ?? '')

  // Track per-user snooze persistence in localStorage.
  const setUserKey = useStreamStore((s) => s.setUserKey)
  useEffect(() => {
    setUserKey(user?.id ?? actor.userId ?? actor.magicLinkTokenId ?? null)
  }, [user?.id, actor.userId, actor.magicLinkTokenId, setUserKey])

  const dismissedIds = useStreamStore((s) => s.dismissedIds)
  const snoozedItems = useStreamStore((s) => s.snoozedItems)
  const dismiss = useStreamStore((s) => s.dismiss)
  const snooze = useStreamStore((s) => s.snooze)

  const effectiveRole: StreamRole = role ?? toStreamRole(projectRole)
  const filterCtx = { companyId: actor.companyId }

  const result = useMemo(() => {
    const now = new Date()
    const assembled: StreamItem[] = []

    const rfis = (rfisQ.data?.data ?? []) as unknown as RFIRow[]
    for (const r of rfis) {
      if (RFI_TERMINAL.includes((r.status ?? '').toLowerCase())) continue
      assembled.push(transformRFI(r, now))
    }

    const punchItems = (punchQ.data?.data ?? []) as unknown as PunchRow[]
    for (const p of punchItems) {
      if (PUNCH_TERMINAL.includes((p.status ?? '').toLowerCase())) continue
      assembled.push(transformPunch(p, now))
    }

    const submittals = (submittalsQ.data?.data ?? []) as unknown as SubmittalRow[]
    for (const s of submittals) {
      const status = (s.status ?? '').toLowerCase()
      if (!SUBMITTAL_INCLUDE.includes(status)) continue
      assembled.push(transformSubmittal(s, now))
    }

    const tasks = (tasksQ.data?.data ?? []) as unknown as TaskRow[]
    for (const t of tasks) {
      if (TASK_TERMINAL.includes((t.status ?? '').toLowerCase())) continue
      assembled.push(transformTask(t, now))
    }

    const incidents = (incidentsQ.data ?? []) as unknown as IncidentRow[]
    for (const i of incidents) {
      if (INCIDENT_TERMINAL.includes((i.investigation_status ?? '').toLowerCase())) continue
      assembled.push(transformIncident(i, now))
    }

    const logs = (dailyLogsQ.data?.data ?? []) as DailyLogRow[]
    assembled.push(...deriveDailyLogItems(logs, now))

    const schedule = (scheduleQ.data ?? []) as unknown as ScheduleRow[]
    for (const a of schedule) {
      const item = transformSchedule(a, now)
      if (item) assembled.push(item)
    }

    // Hidden items (snoozed past resurface time are pruned on read by the store).
    const visible = assembled.filter((item) => {
      if (dismissedIds.has(item.id)) return false
      const until = snoozedItems.get(item.id)
      if (until) {
        const t = Date.parse(until)
        if (Number.isFinite(t) && t > now.getTime()) return false
      }
      return true
    })

    const filterFn = ROLE_FILTERS[effectiveRole]
    const roleFiltered = visible.filter((item) => filterFn(item, filterCtx))

    const sorted = sortStream(roleFiltered)
    const decorated = detectIrisEnhancements(sorted)

    const counts = decorated.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.urgency === 'critical') acc.critical += 1
        if (item.overdue) acc.overdue += 1
        if (item.waitingOnYou) acc.waitingOnYou += 1
        return acc
      },
      { total: 0, critical: 0, overdue: 0, waitingOnYou: 0 },
    )

    return { items: decorated, counts }
  }, [
    rfisQ.data, punchQ.data, submittalsQ.data, tasksQ.data,
    incidentsQ.data, dailyLogsQ.data, scheduleQ.data,
    dismissedIds, snoozedItems,
    effectiveRole, filterCtx.companyId,
  ])

  const isLoading = !!(
    rfisQ.isLoading || punchQ.isLoading || submittalsQ.isLoading ||
    tasksQ.isLoading || incidentsQ.isLoading || dailyLogsQ.isLoading ||
    scheduleQ.isLoading
  )

  const error = (
    rfisQ.error ?? punchQ.error ?? submittalsQ.error ?? tasksQ.error ??
    incidentsQ.error ?? dailyLogsQ.error ?? scheduleQ.error ?? null
  ) as Error | null

  function refetch(): void {
    void rfisQ.refetch?.()
    void punchQ.refetch?.()
    void submittalsQ.refetch?.()
    void tasksQ.refetch?.()
    void incidentsQ.refetch?.()
    void dailyLogsQ.refetch?.()
    void scheduleQ.refetch?.()
  }

  return {
    items: result.items,
    counts: result.counts,
    isLoading,
    error,
    refetch,
    dismiss,
    snooze: (id: string, duration: SnoozeDuration) => snooze(id, duration),
  }
}
