// Phase 4 — react-query hooks for Submittal Packages.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { submittalPackagesService, type SubmittalPackage } from '../services/submittalPackages'

const KEY = (projectId: string | null | undefined): unknown[] => ['submittal_packages', projectId ?? '']

export function useSubmittalPackages(projectId: string | null | undefined): {
  packages: SubmittalPackage[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
} {
  const q = useQuery<SubmittalPackage[]>({
    queryKey: KEY(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!projectId) return []
      const r = await submittalPackagesService.list(projectId)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? []
    },
  })

  return {
    packages: q.data ?? [],
    loading: q.isPending && !!projectId,
    error: (q.error as Error) ?? null,
    refetch: q.refetch,
  }
}

export function useCreateSubmittalPackage(projectId: string): ReturnType<typeof useMutation<string, Error, {
  title: string
  description?: string | null
  responsibleSubId?: string | null
  csiSection?: string | null
  submittalIds?: string[]
}>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const r = await submittalPackagesService.create({ projectId, ...input })
      if (r.error) throw new Error(r.error.message)
      return r.data ?? ''
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
      qc.invalidateQueries({ queryKey: ['submittals_log_mv', projectId] })
    },
  })
}

export function useUpdateSubmittalPackage(projectId: string): ReturnType<typeof useMutation<void, Error, {
  id: string
  title: string
  description?: string | null
  responsibleSubId?: string | null
  csiSection?: string | null
}>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const r = await submittalPackagesService.update(input)
      if (r.error) throw new Error(r.error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useSetPackageMembers(projectId: string): ReturnType<typeof useMutation<void, Error, {
  packageId: string
  submittalIds: string[]
}>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ packageId, submittalIds }) => {
      const r = await submittalPackagesService.setMembers(packageId, submittalIds)
      if (r.error) throw new Error(r.error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
      qc.invalidateQueries({ queryKey: ['submittals_log_mv', projectId] })
    },
  })
}

export function useDeleteSubmittalPackage(projectId: string): ReturnType<typeof useMutation<void, Error, string>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (packageId: string) => {
      const r = await submittalPackagesService.remove(packageId)
      if (r.error) throw new Error(r.error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(projectId) })
      qc.invalidateQueries({ queryKey: ['submittals_log_mv', projectId] })
    },
  })
}
