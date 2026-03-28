import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Submittal, SubmittalReviewer, Priority, SubmittalStatus } from '../types/database';

interface SubmittalState {
  submittals: Submittal[];
  reviewers: Record<string, SubmittalReviewer[]>;
  loading: boolean;
  error: string | null;

  loadSubmittals: (projectId: string) => Promise<void>;
  createSubmittal: (submittal: {
    project_id: string;
    title: string;
    description?: string;
    spec_section?: string;
    priority: Priority;
    created_by: string;
    due_date?: string;
    reviewer_ids?: string[];
  }) => Promise<{ error: string | null; submittal: Submittal | null }>;
  updateSubmittal: (id: string, updates: Partial<Submittal>) => Promise<{ error: string | null }>;
  updateSubmittalStatus: (id: string, status: SubmittalStatus) => Promise<{ error: string | null }>;
  loadReviewers: (submittalId: string) => Promise<void>;
  reviewSubmittal: (submittalId: string, reviewerId: string, status: 'approved' | 'rejected' | 'revise', comments?: string) => Promise<{ error: string | null }>;
  deleteSubmittal: (id: string) => Promise<{ error: string | null }>;
}

const MOCK_SUBMITTALS: Submittal[] = [
  {
    id: 'sub-1', project_id: 'project-1', submittal_number: 1,
    title: 'Structural Steel Shop Drawings',
    description: 'Complete set of structural steel shop drawings for floors 7 through 12, including connection details, erection sequences, and bolt patterns per specification section 05 12 00.',
    spec_section: '05 12 00', status: 'approved', priority: 'critical',
    created_by: 'user-1', due_date: '2025-03-25', revision_number: 1,
    created_at: '2025-03-10T09:00:00Z', updated_at: '2025-03-22T16:00:00Z',
  },
  {
    id: 'sub-2', project_id: 'project-1', submittal_number: 2,
    title: 'Mechanical Equipment Specifications',
    description: 'Mechanical equipment specifications for rooftop HVAC units including performance data, electrical requirements, structural loads, and maintenance access requirements.',
    spec_section: '23 05 00', status: 'under_review', priority: 'high',
    created_by: 'user-2', due_date: '2025-04-01', revision_number: 1,
    created_at: '2025-03-14T10:00:00Z', updated_at: '2025-03-21T11:00:00Z',
  },
  {
    id: 'sub-3', project_id: 'project-1', submittal_number: 3,
    title: 'Door and Hardware Schedule',
    description: 'Full door and hardware schedule covering 186 door openings across floors 1 through 12. Includes finish hardware groups, keying schedule, and access control integration.',
    spec_section: '08 71 00', status: 'revise_resubmit', priority: 'medium',
    created_by: 'user-1', due_date: '2025-03-30', revision_number: 2,
    created_at: '2025-03-08T08:00:00Z', updated_at: '2025-03-15T14:00:00Z',
  },
  {
    id: 'sub-4', project_id: 'project-1', submittal_number: 4,
    title: 'Electrical Panel Specifications',
    description: 'Electrical panel specifications for main distribution and branch circuit panels. Includes single line diagrams, short circuit calculations, and arc flash labels.',
    spec_section: '26 24 00', status: 'submitted', priority: 'high',
    created_by: 'user-3', due_date: '2025-04-05', revision_number: 1,
    created_at: '2025-03-20T09:00:00Z', updated_at: '2025-03-20T09:00:00Z',
  },
  {
    id: 'sub-5', project_id: 'project-1', submittal_number: 5,
    title: 'Concrete Mix Design for Structural Elements',
    description: 'Concrete mix design submittals for all structural elements including elevated slabs, columns, and shear walls. Includes test reports and compliance documentation.',
    spec_section: '03 30 00', status: 'approved', priority: 'high',
    created_by: 'user-1', due_date: '2025-03-20', revision_number: 1,
    created_at: '2025-03-05T09:00:00Z', updated_at: '2025-03-18T16:00:00Z',
  },
  {
    id: 'sub-6', project_id: 'project-1', submittal_number: 6,
    title: 'Curtain Wall System Shop Drawings',
    description: 'Complete curtain wall system shop drawings including framing details, glass specifications, thermal performance data, and installation sequence.',
    spec_section: '08 44 00', status: 'under_review', priority: 'critical',
    created_by: 'user-2', due_date: '2025-04-01', revision_number: 1,
    created_at: '2025-03-12T10:00:00Z', updated_at: '2025-03-22T09:00:00Z',
  },
  {
    id: 'sub-7', project_id: 'project-1', submittal_number: 7,
    title: 'HVAC Equipment Submittals',
    description: 'Complete HVAC equipment submittals including air handling units, chillers, cooling towers, and associated controls.',
    spec_section: '23 73 00', status: 'submitted', priority: 'high',
    created_by: 'user-2', due_date: '2025-04-05', revision_number: 1,
    created_at: '2025-03-18T11:00:00Z', updated_at: '2025-03-18T11:00:00Z',
  },
  {
    id: 'sub-8', project_id: 'project-1', submittal_number: 8,
    title: 'Elevator Cab Finishes and Materials',
    description: 'Elevator cab finish selections including wall panels, flooring, ceiling, and lighting for passenger and service elevators.',
    spec_section: '14 21 00', status: 'submitted', priority: 'medium',
    created_by: 'user-3', due_date: '2025-04-10', revision_number: 1,
    created_at: '2025-03-19T08:00:00Z', updated_at: '2025-03-19T08:00:00Z',
  },
  {
    id: 'sub-9', project_id: 'project-1', submittal_number: 9,
    title: 'Fire Sprinkler Layout and Calculations',
    description: 'Fire sprinkler system layout drawings and hydraulic calculations for all floors. Includes NFPA 13 compliance documentation.',
    spec_section: '21 13 00', status: 'approved', priority: 'high',
    created_by: 'user-1', due_date: '2025-03-22', revision_number: 1,
    created_at: '2025-03-06T09:00:00Z', updated_at: '2025-03-20T15:00:00Z',
  },
  {
    id: 'sub-10', project_id: 'project-1', submittal_number: 10,
    title: 'Waterproofing Membrane System',
    description: 'Below grade waterproofing membrane system submittals including material specifications, application details, and warranty documentation.',
    spec_section: '07 10 00', status: 'revise_resubmit', priority: 'high',
    created_by: 'user-2', due_date: '2025-04-02', revision_number: 3,
    created_at: '2025-03-01T10:00:00Z', updated_at: '2025-03-25T11:00:00Z',
  },
];

const MOCK_REVIEWERS: Record<string, SubmittalReviewer[]> = {
  'sub-1': [
    { id: 'rev-1', submittal_id: 'sub-1', user_id: 'user-2', review_order: 1, status: 'approved', reviewed_at: '2025-03-18T10:00:00Z', comments: 'Reviewed and approved. Proceed with fabrication.' },
    { id: 'rev-2', submittal_id: 'sub-1', user_id: 'user-1', review_order: 2, status: 'approved', reviewed_at: '2025-03-22T16:00:00Z', comments: 'Approved with no exceptions.' },
  ],
  'sub-2': [
    { id: 'rev-3', submittal_id: 'sub-2', user_id: 'user-1', review_order: 1, status: 'pending', reviewed_at: null, comments: null },
    { id: 'rev-4', submittal_id: 'sub-2', user_id: 'user-3', review_order: 2, status: 'pending', reviewed_at: null, comments: null },
  ],
  'sub-3': [
    { id: 'rev-5', submittal_id: 'sub-3', user_id: 'user-1', review_order: 1, status: 'revise', reviewed_at: '2025-03-15T14:00:00Z', comments: 'Hardware groups 4 and 7 do not match updated spec. Please revise and resubmit.' },
  ],
};

let mockSubCounter = 10;

export const useSubmittalStore = create<SubmittalState>()((set, get) => ({
  submittals: [],
  reviewers: {},
  loading: false,
  error: null,

  loadSubmittals: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({
        submittals: MOCK_SUBMITTALS.filter((s) => s.project_id === projectId),
        loading: false,
      });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('submittals')
        .select('*')
        .eq('project_id', projectId)
        .order('submittal_number', { ascending: false });

      if (error) throw error;
      set({ submittals: (data ?? []) as Submittal[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createSubmittal: async (submittal) => {
    if (!isSupabaseConfigured) {
      mockSubCounter++;
      const newSub: Submittal = {
        id: `sub-${Date.now()}`,
        project_id: submittal.project_id,
        submittal_number: mockSubCounter,
        title: submittal.title,
        description: submittal.description ?? null,
        spec_section: submittal.spec_section ?? null,
        status: 'draft',
        priority: submittal.priority,
        created_by: submittal.created_by,
        due_date: submittal.due_date ?? null,
        revision_number: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((s) => ({ submittals: [newSub, ...s.submittals] }));
      return { error: null, submittal: newSub };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('submittals') as any)
      .insert({
        project_id: submittal.project_id,
        title: submittal.title,
        description: submittal.description ?? null,
        spec_section: submittal.spec_section ?? null,
        status: 'draft',
        priority: submittal.priority,
        created_by: submittal.created_by,
        due_date: submittal.due_date ?? null,
        revision_number: 1,
      })
      .select()
      .single();

    if (error) return { error: error.message, submittal: null };

    const newSub = data as Submittal;

    // Create reviewer entries if provided
    if (submittal.reviewer_ids?.length) {
      for (let i = 0; i < submittal.reviewer_ids.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('submittal_reviewers') as any).insert({
          submittal_id: newSub.id,
          user_id: submittal.reviewer_ids[i],
          review_order: i + 1,
          status: 'pending',
        });
      }
    }

    set((s) => ({ submittals: [newSub, ...s.submittals] }));
    return { error: null, submittal: newSub };
  },

  updateSubmittal: async (id, updates) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        submittals: s.submittals.map((sub) =>
          sub.id === id ? { ...sub, ...updates, updated_at: new Date().toISOString() } : sub
        ),
      }));
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('submittals') as any).update(updates).eq('id', id);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) => (sub.id === id ? { ...sub, ...updates } : sub)),
      }));
    }
    return { error: error?.message ?? null };
  },

  updateSubmittalStatus: async (id, status) => {
    return get().updateSubmittal(id, { status });
  },

  loadReviewers: async (submittalId) => {
    if (!isSupabaseConfigured) {
      set((s) => ({
        reviewers: { ...s.reviewers, [submittalId]: MOCK_REVIEWERS[submittalId] ?? [] },
      }));
      return;
    }

    const { data, error } = await supabase
      .from('submittal_reviewers')
      .select('*')
      .eq('submittal_id', submittalId)
      .order('review_order');

    if (!error && data) {
      set((s) => ({
        reviewers: { ...s.reviewers, [submittalId]: data as SubmittalReviewer[] },
      }));
    }
  },

  reviewSubmittal: async (submittalId, reviewerId, status, comments) => {
    if (!isSupabaseConfigured) {
      set((s) => {
        const reviewers = (s.reviewers[submittalId] ?? []).map((r) =>
          r.id === reviewerId
            ? { ...r, status, reviewed_at: new Date().toISOString(), comments: comments ?? null }
            : r
        );

        // Check if all reviewers have responded
        const anyRejected = reviewers.some((r) => r.status === 'rejected' || r.status === 'revise');
        const allApproved = reviewers.every((r) => r.status === 'approved');

        let newStatus: SubmittalStatus | undefined;
        if (allApproved) newStatus = 'approved';
        else if (anyRejected) newStatus = 'revise_resubmit';

        const submittals = newStatus
          ? s.submittals.map((sub) => (sub.id === submittalId ? { ...sub, status: newStatus!, updated_at: new Date().toISOString() } : sub))
          : s.submittals;

        return { reviewers: { ...s.reviewers, [submittalId]: reviewers }, submittals };
      });
      return { error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('submittal_reviewers') as any)
      .update({ status, reviewed_at: new Date().toISOString(), comments: comments ?? null })
      .eq('id', reviewerId);

    if (!error) {
      await get().loadReviewers(submittalId);
    }
    return { error: error?.message ?? null };
  },

  deleteSubmittal: async (id) => {
    if (!isSupabaseConfigured) {
      set((s) => ({ submittals: s.submittals.filter((sub) => sub.id !== id) }));
      return { error: null };
    }

    const { error } = await supabase.from('submittals').delete().eq('id', id);
    if (!error) {
      set((s) => ({ submittals: s.submittals.filter((sub) => sub.id !== id) }));
    }
    return { error: error?.message ?? null };
  },
}));
