// Phase 3 — react-query hook for submittal saved views.
//
// Lists views per project, grouped by scope. Provides create/update/remove
// mutators that invalidate the list. Triggers the Iris-suggested seed RPC
// on first project visit (idempotent server-side).

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  submittalsSavedViewsService,
  type SavedView,
  type SavedViewScope,
  type CreateSavedViewInput,
} from '../services/submittalsSavedViews'

export interface SavedViewsByScope {
  my: SavedView[]
  project: SavedView[]
  company: SavedView[]
  iris: SavedView[]
}

export interface UseSavedViewsResult {
  views: SavedView[]
  byScope: SavedViewsByScope
  loading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
  create: (input: CreateSavedViewInput) => Promise<SavedView | null>
  update: (id: string, patch: Partial<Pick<SavedView, 'name' | 'description' | 'view_state' | 'is_default'>>) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}

const EMPTY_BY_SCOPE: SavedViewsByScope = { my: [], project: [], company: [], iris: [] }

function groupByScope(views: SavedView[]): SavedViewsByScope {
  const out: SavedViewsByScope = { my: [], project: [], company: [], iris: [] }
  for (const v of views) {
    const bucket = out[v.scope as SavedViewScope]
    if (bucket) bucket.push(v)
  }
  return out
}

export function useSavedViews(projectId: string | null | undefined): UseSavedViewsResult {
  const queryClient = useQueryClient()
  const queryKey = ['submittal_saved_views', projectId ?? '']

  const query = useQuery<SavedView[]>({
    queryKey,
    enabled: !!projectId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!projectId) return []
      const result = await submittalsSavedViewsService.list(projectId)
      if (result.error) throw new Error(result.error.message)
      return result.data ?? []
    },
  })

  // Iris seed — fire-and-forget on first load. Server is idempotent.
  useEffect(() => {
    if (!projectId) return
    if (query.data === undefined) return
    const hasIris = query.data.some((v) => v.scope === 'iris')
    if (hasIris) return
    void submittalsSavedViewsService
      .seedIrisSuggested(projectId)
      .then((result) => {
        if (result.data && result.data > 0) {
          queryClient.invalidateQueries({ queryKey })
        }
      })
      .catch((err: unknown) => console.warn('[saved_views iris seed]', err))
  }, [projectId, query.data, queryClient, queryKey])

  const createMutation = useMutation({
    mutationFn: async (input: CreateSavedViewInput) => {
      const result = await submittalsSavedViewsService.create(input)
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<SavedView, 'name' | 'description' | 'view_state' | 'is_default'>> }) => {
      const result = await submittalsSavedViewsService.update(id, patch)
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await submittalsSavedViewsService.remove(id)
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    views: query.data ?? [],
    byScope: query.data ? groupByScope(query.data) : EMPTY_BY_SCOPE,
    loading: query.isPending,
    error: (query.error as Error) ?? null,
    refetch: query.refetch,
    create: async (input) => {
      try { return (await createMutation.mutateAsync(input)) ?? null } catch { return null }
    },
    update: async (id, patch) => {
      try { await updateMutation.mutateAsync({ id, patch }); return true } catch { return false }
    },
    remove: async (id) => {
      try { await removeMutation.mutateAsync(id); return true } catch { return false }
    },
  }
}
