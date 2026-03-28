import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

const MOCK_ENTRIES: DirectoryEntry[] = [
  { id: 'dir-1', project_id: 'project-1', company: 'Turner Construction', role: 'General Contractor', contactName: 'Michael Patterson', phone: '(214) 555 0101', email: 'mpatterson@turnerconstruction.com' },
  { id: 'dir-2', project_id: 'project-1', company: 'Morris Architects', role: 'Architect', contactName: 'Jennifer Lee', phone: '(214) 555 0102', email: 'jlee@morrisarchitects.com' },
  { id: 'dir-3', project_id: 'project-1', company: 'Structural Systems Inc', role: 'Structural Engineer', contactName: 'David Kumar', phone: '(214) 555 0103', email: 'dkumar@structuralsystems.com' },
  { id: 'dir-4', project_id: 'project-1', company: 'Premier MEP Solutions', role: 'MEP Consultant', contactName: 'Robert Anderson', phone: '(214) 555 0104', email: 'randerson@premiermep.com' },
  { id: 'dir-5', project_id: 'project-1', company: 'Fabricator ABC Steel', role: 'Steel Supplier', contactName: 'Lisa Zhang', phone: '(602) 555 0105', email: 'lzhang@abcsteel.com' },
  { id: 'dir-6', project_id: 'project-1', company: 'Local Electrical LLC', role: 'Electrical Contractor', contactName: 'Thomas Rodriguez', phone: '(214) 555 0106', email: 'trodriguez@localelectrical.com' },
  { id: 'dir-7', project_id: 'project-1', company: 'Quality HVAC Services', role: 'HVAC Contractor', contactName: 'Karen Williams', phone: '(214) 555 0107', email: 'kwilliams@qualityhvac.com' },
  { id: 'dir-8', project_id: 'project-1', company: 'Meridian Development', role: 'Owner', contactName: 'James Bradford', phone: '(214) 555 0108', email: 'jbradford@meridiandev.com' },
];

export const useDirectoryStore = create<DirectoryState>()((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  loadEntries: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ entries: MOCK_ENTRIES.filter((e) => e.project_id === projectId), loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('directory')
        .select('*')
        .eq('project_id', projectId)
        .order('company', { ascending: true });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: DirectoryEntry[] = (data ?? []).map((d: any) => ({
        id: d.id,
        project_id: d.project_id,
        company: d.company,
        role: d.role,
        contactName: d.contact_name,
        phone: d.phone,
        email: d.email,
      }));
      set({ entries, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addEntry: async (entry) => {
    if (!isSupabaseConfigured) {
      const newEntry: DirectoryEntry = { ...entry, id: `dir-${Date.now()}` };
      set((s) => ({ entries: [...s.entries, newEntry] }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('directory') as any).insert({
      project_id: entry.project_id,
      company: entry.company,
      role: entry.role,
      contact_name: entry.contactName,
      phone: entry.phone,
      email: entry.email,
    });
    if (error) return { error: error.message };
    await get().loadEntries(entry.project_id);
    return { error: null };
  },

  updateEntry: async (id, updates) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('directory') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteEntry: async (id) => {
    if (!isSupabaseConfigured) {
      set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('directory') as any).delete().eq('id', id);
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
