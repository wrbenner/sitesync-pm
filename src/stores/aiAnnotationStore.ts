import { create } from 'zustand';
import { supabase, fromTable } from '../lib/supabase';
import { AnnotationHistory, type AnnotationShape } from '../components/drawings/AnnotationHistory';
import type { AnnotationTool } from '../components/drawings/AnnotationCanvas';

import { fromTable } from '../lib/db/queries'

export type { AnnotationShape } from '../components/drawings/AnnotationHistory';
export type { AnnotationTool } from '../components/drawings/AnnotationCanvas';

interface DrawingMarkupRow {
  id: string;
  drawing_id: string;
  project_id: string;
  layer: string | null;
  type: string | null;
  data: Record<string, unknown> | null;
  note: string | null;
  linked_rfi_id: string | null;
  linked_punch_item_id: string | null;
  created_by: string | null;
  created_at: string | null;
  annotation_type: string | null;
  coordinates: Record<string, unknown> | null;
  color: string | null;
  page_number: number | null;
}

const VALID_TYPES: ReadonlyArray<AnnotationShape['type']> = [
  'rectangle',
  'text',
  'polygon',
  'pin',
  'measure',
  'highlight',
  'draw',
];

const isValidType = (t: string | null | undefined): t is AnnotationShape['type'] => {
  return !!t && (VALID_TYPES as ReadonlyArray<string>).includes(t);
};

interface AIAnnotationState {
  // Legacy ephemeral UI flags (preserved for backwards compatibility)
  dismissedAnnotations: Set<string>;
  dismissedAlerts: Set<string>;
  snoozedAlerts: Map<string, number>;
  contextPanelOpen: boolean;

  // Annotation engine state
  annotations: AnnotationShape[];
  selectedAnnotationId: string | null;
  activeTool: AnnotationTool;
  activeColor: string;
  history: AnnotationHistory;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Legacy methods
  dismissAnnotation: (id: string) => void;
  dismissAlert: (id: string) => void;
  snoozeAlert: (id: string, durationMs: number) => void;
  isAlertSnoozed: (id: string) => boolean;
  toggleContextPanel: () => void;
  setContextPanelOpen: (open: boolean) => void;

  // Annotation engine methods
  addAnnotation: (a: AnnotationShape) => void;
  updateAnnotation: (id: string, updates: Partial<AnnotationShape>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  setTool: (tool: AnnotationTool) => void;
  setColor: (color: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearAnnotations: () => void;
  saveToSupabase: (drawingId: string, projectId: string) => Promise<void>;
  loadFromSupabase: (drawingId: string) => Promise<void>;
}

export const useAIAnnotationStore = create<AIAnnotationState>((set, get) => ({
  // Legacy state
  dismissedAnnotations: new Set(),
  dismissedAlerts: new Set(),
  snoozedAlerts: new Map(),
  contextPanelOpen: false,

  // Annotation engine state
  annotations: [],
  selectedAnnotationId: null,
  activeTool: 'select',
  activeColor: '#F47820',
  history: new AnnotationHistory(),
  isLoading: false,
  isSaving: false,
  error: null,

  // Legacy methods
  dismissAnnotation: (id) =>
    set((s) => {
      const next = new Set(s.dismissedAnnotations);
      next.add(id);
      return { dismissedAnnotations: next };
    }),

  dismissAlert: (id) =>
    set((s) => {
      const next = new Set(s.dismissedAlerts);
      next.add(id);
      return { dismissedAlerts: next };
    }),

  snoozeAlert: (id, durationMs) =>
    set((s) => {
      const next = new Map(s.snoozedAlerts);
      next.set(id, Date.now() + durationMs);
      const dismissed = new Set(s.dismissedAlerts);
      dismissed.add(id);
      return { snoozedAlerts: next, dismissedAlerts: dismissed };
    }),

  isAlertSnoozed: (id) => {
    const until = get().snoozedAlerts.get(id);
    if (!until) return false;
    return Date.now() < until;
  },

  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
  setContextPanelOpen: (open) => set({ contextPanelOpen: open }),

  // Annotation engine methods
  addAnnotation: (a) => {
    const { annotations, history } = get();
    const next = [...annotations, a];
    history.push(next);
    set({ annotations: next });
  },

  updateAnnotation: (id, updates) => {
    const { annotations, history } = get();
    const next = annotations.map((a) => (a.id === id ? { ...a, ...updates } : a));
    history.push(next);
    set({ annotations: next });
  },

  deleteAnnotation: (id) => {
    const { annotations, history, selectedAnnotationId } = get();
    const next = annotations.filter((a) => a.id !== id);
    history.push(next);
    set({
      annotations: next,
      selectedAnnotationId: selectedAnnotationId === id ? null : selectedAnnotationId,
    });
  },

  selectAnnotation: (id) => set({ selectedAnnotationId: id }),
  setTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set({ activeColor: color }),

  undo: () => {
    const { history } = get();
    const prev = history.undo();
    if (prev) set({ annotations: prev });
  },

  redo: () => {
    const { history } = get();
    const next = history.redo();
    if (next) set({ annotations: next });
  },

  canUndo: () => get().history.canUndo,
  canRedo: () => get().history.canRedo,

  clearAnnotations: () => {
    const history = new AnnotationHistory();
    history.push([]);
    set({ annotations: [], selectedAnnotationId: null, history });
  },

  saveToSupabase: async (drawingId, projectId) => {
    set({ isSaving: true, error: null });
    try {
      const { annotations } = get();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const markupTable = fromTable('drawing_markups') as unknown as {
        delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> };
        insert: (rows: Array<Record<string, unknown>>) => Promise<{ error: Error | null }>;
      };

      const del = await markupTable.delete().eq('drawing_id', drawingId);
      if (del.error) throw del.error;

      if (annotations.length === 0) {
        set({ isSaving: false });
        return;
      }

      const rows: Array<Record<string, unknown>> = annotations.map((a) => ({
        drawing_id: drawingId,
        project_id: projectId,
        layer: 'personal',
        type: mapToDbType(a.type),
        data: { shape: a },
        annotation_type: a.type,
        coordinates: a.coordinates,
        color: a.color,
        page_number: a.pageNumber,
        note: a.text ?? null,
        linked_rfi_id: a.linkedRfiId ?? null,
        linked_punch_item_id: a.linkedPunchItemId ?? null,
        created_by: userId ?? null,
      }));

      const ins = await markupTable.insert(rows);
      if (ins.error) throw ins.error;
      set({ isSaving: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save annotations';
      set({ isSaving: false, error: msg });
      throw err;
    }
  },

  loadFromSupabase: async (drawingId) => {
    set({ isLoading: true, error: null });
    try {
      const markupTable = fromTable('drawing_markups') as unknown as {
        select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: DrawingMarkupRow[] | null; error: Error | null }> };
      };

      const { data, error } = await markupTable.select('*').eq('drawing_id', drawingId);
      if (error) throw error;

      const shapes: AnnotationShape[] = (data || []).map((row: DrawingMarkupRow) => {
        const storedData = row.data;
        const storedShape =
          storedData && typeof storedData === 'object' && 'shape' in storedData
            ? (storedData as { shape?: AnnotationShape }).shape
            : undefined;
        if (storedShape && storedShape.id) return storedShape;

        const typeValue = row.annotation_type ?? row.type;
        const safeType: AnnotationShape['type'] = isValidType(typeValue) ? typeValue : 'pin';

        const coords: AnnotationShape['coordinates'] =
          row.coordinates && typeof row.coordinates === 'object'
            ? (row.coordinates as AnnotationShape['coordinates'])
            : { x: 0, y: 0 };

        return {
          id: row.id,
          type: safeType,
          coordinates: coords,
          color: row.color || '#F47820',
          text: row.note ?? undefined,
          pageNumber: row.page_number ?? 1,
          createdBy: row.created_by ?? 'unknown',
          createdAt: row.created_at ?? new Date().toISOString(),
          linkedRfiId: row.linked_rfi_id ?? undefined,
          linkedPunchItemId: row.linked_punch_item_id ?? undefined,
        };
      });

      const history = new AnnotationHistory();
      history.push(shapes);
      set({ annotations: shapes, history, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load annotations';
      set({ isLoading: false, error: msg });
    }
  },
}));

function mapToDbType(t: AnnotationShape['type']): string {
  switch (t) {
    case 'pin': return 'pin';
    case 'text': return 'text';
    case 'highlight': return 'highlighter';
    case 'draw': return 'pen';
    case 'measure': return 'dimension';
    case 'rectangle': return 'shape';
    case 'polygon': return 'shape';
    default: return 'shape';
  }
}
