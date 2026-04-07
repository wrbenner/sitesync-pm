import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { RFI, RFIResponse, Priority, RfiStatus } from '../types/database';

interface RfiState {
  rfis: RFI[];
  responses: Record<string, RFIResponse[]>;
  loading: boolean;
  error: string | null;

  loadRfis: (projectId: string) => Promise<void>;
  createRfi: (rfi: {
    project_id: string;
    title: string;
    description?: string;
    priority: Priority;
    assigned_to?: string;
    due_date?: string;
    created_by: string;
    linked_drawing_id?: string;
  }) => Promise<{ error: string | null; rfi: RFI | null }>;
  updateRfi: (rfiId: string, updates: Partial<RFI>) => Promise<{ error: string | null }>;
  updateRfiStatus: (rfiId: string, status: RfiStatus) => Promise<{ error: string | null }>;
  loadResponses: (rfiId: string) => Promise<void>;
  addResponse: (rfiId: string, userId: string, text: string, attachments?: string[]) => Promise<{ error: string | null }>;
  deleteRfi: (rfiId: string) => Promise<{ error: string | null }>;
}

export const useRfiStore = create<RfiState>()((set, get) => ({
  rfis: [],
  responses: {},
  loading: false,
  error: null,

  loadRfis: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('rfi_number', { ascending: false });

      if (error) throw error;
      set({ rfis: (data ?? []) as RFI[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createRfi: async (rfi) => {
    const { data, error } = await supabase.from('rfis')
      .insert({
        project_id: rfi.project_id,
        title: rfi.title,
        description: rfi.description ?? null,
        status: 'draft',
        priority: rfi.priority,
        created_by: rfi.created_by,
        assigned_to: rfi.assigned_to ?? null,
        due_date: rfi.due_date ?? null,
        ball_in_court_id: rfi.assigned_to ?? null,
        linked_drawing_id: rfi.linked_drawing_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message, rfi: null };

    const newRfi = data as RFI;
    set((s) => ({ rfis: [newRfi, ...s.rfis] }));
    return { error: null, rfi: newRfi };
  },

  updateRfi: async (rfiId, updates) => {
    const { error } = await supabase.from('rfis').update(updates).eq('id', rfiId);
    if (!error) {
      set((s) => ({
        rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, ...updates } : r)),
      }));
    }
    return { error: error?.message ?? null };
  },

  updateRfiStatus: async (rfiId, status) => {
    return get().updateRfi(rfiId, { status });
  },

  loadResponses: async (rfiId) => {
    const { data, error } = await supabase
      .from('rfi_responses')
      .select('*')
      .eq('rfi_id', rfiId)
      .order('created_at');

    if (!error && data) {
      set((s) => ({
        responses: { ...s.responses, [rfiId]: data as RFIResponse[] },
      }));
    }
  },

  addResponse: async (rfiId, userId, text, attachments) => {
    const { error } = await supabase.from('rfi_responses').insert({
      rfi_id: rfiId,
      user_id: userId,
      response_text: text,
      attachments: attachments ?? null,
    });

    if (!error) {
      await get().loadResponses(rfiId);
      await get().updateRfiStatus(rfiId, 'responded');
    }
    return { error: error?.message ?? null };
  },

  deleteRfi: async (rfiId) => {
    const { error } = await supabase.from('rfis').delete().eq('id', rfiId);
    if (!error) {
      set((s) => ({ rfis: s.rfis.filter((r) => r.id !== rfiId) }));
    }
    return { error: error?.message ?? null };
  },
}));
