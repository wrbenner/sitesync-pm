import { setup } from 'xstate';
import { colors } from '../styles/theme';

// DB CHECK constraint: ('completed', 'active', 'upcoming', 'at_risk', 'delayed', 'on_track')
export type ScheduleStatus = 'upcoming' | 'active' | 'delayed' | 'completed' | 'at_risk' | 'on_track';

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
  initial: 'upcoming',
  context: { phaseId: '', projectId: '', error: null },
  states: {
    upcoming: {
      on: {
        START: { target: 'active' },
        MARK_DELAYED: { target: 'delayed' },
      },
    },
    active: {
      on: {
        COMPLETE: { target: 'completed' },
        MARK_DELAYED: { target: 'delayed' },
      },
    },
    delayed: {
      on: {
        RESUME: { target: 'active' },
        COMPLETE: { target: 'completed' },
      },
    },
    completed: {
      on: {
        REOPEN: { target: 'active' },
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
    upcoming: ['active', 'delayed'],
    active: ['completed', 'delayed'],
    on_track: ['completed', 'delayed'],
    at_risk: ['active', 'delayed', 'completed'],
    delayed: ['active', 'completed'],
    completed: [],
  };

  const result: ScheduleStatus[] = [...(base[status] ?? [])];

  if (status === 'completed' && canReopen) {
    result.push('active');
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
    upcoming: {
      label: 'Upcoming',
      color: colors.statusNeutral,
      bg: colors.statusNeutralSubtle,
    },
    active: {
      label: 'Active',
      color: colors.statusInfo,
      bg: colors.statusInfoSubtle,
    },
    on_track: {
      label: 'On Track',
      color: colors.statusActive,
      bg: colors.statusActiveSubtle,
    },
    at_risk: {
      label: 'At Risk',
      color: colors.statusPending,
      bg: colors.statusPendingSubtle,
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
  return config[status] ?? config.upcoming;
}

// ── Derived Status from Progress ─────────────────────────────────────────────

export function deriveStatusFromProgress(
  percent: number,
  currentStatus: ScheduleStatus,
): ScheduleStatus {
  if (percent >= 100) return 'completed';
  if (percent > 0 && currentStatus === 'upcoming') return 'active';
  return currentStatus;
}
