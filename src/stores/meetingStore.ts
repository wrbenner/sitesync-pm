import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Meeting, ActionItem } from '../types/database';

export interface MeetingWithDetails extends Meeting {
  attendee_count: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  has_minutes: boolean;
}

interface MeetingState {
  meetings: MeetingWithDetails[];
  actionItems: Record<string, ActionItem[]>;
  loading: boolean;
  error: string | null;

  loadMeetings: (projectId: string) => Promise<void>;
  createMeeting: (meeting: Omit<MeetingWithDetails, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateMeeting: (id: string, updates: Partial<MeetingWithDetails>) => Promise<{ error: string | null }>;
  deleteMeeting: (id: string) => Promise<{ error: string | null }>;
  addActionItem: (meetingId: string, description: string, assignedTo?: string) => void;
  updateActionItemStatus: (meetingId: string, itemId: string, status: ActionItem['status']) => void;
  getActionItems: (meetingId: string) => ActionItem[];
}

export const useMeetingStore = create<MeetingState>()((set, get) => ({
  meetings: [],
  actionItems: {},
  loading: false,
  error: null,

  loadMeetings: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('project_id', projectId)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      const meetings: MeetingWithDetails[] = (data ?? []).map((m: any) => ({
        ...m,
        attendee_count: m.attendee_count || 0,
        status: m.status || 'scheduled',
        has_minutes: m.has_minutes || false,
      }));

      // Load action items for meetings that have minutes
      const actionItems: Record<string, ActionItem[]> = {};
      for (const mtg of meetings.filter((m) => m.has_minutes)) {
        const { data: items } = await supabase
          .from('meeting_action_items')
          .select('*')
          .eq('meeting_id', mtg.id)
          .order('id');
        if (items) actionItems[mtg.id] = items as ActionItem[];
      }

      set({ meetings, actionItems, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createMeeting: async (meeting) => {
    const { error } = await (supabase.from('meetings') as any).insert(meeting);
    if (error) return { error: error.message };
    await get().loadMeetings(meeting.project_id);
    return { error: null };
  },

  updateMeeting: async (id, updates) => {
    const { error } = await (supabase.from('meetings') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteMeeting: async (id) => {
    const { error } = await (supabase.from('meetings') as any).delete().eq('id', id);
    if (!error) {
      set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  addActionItem: (meetingId, description, assignedTo) => {
    // Action items are persisted locally; can be synced to meeting_action_items table
    const item: ActionItem = {
      id: `ai-${Date.now()}`,
      meeting_id: meetingId,
      description,
      assigned_to: assignedTo || null,
      due_date: null,
      status: 'open',
    };
    set((s) => ({
      actionItems: {
        ...s.actionItems,
        [meetingId]: [...(s.actionItems[meetingId] ?? []), item],
      },
    }));
  },

  updateActionItemStatus: (meetingId, itemId, status) => {
    set((s) => ({
      actionItems: {
        ...s.actionItems,
        [meetingId]: (s.actionItems[meetingId] ?? []).map((ai) =>
          ai.id === itemId ? { ...ai, status } : ai
        ),
      },
    }));
  },

  getActionItems: (meetingId) => {
    return get().actionItems[meetingId] ?? [];
  },
}));
