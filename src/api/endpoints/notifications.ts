import { supabase } from '../client'
import { fromTable } from '../../lib/db/queries'
import { transformSupabaseError } from '../errors'

export interface NotificationRow {
  id: string
  user_id: string
  project_id: string | null
  type: string | null
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  read: boolean | null
  created_at: string | null
}

export async function getUnreadNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await fromTable('notifications')
    .select('*')
    .eq('user_id' as never, userId)
    .eq('read' as never, false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw transformSupabaseError(error)
  return (data ?? []) as unknown as NotificationRow[]
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await fromTable('notifications')
    .update({ read: true } as never)
    .eq('id' as never, notificationId)
  if (error) throw transformSupabaseError(error)
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await fromTable('notifications')
    .update({ read: true } as never)
    .eq('user_id' as never, userId)
    .eq('read' as never, false)
  if (error) throw transformSupabaseError(error)
}

export function subscribeToNotifications(
  userId: string,
  onNew: (notification: NotificationRow) => void
): () => void {
  const channel = supabase
    .channel('user_notifications_' + userId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onNew(payload.new as NotificationRow)
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await fromTable('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id' as never, userId)
    .eq('read' as never, false)
  if (error) throw transformSupabaseError(error)
  return count ?? 0
}
