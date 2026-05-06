// ── useProjectDirectory ──────────────────────────────────────────────────
// Builds the directory of "people you can pick" for an RFI distribution
// or watcher chip editor: project members joined to their profile (display
// name, email), plus the project's role groups.
//
// Single hook returns both so the chip editor doesn't make two waterfalled
// queries on first paint.
//
// Bugatti choice: we don't surface external (non-user) email addresses
// in the directory. Distribution to outside parties happens by typing the
// raw email into the input — the chip editor's `onFreeText` callback
// turns it into a one-off option and the distribution row is written
// against the email, not a user_id.

import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import type { UserChipOption, UserChipRoleGroup } from '../../components/rfi/UserChipEditor'

export interface ProjectDirectory {
  members: UserChipOption[]
  roleGroups: UserChipRoleGroup[]
}

const EMPTY: ProjectDirectory = { members: [], roleGroups: [] }

/**
 * Return the directory of pickable members + role groups for a project.
 * `members` are scoped by project_members; `roleGroups` are project-scoped
 * lists with member_emails.
 */
export function useProjectDirectory(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['project_directory', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async (): Promise<ProjectDirectory> => {
      if (!projectId) return EMPTY

      // 1. Project members → join profiles for display name + email.
      // Supabase doesn't follow the user_id → auth.users path through
      // PostgREST, so we two-step and merge in JS. Same pattern as
      // useProfileNames used elsewhere.
      const { data: memberRows } = await fromTable('project_members')
        .select('user_id, role')
        .eq('project_id', projectId)

      const userIds = ((memberRows ?? []) as Array<{ user_id: string | null }>)
        .map((r) => r.user_id)
        .filter((u): u is string => !!u)

      let members: UserChipOption[] = []
      if (userIds.length > 0) {
        // profiles.user_id is the auth.users foreign key; profiles.id is
        // its own surrogate. Email lives on auth.users (not exposed via
        // RLS), so the chip label uses name; sublabel stays empty until
        // we add a profile.email column (deferred — tracked in P1b).
        const { data: profiles } = await fromTable('profiles')
          .select('user_id, full_name, first_name, last_name')
          .in('user_id', userIds)
        const profileMap = new Map<string, {
          full_name: string | null
          first_name: string | null
          last_name: string | null
        }>()
        for (const p of (profiles ?? []) as Array<{
          user_id: string
          full_name: string | null
          first_name: string | null
          last_name: string | null
        }>) {
          profileMap.set(p.user_id, {
            full_name: p.full_name,
            first_name: p.first_name,
            last_name: p.last_name,
          })
        }
        members = userIds.map((id) => {
          const p = profileMap.get(id)
          const name = p?.full_name
            ?? [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
            ?? 'Unknown'
          return {
            value: id,
            label: name || 'Unknown',
            sublabel: undefined,
          }
        })
      }

      // 2. Role groups
      const { data: groupRows } = await fromTable('project_role_groups')
        .select('id, name, member_emails, member_names')
        .eq('project_id', projectId)
        .order('name', { ascending: true })

      const roleGroups: UserChipRoleGroup[] = ((groupRows ?? []) as Array<{
        id: string
        name: string
        member_emails: string[] | null
        member_names: string[] | null
      }>).map((g) => ({
        id: g.id,
        name: g.name,
        values: g.member_emails ?? [],
        labels: g.member_names ?? undefined,
      }))

      return { members, roleGroups }
    },
  })
}
