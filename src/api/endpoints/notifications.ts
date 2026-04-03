import { supabase } from '../client'
import { transformSupabaseError } from '../errors'

export interface NotificationRow {
  id: string
  user_id: string
  project_id: string | null
  notification_type: string
  title: string
  message: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export async function getUnreadNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw transformSupabaseError(error)
  return (data ?? []) as NotificationRow[]
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw transformSupabaseError(error)
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false)
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
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw transformSupabaseError(error)
  return count ?? 0
}
