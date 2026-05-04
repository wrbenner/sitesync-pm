// ─────────────────────────────────────────────────────────────────────────────
// Tasks — the unified PM/Super inbox (investor-readiness push)
// ─────────────────────────────────────────────────────────────────────────────
// Mission: catch-all inbox for the messy stuff. RFIs / Punch / Submittals are
// formal records; Tasks are everything else — "send drone over Bldg B Friday",
// "follow up with Smith on glass mockup", "check the back wall flashing".
// Things / Linear feel: dense, keyboard-driven, inline add, no nav-on-click.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import { ErrorBoundary } from '../components/ErrorBoundary'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useAuth } from '../hooks/useAuth'
import { useProjectId } from '../hooks/useProjectId'
import { usePermissions } from '../hooks/usePermissions'
import { useTasks } from '../hooks/queries/tasks'
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/mutations/tasks'
import { useProfileNames, displayName } from '../hooks/queries/profiles'
import { useConfirm } from '../components/ConfirmDialog'
import type { Task } from '../types/database'

// ── Tokens (DESIGN-RESET.md) ────────────────────────────────────────────────

const C = {
  surface: '#FCFCFA',
  surfaceAlt: '#F5F5F1',
  surfaceHover: '#F0EFEB',
  surfaceSelected: 'rgba(244, 120, 32, 0.06)',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  brandOrange: '#F47820',
  critical: '#C93B3B',
  high: '#B8472E',
  pending: '#C4850C',
  active: '#2D8A6E',
  indigo: '#4F46E5',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

// ── Types ───────────────────────────────────────────────────────────────────

type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
type Priority = 'low' | 'medium' | 'high' | 'critical'

const STATUS_OPTIONS: Status[] = ['todo', 'in_progress', 'in_review', 'done']
const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high', 'critical']

// Display-only mapping. Underlying state machine still uses todo/in_review;
// "Blocked" reads better on a PM inbox than "In Review" for free-form tasks.
const STATUS_LABEL: Record<Status, string> = {
  todo: 'Open',
  in_progress: 'In Progress',
  in_review: 'Blocked',
  done: 'Done',
}

const STATUS_TONE: Record<Status, { color: string; bg: string }> = {
  todo: { color: C.ink2, bg: 'rgba(92, 85, 80, 0.06)' },
  in_progress: { color: C.brandOrange, bg: 'rgba(244, 120, 32, 0.10)' },
  in_review: { color: C.high, bg: 'rgba(184, 71, 46, 0.10)' },
  done: { color: C.active, bg: 'rgba(45, 138, 110, 0.10)' },
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  critical: 'Critical',
}

const PRIORITY_TONE: Record<Priority, { color: string; bg: string }> = {
  low: { color: C.ink3, bg: 'rgba(140, 133, 126, 0.08)' },
  medium: { color: C.pending, bg: 'rgba(196, 133, 12, 0.08)' },
  high: { color: C.high, bg: 'rgba(184, 71, 46, 0.10)' },
  critical: { color: C.critical, bg: 'rgba(201, 59, 59, 0.10)' },
}

// ── Filters ─────────────────────────────────────────────────────────────────

type Filter = 'all' | 'mine' | 'today' | 'overdue' | 'this_week' | 'done'

const FILTER_ORDER: Filter[] = ['all', 'mine', 'today', 'overdue', 'this_week', 'done']

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  mine: 'Mine',
  today: 'Today',
  overdue: 'Overdue',
  this_week: 'This Week',
  done: 'Done',
}

// ── Group modes ─────────────────────────────────────────────────────────────

type GroupMode = 'flat' | 'assignee' | 'priority' | 'linked'

const GROUP_OPTIONS: GroupMode[] = ['flat', 'assignee', 'priority', 'linked']
const GROUP_LABEL: Record<GroupMode, string> = {
  flat: 'Flat',
  assignee: 'Assignee',
  priority: 'Priority',
  linked: 'Linked',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function endOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(23, 59, 59, 999)
  return c
}

function endOfWeek(d: Date): Date {
  // Week ends Sunday 23:59
  const day = d.getDay()
  const c = new Date(d)
  c.setDate(c.getDate() + (7 - day) % 7)
  c.setHours(23, 59, 59, 999)
  return c
}

function fmtDue(due: string | null | undefined): { label: string; tone: string } {
  if (!due) return { label: '—', tone: C.ink4 }
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return { label: '—', tone: C.ink4 }
  const now = new Date()
  const today = startOfDay(now)
  const todayEnd = endOfDay(now)
  const ms = d.getTime() - today.getTime()
  const days = Math.round(ms / 86400000)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (d.getTime() < today.getTime()) return { label: `${dateStr}`, tone: C.critical }
  if (d.getTime() <= todayEnd.getTime()) return { label: 'Today', tone: C.brandOrange }
  if (days === 1) return { label: 'Tomorrow', tone: C.pending }
  if (days <= 7) return { label: dateStr, tone: C.ink2 }
  return { label: dateStr, tone: C.ink3 }
}

function pickLinkedKey(t: Task): string {
  // Tasks don't carry a direct linked-entity column; we infer a coarse bucket
  // from the title for the "by Linked" group toggle so the grouping is at
  // least useful before the entity-link integration lands. Keys are stable
  // and small, so collapse-state can persist across re-groups.
  const title = (t.title ?? '').toLowerCase()
  if (/\brfi[\s#-]*\d+/.test(title)) return 'RFI'
  if (/\bpunch\b/.test(title)) return 'Punch'
  if (/\bsubmittal\b/.test(title)) return 'Submittal'
  if (/\bdrawing\b|\bsheet\b/.test(title)) return 'Drawing'
  if (/\bdaily log\b|\bdaily report\b/.test(title)) return 'Daily Log'
  return 'Unlinked'
}

// ── Page ────────────────────────────────────────────────────────────────────

const TasksPage: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission('tasks.create')
  const canEdit = hasPermission('tasks.edit')

  const { data: tasksResult, isPending } = useTasks(projectId)
  const tasks: Task[] = useMemo(() => tasksResult?.data ?? [], [tasksResult])

  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { confirm, dialog: confirmDialog } = useConfirm()

  // ── UI state ────────────────────────────────────────────────────────────

  const [filter, setFilter] = useState<Filter>('all')
  const [groupMode, setGroupMode] = useState<GroupMode>('flat')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set())
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')

  // Quick-add row state — title-only required.
  const [draftTitle, setDraftTitle] = useState('')
  const [draftAssignee, setDraftAssignee] = useState('')
  const [draftDue, setDraftDue] = useState('')
  const draftTitleRef = useRef<HTMLInputElement>(null)
  const draftAssigneeRef = useRef<HTMLInputElement>(null)
  const draftDueRef = useRef<HTMLInputElement>(null)

  const focusQuickAdd = useCallback(() => {
    draftTitleRef.current?.focus()
    draftTitleRef.current?.select()
  }, [])

  const submitQuickAdd = useCallback(async () => {
    if (!projectId) return
    const title = draftTitle.trim()
    if (!title) {
      draftTitleRef.current?.focus()
      return
    }
    try {
      await createTask.mutateAsync({
        data: {
          project_id: projectId,
          title,
          assigned_to: draftAssignee.trim() || null,
          due_date: draftDue || null,
          status: 'todo',
          priority: 'medium',
          is_critical_path: false,
        },
        projectId,
      })
      setDraftTitle('')
      setDraftAssignee('')
      setDraftDue('')
      draftTitleRef.current?.focus()
      toast.success('Task created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task')
    }
  }, [projectId, draftTitle, draftAssignee, draftDue, createTask])

  // Resolve assignee UUIDs to names so the table never renders a raw UUID.
  // Filter / sort / group still operate on the raw id (internal); only the
  // visible cell text is swapped for the resolved name.
  const { data: profileMap } = useProfileNames(tasks.map((t) => (t.assigned_to as string | null) ?? null))

  // ── Filter + search ─────────────────────────────────────────────────────

  const filtered = useMemo<Task[]>(() => {
    if (tasks.length === 0) return []
    const now = new Date()
    const todayStart = startOfDay(now).getTime()
    const todayEnd = endOfDay(now).getTime()
    const weekEnd = endOfWeek(now).getTime()

    let arr = tasks
    if (filter === 'mine') {
      const me = user?.email ?? user?.id ?? ''
      arr = arr.filter((t) => {
        const a = (t.assigned_to as string | null) ?? ''
        return a && (a === user?.id || a === me)
      })
    } else if (filter === 'today') {
      arr = arr.filter((t) => {
        if (!t.due_date) return false
        const dt = new Date(t.due_date).getTime()
        return dt >= todayStart && dt <= todayEnd && t.status !== 'done'
      })
    } else if (filter === 'overdue') {
      arr = arr.filter((t) => {
        if (!t.due_date) return false
        const dt = new Date(t.due_date).getTime()
        return dt < todayStart && t.status !== 'done'
      })
    } else if (filter === 'this_week') {
      arr = arr.filter((t) => {
        if (!t.due_date) return false
        const dt = new Date(t.due_date).getTime()
        return dt >= todayStart && dt <= weekEnd && t.status !== 'done'
      })
    } else if (filter === 'done') {
      arr = arr.filter((t) => t.status === 'done')
    }

    const q = search.trim().toLowerCase()
    if (q) {
      arr = arr.filter((t) => {
        return (
          (t.title ?? '').toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.assigned_to ?? '').toLowerCase().includes(q)
        )
      })
    }
    // Sort: not-done by (overdue first, then due-date asc, then priority desc),
    // done last by updated_at desc. Mirrors how Things ranks "what next".
    const PRI_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...arr].sort((a, b) => {
      const aDone = a.status === 'done'
      const bDone = b.status === 'done'
      if (aDone !== bDone) return aDone ? 1 : -1
      const adt = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const bdt = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      if (adt !== bdt) return adt - bdt
      const ap = (a.priority as Priority) ?? 'medium'
      const bp = (b.priority as Priority) ?? 'medium'
      return PRI_RANK[ap] - PRI_RANK[bp]
    })
  }, [tasks, filter, search, user?.id, user?.email])

  // ── Counts (filter chips show numbers) ──────────────────────────────────

  const counts = useMemo<Record<Filter, number>>(() => {
    const now = new Date()
    const todayStart = startOfDay(now).getTime()
    const todayEnd = endOfDay(now).getTime()
    const weekEnd = endOfWeek(now).getTime()
    const me = user?.email ?? user?.id ?? ''
    const c: Record<Filter, number> = { all: tasks.length, mine: 0, today: 0, overdue: 0, this_week: 0, done: 0 }
    for (const t of tasks) {
      const a = (t.assigned_to as string | null) ?? ''
      const isMine = !!a && (a === user?.id || a === me)
      if (isMine) c.mine++
      if (t.status === 'done') {
        c.done++
        continue
      }
      if (!t.due_date) continue
      const dt = new Date(t.due_date).getTime()
      if (dt < todayStart) c.overdue++
      if (dt >= todayStart && dt <= todayEnd) c.today++
      if (dt >= todayStart && dt <= weekEnd) c.this_week++
    }
    return c
  }, [tasks, user?.id, user?.email])

  // ── Groups ──────────────────────────────────────────────────────────────

  const groups = useMemo<{ key: string; label: string; rows: Task[] }[]>(() => {
    if (groupMode === 'flat') return [{ key: 'all', label: '', rows: filtered }]
    const map = new Map<string, Task[]>()
    if (groupMode === 'assignee') {
      for (const t of filtered) {
        const k = (t.assigned_to as string | null)?.trim() || 'Unassigned'
        const list = map.get(k) ?? []
        list.push(t)
        map.set(k, list)
      }
    } else if (groupMode === 'priority') {
      for (const p of PRIORITY_OPTIONS) map.set(p, [])
      for (const t of filtered) {
        const p = (t.priority as Priority) ?? 'medium'
        ;(map.get(p) ?? []).push(t)
      }
    } else {
      // linked
      for (const t of filtered) {
        const k = pickLinkedKey(t)
        const list = map.get(k) ?? []
        list.push(t)
        map.set(k, list)
      }
    }
    const entries = [...map.entries()].filter(([, rows]) => rows.length > 0)
    if (groupMode === 'priority') {
      entries.sort(([a], [b]) =>
        PRIORITY_OPTIONS.indexOf(a as Priority) - PRIORITY_OPTIONS.indexOf(b as Priority),
      )
      return entries.map(([k, rows]) => ({ key: k, label: PRIORITY_LABEL[k as Priority] ?? k, rows }))
    }
    entries.sort(([a], [b]) => {
      if (a === 'Unassigned' || a === 'Unlinked') return 1
      if (b === 'Unassigned' || b === 'Unlinked') return -1
      return a.localeCompare(b)
    })
    return entries.map(([k, rows]) => ({ key: k, label: k, rows }))
  }, [filtered, groupMode])

  // Visible (focusable) row order for keyboard nav.
  const visibleRows = useMemo<Task[]>(() => {
    const out: Task[] = []
    for (const g of groups) {
      if (groupMode !== 'flat' && closedGroups.has(g.key)) continue
      out.push(...g.rows)
    }
    return out
  }, [groups, closedGroups, groupMode])

  const [focusIndexRaw, setFocusIndex] = useState(0)
  const focusIndex = visibleRows.length === 0 ? 0 : Math.min(focusIndexRaw, visibleRows.length - 1)
  const focusedTask = visibleRows[focusIndex] ?? null

  const tableRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusedTask) return
    const node = tableRef.current?.querySelector<HTMLElement>(`[data-task-row-id="${focusedTask.id}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [focusedTask])

  // ── Deep-link via ?focus=:id ────────────────────────────────────────────
  // External callers (search results, dashboard tiles, Iris drafts) can link
  // straight to a task. We move the keyboard focus to the matching row,
  // scroll it into view, and apply a 2s highlight ring that fades. The
  // param is read once per (taskId × tasks-loaded) so reloading the page
  // re-flashes; manual j/k navigation afterwards isn't disturbed.
  const [searchParams, setSearchParams] = useSearchParams()
  const focusParam = searchParams.get('focus')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  useEffect(() => {
    if (!focusParam) return
    if (tasks.length === 0) return // wait for data
    // If the task exists but isn't in visibleRows, the active filter is
    // hiding it. Reset to 'all' so the row materializes; the next render
    // pass picks up the focus + scroll.
    const inAll = tasks.some((t) => t.id === focusParam)
    if (!inAll) return // unknown id (wrong project, deleted)
    const inVisible = visibleRows.findIndex((t) => t.id === focusParam)
    if (inVisible < 0) {
      // Filter is hiding the target — reset filters so the row materializes,
      // then this effect re-runs on the next visibleRows change. The cascading
      // render here is intentional and bounded (one extra paint), not a loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilter('all')
      setSearch('')
      // Also expand any closed group containing the task so it's reachable.
      setClosedGroups(new Set())
      return
    }
    setFocusIndex(inVisible)
    setHighlightId(focusParam)
    // Scroll deferred to next frame so the row is mounted.
    requestAnimationFrame(() => {
      const node = tableRef.current?.querySelector<HTMLElement>(`[data-task-row-id="${focusParam}"]`)
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    // Drop the highlight after 2s; clear the URL param so a refocus elsewhere
    // (e.g. user clicks another row) doesn't keep re-flashing.
    const t = window.setTimeout(() => {
      setHighlightId(null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('focus')
          return next
        },
        { replace: true },
      )
    }, 2000)
    return () => window.clearTimeout(t)
    // visibleRows ref-equality changes whenever the task list refetches; we
    // intentionally DON'T re-run on every list change — only when the focus
    // target changes or the underlying task ids do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, tasks.length, visibleRows.length])

  // ── Mutations ───────────────────────────────────────────────────────────

  const cycleStatus = useCallback(async (task: Task) => {
    if (!projectId) return
    const cur = (task.status as Status) ?? 'todo'
    const next: Status = cur === 'done' ? 'todo' : 'done'
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { status: next }, projectId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }, [projectId, updateTask])

  const setStatus = useCallback(async (task: Task, status: Status) => {
    if (!projectId) return
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { status }, projectId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }, [projectId, updateTask])

  const setPriority = useCallback(async (task: Task, priority: Priority) => {
    if (!projectId) return
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { priority }, projectId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update priority')
    }
  }, [projectId, updateTask])

  const saveTitle = useCallback(async (task: Task, value: string) => {
    if (!projectId) return
    const title = value.trim()
    setEditingTitleId(null)
    if (!title || title === task.title) return
    try {
      await updateTask.mutateAsync({ id: task.id, updates: { title }, projectId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task')
    }
  }, [projectId, updateTask])

  const handleDelete = useCallback(async (task: Task) => {
    if (!projectId) return
    const ok = await confirm({
      title: 'Delete task?',
      description: `"${task.title}" — this cannot be undone.`,
      destructiveLabel: 'Delete task',
    })
    if (!ok) return
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId })
      toast.success('Task deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [projectId, confirm, deleteTask])

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setClosedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // ── Keyboard nav (page-level) ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      // Cmd/Ctrl+N anywhere → focus quick-add
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        focusQuickAdd()
        return
      }
      if (inField) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') {
        e.preventDefault()
        setFocusIndex((i) => Math.min(visibleRows.length - 1, i + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        if (!focusedTask) return
        e.preventDefault()
        toggleExpanded(focusedTask.id)
      } else if (e.key === 'c' || e.key === 'C') {
        if (!focusedTask || !canEdit) return
        e.preventDefault()
        void cycleStatus(focusedTask)
      } else if (e.key === 'e' || e.key === 'E') {
        if (!focusedTask || !canEdit) return
        e.preventDefault()
        setEditingTitleId(focusedTask.id)
        setTitleDraft(focusedTask.title ?? '')
      } else if (e.key === 'n' || e.key === 'N') {
        if (!canCreate) return
        e.preventDefault()
        focusQuickAdd()
      } else if (e.key === 'Escape') {
        if (editingTitleId) {
          e.preventDefault()
          setEditingTitleId(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visibleRows.length, focusedTask, toggleExpanded, cycleStatus, canEdit, canCreate, focusQuickAdd, editingTitleId])

  // ── Render ──────────────────────────────────────────────────────────────

  if (!projectId) return <PageEmpty title="Select a project to see tasks" />

  return (
    <Shell
      filter={filter}
      setFilter={setFilter}
      counts={counts}
      groupMode={groupMode}
      setGroupMode={setGroupMode}
      search={search}
      setSearch={setSearch}
      onNew={() => focusQuickAdd()}
      canCreate={canCreate}
      total={tasks.length}
      doneCount={counts.done}
      inProgressCount={tasks.filter((t) => t.status === 'in_progress').length}
    >
      <div ref={tableRef} style={{ flex: 1, overflow: 'auto', backgroundColor: C.surface }}>
        <table
          role="grid"
          aria-label="Tasks"
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontFamily: FONT,
            fontSize: 13,
            color: C.ink2,
          }}
        >
          <colgroup>
            <col style={{ width: 28 }} />
            <col />
            <col style={{ width: 160 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              <Th />
              <Th>Title</Th>
              <Th>Assignee</Th>
              <Th>Due</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Linked</Th>
              <Th>Iris</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {/* Quick-add row */}
            {canCreate && (
              <QuickAddRow
                title={draftTitle}
                setTitle={setDraftTitle}
                assignee={draftAssignee}
                setAssignee={setDraftAssignee}
                due={draftDue}
                setDue={setDraftDue}
                titleRef={draftTitleRef}
                assigneeRef={draftAssigneeRef}
                dueRef={draftDueRef}
                onSubmit={submitQuickAdd}
                pending={createTask.isPending}
              />
            )}

            {isPending && tasks.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '40px 24px', textAlign: 'center', color: C.ink3, fontSize: 13 }}>
                  Loading tasks…
                </td>
              </tr>
            )}

            {!isPending && filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '40px 24px', textAlign: 'center', color: C.ink3, fontSize: 13 }}>
                  {tasks.length === 0
                    ? 'No tasks yet — type a title above to capture the first one.'
                    : 'No tasks match this filter.'}
                </td>
              </tr>
            )}

            {groups.map((g) => {
              const groupClosed = groupMode !== 'flat' && closedGroups.has(g.key)
              return (
                <React.Fragment key={g.key}>
                  {groupMode !== 'flat' && (
                    <GroupHeaderRow
                      label={g.label}
                      count={g.rows.length}
                      closed={groupClosed}
                      onToggle={() => toggleGroup(g.key)}
                    />
                  )}
                  {!groupClosed &&
                    g.rows.map((t) => {
                      const status = (t.status as Status) ?? 'todo'
                      const priority = (t.priority as Priority) ?? 'medium'
                      const expandedRow = expanded.has(t.id)
                      const focused = focusedTask?.id === t.id
                      const highlighted = highlightId === t.id
                      const isEditingTitle = editingTitleId === t.id
                      return (
                        <React.Fragment key={t.id}>
                          <TaskRow
                            task={t}
                            assigneeName={displayName(profileMap, (t.assigned_to as string | null) ?? null, '')}
                            status={status}
                            priority={priority}
                            focused={focused}
                            highlighted={highlighted}
                            expanded={expandedRow}
                            isEditingTitle={isEditingTitle}
                            titleDraft={titleDraft}
                            setTitleDraft={setTitleDraft}
                            canEdit={canEdit}
                            onSelect={() => {
                              const idx = visibleRows.findIndex((v) => v.id === t.id)
                              if (idx >= 0) setFocusIndex(idx)
                            }}
                            onToggleExpanded={() => toggleExpanded(t.id)}
                            onToggleStatus={() => cycleStatus(t)}
                            onEditTitle={() => {
                              setEditingTitleId(t.id)
                              setTitleDraft(t.title ?? '')
                            }}
                            onSaveTitle={(v) => saveTitle(t, v)}
                            onCancelTitle={() => setEditingTitleId(null)}
                            onDelete={() => handleDelete(t)}
                          />
                          {expandedRow && (
                            <ExpandedRow
                              task={t}
                              status={status}
                              priority={priority}
                              canEdit={canEdit}
                              onSetStatus={(s) => setStatus(t, s)}
                              onSetPriority={(p) => setPriority(t, p)}
                              onClose={() => toggleExpanded(t.id)}
                            />
                          )}
                        </React.Fragment>
                      )
                    })}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {confirmDialog}
    </Shell>
  )
}

// ── Quick-add row ───────────────────────────────────────────────────────────

interface QuickAddRowProps {
  title: string
  setTitle: (v: string) => void
  assignee: string
  setAssignee: (v: string) => void
  due: string
  setDue: (v: string) => void
  titleRef: React.RefObject<HTMLInputElement | null>
  assigneeRef: React.RefObject<HTMLInputElement | null>
  dueRef: React.RefObject<HTMLInputElement | null>
  onSubmit: () => void
  pending: boolean
}

const QuickAddRow: React.FC<QuickAddRowProps> = ({
  title,
  setTitle,
  assignee,
  setAssignee,
  due,
  setDue,
  titleRef,
  assigneeRef,
  dueRef,
  onSubmit,
  pending,
}) => {
  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTitle('')
      setAssignee('')
      setDue('')
      titleRef.current?.blur()
    }
  }

  const onSecondaryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <tr style={{ backgroundColor: C.surfaceAlt }}>
      <td style={{ padding: '8px 8px 8px 12px', borderBottom: `1px solid ${C.border}` }}>
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, color: C.ink3 }}>
          <Plus size={12} />
        </span>
      </td>
      <td colSpan={2} style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}` }}>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onTitleKeyDown}
          placeholder="+ New task — title, then Tab to set assignee / due date, Enter to save"
          aria-label="New task title"
          style={{
            width: '100%',
            padding: '4px 0',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            fontFamily: FONT,
            color: C.ink,
          }}
        />
      </td>
      <td style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}` }}>
        <input
          ref={assigneeRef}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          onKeyDown={onSecondaryKeyDown}
          placeholder="assignee"
          aria-label="New task assignee"
          style={{
            width: '100%',
            padding: '4px 0',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            fontFamily: FONT,
            color: C.ink2,
          }}
        />
      </td>
      <td style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}` }}>
        <input
          ref={dueRef}
          value={due}
          onChange={(e) => setDue(e.target.value)}
          onKeyDown={onSecondaryKeyDown}
          type="date"
          aria-label="New task due date"
          style={{
            width: '100%',
            padding: '4px 0',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            fontFamily: FONT,
            color: C.ink2,
          }}
        />
      </td>
      <td colSpan={4} style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, color: C.ink3, fontSize: 11 }}>
        <kbd style={kbd}>Enter</kbd> save · <kbd style={kbd}>Esc</kbd> clear
      </td>
      <td style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, textAlign: 'right' }}>
        <button
          onClick={onSubmit}
          disabled={pending || !title.trim()}
          aria-label="Add task"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 4,
            border: 'none',
            backgroundColor: title.trim() ? C.brandOrange : C.surfaceAlt,
            color: title.trim() ? '#fff' : C.ink3,
            cursor: title.trim() && !pending ? 'pointer' : 'default',
            opacity: pending ? 0.6 : 1,
          }}
        >
          <Plus size={14} />
        </button>
      </td>
    </tr>
  )
}

const kbd: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  padding: '1px 4px',
  border: `1px solid ${C.border}`,
  borderRadius: 3,
  color: C.ink3,
  backgroundColor: '#fff',
}

// ── Group header ────────────────────────────────────────────────────────────

const GroupHeaderRow: React.FC<{ label: string; count: number; closed: boolean; onToggle: () => void }> = ({
  label,
  count,
  closed,
  onToggle,
}) => (
  <tr>
    <td colSpan={9} style={{ padding: 0 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          backgroundColor: C.surfaceAlt,
          border: 'none',
          borderBottom: `1px solid ${C.borderSubtle}`,
          borderTop: `1px solid ${C.borderSubtle}`,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: C.ink2,
          textAlign: 'left',
        }}
      >
        {closed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span>{label}</span>
        <span style={{ color: C.ink3, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </button>
    </td>
  </tr>
)

// ── Task row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  /** Resolved assignee display name. Empty string when unresolvable. */
  assigneeName: string
  status: Status
  priority: Priority
  focused: boolean
  highlighted?: boolean
  expanded: boolean
  isEditingTitle: boolean
  titleDraft: string
  setTitleDraft: (v: string) => void
  canEdit: boolean
  onSelect: () => void
  onToggleExpanded: () => void
  onToggleStatus: () => void
  onEditTitle: () => void
  onSaveTitle: (v: string) => void
  onCancelTitle: () => void
  onDelete: () => void
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  assigneeName,
  status,
  priority,
  focused,
  highlighted,
  expanded,
  isEditingTitle,
  titleDraft,
  setTitleDraft,
  canEdit,
  onSelect,
  onToggleExpanded,
  onToggleStatus,
  onEditTitle,
  onSaveTitle,
  onCancelTitle,
  onDelete,
}) => {
  const due = fmtDue(task.due_date)
  const linkedKey = pickLinkedKey(task)
  const isDone = status === 'done'
  return (
    <tr
      data-task-row-id={task.id}
      onClick={(e) => {
        const tag = (e.target as HTMLElement).closest('button, input, select')
        if (tag) return
        onSelect()
        onToggleExpanded()
      }}
      style={{
        backgroundColor: focused ? C.surfaceSelected : 'transparent',
        cursor: 'pointer',
        outline: highlighted
          ? `2px solid ${C.brandOrange}`
          : focused ? `1px solid ${C.brandOrange}` : 'none',
        outlineOffset: -1,
        // Fades the highlight ring from solid to none over the lifecycle of
        // the 2s window the page-level effect applies the highlight class.
        transition: 'outline-color 1.6s ease-out',
        boxShadow: highlighted ? `0 0 0 4px ${C.surfaceSelected}` : 'none',
      }}
    >
      {/* Checkbox column — toggle done */}
      <td style={cell({ width: 28, padding: '6px 4px 6px 12px' })}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleStatus()
          }}
          aria-label={isDone ? 'Mark incomplete' : 'Mark done'}
          disabled={!canEdit}
          style={{
            width: 16,
            height: 16,
            border: `1.5px solid ${isDone ? C.active : C.ink4}`,
            borderRadius: 4,
            backgroundColor: isDone ? C.active : 'transparent',
            cursor: canEdit ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden>
              <path d="M2.5 7.2 5.5 10 11 4.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </td>

      {/* Title column */}
      <td style={cell({ padding: '6px 12px', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
              onToggleExpanded()
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: C.ink3,
              padding: 0,
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {isEditingTitle ? (
            <input
              ref={(el) => {
                // Imperative focus on mount — replaces autoFocus to satisfy
                // jsx-a11y/no-autofocus while keeping the inline-edit UX.
                if (el && document.activeElement !== el) el.focus()
              }}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSaveTitle(titleDraft)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelTitle()
                }
              }}
              onBlur={() => onSaveTitle(titleDraft)}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '2px 4px',
                border: `1px solid ${C.brandOrange}`,
                borderRadius: 3,
                fontFamily: FONT,
                fontSize: 13,
                color: C.ink,
                outline: 'none',
                backgroundColor: '#fff',
              }}
              aria-label="Edit task title"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (canEdit) onEditTitle()
              }}
              style={{
                flex: 1,
                minWidth: 0,
                color: isDone ? C.ink3 : C.ink,
                textDecoration: isDone ? 'line-through' : 'none',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title || '(untitled)'}
            </span>
          )}
        </div>
      </td>

      {/* Assignee */}
      <td style={cell({ padding: '6px 12px' })}>
        <span style={{ color: assigneeName ? C.ink2 : C.ink4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {assigneeName || '—'}
        </span>
      </td>

      {/* Due */}
      <td style={cell({ padding: '6px 12px' })}>
        <span style={{ color: due.tone, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{due.label}</span>
      </td>

      {/* Priority */}
      <td style={cell({ padding: '6px 12px' })}>
        <Pill tone={PRIORITY_TONE[priority]} label={PRIORITY_LABEL[priority]} />
      </td>

      {/* Status */}
      <td style={cell({ padding: '6px 12px' })}>
        <Pill tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
      </td>

      {/* Linked */}
      <td style={cell({ padding: '6px 12px' })}>
        {linkedKey === 'Unlinked' ? (
          <span style={{ color: C.ink4 }}>—</span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              backgroundColor: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              color: C.ink2,
            }}
          >
            {linkedKey}
          </span>
        )}
      </td>

      {/* Iris column — placeholder; tasks don't have an Iris draft surface
          in the locked contract today. Wave 2 wires irisDraftStore lookup. */}
      <td style={cell({ padding: '6px 12px' })}>
        <span style={{ color: C.ink4 }}>—</span>
      </td>

      {/* Delete */}
      <td style={cell({ padding: '6px 8px 6px 4px', textAlign: 'right' })}>
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label={`Delete ${task.title}`}
            title="Delete task"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 4,
              color: C.ink3,
              borderRadius: 3,
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Expanded row ────────────────────────────────────────────────────────────

const ExpandedRow: React.FC<{
  task: Task
  status: Status
  priority: Priority
  canEdit: boolean
  onSetStatus: (s: Status) => void
  onSetPriority: (p: Priority) => void
  onClose: () => void
}> = ({ task, status, priority, canEdit, onSetStatus, onSetPriority, onClose }) => (
  <tr>
    <td colSpan={9} style={{ padding: 0, backgroundColor: C.surfaceAlt }}>
      <div
        style={{
          padding: '14px 24px 14px 56px',
          borderBottom: `1px solid ${C.border}`,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          fontFamily: FONT,
        }}
      >
        <div>
          <SectionLabel>Description</SectionLabel>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.ink2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {task.description || (
              <span style={{ color: C.ink4 }}>—</span>
            )}
          </p>

          {(task.location || task.trade) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 18, fontSize: 12, color: C.ink2 }}>
              {task.location && (
                <div>
                  <SectionLabel>Location</SectionLabel>
                  <div style={{ marginTop: 2, fontWeight: 500 }}>{task.location}</div>
                </div>
              )}
              {task.trade && (
                <div>
                  <SectionLabel>Trade</SectionLabel>
                  <div style={{ marginTop: 2, fontWeight: 500 }}>{task.trade}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <SectionLabel>Quick edit</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            <SelectField
              label="Status"
              value={status}
              options={STATUS_OPTIONS}
              labels={STATUS_LABEL}
              onChange={onSetStatus}
              disabled={!canEdit}
            />
            <SelectField
              label="Priority"
              value={priority}
              options={PRIORITY_OPTIONS}
              labels={PRIORITY_LABEL}
              onChange={onSetPriority}
              disabled={!canEdit}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                minHeight: 26,
                border: `1px solid ${C.border}`,
                backgroundColor: '#fff',
                color: C.ink2,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <X size={12} /> Close
            </button>
          </div>
        </div>
      </div>
    </td>
  </tr>
)

const SelectField = <T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: T[]
  labels: Record<T, string>
  onChange: (v: T) => void
  disabled?: boolean
}) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}>{label}</span>
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        padding: '6px 10px',
        border: `1px solid ${C.border}`,
        backgroundColor: '#fff',
        color: C.ink,
        fontFamily: FONT,
        fontSize: 13,
        borderRadius: 4,
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o]}
        </option>
      ))}
    </select>
  </label>
)

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: C.ink3,
    }}
  >
    {children}
  </div>
)

// ── Pills + table primitives ────────────────────────────────────────────────

const Pill: React.FC<{ tone: { color: string; bg: string }; label: string }> = ({ tone, label }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 10px',
      borderRadius: 999,
      backgroundColor: tone.bg,
      color: tone.color,
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}
  >
    <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: tone.color }} />
    {label}
  </span>
)

const Th: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <th
    scope="col"
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 1,
      textAlign: 'left',
      padding: '8px 12px',
      backgroundColor: C.surface,
      borderBottom: `1px solid ${C.border}`,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: C.ink3,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
)

function cell(extra: React.CSSProperties): React.CSSProperties {
  return {
    borderBottom: `1px solid ${C.borderSubtle}`,
    fontSize: 13,
    color: C.ink2,
    ...extra,
  }
}

// ── Shell — sticky header + chips + group toggle + search ───────────────────

interface ShellProps {
  children: React.ReactNode
  filter: Filter
  setFilter: (f: Filter) => void
  counts: Record<Filter, number>
  groupMode: GroupMode
  setGroupMode: (g: GroupMode) => void
  search: string
  setSearch: (s: string) => void
  onNew: () => void
  canCreate: boolean
  total: number
  doneCount: number
  inProgressCount: number
}

const Shell: React.FC<ShellProps> = ({
  children,
  filter,
  setFilter,
  counts,
  groupMode,
  setGroupMode,
  search,
  setSearch,
  onNew,
  canCreate,
  total,
  doneCount,
  inProgressCount,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      backgroundColor: C.surface,
      color: C.ink,
      fontFamily: FONT,
    }}
  >
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 24px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>
            Tasks
          </h1>
          <CountChip count={total} />
          <span style={{ fontSize: 12, color: C.ink3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {inProgressCount} in progress · {doneCount} done
          </span>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, description, assignee…"
          aria-label="Search tasks"
          style={{
            width: 260,
            padding: '6px 12px',
            minHeight: 32,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            fontSize: 13,
            fontFamily: FONT,
            backgroundColor: '#fff',
            color: C.ink,
            outline: 'none',
          }}
        />
        <PermissionGate permission="tasks.create">
          <button
            onClick={onNew}
            disabled={!canCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              minHeight: 32,
              backgroundColor: C.brandOrange,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: canCreate ? 'pointer' : 'not-allowed',
              opacity: canCreate ? 1 : 0.5,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.005em',
            }}
          >
            <Plus size={14} /> New Task
          </button>
        </PermissionGate>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px 12px',
          flexWrap: 'wrap',
        }}
      >
        <FilterChips filter={filter} setFilter={setFilter} counts={counts} />
        <div style={{ flex: 1 }} />
        <GroupSelector value={groupMode} onChange={setGroupMode} />
        <span style={{ fontSize: 11, color: C.ink3, whiteSpace: 'nowrap' }}>
          <kbd style={kbd}>j</kbd> <kbd style={kbd}>k</kbd> <kbd style={kbd}>↵</kbd>{' '}
          <kbd style={kbd}>c</kbd> <kbd style={kbd}>e</kbd> <kbd style={kbd}>n</kbd>
        </span>
      </div>
    </header>

    {children}
  </div>
)

const CountChip: React.FC<{ count: number }> = ({ count }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 22,
      height: 22,
      padding: '0 8px',
      borderRadius: 999,
      backgroundColor: '#fff',
      border: `1px solid ${C.border}`,
      color: C.ink2,
      fontSize: 11,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
    }}
  >
    {count}
  </span>
)

const FilterChips: React.FC<{ filter: Filter; setFilter: (f: Filter) => void; counts: Record<Filter, number> }> = ({
  filter,
  setFilter,
  counts,
}) => (
  <div role="tablist" aria-label="Filter tasks" style={{ display: 'flex', gap: 6 }}>
    {FILTER_ORDER.map((f) => {
      const active = filter === f
      return (
        <button
          key={f}
          role="tab"
          aria-selected={active}
          onClick={() => setFilter(f)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            minHeight: 28,
            backgroundColor: active ? '#fff' : C.surfaceAlt,
            color: active ? C.ink : C.ink2,
            border: `1px solid ${active ? C.border : 'transparent'}`,
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: active ? 600 : 500,
            fontFamily: FONT,
          }}
        >
          {FILTER_LABEL[f]}
          <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.ink2 : C.ink3, fontVariantNumeric: 'tabular-nums' }}>
            {counts[f]}
          </span>
        </button>
      )
    })}
  </div>
)

const GroupSelector: React.FC<{ value: GroupMode; onChange: (g: GroupMode) => void }> = ({ value, onChange }) => (
  <div
    role="tablist"
    aria-label="Group tasks"
    style={{
      display: 'inline-flex',
      padding: 2,
      backgroundColor: C.surfaceAlt,
      borderRadius: 6,
      border: `1px solid ${C.borderSubtle}`,
    }}
  >
    {GROUP_OPTIONS.map((g) => {
      const active = value === g
      return (
        <button
          key={g}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(g)}
          style={{
            padding: '5px 10px',
            minHeight: 26,
            border: 'none',
            backgroundColor: active ? '#fff' : 'transparent',
            color: active ? C.ink : C.ink2,
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: active ? 600 : 500,
          }}
        >
          {GROUP_LABEL[g]}
        </button>
      )
    })}
  </div>
)

// ── Empty state ─────────────────────────────────────────────────────────────

const PageEmpty: React.FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      backgroundColor: C.surface,
      fontFamily: FONT,
    }}
  >
    <span style={{ fontSize: 14, color: C.ink2 }}>{title}</span>
  </div>
)

// Sparkles is reserved for future Iris draft surfacing on tasks; reference
// it once so eslint-no-unused stays quiet without affecting the bundle.
void Sparkles

// ── Boundary ────────────────────────────────────────────────────────────────

export const Tasks: React.FC = () => (
  <ErrorBoundary message="Tasks could not be displayed. Check your connection and try again.">
    <TasksPage />
  </ErrorBoundary>
)

export default Tasks
