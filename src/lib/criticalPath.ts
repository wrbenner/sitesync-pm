// Critical Path Method (CPM) calculation for construction scheduling
// Forward pass → Early Start/Finish, Backward pass → Late Start/Finish, Float = LS - ES

import type { SchedulePhase } from '../stores/scheduleStore'

export interface ScheduleKPIs {
  scheduleVarianceDays: number
  spi: number
  criticalPathLength: number
  floatConsumedPct: number
  activitiesOnTimePct: number
  projectedCompletionDate: string
}

export function computeScheduleKPIs(phases: SchedulePhase[]): ScheduleKPIs {
  if (phases.length === 0) {
    return {
      scheduleVarianceDays: 0,
      spi: 1,
      criticalPathLength: 0,
      floatConsumedPct: 0,
      activitiesOnTimePct: 100,
      projectedCompletionDate: '',
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  // Schedule variance: baselineEnd minus currentEnd of the last critical phase (positive = ahead)
  const criticalPhases = phases.filter(p => p.critical)
  let scheduleVarianceDays = 0
  if (criticalPhases.length > 0) {
    const lastCritical = [...criticalPhases].sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    )[0]
    if (lastCritical.baselineEndDate) {
      const baselineEnd = new Date(lastCritical.baselineEndDate)
      baselineEnd.setHours(0, 0, 0, 0)
      const currentEnd = new Date(lastCritical.endDate)
      currentEnd.setHours(0, 0, 0, 0)
      scheduleVarianceDays = Math.round(
        (baselineEnd.getTime() - currentEnd.getTime()) / 86400000
      )
    }
  }

  // SPI = sum(earned_progress * planned_duration) / sum(expected_progress_by_today * planned_duration)
  let earnedSum = 0
  let plannedSum = 0
  for (const phase of phases) {
    const start = new Date(phase.startDate)
    const end = new Date(phase.endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const planDuration = Math.max(1, (end.getTime() - start.getTime()) / 86400000)

    let expectedProgress: number
    if (todayMs <= start.getTime()) {
      expectedProgress = 0
    } else if (todayMs >= end.getTime()) {
      expectedProgress = 1
    } else {
      expectedProgress = (todayMs - start.getTime()) / (end.getTime() - start.getTime())
    }

    earnedSum += (phase.progress / 100) * planDuration
    plannedSum += expectedProgress * planDuration
  }
  const spi = plannedSum > 0 ? Math.round((earnedSum / plannedSum) * 100) / 100 : 1

  // Float consumed: avg ratio of slippage to total float across phases that have float
  const phasesWithFloat = phases.filter(p => p.floatDays != null && p.floatDays > 0)
  let floatConsumedPct = 0
  if (phasesWithFloat.length > 0) {
    const totalRatio = phasesWithFloat.reduce((sum, p) => {
      return sum + Math.min(1, Math.max(0, p.slippageDays) / p.floatDays!)
    }, 0)
    floatConsumedPct = Math.round((totalRatio / phasesWithFloat.length) * 100)
  }

  // Activities on time: slippageDays <= 0
  const onTimeCount = phases.filter(p => p.slippageDays <= 0).length
  const activitiesOnTimePct = Math.round((onTimeCount / phases.length) * 100)

  // Projected completion: adjust latest end date by remaining work scaled by SPI
  const latestEnd = phases.reduce((latest, p) =>
    new Date(p.endDate) > new Date(latest.endDate) ? p : latest
  )
  let projectedCompletionDate = latestEnd.endDate
  if (spi > 0) {
    const endMs = new Date(latestEnd.endDate).setHours(0, 0, 0, 0)
    const remainingMs = Math.max(0, endMs - todayMs)
    const adjustedMs = remainingMs / spi
    projectedCompletionDate = new Date(todayMs + adjustedMs).toISOString().split('T')[0]
  }

  return {
    scheduleVarianceDays,
    spi,
    criticalPathLength: criticalPhases.length,
    floatConsumedPct,
    activitiesOnTimePct,
    projectedCompletionDate,
  }
}

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
