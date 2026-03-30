// Critical Path Method (CPM) calculation for construction scheduling
// Forward pass → Early Start/Finish, Backward pass → Late Start/Finish, Float = LS - ES

export interface CPMTask {
  id: string
  title: string
  duration: number // in days
  predecessors: string[] // task IDs
  startDate?: string | null
  endDate?: string | null
}

export interface CPMResult {
  id: string
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
}

export function calculateCriticalPath(tasks: CPMTask[]): Map<string, CPMResult> {
  const results = new Map<string, CPMResult>()
  const taskMap = new Map(tasks.map(t => [t.id, t]))

  // Initialize results
  for (const task of tasks) {
    results.set(task.id, {
      id: task.id,
      earlyStart: 0,
      earlyFinish: task.duration,
      lateStart: 0,
      lateFinish: 0,
      totalFloat: 0,
      isCritical: false,
    })
  }

  // Topological sort for processing order
  const visited = new Set<string>()
  const order: string[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const task = taskMap.get(id)
    if (!task) return
    for (const predId of task.predecessors) {
      visit(predId)
    }
    order.push(id)
  }

  for (const task of tasks) {
    visit(task.id)
  }

  // Forward pass: calculate early start and early finish
  for (const id of order) {
    const task = taskMap.get(id)!
    const result = results.get(id)!
    let maxPredFinish = 0

    for (const predId of task.predecessors) {
      const predResult = results.get(predId)
      if (predResult) {
        maxPredFinish = Math.max(maxPredFinish, predResult.earlyFinish)
      }
    }

    result.earlyStart = maxPredFinish
    result.earlyFinish = maxPredFinish + task.duration
  }

  // Find project finish (max early finish)
  let projectFinish = 0
  for (const result of results.values()) {
    projectFinish = Math.max(projectFinish, result.earlyFinish)
  }

  // Backward pass: calculate late start and late finish
  // Initialize all late finishes to project finish
  for (const result of results.values()) {
    result.lateFinish = projectFinish
    result.lateStart = projectFinish - (taskMap.get(result.id)?.duration || 0)
  }

  // Process in reverse topological order
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]
    const task = taskMap.get(id)!
    const result = results.get(id)!

    // Find minimum late start of all successors
    let minSuccStart = projectFinish
    for (const otherTask of tasks) {
      if (otherTask.predecessors.includes(id)) {
        const succResult = results.get(otherTask.id)
        if (succResult) {
          minSuccStart = Math.min(minSuccStart, succResult.lateStart)
        }
      }
    }

    result.lateFinish = minSuccStart
    result.lateStart = result.lateFinish - task.duration
    result.totalFloat = result.lateStart - result.earlyStart
    result.isCritical = result.totalFloat === 0
  }

  return results
}

// Helper: convert tasks from DB format to CPM format
export function tasksToCPM(tasks: Array<{
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  predecessor_ids: string[] | null
  estimated_hours: number | null
}>): CPMTask[] {
  return tasks.map(t => {
    let duration = 1 // default 1 day
    if (t.start_date && t.end_date) {
      duration = Math.max(1, Math.ceil((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / (1000 * 60 * 60 * 24)))
    } else if (t.estimated_hours) {
      duration = Math.max(1, Math.ceil(t.estimated_hours / 8))
    }
    return {
      id: t.id,
      title: t.title,
      duration,
      predecessors: t.predecessor_ids || [],
      startDate: t.start_date,
      endDate: t.end_date,
    }
  })
}
