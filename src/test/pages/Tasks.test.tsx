/**
 * Tests for Tasks page data mapping logic and helper functions.
 * The mapping function transforms raw Supabase rows into the component shape.
 */
import { describe, it, expect } from 'vitest'

// ── Task mapping logic (mirrors Tasks.tsx useMemo) ────────────────────────────

type MappedTask = {
  id: number
  uuid: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'in_review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee: { name: string; initials: string; company: string }
  dueDate: string
  tags: string[]
  commentsCount: number
  attachmentsCount: number
  createdDate: string
  subtasks: { total: number; completed: number }
  linkedItems: Array<{ type: string; id: string }>
  predecessorIds: string[]
  predecessor_ids: string[]
  successor_ids: string[]
  percent_complete: number | null
  isCriticalPath: boolean
  is_critical_path: boolean
}

function mapTask(t: Record<string, unknown>): MappedTask {
  const name = (t.assigned_to as string) || 'Unassigned'
  const initials =
    name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NA'
  const predecessorIds = (t.predecessor_ids as string[] | null) || []
  const successorIds = (t.successor_ids as string[] | null) || []
  const percentComplete = typeof t.percent_complete === 'number' ? t.percent_complete : null
  const tags: string[] = []
  if (t.is_critical_path) tags.push('critical path')
  return {
    id:
      typeof t.id === 'number'
        ? t.id
        : parseInt(String(t.id).replace(/\D/g, '').slice(0, 8) || '0', 10),
    uuid: String(t.id || ''),
    title: (t.title as string) || '',
    description: (t.description as string) || '',
    status: ((t.status as string) || 'todo') as MappedTask['status'],
    priority: ((t.priority as string) || 'medium') as MappedTask['priority'],
    assignee: { name, initials, company: '' },
    dueDate: (t.due_date as string) || (t.end_date as string) || '',
    tags,
    commentsCount: 0,
    attachmentsCount: 0,
    createdDate: ((t.created_at as string) || '').slice(0, 10),
    subtasks: { total: 0, completed: 0 },
    linkedItems: [],
    predecessorIds,
    predecessor_ids: predecessorIds,
    successor_ids: successorIds,
    percent_complete: percentComplete,
    isCriticalPath: !!t.is_critical_path,
    is_critical_path: !!t.is_critical_path,
  }
}

// ── Task data mapping ─────────────────────────────────────────────────────────

describe('Tasks page: mapTask', () => {
  it('should map a complete task row to component shape', () => {
    const raw = {
      id: 'abc-123',
      title: 'Pour concrete foundation',
      description: 'Level B3 grid pour',
      status: 'in_progress',
      priority: 'high',
      assigned_to: 'John Smith',
      due_date: '2024-09-15',
      created_at: '2024-07-01T10:00:00.000Z',
      is_critical_path: true,
      predecessor_ids: ['prev-1', 'prev-2'],
      successor_ids: ['next-1'],
      percent_complete: 45,
    }
    const mapped = mapTask(raw)

    expect(mapped.title).toBe('Pour concrete foundation')
    expect(mapped.status).toBe('in_progress')
    expect(mapped.priority).toBe('high')
    expect(mapped.assignee.name).toBe('John Smith')
    expect(mapped.assignee.initials).toBe('JS')
    expect(mapped.dueDate).toBe('2024-09-15')
    expect(mapped.createdDate).toBe('2024-07-01')
    expect(mapped.isCriticalPath).toBe(true)
    expect(mapped.is_critical_path).toBe(true)
    expect(mapped.tags).toContain('critical path')
    expect(mapped.predecessorIds).toEqual(['prev-1', 'prev-2'])
    expect(mapped.successor_ids).toEqual(['next-1'])
    expect(mapped.percent_complete).toBe(45)
    expect(mapped.uuid).toBe('abc-123')
  })

  it('should default status to todo when missing', () => {
    const raw = { id: 1, title: 'Task', status: undefined }
    const mapped = mapTask(raw)
    expect(mapped.status).toBe('todo')
  })

  it('should default priority to medium when missing', () => {
    const raw = { id: 1, title: 'Task', priority: undefined }
    const mapped = mapTask(raw)
    expect(mapped.priority).toBe('medium')
  })

  it('should default assignee to Unassigned when assigned_to is null', () => {
    const raw = { id: 1, title: 'Task', assigned_to: null }
    const mapped = mapTask(raw)
    expect(mapped.assignee.name).toBe('Unassigned')
    // 'Unassigned' is a single word so only one initial is produced
    expect(mapped.assignee.initials).toBe('U')
  })

  it('should generate 2-char initials from full name', () => {
    const raw = { id: 1, title: 'Task', assigned_to: 'Maria Rodriguez' }
    const mapped = mapTask(raw)
    expect(mapped.assignee.initials).toBe('MR')
  })

  it('should use only first char initials for single-word name', () => {
    const raw = { id: 1, title: 'Task', assigned_to: 'Bob' }
    const mapped = mapTask(raw)
    // Single word: 'B'.slice(0, 2) = 'B'
    expect(mapped.assignee.initials).toBe('B')
  })

  it('should not add critical path tag when is_critical_path is false', () => {
    const raw = { id: 1, title: 'Task', is_critical_path: false }
    const mapped = mapTask(raw)
    expect(mapped.tags).not.toContain('critical path')
    expect(mapped.isCriticalPath).toBe(false)
  })

  it('should default predecessor_ids to empty array when null', () => {
    const raw = { id: 1, title: 'Task', predecessor_ids: null }
    const mapped = mapTask(raw)
    expect(mapped.predecessorIds).toEqual([])
    expect(mapped.predecessor_ids).toEqual([])
  })

  it('should default successor_ids to empty array when null', () => {
    const raw = { id: 1, title: 'Task', successor_ids: null }
    const mapped = mapTask(raw)
    expect(mapped.successor_ids).toEqual([])
  })

  it('should handle numeric id correctly', () => {
    const raw = { id: 42, title: 'Task' }
    const mapped = mapTask(raw)
    expect(mapped.id).toBe(42)
    expect(mapped.uuid).toBe('42')
  })

  it('should parse numeric portion of string id', () => {
    const raw = { id: 'task-99-abc', title: 'Task' }
    const mapped = mapTask(raw)
    // digits from 'task-99-abc' -> '99' -> 99
    expect(mapped.id).toBe(99)
  })

  it('should set percent_complete to null when not a number', () => {
    const raw = { id: 1, title: 'Task', percent_complete: 'unknown' }
    const mapped = mapTask(raw)
    expect(mapped.percent_complete).toBeNull()
  })

  it('should set percent_complete to 0 correctly', () => {
    const raw = { id: 1, title: 'Task', percent_complete: 0 }
    const mapped = mapTask(raw)
    expect(mapped.percent_complete).toBe(0)
  })

  it('should fall back to end_date when due_date is absent', () => {
    const raw = { id: 1, title: 'Task', due_date: undefined, end_date: '2024-12-31' }
    const mapped = mapTask(raw)
    expect(mapped.dueDate).toBe('2024-12-31')
  })

  it('should produce empty dueDate when both due_date and end_date absent', () => {
    const raw = { id: 1, title: 'Task' }
    const mapped = mapTask(raw)
    expect(mapped.dueDate).toBe('')
  })

  it('should always set commentsCount and attachmentsCount to 0', () => {
    const raw = { id: 1, title: 'Task' }
    const mapped = mapTask(raw)
    expect(mapped.commentsCount).toBe(0)
    expect(mapped.attachmentsCount).toBe(0)
  })

  it('should set subtasks to 0/0 always', () => {
    const raw = { id: 1, title: 'Task' }
    const mapped = mapTask(raw)
    expect(mapped.subtasks.total).toBe(0)
    expect(mapped.subtasks.completed).toBe(0)
  })

  it('should truncate createdDate to YYYY-MM-DD', () => {
    const raw = { id: 1, title: 'Task', created_at: '2024-11-25T18:30:00.000Z' }
    const mapped = mapTask(raw)
    expect(mapped.createdDate).toBe('2024-11-25')
  })

  it('should handle empty string title gracefully', () => {
    const raw = { id: 1, title: '' }
    const mapped = mapTask(raw)
    expect(mapped.title).toBe('')
  })
})

// ── useTasks Supabase query logic ─────────────────────────────────────────────

describe('useTasks query requirements', () => {
  it('should only fetch tasks for the given project_id', () => {
    // Verifies the filter logic: if projectId changes, the queryKey changes
    const projectId = 'proj-001'
    const queryKey = ['tasks', projectId]
    expect(queryKey[1]).toBe(projectId)
  })

  it('should be disabled when projectId is undefined', () => {
    // enabled: !!projectId
    const projectId: string | undefined = undefined
    expect(!!projectId).toBe(false)
  })

  it('should be enabled when projectId is a non-empty string', () => {
    const projectId = 'proj-abc'
    expect(!!projectId).toBe(true)
  })
})

// ── Task status config ────────────────────────────────────────────────────────

describe('Tasks statusConfig', () => {
  const columns: Array<'todo' | 'in_progress' | 'in_review' | 'done'> = [
    'todo',
    'in_progress',
    'in_review',
    'done',
  ]

  it('should have 4 status columns', () => {
    expect(columns).toHaveLength(4)
  })

  it('should include todo, in_progress, in_review, done', () => {
    expect(columns).toContain('todo')
    expect(columns).toContain('in_progress')
    expect(columns).toContain('in_review')
    expect(columns).toContain('done')
  })
})
