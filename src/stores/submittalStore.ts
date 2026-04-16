// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { submittalService } from '../services/submittalService';
import type { ServiceError } from '../services/errors';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type { SubmittalStatus, SubmittalReviewer, CreateSubmittalInput } from '../types/submittal';

interface SubmittalState {
  submittals: Submittal[];
  approvals: Record<string, SubmittalReviewer[]>;
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

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
  clearError: () => void;
}

export const useSubmittalStore = create<SubmittalState>()((set, get) => ({
  submittals: [],
  approvals: {},
  loading: false,
  error: null,
  errorDetails: null,

  loadSubmittals: async (projectId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await submittalService.loadSubmittals(projectId);
    if (error) {
      // Preserve existing submittals so UI stays populated on transient errors
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ submittals: data ?? [], loading: false });
    }
  },

  createSubmittal: async (input) => {
    const { data, error } = await submittalService.createSubmittal(input);
    if (error) return { error: error.userMessage, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
    }
    return { error: null, submittal: data };
  },

  updateSubmittal: async (submittalId, updates) => {
    const { error } = await submittalService.updateSubmittal(submittalId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      submittals: s.submittals.map((sub) =>
        sub.id === submittalId ? { ...sub, ...updates } : sub,
      ),
    }));
    return { error: null };
  },

  transitionStatus: async (submittalId, status) => {
    const { error } = await submittalService.transitionStatus(submittalId, status);
    if (error) return { error: error.userMessage };
    set((s) => ({
      submittals: s.submittals.map((sub) =>
        sub.id === submittalId ? { ...sub, status } : sub,
      ),
    }));
    return { error: null };
  },

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
    return { error: error?.userMessage ?? null };
  },

  deleteSubmittal: async (submittalId) => {
    const { error } = await submittalService.deleteSubmittal(submittalId);
    if (error) return { error: error.userMessage };
    set((s) => ({
      submittals: s.submittals.filter((sub) => sub.id !== submittalId),
    }));
    return { error: null };
  },

  createRevision: async (parentSubmittalId) => {
    const { data, error } = await submittalService.createRevision(parentSubmittalId);
    if (error) return { error: error.userMessage, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
    }
    return { error: null, submittal: data };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
