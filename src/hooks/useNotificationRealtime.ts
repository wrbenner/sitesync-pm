import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

interface NotificationInsertPayload {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  link: string | null;
  read: boolean | null;
  entity_type: string | null;
  entity_id: string | null;
}

/**
 * Subscribes to Supabase realtime for the current user's notifications.
 * On INSERT for `user_id = auth.user.id`, fires a Sonner toast and
 * invalidates the notifications + unread-count query caches so the
 * NotificationCenter list and TopNav badge update without reload.
 *
 * Mount once near the app root so the subscription lives for the
 * authenticated session.
 */
export function useNotificationRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationInsertPayload;
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count', userId] });
          if (row?.title) {
            toast(row.title, { description: row.body ?? undefined });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Read-state changes from other tabs / mark-read mutations.
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count', userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
