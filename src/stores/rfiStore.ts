import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

// Mock RFIs for development
const MOCK_RFIS: RFI[] = [
  {
    id: 'rfi-1', project_id: 'project-1', rfi_number: 1,
    title: 'Clarification on interior finish specifications in retail space',
    description: 'Requesting clarification on the specification details referenced in the current drawing set. The field team has identified a discrepancy between the architectural drawings and the structural details that needs to be resolved before proceeding with installation.',
    status: 'submitted', priority: 'high', created_by: 'user-1', assigned_to: 'user-2',
    due_date: '2025-03-28', ball_in_court_id: 'user-2', linked_drawing_id: null,
    created_at: '2025-03-21T09:00:00Z', updated_at: '2025-03-21T09:00:00Z',
  },
  {
    id: 'rfi-2', project_id: 'project-1', rfi_number: 2,
    title: 'Door hardware approval for apartment entries',
    description: 'Need approval on selected door hardware package for apartment entry doors on floors 3 through 12.',
    status: 'responded', priority: 'medium', created_by: 'user-1', assigned_to: 'user-3',
    due_date: '2025-03-27', ball_in_court_id: null, linked_drawing_id: null,
    created_at: '2025-03-19T10:00:00Z', updated_at: '2025-03-22T14:00:00Z',
  },
  {
    id: 'rfi-3', project_id: 'project-1', rfi_number: 3,
    title: 'HVAC zoning strategy for floor 8',
    description: 'The current HVAC zoning layout for floor 8 conflicts with the updated tenant partition plan. Need direction on whether to follow the original mechanical drawings or adapt to the new layout.',
    status: 'under_review', priority: 'high', created_by: 'user-2', assigned_to: 'user-1',
    due_date: '2025-03-25', ball_in_court_id: 'user-1', linked_drawing_id: null,
    created_at: '2025-03-20T08:30:00Z', updated_at: '2025-03-21T11:00:00Z',
  },
  {
    id: 'rfi-4', project_id: 'project-1', rfi_number: 4,
    title: 'Structural connection detail at curtain wall interface',
    description: 'The structural connection detail shown on S4.2 does not align with the curtain wall attachment points shown on A8.1. Need coordination between structural and architectural teams.',
    status: 'submitted', priority: 'critical', created_by: 'user-3', assigned_to: 'user-1',
    due_date: '2025-03-24', ball_in_court_id: 'user-1', linked_drawing_id: null,
    created_at: '2025-03-21T07:00:00Z', updated_at: '2025-03-21T07:00:00Z',
  },
  {
    id: 'rfi-5', project_id: 'project-1', rfi_number: 5,
    title: 'Electrical panel location confirmation in basement',
    description: 'Confirming electrical panel locations in basement level B1 per the latest revised electrical drawings.',
    status: 'closed', priority: 'medium', created_by: 'user-2', assigned_to: 'user-3',
    due_date: '2025-03-26', ball_in_court_id: null, linked_drawing_id: null,
    created_at: '2025-03-18T09:00:00Z', updated_at: '2025-03-25T16:00:00Z',
  },
  {
    id: 'rfi-6', project_id: 'project-1', rfi_number: 6,
    title: 'Elevator pit waterproofing detail',
    description: 'Need clarification on waterproofing membrane system for elevator pit. Current spec calls for sheet membrane but site conditions may require liquid applied system.',
    status: 'submitted', priority: 'high', created_by: 'user-1', assigned_to: 'user-2',
    due_date: '2025-04-02', ball_in_court_id: 'user-2', linked_drawing_id: null,
    created_at: '2025-03-22T10:00:00Z', updated_at: '2025-03-22T10:00:00Z',
  },
  {
    id: 'rfi-7', project_id: 'project-1', rfi_number: 7,
    title: 'Roof drain location and sizing',
    description: 'Requesting verification of roof drain locations and sizing calculations for the green roof area on level 12.',
    status: 'responded', priority: 'medium', created_by: 'user-2', assigned_to: 'user-3',
    due_date: '2025-04-05', ball_in_court_id: null, linked_drawing_id: null,
    created_at: '2025-03-18T11:00:00Z', updated_at: '2025-03-24T09:00:00Z',
  },
  {
    id: 'rfi-8', project_id: 'project-1', rfi_number: 8,
    title: 'Fire rated wall assembly at stairwell 3',
    description: 'The fire rated wall assembly at stairwell 3 needs clarification. Drawing A5.3 shows a 2 hour rating but the door schedule calls for 90 minute doors.',
    status: 'submitted', priority: 'high', created_by: 'user-1', assigned_to: 'user-2',
    due_date: '2025-03-30', ball_in_court_id: 'user-2', linked_drawing_id: null,
    created_at: '2025-03-20T14:00:00Z', updated_at: '2025-03-20T14:00:00Z',
  },
  {
    id: 'rfi-9', project_id: 'project-1', rfi_number: 9,
    title: 'Parking garage exhaust fan location',
    description: 'Requesting confirmation on exhaust fan placement in parking garage level P2. Current location conflicts with sprinkler main routing.',
    status: 'closed', priority: 'low', created_by: 'user-2', assigned_to: 'user-3',
    due_date: '2025-04-10', ball_in_court_id: null, linked_drawing_id: null,
    created_at: '2025-03-15T08:00:00Z', updated_at: '2025-03-28T10:00:00Z',
  },
  {
    id: 'rfi-10', project_id: 'project-1', rfi_number: 10,
    title: 'Lobby ceiling height confirmation at entry canopy',
    description: 'Need to confirm final ceiling height at the main lobby entry canopy. The architectural elevation shows 14 feet but the reflected ceiling plan indicates 12 feet 6 inches.',
    status: 'under_review', priority: 'medium', created_by: 'user-1', assigned_to: 'user-2',
    due_date: '2025-04-01', ball_in_court_id: 'user-2', linked_drawing_id: null,
    created_at: '2025-03-23T09:30:00Z', updated_at: '2025-03-24T11:00:00Z',
  },
  {
    id: 'rfi-11', project_id: 'project-1', rfi_number: 11,
    title: 'Mechanical room access door swing direction',
    description: 'Code review indicates mechanical room doors must swing outward. Current plans show inward swing. Requesting updated door schedule.',
    status: 'responded', priority: 'low', created_by: 'user-2', assigned_to: 'user-3',
    due_date: '2025-04-08', ball_in_court_id: null, linked_drawing_id: null,
    created_at: '2025-03-12T10:00:00Z', updated_at: '2025-03-20T15:00:00Z',
  },
  {
    id: 'rfi-12', project_id: 'project-1', rfi_number: 12,
    title: 'Concrete mix design for Level 10 slab pour',
    description: 'Requesting approval of concrete mix design for Level 10 elevated slab. High early strength mix required to maintain schedule.',
    status: 'submitted', priority: 'critical', created_by: 'user-1', assigned_to: 'user-2',
    due_date: '2025-03-29', ball_in_court_id: 'user-2', linked_drawing_id: null,
    created_at: '2025-03-24T07:00:00Z', updated_at: '2025-03-24T07:00:00Z',
  },
];

const MOCK_RESPONSES: Record<string, RFIResponse[]> = {
  'rfi-2': [
    { id: 'resp-1', rfi_id: 'rfi-2', user_id: 'user-3', response_text: 'Hardware package approved as submitted. Proceed with ordering for floors 3 through 8 immediately. Floors 9 through 12 will follow in the next release.', attachments: null, created_at: '2025-03-22T14:00:00Z' },
  ],
  'rfi-7': [
    { id: 'resp-2', rfi_id: 'rfi-7', user_id: 'user-3', response_text: 'Roof drain locations confirmed per revised mechanical drawings rev 3. Sizing calculations attached show 6 inch drains at all primary locations.', attachments: ['drain_calcs.pdf'], created_at: '2025-03-24T09:00:00Z' },
  ],
  'rfi-11': [
    { id: 'resp-3', rfi_id: 'rfi-11', user_id: 'user-3', response_text: 'Updated door schedule issued. All mechanical room doors revised to outward swing per code requirements. See attached revised schedule.', attachments: ['door_schedule_rev2.pdf'], created_at: '2025-03-20T15:00:00Z' },
  ],
};

let mockRfiCounter = 12;

export const useRfiStore = create<RfiState>()((set, get) => ({
  rfis: [],
  responses: {},
  loading: false,
  error: null,

  loadRfis: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({
        rfis: MOCK_RFIS.filter((r) => r.project_id === projectId),
        loading: false,
      });
      return;
    }

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
    if (!isSupabaseConfigured) {
      mockRfiCounter++;
      const newRfi: RFI = {
        id: `rfi-${Date.now()}`,
        project_id: rfi.project_id,
        rfi_number: mockRfiCounter,
        title: rfi.title,
        description: rfi.description ?? null,
        status: 'draft',
        priority: rfi.priority,
        created_by: rfi.created_by,
        assigned_to: rfi.assigned_to ?? null,
        due_date: rfi.due_date ?? null,
        ball_in_court_id: rfi.assigned_to ?? null,
        linked_drawing_id: rfi.linked_drawing_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((s) => ({ rfis: [newRfi, ...s.rfis] }));
      return { error: null, rfi: newRfi };
    }

    const { data, error } = await (supabase.from('rfis') as any)
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
    if (!isSupabaseConfigured) {
      set((s) => ({
        rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r)),
      }));
      return { error: null };
    }

    const { error } = await (supabase.from('rfis') as any).update(updates).eq('id', rfiId);
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
    if (!isSupabaseConfigured) {
      set((s) => ({
        responses: { ...s.responses, [rfiId]: MOCK_RESPONSES[rfiId] ?? [] },
      }));
      return;
    }

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
    if (!isSupabaseConfigured) {
      const newResp: RFIResponse = {
        id: `resp-${Date.now()}`,
        rfi_id: rfiId,
        user_id: userId,
        response_text: text,
        attachments: attachments ?? null,
        created_at: new Date().toISOString(),
      };
      set((s) => ({
        responses: {
          ...s.responses,
          [rfiId]: [...(s.responses[rfiId] ?? []), newResp],
        },
      }));
      // Auto update status to responded
      get().updateRfiStatus(rfiId, 'responded');
      return { error: null };
    }

    const { error } = await (supabase.from('rfi_responses') as any).insert({
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
    if (!isSupabaseConfigured) {
      set((s) => ({ rfis: s.rfis.filter((r) => r.id !== rfiId) }));
      return { error: null };
    }

    const { error } = await supabase.from('rfis').delete().eq('id', rfiId);
    if (!error) {
      set((s) => ({ rfis: s.rfis.filter((r) => r.id !== rfiId) }));
    }
    return { error: error?.message ?? null };
  },
}));
