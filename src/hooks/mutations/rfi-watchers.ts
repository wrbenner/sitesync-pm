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

// ── RFI Watchers ─────────────────────────────────────────

export function useAddRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').insert({ rfi_id: rfiId, user_id: userId })
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('add_rfi_watcher'),
  })
}

export function useRemoveRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').delete().eq('rfi_id', rfiId).eq('user_id', userId)
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('remove_rfi_watcher'),
  })
}
