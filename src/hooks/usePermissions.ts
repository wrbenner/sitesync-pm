import { useQuery, useQueryClient } from '@tanstack/react-query'
import { colors } from '../styles/theme'
import { useEffect, useId } from 'react'
import { supabase } from '../lib/supabase'
import { fromTable, asRow } from '../lib/db/queries'
import { useProjectId } from './useProjectId'
import { useAuth } from './useAuth'
import { isDevBypassActive } from '../lib/devBypass'
import {
  PERMISSION_MATRIX,
  MODULE_PERMISSIONS,
  ROLE_HIERARCHY,
  ROLE_LEVELS,
  DEV_BYPASS_ROLE,
  can,
  canAny,
  isAtLeast as isAtLeastFn,
  canAccessModule as canAccessModuleFn,
  type Permission,
  type Role,
} from '../permissions'

// ── Types ────────────────────────────────────────────────
//
// ProjectRole is the canonical 15-value role type. It now lives in
// src/permissions.ts as `Role`; we re-export under the historical name so
// the 545 PermissionGate sites and 29 hook consumers don't need to change.

export type { ProjectRole } from '../types/database'
import type { ProjectRole } from '../types/database'

// Re-exports for backwards compatibility. New code should import from
// `@/permissions` directly.
export {
  PERMISSION_MATRIX,
  MODULE_PERMISSIONS,
  ROLE_HIERARCHY,
  ROLE_LEVELS,
  DEV_BYPASS_ROLE,
  isDevBypassActive,
}
export type { Permission, Role }

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
  // Unique per hook instance — every consumer (PermissionGate, every audited
  // mutation hook, every page) calls usePermissions, and supabase.channel(name)
  // returns the EXISTING channel for a duplicate name. Calling .on() on an
  // already-subscribed channel throws and crashes every page on mount.
  const instanceId = useId()

  // BUG #3 FIX: Reduce staleTime from 5 minutes to 30 seconds
  // BUG #4 FIX: Also check projects.owner_id as fallback — if the user is the
  // project owner but has no project_members row (e.g. RLS blocked the auto-insert),
  // grant them 'owner' role so they aren't stuck as a viewer.
  const { data: membership, isLoading } = useQuery({
    queryKey: ['project_membership', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user?.id) return null

      // 1. Try project_members first (normal path)
      const { data, error } = await fromTable('project_members')
        .select('role')
        .eq('project_id' as never, projectId)
        .eq('user_id' as never, user.id)
        .maybeSingle()
      const member = asRow<{ role: string | null }>(data)
      if (!error && member?.role) return member.role as ProjectRole

      // 2. Fallback: check if user is the project owner
      const { data: projData } = await fromTable('projects')
        .select('owner_id')
        .eq('id' as never, projectId)
        .maybeSingle()
      const proj = asRow<{ owner_id: string | null }>(projData)
      if (proj?.owner_id === user.id) {
        // Auto-insert membership row for the owner (best-effort, may fail due to RLS)
        await fromTable('project_members').upsert({
          project_id: projectId,
          user_id: user.id,
          role: 'owner',
          accepted_at: new Date().toISOString(),
        } as never, { onConflict: 'project_id,user_id' }).select().maybeSingle()
        return 'owner' as ProjectRole
      }

      // 3. Fallback: check if user created the project (created_by field)
      const { data: projCreatorData } = await fromTable('projects')
        .select('created_by')
        .eq('id' as never, projectId)
        .maybeSingle()
      const projCreator = asRow<{ created_by: string | null }>(projCreatorData)
      if (projCreator?.created_by === user.id) {
        await fromTable('project_members').upsert({
          project_id: projectId,
          user_id: user.id,
          role: 'project_manager',
          accepted_at: new Date().toISOString(),
        } as never, { onConflict: 'project_id,user_id' }).select().maybeSingle()
        return 'project_manager' as ProjectRole
      }

      return null
    },
    enabled: !!projectId && !!user?.id,
    staleTime: 30_000, // 30 seconds (was 5 minutes)
    refetchOnWindowFocus: true,
  })

  // BUG #3 FIX: Realtime subscription to instantly invalidate permissions on role change
  // FIX: Use a unique suffix per effect invocation to avoid Supabase's "cannot add
  // callbacks after subscribe" error in React 19 StrictMode (effects run twice and
  // supabase.channel(sameName) returns the already-subscribed channel).
  useEffect(() => {
    if (!projectId || !user?.id) return

    const suffix = crypto.randomUUID().slice(0, 6)
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(`permissions:${projectId}:${user.id}:${instanceId}:${suffix}`)
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
            const row = (payload.new as unknown as Record<string, unknown>) ?? (payload.old as unknown as Record<string, unknown>)
            if (row?.user_id === user.id || payload.eventType === 'DELETE') {
              queryClient.invalidateQueries({ queryKey: ['project_membership', projectId, user.id] })
            }
          }
        )
        .subscribe()
    } catch {
      // Swallow channel subscription errors — they're non-critical and can occur
      // during React StrictMode double-invocation or hot module reloads.
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [projectId, user?.id, queryClient, instanceId])

  const role: ProjectRole = membership ?? 'viewer'

  // BUG #1 FIX: Dev bypass only with explicit opt-in, viewer role, and loud warning
  if (isDevBypassActive()) {
    if (typeof console !== 'undefined') {
      console.warn(
        '%c⚠️ PERMISSION BYPASS ACTIVE ⚠️\n' +
        'Permissions granted as VIEWER role (read-only).\n' +
        'Set VITE_SUPABASE_URL to connect to a real backend.\n' +
        'Set VITE_DEV_BYPASS=true in .env to enable this bypass explicitly.',
        `color: ${colors.statusWarning}; font-size: 14px; font-weight: bold;`
      )
    }
    return {
      role: DEV_BYPASS_ROLE,
      loading: false,
      hasPermission: (permission) => can(DEV_BYPASS_ROLE, permission),
      hasAnyPermission: (permissions) => canAny(DEV_BYPASS_ROLE, permissions),
      isAtLeast: (minimumRole) => isAtLeastFn(DEV_BYPASS_ROLE, minimumRole),
      canAccessModule: (moduleId) => canAccessModuleFn(DEV_BYPASS_ROLE, moduleId),
    }
  }

  return {
    role,
    loading: isLoading,
    hasPermission: (permission) => can(role, permission),
    hasAnyPermission: (permissions) => canAny(role, permissions),
    isAtLeast: (minimumRole) => isAtLeastFn(role, minimumRole),
    canAccessModule: (moduleId) => canAccessModuleFn(role, moduleId),
  }
}

// ── Permission Error ─────────────────────────────────────

export class PermissionError extends Error {
  permission?: string
  constructor(message: string, permission?: string) {
    super(message)
    this.name = 'PermissionError'
    this.permission = permission
  }
}
