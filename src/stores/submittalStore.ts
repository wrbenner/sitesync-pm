import { create } from 'zustand';
import { submittalService } from '../services/submittalService';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type { SubmittalStatus, SubmittalReviewer, CreateSubmittalInput } from '../types/submittal';

interface SubmittalState {
  submittals: Submittal[];
  approvals: Record<string, SubmittalReviewer[]>;
  loading: boolean;
  error: string | null;

  loadSubmittals: (projectId: string) => Promise<void>;
  createSubmittal: (
    input: CreateSubmittalInput,
  ) => Promise<{ error: string | null; submittal: Submittal | null }>;
  updateSubmittal: (
    submittalId: string,
    updates: Partial<Submittal>,
  ) => Promise<{ error: string | null }>;
  transitionStatus: (
    submittalId: string,
    status: SubmittalStatus,
  ) => Promise<{ error: string | null }>;
  /** @deprecated Use transitionStatus instead */
  updateSubmittalStatus: (
    submittalId: string,
    status: SubmittalStatus,
  ) => Promise<{ error: string | null }>;
  loadApprovals: (submittalId: string) => Promise<void>;
  addApproval: (
    submittalId: string,
    stamp: SubmittalApproval['stamp'],
    comments?: string,
  ) => Promise<{ error: string | null }>;
  deleteSubmittal: (submittalId: string) => Promise<{ error: string | null }>;
  createRevision: (
    parentSubmittalId: string,
  ) => Promise<{ error: string | null; submittal: Submittal | null }>;
}

export const useSubmittalStore = create<SubmittalState>()((set, get) => ({
  submittals: [],
  approvals: {},
  loading: false,
  error: null,

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

  updateSubmittal: async (submittalId, updates) => {
    const { error } = await submittalService.updateSubmittal(submittalId, updates);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) =>
          sub.id === submittalId ? { ...sub, ...updates } : sub,
        ),
      }));
    }
    return { error };
  },

  transitionStatus: async (submittalId, status) => {
    const { error } = await submittalService.transitionStatus(submittalId, status);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) =>
          sub.id === submittalId ? { ...sub, status } : sub,
        ),
      }));
    }
    return { error };
  },

  // Backward compat shim — delegates to transitionStatus
  updateSubmittalStatus: async (submittalId, status) => {
    return get().transitionStatus(submittalId, status);
  },

  loadApprovals: async (submittalId) => {
    const { data, error } = await submittalService.loadApprovals(submittalId);
    if (!error && data) {
      set((s) => ({
        approvals: { ...s.approvals, [submittalId]: data },
      }));
    }
  },

  addApproval: async (submittalId, stamp, comments) => {
    if (!stamp) return { error: 'stamp is required' };
    const { error } = await submittalService.addApproval(
      submittalId,
      stamp as 'approved' | 'approved_as_noted' | 'rejected' | 'revise_and_resubmit',
      comments,
    );
    if (!error) {
      await get().loadApprovals(submittalId);
      // Reload to pick up server-resolved status change
      const { data: updated } = await submittalService.loadSubmittals(
        get().submittals.find((s) => s.id === submittalId)?.project_id ?? '',
      );
      if (updated) {
        set({ submittals: updated });
      }
    }
    return { error };
  },

  deleteSubmittal: async (submittalId) => {
    const { error } = await submittalService.deleteSubmittal(submittalId);
    if (!error) {
      // Remove from local state — soft-deleted records are filtered server-side
      set((s) => ({
        submittals: s.submittals.filter((sub) => sub.id !== submittalId),
      }));
    }
    return { error };
  },

  createRevision: async (parentSubmittalId) => {
    const { data, error } = await submittalService.createRevision(parentSubmittalId);
    if (error) return { error, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
    }
    return { error: null, submittal: data };
  },
}));
