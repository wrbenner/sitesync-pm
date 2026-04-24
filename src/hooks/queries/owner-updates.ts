import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// owner_updates columns are defined in migration 00008_portal_module.sql:
//   id, project_id, title, content, photos (jsonb), schedule_summary,
//   budget_summary, milestone_updates (jsonb), weather_summary,
//   published, published_at, created_by, created_at, updated_at
export interface OwnerUpdate {
  id: string
  project_id: string
  title: string
  content: string | null
  schedule_summary: string | null
  budget_summary: string | null
  weather_summary: string | null
  photos: unknown
  milestone_updates: unknown
  published: boolean | null
  published_at: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export const ownerUpdatesKeys = {
  all: ['owner_updates'] as const,
  byProject: (projectId: string | undefined) =>
    ['owner_updates', projectId ?? null] as const,
  acknowledgements: (updateId: string | undefined, userId: string | undefined) =>
    ['owner_update_acknowledgements', updateId ?? null, userId ?? null] as const,
}

/**
 * Fetch all owner updates for a project, newest first.
 * Callers are responsible for filtering by `published` when rendering
 * for non-owner roles (owners see drafts + published).
 */
export function useOwnerUpdatesForProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ownerUpdatesKeys.byProject(projectId),
    queryFn: async (): Promise<OwnerUpdate[]> => {
      const { data, error } = await supabase
        .from('owner_updates')
        .select(
          'id, project_id, title, content, schedule_summary, budget_summary, weather_summary, photos, milestone_updates, published, published_at, created_by, created_at, updated_at',
        )
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as OwnerUpdate[]
    },
    enabled: !!projectId,
  })
}

/**
 * Acknowledgements stub.
 *
 * TODO: once `owner_update_acknowledgements` table exists (expected shape:
 *   id uuid PK,
 *   owner_update_id uuid FK -> owner_updates(id) on delete cascade,
 *   user_id uuid FK -> auth.users,
 *   acknowledged_at timestamptz default now(),
 *   UNIQUE (owner_update_id, user_id)
 * ) — wire this hook to SELECT from it.
 *
 * Until that migration lands, this returns an empty, non-erroring result so
 * the UI can render an Acknowledge button without blocking on a missing table.
 */
export function useOwnerUpdateAcknowledgements(
  updateId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: ownerUpdatesKeys.acknowledgements(updateId, userId),
    queryFn: async (): Promise<{ acknowledged: boolean; acknowledged_at: string | null }> => {
      return { acknowledged: false, acknowledged_at: null }
    },
    enabled: !!updateId && !!userId,
    staleTime: Infinity,
  })
}
