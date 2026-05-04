import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
import { fromTable } from '../../lib/db/queries'

type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Notifications ─────────────────────────────────────────

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await from('notifications').update({ read: true }).eq('id' as never, id)
      if (error) throw error
      return { userId }
    },
    onSuccess: (result: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', result.userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count', result.userId] })
      posthog.capture('notification_read', { user_id: result.userId })
    },
    onError: createOnError('mark_notification_read'),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await from('notifications').update({ read: true }).eq('user_id' as never, userId).eq('read' as never, false)
      if (error) throw error
      return { userId }
    },
    onSuccess: (result: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', result.userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count', result.userId] })
      posthog.capture('all_notifications_read', { user_id: result.userId })
    },
    onError: createOnError('mark_all_notifications_read'),
  })
}
