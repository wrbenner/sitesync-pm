// ─── Primary stores (target: 5 after Day 7–10 consolidation) ───────────────
export { useAuthStore } from './authStore';
export { useProjectStore } from './projectStore';
export { useUiStore } from './uiStore';

// ─── AI / Copilot (Day 9 → aiStore) ───────────────────────────────────────
export { useAIAnnotationStore } from './aiAnnotationStore';
export { useCopilotStore } from './copilotStore';

// ─── Entity stores (Day 8–9 → entityStore migration targets) ──────────────
export { usePunchListStore } from './punchListStore';

// ─── Schedule (Day 10 → useSchedule custom hook) ──────────────────────────
export { useScheduleStore } from './scheduleStore';

// ─── Infrastructure / shared ──────────────────────────────────────────────
export { useEntityStoreRoot, useEntityStore, useEntityActions } from './entityStore';
export { usePresenceStore } from './presenceStore';
