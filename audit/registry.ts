// PAGE_REGISTRY — the source of truth for which routes exist, what entity each
// manages, and what CRUD/import/export capabilities are contractually expected.
//
// Every change to src/App.tsx routes must be mirrored here, enforced by
// src/test/audit/registry.test.ts. The audit harness (scripts/audit.ts)
// reads this file to validate that each page's actual behavior matches its
// declared contract.

export type EntityKind =
  | 'rfi'
  | 'submittal'
  | 'task'
  | 'change-order'
  | 'daily-log'
  | 'crew'
  | 'meeting'
  | 'project'
  | 'punch-item'
  | 'phase'
  | 'contact'
  | 'budget-item'
  | 'pay-app'
  | 'drawing'
  | 'permit'
  | 'contract'
  | 'vendor'
  | 'transmittal'
  | 'file'
  | 'lien-waiver'
  | 'equipment'
  | 'bid-package'
  | 'closeout-item'
  | 'specification'
  | 'resource'
  | 'cost-code'
  | 'time-entry'
  | 'delivery'
  | 'wiki-page'
  | 'tool-talk'
  | 'pre-task-plan'
  | 'certification'

export type FeatureFlag =
  | 'has_list'
  | 'has_create'
  | 'has_edit'
  | 'has_delete'
  | 'has_import'
  | 'has_export'
  | 'has_detail_view'
  | 'has_filters'
  | 'has_search'

export type PageStatus = 'production' | 'beta' | 'stub'

export interface PageContract {
  /** Hash-router path, e.g. '/rfis'. Matches <Route path=...> in src/App.tsx. */
  route: string
  /** Absolute-from-repo path to the page's primary component. */
  pageFile: string
  /** Human title for reports. */
  title: string
  /** Primary entity managed on this page, or null for dashboards/settings. */
  entity: EntityKind | null
  /** Declared capabilities — what the page PROMISES to do. */
  expected: Partial<Record<FeatureFlag, boolean>>
  /** Create modal component name in src/components/forms/ (if applicable). */
  createModal?: string
  /** Mutation hook file — e.g. 'src/hooks/mutations/rfis.ts'. */
  hooksModule?: string
  /** ExportCenter report-type key or exportXlsx function suffix. */
  exportReportType?: string
  /** ProtectedRoute moduleId — matches MODULE_PERMISSIONS in usePermissions.ts. */
  permissionModule?: string
  /** Lifecycle status. 'stub' = known skeleton, not counted in compliance %. */
  status: PageStatus
  /** Free-form notes surfaced into PAGE_HEALTH.md. */
  knownIssues?: string[]
}

// ── Registry ────────────────────────────────────────────────
// Seed order mirrors src/App.tsx:329-383 route declarations.

export const PAGE_REGISTRY: PageContract[] = [
  // ── Auth (no project context) ────────────────────────────
  {
    route: '/login',
    pageFile: 'src/pages/auth/Login.tsx',
    title: 'Login',
    entity: null,
    expected: {},
    status: 'production',
  },
  {
    route: '/signup',
    pageFile: 'src/pages/auth/Signup.tsx',
    title: 'Signup',
    entity: null,
    expected: {},
    status: 'production',
  },
  {
    route: '/onboarding',
    pageFile: 'src/pages/Onboarding.tsx',
    title: 'Onboarding',
    entity: null,
    expected: {},
    status: 'production',
  },

  // ── Portfolio / dashboard ────────────────────────────────
  {
    route: '/portfolio',
    pageFile: 'src/pages/Portfolio.tsx',
    title: 'Portfolio',
    entity: 'project',
    expected: { has_list: true, has_search: true, has_filters: true },
    permissionModule: 'portfolio',
    status: 'production',
  },
  {
    route: '/',
    pageFile: 'src/pages/dashboard/index.tsx',
    title: 'Dashboard (root)',
    entity: null,
    expected: {},
    permissionModule: 'dashboard',
    status: 'production',
  },
  {
    route: '/dashboard',
    pageFile: 'src/pages/dashboard/index.tsx',
    title: 'Dashboard',
    entity: null,
    expected: {},
    permissionModule: 'dashboard',
    status: 'production',
  },
  {
    route: '/project-health',
    pageFile: 'src/pages/ProjectHealth.tsx',
    title: 'Project Health',
    entity: null,
    expected: { has_detail_view: true },
    permissionModule: 'project-health',
    status: 'beta',
  },

  // ── Core entities (full CRUD expected) ───────────────────
  {
    route: '/tasks',
    pageFile: 'src/pages/Tasks.tsx',
    title: 'Tasks',
    entity: 'task',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_detail_view: true,
      has_filters: true,
      has_search: true,
    },
    createModal: 'CreateTaskModal',
    hooksModule: 'src/hooks/mutations/tasks.ts',
    permissionModule: 'tasks',
    status: 'production',
  },
  {
    route: '/rfis',
    pageFile: 'src/pages/RFIs.tsx',
    title: 'RFIs',
    entity: 'rfi',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_export: true,
      has_detail_view: true,
      has_filters: true,
      has_search: true,
    },
    createModal: 'CreateRFIModal',
    hooksModule: 'src/hooks/mutations/rfis.ts',
    exportReportType: 'rfi_log',
    permissionModule: 'rfis',
    status: 'production',
  },
  {
    route: '/submittals',
    pageFile: 'src/pages/submittals/index.tsx',
    title: 'Submittals',
    entity: 'submittal',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_export: true,
      has_detail_view: true,
      has_filters: true,
      has_search: true,
    },
    createModal: 'CreateSubmittalModal',
    hooksModule: 'src/hooks/mutations/submittals.ts',
    exportReportType: 'submittal_log',
    permissionModule: 'submittals',
    status: 'production',
    knownIssues: ['Missing useDeleteSubmittal hook'],
  },
  {
    route: '/change-orders',
    pageFile: 'src/pages/ChangeOrders.tsx',
    title: 'Change Orders',
    entity: 'change-order',
    expected: {
      has_list: true,
      has_create: true,
      has_delete: true,
      has_filters: true,
      has_search: true,
    },
    createModal: 'CreateChangeOrderModal',
    hooksModule: 'src/hooks/mutations/change-orders.ts',
    permissionModule: 'change-orders',
    status: 'production',
  },
  {
    route: '/daily-log',
    pageFile: 'src/pages/daily-log/index.tsx',
    title: 'Daily Log',
    entity: 'daily-log',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_export: true,
      has_detail_view: true,
    },
    createModal: 'CreateDailyLogModal',
    hooksModule: 'src/hooks/mutations/daily-logs.ts',
    exportReportType: 'daily_log',
    permissionModule: 'daily-log',
    status: 'production',
    knownIssues: ['Missing useDeleteDailyLog hook'],
  },
  {
    route: '/punch-list',
    pageFile: 'src/pages/punch-list/index.tsx',
    title: 'Punch List',
    entity: 'punch-item',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_export: true,
      has_detail_view: true,
      has_filters: true,
    },
    createModal: 'CreatePunchItemModal',
    hooksModule: 'src/hooks/mutations/punch-items.ts',
    exportReportType: 'punch_list',
    permissionModule: 'punch-list',
    status: 'production',
    knownIssues: ['Missing useDeletePunchItem hook'],
  },
  {
    route: '/meetings',
    pageFile: 'src/pages/Meetings.tsx',
    title: 'Meetings',
    entity: 'meeting',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_detail_view: true,
    },
    createModal: 'CreateMeetingModal',
    hooksModule: 'src/hooks/mutations/meetings.ts',
    permissionModule: 'meetings',
    status: 'production',
    knownIssues: ['Missing useUpdateMeeting + useDeleteMeeting hooks'],
  },
  {
    route: '/crews',
    pageFile: 'src/pages/Crews.tsx',
    title: 'Crews',
    entity: 'crew',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_detail_view: true,
    },
    createModal: 'CreateCrewModal',
    hooksModule: 'src/hooks/mutations/crews.ts',
    permissionModule: 'crews',
    status: 'production',
    knownIssues: ['Missing useUpdateCrew + useDeleteCrew hooks'],
  },
  {
    route: '/directory',
    pageFile: 'src/pages/Directory.tsx',
    title: 'Directory',
    entity: 'contact',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_search: true,
    },
    createModal: 'AddContactModal',
    hooksModule: 'src/hooks/mutations/directory-contacts.ts',
    permissionModule: 'directory',
    status: 'production',
    knownIssues: ['Missing useUpdateDirectoryContact + useDeleteDirectoryContact hooks'],
  },

  // ── Schedule & Budget ────────────────────────────────────
  {
    route: '/schedule',
    pageFile: 'src/pages/schedule/index.tsx',
    title: 'Schedule',
    entity: 'phase',
    expected: {
      has_list: true,
      has_create: true,
      has_import: true,
      has_detail_view: true,
      has_export: true,
    },
    createModal: 'AddPhaseModal',
    exportReportType: 'schedule',
    permissionModule: 'schedule',
    status: 'production',
    knownIssues: ['Missing useUpdatePhase + useDeletePhase hooks'],
  },
  {
    route: '/lookahead',
    pageFile: 'src/pages/Lookahead.tsx',
    title: 'Lookahead',
    entity: null,
    expected: { has_list: true },
    permissionModule: 'lookahead',
    status: 'beta',
  },
  {
    route: '/budget',
    pageFile: 'src/pages/Budget.tsx',
    title: 'Budget',
    entity: 'budget-item',
    expected: {
      has_list: true,
      has_create: true,
      has_import: true,
      has_export: true,
      has_detail_view: true,
    },
    exportReportType: 'budget',
    permissionModule: 'budget',
    status: 'production',
    knownIssues: ['Create uses inline supabase.insert instead of a mutation hook'],
  },
  {
    route: '/financials',
    pageFile: 'src/pages/Financials.tsx',
    title: 'Financials',
    entity: null,
    expected: { has_list: true, has_export: true },
    permissionModule: 'financials',
    status: 'beta',
  },
  {
    route: '/cost-management',
    pageFile: 'src/pages/CostManagement.tsx',
    title: 'Cost Management',
    entity: 'cost-code',
    expected: { has_list: true, has_create: true },
    permissionModule: 'cost-management',
    status: 'beta',
  },

  // ── Drawings / Files / Field ─────────────────────────────
  {
    route: '/drawings',
    pageFile: 'src/pages/drawings/index.tsx',
    title: 'Drawings',
    entity: 'drawing',
    expected: {
      has_list: true,
      has_create: true,
      has_detail_view: true,
      has_import: true,
    },
    permissionModule: 'drawings',
    status: 'beta',
    knownIssues: ['No dedicated useCreateDrawing / useDeleteDrawing hooks — relies on upload path'],
  },
  {
    route: '/files',
    pageFile: 'src/pages/files/index.tsx',
    title: 'Files',
    entity: 'file',
    expected: {
      has_list: true,
      has_create: true,
      has_delete: true,
      has_search: true,
    },
    hooksModule: 'src/hooks/mutations/files.ts',
    permissionModule: 'files',
    status: 'production',
  },
  {
    route: '/field-capture',
    pageFile: 'src/pages/field-capture/index.tsx',
    title: 'Field Capture',
    entity: null,
    expected: { has_list: true, has_create: true },
    permissionModule: 'field-capture',
    status: 'beta',
  },

  // ── Safety / Workforce / Equipment / Procurement ─────────
  {
    route: '/safety',
    pageFile: 'src/pages/safety/index.tsx',
    title: 'Safety',
    entity: null,
    expected: { has_list: true, has_create: true, has_export: true },
    exportReportType: 'safety',
    permissionModule: 'safety',
    status: 'beta',
  },
  {
    route: '/workforce',
    pageFile: 'src/pages/Workforce.tsx',
    title: 'Workforce',
    entity: null,
    expected: { has_list: true },
    permissionModule: 'workforce',
    status: 'beta',
  },
  {
    route: '/equipment',
    pageFile: 'src/pages/Equipment.tsx',
    title: 'Equipment',
    entity: 'equipment',
    expected: { has_list: true },
    permissionModule: 'equipment',
    status: 'beta',
  },
  {
    route: '/estimating',
    pageFile: 'src/pages/Estimating.tsx',
    title: 'Estimating',
    entity: null,
    expected: { has_list: true },
    permissionModule: 'estimating',
    status: 'beta',
  },
  {
    route: '/procurement',
    pageFile: 'src/pages/Procurement.tsx',
    title: 'Procurement',
    entity: null,
    expected: { has_list: true },
    permissionModule: 'procurement',
    status: 'beta',
  },
  {
    route: '/preconstruction',
    pageFile: 'src/pages/Preconstruction.tsx',
    title: 'Preconstruction',
    entity: 'bid-package',
    expected: { has_list: true, has_create: true },
    permissionModule: 'preconstruction',
    status: 'beta',
  },
  {
    route: '/resources',
    pageFile: 'src/pages/Resources.tsx',
    title: 'Resources',
    entity: 'resource',
    expected: { has_list: true, has_import: true },
    permissionModule: 'resources',
    status: 'beta',
  },
  {
    route: '/vendors',
    pageFile: 'src/pages/Vendors.tsx',
    title: 'Vendors',
    entity: 'vendor',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_delete: true,
      has_filters: true,
      has_search: true,
    },
    hooksModule: 'src/hooks/queries/vendors.ts',
    permissionModule: 'vendors',
    status: 'production',
  },

  // ── Contracts / Permits / Transmittals / Closeout ────────
  {
    route: '/permits',
    pageFile: 'src/pages/Permits.tsx',
    title: 'Permits',
    entity: 'permit',
    expected: { has_list: true, has_create: true, has_edit: true },
    permissionModule: 'permits',
    status: 'stub',
    knownIssues: ['Zero mutation hooks for permits — page is a list-only stub'],
  },
  {
    route: '/contracts',
    pageFile: 'src/pages/Contracts.tsx',
    title: 'Contracts',
    entity: 'contract',
    expected: { has_list: true, has_create: true, has_edit: true },
    permissionModule: 'contracts',
    status: 'stub',
    knownIssues: ['Create exists but no Update/Delete/Detail — skeleton only'],
  },
  {
    route: '/transmittals',
    pageFile: 'src/pages/Transmittals.tsx',
    title: 'Transmittals',
    entity: 'transmittal',
    expected: { has_list: true, has_create: true },
    permissionModule: 'transmittals',
    status: 'beta',
  },
  {
    route: '/closeout',
    pageFile: 'src/pages/Closeout.tsx',
    title: 'Closeout',
    entity: 'closeout-item',
    expected: { has_list: true, has_create: true },
    permissionModule: 'closeout',
    status: 'beta',
  },
  {
    route: '/specifications',
    pageFile: 'src/pages/Specifications.tsx',
    title: 'Specifications',
    entity: 'specification',
    expected: { has_list: true },
    permissionModule: 'specifications',
    status: 'beta',
  },

  // ── Financial ops / Reports ──────────────────────────────
  {
    route: '/pay-apps',
    pageFile: 'src/pages/payment-applications/index.tsx',
    title: 'Pay Applications',
    entity: 'pay-app',
    expected: {
      has_list: true,
      has_create: true,
      has_edit: true,
      has_detail_view: true,
      has_export: true,
    },
    permissionModule: 'pay-apps',
    status: 'stub',
    knownIssues: ['Zero mutation hooks for pay-apps despite full UI shell'],
  },
  {
    route: '/payment-applications',
    pageFile: 'src/pages/payment-applications/index.tsx',
    title: 'Payment Applications (alias)',
    entity: 'pay-app',
    expected: {},
    status: 'production',
    knownIssues: ['Alias route for /pay-apps — same page'],
  },
  {
    route: '/lien-waivers',
    pageFile: 'src/pages/LienWaivers.tsx',
    title: 'Lien Waivers',
    entity: 'lien-waiver',
    expected: { has_list: true },
    permissionModule: 'lien-waivers',
    status: 'beta',
  },
  {
    route: '/reports',
    pageFile: 'src/pages/Reports.tsx',
    title: 'Reports',
    entity: null,
    expected: { has_list: true, has_export: true },
    permissionModule: 'reports',
    status: 'production',
  },
  {
    route: '/reports/owner',
    pageFile: 'src/pages/OwnerReportPage.tsx',
    title: 'Owner Report',
    entity: null,
    expected: { has_export: true },
    permissionModule: 'reports',
    status: 'beta',
  },
  {
    route: '/portal/owner',
    pageFile: 'src/pages/OwnerPortal.tsx',
    title: 'Owner Portal',
    entity: null,
    expected: {},
    status: 'beta',
  },

  // ── AI / Intelligence / Activity ─────────────────────────
  {
    route: '/copilot',
    pageFile: 'src/pages/AICopilot.tsx',
    title: 'AI Copilot',
    entity: null,
    expected: {},
    permissionModule: 'copilot',
    status: 'beta',
  },
  {
    route: '/ai-agents',
    pageFile: 'src/pages/AIAgents.tsx',
    title: 'AI Agents',
    entity: null,
    expected: { has_list: true },
    permissionModule: 'ai-agents',
    status: 'beta',
  },
  {
    route: '/activity',
    pageFile: 'src/pages/Activity.tsx',
    title: 'Activity Feed',
    entity: null,
    expected: { has_list: true, has_filters: true },
    permissionModule: 'activity',
    status: 'production',
  },
  {
    route: '/audit-trail',
    pageFile: 'src/pages/AuditTrail.tsx',
    title: 'Audit Trail',
    entity: null,
    expected: { has_list: true, has_filters: true, has_export: true },
    permissionModule: 'audit-trail',
    status: 'production',
  },
  {
    route: '/integrations',
    pageFile: 'src/pages/Integrations.tsx',
    title: 'Integrations',
    entity: null,
    expected: { has_list: true },
    permissionModule: 'integrations',
    status: 'beta',
  },

  // ── Enterprise add-ons ───────────────────────────────────
  {
    route: '/time-tracking',
    pageFile: 'src/pages/TimeTracking.tsx',
    title: 'Time Tracking',
    entity: 'time-entry',
    expected: { has_list: true, has_create: true },
    permissionModule: 'time-tracking',
    status: 'beta',
  },
  {
    route: '/deliveries',
    pageFile: 'src/pages/Deliveries.tsx',
    title: 'Deliveries',
    entity: 'delivery',
    expected: { has_list: true, has_create: true },
    permissionModule: 'deliveries',
    status: 'beta',
  },
  {
    route: '/wiki',
    pageFile: 'src/pages/Wiki.tsx',
    title: 'Wiki',
    entity: 'wiki-page',
    expected: { has_list: true, has_create: true },
    permissionModule: 'wiki',
    status: 'beta',
  },
  {
    route: '/site-map',
    pageFile: 'src/pages/SiteMap.tsx',
    title: 'Site Map',
    entity: null,
    expected: {},
    permissionModule: 'site-map',
    status: 'beta',
  },
  {
    route: '/carbon',
    pageFile: 'src/pages/CarbonDashboard.tsx',
    title: 'Carbon Dashboard',
    entity: null,
    expected: {},
    permissionModule: 'carbon',
    status: 'beta',
  },
  {
    route: '/settings/workflows',
    pageFile: 'src/pages/Settings/WorkflowSettings.tsx',
    title: 'Workflow Settings',
    entity: null,
    expected: {},
    permissionModule: 'settings',
    status: 'beta',
  },

  // ── Catch-all ────────────────────────────────────────────
  {
    route: '*',
    pageFile: 'src/pages/errors/NotFound.tsx',
    title: 'Not Found',
    entity: null,
    expected: {},
    status: 'production',
  },
]

/** Entity→hook mapping the static audit uses to check mutation presence. */
export const ENTITY_MUTATIONS: Record<
  EntityKind,
  { create?: string; update?: string; delete?: string; module?: string }
> = {
  rfi: { create: 'useCreateRFI', update: 'useUpdateRFI', delete: 'useDeleteRFI', module: 'src/hooks/mutations/rfis.ts' },
  submittal: { create: 'useCreateSubmittal', update: 'useUpdateSubmittal', delete: 'useDeleteSubmittal', module: 'src/hooks/mutations/submittals.ts' },
  task: { create: 'useCreateTask', update: 'useUpdateTask', delete: 'useDeleteTask', module: 'src/hooks/mutations/tasks.ts' },
  'change-order': { create: 'useCreateChangeOrder', update: 'useUpdateChangeOrder', delete: 'useDeleteChangeOrder', module: 'src/hooks/mutations/change-orders.ts' },
  'daily-log': { create: 'useCreateDailyLog', update: 'useUpdateDailyLog', delete: 'useDeleteDailyLog', module: 'src/hooks/mutations/daily-logs.ts' },
  meeting: { create: 'useCreateMeeting', update: 'useUpdateMeeting', delete: 'useDeleteMeeting', module: 'src/hooks/mutations/meetings.ts' },
  crew: { create: 'useCreateCrew', update: 'useUpdateCrew', delete: 'useDeleteCrew', module: 'src/hooks/mutations/crews.ts' },
  contact: { create: 'useCreateDirectoryContact', update: 'useUpdateDirectoryContact', delete: 'useDeleteDirectoryContact', module: 'src/hooks/mutations/directory-contacts.ts' },
  project: { update: 'useUpdateProject', delete: 'useDeleteProject', module: 'src/hooks/mutations/projects.ts' },
  'punch-item': { create: 'useCreatePunchItem', update: 'useUpdatePunchItem', delete: 'useDeletePunchItem', module: 'src/hooks/mutations/punch-items.ts' },
  'budget-item': { create: 'useCreateBudgetItem', delete: 'useDeleteBudgetItem', module: 'src/hooks/mutations/budget.ts' },
  phase: {}, // Phase CRUD is currently inline in src/pages/schedule/index.tsx
  file: { create: 'useCreateFile', delete: 'useDeleteFile', module: 'src/hooks/mutations/files.ts' },
  drawing: {},
  'pay-app': {},
  permit: {},
  contract: { create: 'useCreateContract' },
  vendor: { create: 'useCreateVendor', update: 'useUpdateVendor', delete: 'useDeleteVendor', module: 'src/hooks/queries/vendors.ts' },
  transmittal: { create: 'useCreateTransmittal' },
  'lien-waiver': {},
  equipment: {},
  'bid-package': { create: 'useCreatePreconBidPackage' },
  'closeout-item': { create: 'useCreateCloseoutItem' },
  specification: { create: 'useCreateSpecification' },
  resource: {},
  'cost-code': { create: 'useCreateCostCode' },
  'time-entry': { create: 'useCreateTimeEntry' },
  delivery: { create: 'useCreateDelivery' },
  'wiki-page': { create: 'useCreateWikiPage' },
  'tool-talk': {},
  'pre-task-plan': { create: 'useCreatePreTaskPlan' },
  certification: {},
}
