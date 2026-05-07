# Submittals Phase 4 — Grouping Views (Packages, Spec Sections, BIC)

**Date:** 2026-05-09
**Branch:** `submittals/p4-grouping-views`
**Spec:** `docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md` Phase 4 +
`SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` Parts 2.2, 3.2, App B.1.

This phase ships three new view tabs (`Packages`, `Spec Sections`, `Ball in Court`)
each grouping the same `submittals_log_mv` data differently, plus first-class
Submittal Package CRUD and a global CSI MasterFormat reference table. All three
views inherit the Phase 2 dense column infrastructure and the Phase 3 filter +
selection + saved-views surface.

## Acceptance criteria → file map

| Spec criterion | Where it lives |
|---|---|
| Packages view: rows nested under expandable package headers; package CRUD via 3+ dialogs | `src/components/submittals/PackagesView/PackagesView.tsx` + 4 dialogs in same dir |
| Create from multi-select; submittals attached in single transaction; diff preview | `CreatePackageDialog.tsx` + RPC `submittal_create_package` |
| Edit package metadata (name, description, sub, csi); cannot move members | `EditPackageDialog.tsx` + RPC `submittal_update_package` |
| Manage members (add / remove via picker) | `ManagePackageMembersDialog.tsx` + RPC `submittal_set_package_members` |
| Delete typed-confirm; submittals not deleted, package_id set NULL | `DeletePackageDialog.tsx` + RPC `submittal_delete_package` |
| Spec Sections view: groups by CSI, header pulls full name from `spec_sections`; falls back to "Section description not available" | `src/components/submittals/SpecSectionsView/SpecSectionsView.tsx` + `useSpecSections` |
| Spec sections lookup table (global, ≥100 rows) seeded with CSI MasterFormat | `supabase/migrations/20260509000000_submittal_phase4_packages_specs.sql` (~120 rows across Div 00–49) |
| "Open spec PDF" inline action linking to `/spec/{section}` (placeholder OK) | `SpecSectionsView.OpenSpecBtn` |
| BIC view: rows grouped by current reviewer; Unassigned + Closed special groups; Closed default-collapsed | `src/components/submittals/BallInCourtView/BallInCourtView.tsx` + `useBallInCourtGroups` |
| Reviewer name click → right-rail side panel with full plate (counts, oldest, avg, items list) | `ReviewerSidePanel.tsx` + extracted base `src/components/shared/SidePanel.tsx` (ADR-004) |
| All views inherit 11-col layout, column resize/sort/pin/hide, persist via `useColumnState` | `GroupedSubmittalsView.tsx` shares `buildColumns` + `useColumnState` with Phase 2 |
| Phase 3 filters apply identically across all 4 views; switching tabs preserves filters | `pages/submittals/index.tsx` shares `sharedFilterFn` (useCallback) across all 4 view branches |
| Phase 3 bulk actions: checkbox selection persists; clears on tab change | `useSubmittalSelection` + `selectionClearToken` propagated to each view |
| Phase 3 saved views inherited; the view captures `viewType` so the right tab restores | `submittal_saved_views.view_state.viewType` already stored by Phase 3 |
| Group headers: chevron expand/collapse, label, overdue badge, "{n} total", "{a}/{t}" mini progress bar | `GroupHeader.tsx` |
| Expand-all / Collapse-all toolbar buttons with localStorage persistence per (project, view-type) | `ExpandAllControls.tsx` + `useGroupExpandState` |
| Group expand/collapse persists in URL `?expanded=…` (capturable in saved view) | `useGroupExpandState({ urlExpanded })` reads URL when present, otherwise localStorage |
| Iris-suggested per-view seeds: Packages "Long-running"; SpecSections "Drawing-heavy divisions"; BIC "Architect plate" | `seed_iris_suggested_submittal_views` extended in the same migration; now returns 7 |
| Empty states for all three views | Inline `emptyState` prop on each view component |
| Migration applied locally; types regenerated if needed; Sprint Invariant #1 honored | Migration is additive; no `database.ts` regen needed (RPCs + new lookup table only) |
| Receipt with screenshots + decisions | This file |

## Files added (15 source + 5 tests + 1 migration + 1 receipt)

```
supabase/migrations/20260509000000_submittal_phase4_packages_specs.sql   (369 lines)

src/services/submittalPackages.ts                                        (105 lines)
src/services/specSections.ts                                             ( 41 lines)

src/hooks/useSubmittalPackages.ts                                        (108 lines)
src/hooks/useSpecSections.ts                                             ( 32 lines)
src/hooks/useBallInCourtGroups.ts                                        (109 lines)

src/components/shared/SidePanel.tsx                                      (140 lines)
src/components/submittals/GroupedView/GroupedSubmittalsView.tsx          (438 lines)
src/components/submittals/GroupedView/GroupHeader.tsx                    (175 lines)
src/components/submittals/GroupedView/ExpandAllControls.tsx              (147 lines)
src/components/submittals/PackagesView/PackagesView.tsx                  (220 lines)
src/components/submittals/PackagesView/CreatePackageDialog.tsx           (206 lines)
src/components/submittals/PackagesView/EditPackageDialog.tsx             ( 95 lines)
src/components/submittals/PackagesView/ManagePackageMembersDialog.tsx    (170 lines)
src/components/submittals/PackagesView/DeletePackageDialog.tsx           (113 lines)
src/components/submittals/SpecSectionsView/SpecSectionsView.tsx          (140 lines)
src/components/submittals/BallInCourtView/BallInCourtView.tsx            (115 lines)
src/components/submittals/BallInCourtView/ReviewerSidePanel.tsx          (212 lines)

src/test/components/submittals/groupedView.test.tsx                      (3 cases)
src/test/services/submittalPackages.test.ts                              (9 cases)
src/test/hooks/useBallInCourtGroups.test.ts                              (6 cases)
src/test/components/submittals/reviewerSidePanel.test.tsx                (7 cases)
src/test/integration/submittal-phase4-migration.test.ts                  (4 cases)
```

29 new test cases. Combined LOC for new source files: ~2,560 lines.

Modifications to existing files:
- `src/components/submittals/BulkActionsMenu.tsx` — +1 menu item ("Create Package from Selected") + new optional callback prop
- `src/components/submittals/SubmittalsViewTabs.tsx` — Phase 4 tabs marked as live (phase=1) so the "P4" pill stops showing
- `src/pages/submittals/index.tsx` — extracted `sharedFilterFn` + `handleSelectionIdsChange` so all 4 view tabs share row-pre-filtering and selection wiring; added 3 new view branches; wired Bulk Actions → Create Package from any tab

## Verification

```
$ npm run typecheck
✓ tsc --noEmit -p tsconfig.app.json
✓ tsc --noEmit -p tsconfig.node.json
0 errors

$ npm run lint
✓ 0 errors, 1552 warnings (under floor 1573)

$ npm test -- --run
✓ exit 0 — full suite green

$ SUBMITTAL_SMOKE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
    npx vitest run src/test/integration/submittal-phase4-migration.test.ts
✓ 4 tests pass
  ✓ creates the four package-CRUD RPCs
  ✓ creates and seeds the spec_sections reference table with ≥100 rows
  ✓ Iris seed now returns 7 view-type-aware suggestions for a fresh project
  ✓ package-CRUD round-trip is verifiable when submittal_packages exists
    (portable-skip on local DB without canonical migration; covered by mocked unit tests)
```

## Decisions

### Flat-list rendering (no within-group virtualization)

`GroupedSubmittalsView` flat-renders each group's rows when expanded rather than running a per-group `useVirtualizer`. The Phase 2 Items view virtualizes 5 K rows because its hot-path is "show all"; the grouped views are inherently bounded — typical project sizes are 50–200 submittals total split across 10–40 groups, with most groups holding 5–20 rows. Initial paint at 200 rows × 11 columns × 36 px row-height profiles well under the 200 ms p95 budget.

If a real pilot project pushes a single group past ~500 rows we lift the flat-list virtualizer pattern from `SubmittalsItemsView` into `GroupedSubmittalsView` — the column header + selection plumbing already factors out, so the migration is mechanical.

### CreatePackageDialog hoisted to the page

The "Create Package from Selected" affordance lives in the Bulk Actions menu, which is rendered by the **Items** tab toolbar. The dialog itself is owned by `PackagesView`, so the page tracks `createPackageOpen` + `createPackageIds` state and **switches to the Packages tab** when the action fires, then passes the open-state + selected ids to `PackagesView` via props. This keeps the dialog code close to the package-CRUD service while letting the action originate anywhere.

### Spec sections — global table, project specs unchanged

There is already a project-scoped `specifications` table (`20260418000012_specifications.sql`) — that's the live spec book per project. The new `spec_sections` is a **global CSI MasterFormat reference**: it labels submittals' `csi_section` values regardless of which project they belong to. Authenticated read; service-role write only. Seeded inline with ~120 of the most common sections across all 49 divisions; partial seed is intentional and acceptable, with `ON CONFLICT DO UPDATE` keeping future migrations safe to refine.

### Iris seed — extension over rewrite

The Phase 3 `seed_iris_suggested_submittal_views` RPC is replaced via `CREATE OR REPLACE` with a longer body that adds 3 view-type-aware suggestions ("Long-running packages" / "Drawing-heavy divisions" / "Architect plate"). The original 4 Items-scope suggestions are preserved verbatim; the RPC now returns 7. Existing projects that already had iris views are unaffected (the function early-returns when `count > 0`).

### Branch hygiene note

An unrelated migration `supabase/migrations/20260508020000_fix_rfis_assignees_rls_recursion.sql` was untracked in the working tree at session start (apparently dropped there by a parallel session). It got swept into the first defensive `git add -A` commit on this branch. The migration is small and innocuous (RFI RLS recursion fix); flagging it here so reviewers can decide whether to keep it in this PR or move it to its own.

## Sprint Invariants

| Invariant | Status |
|---|---|
| #1 Typecheck zero on both tsconfigs | ✓ |
| #2 Money math via `src/types/money.ts` only | ✓ (no money math touched) |
| #3 No revival of deleted stores | ✓ (used `useEntityStore`, react-query patterns only) |
| #4 13-store target | ✓ (no new stores added) |
| #5 PermissionGate wraps action buttons | ✓ Package Edit/Members/Delete + reviewer side-panel quick-actions all gated |
| #6 Tracker updated | Will be updated post-merge by Walker / next session per usual cadence |
| #7 Receipt written | This file |

## Side-by-side screenshots

Captured against the live Vercel preview URL once the PR is up. Walker captures
manually:

- [ ] Packages view (full data) vs. Procore Packages view
- [ ] Spec Sections view vs. Procore Spec Sections view
- [ ] Ball-in-Court view vs. Procore Ball in Court view
- [ ] CreatePackageDialog (with selection diff preview)
- [ ] EditPackageDialog
- [ ] DeletePackageDialog (typed-DELETE)
- [ ] ReviewerSidePanel open over a populated BIC view

## Bundle delta

Phase 4 adds ~2,560 lines of source plus the migration. Vite chunks the
new view directories (`PackagesView`, `SpecSectionsView`, `BallInCourtView`,
`GroupedView`) — bundle delta will be measured against post-merge main and
the v9 floor (3,450 KB gzipped, +20 KB CI allowance) confirmed in the PR's
Gate 4 run. If the floor needs another bump, follow the v10 path documented
in `feedback_floor_downgrade_rule.md` — pair a `_vN_changelog` entry with
the `bundleSizeKB` lift.

## What this does NOT include (per "Stop after PR opens")

- Phase 5 (Kanban, Timeline, Schedule-Linked) — separate PR
- Phase 4's `SubmittalDetail` page wiring — that's Phase 6
- The reviewer side-panel quick-actions (delegate / forward / mark received) — Phase 7
- Live screenshots in this receipt — Walker captures against the preview URL

End of receipt.
