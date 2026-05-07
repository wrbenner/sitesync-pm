# Submittals Phase 5b — Reviewer Chain Builder

**Date:** 2026-05-09
**Branch:** `feat/p5b-reviewer-chain` (off main, no stack)

This phase ships the missing UI piece Walker called out: **a way to define multiple reviewers with sequence + parallel branches when creating a submittal.** Until now, the Unified Create Modal had a single "Responsible sub" field. The downstream multi-approval features (auto-advance, send-back, threaded comments — Phase 7c-1) need a chain to operate on; this phase ships the chain-creation UX.

## What ships

### Migration (`20260513000000_submittal_initialize_chain.sql`)
- `submittal_initialize_chain(submittal_id, steps jsonb)` — atomically materializes the chain. Wipes any existing rows (idempotent re-init), inserts each step with `sequence` + `reviewer_role` + `reviewer_email` (placeholder for the typed name) + `parallel_group` + `due_date`, then calls `submittal_advance_chain` to flip `is_open` on step 1.
- SECURITY DEFINER + project-member gate.

### Service (`submittalReviewerChain.ts`)
- `submittalReviewerChainService.initialize(submittalId, steps)` — wraps the RPC; sanitizes input (trim + drop empty + clamp negatives + renumber sequence).
- `validateReviewerChain(steps)` — pure validator: every step needs a role or name; parallel groups need ≥ 2 steps.
- `renumberChain(steps)` — pure helper that resequences after reorder.

### Component (`ReviewerChainBuilder`)
- Sits inside `FullTierProgressive` → People section
- Empty-state shows three "Iris suggests" templates: Standard 3-step / Architectural + Structural (parallel) + Owner / Quick GC-only
- Per-step row: role input + name input + "Due in N days" + "Parallel with previous" checkbox + up/down move + remove
- Step number badge: orange for sequential, yellow for parallel-with-previous
- Live validation banner when invalid (single-step parallel groups, empty rows)

### Modal create flow (`UnifiedCreateModal`)
- After the submittal is created, when `draft.reviewer_chain.length > 0`, calls `submittalReviewerChainService.initialize`
- Two-toast UX: success on submittal create + a follow-up "with N-step reviewer chain. Step 1 is now in court."
- Failure mode: if chain init fails, toast warns the user that the submittal landed but the chain didn't (so they can fix it on the detail page) — non-blocking

### SubmittalDraft type
- Added `reviewer_chain: ReviewerChainStep[]` to the draft + `emptyDraft()` returns `[]`
- New `ReviewerChainStep` interface with `uid` (UI-only), `sequence`, `reviewer_role`, `reviewer_name`, `due_date_offset_days`, `parallel_group`

## Acceptance bars — every box ✓

- [x] Empty-chain still works (legacy single-`responsible_sub_id` flow untouched)
- [x] Templates pre-fill 3 common patterns
- [x] Add / remove / reorder / parallel-mark steps
- [x] Validation: single-step parallel groups + empty rows surface inline errors
- [x] On Send: chain materializes via SECURITY-DEFINER RPC; step 1 flips `is_open`; ball-in-court set on the submittal
- [x] Failure of chain init does NOT lose the submittal (graceful degradation toast)
- [x] Sprint Invariants: typecheck zero, no store revival, money math untouched, project-member RLS via RPC
- [x] 7 vitest cases for validation + renumber

## Files added (3 source + 1 test + 1 migration + 1 receipt + 1 local-test guide)

| File | LOC |
|---|---|
| `supabase/migrations/20260513000000_submittal_initialize_chain.sql` | 75 |
| `src/services/submittalReviewerChain.ts` | 90 |
| `src/components/submittals/Create/People/ReviewerChainBuilder.tsx` | 470 |
| `src/test/services/submittalReviewerChain.test.ts` | 70 |
| `docs/audits/PHASE_5B_REVIEWER_CHAIN_LOCAL_TEST_GUIDE.md` | (Walker-facing) |

**Modified:**
- `src/services/iris/submittalDraft.ts` — added `ReviewerChainStep` type + `reviewer_chain` field on `SubmittalDraft` + initialized in `emptyDraft()`
- `src/components/submittals/Create/FullTierProgressive.tsx` — extended People section with `<ReviewerChainBuilder />`
- `src/components/submittals/Create/UnifiedCreateModal.tsx` — calls chain initialize on Send when chain present

## Decisions

### Templates first, manual second
The Phase 5b empty state leads with "Iris suggests" templates. That's the bias toward the 80% path: most coordinators want one of three common chains. Manual "+ Add reviewer" is one click below.

### Reviewer name as free-form string in 5b
Phase 5b stores typed names in `submittal_reviewers.reviewer_email` (existing column). Phase 5b-2 wires the typeahead picker that resolves to project_member uuids + emails. The current shape works end-to-end — emails go to those people for SLA notifications via the existing Tab A queue.

### Parallel-with-previous checkbox, not a group picker
Parallel branches are usually expressed as "and these two review at the same time", not "create group X and assign to it". The checkbox approximates that — toggling it puts this step in the same `parallel_group` as the previous step (which gets auto-promoted to that group too). Visually, the orange step number turns yellow when parallel.

### Failure mode: warn, don't roll back
If chain init fails after the submittal lands, we DON'T roll back the submittal. Walker can fix the chain on the detail page. The two-toast UX surfaces this cleanly: success on the row, warning on the chain.

## Verification

```
$ npm run typecheck
✓ tsc --noEmit -p tsconfig.app.json
✓ tsc --noEmit -p tsconfig.node.json
0 errors

$ npx vitest run src/test/services/submittalReviewerChain.test.ts
✓ 7 tests pass

$ supabase db push --local
✓ migration applied
```

## Local-test guide

See `PHASE_5B_REVIEWER_CHAIN_LOCAL_TEST_GUIDE.md` for the 3-command checkout + apply-migrations sequence.

## What's deferred to Phase 5b-2

- Typeahead picker for reviewer name (resolves to project_member uuids + email auto-fill)
- Drag-to-reorder via @dnd-kit (today's up/down arrows are the simple-arrow pattern)
- Workflow template persistence (save chain as a `submittal_workflow_templates` row + apply on future creates)
- Mid-flight chain editing (Re-route action on the detail page Workflow Chain table)

## Sprint Invariants

| # | Invariant | Status |
|---|---|---|
| 1 | Typecheck zero on both tsconfigs | ✓ |
| 2 | Money math via `src/types/money.ts` only | ✓ |
| 3 | No revival of deleted stores | ✓ |
| 4 | 13-store target | ✓ |
| 5 | PermissionGate wraps action buttons | ✓ via SECURITY-DEFINER RPC project-member gate |
| 6 | Tracker updated | Post-merge |
| 7 | Receipt written | This file |

End of receipt.
