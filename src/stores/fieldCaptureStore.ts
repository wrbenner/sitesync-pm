import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type CaptureType = 'photo' | 'voice' | 'text' | 'issue';

export interface FieldCapture {
  id: string;
  project_id: string;
  capture_type: CaptureType;
  title: string;
  description: string;
  location: string;
  captured_by: string;
  ai_category: string | null;
  file_url: string | null;
  transcript: string | null;
  created_at: string;
}

interface FieldCaptureState {
  captures: FieldCapture[];
  loading: boolean;
  error: string | null;

  loadCaptures: (projectId: string) => Promise<void>;
  addCapture: (capture: Omit<FieldCapture, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  deleteCapture: (id: string) => Promise<{ error: string | null }>;
  getTodayCaptures: () => FieldCapture[];
  getPreviousCaptures: () => FieldCapture[];
}

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
const twoDaysAgoStr = new Date(today.getTime() - 2 * 86400000).toISOString().split('T')[0];

const MOCK_CAPTURES: FieldCapture[] = [
  { id: 'fc-1', project_id: 'project-1', capture_type: 'photo', title: 'Floor 7 Steel Connection', description: 'Steel beam connection at grid B4', location: 'Floor 7', captured_by: 'John Smith', ai_category: 'Steel Connection', file_url: null, transcript: null, created_at: `${todayStr}T08:45:00Z` },
  { id: 'fc-2', project_id: 'project-1', capture_type: 'voice', title: 'Safety observation at north entrance', description: 'North entrance rebar exposed, needs capping', location: 'North Entrance', captured_by: 'Maria Garcia', ai_category: 'Safety', file_url: null, transcript: 'North entrance rebar exposed, needs capping before end of shift today.', created_at: `${todayStr}T09:12:00Z` },
  { id: 'fc-3', project_id: 'project-1', capture_type: 'photo', title: 'Completed drywall section L3', description: 'Drywall installation complete on level 3 north wing', location: 'Floor 3', captured_by: 'Robert Chen', ai_category: 'Progress', file_url: null, transcript: null, created_at: `${todayStr}T10:30:00Z` },
  { id: 'fc-4', project_id: 'project-1', capture_type: 'text', title: 'MEP coordination note', description: 'Elevator shaft routing discussion with plumbing', location: 'Floor 5', captured_by: 'James Wilson', ai_category: null, file_url: null, transcript: null, created_at: `${todayStr}T11:15:00Z` },
  { id: 'fc-5', project_id: 'project-1', capture_type: 'issue', title: 'Curtain wall panel alignment', description: 'South face curtain wall panels misaligned by 3mm at grid line 4', location: 'Exterior South', captured_by: 'Lisa Zhang', ai_category: 'Issue', file_url: null, transcript: null, created_at: `${todayStr}T13:45:00Z` },
  { id: 'fc-6', project_id: 'project-1', capture_type: 'photo', title: 'Concrete cure check, Floor 1', description: 'Checking concrete cure progress on Floor 1 slab', location: 'Floor 1', captured_by: 'David Kumar', ai_category: 'Progress', file_url: null, transcript: null, created_at: `${todayStr}T14:30:00Z` },
  { id: 'fc-7', project_id: 'project-1', capture_type: 'photo', title: 'Floor 5 ductwork installation', description: 'HVAC ductwork installation progress', location: 'Floor 5', captured_by: 'Karen Williams', ai_category: 'MEP Rough In', file_url: null, transcript: null, created_at: `${yesterdayStr}T15:20:00Z` },
  { id: 'fc-8', project_id: 'project-1', capture_type: 'voice', title: 'Waterproofing inspection notes', description: 'Basement waterproofing inspection results', location: 'Basement', captured_by: 'David Kumar', ai_category: null, file_url: null, transcript: 'Waterproofing membrane looks good. No deficiencies noted in section A through C.', created_at: `${yesterdayStr}T11:45:00Z` },
  { id: 'fc-9', project_id: 'project-1', capture_type: 'photo', title: 'Parking garage striping layout', description: 'Parking garage line striping layout verification', location: 'Parking B1', captured_by: 'Robert Chen', ai_category: null, file_url: null, transcript: null, created_at: `${yesterdayStr}T09:00:00Z` },
  { id: 'fc-10', project_id: 'project-1', capture_type: 'photo', title: 'Elevator shaft MEP routing', description: 'MEP routing coordination in elevator shaft', location: 'Floor 4', captured_by: 'James Wilson', ai_category: 'MEP Coordination', file_url: null, transcript: null, created_at: `${twoDaysAgoStr}T14:15:00Z` },
  { id: 'fc-11', project_id: 'project-1', capture_type: 'issue', title: 'Fire door hardware missing', description: 'Fire rated door on Floor 3 stairwell B missing closer hardware', location: 'Floor 3', captured_by: 'Thomas Rodriguez', ai_category: 'Punch Item', file_url: null, transcript: null, created_at: `${twoDaysAgoStr}T10:30:00Z` },
  { id: 'fc-12', project_id: 'project-1', capture_type: 'voice', title: 'Concrete strength test results', description: 'Floor 9 concrete cylinder break results', location: 'Floor 9', captured_by: 'Mike Patterson', ai_category: null, file_url: null, transcript: 'Concrete break test results for Floor 9: 28 day strength at 4850 psi, exceeding the 4000 psi spec requirement.', created_at: `${twoDaysAgoStr}T08:45:00Z` },
];

export const useFieldCaptureStore = create<FieldCaptureState>()((set, get) => ({
  captures: [],
  loading: false,
  error: null,

  loadCaptures: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ captures: MOCK_CAPTURES.filter((c) => c.project_id === projectId), loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('field_captures')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ captures: (data ?? []) as FieldCapture[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addCapture: async (capture) => {
    if (!isSupabaseConfigured) {
      const newCapture: FieldCapture = {
        ...capture,
        id: `fc-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ captures: [newCapture, ...s.captures] }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('field_captures') as any).insert(capture);
    if (error) return { error: error.message };
    await get().loadCaptures(capture.project_id);
    return { error: null };
  },

  deleteCapture: async (id) => {
    if (!isSupabaseConfigured) {
      set((s) => ({ captures: s.captures.filter((c) => c.id !== id) }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('field_captures') as any).delete().eq('id', id);
    if (!error) {
      set((s) => ({ captures: s.captures.filter((c) => c.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  getTodayCaptures: () => {
    const todayDate = new Date().toISOString().split('T')[0];
    return get().captures.filter((c) => c.created_at.startsWith(todayDate));
  },

  getPreviousCaptures: () => {
    const todayDate = new Date().toISOString().split('T')[0];
    return get().captures.filter((c) => !c.created_at.startsWith(todayDate));
  },
}));
