import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Pure business logic from the Tasks page (replicated here since these
// functions are internal to the page component and not exported).
// ---------------------------------------------------------------------------

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

// ── statusConfig labels ────────────────────────────────────
// Mirrors the statusConfig constant in Tasks.tsx
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

// ── Priority ordering ──────────────────────────────────────
const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low']

// ── formatDue ──────────────────────────────────────────────
// Mirrors the formatDue function inside Tasks.tsx.
// Returns a display label based on how many days until the due date.
function formatDue(dateStr: string, now: Date = new Date()): { text: string; isOverdue: boolean; isToday: boolean } {
  const days = Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, isOverdue: true, isToday: false }
  if (days === 0) return { text: 'Due today', isOverdue: false, isToday: true }
  return { text: `${days}d left`, isOverdue: false, isToday: false }
}

// ── assignee initials ──────────────────────────────────────
// Mirrors the initials derivation in the useMemo mapper.
function deriveInitials(assignedTo: string | null | undefined): string {
  const name = assignedTo || 'Unassigned'
  const computed = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  return computed || 'NA'
}

// ── critical path tag ──────────────────────────────────────
// Mirrors the tags array population in the useMemo mapper.
function deriveTags(isCriticalPath: boolean): string[] {
  const tags: string[] = []
  if (isCriticalPath) tags.push('critical path')
  return tags
}

// ── filterTasks ────────────────────────────────────────────
// Mirrors the filteredTasks useMemo in Tasks.tsx.
interface TaskLike {
  title: string
  priority: TaskPriority
  tags: string[]
  assignee: { initials: string }
}

function filterTasks(
  tasks: TaskLike[],
  searchQuery: string,
  filterPriority: TaskPriority | 'all',
  criticalFilter: boolean,
  myTasksOnly: boolean,
  myInitials: string = 'MP',
): TaskLike[] {
  return tasks.filter((t) => {
    const matchesSearch =
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority
    const matchesMy = !myTasksOnly || t.assignee.initials === myInitials
    if (criticalFilter) return matchesSearch && matchesPriority && matchesMy && (t.priority === 'critical' || t.priority === 'high')
    return matchesSearch && matchesPriority && matchesMy
  })
}

// ── groupByStatus ──────────────────────────────────────────
// Mirrors the tasksByStatus useMemo in Tasks.tsx.
interface StatusedTask extends TaskLike {
  status: TaskStatus
}

function groupByStatus(tasks: StatusedTask[]): Record<TaskStatus, StatusedTask[]> {
  const grouped: Record<TaskStatus, StatusedTask[]> = { todo: [], in_progress: [], in_review: [], done: [] }
  tasks.forEach((t) => grouped[t.status].push(t))
  return grouped
}

// ---------------------------------------------------------------------------
// Status labels tests
// ---------------------------------------------------------------------------

describe('Task status labels', () => {
  it('should have human-readable label for todo', () => {
    expect(STATUS_LABELS.todo).toBe('To Do')
  })

  it('should have human-readable label for in_progress', () => {
    expect(STATUS_LABELS.in_progress).toBe('In Progress')
  })

  it('should have human-readable label for in_review', () => {
    expect(STATUS_LABELS.in_review).toBe('In Review')
  })

  it('should have human-readable label for done', () => {
    expect(STATUS_LABELS.done).toBe('Done')
  })

  it('should have labels for all 4 statuses', () => {
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done']
    for (const status of statuses) {
      expect(STATUS_LABELS[status]).toBeDefined()
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0)
    }
  })

  it('should not contain hyphens in any label (UI copy rule)', () => {
    for (const label of Object.values(STATUS_LABELS)) {
      expect(label).not.toContain('-')
    }
  })
})

// ---------------------------------------------------------------------------
// Priority ordering tests
// ---------------------------------------------------------------------------

describe('Task priority ordering', () => {
  it('should list critical as the highest priority', () => {
    expect(PRIORITY_ORDER[0]).toBe('critical')
  })

  it('should list low as the lowest priority', () => {
    expect(PRIORITY_ORDER[PRIORITY_ORDER.length - 1]).toBe('low')
  })

  it('should include all 4 priority levels', () => {
    expect(PRIORITY_ORDER).toHaveLength(4)
    expect(PRIORITY_ORDER).toContain('critical')
    expect(PRIORITY_ORDER).toContain('high')
    expect(PRIORITY_ORDER).toContain('medium')
    expect(PRIORITY_ORDER).toContain('low')
  })
})

// ---------------------------------------------------------------------------
// formatDue tests
// ---------------------------------------------------------------------------

describe('formatDue', () => {
  it('should return overdue label and flag for past dates', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const result = formatDue(yesterday.toISOString())
    expect(result.isOverdue).toBe(true)
    expect(result.text).toContain('overdue')
  })

  it('should return "Due today" label for a date a few hours ago (same-day past)', () => {
    // formatDue uses Math.ceil(delta / ms_per_day).
    // Math.ceil(-0.3) = 0, so a date a few hours in the past (but <24h ago) produces "Due today".
    const now = new Date()
    const fewHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000) // 6 hours ago
    const result = formatDue(fewHoursAgo.toISOString(), now)
    expect(result.isToday).toBe(true)
    expect(result.text).toBe('Due today')
  })

  it('should return days left label for future dates', () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    const result = formatDue(future.toISOString())
    expect(result.isOverdue).toBe(false)
    expect(result.isToday).toBe(false)
    expect(result.text).toContain('left')
  })

  it('should show number of overdue days in label', () => {
    const now = new Date()
    const tenDaysAgo = new Date(now)
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const result = formatDue(tenDaysAgo.toISOString(), now)
    expect(result.text).toContain('10d overdue')
  })

  it('should not show negative days in the label', () => {
    const past = new Date()
    past.setDate(past.getDate() - 3)
    const result = formatDue(past.toISOString())
    expect(result.text).not.toContain('-')
  })
})

// ---------------------------------------------------------------------------
// deriveInitials tests
// ---------------------------------------------------------------------------

describe('deriveInitials', () => {
  it('should produce "JD" for "John Doe"', () => {
    expect(deriveInitials('John Doe')).toBe('JD')
  })

  it('should produce "JS" for "Jane Smith"', () => {
    expect(deriveInitials('Jane Smith')).toBe('JS')
  })

  it('should limit initials to 2 characters', () => {
    expect(deriveInitials('Mary Jane Watson')).toBe('MJ')
  })

  it('should use "U" for "Unassigned" (single word = one initial)', () => {
    // 'Unassigned' is one word, so split gives ['Unassigned'], first letter = 'U'
    expect(deriveInitials('Unassigned')).toBe('U')
  })

  it('should use "U" for null assignee (falls back to "Unassigned")', () => {
    expect(deriveInitials(null)).toBe('U')
  })

  it('should use "U" for undefined assignee (falls back to "Unassigned")', () => {
    expect(deriveInitials(undefined)).toBe('U')
  })

  it('should uppercase the initials', () => {
    const result = deriveInitials('john doe')
    expect(result).toBe(result.toUpperCase())
  })
})

// ---------------------------------------------------------------------------
// deriveTags tests
// ---------------------------------------------------------------------------

describe('deriveTags', () => {
  it('should return empty array when task is not on critical path', () => {
    expect(deriveTags(false)).toEqual([])
  })

  it('should include "critical path" tag when task is on critical path', () => {
    expect(deriveTags(true)).toContain('critical path')
  })

  it('critical path tag should not contain hyphens (UI copy rule)', () => {
    const tags = deriveTags(true)
    for (const tag of tags) {
      expect(tag).not.toContain('-')
    }
  })
})

// ---------------------------------------------------------------------------
// filterTasks tests
// ---------------------------------------------------------------------------

const makeTasks = (overrides: Partial<StatusedTask>[] = []): StatusedTask[] =>
  overrides.map((o, i) => ({
    title: `Task ${i + 1}`,
    priority: 'medium' as TaskPriority,
    tags: [],
    status: 'todo' as TaskStatus,
    assignee: { initials: 'JD' },
    ...o,
  }))

describe('filterTasks', () => {
  it('should return all tasks when no filters are set', () => {
    const tasks = makeTasks([{}, {}, {}])
    expect(filterTasks(tasks, '', 'all', false, false)).toHaveLength(3)
  })

  it('should filter by search query (title match)', () => {
    const tasks = makeTasks([
      { title: 'Pour concrete footings' },
      { title: 'Frame exterior walls' },
    ])
    const result = filterTasks(tasks, 'concrete', 'all', false, false)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Pour concrete footings')
  })

  it('should filter by search query (tag match)', () => {
    const tasks = makeTasks([
      { title: 'Install HVAC', tags: ['critical path'] },
      { title: 'Paint walls', tags: [] },
    ])
    const result = filterTasks(tasks, 'critical', 'all', false, false)
    expect(result).toHaveLength(1)
  })

  it('should be case-insensitive in search', () => {
    const tasks = makeTasks([{ title: 'Pour Concrete Footings' }])
    expect(filterTasks(tasks, 'CONCRETE', 'all', false, false)).toHaveLength(1)
    expect(filterTasks(tasks, 'concrete', 'all', false, false)).toHaveLength(1)
  })

  it('should filter by priority', () => {
    const tasks = makeTasks([
      { priority: 'critical' },
      { priority: 'high' },
      { priority: 'medium' },
      { priority: 'low' },
    ])
    expect(filterTasks(tasks, '', 'critical', false, false)).toHaveLength(1)
    expect(filterTasks(tasks, '', 'high', false, false)).toHaveLength(1)
    expect(filterTasks(tasks, '', 'all', false, false)).toHaveLength(4)
  })

  it('should filter criticalFilter to only critical and high priority', () => {
    const tasks = makeTasks([
      { priority: 'critical' },
      { priority: 'high' },
      { priority: 'medium' },
      { priority: 'low' },
    ])
    const result = filterTasks(tasks, '', 'all', true, false)
    expect(result).toHaveLength(2)
    for (const t of result) {
      expect(['critical', 'high']).toContain(t.priority)
    }
  })

  it('should filter myTasksOnly to tasks assigned to the current user', () => {
    const tasks = makeTasks([
      { assignee: { initials: 'MP' } },
      { assignee: { initials: 'JD' } },
      { assignee: { initials: 'MP' } },
    ])
    const result = filterTasks(tasks, '', 'all', false, true, 'MP')
    expect(result).toHaveLength(2)
  })

  it('should return empty array when no tasks match the search', () => {
    const tasks = makeTasks([{ title: 'Pour concrete' }, { title: 'Frame walls' }])
    const result = filterTasks(tasks, 'plumbing', 'all', false, false)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// groupByStatus tests
// ---------------------------------------------------------------------------

describe('groupByStatus', () => {
  it('should group tasks into the 4 status buckets', () => {
    const tasks: StatusedTask[] = [
      { title: 'Task A', status: 'todo', priority: 'medium', tags: [], assignee: { initials: 'JD' } },
      { title: 'Task B', status: 'in_progress', priority: 'high', tags: [], assignee: { initials: 'MP' } },
      { title: 'Task C', status: 'done', priority: 'low', tags: [], assignee: { initials: 'JD' } },
      { title: 'Task D', status: 'todo', priority: 'critical', tags: [], assignee: { initials: 'JD' } },
    ]
    const grouped = groupByStatus(tasks)
    expect(grouped.todo).toHaveLength(2)
    expect(grouped.in_progress).toHaveLength(1)
    expect(grouped.in_review).toHaveLength(0)
    expect(grouped.done).toHaveLength(1)
  })

  it('should return empty arrays for all statuses when no tasks provided', () => {
    const grouped = groupByStatus([])
    expect(grouped.todo).toHaveLength(0)
    expect(grouped.in_progress).toHaveLength(0)
    expect(grouped.in_review).toHaveLength(0)
    expect(grouped.done).toHaveLength(0)
  })

  it('should preserve task order within each bucket', () => {
    const tasks: StatusedTask[] = [
      { title: 'First todo', status: 'todo', priority: 'medium', tags: [], assignee: { initials: 'JD' } },
      { title: 'Second todo', status: 'todo', priority: 'low', tags: [], assignee: { initials: 'JD' } },
    ]
    const grouped = groupByStatus(tasks)
    expect(grouped.todo[0].title).toBe('First todo')
    expect(grouped.todo[1].title).toBe('Second todo')
  })
})
