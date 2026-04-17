import { setup, fromPromise } from 'xstate'
import { colors } from '../styles/theme'

export type DocumentStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'void'

// ── Actor factory ─────────────────────────────────────────────────────────────
// Production: inject via documentMachine.provide({ actors: createDocumentActors(...) })
// Tests: no-op placeholders run without real API calls.

export function createDocumentActors(
  transitionFn: (documentId: string, status: DocumentStatus) => Promise<unknown>,
) {
  return {
    persistTransition: fromPromise(
      ({ input }: { input: { documentId: string; status: DocumentStatus } }) =>
        input.documentId
          ? transitionFn(input.documentId, input.status)
          : Promise.resolve(null),
    ),
  }
}

export interface DocumentTransition {
  from: DocumentStatus
  to: DocumentStatus
  timestamp: string
  userId: string
  reason?: string
}

// ── XState Machine ─────────────────────────────────────────────────────────────

export const documentMachine = setup({
  types: {
    context: {} as {
      documentId: string
      projectId: string
      transitions: DocumentTransition[]
      error: string | null
    },
    events: {} as
      | { type: 'SUBMIT'; userId: string }
      | { type: 'APPROVE'; userId: string }
      | { type: 'REJECT'; userId: string; reason?: string }
      | { type: 'ARCHIVE'; userId: string }
      | { type: 'RESTORE'; userId: string }
      | { type: 'RESUBMIT'; userId: string }
      | { type: 'VOID'; userId: string; reason: string },
  },
  actors: {
    persistTransition: fromPromise<
      unknown,
      { documentId: string; status: DocumentStatus }
    >(() => Promise.resolve(null)),
  },
}).createMachine({
  id: 'document',
  initial: 'draft',
  context: { documentId: '', projectId: '', transitions: [], error: null },
  states: {
    draft: {
      on: {
        SUBMIT: { target: 'submitted' },
        VOID: { target: 'void' },
      },
    },
    submitted: {
      on: {
        APPROVE: { target: 'approved' },
        REJECT: { target: 'rejected' },
        VOID: { target: 'void' },
      },
    },
    approved: {
      on: {
        ARCHIVE: { target: 'archived' },
        VOID: { target: 'void' },
      },
    },
    rejected: {
      on: {
        RESUBMIT: { target: 'submitted' },
        VOID: { target: 'void' },
      },
    },
    archived: {
      on: {
        RESTORE: { target: 'approved' },
      },
    },
    void: {
      type: 'final',
    },
  },
})

// ── Valid Transitions ──────────────────────────────────────────────────────────

const isPrivileged = (role: string) =>
  ['owner', 'admin', 'project_manager'].includes(role)

const isContributor = (role: string) =>
  isPrivileged(role) ||
  ['superintendent', 'gc_member', 'subcontractor', 'architect', 'designer'].includes(role)

export function getValidDocumentTransitions(
  status: DocumentStatus,
  userRole = 'viewer',
): DocumentStatus[] {
  const transitions: Record<DocumentStatus, DocumentStatus[]> = {
    draft:     isContributor(userRole) ? ['submitted'] : [],
    submitted: isPrivileged(userRole)  ? ['approved', 'rejected'] : [],
    approved:  isPrivileged(userRole)  ? ['archived'] : [],
    rejected:  isContributor(userRole) ? ['submitted'] : [],
    archived:  isPrivileged(userRole)  ? ['approved'] : [],
    void: [],
  }

  const result = [...(transitions[status] ?? [])]
  if (['owner', 'admin'].includes(userRole) && status !== 'void') {
    result.push('void')
  }
  return result
}

// ── Next Status ────────────────────────────────────────────────────────────────

export function getNextDocumentStatus(
  currentStatus: DocumentStatus,
  action: string,
): DocumentStatus | null {
  const map: Partial<Record<DocumentStatus, Record<string, DocumentStatus>>> = {
    draft:     { Submit: 'submitted', Void: 'void' },
    submitted: { Approve: 'approved', Reject: 'rejected', Void: 'void' },
    approved:  { Archive: 'archived', Void: 'void' },
    rejected:  { Resubmit: 'submitted', Void: 'void' },
    archived:  { Restore: 'approved' },
  }
  return map[currentStatus]?.[action] ?? null
}

// ── Status Display ────────────────────────────────────────────────────────────

export function getDocumentStatusConfig(status: DocumentStatus) {
  const config: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
    draft:     { label: 'Draft',     color: colors.statusNeutral,  bg: colors.statusNeutralSubtle  },
    submitted: { label: 'Submitted', color: colors.statusPending,  bg: colors.statusPendingSubtle  },
    approved:  { label: 'Approved',  color: colors.statusActive,   bg: colors.statusActiveSubtle   },
    rejected:  { label: 'Rejected',  color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    archived:  { label: 'Archived',  color: colors.textTertiary,   bg: colors.surfaceInset         },
    void:      { label: 'Void',      color: colors.textTertiary,   bg: colors.surfaceInset         },
  }
  return config[status] ?? config.draft
}
