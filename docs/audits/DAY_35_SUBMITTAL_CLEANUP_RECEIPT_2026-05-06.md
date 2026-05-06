# Day 35 — Submittals P0 Cleanup + gc_review Machine Bug Receipt

**Date:** 2026-05-06
**Author:** Claude (acting under Walker)
**Lap:** 2 — Iris + Spec-driven Modules
**Owner of record:** Walker
**Spec:** `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` Part 13 ("Delete in P0") + Part 4 (state-machine chart)
**Companion:** `SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md`

---

## Summary

P0-D35 is the **first** scoped task in the 10-week Submittals build.
Two deliverables, both load-bearing for what comes next:

1. The duplicate-files cleanup that the spec calls out as Day-1 hygiene.
2. The `gc_review` auto-advance bug at `submittalMachine.ts:58` — a
   real defect that locked an XState transition the spec explicitly
   forbids.

Both gates clear:

- `npm run typecheck` — zero errors on `tsconfig.app.json` AND
  `tsconfig.node.json` (Sprint Invariant #1 holds).
- All 8 submittal-related test suites pass — 100 + 29 = **129 tests
  green** across machine, integration lifecycles, service, API, mutation
  hooks, and smoke pages.

---

## 1. Duplicate-files cleanup (Spec Part 13 "Delete in P0")

The spec lists 7 files to delete:

| File | Tracked in git? | On disk? | Action |
|---|---|---|---|
| `src/pages/submittals/SubmittalDetail 2.tsx` | ❌ no | ❌ no | already gone |
| `src/pages/submittals/SubmittalDetailPage 2.tsx` | ❌ no | ❌ no | already gone |
| `src/test/pages/smoke/submittals.test 2.tsx` | ❌ no | ❌ no | already gone |
| `src/test/pages/smoke/submittal-detail.test 2.tsx` | ❌ no | ❌ no | already gone |
| `e2e/page-6-submittals.spec 2.ts` | ❌ no | ❌ no | already gone |
| `e2e/page-6-submittals.spec 3.ts` | ❌ no | ❌ no | already gone |
| `src/components/forms/CreateSubmittalModal.tsx` | ✅ tracked | ✅ on disk | **kept (live consumer found — see below)** |

**The 6 iCloud-suffixed dupes were never in git in the first place.** A
prior sprint tightened `.gitignore` to suppress `* [0-9].tsx`, `* [0-9].ts`
and friends across the board (memory note 2026-05-05: "iCloud duplicate
suppression generalized to all single-digit suffixes"). A fresh clone or
worktree never even fetches them — and `git ls-files` confirms none are
tracked. The spec's "Delete in P0" line items 1–6 are therefore satisfied
by the prior gitignore work, not by anything this PR does.

### CreateSubmittalModal.tsx — kept, with reason

`src/components/forms/CreateSubmittalModal.tsx` IS tracked in git, and
the spec calls it "legacy; wizard is canonical." Before deleting, I
audited consumers per the explicit Sprint failure mode:

> *"A migration claims 'zero consumers' but the import-graph search returns hits. Trust the search, not the plan. Don't delete."*

`grep -rn CreateSubmittalModal src e2e` returned two real importers:

1. `src/pages/submittals/index.tsx` — imports the modal but uses
   `void CreateSubmittalModal` as a documented no-op. A trivial cleanup:
   would just need both lines removed.
2. **`src/pages/conversation/index.tsx:651–658`** — actively renders
   `<CreateSubmittalModal>` from inside a `CreateSubmittalModalWrapper`
   component. This is a **live, rendered consumer**.

The Conversation page uses the same lightweight-modal pattern for
*every* entity (`CreateRFIModal`, `CreateChangeOrderModal`,
`CreatePunchItemModal`, etc.) as the quick-create surface. Removing
just the submittal modal in this PR would either (a) break the
Conversation submittal create flow, or (b) force an inconsistent
migration where one entity uses the heavy wizard while the other three
keep the light modal. Either path is larger than D35 scope.

**Decision:** keep `CreateSubmittalModal.tsx` for now. Schedule the
deletion alongside a unified Conversation quick-create migration in a
later phase (logical place: D38–D39 when `submittalService.ts` and the
log surface are rebuilt). The spec author appears to have missed the
Conversation consumer — the deferral is documented here so it isn't
silently dropped.

---

## 2. The `gc_review` auto-advance bug (`submittalMachine.ts:58`)

### Diagnosis

The pre-fix XState chart in `gc_review` had:

```ts
gc_review: {
  on: {
    // GC_APPROVE from gc_review forwards to architect (BUG #1 FIX)
    GC_APPROVE: { target: 'architect_review' },
    GC_REJECT: { target: 'rejected' },
    ARCHITECT_REVISE: { target: 'resubmit' },
  },
},
```

The "BUG #1 FIX" comment is a misnomer: the line *is* the bug. Per
spec Part 4:

```
gc_review
  ├ PREFLIGHT_PASS                → preflight → READY_TO_SEND → gc_review
  ├ PREFLIGHT_FAIL                → preflight_failed (back to sub w/ Iris findings)
  ├ FORWARD_TO_REVIEWER (manual)  → sent_to_reviewer
  ├ INTERNAL_REJECT               → returned (to sub)
  └ HOLD                          → on_hold
```

The transmittal from gc_review to the architect is a **deliberate,
manual hand-off** — the GC PE confirms the distribution list,
attaches stamps, applies the AIA §4.2.7 disclaimer, and decides
which reviewer chain to invoke. It is **not** a side effect of the
GC internally approving the package.

The pre-fix machine collapsed two distinct events ("I'm done with my
internal review" and "I'm transmitting this to the architect") into
one. That model breaks every pre-flight workflow (Phase P2),
breaks the magic-link reviewer portal (Phase P2), and silently sends
unstamped packages to architects.

### Fix (surgical, in-scope only)

The full Part 4 chart adds 8 new events and 6 new states. Implementing
all of that is D36+ (and runs alongside the canonical migration). For
D35 the surgical change is just to introduce `FORWARD_TO_REVIEWER` and
remove `GC_APPROVE` from `gc_review.on`:

- Added `'FORWARD_TO_REVIEWER'` to the typed events union.
- Replaced `GC_APPROVE: { target: 'architect_review' }` with
  `FORWARD_TO_REVIEWER: { target: 'architect_review' }` in `gc_review`.
- Replaced the misleading `// BUG #1 FIX` comment with a 7-line block
  explaining why the transmittal is its own event and what's coming in
  D36+.

`getValidSubmittalTransitions` already returned `'Forward to Architect'`
as the action label for `gc_review`, and `getNextSubmittalStatus` already
mapped that label to `architect_review`. The helpers were already
chart-correct — only the XState `on` block was out of sync.

### Test updates

The existing tests had locked the bug closed by sending a second
`GC_APPROVE` to walk gc_review → architect_review:

- `src/test/machines/submittalMachine.test.ts` — 4 sites switched to
  `FORWARD_TO_REVIEWER`. Comments updated.
- `src/test/integration/lifecycles.test.ts` — 3 sites switched to
  `FORWARD_TO_REVIEWER`. The `// BUG #1 FIX` comment removed and
  replaced with a spec citation.

**Regression test added** (`submittalMachine.test.ts`):

```ts
it('GC_APPROVE from gc_review is a no-op — does NOT auto-advance to architect_review', () => {
  const actor = createActor(submittalMachine)
  actor.start()
  actor.send({ type: 'SUBMIT' })
  actor.send({ type: 'GC_APPROVE' })
  expect(actor.getSnapshot().value).toBe('gc_review')

  actor.send({ type: 'GC_APPROVE' })
  expect(actor.getSnapshot().value).toBe('gc_review')   // ← guards the fix
  actor.stop()
})
```

This locks the chart-correct behavior so a future PR can't silently
re-introduce the auto-advance.

---

## What this PR does NOT do

Strict D35 scope:

- Does **not** implement the full Part 4 chart (preflight, on_hold,
  sent_to_reviewer, in_review, returned, distribute, void). That's
  D36–D38 work.
- Does **not** delete `CreateSubmittalModal.tsx` (live consumer in
  `pages/conversation/index.tsx`; deletion needs a paired migration).
- Does **not** touch the canonical migration, RPCs, materialized view,
  service layer, or page components. All scheduled for D36–D40.
- Does **not** rebase or merge any other open PR.

Per the spec ("one tight PR per task, in order"), the next task (D36 —
canonical migration + types regen) is a separate PR. **Stopping here.**

---

## Verification

```bash
npm run typecheck
# tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json
# (clean exit, zero errors — Sprint Invariant #1)

npx vitest run \
  src/test/machines/submittalMachine.test.ts \
  src/test/integration/lifecycles.test.ts \
  src/services/submittalService.test.ts
# 3 files passed, 100 tests passed (37 + 43 + 20)

npx vitest run \
  src/test/api/submittals.test.ts \
  src/test/services/submittalService.test.ts \
  src/test/hooks/mutations/submittals.test.ts \
  src/test/pages/smoke/submittals.test.tsx \
  src/test/pages/smoke/submittal-detail.test.tsx
# 5 files passed, 29 tests passed
```

Two stderr lines appeared in the test runs and are pre-existing,
harmless:
- `[submittal_approved chain] Cannot read properties of undefined`
  is a fire-and-forget cross-feature workflow log on a mocked supabase
  shape (per the cross-feature workflow memory note).
- `SyncManager: refreshCounts error: ... IndexedDB API missing` is the
  expected jsdom limitation (Dexie has no IDB shim in tests).

Neither is a test failure.

---

## Files touched

**Modified:**
- `src/machines/submittalMachine.ts` — `FORWARD_TO_REVIEWER` event +
  `gc_review.on` rewrite + comment block.
- `src/test/machines/submittalMachine.test.ts` — test updates +
  regression test for the no-op behavior.
- `src/test/integration/lifecycles.test.ts` — three sites switched
  from `GC_APPROVE` to `FORWARD_TO_REVIEWER` for the gc_review →
  architect_review transition.

**Created:**
- `docs/audits/DAY_35_SUBMITTAL_CLEANUP_RECEIPT_2026-05-06.md` (this file).

**Deleted:** none (the iCloud dupes were never in git;
`CreateSubmittalModal.tsx` deferred — see §1).

---

## Tracker update

`SiteSync_90_Day_Tracker.xlsx` — Day 35 row, Status `✓`, Note:
"Submittals P0 cleanup + gc_review machine bug fixed. 6 spec-listed
duplicate files were already gitignored; CreateSubmittalModal.tsx kept
(live consumer in conversation/index.tsx — defer to D38/D39).
GC_APPROVE no longer auto-advances from gc_review; FORWARD_TO_REVIEWER
is the explicit transmittal event per Part 4 chart. Typecheck zero on
both tsconfigs. 129 submittal tests green."
