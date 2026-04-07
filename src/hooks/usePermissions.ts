import { useQuery, useQueryClient } from '@tanstack/react-query'
import { colors } from '../styles/theme'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useProjectId } from './useProjectId'
import { useAuth } from './useAuth'

// ── Types ────────────────────────────────────────────────

export type ProjectRole = 'owner' | 'admin' | 'project_manager' | 'superintendent' | 'subcontractor' | 'viewer'

export type Permission =
  | 'dashboard.view' | 'tasks.view' | 'tasks.create' | 'tasks.edit' | 'tasks.delete' | 'tasks.assign'
  | 'rfis.view' | 'rfis.create' | 'rfis.edit' | 'rfis.respond' | 'rfis.delete' | 'rfis.void'
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
  | 'project.settings' | 'project.members' | 'project.delete'
  | 'org.settings' | 'org.billing' | 'org.members'
  | 'ai.use' | 'export.data' | 'reports.view'
  | 'financials.view' | 'financials.edit' | 'estimating.view' | 'procurement.view'

// ── Role Hierarchy ───────────────────────────────────────

export const ROLE_LEVELS: Record<ProjectRole, number> = {
  owner: 6,
  admin: 5,
  project_manager: 4,
  superintendent: 3,
  subcontractor: 2,
  viewer: 1,
}

// Alias required by auth spec
export const ROLE_HIERARCHY = ROLE_LEVELS

// ── Permission Matrix ────────────────────────────────────

export const PERMISSION_MATRIX: Record<Permission, ProjectRole[]> = {
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
  'estimating.view': ['owner', 'admin', 'project_manager'],
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
  'org.settings': ['owner'],
  'org.billing': ['owner'],
  'org.members': ['owner', 'admin'],
  'ai.use': ['owner', 'admin', 'project_manager', 'superintendent'],
  'export.data': ['owner', 'admin', 'project_manager'],
  'reports.view': ['owner', 'admin', 'project_manager'],
}

// ── Module Visibility ────────────────────────────────────

export const MODULE_PERMISSIONS: Record<string, Permission> = {
  dashboard: 'dashboard.view',
  'project-health': 'dashboard.view',
  copilot: 'ai.use',
  'ai-agents': 'ai.use',
  'time-machine': 'dashboard.view',
  lookahead: 'schedule.view',
  tasks: 'tasks.view',
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
}

// ── Dev Mode Detection ───────────────────────────────────

// BUG #1 FIX: Dev bypass requires EXPLICIT opt-in, uses viewer (not owner), and NEVER activates in production.
// Vite replaces import.meta.env.DEV with `false` in production builds, making this block dead code in prod.
function isDevBypassActive(): boolean {
  if (!import.meta.env.DEV) return false // Production: NEVER bypass
  if (import.meta.env.VITE_SUPABASE_URL) return false // Has real Supabase: no bypass needed
  if (import.meta.env.VITE_DEV_BYPASS !== 'true') return false // Must explicitly opt in
  return true
}

const DEV_BYPASS_ROLE: ProjectRole = 'viewer' // Never grant elevated access in dev mode

// ── Hook ─────────────────────────────────────────────────

export interface PermissionsResult {
  role: ProjectRole | null
  loading: boolean
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  isAtLeast: (minimumRole: ProjectRole) => boolean
  canAccessModule: (moduleId: string) => boolean
}

export function usePermissions(): PermissionsResult {
  const projectId = useProjectId()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // BUG #3 FIX: Reduce staleTime from 5 minutes to 30 seconds
  const { data: membership, isLoading } = useQuery({
    queryKey: ['project_membership', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user?.id) return null
      const { data, error } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()
      if (error) return null
      return data?.role as ProjectRole || null
    },
    enabled: !!projectId && !!user?.id,
    staleTime: 30_000, // 30 seconds (was 5 minutes)
    refetchOnWindowFocus: true,
  })

  // BUG #3 FIX: Realtime subscription to instantly invalidate permissions on role change
  useEffect(() => {
    if (!projectId || !user?.id) return

    const channel = supabase
      .channel(`permissions:${projectId}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // If this user's role changed, or they were removed, invalidate immediately
          const row = (payload.new as Record<string, unknown>) ?? (payload.old as Record<string, unknown>)
          if (row?.user_id === user.id || payload.eventType === 'DELETE') {
            queryClient.invalidateQueries({ queryKey: ['project_membership', projectId, user.id] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, user?.id, queryClient])

  const role: ProjectRole = membership ?? 'viewer'

  // BUG #1 FIX: Dev bypass only with explicit opt-in, viewer role, and loud warning
  if (isDevBypassActive()) {
    if (typeof console !== 'undefined') {
      console.warn(
        '%c⚠️ PERMISSION BYPASS ACTIVE ⚠️\n' +
        'All permissions granted as VIEWER role.\n' +
        'Set VITE_SUPABASE_URL to connect to a real backend.\n' +
        'Set VITE_DEV_BYPASS=true in .env to enable this bypass explicitly.',
        `color: ${colors.statusWarning}; font-size: 14px; font-weight: bold;`
      )
    }
    return {
      role: DEV_BYPASS_ROLE,
      loading: false,
      hasPermission: (permission) => {
        const allowed = PERMISSION_MATRIX[permission]
        return allowed ? allowed.includes(DEV_BYPASS_ROLE) : false
      },
      hasAnyPermission: (permissions) =>
        permissions.some((p) => {
          const allowed = PERMISSION_MATRIX[p]
          return allowed ? allowed.includes(DEV_BYPASS_ROLE) : false
        }),
      isAtLeast: (minimumRole) => ROLE_LEVELS[DEV_BYPASS_ROLE] >= ROLE_LEVELS[minimumRole],
      canAccessModule: (moduleId) => {
        const permission = MODULE_PERMISSIONS[moduleId]
        if (!permission) return true
        const allowed = PERMISSION_MATRIX[permission]
        return allowed ? allowed.includes(DEV_BYPASS_ROLE) : false
      },
    }
  }

  const hasPermission = (permission: Permission): boolean => {
    if (!role) return false
    const allowedRoles = PERMISSION_MATRIX[permission]
    return allowedRoles ? allowedRoles.includes(role) : false
  }

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some((p) => hasPermission(p))
  }

  const isAtLeast = (minimumRole: ProjectRole): boolean => {
    if (!role) return false
    return ROLE_LEVELS[role] >= ROLE_LEVELS[minimumRole]
  }

  const canAccessModule = (moduleId: string): boolean => {
    const permission = MODULE_PERMISSIONS[moduleId]
    if (!permission) return true
    return hasPermission(permission)
  }

  return { role, loading: isLoading, hasPermission, hasAnyPermission, isAtLeast, canAccessModule }
}

// ── Permission Error ─────────────────────────────────────

export class PermissionError extends Error {
  constructor(message: string, public permission?: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

// ── Exported for tests ───────────────────────────────────

export { isDevBypassActive, DEV_BYPASS_ROLE }
