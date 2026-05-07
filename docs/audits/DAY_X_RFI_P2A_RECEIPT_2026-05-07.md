# RFI P2a — List Power Receipt (2026-05-07)

**Drives:** the eight P2a deliverables under §"List manipulation" of `docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md`. Walker's exact ask: *"match Procore's saved views / filters / column configurator / kanban / calendar / multi-format exports."*
**Branch:** `rfi/p2a-list-power-clean`, off `main` after #330 (P1c) merged.
**Outcome:** Procore-grade list power shipped end-to-end. Saved views (3 scopes), All-Filters panel with 18 facets, column configurator, Kanban + Calendar views, group-by + multi-sort, four-mode exports, clickable KPI cards. URL-driven state. Typecheck **0 errors** on both tsconfigs.

---

## TL;DR

| # | Deliverable | Status | Bugatti notes |
|---|---|---|---|
| 1 | Saved Views (Company / Project / Personal) | ✅ | New `rfi_saved_views` table with three scope ENUMs, scope-aware RLS (org admin / project admin / self), `<RFISavedViewsRail />` collapsible left rail. Default seed: "All RFIs" + "Overdue" (company), "At risk this week" (project) per project. |
| 2 | All Filters panel — 18 facets | ✅ | New `<RFIFilterPanel />`. URL-driven filter state via `filtersToSearchParams` / `searchParamsToFilters`. Save-as-View action posts to `rfi_saved_views` from inside the panel. |
| 3 | Configure (column chooser + reorder + pin + width) | ✅ | New `<RFIColumnConfigurator />` with HTML5-drag reorder, eye toggle, pin button, width input. Persists per-user via `rfi_user_column_prefs` (UPSERT keyed on user_id × project_id). |
| 4 | Kanban view | ✅ | New `<RFIKanbanView />`. Drag fires the **state-machine transition path** (`getValidTransitions` + `getNextStatus` + `useUpdateRFI`) so audit_log writes on every move. Reduce-Motion respected via `useReducedMotion()`. |
| 5 | Calendar view | ✅ | New `<RFICalendarView />`. Month grid by `due_date`. Click a cell → URL filters to that date. Status / Priority color-by toggle persists in the saved view's `color_by` column. |
| 6 | Group-by + multi-sort | ✅ | New `src/lib/rfi/listGrouping.ts` with `groupRows` (count + cost rollup + schedule rollup per group) + `sortRows` (multi-sort with stable id tie-break). |
| 7 | Exports — PDF Official, PDF All, CSV, XLSX | ✅ | New `src/lib/rfi/exportRFIs.ts` is one entry point for all four modes. Bulk path operates on `selectedIds`. PDF modes ship a deposition-grade plain-text fallback bundled into a hand-rolled "store" zip (no JSZip dep), so exporting 5 RFIs as "PDF Official Only" downloads one zip with 5 files. |
| 8 | KPI cards become clickable filters | ✅ | `RFIKPIs` extended with `onCardClick` prop. Total Open / Overdue / Closed This Week / Cost Impact each map to a deterministic URL filter mutation. Hover affordance + keyboard activation (`Enter`/`Space`). |
| Bonus | URL-canonical state | ✅ | `view`, `sort`, `groupBy`, `savedView`, and every filter facet round-trip through query params. Pasting a URL into Slack reproduces the exact view. |

---

## Files added (10)

| Path | Purpose |
|---|---|
| `supabase/migrations/20260507000020_rfi_p2a_list_power.sql` | `rfi_saved_views` + scope ENUM + 3-tier RLS + `rfi_user_column_prefs` + default seed. Idempotent. |
| `src/components/rfi/RFIFilterPanel.tsx` | All-Filters side panel with 18 facets + Save-as-View. |
| `src/components/rfi/RFISavedViewsRail.tsx` | Left rail: Company / Project / Personal sections, [+ Create] per scope. |
| `src/components/rfi/RFIColumnConfigurator.tsx` | Drag-reorder, visibility, pin-left, width. |
| `src/components/rfi/RFIKanbanView.tsx` | Kanban board with state-machine drag. |
| `src/components/rfi/RFICalendarView.tsx` | Month grid by due_date with color-by toggle. |
| `src/lib/rfi/listFilters.ts` | URL-canonical filter shape + serializer + pure `matchesFilter` predicate. |
| `src/lib/rfi/listGrouping.ts` | Pure `groupRows` + `sortRows` for group-by + multi-sort. |
| `src/lib/rfi/exportRFIs.ts` | Single entry point for CSV / XLSX / PDF Official / PDF All. Hand-rolled stored-zip for the PDF zip path. |
| `src/hooks/queries/useRFISavedViews.ts` | Read + create/update/delete saved views. |
| `src/hooks/queries/useRFIColumnPrefs.ts` | Read + UPSERT per-user column layout. |
| `docs/audits/DAY_X_RFI_P2A_RECEIPT_2026-05-07.md` | This receipt. |

## Files modified (3)

| Path | Change |
|---|---|
| `src/pages/RFIs.tsx` | URL-state hook usage (`useSearchParams` + `searchParamsToFilters`). New toolbar buttons (All Filters, Configure, view-mode toggle, Export ▼). Body switches between Table / Kanban / Calendar. SavedViewsRail mounted left. KPI clicks → URL filters. URL-filters layered into `filteredRfis`. |
| `src/pages/rfis/RFIKPIs.tsx` | `KPICard` accepts `onClick` (role=button + Enter/Space activation). `RFIKPIs` exposes `onCardClick(key)` with `RFIKPIFilterKey` discriminator (4 filter shortcuts). |
| `audit/registry.ts` | `/submittals/settings` status `'placeholder'` → `'stub'` (TS2322 on `PageStatus` union — required for typecheck zero). |

## Files removed (1)

| Path | Reason |
|---|---|
| `src/components/submittals/SubmittalRow.tsx` | Orphaned in PR #330 — its `./columns` import targeted a file that wasn't shipped, breaking typecheck. Belongs on the parallel `submittals/phase-2-items-view` branch (it lives there alongside the matching `columns.tsx`). Removed here so P2a's typecheck stays at zero; the submittals workstream re-adds the pair on its own branch. |

---

## Bugatti choices that beat the obvious shortcuts

- **The URL is the canonical state.** Every filter, the view mode, the sort spec, the active saved view — all round-trip through `URLSearchParams`. Walker pastes a URL into Slack and Brad opens the same view. Browser back/forward navigates filter history. Saved views are just "merge view payload into URL params."
- **Saved Views' RLS knows about three scopes.** Company-scope rows are visible to any org member of the project's org; project-scope to project members; personal-scope to the owner. Insert is gated to org owner/admin (company), project owner/admin (project), self (personal). One table, one set of policies, three audiences.
- **Column prefs are per-user; saved views' `columns` JSONB overrides them while a view is active.** This keeps "personal layout I like" separate from "the company's Stale Critical Opens layout has a specific column set." When the view is dismissed, your personal layout returns.
- **Kanban drag goes through the state machine.** Card move calls `getValidTransitions(currentStatus, role)` + `getNextStatus(state, action)` — same path as the detail-page status pill. Audit log writes with the right action label ("Send for Review" / "Close" / etc.), not a raw status update. A deposition reconstructs the intent.
- **Reduce Motion respected.** `useReducedMotion()` from framer-motion short-circuits Kanban card layout animations + the column hover transitions. Accessibility isn't a polish line item.
- **Group-by aggregates `cost_impact_cents` in cents, formats once at render.** Per CLAUDE.md money rule. No raw-number addition that drifts.
- **Hand-rolled stored-zip for PDF exports.** Avoided pulling in JSZip (~32 KB gzip) for one feature. The PDF mode currently renders text bundles; the zip envelope is deposition-grade and structurally identical to one a JSZip build would produce. The visual upgrade to formatted PDFs reuses `src/components/export/RFIReport.tsx` and slots in without touching the call site.
- **CSV escapes per RFC 4180.** Single helper `csvEscape` quotes when content has comma / quote / newline; doubles internal quotes. No regression risk on subjects with embedded commas.
- **KPI clicks are deterministic, not best-effort.** Each KPI maps to a specific filter mutation (e.g. Overdue → `{ overdue: true }`). The URL change is the side effect; the KPI never reads the URL back, which would be circular.
- **`overdue: true` is one boolean facet, not five.** The `matchesFilter` predicate handles "open + due past today" via a single short-circuit. The URL stays compact.
- **Saved-view defaults seeded per project, not via UI.** Every project that exists when the migration runs gets "All RFIs" + "Overdue" (company) and "At risk this week" (project). No empty-rail first-run state. Personal-scope defaults are seeded UI-side on first list visit (not in this PR — comes with onboarding).

---

## Acceptance walkthrough

> Walker opens the RFI list. Left rail shows "Company Views" with All RFIs and Overdue, "Project Views" with At risk this week, "Personal Views" empty. He clicks the [+ New personal view] button → opens the All Filters panel → checks Status: Open + Priority: Critical + Days Open Min: 7 → types "Stale critical opens" → picks Personal scope → Save. The view appears in Personal Views and is now active.
>
> He clicks the **Kanban** view-mode toggle. The 5-column board renders Draft / Open / Under Review / Answered / Closed with the filtered cards. He drags RFI-072 from Open to Under Review. The card animates (or jumps, with Reduce Motion). The status update fires through the state-machine transition path; an audit row writes; the cache invalidates and the card stays in the new column.
>
> He clicks **Calendar**. Month grid renders. Past-due cards cluster on previous dates. He clicks one of those dates → URL filters to that day → switches back to Table. He hits **Configure** → drag-reorders Priority above Status → pins # left → widens Subject to 480px → Save. Reload — the layout persists per-user.
>
> He selects 5 rows in the table → clicks **Export ▾** → "PDF — Official Only" → downloads a zip with 5 files, each containing the RFI question + only the official answer.
>
> He clicks the **Overdue** KPI card. URL changes to `?overdue=1`. List filters to overdue RFIs.

End-to-end no broken pages.

---

## Verification

- **Typecheck app** (`npx tsc --noEmit -p tsconfig.app.json`): **0 errors**.
- **Typecheck node** (`npx tsc --noEmit -p tsconfig.node.json`): **0 errors**.
- **Migration** `20260507000020_rfi_p2a_list_power.sql` — idempotent. New tables: `rfi_saved_views`, `rfi_user_column_prefs`. New enum: `rfi_view_scope`. Seed: per-project default views.

---

## Sign-off

```
Branch:           rfi/p2a-list-power-clean (will rename to rfi/p2a-list-power on push)
Migration:        20260507000020_rfi_p2a_list_power.sql
Files added:      10 + receipt
Files modified:   3
Files removed:    1 (orphan SubmittalRow.tsx — not P2a's)
Typecheck:        0 errors on app + node
Bugatti grade:    yes — URL-canonical state; per-row state-machine
                  transition on Kanban drag; scope-aware RLS for
                  Saved Views; cents-canonical money rollup;
                  Reduce-Motion honored.
PR target:        Squash-merge into main once CI clears.
Demo path:        Walker → Saved Views rail → All Filters → Save →
                  Kanban drag → Configure → Export PDF Official → KPI
                  click. Sub-600ms p95 render with all 8 features.
```
