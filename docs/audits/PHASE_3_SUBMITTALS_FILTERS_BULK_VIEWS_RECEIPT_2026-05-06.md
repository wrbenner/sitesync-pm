# Submittals Phase 3 — Filters + Bulk Actions + Saved Views

Receipt for the Phase 3 PR (`submittals/phase-3-filters-bulk-views`). Bugatti standard: typecheck zero on both tsconfigs; canonical types only; no deleted-store revival; PermissionGate on every action button; URL-state-backed filters; RLS-correct migration. Per `SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md` Phase 3.

## What ships

### A. 20-chip filter system
- `src/components/submittals/FilterChips/filterDefinitions.ts` — single-source-of-truth registry. 20 `ChipDefinition` entries, 16 Procore-parity + 4 SiteSync-only.
  - Procore parity (16): approver, ball_in_court, created_by, current_revision, division, location, number, private, received_from, response, responsible_contractor, spec_section, status, submittal_manager, submittal_package, type.
  - SiteSync-only (4): iris_finding, schedule_at_risk, required_within_n_days, critical_path.
- Each chip exports `{id, label, group, inputKind, procoreParity, decode, encode, matches, pillSummary}`. Pure functions — no React deps in the registry.
- Helpers: `applyChipFilters(rows, filters)`, `decodeFiltersFromUrl(params)`, `encodeFiltersToUrl(base, filters)`.

### B. URL-state-backed filter hook
- `src/hooks/useSubmittalFilters.ts` — `?filter[chip_id]=value` round-trips. `setChip / clearChip / clearAll / applySavedFilters` plus a stable `filtersToken` identifier (used by Items view as part of the selection-reset key).
- `hasAny` flag drives the "Save current view…" button visibility on the sidebar.

### C. AddFilter dropdown + FilterPillRail
- `src/components/submittals/FilterChips/AddFilterDropdown.tsx`
  - Dropdown with chip search and group headers.
  - Operand panels: `BooleanInput`, `TextInput`, `DaysInput`, `RevRangeInput`, `PresetSelect`, `MultiSelect` (9 statuses + 13 kinds + CSI divisions + 11 dispositions), `CommaListInput`.
  - `<FilterPill chipId>` renders an active filter with a clear-X.
  - `<FilterPillRail>` renders the row of active pills below the toolbar.

### D. Bulk actions menu + edit modal
- `src/components/submittals/BulkActionsMenu.tsx` — 6 menu items, each wrapped in `PermissionGate`.
  - Live: **Edit** (opens `BulkEditModal`), **Delete** (typed-confirm "DELETE", calls `submittalService.deleteSubmittal` → ADR-007 auto-withdraw policy), **Distribute** (calls `submittal_distribute` RPC).
  - Stubbed (disabled with tooltip; Phase 4): Apply Workflow, Re-run Iris Pre-flight, Generate Stamp PDF.
- `src/components/submittals/BulkEditModal.tsx` — two-stage edit→confirm→save. Editable fields: `current_reviewer_id`, `responsible_sub_id`, `is_critical_path` (TriToggle), `is_private` (TriToggle). Saves via `submittalService.bulkUpdate`.
- `BulkActionsTrigger` (in `src/pages/submittals/index.tsx`) — popover-style "Bulk Actions ▾" pill with the (N) counter; disabled with tooltip when zero rows are selected.

### E. Saved Views (4 scopes + Iris seed)
- `supabase/migrations/20260508000000_submittal_saved_views.sql`
  - `submittal_saved_views` table: `(id, project_id, scope, owner_user_id, name, description, view_state JSONB, is_default, created_by, created_at, updated_at)`.
  - 4-scope RLS: `my` (owner-only), `project` (project members), `company` (org-wide), `iris` (read-only seed).
  - `seed_iris_suggested_submittal_views(project_id)` RPC seeds 4 default views per project — idempotent (returns 0 if already seeded):
    1. **Overdue at Architect** (status in_review/sent_to_reviewer + reviewer_role like architect + days_in_court > sla)
    2. **Long-lead Schedule Risk** (lead_time_weeks ≥ 6 + risk_band high/critical)
    3. **Resubmit count > 1** (rev_number ≥ 2)
    4. **Federal Closeout Package** (kind ∈ federal closeout types + status ≠ closed)
- `src/services/submittalsSavedViews.ts` — `list/create/update/remove/seedIrisSuggested`. `Result<>` shape per project errors.ts. `view_state` is a permissive `Record<string, unknown>` — UI owns the schema.
- `src/hooks/useSavedViews.ts` — react-query hook. Lists views per project, groups by scope, fires Iris seed RPC fire-and-forget on first load when no `iris`-scoped views exist.
- `src/components/submittals/SavedViews/SavedViewsSidebar.tsx`
  - 240px right-collapsible sidebar. Open/closed state persists in `localStorage` keyed by project id.
  - 4 sections (My / Project / Company / Iris-Suggested) with icons.
  - "Save current view…" button surfaces only when the user has at least one active filter.
  - Inline `SaveViewDialog` — name + description + scope picker (My always; Project/Company gated by `submittals.edit` permission).
  - Iris views are read-only (no delete X).

### F. Page wiring
- `src/pages/submittals/index.tsx`
  - `SubmittalsToolbar` now takes `addFilterSlot` + `bulkActionsSlot` render-slot props. The page passes `<AddFilterDropdown />` and `<BulkActionsTrigger>`; defaults preserve the Phase 1 stub shells.
  - Items main pane is a flex row: `<SavedViewsSidebar projectId> | <Items column>`. Sidebar collapses to a 36px rail.
  - `SubmittalsItemsView`'s `filterFn` now composes chip filters (`applyChipFilters`) and the existing free-text search.
  - Selection: `SubmittalsItemsView` exposes `onSelectionIdsChange(ids: string[])` — page mirrors into `selectedIds: Set<string>`. `selectionClearToken` flips after a successful bulk action to clear row checkboxes.
  - `<BulkEditModal open={bulkEditOpen} ... />` is mounted; `onComplete` clears selection + refetches.
  - `resetToken` for the Items view now includes `submittalFilters.filtersToken` so changing chips re-resets the selection.

## Sprint Invariants — checked

- ✅ **Typecheck zero** (`npm run typecheck`) — `tsconfig.app.json` + `tsconfig.node.json` both green.
- ✅ **Money math** — no new money math touched in Phase 3.
- ✅ **No deleted-store revival** — Phase 3 uses `useSubmittals` (queries) + `useSubmittalFilters` (URL) + `useSavedViews` (react-query). No revived `useSubmittalStore` etc.
- ✅ **5 AI stores still separate** (ADR-002).
- ✅ **PermissionGate on every action button** — bulk Edit/Delete/Distribute/Apply Workflow/Iris/Stamp all gated; sidebar's Project/Company scope buttons gated by `submittals.edit`.
- ✅ **Audit harness clean** — orphan smoke `submittal-settings.test.tsx` removed (the page is `status: 'stub'` in registry).

## Files

```
 src/components/submittals/BulkActionsMenu.tsx      | 258 +++++++
 src/components/submittals/BulkEditModal.tsx        | 322 ++++++++
 src/components/submittals/FilterChips/AddFilterDropdown.tsx | 837 +++
 src/components/submittals/FilterChips/filterDefinitions.ts  | 459 +++
 src/components/submittals/SavedViews/SavedViewsSidebar.tsx  | 452 +++
 src/components/submittals/SubmittalsToolbar.tsx    |  46 +-
 src/hooks/useSavedViews.ts                         | 118 +++
 src/hooks/useSubmittalFilters.ts                   |  88 +++
 src/pages/submittals/index.tsx                     | 219 +++++
 src/services/submittalsSavedViews.ts               | 108 +++
 supabase/migrations/20260508000000_submittal_saved_views.sql | 299 ++++++
```

## Next (Phase 4)

- Apply Workflow modal — wire up the `submittal_apply_workflow` RPC.
- Re-run Iris Pre-flight — bulk-edit-style action that fans out the existing single-submittal pre-flight RPC.
- Generate Stamp PDF — server-side composer on the bulk_set.
- Distribution-list resolution for the bulk Distribute path (currently passes empty toUserIds = structural distribute).
