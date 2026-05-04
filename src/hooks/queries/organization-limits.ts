import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Organization Limits ─────────────────────────────────

export interface OrganizationLimits {
  max_projects: number
  max_files_per_project: number
  max_users: number
  max_storage_gb: number
  is_blocked: boolean
  blocked_reason: string | null
  blocked_at: string | null
}

export function useOrganizationLimits(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization_limits', orgId],
    queryFn: async (): Promise<OrganizationLimits> => {
      const { data, error } = await from('organization_settings')
        .select('max_projects, max_files_per_project, max_users, max_storage_gb, is_blocked, blocked_reason, blocked_at')
        .eq('organization_id' as never, orgId!)
        .single()
      if (error) throw error
      return data as unknown as OrganizationLimits
    },
    enabled: !!orgId,
  })
}

export type LimitType = 'projects' | 'files' | 'users'

export function useCheckLimit(orgId: string | undefined, limitType: LimitType) {
  return useQuery({
    queryKey: ['organization_limit_check', orgId, limitType],
    queryFn: async (): Promise<{ current: number; max: number; reached: boolean }> => {
      // Fetch the org limits
      const { data: settings, error: settingsError } = await from('organization_settings')
        .select('max_projects, max_files_per_project, max_users')
        .eq('organization_id' as never, orgId!)
        .single()
      if (settingsError) throw settingsError

      const limits = settings as unknown as Pick<OrganizationLimits, 'max_projects' | 'max_files_per_project' | 'max_users'>
      let current = 0
      let max = 0

      switch (limitType) {
        case 'projects': {
          const { count, error } = await from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id' as never, orgId!)
          if (error) throw error
          current = count ?? 0
          max = limits.max_projects ?? 50
          break
        }
        case 'files': {
          // Count files across all projects in the org
          const { data: projects, error: projError } = await from('projects')
            .select('id')
            .eq('organization_id' as never, orgId!)
          if (projError) throw projError
          const projectIds = (projects ?? []).map((p: Record<string, unknown>) => p.id as string)
          if (projectIds.length > 0) {
            const { count, error } = await from('files')
              .select('id', { count: 'exact', head: true })
              .in('project_id' as never, projectIds)
            if (error) throw error
            current = count ?? 0
          }
          max = limits.max_files_per_project ?? 500
          break
        }
        case 'users': {
          const { count, error } = await from('organization_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id' as never, orgId!)
          if (error) throw error
          current = count ?? 0
          max = limits.max_users ?? 100
          break
        }
      }

      return { current, max, reached: current >= max }
    },
    enabled: !!orgId,
  })
}
