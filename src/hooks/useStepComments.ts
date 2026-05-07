// Phase 7c-1 — react-query hooks for the per-step comment thread.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  submittalStepCommentsService,
  type StepComment,
  type CreateCommentInput,
  type EditCommentInput,
} from '../services/submittalStepComments'

const KEY = (stepId: string): unknown[] => ['submittal_step_comments', stepId]

export function useStepComments(reviewerStepId: string | null | undefined): {
  comments: StepComment[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
} {
  const q = useQuery<StepComment[]>({
    queryKey: KEY(reviewerStepId ?? ''),
    enabled: !!reviewerStepId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!reviewerStepId) return []
      const r = await submittalStepCommentsService.listThread(reviewerStepId)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? []
    },
  })
  return {
    comments: q.data ?? [],
    loading: q.isPending && !!reviewerStepId,
    error: (q.error as Error) ?? null,
    refetch: q.refetch,
  }
}

export function useCreateStepComment(reviewerStepId: string): ReturnType<typeof useMutation<string, Error, CreateCommentInput>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const r = await submittalStepCommentsService.create(input)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? ''
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(reviewerStepId) }),
  })
}

export function useEditStepComment(reviewerStepId: string): ReturnType<typeof useMutation<string, Error, EditCommentInput>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EditCommentInput) => {
      const r = await submittalStepCommentsService.edit(input)
      if (r.error) throw new Error(r.error.message)
      return r.data ?? ''
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(reviewerStepId) }),
  })
}

export function useDeleteStepComment(reviewerStepId: string): ReturnType<typeof useMutation<void, Error, string>> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const r = await submittalStepCommentsService.remove(commentId)
      if (r.error) throw new Error(r.error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(reviewerStepId) }),
  })
}
