import { create } from 'zustand';
import { submittalService } from '../services/submittalService';
import type { Submittal } from '../types/database';
import type { SubmittalState } from '../machines/submittalMachine';
import type { CreateSubmittalInput } from '../services/submittalService';

interface SubmittalStoreState {
  submittals: Submittal[];
  approvals: Record<string, Record<string, unknown>[]>;
  loading: boolean;
  error: string | null;

  loadSubmittals: (projectId: string) => Promise<void>;
  createSubmittal: (input: CreateSubmittalInput) => Promise<{ error: string | null; submittal: Submittal | null }>;
  updateSubmittal: (submittalId: string, updates: Partial<Submittal>) => Promise<{ error: string | null }>;
  transitionStatus: (submittalId: string, status: SubmittalState) => Promise<{ error: string | null }>;
  /** @deprecated Use transitionStatus instead */
  updateSubmittalStatus: (submittalId: string, status: SubmittalState) => Promise<{ error: string | null }>;
  loadApprovals: (submittalId: string) => Promise<void>;
  recordApproval: (
    submittalId: string,
    stamp: 'approved' | 'approved_as_noted' | 'rejected' | 'revise_and_resubmit',
    comments?: string,
  ) => Promise<{ error: string | null }>;
  deleteSubmittal: (submittalId: string) => Promise<{ error: string | null }>;
}

export const useSubmittalStore = create<SubmittalStoreState>()((set, get) => ({
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

  recordApproval: async (submittalId, stamp, comments) => {
    const { error } = await submittalService.recordApproval(submittalId, stamp, comments);
    if (!error) {
      await get().loadApprovals(submittalId);
      // Refresh the submittal to pick up status and approved_date changes
      const { data } = await submittalService.loadSubmittals(
        // We only have submittalId here; re-fetch from local state project_id
        get().submittals.find((s) => s.id === submittalId)?.project_id ?? '',
      );
      if (data) {
        set({ submittals: data });
      }
    }
    return { error };
  },

  deleteSubmittal: async (submittalId) => {
    const { error } = await submittalService.deleteSubmittal(submittalId);
    if (!error) {
      set((s) => ({ submittals: s.submittals.filter((sub) => sub.id !== submittalId) }));
    }
    return { error };
  },
}));
