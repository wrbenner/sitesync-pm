// Centralized mutation-to-invalidation mapping.
// Every entity type maps to all query keys that must be invalidated when that entity changes,
// including cross-entity dependencies (e.g. change orders affect budget items).

import { queryClient } from '../lib/queryClient'
import { queryKeys } from './queryKeys'

export type EntityType =
  | 'rfi'
  | 'submittal'
  | 'change_order'
  | 'budget_item'
  | 'daily_log'
  | 'punch_item'
  | 'task'
  | 'meeting'
  | 'crew'
  | 'drawing'
  | 'file'
  | 'contact'
  | 'schedule_phase'
  | 'field_capture'

const INVALIDATION_MAP: Record<EntityType, (projectId: string) => Array<readonly unknown[]>> = {
  rfi: (pid) => [
    queryKeys.rfis.all(pid),
    queryKeys.activityFeed.all(pid),
    queryKeys.aiInsights.all(pid),
    queryKeys.metrics.project(pid),
  ],
  submittal: (pid) => [
    queryKeys.submittals.all(pid),
    queryKeys.activityFeed.all(pid),
    queryKeys.metrics.project(pid),
  ],
  change_order: (pid) => [
    queryKeys.changeOrders.all(pid),
    queryKeys.budgetItems.all(pid), // COs directly affect budget
    queryKeys.activityFeed.all(pid),
    queryKeys.metrics.project(pid),
    queryKeys.projectSnapshots.all(pid),
  ],
  budget_item: (pid) => [
    queryKeys.budgetItems.all(pid),
    queryKeys.metrics.project(pid),
    queryKeys.projectSnapshots.all(pid),
  ],
  daily_log: (pid) => [
    queryKeys.dailyLogs.all(pid),
    queryKeys.activityFeed.all(pid),
    queryKeys.metrics.project(pid),
  ],
  punch_item: (pid) => [
    queryKeys.punchItems.all(pid),
    queryKeys.activityFeed.all(pid),
    queryKeys.metrics.project(pid),
  ],
  task: (pid) => [
    queryKeys.tasks.all(pid),
    queryKeys.activityFeed.all(pid),
    queryKeys.schedulePhases.all(pid),
  ],
  meeting: (pid) => [
    queryKeys.meetings.all(pid),
    queryKeys.activityFeed.all(pid),
  ],
  crew: (pid) => [
    queryKeys.crews.all(pid),
    queryKeys.metrics.project(pid),
  ],
  drawing: (pid) => [
    queryKeys.drawings.all(pid),
    queryKeys.activityFeed.all(pid),
  ],
  file: (pid) => [
    queryKeys.files.all(pid),
  ],
  contact: (pid) => [
    queryKeys.directoryContacts.all(pid),
  ],
  schedule_phase: (pid) => [
    queryKeys.schedulePhases.all(pid),
    queryKeys.activityFeed.all(pid),
    queryKeys.metrics.project(pid),
  ],
  field_capture: (pid) => [
    queryKeys.fieldCaptures.all(pid),
    queryKeys.activityFeed.all(pid),
  ],
}

export function invalidateEntity(entityType: EntityType, projectId: string): void {
  const keys = INVALIDATION_MAP[entityType]?.(projectId) ?? []
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: key as unknown[] })
  })
}

export function invalidateAll(projectId: string): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) })
  const seen = new Set<string>()
  Object.values(INVALIDATION_MAP).forEach((fn) => {
    fn(projectId).forEach((key) => {
      const serialized = JSON.stringify(key)
      if (!seen.has(serialized)) {
        seen.add(serialized)
        queryClient.invalidateQueries({ queryKey: key as unknown[] })
      }
    })
  })
}
