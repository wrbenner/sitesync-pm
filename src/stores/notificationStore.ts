import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  actionRoute?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  _realtimeChannel: RealtimeChannel | null;

  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  subscribeToUserNotifications: (userId: string, onMention: (title: string) => void) => void;
  unsubscribeFromUserNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  _realtimeChannel: null,
  notifications: [],
  unreadCount: 0,

  addNotification: (n) =>
    set((s) => {
      const notification: Notification = {
        ...n,
        id: `n-${Date.now()}`,
        timestamp: new Date(),
        read: false,
      };
      return {
        notifications: [notification, ...s.notifications],
        unreadCount: s.unreadCount + 1,
      };
    }),

  markRead: (id) =>
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  dismiss: (id) =>
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== id);
      return {
        notifications: filtered,
        unreadCount: filtered.filter((n) => !n.read).length,
      };
    }),

  subscribeToUserNotifications: (userId, onMention) => {
    const existing = get()._realtimeChannel;
    if (existing) supabase.removeChannel(existing);

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
          const row = payload.new as { type?: string; title: string };
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          onMention(row.title);
        },
      )
      .subscribe();

    set({ _realtimeChannel: channel });
  },

  unsubscribeFromUserNotifications: () => {
    const channel = get()._realtimeChannel;
    if (channel) supabase.removeChannel(channel);
    set({ _realtimeChannel: null });
  },
}));
