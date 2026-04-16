// MIGRATED to entityStore — see src/stores/entityStore.ts
// This file is kept for backward-compatibility; all imports continue to work.
import { create } from 'zustand';
import { submittalService } from '../services/submittalService';
import type { ServiceError } from '../services/errors';
import type { Submittal } from '../types/database';
import type { SubmittalApproval } from '../types/entities';
import type { SubmittalStatus, SubmittalReviewer, CreateSubmittalInput } from '../types/submittal';
import { useEntityActions, useEntityStoreRoot } from './entityStore';

// ── Re-exports of generic entity hooks ────────────────────────────────────────
// New code should prefer useEntityStore("submittals") and useEntityActions("submittals").

export { useEntityActions as useSubmittalEntityActions };

// ── Legacy store (backward-compat shim) ───────────────────────────────────────

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
    const actions = useEntityActions<Submittal>('submittals');
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await submittalService.loadSubmittals(projectId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
      useEntityStoreRoot.getState()._setSlice('submittals', { error: error.userMessage, loading: false });
    } else {
      const items = data ?? [];
      set({ submittals: items, loading: false });
      useEntityStoreRoot.getState()._setSlice('submittals', { items, loading: false, error: null });
    }
    void actions;
  },

  createSubmittal: async (input) => {
    const { data, error } = await submittalService.createSubmittal(input);
    if (error) return { error: error.userMessage, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          submittals: {
            ...s.slices['submittals'],
            items: [data, ...(s.slices['submittals']?.items ?? [])],
          },
        },
      }));
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
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        submittals: {
          ...s.slices['submittals'],
          items: (s.slices['submittals']?.items ?? []).map((sub) =>
            sub.id === submittalId ? { ...sub, ...updates } : sub,
          ),
        },
      },
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
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        submittals: {
          ...s.slices['submittals'],
          items: (s.slices['submittals']?.items ?? []).map((sub) =>
            sub.id === submittalId ? { ...sub, status } : sub,
          ),
        },
      },
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
        useEntityStoreRoot.getState()._setSlice('submittals', { items: updated });
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
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        submittals: {
          ...s.slices['submittals'],
          items: (s.slices['submittals']?.items ?? []).filter((sub) => sub.id !== submittalId),
        },
      },
    }));
    return { error: null };
  },

  createRevision: async (parentSubmittalId) => {
    const { data, error } = await submittalService.createRevision(parentSubmittalId);
    if (error) return { error: error.userMessage, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          submittals: {
            ...s.slices['submittals'],
            items: [data, ...(s.slices['submittals']?.items ?? [])],
          },
        },
      }));
    }
    return { error: null, submittal: data };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
