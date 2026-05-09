// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for role + permission logic.
//
// Imports from this file only. No React, no hooks, no browser-only APIs —
// safe to import from edge functions, scripts, tests. The Deno-compatible
// mirror at supabase/functions/_shared/permissions.ts is generated from this
// file by scripts/generate-permissions-sql.mjs (PR 2).
//
// When you add a new role: add it to ROLES, ROLE_HIERARCHY, and any rows in
// PERMISSION_MATRIX it should be granted on. The DB CHECK constraint and
// has_project_permission() hierarchy are regenerated from here in CI.
//
// When you add a new permission: add the literal to the Permission union AND
// to PERMISSION_MATRIX. TypeScript will fail the build if either side drifts.
// ─────────────────────────────────────────────────────────────────────────────

// ── Roles ────────────────────────────────────────────────────────────────────

export const ROLES = [
  'owner',
  'project_executive',
  'admin',
  'project_manager',
  'superintendent',
  'foreman',
  'project_engineer',
  'field_engineer',
  'safety_manager',
  'subcontractor',
  'architect',
  'owner_rep',
  'member',
  'field_user',
  'viewer',
] as const

export type Role = typeof ROLES[number]

// Numeric hierarchy. Higher = more permissive. Used for `isAtLeast()` and
// mirrored in the SQL `has_project_permission()` function in PR 2.
export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 7,
  project_executive: 7,
  admin: 6,
  project_manager: 5,
  superintendent: 4,
  foreman: 3,
  project_engineer: 3,
  field_engineer: 3,
  safety_manager: 3,
  subcontractor: 2,
  architect: 2,
  owner_rep: 2,
  member: 2,
  field_user: 2,
  viewer: 1,
}

// Alias kept for callers that read the literal name `ROLE_LEVELS`.
export const ROLE_LEVELS = ROLE_HIERARCHY

// Dev bypass defaults to viewer, not admin. Tests ("Bug #1 Fix") enforce this
// so that a build accidentally deployed with VITE_DEV_BYPASS=true cannot
// escalate an anonymous session to admin/create/approve capabilities.
export const DEV_BYPASS_ROLE: Role = 'viewer'

// ── Permissions ──────────────────────────────────────────────────────────────

export type Permission =
  | 'dashboard.view'
  | 'tasks.view' | 'tasks.create' | 'tasks.edit' | 'tasks.delete' | 'tasks.assign'
  | 'rfis.view' | 'rfis.create' | 'rfis.edit' | 'rfis.respond' | 'rfis.delete' | 'rfis.void' | 'rfis.admin_edit' | 'rfis.flip_official'
  | 'submittals.view' | 'submittals.create' | 'submittals.edit' | 'submittals.approve' | 'submittals.delete'
  | 'budget.view' | 'budget.edit' | 'budget.approve'
  | 'change_orders.view' | 'change_orders.create' | 'change_orders.edit' | 'change_orders.approve' | 'change_orders.delete' | 'change_orders.promote'
  | 'schedule.view' | 'schedule.edit'
  | 'daily_log.view' | 'daily_log.create' | 'daily_log.edit' | 'daily_log.submit' | 'daily_log.approve' | 'daily_log.reject'
  | 'punch_list.view' | 'punch_list.create' | 'punch_list.edit' | 'punch_list.delete' | 'punch_list.verify'
  | 'drawings.view' | 'drawings.upload' | 'drawings.markup' | 'drawings.delete'
  | 'files.view' | 'files.upload' | 'files.download' | 'files.delete'
  | 'crews.view' | 'crews.manage'
  | 'safety.view' | 'safety.manage'
  | 'directory.view' | 'directory.manage'
  | 'meetings.view' | 'meetings.create' | 'meetings.delete'
  | 'field_capture.view' | 'field_capture.create'
  | 'project.settings' | 'project.members' | 'project.delete' | 'project.owner_view'
  | 'org.settings' | 'org.billing' | 'org.members'
  | 'ai.use'
  | 'export.data'
  | 'reports.view'
  | 'financials.view' | 'financials.edit' | 'financials.release_retainage' | 'financials.bypass_period_lock'
  | 'estimating.view' | 'estimating.manage'
  | 'procurement.view'

// Each row lists every role that can perform the action. Lookup is
// PERMISSION_MATRIX[action].includes(role); see can() below.
export const PERMISSION_MATRIX: Record<Permission, readonly Role[]> = {
  'dashboard.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'tasks.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'tasks.create': ['owner', 'admin', 'project_manager', 'superintendent'],
  'tasks.edit': ['owner', 'admin', 'project_manager', 'superintendent'],
  'tasks.delete': ['owner', 'admin', 'project_manager'],
  'tasks.assign': ['owner', 'admin', 'project_manager', 'superintendent'],
  'rfis.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'rfis.create': ['owner', 'admin', 'project_manager', 'superintendent'],
  'rfis.edit': ['owner', 'admin', 'project_manager'],
  'rfis.respond': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor'],
  'rfis.delete': ['owner', 'admin', 'project_manager'],
  'rfis.void': ['owner', 'admin'],
  'rfis.admin_edit': ['owner', 'admin', 'project_manager'],
  // New: admins can flip official status; "member" exists as a legacy non-viewer
  // baseline carried forward from the response thread's pre-matrix logic.
  'rfis.flip_official': ['owner', 'admin', 'member'],
  'submittals.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'submittals.create': ['owner', 'admin', 'project_manager', 'subcontractor'],
  'submittals.edit': ['owner', 'admin', 'project_manager'],
  'submittals.approve': ['owner', 'admin', 'project_manager'],
  'submittals.delete': ['owner', 'admin', 'project_manager'],
  'budget.view': ['owner', 'admin', 'project_manager', 'superintendent'],
  'budget.edit': ['owner', 'admin', 'project_manager'],
  'budget.approve': ['owner', 'admin'],
  'change_orders.view': ['owner', 'admin', 'project_manager', 'superintendent'],
  'change_orders.create': ['owner', 'admin', 'project_manager'],
  'change_orders.edit': ['owner', 'admin', 'project_manager'],
  'change_orders.approve': ['owner', 'admin'],
  'change_orders.delete': ['owner', 'admin'],
  'change_orders.promote': ['owner', 'admin', 'project_manager'],
  'financials.view': ['owner', 'admin', 'project_manager'],
  'financials.edit': ['owner', 'admin', 'project_manager'],
  // New: retainage release was previously gated by an ad-hoc role check in
  // payment-applications/index.tsx. Same allowed set as financials.edit but
  // distinct so the audit can be tightened later without affecting other writes.
  'financials.release_retainage': ['owner', 'admin', 'project_manager'],
  // New: bypass period close lock — admin/owner only.
  'financials.bypass_period_lock': ['owner', 'admin'],
  'estimating.view': ['owner', 'admin', 'project_manager'],
  'estimating.manage': ['owner', 'admin', 'project_manager'],
  'procurement.view': ['owner', 'admin', 'project_manager', 'superintendent'],
  'schedule.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'schedule.edit': ['owner', 'admin', 'project_manager'],
  'daily_log.view': ['owner', 'admin', 'project_manager', 'superintendent', 'viewer'],
  'daily_log.create': ['owner', 'admin', 'project_manager', 'superintendent'],
  'daily_log.edit': ['owner', 'admin', 'project_manager', 'superintendent'],
  'daily_log.submit': ['owner', 'admin', 'project_manager', 'superintendent'],
  'daily_log.approve': ['owner', 'admin', 'project_manager'],
  'daily_log.reject': ['owner', 'admin', 'project_manager'],
  'punch_list.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'punch_list.create': ['owner', 'admin', 'project_manager', 'superintendent'],
  'punch_list.edit': ['owner', 'admin', 'project_manager', 'superintendent'],
  'punch_list.delete': ['owner', 'admin', 'project_manager'],
  'punch_list.verify': ['owner', 'admin', 'project_manager'],
  'drawings.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'drawings.upload': ['owner', 'admin', 'project_manager'],
  'drawings.markup': ['owner', 'admin', 'project_manager', 'superintendent'],
  'drawings.delete': ['owner', 'admin'],
  'files.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'files.upload': ['owner', 'admin', 'project_manager', 'superintendent'],
  'files.download': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'files.delete': ['owner', 'admin', 'project_manager'],
  'field_capture.view': ['owner', 'admin', 'project_manager', 'superintendent', 'viewer'],
  'field_capture.create': ['owner', 'admin', 'project_manager', 'superintendent'],
  'crews.view': ['owner', 'admin', 'project_manager', 'superintendent', 'viewer'],
  'crews.manage': ['owner', 'admin', 'project_manager'],
  'safety.view': ['owner', 'admin', 'project_manager', 'superintendent', 'viewer'],
  'safety.manage': ['owner', 'admin', 'project_manager', 'superintendent'],
  'directory.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'directory.manage': ['owner', 'admin', 'project_manager'],
  'meetings.view': ['owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'],
  'meetings.create': ['owner', 'admin', 'project_manager'],
  'meetings.delete': ['owner', 'admin'],
  'project.settings': ['owner', 'admin'],
  'project.members': ['owner', 'admin'],
  'project.delete': ['owner'],
  // New: literal owner-only view (Owner Portal). project.settings already
  // covers admin so we need a dedicated key for owner-only surfaces.
  'project.owner_view': ['owner'],
  'org.settings': ['owner'],
  'org.billing': ['owner'],
  'org.members': ['owner', 'admin'],
  'ai.use': ['owner', 'admin', 'project_manager', 'superintendent'],
  'export.data': ['owner', 'admin', 'project_manager'],
  'reports.view': ['owner', 'admin', 'project_manager'],
}

// Module-id → required permission. Used by ProtectedRoute / canAccessModule.
export const MODULE_PERMISSIONS: Record<string, Permission> = {
  dashboard: 'dashboard.view',
  'project-health': 'dashboard.view',
  // The Nine — every authenticated user with dashboard access can reach
  // the question-shaped destinations. Sub-permissions still gate writes
  // inside each page (e.g. creating an RFI from /conversation needs rfis.create).
  day: 'dashboard.view',
  field: 'dashboard.view',
  conversation: 'rfis.view',
  plan: 'schedule.view',
  ledger: 'budget.view',
  crew: 'crews.view',
  set: 'drawings.view',
  file: 'files.view',
  site: 'dashboard.view',
  ai: 'ai.use',
  copilot: 'ai.use',
  'ai-agents': 'ai.use',
  'time-machine': 'dashboard.view',
  lookahead: 'schedule.view',
  tasks: 'tasks.view',
  commitments: 'tasks.view',
  schedule: 'schedule.view',
  budget: 'budget.view',
  'pay-apps': 'budget.view',
  'change-orders': 'change_orders.view',
  financials: 'financials.view',
  drawings: 'drawings.view',
  rfis: 'rfis.view',
  submittals: 'submittals.view',
  estimating: 'estimating.view',
  procurement: 'procurement.view',
  equipment: 'procurement.view',
  permits: 'project.settings',
  'field-capture': 'field_capture.view',
  'daily-log': 'daily_log.view',
  'punch-list': 'punch_list.view',
  crews: 'crews.view',
  workforce: 'crews.view',
  safety: 'safety.view',
  insurance: 'financials.view',
  activity: 'dashboard.view',
  meetings: 'meetings.view',
  directory: 'directory.view',
  files: 'files.view',
  'audit-trail': 'project.settings',
  integrations: 'project.settings',
  reports: 'reports.view',
  sustainability: 'reports.view',
  warranties: 'reports.view',
  portfolio: 'dashboard.view',
  'cost-management': 'budget.view',
  'time-tracking': 'crews.view',
  deliveries: 'procurement.view',
  wiki: 'files.view',
}

// ── Pure helper functions ────────────────────────────────────────────────────

export function can(role: Role | null | undefined, action: Permission): boolean {
  if (!role) return false
  const allowed = PERMISSION_MATRIX[action]
  return allowed ? allowed.includes(role) : false
}

export function canAny(role: Role | null | undefined, actions: Permission[]): boolean {
  return actions.some((a) => can(role, a))
}

export function isAtLeast(role: Role | null | undefined, minRole: Role): boolean {
  if (!role) return false
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]
}

export function getAllowedActions(role: Role | null | undefined): Permission[] {
  if (!role) return []
  return (Object.keys(PERMISSION_MATRIX) as Permission[]).filter((a) => can(role, a))
}

export function canAccessModule(role: Role | null | undefined, moduleId: string): boolean {
  const permission = MODULE_PERMISSIONS[moduleId]
  if (!permission) return true
  return can(role, permission)
}
