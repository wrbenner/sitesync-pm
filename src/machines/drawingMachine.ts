import { setup, fromPromise } from 'xstate';
import { colors } from '../styles/theme';
import type { DrawingStatus } from '../types/drawing';

export type { DrawingStatus };

export interface DrawingTransition {
  from: DrawingStatus;
  to: DrawingStatus;
  timestamp: string;
  userId: string;
  reason?: string;
}

// Actor factory for production. Inject via drawingMachine.provide({ actors: createDrawingActors(...) }).
export function createDrawingActors(
  transitionFn: (drawingId: string, status: DrawingStatus) => Promise<unknown>,
) {
  return {
    persistTransition: fromPromise(
      ({ input }: { input: { drawingId: string; status: DrawingStatus } }) =>
        input.drawingId
          ? transitionFn(input.drawingId, input.status)
          : Promise.resolve(null),
    ),
  };
}

export const drawingMachine = setup({
  types: {
    context: {} as {
      drawingId: string;
      projectId: string;
      transitions: DrawingTransition[];
      error: string | null;
    },
    events: {} as
      | { type: 'SUBMIT_FOR_REVIEW' }
      | { type: 'APPROVE'; userId: string }
      | { type: 'REJECT'; userId: string; reason: string }
      | { type: 'PUBLISH'; userId: string }
      | { type: 'REVISE'; userId: string }
      | { type: 'SUPERSEDE'; userId: string }
      | { type: 'ARCHIVE'; userId: string; reason: string },
  },
  actors: {
    persistTransition: fromPromise<unknown, { drawingId: string; status: DrawingStatus }>(
      () => Promise.resolve(null),
    ),
  },
}).createMachine({
  id: 'drawing',
  initial: 'draft',
  context: { drawingId: '', projectId: '', transitions: [], error: null },
  states: {
    draft: {
      on: {
        SUBMIT_FOR_REVIEW: { target: 'under_review' },
        ARCHIVE: { target: 'archived' },
      },
    },
    under_review: {
      on: {
        APPROVE: { target: 'approved' },
        REJECT: { target: 'rejected' },
        ARCHIVE: { target: 'archived' },
      },
    },
    approved: {
      on: {
        PUBLISH: { target: 'published' },
        REVISE: { target: 'draft' },
        ARCHIVE: { target: 'archived' },
      },
    },
    rejected: {
      on: {
        REVISE: { target: 'draft' },
        ARCHIVE: { target: 'archived' },
      },
    },
    published: {
      on: {
        SUPERSEDE: { target: 'draft' },
        ARCHIVE: { target: 'archived' },
      },
    },
    archived: {
      type: 'final',
    },
  },
});

// ── Valid Transitions ────────────────────────────────────────────────────────

export function getValidTransitions(
  status: DrawingStatus,
  userRole: string = 'viewer',
): string[] {
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';
  const isReviewer = isAdminOrOwner || userRole === 'reviewer' || userRole === 'project_manager';

  const base: Record<DrawingStatus, string[]> = {
    draft: ['Submit for Review'],
    under_review: isReviewer ? ['Approve', 'Reject'] : [],
    approved: isAdminOrOwner ? ['Publish', 'Revise'] : [],
    rejected: ['Revise'],
    published: isAdminOrOwner ? ['Supersede'] : [],
    archived: [],
  };

  const result = [...(base[status] ?? [])];

  if (isAdminOrOwner && status !== 'archived') {
    result.push('Archive');
  }

  return result;
}

// ── Next Status ──────────────────────────────────────────────────────────────

export function getNextStatus(
  currentStatus: DrawingStatus,
  action: string,
): DrawingStatus | null {
  const map: Record<string, Record<string, DrawingStatus>> = {
    draft: { 'Submit for Review': 'under_review', Archive: 'archived' },
    under_review: { Approve: 'approved', Reject: 'rejected', Archive: 'archived' },
    approved: { Publish: 'published', Revise: 'draft', Archive: 'archived' },
    rejected: { Revise: 'draft', Archive: 'archived' },
    published: { Supersede: 'draft', Archive: 'archived' },
    archived: {},
  };
  return map[currentStatus]?.[action] ?? null;
}

// ── Status Display ───────────────────────────────────────────────────────────

export function getDrawingStatusConfig(status: DrawingStatus) {
  const config: Record<DrawingStatus, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    under_review: {
      label: 'Under Review',
      color: colors.statusPending,
      bg: colors.statusPendingSubtle,
    },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    published: { label: 'Published', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    archived: { label: 'Archived', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  };
  return config[status] ?? config.draft;
}

// ── Days Since Issued ────────────────────────────────────────────────────────

export function getDaysSinceIssued(receivedDate: string | null): number {
  if (!receivedDate) return 0;
  return Math.max(
    0,
    Math.ceil((Date.now() - new Date(receivedDate).getTime()) / (1000 * 60 * 60 * 24)),
  );
}
