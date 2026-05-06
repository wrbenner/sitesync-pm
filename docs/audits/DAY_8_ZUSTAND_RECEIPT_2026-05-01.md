# Day 8 — Zustand Consolidation Receipt

**Date:** 2026-05-01
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## Summary

Day 8 ended with the store count down from **33 to 16** — a **52% reduction** in
12 hours of focused work across Days 6–8. Day 8's specific contribution: 14 dead
stores deleted, 1 store merged into uiStore, 2 deprecation shims removed.

**LOC removed today:** ~2,150
**Files removed today:** 17
**Consumer files updated today:** 4

---

## Concrete Deltas

### 1. Group A dead-store sweep (14 files, 1,952 LOC)

Verified zero external importers via `grep` against every file path pattern in
src/. Only mentions found were docstring comments inside `entityStore.ts`.

Deleted:

| Store | LOC | Notes |
|---|---|---|
| activityStore.ts | 70 | Activity feed; page already removed |
| changeOrderStore.ts | 89 | Migrated to entityStore + RQ |
| dailyLogStore.ts | 154 | Migrated to React Query directly |
| directoryStore.ts | 107 | Migrated to entityStore |
| documentStore.ts | 164 | Migrated to React Query |
| drawingStore.ts | 271 | Migrated to React Query |
| fieldCaptureStore.ts | 78 | Migrated to React Query |
| fileStore.ts | 242 | Migrated to React Query |
| lienWaiverStore.ts | 94 | Migrated to React Query |
| punchItemStore.ts | 170 | Migrated to entityStore |
| rfiStore.ts | 160 | Migrated to entityStore |
| sovStore.ts | 87 | Migrated to React Query |
| teamStore.ts | 126 | Migrated to projectStore |
| userStore.ts | 140 | Migrated to authStore |

The original plan listed 15 dead stores including the old `projectStore.ts`,
which was already replaced in Day 7 by the renamed `projectContextStore`. So
14 deletions is the correct count.

### 2. notificationStore → uiStore merge (~105 LOC saved)

`notificationStore.ts` was a fully-formed Zustand store with notifications[],
unreadCount, a Supabase realtime subscription, and 6 actions. All of it was
moved into `uiStore.ts` as a notification slice (state + actions appended,
existing toast/theme/sidebar slices untouched).

**Consumers updated (4 sites across 3 files):**

| File | Change |
|---|---|
| src/components/layout/MobileLayout.tsx | `useNotificationStore` → `useUiStore` |
| src/lib/notifications.ts | `useNotificationStore.getState()` → `useUiStore.getState()` |
| src/lib/aiPrompts.ts | Same — getState() pattern |

**Channel rename:** `_realtimeChannel` → `_notificationChannel` to disambiguate
from any future channel slices (e.g., presence, document lock).

### 3. Deprecation-shim removal

| Shim | LOC | Live consumers | Action |
|---|---|---|---|
| organizationStore.ts | 35 | 0 | Deleted |
| projectContextStore.ts | 14 | 0 | Deleted |

Walker had already migrated all consumers during Day 7. The shims were the
final cleanup step.

### 4. src/stores/index.ts updated

Removed `useNotificationStore` export. The file now exposes:

```ts
useAuthStore, useProjectStore, useUiStore         // primary 3
useAIAnnotationStore, useCopilotStore             // AI (Day 9 → aiStore)
useSubmittalStore, usePunchListStore, useCrewStore  // entity (already hybrid)
useScheduleStore                                   // Day 10 → useSchedule hook
useEntityStoreRoot, useEntityStore, useEntityActions
usePresenceStore
```

---

## Verification

| Check | Method | Result |
|---|---|---|
| Dead stores have zero importers | `grep -r` for each store name across src/ | ✓ Clean |
| Notification consumers updated | `grep` post-edit for `useNotificationStore` | ✓ Only docstring mentions remain |
| Shim consumers updated | `grep` for `useOrganizationStore` and `useProjectContext` | ✓ Zero hits |
| TypeScript compile | `tsc --noEmit -p tsconfig.app.json` | ⚠ Did not complete in 45s sandbox window. **Walker: please run `npm run typecheck` locally to confirm.** |

---

## Store Count Trajectory

```
Day 0 (start of project):   ~33 stores (Zustand sprawl)
Day 6 (pre-deletion):       33 stores
Day 7 (auth+org merge):     32 stores (organizationStore became shim)
Day 7 (projectContext):     31 stores (projectContextStore became shim)
Day 8 (this session):       16 stores
Target (Day 12):             5 stores
```

**Remaining 16 stores:**

Primary 3 (final state): `authStore`, `projectStore`, `uiStore`
Generic backbone: `entityStore` (singleton)
Schedule: `scheduleStore` (RQ wrapper, not really Zustand)
Presence: `presenceStore` (real-time, keep separate)
Specialty: `digitalTwinStore` (behind feature flag)
**To merge in Day 9–10 (10 stores):**
  - AI: `copilotStore`, `agentOrchestrator`, `irisDraftStore`, `streamStore`, `aiAnnotationStore` → `aiStore`
  - Entity hybrids: `submittalStore`, `punchListStore`, `crewStore`, `equipmentStore` (already dual-write to entityStore — convert consumers to use entityStore directly, then delete)

---

## What I Did NOT Do (and Why)

### Group B → entityStore migration (deferred)

The 4 Group B stores (`submittalStore`, `punchListStore`, `crewStore`,
`equipmentStore`) all already dual-write to `entityStore` on every action.
But they ALSO have specialized actions that don't fit the generic CRUD shape:

- `submittalStore.transitionStatus()` (state machine wrapper)
- `submittalStore.addApproval()` (bridges to approval table)
- `submittalStore.createRevision()` (clones with parent_id)
- Similar specialized actions in punchList/crew/equipment

The right architectural move is to either:
1. Move specialized logic into a service layer (`src/services/*Service.ts`
   already exists — `submittalService` handles `transitionStatus`/`addApproval`).
   Migrate consumers to call `entityStore` for state + `submittalService` for
   verbs. Then delete the legacy store.
2. Or extend `entityStore` to support per-slice custom actions (heavier change).

Both are bigger than a Day 8 task and need typecheck working in CI to land
safely. Recommendation: **Day 9 → option 1**, one entity at a time, starting
with `crewStore` (smallest, 1 consumer).

### Group C → aiStore merge (deferred)

5 AI stores totaling ~1,090 LOC. Total consumer count: 24 files, dominated by
`copilotStore` (17 consumers including App.tsx). This is a Day 9 unification:
design `aiStore` first (it's larger than `uiStore` was), then migrate slices
one at a time.

---

## Day 9 Plan (concrete next steps)

In order of safety:

1. **Run `npm run typecheck` locally** to confirm Day 8 deletions and merges
   compile clean. If anything breaks, the most likely culprit is the
   `notificationStore` → `uiStore` merge (channel rename or import path miss).
2. **Convert `crewStore` consumers to use `entityStore('crews')` + `crewService`.**
   Smallest blast radius (1 consumer: `src/pages/Crews.tsx`).
3. **Same for `equipmentStore`** (1 consumer: `src/pages/Equipment.tsx`).
4. **Same for `submittalStore`** (1 consumer: `CreateSubmittalForm.tsx`).
5. **Same for `punchListStore`** (2 consumers: page + test).
6. After all four facades are gone, store count = 12.
7. Begin `aiStore` design — sketch the slice shape, decide whether to merge
   `copilotStore` first or last. (Last is safer — let the smaller stores
   prove the pattern.)

---

## Related Artifacts

- `docs/audits/STORE_CONSOLIDATION_PLAN_2026-05-01.md` — Day 6 design doc
- `docs/audits/PERMISSION_GATE_AUDIT_2026-05-01.md` — Day 1 audit
- `docs/audits/STUB_PAGE_AUDIT_2026-05-01.md` — Day 5 stub-page audit
- `SiteSync_90_Day_Tracker.xlsx` — rows 6, 7, 8 marked ✓ with receipt notes
- `zustand-consolidation-SKILL.md` — the migration pattern formalized in
  Day 7 and applied here

---

## One Number to Watch

**Stores remaining: 16** (target by Day 12: 5)
**Velocity required to hit target:** 11 stores in 4 days = 2.75/day average.
Achievable if Days 9–11 hit Group B (4 stores) and Group C (5 stores).
Day 12 then verifies + ships the merge.
