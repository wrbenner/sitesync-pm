import { useMutation, useQueryClient } from '@tanstack/react-query'

import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'

import { fromTable } from '../../lib/db/queries'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Notifications ─────────────────────────────────────────

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await from('notifications').update({ read: true } as never).eq('id' as never, id)
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
      const { error } = await from('notifications').update({ read: true } as never).eq('user_id' as never, userId).eq('read' as never, false)
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
