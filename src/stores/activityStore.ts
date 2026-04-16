import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ActivityItem } from '../components/activity/ActivityCard';

export interface ActivityEntry extends ActivityItem {
  photoUrl?: string;
  preview?: string;
}

interface ActivityState {
  activities: ActivityEntry[];
  loading: boolean;

  loadActivities: (projectId: string) => void;
  addActivity: (activity: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  getFiltered: (filter: string) => ActivityEntry[];
}

export const useActivityStore = create<ActivityState>()((set, get) => ({
  activities: [],
  loading: false,

  loadActivities: async (projectId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const activities: ActivityEntry[] = (data ?? []).map((row: unknown) => ({
        id: row.id,
        type: row.activity_type ?? 'task',
        user: row.user_name ?? 'Unknown',
        userInitials: row.user_initials ?? '??',
        action: row.action ?? '',
        target: row.target ?? '',
        timestamp: new Date(row.created_at),
        commentCount: row.comment_count ?? 0,
        preview: row.preview ?? undefined,
        photoUrl: row.photo_url ?? undefined,
      }));

      set({ activities, loading: false });
    } catch {
      // Activity feed table may not exist yet; return empty
      set({ activities: [], loading: false });
    }
  },

  addActivity: (activity) => {
    const newActivity: ActivityEntry = {
      ...activity,
      id: Date.now(),
      timestamp: new Date(),
    };
    set((s) => ({ activities: [newActivity, ...s.activities] }));
  },

  getFiltered: (filter) => {
    const activities = get().activities;
    if (filter === 'all') return activities;
    return activities.filter((a) => a.type === filter);
  },
}));
