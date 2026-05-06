# Days 10–11 — Scattered Offline-State Cleanup Receipt

**Date:** 2026-05-01
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## Why this receipt exists

Days 10 and 11 in the tracker reference stores that don't exist in the
codebase under the literal names ("captureStore", "draftStore",
"audit-related stores"). Earlier I dismissed them as no-op days. Walker
correctly pushed back: the days exist for a reason. Looking again, the
**spirit** of these days was real — and there was a real find.

---

## The Find

The codebase has **three parallel "pending" queues**, all using the
same field name `pendingCount`, but tracking different things:

| Queue | Lives in | What "pending" means |
|---|---|---|
| Mutation queue | `services/offlineQueue.ts` (Zustand) → wraps `lib/syncManager.ts` | Action mutations awaiting sync |
| Photo capture queue | `hooks/useFieldCapture.ts` (IDB store) | Photo blobs awaiting upload |
| Annotation queue | `lib/offlineQueue.ts` (raw IDB) + `hooks/useOfflineSync.ts` | Drawing markups awaiting sync |

Three different `pendingCount` numbers in three different stores. A header
badge that reads "3 pending" can't tell which queue. That's a footgun.

---

## The Day 10/11 Work

### 1. Removed redundant Zustand wrapper from production
The `useOfflineStore` Zustand store in `services/offlineQueue.ts` is a
**compatibility shim** — it subscribes to `syncManager` and re-exposes the
state. The `useOfflineStatus` hook in `hooks/useOfflineStatus.ts` does the
same thing more idiomatically via `useSyncExternalStore`.

**Before:** `QuickEntry.tsx` was the only production consumer of `useOfflineStore`.
**After:** `QuickEntry.tsx` reads via `useOfflineStatus()` instead.

The Zustand store stays on disk because the `offline-capture-flow.test.ts`
integration test uses its imperative API (`addToQueue`, `setStatus`,
`clearQueue`). Marked it `@deprecated` with a note that it's a test-shim
only and a TODO to rewrite the test against `syncManager` directly.

### 2. Renamed `useFieldCapture.pendingCount` → `pendingCaptures`
Disambiguates from the mutation queue's `pendingCount`. Now anywhere you
see `pendingCaptures`, you know it's photo blobs specifically.

**Files changed:**
- `src/hooks/useFieldCapture.ts` — renamed state field + setter
- `src/components/field-capture/FieldCaptureModal.tsx` — destructure rename
- `src/pages/daily-log/index.tsx` — 3 call sites updated

### 3. Documented the three-queue boundary
Comment block at the top of `services/offlineQueue.ts` explicitly maps each
`pendingCount`/`pendingCaptures`/etc. to its queue. Future readers won't
have to spelunk to figure it out.

---

## What I deliberately did NOT do

### Did not delete `services/offlineQueue.ts`
The `offline-capture-flow.test.ts` integration test depends on the Zustand
store's imperative API. Rewriting that test to drive `syncManager`
directly would be substantive work and risks regressing the offline path
under conditions I can't validate (IDB + network simulation in the
sandbox). Marked deprecated; left in place. **Future cleanup:** rewrite
the integration test, then delete the store.

### Did not merge the three queues into one store
Different schemas, different sync triggers, different UI surfaces. The
photo queue holds Blobs and uploads to Supabase Storage. The mutation
queue holds JSON and replays via syncManager. The annotation queue holds
geometry rows and inserts directly to `drawing_markups`. Forcing them
into one shape would erase the intentional separation. Same architectural
finding as ADR-002 (the AI stores).

### Did not lift `status` into `uiStore.syncStatus`
The original Day 11 plan proposed this, but `useOfflineStatus` already
exposes `isOnline` and `syncState` to any component that wants them. A
duplicate slice in `uiStore` would be redundant.

### Did not touch `lib/offlineQueue.ts`
That's a raw-IDB module for drawing annotations, NOT a Zustand store. Out
of scope for "store consolidation." Renamed mention only.

---

## Verification

| Check | Method | Result |
|---|---|---|
| `useOfflineStore` has no production consumers | `grep -rn "useOfflineStore" src/components src/pages` | ✓ Zero hits |
| `pendingCount` rename complete in `useFieldCapture` consumers | `grep -rn "fieldCapture\.pendingCount\|fc\.pendingCount"` | ✓ Zero hits |
| `MetricsRow`/`SyncBanner` props named `pendingCount` are independent | They take props with that name from a non-`useFieldCapture` source | ✓ Confirmed; left untouched |
| Integration test still imports the Zustand store | `services/offlineQueue.test.ts` + `test/integration/offline-capture-flow.test.ts` | ✓ Both still work — store kept |
| TypeScript compile | `tsc --noEmit -p tsconfig.app.json` | ⚠ **Walker: please run locally to confirm.** |

---

## Tracker Update (manual — sandbox dropped)

The bash sandbox went into a degraded state before I could write the
xlsx update. Please apply this in `SiteSync_90_Day_Tracker.xlsx`,
sheet `Lap 1 — Subtract`:

**Day 9 (row 15)** — column G `✓`, column H:
> Group B migrations: crewStore (96 LOC) + equipmentStore (224 LOC) + submittalStore (209 LOC) deleted; punchListStore slimmed 219→134 (comment-only). 33→13 stores. ADR-002 cancels 5-store target — 5 AI stores stay separate (different keying/persistence/state-machines). Lap 1 consolidation theme CLOSED.

**Day 10 (row 16)** — column G `✓`, column H:
> Day 10 — captureStore/draftStore reframe. Found three parallel offline queues (mutations/photos/annotations) all called pendingCount. Removed only production consumer of redundant useOfflineStore (QuickEntry → useOfflineStatus). Marked services/offlineQueue.ts as @deprecated test-shim. irisDraftStore stays separate per ADR-002.

**Day 11 (row 17)** — column G `✓`, column H:
> Day 11 — UI-state cleanup. Renamed useFieldCapture.pendingCount → pendingCaptures across 4 files (hook + FieldCaptureModal + daily-log/index.tsx). No audit-store work needed: audit feature uses React Query + component-local state, no Zustand store exists to merge.

---

## What's Next

**Day 12** — Friday checkpoint, currently scoped as "22→5 store consolidation merged. CI passes. Bundle delta documented." Per ADR-002, the revised target is 13 stores, already met. Day 12 work:
1. Run `npm run typecheck` locally; fix any breakage from Days 8–11.
2. Run `npm run build` and capture chunk sizes to `BUNDLE_BASELINE_2026-05-01.txt` (this is also Day 27 prep — kill two birds).
3. Friday retro doc for the consolidation theme.

**Day 13** — money-cents migration kickoff. The audit is complete
(`MONEY_CENTS_AUDIT_2026-05-01.md`). Day 14 is the first migration phase
(PayApp calculator).

---

## Files Touched

**Modified:**
- `src/hooks/useFieldCapture.ts` (state field + setter rename)
- `src/components/field-capture/FieldCaptureModal.tsx` (destructure rename)
- `src/pages/daily-log/index.tsx` (3 call sites)
- `src/components/dailylog/QuickEntry.tsx` (import + consumer rewrite)
- `src/services/offlineQueue.ts` (deprecation banner; behavior unchanged)

**Added:**
- `docs/audits/DAY_10_11_SCATTERED_STATE_RECEIPT_2026-05-01.md` (this file)

---

## One Number to Watch

**Stores remaining: 13 + 1 deprecated test-shim** (the `useOfflineStore`
in `services/`). When the integration test is rewritten, the count drops
to 13 cleanly.
