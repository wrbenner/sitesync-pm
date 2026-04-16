import { setup } from 'xstate';
import { colors } from '../styles/theme';
import type { InspectionStatus } from '../types/inspection';

export type { InspectionStatus };

export const inspectionMachine = setup({
  types: {
    context: {} as {
      inspectionId: string;
      projectId: string;
      error: string | null;
    },
    events: {} as
      | { type: 'START' }
      | { type: 'COMPLETE'; score?: number }
      | { type: 'APPROVE'; userId: string }
      | { type: 'REJECT'; userId: string; reason: string }
      | { type: 'RESCHEDULE'; userId: string }
      | { type: 'CANCEL'; userId: string; reason: string },
  },
}).createMachine({
  id: 'inspection',
  initial: 'scheduled',
  context: { inspectionId: '', projectId: '', error: null },
  states: {
    scheduled: {
      on: {
        START: { target: 'in_progress' },
        CANCEL: { target: 'cancelled' },
      },
    },
    in_progress: {
      on: {
        COMPLETE: { target: 'completed' },
        CANCEL: { target: 'cancelled' },
      },
    },
    completed: {
      on: {
        APPROVE: { target: 'approved' },
        REJECT: { target: 'rejected' },
      },
    },
    approved: {
      type: 'final',
    },
    rejected: {
      on: {
        RESCHEDULE: { target: 'scheduled' },
        CANCEL: { target: 'cancelled' },
      },
    },
    cancelled: {
      type: 'final',
    },
  },
});

// ── Valid Transitions ────────────────────────────────────────────────────────
//
// Returns target STATUS NAMES so the service layer can validate newStatus directly.
//
// Role gate:
//   viewer / subcontractor       — read only, no transitions
//   superintendent / foreman     — can start, complete, reschedule
//   project_manager / admin / owner — all transitions including approve, reject, cancel

export function getValidInspectionTransitions(
  status: InspectionStatus,
  userRole: string = 'viewer',
): InspectionStatus[] {
  const canField = ['owner', 'admin', 'project_manager', 'superintendent', 'foreman'].includes(userRole);
  const canReview = ['owner', 'admin', 'project_manager'].includes(userRole);

  if (!canField) return [];

  const base: Record<InspectionStatus, InspectionStatus[]> = {
    scheduled: ['in_progress'],
    in_progress: ['completed'],
    completed: [],
    approved: [],
    rejected: ['scheduled'],
    cancelled: [],
  };

  const result: InspectionStatus[] = [...(base[status] ?? [])];

  if (canReview) {
    if (status === 'completed') {
      result.push('approved', 'rejected');
    }
    if (['scheduled', 'in_progress', 'rejected'].includes(status)) {
      result.push('cancelled');
    }
  }

  return result;
}

// ── Status Display ───────────────────────────────────────────────────────────

export function getInspectionStatusConfig(status: InspectionStatus): {
  label: string;
  color: string;
  bg: string;
} {
  const config: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
    scheduled: {
      label: 'Scheduled',
      color: colors.statusInfo,
      bg: colors.statusInfoSubtle,
    },
    in_progress: {
      label: 'In Progress',
      color: colors.statusPending,
      bg: colors.statusPendingSubtle,
    },
    completed: {
      label: 'Completed',
      color: colors.statusReview,
      bg: colors.statusReviewSubtle,
    },
    approved: {
      label: 'Approved',
      color: colors.statusActive,
      bg: colors.statusActiveSubtle,
    },
    rejected: {
      label: 'Rejected',
      color: colors.statusCritical,
      bg: colors.statusCriticalSubtle,
    },
    cancelled: {
      label: 'Cancelled',
      color: colors.statusNeutral,
      bg: colors.statusNeutralSubtle,
    },
  };
  return config[status] ?? config.scheduled;
}

// ── Score Urgency ────────────────────────────────────────────────────────────

export function getScoreConfig(score: number | null): { color: string; label: string } {
  if (score === null) return { color: colors.statusNeutral, label: 'Not scored' };
  if (score >= 90) return { color: colors.statusActive, label: `${score}% Pass` };
  if (score >= 70) return { color: colors.statusPending, label: `${score}% Marginal` };
  return { color: colors.statusCritical, label: `${score}% Fail` };
}
