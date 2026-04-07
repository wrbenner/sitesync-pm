import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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

export const useSubmittalStore = create<SubmittalState>()((set, get) => ({
  submittals: [],
  reviewers: {},
  loading: false,
  error: null,

  loadSubmittals: async (projectId) => {
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
    const { error } = await supabase.from('submittals').delete().eq('id', id);
    if (!error) {
      set((s) => ({ submittals: s.submittals.filter((sub) => sub.id !== id) }));
    }
    return { error: error?.message ?? null };
  },
}));
