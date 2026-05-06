import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type { Notification } from '../../types/database'

// ── Notifications ─────────────────────────────────────────

export interface NotificationsPaginated {
  data: Notification[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

const DEFAULT_PAGE_SIZE = 20

/**
 * Fetch a user's notifications, ordered by `created_at` desc. Returns
 * the full list (pageSize defaults to 20) — for explicit pagination
 * pass `{ page, pageSize }`.
 */
export function useNotifications(
  userId: string | undefined,
  opts: { page?: number; pageSize?: number } = {},
) {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  return useQuery({
    queryKey: ['notifications', userId, page, pageSize],
    queryFn: async (): Promise<NotificationsPaginated> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await fromTable('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id' as never, userId!)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      const total = count ?? 0
      return {
        data: (data ?? []) as unknown as Notification[],
        total,
        page,
        pageSize,
        hasMore: from + (data?.length ?? 0) < total,
      }
    },
    enabled: !!userId,
    placeholderData: (prev) => prev,
  })
}

/**
 * Unread notification count for the TopNav badge. Lives on a separate
 * query key so it can be invalidated independently from the paginated
 * list (and so realtime INSERTs can bump just the count).
 */
export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', 'unread_count', userId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await fromTable('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id' as never, userId!)
        .eq('read' as never, false)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!userId,
  })
}
