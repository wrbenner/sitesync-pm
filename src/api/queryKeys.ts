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
} as const
