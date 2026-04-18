import { create } from 'zustand';
import { drawingService } from '../services/drawingService';
import { getNextStatus } from '../machines/drawingMachine';
import type { Drawing } from '../types/database';
import type {
  DrawingMarkup,
  DrawingVersion,
  DrawingStatus,
  CreateDrawingInput,
  CreateMarkupInput,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  UploadDrawingInput,
} from '../types/drawing';
import type { ServiceError } from '../services/errors';
import { useEntityStore, useEntityActions, useEntityStoreRoot } from './entityStore';

// ── Re-exports of generic entity hooks ────────────────────────────────────────
// New code should prefer useEntityStore("drawings") and useEntityActions("drawings").

export { useEntityStore as useDrawingEntityStore, useEntityActions as useDrawingEntityActions };

// ── Store ─────────────────────────────────────────────────────────────────────

interface DrawingState {
  drawings: Drawing[];
  markups: Record<string, DrawingMarkup[]>;
  versions: Record<string, DrawingVersion[]>;
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  loadDrawings: (projectId: string) => Promise<void>;
  uploadDrawing: (projectId: string, file: File, meta?: UploadDrawingInput) => Promise<{ drawing: Drawing | null; error: string | null }>;
  createDrawing: (input: CreateDrawingInput) => Promise<{ drawing: Drawing | null; error: string | null }>;
  transitionStatus: (drawingId: string, action: string) => Promise<{ error: string | null }>;
  updateDrawing: (drawingId: string, updates: Partial<Drawing>) => Promise<{ error: string | null }>;
  deleteDrawing: (drawingId: string) => Promise<{ error: string | null }>;
  loadMarkups: (drawingId: string) => Promise<void>;
  createMarkup: (input: CreateMarkupInput) => Promise<{ markup: DrawingMarkup | null; error: string | null }>;
  updateMarkup: (markupId: string, updates: Partial<Pick<DrawingMarkup, 'data' | 'note' | 'layer' | 'type'>>) => Promise<{ error: string | null }>;
  deleteMarkup: (markupId: string, drawingId: string) => Promise<{ error: string | null }>;
  addAnnotation: (input: CreateAnnotationInput) => Promise<{ annotation: DrawingMarkup | null; error: string | null }>;
  updateAnnotation: (annotationId: string, updates: UpdateAnnotationInput) => Promise<{ error: string | null }>;
  deleteAnnotation: (annotationId: string, drawingId: string) => Promise<{ error: string | null }>;
  getDrawingVersions: (drawingId: string) => Promise<{ versions: DrawingVersion[]; error: string | null }>;
  linkMarkupToRfi: (markupId: string, rfiId: string) => Promise<{ error: string | null }>;
  linkMarkupToPunchItem: (markupId: string, punchItemId: string) => Promise<{ error: string | null }>;
  unlinkMarkup: (markupId: string) => Promise<{ error: string | null }>;
  clearError: () => void;
}

export const useDrawingStore = create<DrawingState>()((set, get) => ({
  drawings: [],
  markups: {},
  versions: {},
  loading: false,
  error: null,
  errorDetails: null,

  loadDrawings: async (projectId) => {
    useEntityStoreRoot.getState().initSlice('drawings');
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await drawingService.loadDrawings(projectId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
      useEntityStoreRoot.getState()._setSlice('drawings', { error: error.userMessage, loading: false });
    } else {
      const items = data ?? [];
      set({ drawings: items, loading: false });
      useEntityStoreRoot.getState()._setSlice('drawings', { items, loading: false, error: null });
    }
  },

  uploadDrawing: async (projectId, file, meta) => {
    const { data, error } = await drawingService.uploadDrawing(projectId, file, meta);
    if (error) return { drawing: null, error: error.userMessage };
    if (data) {
      set((s) => ({ drawings: [data, ...s.drawings] }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          drawings: {
            ...s.slices['drawings'],
            items: [data, ...(s.slices['drawings']?.items ?? [])],
          },
        },
      }));
    }
    return { drawing: data, error: null };
  },

  createDrawing: async (input) => {
    const { data, error } = await drawingService.createDrawing(input);
    if (error) return { drawing: null, error: error.userMessage };
    if (data) {
      set((s) => ({ drawings: [data, ...s.drawings] }));
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          drawings: {
            ...s.slices['drawings'],
            items: [data, ...(s.slices['drawings']?.items ?? [])],
          },
        },
      }));
    }
    return { drawing: data, error: null };
  },

  transitionStatus: async (drawingId, action) => {
    const { error } = await drawingService.transitionStatus(drawingId, action);
    if (error) return { error: error.userMessage };

    // Compute the new status locally so we avoid an extra round-trip.
    set((s) => ({
      drawings: s.drawings.map((d) => {
        if (d.id !== drawingId) return d;
        const newStatus = getNextStatus(d.status as DrawingStatus, action);
        return newStatus ? { ...d, status: newStatus } : d;
      }),
    }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        drawings: {
          ...s.slices['drawings'],
          items: (s.slices['drawings']?.items ?? []).map((d) => {
            if (d.id !== drawingId) return d;
            const newStatus = getNextStatus(d['status'] as DrawingStatus, action);
            return newStatus ? { ...d, status: newStatus } : d;
          }),
        },
      },
    }));
    return { error: null };
  },

  updateDrawing: async (drawingId, updates) => {
    const previous = get().drawings;
    // Optimistic update
    set((s) => ({
      drawings: s.drawings.map((d) => (d.id === drawingId ? { ...d, ...updates } : d)),
    }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        drawings: {
          ...s.slices['drawings'],
          items: (s.slices['drawings']?.items ?? []).map((d) =>
            d.id === drawingId ? { ...d, ...updates } : d,
          ),
        },
      },
    }));

    const { error } = await drawingService.updateDrawing(drawingId, updates);
    if (error) {
      // Rollback
      set({ drawings: previous, error: error.userMessage, errorDetails: error });
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          drawings: { ...s.slices['drawings'], items: previous },
        },
      }));
      return { error: error.userMessage };
    }
    return { error: null };
  },

  deleteDrawing: async (drawingId) => {
    const previous = get().drawings;
    // Optimistic removal
    set((s) => ({ drawings: s.drawings.filter((d) => d.id !== drawingId) }));
    useEntityStoreRoot.setState((s) => ({
      slices: {
        ...s.slices,
        drawings: {
          ...s.slices['drawings'],
          items: (s.slices['drawings']?.items ?? []).filter((d) => d.id !== drawingId),
        },
      },
    }));

    const { error } = await drawingService.deleteDrawing(drawingId);
    if (error) {
      // Rollback
      set({ drawings: previous, error: error.userMessage, errorDetails: error });
      useEntityStoreRoot.setState((s) => ({
        slices: {
          ...s.slices,
          drawings: { ...s.slices['drawings'], items: previous },
        },
      }));
      return { error: error.userMessage };
    }
    return { error: null };
  },

  loadMarkups: async (drawingId) => {
    const { data, error } = await drawingService.loadMarkups(drawingId);
    if (!error && data) {
      set((s) => ({ markups: { ...s.markups, [drawingId]: data } }));
    }
  },

  createMarkup: async (input) => {
    const { data, error } = await drawingService.createMarkup(input);
    if (error) return { markup: null, error: error.userMessage };
    if (data) {
      set((s) => ({
        markups: {
          ...s.markups,
          [input.drawing_id]: [...(s.markups[input.drawing_id] ?? []), data],
        },
      }));
    }
    return { markup: data, error: null };
  },

  updateMarkup: async (markupId, updates) => {
    const { error } = await drawingService.updateMarkup(markupId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      markups: Object.fromEntries(
        Object.entries(s.markups).map(([drawingId, list]) => [
          drawingId,
          list.map((m) => (m.id === markupId ? { ...m, ...updates } : m)),
        ]),
      ),
    }));
    return { error: null };
  },

  deleteMarkup: async (markupId, drawingId) => {
    const previous = get().markups[drawingId] ?? [];
    // Optimistic removal
    set((s) => ({
      markups: {
        ...s.markups,
        [drawingId]: (s.markups[drawingId] ?? []).filter((m) => m.id !== markupId),
      },
    }));
    const { error } = await drawingService.deleteMarkup(markupId);
    if (error) {
      // Rollback
      set((s) => ({
        markups: { ...s.markups, [drawingId]: previous },
        error: error.userMessage,
        errorDetails: error,
      }));
      return { error: error.userMessage };
    }
    return { error: null };
  },

  linkMarkupToRfi: async (markupId, rfiId) => {
    const { error } = await drawingService.linkMarkupToRfi(markupId, rfiId);
    if (error) return { error: error.userMessage };
    set((s) => ({
      markups: Object.fromEntries(
        Object.entries(s.markups).map(([drawingId, list]) => [
          drawingId,
          list.map((m) => (m.id === markupId ? { ...m, linked_rfi_id: rfiId } : m)),
        ]),
      ),
    }));
    return { error: null };
  },

  linkMarkupToPunchItem: async (markupId, punchItemId) => {
    const { error } = await drawingService.linkMarkupToPunchItem(markupId, punchItemId);
    if (error) return { error: error.userMessage };
    set((s) => ({
      markups: Object.fromEntries(
        Object.entries(s.markups).map(([drawingId, list]) => [
          drawingId,
          list.map((m) => (m.id === markupId ? { ...m, linked_punch_item_id: punchItemId } : m)),
        ]),
      ),
    }));
    return { error: null };
  },

  unlinkMarkup: async (markupId) => {
    const { error } = await drawingService.unlinkMarkup(markupId);
    if (error) return { error: error.userMessage };
    set((s) => ({
      markups: Object.fromEntries(
        Object.entries(s.markups).map(([drawingId, list]) => [
          drawingId,
          list.map((m) =>
            m.id === markupId
              ? { ...m, linked_rfi_id: null, linked_punch_item_id: null }
              : m,
          ),
        ]),
      ),
    }));
    return { error: null };
  },

  addAnnotation: async (input) => {
    const { data, error } = await drawingService.addAnnotation(input);
    if (error) return { annotation: null, error: error.userMessage };
    if (data) {
      set((s) => ({
        markups: {
          ...s.markups,
          [input.drawing_id]: [...(s.markups[input.drawing_id] ?? []), data],
        },
      }));
    }
    return { annotation: data, error: null };
  },

  updateAnnotation: async (annotationId, updates) => {
    const { error } = await drawingService.updateAnnotation(annotationId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      markups: Object.fromEntries(
        Object.entries(s.markups).map(([drawingId, list]) => [
          drawingId,
          list.map((m) => (m.id === annotationId ? { ...m, ...updates } : m)),
        ]),
      ),
    }));
    return { error: null };
  },

  deleteAnnotation: async (annotationId, drawingId) => {
    const previous = get().markups[drawingId] ?? [];
    set((s) => ({
      markups: {
        ...s.markups,
        [drawingId]: (s.markups[drawingId] ?? []).filter((m) => m.id !== annotationId),
      },
    }));
    const { error } = await drawingService.deleteAnnotation(annotationId);
    if (error) {
      set((s) => ({
        markups: { ...s.markups, [drawingId]: previous },
        error: error.userMessage,
        errorDetails: error,
      }));
      return { error: error.userMessage };
    }
    return { error: null };
  },

  getDrawingVersions: async (drawingId) => {
    const { data, error } = await drawingService.getDrawingVersions(drawingId);
    if (error) return { versions: [], error: error.userMessage };
    const versions = data ?? [];
    set((s) => ({ versions: { ...s.versions, [drawingId]: versions } }));
    return { versions, error: null };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
