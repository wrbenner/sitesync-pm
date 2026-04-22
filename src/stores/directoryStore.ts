// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { supabase, fromTable } from '../lib/supabase';

export interface DirectoryEntry {
  id: string;
  project_id: string;
  company: string;
  role: string;
  contactName: string;
  phone: string;
  email: string;
}

interface DirectoryState {
  entries: DirectoryEntry[];
  loading: boolean;
  error: string | null;

  loadEntries: (projectId: string) => Promise<void>;
  addEntry: (entry: Omit<DirectoryEntry, 'id'>) => Promise<{ error: string | null }>;
  updateEntry: (id: string, updates: Partial<DirectoryEntry>) => Promise<{ error: string | null }>;
  deleteEntry: (id: string) => Promise<{ error: string | null }>;
  search: (query: string) => DirectoryEntry[];
}

export const useDirectoryStore = create<DirectoryState>()((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  loadEntries: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('directory_contacts')
        .select('*')
        .eq('project_id', projectId)
        .order('company', { ascending: true });

      if (error) throw error;
      const entries: DirectoryEntry[] = (data ?? []).map((d: Record<string, unknown>) => ({
        id: d.id,
        project_id: d.project_id,
        company: d.company,
        role: d.role,
        contactName: d.name,
        phone: d.phone,
        email: d.email,
      }));
      set({ entries, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addEntry: async (entry) => {
    const { error } = await fromTable('directory_contacts').insert({
      project_id: entry.project_id,
      company: entry.company,
      role: entry.role,
      name: entry.contactName,
      phone: entry.phone,
      email: entry.email,
    });
    if (error) return { error: error.message };
    await get().loadEntries(entry.project_id);
    return { error: null };
  },

  updateEntry: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.contactName !== undefined) dbUpdates.name = updates.contactName;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.project_id !== undefined) dbUpdates.project_id = updates.project_id;

    const { error } = await fromTable('directory_contacts').update(dbUpdates).eq('id', id);
    if (!error) {
      set((s) => ({
        entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteEntry: async (id) => {
    const { error } = await fromTable('directory_contacts').delete().eq('id', id);
    if (!error) {
      set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  search: (query) => {
    const q = query.toLowerCase();
    return get().entries.filter(
      (e) =>
        e.contactName.toLowerCase().includes(q) ||
        e.company.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  },
}));
