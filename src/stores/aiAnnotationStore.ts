import { create } from 'zustand';

interface AIAnnotationState {
  dismissedAnnotations: Set<string>;
  dismissedAlerts: Set<string>;
  snoozedAlerts: Map<string, number>; // id -> snooze until timestamp
  contextPanelOpen: boolean;

  dismissAnnotation: (id: string) => void;
  dismissAlert: (id: string) => void;
  snoozeAlert: (id: string, durationMs: number) => void;
  isAlertSnoozed: (id: string) => boolean;
  toggleContextPanel: () => void;
  setContextPanelOpen: (open: boolean) => void;
}

export const useAIAnnotationStore = create<AIAnnotationState>((set, get) => ({
  dismissedAnnotations: new Set(),
  dismissedAlerts: new Set(),
  snoozedAlerts: new Map(),
  contextPanelOpen: false,

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
}));
