import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

const MOCK_CREWS: CrewWithDetails[] = [
  { id: 'crew-1', project_id: 'project-1', name: 'Steel Crew A', foreman_id: 'user-1', trade: 'Structural Steel', size: 14, status: 'active', location: 'Floor 7', task: 'Structural Steel Erection', productivity: 98, eta: 'On Schedule', created_at: '2026-01-15T00:00:00Z' },
  { id: 'crew-2', project_id: 'project-1', name: 'MEP Crew B', foreman_id: 'user-2', trade: 'Mechanical', size: 12, status: 'active', location: 'Floors 4 to 6', task: 'Mechanical Rough In', productivity: 85, eta: '2 days ahead', created_at: '2026-01-15T00:00:00Z' },
  { id: 'crew-3', project_id: 'project-1', name: 'Electrical Crew C', foreman_id: 'user-3', trade: 'Electrical', size: 8, status: 'active', location: 'Floors 1 to 3', task: 'Electrical Rough In', productivity: 92, eta: 'On Schedule', created_at: '2026-01-15T00:00:00Z' },
  { id: 'crew-4', project_id: 'project-1', name: 'Exterior Crew D', foreman_id: 'user-4', trade: 'Curtain Wall', size: 16, status: 'active', location: 'South Face', task: 'Curtain Wall Installation', productivity: 78, eta: '3 days behind', created_at: '2026-01-15T00:00:00Z' },
  { id: 'crew-5', project_id: 'project-1', name: 'Framing Crew E', foreman_id: 'user-5', trade: 'Interior Framing', size: 11, status: 'active', location: 'Floors 8 to 12', task: 'Interior Framing', productivity: 88, eta: 'On Schedule', created_at: '2026-01-15T00:00:00Z' },
  { id: 'crew-6', project_id: 'project-1', name: 'Finishing Crew F', foreman_id: 'user-6', trade: 'Finishing', size: 9, status: 'standby', location: 'Lower Levels', task: 'Drywall and Painting', productivity: 82, eta: '1 day behind', created_at: '2026-01-15T00:00:00Z' },
];

export const useCrewStore = create<CrewState>()((set, get) => ({
  crews: [],
  loading: false,
  error: null,

  loadCrews: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ crews: MOCK_CREWS.filter((c) => c.project_id === projectId), loading: false });
      return;
    }

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
    if (!isSupabaseConfigured) {
      const newCrew: CrewWithDetails = {
        ...crew,
        id: `crew-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      set((s) => ({ crews: [...s.crews, newCrew] }));
      return { error: null };
    }

    const { error } = await (supabase.from('crews') as any).insert({
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
    if (!isSupabaseConfigured) {
      set((s) => ({
        crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
      return { error: null };
    }

    const { error } = await (supabase.from('crews') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteCrew: async (id) => {
    if (!isSupabaseConfigured) {
      set((s) => ({ crews: s.crews.filter((c) => c.id !== id) }));
      return { error: null };
    }

    const { error } = await (supabase.from('crews') as any).delete().eq('id', id);
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
