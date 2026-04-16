// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { rfiService } from '../services/rfiService';
import type { ServiceError } from '../services/errors';
import type { RFI, RFIResponse, RfiStatus } from '../types/database';
import type { CreateRfiInput } from '../services/rfiService';

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
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await rfiService.loadRfis(projectId);
    if (error) {
      // Preserve existing rfis so UI stays populated on transient errors
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ rfis: data ?? [], loading: false });
    }
  },

  createRfi: async (input) => {
    const { data, error } = await rfiService.createRfi(input);
    if (error) return { error: error.userMessage, rfi: null };
    if (data) {
      set((s) => ({ rfis: [data, ...s.rfis] }));
    }
    return { error: null, rfi: data };
  },

  updateRfi: async (rfiId, updates) => {
    const { error } = await rfiService.updateRfi(rfiId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, ...updates } : r)),
    }));
    return { error: null };
  },

  transitionStatus: async (rfiId, status) => {
    const { error } = await rfiService.transitionStatus(rfiId, status);
    if (error) return { error: error.userMessage };
    set((s) => ({
      rfis: s.rfis.map((r) => (r.id === rfiId ? { ...r, status } : r)),
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
    return { error: null };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
