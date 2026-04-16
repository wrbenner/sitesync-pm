import { create } from 'zustand';
import { submittalService } from '../services/submittalService';
import type { Submittal } from '../types/database';
import type { SubmittalState } from '../machines/submittalMachine';
import type { CreateSubmittalInput, SubmittalReviewer } from '../services/submittalService';

interface SubmittalStoreState {
  submittals: Submittal[];
  reviewers: Record<string, SubmittalReviewer[]>;
  loading: boolean;
  error: string | null;

  loadSubmittals: (projectId: string) => Promise<void>;
  createSubmittal: (
    input: CreateSubmittalInput,
  ) => Promise<{ error: string | null; submittal: Submittal | null }>;
  updateSubmittal: (
    id: string,
    updates: Partial<Submittal>,
  ) => Promise<{ error: string | null }>;
  transitionStatus: (
    id: string,
    status: SubmittalState,
  ) => Promise<{ error: string | null }>;
  /** @deprecated Use transitionStatus instead */
  updateSubmittalStatus: (
    id: string,
    status: SubmittalState,
  ) => Promise<{ error: string | null }>;
  loadReviewers: (submittalId: string) => Promise<void>;
  reviewSubmittal: (
    submittalId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'revise',
    comments?: string,
  ) => Promise<{ error: string | null }>;
  deleteSubmittal: (id: string) => Promise<{ error: string | null }>;
}

export const useSubmittalStore = create<SubmittalStoreState>()((set, get) => ({
  submittals: [],
  reviewers:  {},
  loading:    false,
  error:      null,

  loadSubmittals: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await submittalService.loadSubmittals(projectId);
    if (error) {
      set({ error, loading: false });
    } else {
      set({ submittals: data ?? [], loading: false });
    }
  },

  createSubmittal: async (input) => {
    const { data, error } = await submittalService.createSubmittal(input);
    if (error) return { error, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
    }
    return { error: null, submittal: data };
  },

  updateSubmittal: async (id, updates) => {
    const { error } = await submittalService.updateSubmittal(id, updates);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) =>
          sub.id === id ? { ...sub, ...updates } : sub,
        ),
      }));
    }
    return { error };
  },

  transitionStatus: async (id, status) => {
    const { error } = await submittalService.transitionStatus(id, status);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) =>
          sub.id === id ? { ...sub, status } : sub,
        ),
      }));
    }
    return { error };
  },

  // Backward compat shim — delegates to transitionStatus
  updateSubmittalStatus: async (id, status) => {
    return get().transitionStatus(id, status);
  },

  loadReviewers: async (submittalId) => {
    const { data, error } = await submittalService.loadReviewers(submittalId);
    if (!error && data) {
      set((s) => ({
        reviewers: { ...s.reviewers, [submittalId]: data },
      }));
    }
  },

  reviewSubmittal: async (submittalId, reviewerId, decision, comments) => {
    const { error } = await submittalService.reviewSubmittal(
      submittalId,
      reviewerId,
      decision,
      comments,
    );
    if (!error) {
      await get().loadReviewers(submittalId);
      const decisionToStatus: Record<string, SubmittalState> = {
        approved: 'approved',
        rejected: 'rejected',
        revise:   'resubmit',
      };
      const nextStatus = decisionToStatus[decision];
      if (nextStatus) {
        set((s) => ({
          submittals: s.submittals.map((sub) =>
            sub.id === submittalId ? { ...sub, status: nextStatus } : sub,
          ),
        }));
      }
    }
    return { error };
  },

  deleteSubmittal: async (id) => {
    const { error } = await submittalService.deleteSubmittal(id);
    if (!error) {
      // Remove from local state (the RLS select policy now filters deleted rows)
      set((s) => ({ submittals: s.submittals.filter((sub) => sub.id !== id) }));
    }
    return { error };
  },
}));
