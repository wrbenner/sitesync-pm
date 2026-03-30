import { describe, it, expect } from 'vitest'
import { calculateCriticalPath, tasksToCPM } from '../../lib/criticalPath'
import type { CPMTask } from '../../lib/criticalPath'

describe('calculateCriticalPath', () => {
  it('calculates a simple linear chain', () => {
    const tasks: CPMTask[] = [
      { id: 'A', title: 'Foundation', duration: 5, predecessors: [] },
      { id: 'B', title: 'Framing', duration: 3, predecessors: ['A'] },
      { id: 'C', title: 'Roofing', duration: 2, predecessors: ['B'] },
    ]

    const results = calculateCriticalPath(tasks)

    // Forward pass
    expect(results.get('A')!.earlyStart).toBe(0)
    expect(results.get('A')!.earlyFinish).toBe(5)
    expect(results.get('B')!.earlyStart).toBe(5)
    expect(results.get('B')!.earlyFinish).toBe(8)
    expect(results.get('C')!.earlyStart).toBe(8)
    expect(results.get('C')!.earlyFinish).toBe(10)

    // All tasks on critical path (linear chain)
    expect(results.get('A')!.isCritical).toBe(true)
    expect(results.get('B')!.isCritical).toBe(true)
    expect(results.get('C')!.isCritical).toBe(true)
    expect(results.get('A')!.totalFloat).toBe(0)
  })

  it('identifies float on non critical tasks', () => {
    // A(5) -> C(2)
    // B(2) -> C(2)
    // B has float because A is the longer path
    const tasks: CPMTask[] = [
      { id: 'A', title: 'Excavation', duration: 5, predecessors: [] },
      { id: 'B', title: 'Permits', duration: 2, predecessors: [] },
      { id: 'C', title: 'Pour Concrete', duration: 2, predecessors: ['A', 'B'] },
    ]

    const results = calculateCriticalPath(tasks)

    expect(results.get('A')!.isCritical).toBe(true)
    expect(results.get('C')!.isCritical).toBe(true)
    expect(results.get('B')!.isCritical).toBe(false)
    expect(results.get('B')!.totalFloat).toBe(3) // B can slip 3 days
  })

  it('handles parallel paths with different lengths', () => {
    //   -> B(3) -> D(1)
    // A(2)
    //   -> C(6)
    const tasks: CPMTask[] = [
      { id: 'A', title: 'Start', duration: 2, predecessors: [] },
      { id: 'B', title: 'Short Path', duration: 3, predecessors: ['A'] },
      { id: 'C', title: 'Long Path', duration: 6, predecessors: ['A'] },
      { id: 'D', title: 'End', duration: 1, predecessors: ['B', 'C'] },
    ]

    const results = calculateCriticalPath(tasks)

    // Critical path: A -> C -> D (total 9)
    expect(results.get('A')!.isCritical).toBe(true)
    expect(results.get('C')!.isCritical).toBe(true)
    expect(results.get('D')!.isCritical).toBe(true)

    // B has float
    expect(results.get('B')!.isCritical).toBe(false)
    expect(results.get('B')!.totalFloat).toBe(3) // 6 - 3 = 3 days float

    // Project duration
    expect(results.get('D')!.earlyFinish).toBe(9)
  })

  it('handles tasks with no predecessors', () => {
    const tasks: CPMTask[] = [
      { id: 'A', title: 'Task A', duration: 3, predecessors: [] },
      { id: 'B', title: 'Task B', duration: 5, predecessors: [] },
    ]

    const results = calculateCriticalPath(tasks)

    expect(results.get('A')!.earlyStart).toBe(0)
    expect(results.get('B')!.earlyStart).toBe(0)
    expect(results.get('B')!.isCritical).toBe(true)
    expect(results.get('A')!.isCritical).toBe(false)
    expect(results.get('A')!.totalFloat).toBe(2) // 5 - 3 = 2
  })

  it('handles single task', () => {
    const tasks: CPMTask[] = [
      { id: 'A', title: 'Solo Task', duration: 10, predecessors: [] },
    ]

    const results = calculateCriticalPath(tasks)

    expect(results.get('A')!.earlyStart).toBe(0)
    expect(results.get('A')!.earlyFinish).toBe(10)
    expect(results.get('A')!.lateStart).toBe(0)
    expect(results.get('A')!.lateFinish).toBe(10)
    expect(results.get('A')!.isCritical).toBe(true)
    expect(results.get('A')!.totalFloat).toBe(0)
  })

  it('handles empty task list', () => {
    const results = calculateCriticalPath([])
    expect(results.size).toBe(0)
  })

  it('handles diamond dependency pattern', () => {
    //      -> B(4) ->
    // A(1)            D(1)
    //      -> C(2) ->
    const tasks: CPMTask[] = [
      { id: 'A', title: 'Start', duration: 1, predecessors: [] },
      { id: 'B', title: 'Long', duration: 4, predecessors: ['A'] },
      { id: 'C', title: 'Short', duration: 2, predecessors: ['A'] },
      { id: 'D', title: 'End', duration: 1, predecessors: ['B', 'C'] },
    ]

    const results = calculateCriticalPath(tasks)

    // Critical: A -> B -> D (total 6)
    expect(results.get('A')!.isCritical).toBe(true)
    expect(results.get('B')!.isCritical).toBe(true)
    expect(results.get('D')!.isCritical).toBe(true)
    expect(results.get('C')!.isCritical).toBe(false)
    expect(results.get('C')!.totalFloat).toBe(2)
    expect(results.get('D')!.earlyFinish).toBe(6)
  })
})

describe('tasksToCPM', () => {
  it('converts DB tasks to CPM format using date range', () => {
    const dbTasks = [
      {
        id: 'task-1',
        title: 'Pour Foundation',
        start_date: '2026-03-01',
        end_date: '2026-03-06',
        predecessor_ids: null,
        estimated_hours: null,
      },
    ]

    const cpmTasks = tasksToCPM(dbTasks)

    expect(cpmTasks).toHaveLength(1)
    expect(cpmTasks[0].id).toBe('task-1')
    expect(cpmTasks[0].duration).toBe(5)
    expect(cpmTasks[0].predecessors).toEqual([])
  })

  it('converts DB tasks using estimated hours when no dates', () => {
    const dbTasks = [
      {
        id: 'task-2',
        title: 'Install Conduit',
        start_date: null,
        end_date: null,
        predecessor_ids: ['task-1'],
        estimated_hours: 24,
      },
    ]

    const cpmTasks = tasksToCPM(dbTasks)

    expect(cpmTasks[0].duration).toBe(3) // 24 hours / 8 hours per day
    expect(cpmTasks[0].predecessors).toEqual(['task-1'])
  })

  it('defaults to 1 day duration when no dates or hours', () => {
    const dbTasks = [
      {
        id: 'task-3',
        title: 'Inspection',
        start_date: null,
        end_date: null,
        predecessor_ids: null,
        estimated_hours: null,
      },
    ]

    const cpmTasks = tasksToCPM(dbTasks)
    expect(cpmTasks[0].duration).toBe(1)
  })

  it('ensures minimum 1 day duration', () => {
    const dbTasks = [
      {
        id: 'task-4',
        title: 'Quick Task',
        start_date: null,
        end_date: null,
        predecessor_ids: null,
        estimated_hours: 2, // Less than 8 hours = still 1 day
      },
    ]

    const cpmTasks = tasksToCPM(dbTasks)
    expect(cpmTasks[0].duration).toBe(1)
  })
})
