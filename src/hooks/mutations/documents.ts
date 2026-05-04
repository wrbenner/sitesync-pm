import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import Sentry from '../../lib/sentry'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
import { fromTable } from '../../lib/db/queries'

type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Documents ────────────────────────────────────────────

export function useCreateDrawingMarkup() {
  const queryClient = useQueryClient()
  // Quiet error handler for markup saves. Annotations render locally regardless; a failed
  // sync is not something to nag the user about on every click. RLS-denial (403) during
  // setup is common, so we log once to Sentry and skip the toast.
  const quietOnError = (error: Error) => {
    const msg = (error as { message?: string }).message ?? '';
    const isRlsDenial = /row-level security|permission denied|403/i.test(msg);
    if (!isRlsDenial) {
      Sentry.captureException(error, { extra: { mutation: 'create_drawing_markup' } });
    }
  };
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; drawingId: string }) => {
      const { data, error } = await from('drawing_markups').insert(params.data).select().single()
      if (error) throw error
      return { data, drawingId: params.drawingId }
    },
    retry: false,
    onSuccess: (result: { drawingId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_markups', result.drawingId] })
      posthog.capture('drawing_markup_created', { drawing_id: result.drawingId })
    },
    onError: quietOnError,
  })
}

export function useDeleteDrawingMarkup() {
  const queryClient = useQueryClient()
  const quietOnError = (error: Error) => {
    const msg = (error as { message?: string }).message ?? '';
    const isRlsDenial = /row-level security|permission denied|403/i.test(msg);
    if (!isRlsDenial) {
      Sentry.captureException(error, { extra: { mutation: 'delete_drawing_markup' } });
    }
  };
  return useMutation({
    mutationFn: async (params: { id: string; drawingId: string }) => {
      const { error } = await from('drawing_markups').delete().eq('id' as never, params.id)
      if (error) throw error
      return { drawingId: params.drawingId, id: params.id }
    },
    retry: false,
    onSuccess: (result: { drawingId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_markups', result.drawingId] })
      posthog.capture('drawing_markup_deleted', { drawing_id: result.drawingId })
    },
    onError: quietOnError,
  })
}

export function useCreateTransmittal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('transmittals').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['transmittals', result.projectId] })
      posthog.capture('transmittal_created', { project_id: result.projectId })
    },
    onError: createOnError('create_transmittal'),
  })
}
