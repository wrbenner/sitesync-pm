import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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

export const useFieldCaptureStore = create<FieldCaptureState>()((set, get) => ({
  captures: [],
  loading: false,
  error: null,

  loadCaptures: async (projectId) => {
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
    const { error } = await supabase.from('field_captures').insert(capture);
    if (error) return { error: error.message };
    await get().loadCaptures(capture.project_id);
    return { error: null };
  },

  deleteCapture: async (id) => {
    const { error } = await supabase.from('field_captures').delete().eq('id', id);
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
