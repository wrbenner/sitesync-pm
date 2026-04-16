import { setup } from 'xstate';
import { colors } from '../styles/theme';

export type ScheduleStatus = 'planned' | 'in_progress' | 'delayed' | 'completed';

export const scheduleMachine = setup({
  types: {
    context: {} as {
      phaseId: string;
      projectId: string;
      error: string | null;
    },
    events: {} as
      | { type: 'START' }
      | { type: 'MARK_DELAYED'; reason?: string }
      | { type: 'RESUME' }
      | { type: 'COMPLETE' }
      | { type: 'REOPEN'; userId: string },
  },
}).createMachine({
  id: 'schedule',
  initial: 'planned',
  context: { phaseId: '', projectId: '', error: null },
  states: {
    planned: {
      on: {
        START: { target: 'in_progress' },
        MARK_DELAYED: { target: 'delayed' },
      },
    },
    in_progress: {
      on: {
        COMPLETE: { target: 'completed' },
        MARK_DELAYED: { target: 'delayed' },
      },
    },
    delayed: {
      on: {
        RESUME: { target: 'in_progress' },
        COMPLETE: { target: 'completed' },
      },
    },
    completed: {
      on: {
        REOPEN: { target: 'in_progress' },
      },
    },
  },
});

// ── Valid Transitions ────────────────────────────────────────────────────────
//
// Returns TARGET STATUS NAMES (not action labels) so the service layer can
// directly compare the requested newStatus against the valid set.
//
// Role gate:
//   viewer / subcontractor  — read only, no transitions
//   superintendent          — can start, delay, resume, and complete
//   project_manager / admin / owner — all transitions including reopen

export function getValidScheduleTransitions(
  status: ScheduleStatus,
  userRole: string = 'viewer',
): ScheduleStatus[] {
  const canEdit = ['owner', 'admin', 'project_manager', 'superintendent'].includes(userRole);
  const canReopen = ['owner', 'admin', 'project_manager'].includes(userRole);

  if (!canEdit) return [];

  const base: Record<ScheduleStatus, ScheduleStatus[]> = {
    planned: ['in_progress', 'delayed'],
    in_progress: ['completed', 'delayed'],
    delayed: ['in_progress', 'completed'],
    completed: [],
  };

  const result: ScheduleStatus[] = [...(base[status] ?? [])];

  if (status === 'completed' && canReopen) {
    result.push('in_progress');
  }

  return result;
}

// ── Status Display ───────────────────────────────────────────────────────────

export function getScheduleStatusConfig(status: ScheduleStatus): {
  label: string;
  color: string;
  bg: string;
} {
  const config: Record<ScheduleStatus, { label: string; color: string; bg: string }> = {
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
    delayed: {
      label: 'Delayed',
      color: colors.statusCritical,
      bg: colors.statusCriticalSubtle,
    },
    completed: {
      label: 'Completed',
      color: colors.statusActive,
      bg: colors.statusActiveSubtle,
    },
  };
  return config[status] ?? config.planned;
}

// ── Derived Status from Progress ─────────────────────────────────────────────

export function deriveStatusFromProgress(
  percent: number,
  currentStatus: ScheduleStatus,
): ScheduleStatus {
  if (percent >= 100) return 'completed';
  if (percent > 0 && currentStatus === 'planned') return 'in_progress';
  return currentStatus;
}
