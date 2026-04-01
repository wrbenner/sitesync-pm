// Query key factory for TanStack React Query
// Provides type-safe, hierarchical cache keys for all entities

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => ['projects', id] as const,
  },
  rfis: {
    all: (projectId: string) => ['rfis', projectId] as const,
    detail: (id: string) => ['rfis', 'detail', id] as const,
  },
  submittals: {
    all: (projectId: string) => ['submittals', projectId] as const,
    detail: (id: string) => ['submittals', 'detail', id] as const,
  },
  punchItems: {
    all: (projectId: string) => ['punch_items', projectId] as const,
  },
  tasks: {
    all: (projectId: string) => ['tasks', projectId] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
  drawings: {
    all: (projectId: string) => ['drawings', projectId] as const,
  },
  dailyLogs: {
    all: (projectId: string) => ['daily_logs', projectId] as const,
  },
  crews: {
    all: (projectId: string) => ['crews', projectId] as const,
  },
  budgetItems: {
    all: (projectId: string) => ['budget_items', projectId] as const,
  },
  changeOrders: {
    all: (projectId: string) => ['change_orders', projectId] as const,
  },
  meetings: {
    all: (projectId: string) => ['meetings', projectId] as const,
  },
  directoryContacts: {
    all: (projectId: string) => ['directory_contacts', projectId] as const,
  },
  files: {
    all: (projectId: string) => ['files', projectId] as const,
  },
  fieldCaptures: {
    all: (projectId: string) => ['field_captures', projectId] as const,
  },
  schedulePhases: {
    all: (projectId: string) => ['schedule_phases', projectId] as const,
  },
  notifications: {
    all: (userId: string) => ['notifications', userId] as const,
  },
  activityFeed: {
    all: (projectId: string) => ['activity_feed', projectId] as const,
  },
  aiInsights: {
    all: (projectId: string) => ['ai_insights', projectId] as const,
    byPage: (projectId: string, page: string) => ['ai_insights', projectId, page] as const,
  },
  projectSnapshots: {
    all: (projectId: string) => ['project_snapshots', projectId] as const,
  },
  metrics: {
    project: (projectId: string) => ['metrics', 'project', projectId] as const,
    portfolio: (orgId: string) => ['metrics', 'portfolio', orgId] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    detail: (id: string) => ['organizations', id] as const,
    projects: (orgId: string) => ['organizations', orgId, 'projects'] as const,
    portfolio: (orgId: string) => ['organizations', orgId, 'portfolio'] as const,
  },
  projectMembers: {
    all: (projectId: string) => ['project_members', projectId] as const,
  },
  auditLog: {
    project: (projectId: string) => ['audit_log', projectId] as const,
    projectFiltered: (projectId: string, filters: Record<string, unknown>) =>
      ['audit_log', projectId, filters] as const,
    entity: (entityType: string, entityId: string) =>
      ['audit_log', 'entity', entityType, entityId] as const,
  },
} as const

// Returns all project-scoped query keys for bulk invalidation (e.g. invalidateAll).
export function allProjectEntityKeys(projectId: string): ReadonlyArray<readonly unknown[]> {
  return [
    queryKeys.rfis.all(projectId),
    queryKeys.submittals.all(projectId),
    queryKeys.punchItems.all(projectId),
    queryKeys.tasks.all(projectId),
    queryKeys.drawings.all(projectId),
    queryKeys.dailyLogs.all(projectId),
    queryKeys.crews.all(projectId),
    queryKeys.budgetItems.all(projectId),
    queryKeys.changeOrders.all(projectId),
    queryKeys.meetings.all(projectId),
    queryKeys.directoryContacts.all(projectId),
    queryKeys.files.all(projectId),
    queryKeys.fieldCaptures.all(projectId),
    queryKeys.schedulePhases.all(projectId),
    queryKeys.activityFeed.all(projectId),
    queryKeys.aiInsights.all(projectId),
    queryKeys.projectSnapshots.all(projectId),
    queryKeys.metrics.project(projectId),
    queryKeys.projectMembers.all(projectId),
  ]
}
