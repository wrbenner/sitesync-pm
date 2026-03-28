import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const lastWeek1 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
const lastWeek2 = new Date(Date.now() - 8 * 86400000).toISOString().split('T')[0];

const MOCK_MEETINGS: MeetingWithDetails[] = [
  { id: 'mtg-1', project_id: 'project-1', meeting_type: 'oac', title: 'Owner Architect Contractor Meeting', meeting_date: today, meeting_time: '10:00 AM', location: 'Conference Room A', created_by: 'user-1', created_at: '2026-03-01T00:00:00Z', attendee_count: 12, status: 'scheduled', has_minutes: false },
  { id: 'mtg-2', project_id: 'project-1', meeting_type: 'safety', title: 'Weekly Safety Briefing', meeting_date: today, meeting_time: '8:00 AM', location: 'Site Trailer', created_by: 'user-1', created_at: '2026-03-01T00:00:00Z', attendee_count: 23, status: 'scheduled', has_minutes: false },
  { id: 'mtg-3', project_id: 'project-1', meeting_type: 'coordination', title: 'MEP Coordination Meeting', meeting_date: tomorrow, meeting_time: '2:00 PM', location: 'Virtual', created_by: 'user-1', created_at: '2026-03-01T00:00:00Z', attendee_count: 8, status: 'scheduled', has_minutes: false },
  { id: 'mtg-4', project_id: 'project-1', meeting_type: 'safety', title: 'Incident Review Follow up', meeting_date: lastWeek1, meeting_time: '9:00 AM', location: 'Site Trailer', created_by: 'user-1', created_at: '2026-03-01T00:00:00Z', attendee_count: 6, status: 'completed', has_minutes: true },
  { id: 'mtg-5', project_id: 'project-1', meeting_type: 'oac', title: 'Monthly Progress Review', meeting_date: lastWeek2, meeting_time: '2:00 PM', location: 'Conference Room A', created_by: 'user-1', created_at: '2026-03-01T00:00:00Z', attendee_count: 14, status: 'completed', has_minutes: true },
];

const MOCK_ACTION_ITEMS: Record<string, ActionItem[]> = {
  'mtg-4': [
    { id: 'ai-1', meeting_id: 'mtg-4', description: 'Install anti slip tape on all stairwell landings', assigned_to: 'Mike Torres', due_date: '2026-03-22', status: 'completed' },
    { id: 'ai-2', meeting_id: 'mtg-4', description: 'Update incident report with corrective actions', assigned_to: 'Safety Coordinator', due_date: '2026-03-21', status: 'completed' },
  ],
  'mtg-5': [
    { id: 'ai-3', meeting_id: 'mtg-5', description: 'Expedite RFI-004 response from structural engineer', assigned_to: 'Jennifer Lee', due_date: '2026-03-25', status: 'open' },
    { id: 'ai-4', meeting_id: 'mtg-5', description: 'Review CO-003 lobby finishes with owner', assigned_to: 'James Bradford', due_date: '2026-03-24', status: 'open' },
    { id: 'ai-5', meeting_id: 'mtg-5', description: 'Submit updated schedule with steel recovery plan', assigned_to: 'Michael Patterson', due_date: '2026-03-26', status: 'in_progress' },
  ],
};

export const useMeetingStore = create<MeetingState>()((set, get) => ({
  meetings: [],
  actionItems: {},
  loading: false,
  error: null,

  loadMeetings: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ meetings: MOCK_MEETINGS.filter((m) => m.project_id === projectId), actionItems: MOCK_ACTION_ITEMS, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('project_id', projectId)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meetings: MeetingWithDetails[] = (data ?? []).map((m: any) => ({
        ...m,
        attendee_count: m.attendee_count || 0,
        status: m.status || 'scheduled',
        has_minutes: m.has_minutes || false,
      }));
      set({ meetings, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createMeeting: async (meeting) => {
    if (!isSupabaseConfigured) {
      const newMeeting: MeetingWithDetails = {
        ...meeting,
        id: `mtg-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ meetings: [newMeeting, ...s.meetings] }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('meetings') as any).insert(meeting);
    if (error) return { error: error.message };
    await get().loadMeetings(meeting.project_id);
    return { error: null };
  },

  updateMeeting: async (id, updates) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('meetings') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteMeeting: async (id) => {
    if (!isSupabaseConfigured) {
      set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('meetings') as any).delete().eq('id', id);
    if (!error) {
      set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  addActionItem: (meetingId, description, assignedTo) => {
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
