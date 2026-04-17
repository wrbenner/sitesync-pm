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

// ── AI Insights ──────────────────────────────────────────

export function useDismissInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({ dismissed: true }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_insights', result.projectId] })
      posthog.capture('insight_dismissed', { project_id: result.projectId })
    },
    onError: createOnError('dismiss_insight'),
  })
}

export function useActOnInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action, projectId }: { id: string; action: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({
        acted_on_at: new Date().toISOString(),
        acted_on_action: action,
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_insights', result.projectId] })
      posthog.capture('insight_acted_on', { project_id: result.projectId })
    },
    onError: createOnError('act_on_insight'),
  })
}
