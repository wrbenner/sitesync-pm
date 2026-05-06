// Centralized mutation-to-invalidation mapping.
// Every entity type maps to all query keys that must be invalidated when that entity changes,
// including cross-entity dependencies (e.g. change orders affect budget items).

import { queryClient } from '../lib/queryClient'
import { queryKeys } from './queryKeys'
import { queueNotification } from '../services/notifications/emailNotificationService'

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

export async function triggerNotificationsForMutation(
  entityType: EntityType,
  projectId: string,
  action: 'create' | 'update' | 'delete',
  entityData: Record<string, unknown>
): Promise<void> {
  try {
    switch (entityType) {
      case 'rfi':
        if (action === 'create' && entityData.assigned_to) {
          await queueNotification(projectId, 'rfi_assigned', String(entityData.assigned_to), {
            rfiNumber: String(entityData.number ?? ''),
            rfiTitle: String(entityData.title ?? ''),
            dueDate: String(entityData.due_date ?? 'No due date'),
            projectName: String(entityData.project_name ?? 'Project'),
            link: '/rfis/' + String(entityData.id ?? ''),
          })
        } else if (action === 'update' && entityData.status === 'answered') {
          await queueNotification(projectId, 'rfi_response', String(entityData.created_by ?? ''), {
            rfiNumber: String(entityData.number ?? ''),
            rfiTitle: String(entityData.title ?? ''),
            dueDate: String(entityData.due_date ?? 'No due date'),
            projectName: String(entityData.project_name ?? 'Project'),
            link: '/rfis/' + String(entityData.id ?? ''),
          })
        }
        break
      case 'submittal':
        if (action === 'update' && entityData.status === 'approved') {
          await queueNotification(projectId, 'submittal_approved', String(entityData.submitted_by ?? ''), {
            submittalNumber: String(entityData.number ?? ''),
            submittalTitle: String(entityData.title ?? ''),
            projectName: String(entityData.project_name ?? 'Project'),
            link: '/submittals/' + String(entityData.id ?? ''),
          })
        } else if (action === 'update' && (entityData.status === 'rejected' || entityData.status === 'resubmit')) {
          await queueNotification(projectId, 'submittal_revision', String(entityData.submitted_by ?? ''), {
            submittalNumber: String(entityData.number ?? ''),
            submittalTitle: String(entityData.title ?? ''),
            projectName: String(entityData.project_name ?? 'Project'),
            link: '/submittals/' + String(entityData.id ?? ''),
          })
        }
        break
      case 'change_order':
        if (action === 'update' && entityData.status === 'pending_approval') {
          await queueNotification(projectId, 'change_order_pending', String(entityData.approved_by ?? ''), {
            changeOrderNumber: String(entityData.number ?? ''),
            changeOrderTitle: String(entityData.title ?? ''),
            projectName: String(entityData.project_name ?? 'Project'),
            link: '/change-orders/' + String(entityData.id ?? ''),
          })
        }
        break
      case 'punch_item':
        if (action === 'create' && entityData.assigned_to) {
          await queueNotification(projectId, 'punch_item_assigned', String(entityData.assigned_to), {
            punchItemTitle: String(entityData.title ?? ''),
            location: String(entityData.location ?? ''),
            projectName: String(entityData.project_name ?? 'Project'),
            link: '/punch-list/' + String(entityData.id ?? ''),
          })
        }
        break
      case 'meeting':
        // Meeting notifications require iterating attendees, no-op for now
        break
      default:
        return
    }
  } catch (err) {
    if (import.meta.env.DEV) console.error('triggerNotificationsForMutation error:', err)
  }
}

export function invalidateEntity(entityType: EntityType, projectId: string): void {
  const keys = INVALIDATION_MAP[entityType]?.(projectId) ?? []
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: key as unknown[] })
  })
  triggerNotificationsForMutation(entityType, projectId, 'update', {}).catch(() => {})
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
