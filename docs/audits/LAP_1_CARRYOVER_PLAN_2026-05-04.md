# Lap 1 Carryover Plan

**Date:** 2026-05-04
**Status:** Decisions made + day allocations explicit. Sister doc: `ADR_009_STATE_MACHINE_WIRING_DESCOPED_2026-05-04.md`.
**Purpose:** Resolve the three items the Day 30 receipt deferred to Lap 2. Without this, they silently slip or silently land mid-pilot.

---

## The three items

From `DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` § "What's deferred":

1. **Drawer-gate runs against real seed.** Acceptance Gate #2 (audit-row drawer ≤ 800ms) currently skips in CI because the vite-preview build has no real Supabase backend.
2. **Defer Dexie / offlineDb.** Would shave another ~32 KB off the cold path, bringing eager bundle to ~550 KB.
3. **Day 20–24 state-machine wiring.** The 15 XState machines are still consumed as pure helpers, not via `useMachine()`.

---

## Item 1 — Drawer-gate seed

### Decision: **DO IT IN LAP 2. Schedule: Day 31 morning, before scheduled-insights work begins. Owner: Walker (4-hour task).**

### Why now

The drawer-gate seed work is a **2–4 hour task** plus a CI secret. Doing it during pre-flight or Day 31 morning costs nothing the rest of Lap 2 needs, and it closes the third Lap 1 gate honestly. Letting it sit is a "we passed Lap 1" with an asterisk forever.

### Pilot safety: SAFE

This is staging-only work. The CI workflow runs against a staging Supabase project; nothing about the pilot environment changes. Zero risk to the soft pilot.

### Plan

1. Create a dedicated staging Supabase project for the gate (or reuse existing if isolation is OK)
2. Seed it with 100+ audit rows via a fixture script
3. Add `STAGING_DB_URL` + `STAGING_SERVICE_ROLE_KEY` as repo secrets (the same secrets the Lap 2 acceptance workflow needs anyway)
4. Update `.github/workflows/lap-1-acceptance.yml` so the drawer test no longer skips when `process.env.CI` and the secrets are set
5. Verify the test runs and passes
6. Commit a 1-paragraph receipt that closes the Day 30 asterisk

### Deliverable

- Commit hash + 1-paragraph note in `docs/audits/DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` § "What's deferred" → strike-through with closure note
- The `lap-1-acceptance.yml` job runs all 3 gates on every PR

---

## Item 2 — Defer Dexie / offlineDb (~32 KB cold-path saving)

### Decision: **DEFER TO LAP 3. Allocate 2 days mid-Lap-3.**

### Why defer

This is a **real refactor**: the 789-line `offlineDb.ts` becomes async-init. The change touches every entity hook that imports `useOfflineStatus`. Risk surface is non-trivial — too non-trivial to ship during the pilot window.

The 32 KB cold-path saving is real but doesn't unlock anything in Lap 2:
- Bundle is at 580 KB / 600 KB target
- No metric in the Lap 2 gate measures bundle bytes
- The pilot user won't notice 32 KB of wire savings (the user is on the slab over LTE — first paint is dominated by network handshake, not by 32 KB)

### Pilot safety if attempted in Lap 2: UNSAFE

Touching every entity hook mid-pilot risks a regression on the slab. The pilot can't tolerate a "we shipped a fix overnight that broke daily logs."

### Lap 3 placement

Best fit: Lap 3 Day 73–74 (the post-pilot demo-rehearsal-block week). At that point the pilot is closed (Day 60), Iris executors are written (Days 62–64), and there's a window before the demo rehearsal that wants engineering work. 2 days for the refactor + 1 day for stabilization = land in Day 73–75.

### Trigger to revisit before Lap 3

If during Lap 2 we observe that `vendor-supabase` (currently 55 KB on cold path because of Dexie's transitive imports) actually drops below 30 KB through some other mechanism, this item becomes a no-op. Re-measure on Day 50.

---

## Item 3 — Day 20–24 state-machine wiring (15 machines via `useMachine()`)

### Decision: **DESCOPED. Ratified in `ADR_009_STATE_MACHINE_WIRING_DESCOPED_2026-05-04.md`.**

`STATE_MACHINE_INVENTORY_2026-05-03.md` already made the argument: the 15 machines work today as domain-model libraries (validators, status config, derived helpers). Wiring them through `useMachine()` is a substantial architectural change — the kind Lap 1 was supposed to remove, not add.

This isn't deferred to Lap 3. It's removed from the plan. If a future lap wants event-sourced UI (multi-user real-time state, animated transitions, optimistic UI with crash-safe rollback), that's the moment to take this on — one machine at a time tied to a real UX feature, starting with `agentStreamMachine` (the natural fit). Until then, the machines stay as domain libraries.

### What we DO keep from Days 25–26

The State-Machine Inventory recommended retaining two items as small, valuable Lap 1 work:
- **Day 25 — XState devtool in dev** (30 min) — `@xstate/inspect` mounted in dev mode. Lets developers see the existing machines light up while debugging. **Status: ALREADY SHIPPED in Lap 1 per Day 26 sweep receipt.** No carryover needed.
- **Day 26 — Friday gate sweep** (1–2 hr) — verify every `*Service.ts` mutation consults `getValidTransitions()`. **Status: SHIPPED — see `DAY_26_GATE_SWEEP_RECEIPT_2026-05-03.md`.**

Both Day 25 and 26 work shipped. Day 22–24 (the wiring) is the only piece descoped.

### Pilot safety: N/A

Descoping = no code change = zero risk.

---

## Summary table

| Item | Decision | Day | Pilot safety |
|---|---|---|---|
| Drawer-gate seed | Do in Lap 2 | Day 31 morning, 4 hr | SAFE |
| Defer Dexie | Defer to Lap 3 | Day 73–75 | UNSAFE if Lap 2 |
| State-machine wiring | DESCOPED | — | N/A |

---

## Action items before Lap 2 Day 31

- [ ] Walker reads + signs off on `ADR_009_STATE_MACHINE_WIRING_DESCOPED_2026-05-04.md`
- [ ] Walker provisions staging Supabase project for drawer-gate (or repurposes existing)
- [ ] Add `STAGING_DB_URL` + `STAGING_SERVICE_ROLE_KEY` repo secrets
- [ ] Update Lap 2 — Watch tracker row 31: prepend "Drawer-gate seed (4 hr) + scheduled-insights scaffold"
- [ ] Update INDEX.md: mark `STATE_MACHINE_INVENTORY_2026-05-03.md` row as "Descoped — see ADR-009"
- [ ] Annotate `DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` § "What's deferred" with closure status per item

---

## File-by-file changelog

| Path | Change |
|---|---|
| `docs/audits/ADR_009_STATE_MACHINE_WIRING_DESCOPED_2026-05-04.md` | NEW — ratification ADR |
| `docs/audits/DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` | EDIT — add closure annotations |
| `docs/audits/INDEX.md` | EDIT — mark inventory descoped, add this carryover plan, add ADR-009 |
| `SiteSync_90_Day_Tracker.xlsx` → "Lap 2 — Watch" row 31 | EDIT — prepend drawer-gate seed |
| `.github/workflows/lap-1-acceptance.yml` | EDIT (Day 31 task) — wire staging seed |
