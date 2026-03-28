import { create } from 'zustand';
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

const MOCK_ACTIVITIES: ActivityEntry[] = [
  { id: 1, type: 'task', user: 'Thomas Rodriguez', userInitials: 'TR', action: 'completed', target: 'Install fire stopping at floor penetrations', timestamp: new Date(Date.now() - 45 * 60 * 1000), commentCount: 3 },
  { id: 2, type: 'comment', user: 'David Kumar', userInitials: 'DK', action: 'commented on', target: 'Resolve curtain wall interface detail', timestamp: new Date(Date.now() - 90 * 60 * 1000), preview: 'The connection detail looks good. I have marked up the drawing with two minor adjustments needed at grid line B4.', commentCount: 5 },
  { id: 3, type: 'rfi', user: 'Mike Patterson', userInitials: 'MP', action: 'submitted', target: 'RFI-004: Structural connection at curtain wall', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), preview: 'Need clarification on the connection detail between structural steel and curtain wall panel system at the south face.', commentCount: 2 },
  { id: 4, type: 'photo', user: 'John Smith', userInitials: 'JS', action: 'uploaded 3 photos to', target: 'Floor 7 Steel Connection', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), photoUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400', commentCount: 1 },
  { id: 5, type: 'submittal', user: 'Jennifer Lee', userInitials: 'JL', action: 'approved', target: 'SUB-001: Structural Steel Shop Drawings', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), preview: 'Approved with no comments. Fabrication may proceed per submitted shop drawings.' },
  { id: 6, type: 'schedule', user: 'Karen Williams', userInitials: 'KW', action: 'moved to In Review', target: 'Review CO-002 HVAC upgrade scope', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  { id: 7, type: 'budget', user: 'Robert Anderson', userInitials: 'RA', action: 'flagged', target: 'Structural division budget at 97%', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), preview: 'Contingency is effectively zero after CO-001. Recommend reallocation from Interior budget.' },
  { id: 8, type: 'task', user: 'Mike Patterson', userInitials: 'MP', action: 'created task', target: 'Safety audit walkthrough', timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) },
  { id: 9, type: 'photo', user: 'Maria Garcia', userInitials: 'MG', action: 'captured voice note', target: 'Safety observation at north entrance', timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000), preview: 'North entrance rebar exposed, needs capping before tomorrow morning. Flagged as priority.', photoUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400' },
  { id: 10, type: 'punch', user: 'Robert Chen', userInitials: 'RC', action: 'updated', target: 'PL-003: Door closer adjustment', timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000) },
];

export const useActivityStore = create<ActivityState>()((set, get) => ({
  activities: [],
  loading: false,

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadActivities: (_projectId: string) => {
    set({ activities: MOCK_ACTIVITIES, loading: false });
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
