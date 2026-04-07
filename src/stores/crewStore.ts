import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Crew } from '../types/database';

export interface CrewWithDetails extends Crew {
  location: string;
  task: string;
  productivity: number;
  eta: string;
}

interface CrewState {
  crews: CrewWithDetails[];
  loading: boolean;
  error: string | null;

  loadCrews: (projectId: string) => Promise<void>;
  addCrew: (crew: Omit<CrewWithDetails, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  updateCrew: (id: string, updates: Partial<CrewWithDetails>) => Promise<{ error: string | null }>;
  deleteCrew: (id: string) => Promise<{ error: string | null }>;
  getSummary: () => { total: number; active: number; totalWorkers: number; avgProductivity: number };
}

export const useCrewStore = create<CrewState>()((set, get) => ({
  crews: [],
  loading: false,
  error: null,

  loadCrews: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (error) throw error;
      const crews: CrewWithDetails[] = (data ?? []).map((c: any) => ({
        ...c,
        location: c.location || 'TBD',
        task: c.task || 'Unassigned',
        productivity: c.productivity || 0,
        eta: c.eta || 'TBD',
      }));
      set({ crews, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addCrew: async (crew) => {
    const { error } = await supabase.from('crews').insert({
      project_id: crew.project_id,
      name: crew.name,
      foreman_id: crew.foreman_id,
      trade: crew.trade,
      size: crew.size,
      status: crew.status,
    });

    if (error) return { error: error.message };
    await get().loadCrews(crew.project_id);
    return { error: null };
  },

  updateCrew: async (id, updates) => {
    const { error } = await supabase.from('crews').update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteCrew: async (id) => {
    const { error } = await supabase.from('crews').delete().eq('id', id);
    if (!error) {
      set((s) => ({ crews: s.crews.filter((c) => c.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  getSummary: () => {
    const crews = get().crews;
    const active = crews.filter((c) => c.status === 'active');
    return {
      total: crews.length,
      active: active.length,
      totalWorkers: crews.reduce((s, c) => s + c.size, 0),
      avgProductivity: crews.length > 0 ? Math.round(crews.reduce((s, c) => s + c.productivity, 0) / crews.length) : 0,
    };
  },
}));
