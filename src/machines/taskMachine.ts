import { setup } from 'xstate'

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

// Status display config
export function getTaskStatusConfig(status: TaskState) {
  const config: Record<TaskState, { label: string; color: string; bg: string }> = {
    todo: { label: 'To Do', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    in_progress: { label: 'In Progress', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
    in_review: { label: 'In Review', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    done: { label: 'Done', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
  }
  return config[status] || config.todo
}
