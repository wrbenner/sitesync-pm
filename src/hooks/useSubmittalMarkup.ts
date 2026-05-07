// Phase 8 — react-query hooks for submittal markup.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  submittalMarkupService,
  type CreateMarkupInput,
  type SubmittalMarkup,
} from '../services/submittalMarkup'

const KEY = (itemId: string, rev?: number): unknown[] =>
  rev != null ? ['submittal_markup', itemId, rev] : ['submittal_markup', itemId]

export function useSubmittalMarkup(opts: {
  submittalItemId: string | null | undefined
  revNumber?: number
}): {
  markups: SubmittalMarkup[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
} {
  const { submittalItemId, revNumber } = opts
  const q = useQuery<SubmittalMarkup[]>({
    queryKey: KEY(submittalItemId ?? '', revNumber),
    enabled: !!submittalItemId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!submittalItemId) return []
      const r = await submittalMarkupService.list(submittalItemId, revNumber)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? []
    },
  })

  return {
    markups: q.data ?? [],
    loading: q.isPending && !!submittalItemId,
    error: (q.error as Error) ?? null,
    refetch: q.refetch,
  }
}

export function useCreateMarkup(submittalItemId: string): ReturnType<typeof useMutation<string, Error, CreateMarkupInput>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMarkupInput) => {
      const r = await submittalMarkupService.create(input)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? ''
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submittal_markup', submittalItemId] })
    },
  })
}

export function useDeleteMarkup(submittalItemId: string): ReturnType<typeof useMutation<void, Error, string>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (markupId: string) => {
      const r = await submittalMarkupService.remove(markupId)
      if (r.error) throw new Error(r.error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submittal_markup', submittalItemId] })
    },
  })
}
