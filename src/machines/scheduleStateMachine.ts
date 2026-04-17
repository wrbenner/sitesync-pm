import { setup } from 'xstate';
import { colors } from '../styles/theme';

// Task lifecycle: planned → in_progress → completed → approved
// This machine governs individual tasks/activities within a schedule phase,
// adding the 'approved' state required for formal sign-off workflows.
export type TaskLifecycleStatus = 'planned' | 'in_progress' | 'completed' | 'approved';

export const scheduleStateMachine = setup({
  types: {
    context: {} as {
      taskId: string;
      projectId: string;
      error: string | null;
    },
    events: {} as
      | { type: 'START' }
      | { type: 'COMPLETE' }
      | { type: 'APPROVE'; approverId: string }
      | { type: 'REOPEN'; userId: string },
  },
}).createMachine({
  id: 'scheduleTask',
  initial: 'planned',
  context: { taskId: '', projectId: '', error: null },
  states: {
    planned: {
      on: {
        START: { target: 'in_progress' },
      },
    },
    in_progress: {
      on: {
        COMPLETE: { target: 'completed' },
      },
    },
    completed: {
      on: {
        APPROVE: { target: 'approved' },
        REOPEN: { target: 'in_progress' },
      },
    },
    approved: {
      on: {
        REOPEN: { target: 'in_progress' },
      },
    },
  },
});

// ── Role-Gated Transitions ───────────────────────────────────────────────────
//
// Roles that can act:
//   planned → in_progress   : superintendent, project_manager, admin, owner
//   in_progress → completed : superintendent, project_manager, admin, owner
//   completed → approved    : project_manager, admin, owner  (formal sign-off)
//   completed → in_progress : project_manager, admin, owner  (reopen)
//   approved → in_progress  : admin, owner  (must escalate to admin to un-approve)
//
// viewer / subcontractor get no transitions.

export function getValidTaskTransitions(
  status: TaskLifecycleStatus,
  userRole: string = 'viewer',
): TaskLifecycleStatus[] {
  const canEdit = ['owner', 'admin', 'project_manager', 'superintendent'].includes(userRole);
  const canApproveOrReopen = ['owner', 'admin', 'project_manager'].includes(userRole);
  const canReopenApproved = ['owner', 'admin'].includes(userRole);

  if (!canEdit) return [];

  switch (status) {
    case 'planned':
      return ['in_progress'];
    case 'in_progress':
      return ['completed'];
    case 'completed': {
      const out: TaskLifecycleStatus[] = [];
      if (canApproveOrReopen) out.push('approved');
      if (canApproveOrReopen) out.push('in_progress');
      return out;
    }
    case 'approved':
      return canReopenApproved ? ['in_progress'] : [];
    default:
      return [];
  }
}

// ── Status Display Config ────────────────────────────────────────────────────

export function getTaskStatusConfig(status: TaskLifecycleStatus): {
  label: string;
  color: string;
  bg: string;
} {
  const config: Record<TaskLifecycleStatus, { label: string; color: string; bg: string }> = {
    planned: {
      label: 'Planned',
      color: colors.statusNeutral,
      bg: colors.statusNeutralSubtle,
    },
    in_progress: {
      label: 'In Progress',
      color: colors.statusInfo,
      bg: colors.statusInfoSubtle,
    },
    completed: {
      label: 'Completed',
      color: colors.statusActive,
      bg: colors.statusActiveSubtle,
    },
    approved: {
      label: 'Approved',
      color: colors.statusActive,
      bg: colors.statusActiveSubtle,
    },
  };
  return config[status] ?? config.planned;
}

// ── Next Status from Event ───────────────────────────────────────────────────

export function getNextTaskStatus(
  current: TaskLifecycleStatus,
  event: 'START' | 'COMPLETE' | 'APPROVE' | 'REOPEN',
): TaskLifecycleStatus | null {
  const map: Record<TaskLifecycleStatus, Partial<Record<string, TaskLifecycleStatus>>> = {
    planned: { START: 'in_progress' },
    in_progress: { COMPLETE: 'completed' },
    completed: { APPROVE: 'approved', REOPEN: 'in_progress' },
    approved: { REOPEN: 'in_progress' },
  };
  return map[current]?.[event] ?? null;
}
