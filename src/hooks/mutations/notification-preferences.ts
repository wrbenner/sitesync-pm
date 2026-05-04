import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Notification Preferences ─────────────────────────────

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await from('notification_preferences').upsert({ user_id: userId, ...updates }).select().single()
      if (error) throw error
      return { data, userId }
    },
    onSuccess: (result: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences', result.userId] })
      posthog.capture('notification_preferences_updated')
    },
    onError: createOnError('update_notification_preferences'),
  })
}
