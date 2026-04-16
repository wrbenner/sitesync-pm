// MIGRATED to entityStore — see src/stores/entityStore.ts
// This file is kept for backward-compatibility; all imports continue to work.
import { create } from 'zustand';
import { rfiService } from '../services/rfiService';
import type { ServiceError } from '../services/errors';
import type { RFI, RFIResponse, RfiStatus } from '../types/database';
import type { CreateRfiInput } from '../services/rfiService';
import { useEntityStore, useEntityActions, useEntityStoreRoot } from './entityStore';

// ── Re-exports of generic entity hooks ────────────────────────────────────────
// New code should prefer useEntityStore("rfis") and useEntityActions("rfis").

export { useEntityStore as useRfiEntityStore, useEntityActions as useRfiEntityActions };

// ── Legacy store (backward-compat shim) ───────────────────────────────────────
// Keeps the exact same shape so every existing import continues to compile
// and behave correctly. Generic CRUD is delegated to entityStore where possible;
// RFI-specific logic (service calls, transitionStatus, responses) stays here.

interface RfiState {
  rfis: RFI[];
  responses: Record<string, RFIResponse[]>;
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  loadRfis: (projectId: string) => Promise<void>;
  createRfi: (rfi: CreateRfiInput) => Promise<{ error: string | null; rfi: RFI | null }>;
  updateRfi: (rfiId: string, updates: Partial<RFI>) => Promise<{ error: string | null }>;
  transitionStatus: (rfiId: string, status: RfiStatus) => Promise<{ error: string | null }>;
  /** @deprecated Use transitionStatus instead */
  updateRfiStatus: (rfiId: string, status: RfiStatus) => Promise<{ error: string | null }>;
  loadResponses: (rfiId: string) => Promise<void>;
  addResponse: (rfiId: string, text: string, attachments?: string[]) => Promise<{ error: string | null }>;
  deleteRfi: (rfiId: string) => Promise<{ error: string | null }>;
  clearError: () => void;
}

export const useRfiStore = create<RfiState>()((set, get) => ({
  rfis: [],
  responses: {},
  loading: false,
  error: null,
  errorDetails: null,

  loadRfis: async (projectId) => {
    // Mirror into entityStore so new code reading useEntityStore("rfis") stays in sync
    useEntityStoreRoot.getState().initSlice('rfis');
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await rfiService.loadRfis(projectId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
      useEntityStoreRoot.getState()._setSlice('rfis', { error: error.userMessage, loading: false });
    } else {
      const items = data ?? [];
      set({ rfis: items, loading: false });
      useEntityStoreRoot.getState()._setSlice('rfis', { items, loading: false, error: null });
    }
  },

  createRfi: async (input) => {
    const { data, error } = await rfiService.createRfi(input);
    if (error) return { error: error.userMessage, rfi: null };
    if (data) {
      set((s) => ({ rfis: [data, ...s.rfis] }));
      // Mirror into entityStore
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          rfis: {
            ...s.slices['rfis'],
            items: [data, ...(s.slices['rfis']?.items ?? [])],
          },
        },
      }));
    }
    return { error: null, rfi: data };
  },

  updateRfi: async (rfiId, updates) => {
    const { error } = await rfiService.updateRfi(rfiId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, ...updates } : r)),
    }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        rfis: {
          ...s.slices['rfis'],
          items: (s.slices['rfis']?.items ?? []).map((r) =>
            r.id === rfiId ? { ...r, ...updates } : r,
          ),
        },
      },
    }));
    return { error: null };
  },

  transitionStatus: async (rfiId, status) => {
    const { error } = await rfiService.transitionStatus(rfiId, status);
    if (error) return { error: error.userMessage };
    set((s) => ({
      rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, status } : r)),
    }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        rfis: {
          ...s.slices['rfis'],
          items: (s.slices['rfis']?.items ?? []).map((r) =>
            r.id === rfiId ? { ...r, status } : r,
          ),
        },
      },
    }));
    return { error: null };
  },

  updateRfiStatus: async (rfiId, status) => {
    return get().transitionStatus(rfiId, status);
  },

  loadResponses: async (rfiId) => {
    const { data, error } = await rfiService.loadResponses(rfiId);
    if (!error && data) {
      set((s) => ({
        responses: { ...s.responses, [rfiId]: data },
      }));
    }
  },

  addResponse: async (rfiId, text, attachments) => {
    const { error } = await rfiService.addResponse(rfiId, text, attachments);
    if (error) return { error: error.userMessage };
    await get().loadResponses(rfiId);
    set((s) => ({
      rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, status: 'answered' as RfiStatus } : r)),
    }));
    return { error: null };
  },

  deleteRfi: async (rfiId) => {
    const { error } = await rfiService.deleteRfi(rfiId);
    if (error) return { error: error.userMessage }; 
    set((s) => ({ rfis: s.rfis.filter((r) => r.id !== rfiId) }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        rfis: {
          ...s.slices['rfis'],
          items: (s.slices['rfis']?.items ?? []).filter((r) => r.id !== rfiId),
        },
      },
    }));
    return { error: null };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
