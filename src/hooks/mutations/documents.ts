import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { useAuditedMutation, createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'
import {
  rfiSchema, submittalSchema, punchItemSchema,
  taskSchema, changeOrderSchema, meetingSchema, dailyLogSchema,
} from '../../components/forms/schemas'
import { useOfflineMutation } from '../useOfflineMutation'
import { createDailyLog, updateDailyLog } from '../../api/endpoints/field'
import type { DailyLogPayload } from '../../types/api'
import { getValidTransitions } from '../../machines/rfiMachine'
import { getValidSubmittalStatusTransitions } from '../../machines/submittalMachine'
import { getValidTaskTransitions } from '../../services/taskService'
import { getValidPunchTransitions } from '../../machines/punchItemMachine'
import { getValidDailyLogTransitions } from '../../services/dailyLogService'
import type { TaskState } from '../../machines/taskMachine'
import type { PunchItemState } from '../../machines/punchItemMachine'
import type { DailyLogState } from '../../machines/dailyLogMachine'
import type { RfiStatus } from '../../types/database'
import type { SubmittalStatus } from '../../types/submittal'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Documents ────────────────────────────────────────────

export function useCreateDrawingMarkup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; drawingId: string }) => {
      const { data, error } = await from('drawing_markups').insert(params.data).select().single()
      if (error) throw error
      return { data, drawingId: params.drawingId }
    },
    onSuccess: (result: { drawingId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_markups', result.drawingId] })
      posthog.capture('drawing_markup_created', { drawing_id: result.drawingId })
    },
    onError: createOnError('create_drawing_markup'),
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
