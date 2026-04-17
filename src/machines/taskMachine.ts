import { setup } from 'xstate'
import { colors } from '../styles/theme'

export type TaskState = 'todo' | 'in_progress' | 'in_review' | 'done'

export const taskMachine = setup({
  types: {
    context: {} as {
      taskId: string
      projectId: string
      error: string | null
    },
    events: {} as
      | { type: 'START' }
      | { type: 'SUBMIT_FOR_REVIEW' }
      | { type: 'APPROVE' }
      | { type: 'REJECT' }
      | { type: 'COMPLETE' }
      | { type: 'REOPEN' },
  },
}).createMachine({
  id: 'task',
  initial: 'todo',
  context: { taskId: '', projectId: '', error: null },
  states: {
    todo: {
      on: {
        START: { target: 'in_progress' },
        COMPLETE: { target: 'done' },
      },
    },
    in_progress: {
      on: {
        SUBMIT_FOR_REVIEW: { target: 'in_review' },
        COMPLETE: { target: 'done' },
      },
    },
    in_review: {
      on: {
        APPROVE: { target: 'done' },
        REJECT: { target: 'in_progress' },
      },
    },
    done: {
      on: {
        REOPEN: { target: 'todo' },
      },
    },
  },
})

// Valid transitions from each state
export function getValidTaskTransitions(status: TaskState): string[] {
  const transitions: Record<TaskState, string[]> = {
    todo: ['Start Work', 'Mark Complete'],
    in_progress: ['Submit for Review', 'Mark Complete'],
    in_review: ['Approve', 'Send Back'],
    done: ['Reopen'],
  }
  return transitions[status] || []
}

// Next status for an action
export function getNextTaskStatus(currentStatus: TaskState, action: string): TaskState | null {
  const map: Record<string, Record<string, TaskState>> = {
    todo: { 'Start Work': 'in_progress', 'Mark Complete': 'done' },
    in_progress: { 'Submit for Review': 'in_review', 'Mark Complete': 'done' },
    in_review: { 'Approve': 'done', 'Send Back': 'in_progress' },
    done: { 'Reopen': 'todo' },
  }
  return map[currentStatus]?.[action] || null
}

// Role-gated status transitions for server-side validation
/**
 * Returns valid target TaskStates for a given current status and user role.
 * Used by stateMachineValidator and taskService for server-side lifecycle enforcement.
 */
export function getValidTaskStatusTransitions(
  status: TaskState,
  role: string = 'viewer',
): TaskState[] {
  const isReviewer = ['project_manager', 'superintendent', 'admin', 'owner'].includes(role)
  const nonViewer = role !== 'viewer'

  switch (status) {
    case 'todo':
      return nonViewer ? ['in_progress', 'done'] : []
    case 'in_progress':
      return nonViewer ? ['in_review', 'done'] : []
    case 'in_review':
      return isReviewer ? ['done', 'in_progress'] : []
    case 'done':
      return isReviewer ? ['todo'] : []
    default:
      return []
  }
}

// Status display config
export function getTaskStatusConfig(status: TaskState) {
  const config: Record<TaskState, { label: string; color: string; bg: string }> = {
    todo: { label: 'To Do', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    in_progress: { label: 'In Progress', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    in_review: { label: 'In Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
    done: { label: 'Done', color: colors.statusActive, bg: colors.statusActiveSubtle },
  }
  return config[status] || config.todo
}
