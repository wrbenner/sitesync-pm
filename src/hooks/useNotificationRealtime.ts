import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '../components/Primitives';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * Subscribes to Supabase realtime for the current user's notifications.
 * On a new mention, fires a toast and invalidates the notification query cache
 * so the TopBar badge count updates immediately.
 *
 * Mount once in AppContent so the subscription lives for the app session.
 */
export function useNotificationRealtime() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { subscribeToUserNotifications, unsubscribeFromUserNotifications } = useNotificationStore();

  useEffect(() => {
    if (!user?.id) return;

    subscribeToUserNotifications(user.id, (title) => {
      addToast('info', title);
    });

    return () => {
      unsubscribeFromUserNotifications();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
