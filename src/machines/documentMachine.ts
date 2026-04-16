import { colors } from '../styles/theme'

export type DocumentStatus = 'draft' | 'under_review' | 'approved' | 'archived'

export interface DocumentTransition {
  from: DocumentStatus
  to: DocumentStatus
  timestamp: string
  userId: string
}

// Role-based valid transitions:
//   draft          -> under_review   (any member)
//   under_review   -> approved       (admin, owner, manager)
//   under_review   -> draft          (reject back, admin/owner/manager)
//   approved       -> archived       (admin, owner)
//   archived       -> draft          (restore, admin/owner)
export function getValidTransitions(
  status: DocumentStatus,
  userRole: string = 'viewer',
): DocumentStatus[] {
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'
  const canReview =
    isAdminOrOwner || userRole === 'manager' || userRole === 'project_manager'

  const transitions: Record<DocumentStatus, DocumentStatus[]> = {
    draft:        ['under_review'],
    under_review: canReview ? ['approved', 'draft'] : [],
    approved:     isAdminOrOwner ? ['archived'] : [],
    archived:     isAdminOrOwner ? ['draft'] : [],
  }

  return transitions[status] ?? []
}

export function getDocumentStatusConfig(status: DocumentStatus): {
  label: string
  color: string
  bg: string
} {
  const config: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
    draft:        { label: 'Draft',        color: colors.statusNeutral,  bg: colors.statusNeutralSubtle  },
    under_review: { label: 'Under Review', color: colors.statusPending,  bg: colors.statusPendingSubtle  },
    approved:     { label: 'Approved',     color: colors.statusActive,   bg: colors.statusActiveSubtle   },
    archived:     { label: 'Archived',     color: colors.textTertiary,   bg: colors.surfaceInset         },
  }
  return config[status] ?? config.draft
}
