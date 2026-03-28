import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PunchListItem, PunchItemStatus } from '../types/database';

export interface PunchComment {
  id: string;
  punch_item_id: string;
  author: string;
  initials: string;
  text: string;
  created_at: string;
}

interface PunchListState {
  items: PunchListItem[];
  comments: Record<string, PunchComment[]>;
  loading: boolean;
  error: string | null;

  loadItems: (projectId: string) => Promise<void>;
  createItem: (item: Omit<PunchListItem, 'id' | 'item_number' | 'created_at' | 'updated_at'>) => Promise<{ error: string | null }>;
  updateItemStatus: (id: string, status: PunchItemStatus) => Promise<{ error: string | null }>;
  updateItem: (id: string, updates: Partial<PunchListItem>) => Promise<{ error: string | null }>;
  deleteItem: (id: string) => Promise<{ error: string | null }>;
  addComment: (itemId: string, author: string, initials: string, text: string) => void;
  getComments: (itemId: string) => PunchComment[];
  getSummary: () => { total: number; open: number; inProgress: number; complete: number; verified: number; critical: number; high: number };
}

let itemCounter = 20;

const MOCK_ITEMS: PunchListItem[] = [
  { id: 'pi-1', project_id: 'project-1', item_number: 1, description: 'Lighting fixture not level in bedroom', area: 'Floor 3 Apartment 301', assigned_to: 'John Smith', priority: 'medium', status: 'open', due_date: '2026-03-30', photos: ['photo1.jpg', 'photo2.jpg'], created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-10T10:00:00Z' },
  { id: 'pi-2', project_id: 'project-1', item_number: 2, description: 'Paint touch up required on south wall', area: 'Floor 5 Common Area', assigned_to: 'Maria Garcia', priority: 'low', status: 'in_progress', due_date: '2026-04-05', photos: null, created_at: '2026-03-08T09:00:00Z', updated_at: '2026-03-20T14:00:00Z' },
  { id: 'pi-3', project_id: 'project-1', item_number: 3, description: 'Door closer adjustment needed', area: 'Parking Level B2', assigned_to: 'Robert Chen', priority: 'high', status: 'open', due_date: '2026-03-28', photos: ['photo3.jpg'], created_at: '2026-03-12T11:00:00Z', updated_at: '2026-03-12T11:00:00Z' },
  { id: 'pi-4', project_id: 'project-1', item_number: 4, description: 'Marble baseboard installation incomplete', area: 'Lobby', assigned_to: 'James Wilson', priority: 'high', status: 'in_progress', due_date: '2026-04-02', photos: null, created_at: '2026-03-05T08:00:00Z', updated_at: '2026-03-18T10:00:00Z' },
  { id: 'pi-5', project_id: 'project-1', item_number: 5, description: 'HVAC ductwork noise reduction', area: 'Floor 8 Retail', assigned_to: 'Sarah Johnson', priority: 'medium', status: 'complete', due_date: '2026-03-20', photos: ['photo4.jpg'], created_at: '2026-02-28T09:00:00Z', updated_at: '2026-03-19T16:00:00Z' },
  { id: 'pi-6', project_id: 'project-1', item_number: 6, description: 'Missing baseboards along corridor', area: 'Floor 8, Unit 802', assigned_to: 'Maria Garcia', priority: 'low', status: 'open', due_date: '2026-04-10', photos: null, created_at: '2026-03-15T09:00:00Z', updated_at: '2026-03-15T09:00:00Z' },
  { id: 'pi-7', project_id: 'project-1', item_number: 7, description: 'HVAC diffuser not connected', area: 'Floor 8, Unit 805', assigned_to: 'Karen Williams', priority: 'high', status: 'open', due_date: '2026-03-29', photos: ['p7a.jpg', 'p7b.jpg', 'p7c.jpg'], created_at: '2026-03-14T10:00:00Z', updated_at: '2026-03-14T10:00:00Z' },
  { id: 'pi-8', project_id: 'project-1', item_number: 8, description: 'Electrical outlet cover plate missing', area: 'Floor 2, Unit 204', assigned_to: 'Tom Anderson', priority: 'low', status: 'complete', due_date: '2026-03-25', photos: null, created_at: '2026-03-01T08:00:00Z', updated_at: '2026-03-24T11:00:00Z' },
  { id: 'pi-9', project_id: 'project-1', item_number: 9, description: 'Fire sprinkler head not flush with ceiling', area: 'Floor 6, Common Area', assigned_to: 'Robert Chen', priority: 'critical', status: 'open', due_date: '2026-03-27', photos: ['p9a.jpg', 'p9b.jpg'], created_at: '2026-03-18T14:00:00Z', updated_at: '2026-03-18T14:00:00Z' },
  { id: 'pi-10', project_id: 'project-1', item_number: 10, description: 'Elevator lobby tile grout discoloration', area: 'Lobby', assigned_to: 'James Wilson', priority: 'medium', status: 'in_progress', due_date: '2026-04-01', photos: ['p10.jpg'], created_at: '2026-03-10T09:00:00Z', updated_at: '2026-03-22T10:00:00Z' },
  { id: 'pi-11', project_id: 'project-1', item_number: 11, description: 'Kitchen cabinet door alignment off', area: 'Floor 10, Unit 1003', assigned_to: 'John Smith', priority: 'medium', status: 'verified', due_date: '2026-03-22', photos: null, created_at: '2026-03-02T09:00:00Z', updated_at: '2026-03-21T15:00:00Z' },
  { id: 'pi-12', project_id: 'project-1', item_number: 12, description: 'Parking garage stripes faded at ramp entry', area: 'Parking B1', assigned_to: 'Maria Garcia', priority: 'low', status: 'open', due_date: '2026-04-15', photos: null, created_at: '2026-03-16T11:00:00Z', updated_at: '2026-03-16T11:00:00Z' },
  { id: 'pi-13', project_id: 'project-1', item_number: 13, description: 'Bathroom exhaust fan excessive noise', area: 'Floor 4, Unit 410', assigned_to: 'Karen Williams', priority: 'high', status: 'in_progress', due_date: '2026-03-31', photos: ['p13.jpg'], created_at: '2026-03-11T10:00:00Z', updated_at: '2026-03-23T09:00:00Z' },
  { id: 'pi-14', project_id: 'project-1', item_number: 14, description: 'Rooftop access door weather seal damaged', area: 'Rooftop', assigned_to: 'Robert Chen', priority: 'critical', status: 'open', due_date: '2026-03-28', photos: ['p14a.jpg', 'p14b.jpg', 'p14c.jpg', 'p14d.jpg'], created_at: '2026-03-20T08:00:00Z', updated_at: '2026-03-20T08:00:00Z' },
  { id: 'pi-15', project_id: 'project-1', item_number: 15, description: 'Storefront glass panel scratch', area: 'Floor 1, Retail A', assigned_to: 'Tom Anderson', priority: 'medium', status: 'complete', due_date: '2026-03-20', photos: null, created_at: '2026-02-25T10:00:00Z', updated_at: '2026-03-19T14:00:00Z' },
  { id: 'pi-16', project_id: 'project-1', item_number: 16, description: 'Drywall crack above doorframe', area: 'Floor 7, Unit 701', assigned_to: 'John Smith', priority: 'low', status: 'open', due_date: '2026-04-08', photos: null, created_at: '2026-03-19T09:00:00Z', updated_at: '2026-03-19T09:00:00Z' },
  { id: 'pi-17', project_id: 'project-1', item_number: 17, description: 'Flooring transition strip loose', area: 'Floor 9, Unit 902', assigned_to: 'Maria Garcia', priority: 'medium', status: 'in_progress', due_date: '2026-04-03', photos: null, created_at: '2026-03-13T10:00:00Z', updated_at: '2026-03-24T08:00:00Z' },
  { id: 'pi-18', project_id: 'project-1', item_number: 18, description: 'Emergency lighting unit not functional', area: 'Parking B2', assigned_to: 'Karen Williams', priority: 'critical', status: 'open', due_date: '2026-03-26', photos: ['p18.jpg'], created_at: '2026-03-21T14:00:00Z', updated_at: '2026-03-21T14:00:00Z' },
  { id: 'pi-19', project_id: 'project-1', item_number: 19, description: 'Corridor handrail loose at stairwell B', area: 'Floor 11, Common Area', assigned_to: 'Robert Chen', priority: 'high', status: 'verified', due_date: '2026-03-18', photos: null, created_at: '2026-02-28T11:00:00Z', updated_at: '2026-03-17T16:00:00Z' },
  { id: 'pi-20', project_id: 'project-1', item_number: 20, description: 'Balcony door threshold gap too wide', area: 'Floor 12, Penthouse', assigned_to: 'James Wilson', priority: 'high', status: 'in_progress', due_date: '2026-04-01', photos: ['p20a.jpg', 'p20b.jpg'], created_at: '2026-03-17T09:00:00Z', updated_at: '2026-03-25T10:00:00Z' },
];

const MOCK_COMMENTS: Record<string, PunchComment[]> = {
  'pi-1': [
    { id: 'pc-1', punch_item_id: 'pi-1', author: 'John Smith', initials: 'JS', text: 'Checked the fixture. The mounting bracket is slightly bent. Need a replacement part from the supplier.', created_at: '2026-03-27T10:00:00Z' },
    { id: 'pc-2', punch_item_id: 'pi-1', author: 'Mike Torres', initials: 'MT', text: 'Replacement bracket ordered. Should arrive tomorrow morning.', created_at: '2026-03-27T11:00:00Z' },
  ],
  'pi-2': [
    { id: 'pc-3', punch_item_id: 'pi-2', author: 'Maria Garcia', initials: 'MG', text: 'Started prep work. Matching paint color from original spec.', created_at: '2026-03-27T08:00:00Z' },
    { id: 'pc-4', punch_item_id: 'pi-2', author: 'David Lee', initials: 'DL', text: 'Make sure to use the low VOC paint per the environmental requirements.', created_at: '2026-03-27T09:00:00Z' },
    { id: 'pc-5', punch_item_id: 'pi-2', author: 'Maria Garcia', initials: 'MG', text: 'Confirmed. Using the approved Sherwin Williams SW 7006 Extra White.', created_at: '2026-03-27T11:00:00Z' },
  ],
  'pi-3': [
    { id: 'pc-6', punch_item_id: 'pi-3', author: 'Robert Chen', initials: 'RC', text: 'The closer arm is out of spec. Needs full replacement, not just adjustment.', created_at: '2026-03-27T06:00:00Z' },
    { id: 'pc-7', punch_item_id: 'pi-3', author: 'James Wilson', initials: 'JW', text: 'Approved the replacement. Please coordinate with security for access to B2 after hours.', created_at: '2026-03-27T07:00:00Z' },
  ],
  'pi-4': [
    { id: 'pc-8', punch_item_id: 'pi-4', author: 'James Wilson', initials: 'JW', text: 'Marble pieces are onsite. Installation crew scheduled for Thursday.', created_at: '2026-03-26T09:00:00Z' },
    { id: 'pc-9', punch_item_id: 'pi-4', author: 'Sarah Johnson', initials: 'SJ', text: 'Verified the marble matches the approved sample. Good to proceed.', created_at: '2026-03-27T00:00:00Z' },
  ],
  'pi-5': [
    { id: 'pc-10', punch_item_id: 'pi-5', author: 'Sarah Johnson', initials: 'SJ', text: 'Installed acoustic lining in the main supply duct. Noise levels within acceptable range now.', created_at: '2026-03-25T09:00:00Z' },
    { id: 'pc-11', punch_item_id: 'pi-5', author: 'Mike Torres', initials: 'MT', text: 'Confirmed. Sound level measured at 35 dB, well within the 40 dB limit. Marking complete.', created_at: '2026-03-26T09:00:00Z' },
  ],
};

export const usePunchListStore = create<PunchListState>()((set, get) => ({
  items: [],
  comments: {},
  loading: false,
  error: null,

  loadItems: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ items: MOCK_ITEMS.filter((i) => i.project_id === projectId), comments: MOCK_COMMENTS, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('punch_list_items')
        .select('*')
        .eq('project_id', projectId)
        .order('item_number');

      if (error) throw error;
      set({ items: (data ?? []) as PunchListItem[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createItem: async (item) => {
    if (!isSupabaseConfigured) {
      itemCounter++;
      const newItem: PunchListItem = {
        ...item,
        id: `pi-${Date.now()}`,
        item_number: itemCounter,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((s) => ({ items: [...s.items, newItem] }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('punch_list_items') as any).insert(item);
    if (error) return { error: error.message };
    await get().loadItems(item.project_id);
    return { error: null };
  },

  updateItemStatus: async (id, status) => {
    const updates: Partial<PunchListItem> = { status, updated_at: new Date().toISOString() };

    if (!isSupabaseConfigured) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('punch_list_items') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    }
    return { error: error?.message ?? null };
  },

  updateItem: async (id, updates) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i)),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('punch_list_items') as any).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) {
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteItem: async (id) => {
    if (!isSupabaseConfigured) {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('punch_list_items') as any).delete().eq('id', id);
    if (!error) {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  addComment: (itemId, author, initials, text) => {
    const comment: PunchComment = {
      id: `pc-${Date.now()}`,
      punch_item_id: itemId,
      author,
      initials,
      text,
      created_at: new Date().toISOString(),
    };
    set((s) => ({
      comments: {
        ...s.comments,
        [itemId]: [...(s.comments[itemId] ?? []), comment],
      },
    }));
  },

  getComments: (itemId) => {
    return get().comments[itemId] ?? [];
  },

  getSummary: () => {
    const items = get().items;
    return {
      total: items.length,
      open: items.filter((i) => i.status === 'open').length,
      inProgress: items.filter((i) => i.status === 'in_progress').length,
      complete: items.filter((i) => i.status === 'complete').length,
      verified: items.filter((i) => i.status === 'verified').length,
      critical: items.filter((i) => i.priority === 'critical').length,
      high: items.filter((i) => i.priority === 'high').length,
    };
  },
}));
