# Submittals Page Rebuild — Phased Plan

**Date:** 2026-05-06
**Format:** Phase-by-phase build plan. Each phase is one PR, 1-3 days of work, independently shippable, independently verifiable. Walker hands one phase to Claude Code, verifies the diff against the acceptance criteria below, merges, then fires the next.
**Companion docs:**
- `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` — the canonical spec (the *what*).
- `SUBMITTAL_VISUAL_AUDIT_2026-05-06.md` — the gap analysis vs. Procore (the *why*).
- This doc — the *how to ship it in pieces*.
- `SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md` — the 5 product decisions that govern P2+.

---

## Why phased like this

**One PR per phase.** Each phase merges cleanly, doesn't break the page, and you can stop after any phase if priorities shift.

**Each phase is verifiable in 5 minutes.** You open the page, you see something specifically different from the previous phase, you check the acceptance criteria below, you merge.

**No phase requires the next.** If we ship 1-4 and pause, the page is already a meaningful improvement over today. If we ship 1-7, we're at Procore parity. Phase 8 is the polish lap.

**Backend (D35-D38) is a different track.** PRs #324, #325, and the upcoming #326-#327 (D37 + D38) ship the database, RPCs, types, and service layer. The phases below are the **UI rebuild**. They depend on D38 having shipped (so the new RPC-backed service is callable), but otherwise stand on their own. **Do not start Phase 1 until D38 is merged.**

**Each phase preserves what already works.** The CSI division grouping, the colored status pills, the Iris button, the sidebar nav, light/dark theme, Cmd-K — all called out in the visual audit as things SiteSync already does better than Procore. The rebuild does not remove these.

---

## Phase summary

| # | Phase | Days | Headline change | Depends on |
|---|---|---|---|---|
| 1 | Page Shell Reset | 1 | Drop the 4 KPI cards. Tighten the header. Add view tab strip + settings gear. Fix numbering + drop Priority. | D38 merged |
| 2 | Dense Items View | 2 | 11-column dense list with inline Edit/Open. Real BIC populated. Virtualized. | Phase 1 |
| 3 | Filters + Bulk Actions + Saved Views | 2 | 20-chip filter dropdown. Bulk Actions menu. My/Project/Company/Iris saved views. | Phase 2 |
| 4 | Grouping Views (Packages, Spec Sections, BIC) | 2 | Three new view tabs sharing the grouping infra. Packages first-class. | Phase 2 |
| 5 | Advanced Views (Kanban, Timeline, Schedule-Linked) | 2 | Drag-to-advance, Gantt, schedule-docked. | Phase 2 |
| 6 | Detail Page Shell + Overview Tab | 1 | Breadcrumb, status banners, action cluster, 7 tabs (only Overview live). | Phase 1 |
| 7 | Workflow Chain + Citations Side Panel | 2 | The killer detail-page features. | Phase 6 |
| 8 | Mobile + Login Fix + Polish | 1 | Responsive layout. P1 login bounce. Recycle Bin. | Phases 1-7 |

**Total: ~13 days of UI work over 8 PRs. Lap 2 finishes at parity. P1+ killer features (spec importer, AI pre-flight, magic-link, rev-diff, closeout) layer on top.**

---

## Phase 1 — Page Shell Reset

**Goal:** Strip the page back to a clean, dense Procore-grade frame. After this phase, the page *looks* enterprise-grade even before any view rebuilds.

### Scope (do these, nothing else)

- Drop the 4 KPI cards (Pending Review, Overdue, Approval Rate, Avg Review Time). The 240d metric goes with them.
- Replace with a **slim inline strip** under the page title:
  ```
  1,247 active · 23 overdue · 4 awaiting your response · 6 architect-late
  ```
- Smaller page title. Settings gear icon next to it (clickable → `/submittals/settings`, even if the settings page is empty for now).
- Add the **view tab strip** below the header. Tabs: `Items` · `Packages` · `Spec Sections` · `Ball in Court` · `Kanban` · `Timeline` · `Schedule` · `Recycle Bin`. Only `Items` works in this phase; the rest render an empty placeholder ("Coming in Phase N — see SUBMITTALS_PAGE_REBUILD_PLAN.md").
- Add the **toolbar shell** below the view tabs. Three slots:
  - Left: Search box + `Add Filter ▾` (button stub, opens nothing yet) + `Bulk Actions ▾` (button stub).
  - Center: blank.
  - Right: `1-N of M` count + Page selector + prev/next.
- Top-right action cluster: `+ New Submittal` (orange primary), `Export ▾`, `Reports ▾` (button stub for now).
- Drop the `Priority` column from the table entirely. The column ships in Phase 2 only if it's tied to `is_critical_path`; otherwise it stays out.
- **CSI-aligned numbering display.** Replace `SUB-058` rendering with `{spec_section}-{seq}` per `submittal_settings.numbering_format`. Database `submittals.number` stays as-is — display only.
- Drop the "5 active · 5 overdue" subtitle (math is wrong + uninformative). The slim strip above replaces it.

### Files touched

- `src/pages/submittals/index.tsx` — header + slim strip + view tab strip + toolbar shell.
- `src/components/submittals/SubmittalsHeader.tsx` — new.
- `src/components/submittals/SubmittalsToolbar.tsx` — new.
- `src/components/submittals/SubmittalsViewTabs.tsx` — new (tab definitions + placeholder content).
- `src/components/submittals/SubmittalNumberDisplay.tsx` — new (formats `submittals.number` per project setting).
- Possibly a `useSubmittalSettings` hook if not already present.

### Acceptance criteria (verify before merge)

- [ ] Page above-the-fold shows the table immediately. KPI cards gone.
- [ ] Slim inline strip renders under the title with the 4 counts.
- [ ] Page title is smaller. Settings gear next to it. Click goes to `/submittals/settings` (placeholder OK).
- [ ] View tab strip with all 8 tabs visible. Clicking any non-Items tab shows the "Coming in Phase N" placeholder.
- [ ] Toolbar shell visible: Search, Add Filter (does nothing), Bulk Actions (does nothing), `1-N of M` count.
- [ ] `+ New Submittal` is orange primary; `Export ▾` and `Reports ▾` (button-only) flank it.
- [ ] Priority column gone from the table.
- [ ] Submittal numbers in the table render as CSI-aligned (e.g., `08 41 13-1`) per the project's `numbering_format`. Existing numeric primary keys unchanged.
- [ ] Subtitle removed.
- [ ] Typecheck zero. Existing submittal tests pass. `npm run build` succeeds.

### Prompt for Claude Code

> Read `docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md` Phase 1 in full, plus `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` Part 2 (Information Architecture) and `SUBMITTAL_VISUAL_AUDIT_2026-05-06.md` (gaps to close).
>
> Implement Phase 1 only. Do not start Phase 2. Acceptance criteria are listed in the plan; ship nothing more, nothing less.
>
> Sprint Invariants apply: typecheck zero on both tsconfigs; PermissionGate wraps every action button; no revival of deleted stores; do not skip the receipt.
>
> One PR titled `submittals: phase 1 — page shell reset`. Receipt at `docs/audits/PHASE_1_SUBMITTALS_SHELL_RECEIPT_2026-05-XX.md` listing what changed, what was deferred, and a screenshot diff.
>
> Stop after PR opens. Do not start Phase 2.

---

## Phase 2 — Dense Items View

**Goal:** Make the Items view look and feel like Procore's. Dense, scannable, action-rich. This is where the core data density comes back.

### Scope

- 11 columns visible at 1440px viewport, no horizontal scroll: **Spec Section · # · Rev · Title · Type · Status · Sub · Submit By · BIC · Days in Court · 📎 Attachments**.
- Resize handles on every column header.
- `⋮` menu on every column header for sort / pin / hide.
- **Inline `Edit` and `Open` buttons** on every row (not just on hover — visible always, like Procore).
- Server-side virtualization (TanStack Virtual or react-virtual). Smooth 5,000-row scroll at 60fps.
- Status pill colors preserved (Approved green, Rejected red, Resubmit amber). Procore uses plain text — keep our advantage.
- **Real BIC data populates.** Use `submittals_log_mv.current_reviewer_name` + `days_in_court`. Em-dash only when `status in ('draft', 'closed', 'void')`.
- p95 paint < 200ms at 5K rows. Telemetry hook to log paint times.
- Row checkboxes on the left for Phase 3 to wire up. Wire the checkbox state but no Bulk Actions menu yet.

### Files touched

- `src/components/submittals/SubmittalsItemsView.tsx` (planned) — new.
- `src/components/submittals/columns.tsx` (planned) — column definitions (11 columns).
- `src/components/submittals/SubmittalRow.tsx` (planned) — row with inline Edit/Open buttons.
- `src/components/submittals/StatusPill.tsx` (planned) — already exists, verify it covers all 9 states.
- `src/hooks/useSubmittalsList.ts` (planned) — pulls from `submittals_log_mv` via the new RPC service.

### Acceptance criteria

- [ ] Items tab renders 11 columns at 1440px without horizontal scroll.
- [ ] Each row has visible `Edit` + `Open` buttons.
- [ ] Column resize works. `⋮` menu appears on hover with sort/pin/hide.
- [ ] BIC column shows real reviewer name + days in court for `in_review` and `sent_to_reviewer` rows.
- [ ] Scrolling 5K rows is smooth (test with synthetic dataset; can use Faker seed in dev).
- [ ] Status pills colored.
- [ ] Row checkboxes render and select-state persists in URL/local state.
- [ ] Typecheck zero. Smoke test passes.

### Prompt for Claude Code

> Read this rebuild plan Phase 2, plus `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` Parts 2.2 and 2.5 (density target).
>
> Implement Phase 2 only. The Items view must hit the 11-column density target at 1440px without horizontal scroll. Real BIC data must populate from `submittals_log_mv`. Sprint Invariants apply.
>
> Use existing `useEntityStore('submittals')` and the new RPC service from D38. Do not revive any deleted store. Server-side virtualization required — load test with a 5,000-row synthetic dataset and include p95 paint timing in the receipt.
>
> One PR titled `submittals: phase 2 — dense items view`. Receipt at `docs/audits/PHASE_2_SUBMITTALS_ITEMS_RECEIPT_2026-05-XX.md` with paint-perf numbers and a screenshot.
>
> Stop after PR opens.

---

## Phase 3 — Filters + Bulk Actions + Saved Views

**Goal:** The toolbar becomes powerful. Coordinators can slice 1,000+ submittals down to "the 12 I need to chase today" in 3 clicks.

### Scope

- **Add Filter ▾ dropdown** with all 20 chips (16 Procore parity + 4 SiteSync-only):
  - Procore parity: Approver, Ball In Court, Created By, Current Revision, Division, Location, Number, Private, Received From, Response, Responsible Contractor, Spec Section, Status, Submittal Manager, Submittal Package, Type.
  - SiteSync-only: Iris Pre-flight Finding (any/none/specific), Schedule Activity At Risk, Required-on-Site Within N Days, On Critical Path.
- Each chip applied → toolbar pill with `×`. Clear all link.
- Filter state persists in URL query string + saved views.
- **Bulk Actions ▾** dropdown when ≥1 row checked: Edit, Apply Workflow, Delete, plus SiteSync-only: Re-run Iris Pre-flight, Distribute to Field, Generate Stamp PDF.
- **Saved Views model**: My Views (private), Project Views (shared with team), Company Views (admin-only), Iris-Suggested Views (auto-generated: "Overdue at Architect", "Long lead → schedule risk", "Resubmit count > 1", "Federal closeout package"). Each view persists filters + columns + sort + view-type + grouping.
- Saved Views sidebar opens from a toolbar button; collapses by default.

### Files touched

- `src/components/submittals/FilterChips/` — new directory.
- `src/components/submittals/FilterChips/AddFilterDropdown.tsx` (planned)
- `src/components/submittals/FilterChips/FilterPill.tsx` (planned)
- `src/components/submittals/FilterChips/filterDefinitions.ts` — the 20 chip definitions. (planned)
- `src/components/submittals/BulkActionsMenu.tsx` (planned)
- `src/components/submittals/SavedViews/` — new directory.
- `src/components/submittals/SavedViews/SavedViewsSidebar.tsx` (planned)
- `src/services/submittalsSavedViews.ts` — CRUD against `submittal_saved_views` table (new in this PR's migration). (planned)
- New migration: `20260507XXXXX_submittal_saved_views.sql`.

### Acceptance criteria

- [ ] Add Filter dropdown shows all 20 chips, scrollable.
- [ ] Each chip type renders the right operand picker (people picker for Approver, date range for Submit By, etc.).
- [ ] Applied chips render as pills; clear-all works; URL persists state.
- [ ] Bulk Actions menu appears only when ≥1 row checked. All 6 actions wired (Edit modal can be a stub for now if Edit modal isn't built yet).
- [ ] Saved Views sidebar opens, persists views, distinguishes scope (My/Project/Company/Iris).
- [ ] At least 4 Iris-suggested views auto-generated for the demo project.
- [ ] Typecheck zero.

### Prompt for Claude Code

> Read this rebuild plan Phase 3, plus spec Part 2.2.1 (filter chip parity).
>
> Implement Phase 3 only: 20-chip Add Filter dropdown, Bulk Actions menu, Saved Views model. Includes a new migration for `submittal_saved_views` table — apply locally + regen `database.ts` in the same PR per Sprint Invariant #1.
>
> Iris-Suggested views are seeded by the existing Iris infra; do not invent a new pattern. The 4 default Iris suggestions are listed in the rebuild plan.
>
> One PR titled `submittals: phase 3 — filters, bulk actions, saved views`. Receipt with screenshots of all 20 chips, the bulk action menu open, and a saved view persisting across reload.
>
> Stop after PR opens.

---

## Phase 4 — Grouping Views (Packages, Spec Sections, Ball-in-Court)

**Goal:** Three new view tabs go live, each grouping the same Items data differently. Packages becomes a first-class entity.

### Scope

- **Packages view**: rows nested under expandable package headers (`#1: Beacon Concrete · 4 items`). Edit/View at both package level and item level. Package CRUD: create from a multi-select on Items view, edit name/description, delete (cascade to set submittals' `submittal_package_id` to null).
- **Spec Sections view**: rows grouped by CSI section (`08 41 13 Aluminum-Framed Storefronts (3 items)`). Section header shows section title from `spec_sections` reference table.
- **Ball-in-Court view**: rows grouped by current reviewer (`Melissa Ellis (Cross Architect) — 14 items`). Click reviewer name → opens a side panel with their full plate across the project. Em-dash group ("None") for closed/draft submittals.
- All three views inherit the 11-column layout, filters, bulk actions, saved views from Phase 2 and 3. Only the row grouping differs.
- Group headers show overdue badge ("⚠ 3 overdue") + count + mini progress bar (`3/5 approved`).
- Expand-all / collapse-all toolbar buttons.

### Files touched

- `src/components/submittals/PackagesView.tsx` (planned)
- `src/components/submittals/SpecSectionsView.tsx` (planned)
- `src/components/submittals/BallInCourtView.tsx` (planned)
- `src/components/submittals/GroupHeader.tsx` — shared component. (planned)
- `src/components/submittals/PackageCRUD/` — create/edit/delete dialogs.
- API: package endpoints already in spec Part 3.2 schema; verify `submittal_packages` table exists from D36 migration.
- New migration if needed for `spec_sections` reference table (CSI MasterFormat lookup).

### Acceptance criteria

- [ ] Packages, Spec Sections, Ball-in-Court tabs all render real data.
- [ ] Each grouping has expand-all / collapse-all + per-group expand chevron.
- [ ] Group headers show count + overdue badge + mini progress bar.
- [ ] Package CRUD: create from multi-select works, edit works, delete preserves submittals.
- [ ] BIC view click opens reviewer side panel with their full plate.
- [ ] All filters/bulk-actions/saved-views from Phase 3 still work in these views.
- [ ] Typecheck zero.

### Prompt for Claude Code

> Read this rebuild plan Phase 4, plus spec Part 2.2 + 3.2 (`submittal_packages` table).
>
> Implement Phase 4 only: Packages, Spec Sections, Ball-in-Court views. Each is a separate route via the view tab strip. Shared `GroupHeader` component. Package CRUD wired through the new RPCs.
>
> If `spec_sections` reference table doesn't exist, add it in this PR's migration with CSI MasterFormat seed data (Divisions 00–49, sections sourced from a reference dataset — small, < 1MB).
>
> One PR titled `submittals: phase 4 — grouping views (packages, spec sections, BIC)`. Receipt with screenshots of all three views and a package CRUD demo.
>
> Stop after PR opens.

---

## Phase 5 — Advanced Views (Kanban, Timeline, Schedule-Linked)

**Goal:** Three views Procore doesn't have. This is where SiteSync starts to *exceed* parity, not just match it.

### Scope

- **Kanban**: columns = the 9 states (Draft / Sub Uploading / GC Review / Pre-flight / Sent to Reviewer / In Review / Returned / Distribute / Closed). Card per submittal with title + sub + days in court + Iris pre-flight badge. Drag-to-advance with PermissionGate confirmation modal. Drag-from-Sub-Uploading to GC-Review bypasses the magic-link flow (PE manually marks as received).
- **Timeline**: Gantt-style. X-axis = required-on-site dates. Each submittal renders as a bar from `submit_by_date` to `required_on_site_date`. Bar color = status. Hover shows full lifecycle. Click → detail. Schedule activity overlay if `schedule_activity_id` set.
- **Schedule-Linked**: one row per schedule activity. Submittals dock under the activity that needs them. Activities sorted by start date. Each activity row collapses/expands. Activity is red if any submittal is overdue.
- Density: all three views virtualized. Kanban columns scroll independently.

### Files touched

- `src/components/submittals/KanbanView.tsx` (planned)
- `src/components/submittals/TimelineView.tsx` (planned)
- `src/components/submittals/ScheduleLinkedView.tsx` (planned)
- `src/components/submittals/SubmittalCard.tsx` — kanban card. (planned)
- Drag-and-drop: use `@dnd-kit/core` (already in package.json).

### Acceptance criteria

- [ ] Kanban renders with all 9 columns, cards draggable, PermissionGate confirms transitions.
- [ ] Timeline renders bars over date axis, color-coded by status, hover detail tooltip.
- [ ] Schedule-Linked groups submittals under their activity, red marker if overdue.
- [ ] All three views support filters/saved views from Phase 3.
- [ ] No new state-machine transitions added — drag uses the existing 9-state machine.
- [ ] Typecheck zero.

### Prompt for Claude Code

> Read this rebuild plan Phase 5, plus spec Part 2.2 (views #5, #6, #7) and Part 4 (state machine).
>
> Implement Phase 5: Kanban, Timeline, Schedule-Linked. Drag-to-advance on Kanban must call the existing `submittal_advance_status` RPC — do not add new transitions. PermissionGate confirms every drag.
>
> Schedule-Linked view requires a join against `schedule_activities`. If that table isn't yet exposed, surface a graceful empty state ("Link this submittal to a schedule activity to see it here") rather than failing.
>
> One PR titled `submittals: phase 5 — advanced views (kanban, timeline, schedule-linked)`. Receipt with screenshots of each view + a video clip of a Kanban drag with PermissionGate firing.
>
> Stop after PR opens.

---

## Phase 6 — Detail Page Shell + Overview Tab

**Goal:** Open a submittal. The page should look enterprise-grade immediately, even before the killer features land.

### Scope

- Breadcrumb: `Submittals › {Package or Spec Section} › {Title}`.
- Status banners stacked above the title:
  - Green ✓ when status = `closed` or workflow_complete
  - Blue ℹ when `distribute_at` populated ("Submittal Distributed on {date}")
  - Amber ⚠ when overdue at architect
  - Red ✗ when rejected
- Title row: `Submittal #{number} Revision {rev}: {title}`.
- Top-right action cluster (PermissionGate-wrapped): **Redistribute** (orange primary; appears only after first distribute), Export ▾, Edit, ⋮ More Options.
- 7 tabs: `Overview` (default) · `Markup` · `Revisions` · `Citations` · `History` · `Distribute` · `Emails`. Only Overview live this phase; others render placeholder ("Built in Phase {N}").
- **Overview tab content:**
  - Distribution Summary section: From, To, CC, Message (rich text), Attachments. Collapsible, default expanded.
  - General Information section: spec link, kind, required-on-site, submit-by, lead time, reviewer chain summary, deviation flag, current reviewer chain visualization (compact — full chain in Phase 7).
  - Workflow Responses cards (one per reviewer): name + company, response label, comments, attachments with `CURRENT` badge on the latest.
  - Delivery Information section: schedule task, anticipated/confirmed/actual delivery dates.

### Files touched

- `src/pages/submittals/SubmittalDetailPage.tsx` — full rewrite of the shell.
- `src/components/submittals/detail/Breadcrumb.tsx` (planned)
- `src/components/submittals/detail/StatusBanners.tsx` (planned)
- `src/components/submittals/detail/ActionCluster.tsx` (planned)
- `src/components/submittals/detail/DetailTabs.tsx` (planned)
- `src/components/submittals/detail/Overview/DistributionSummary.tsx` (planned)
- `src/components/submittals/detail/Overview/GeneralInformation.tsx` (planned)
- `src/components/submittals/detail/Overview/WorkflowResponseCards.tsx` (planned)
- `src/components/submittals/detail/Overview/DeliveryInformation.tsx` (planned)

### Acceptance criteria

- [ ] Breadcrumb renders with click-back navigation.
- [ ] Status banners stack correctly per state.
- [ ] Action cluster renders Redistribute / Export / Edit / ⋮. PermissionGate wraps each.
- [ ] 7 tabs render. Only Overview interactive.
- [ ] Overview tab shows all 4 sections with real data.
- [ ] Login bounce from Phase 8 is *not* a blocker here — separate ticket. But verify: does opening detail from the log redirect to login? If yes, that's Phase 8's P1 bug; document but don't fix in Phase 6.
- [ ] Typecheck zero.

### Prompt for Claude Code

> Read this rebuild plan Phase 6, plus spec Part 2.4 (detail page IA) and Part 6 (sub/reviewer experience).
>
> Implement Phase 6: detail page shell + Overview tab only. Markup, Revisions, Citations, History, Distribute, Emails tabs render `<EmptyTabPlaceholder phase={N}>` placeholders.
>
> Workflow chain visualization in this phase is the **compact** version — names + statuses only. The full chain table with sent/due/returned dates per reviewer ships in Phase 7. Do not over-build.
>
> One PR titled `submittals: phase 6 — detail page shell + overview`. Receipt with screenshots of the new detail page on a real submittal.
>
> Stop after PR opens.

---

## Phase 7 — Workflow Chain + Citations Side Panel

**Goal:** The two killer features of the detail page. After this phase, the detail page is at parity with Procore plus has the citations side panel that no incumbent ships.

### Scope

- **Workflow chain table** in the Overview tab:
  - One row per step, labeled `# 1`, `# 2`, etc.
  - Columns: Name (+ company), Sent Date, Due Date, Returned Date, Response, Comments, Attachments (with `CURRENT` badge on latest), Version, Actions (delegate / forward / mark received).
  - Parallel reviewers rendered as multiple rows under the same step number.
  - Pending reviewers show `Pending` in Response column with grey style.
  - General Information Attachments row sits at the top of the table (the originating package).
- **Citations side panel** (right-rail dock):
  - Toggle button on the action cluster: `📎 Citations (N)`.
  - Slides in from the right, ~400px wide, doesn't push content (overlays).
  - Lists 4 citation kinds (per `IRIS_CITATIONS_SPEC` and spec Part 8): spec section, prior submittal, industry standard, submittal package item.
  - Click any citation → preview pops *inside* the side panel (PDF page render with highlight rect). Never modal, never full-page nav (per ADR-004).
  - Citation count badge updates live as Iris pre-flight runs.

### Files touched

- `src/components/submittals/detail/Overview/WorkflowChainTable.tsx` — the new dense table. (planned)
- `src/components/submittals/detail/CitationsSidePanel.tsx` — the right-rail dock. (planned)
- `src/components/submittals/detail/CitationsSidePanel/CitationCard.tsx` — per citation. (planned)
- `src/components/submittals/detail/CitationsSidePanel/CitationPreview.tsx` — PDF preview with highlight rect. (planned)
- Reuses existing `react-pdf` setup.

### Acceptance criteria

- [ ] Workflow chain table renders with parallel reviewers in same step number.
- [ ] All 8 columns present. CURRENT badge migrates to the latest revision attachment.
- [ ] Pending reviewers visually distinct.
- [ ] Citations side panel opens from action cluster button.
- [ ] All 4 citation kinds render distinct cards.
- [ ] Click citation → PDF preview docked in side panel with highlight rect visible.
- [ ] Side panel closes via `×` or `Esc`.
- [ ] Typecheck zero.

### Prompt for Claude Code

> Read this rebuild plan Phase 7, plus spec Part 8 (Iris citations) and `IRIS_CITATIONS_SPEC_2026-05-04.md` and `ADR_004_CITATION_SIDE_PANEL_2026-05-04.md` (side panel pattern, not modal).
>
> Implement Phase 7: workflow chain table + citations side panel. The side panel must follow ADR-004 — overlay from right, never push content, never modal, never full-page nav.
>
> Workflow chain table uses the existing `submittal_reviewers` data (from D36 migration). Parallel reviewers share `parallel_group` value within a step.
>
> One PR titled `submittals: phase 7 — workflow chain + citations`. Receipt with screenshots of a workflow chain with parallel reviewers, citations side panel open with a PDF preview, and the panel persisting across detail-page navigation.
>
> Stop after PR opens.

---

## Phase 8 — Mobile + Login Fix + Polish

**Goal:** Last lap. Responsive across every breakpoint, Recycle Bin live, login bounce fixed, polish pass.

### Scope

- **Login bounce P1 fix.** Investigate the redirect-to-login on row click during the visual audit. If it's session expiry, add a 5-min warning toast (`Your session expires in 5:00 — refresh now?`). If it's a routing bug, fix the `react-router` config so detail routes don't fall through to the login redirect.
- **Recycle Bin** view: deleted submittals (soft-deleted only — `void` state). Restore action. Permanent-delete is admin-only with confirmation modal.
- **Responsive layout** down to 360px mobile width:
  - View tab strip becomes a dropdown on < 768px.
  - Items view collapses to 4 essential columns (#, Title, Status, BIC).
  - Detail page tabs become a horizontal scroll on < 768px.
  - Action cluster collapses to ⋮ menu only.
- **Polish pass:**
  - Empty states for every view (no submittals yet — call to action).
  - Loading skeletons (not spinners) for log + detail.
  - Optimistic updates on disposition (UI advances before RPC returns; rolls back on failure).
  - Iris pre-flight badge on every row (red if any P0 finding, amber if P1, green if clean).
  - Re-add `Priority` column **only if** we tied it to `is_critical_path` (per Phase 1's drop). If not yet tied, leave dropped.
  - Keyboard shortcuts: `n` = new, `f` = filter, `/` = search, `j/k` = next/prev row, `o` = open detail, `e` = edit.

### Files touched

- `src/router/submittalRoutes.ts` — route guards for the login bounce fix. (planned)
- `src/components/submittals/RecycleBinView.tsx` (planned)
- All view components — responsive media queries.
- `src/hooks/useKeyboardShortcuts.ts` — extend for submittals.

### Acceptance criteria

- [ ] Login bounce reproduced + root-caused + fixed (or session-expiry warning toast added).
- [ ] Recycle Bin view live with restore + permanent-delete (admin only).
- [ ] At 360px width, all 8 views are usable without horizontal scroll.
- [ ] Empty states wired for every view.
- [ ] Loading skeletons (not spinners).
- [ ] Optimistic updates roll back on failure.
- [ ] Keyboard shortcuts work.
- [ ] Typecheck zero. Existing tests pass. Lighthouse score ≥ 90 on mobile.

### Prompt for Claude Code

> Read this rebuild plan Phase 8 + the visual audit's P1 incident on login bounce.
>
> Implement Phase 8: login bounce fix, Recycle Bin view, responsive layout, polish pass. Reproduce the login bounce from the visual audit before fixing — root-cause analysis in the PR description.
>
> Recycle Bin queries `submittals where status = 'void'`. Permanent delete is admin-only and requires a typed-confirm "DELETE" pattern.
>
> Responsive target: 360px wide is usable. Use Tailwind responsive prefixes throughout. Test on a real iPhone Safari simulator if available.
>
> One PR titled `submittals: phase 8 — mobile, login fix, polish`. Receipt with: (a) login bounce root-cause writeup, (b) screenshots at 360 / 768 / 1440 / 1920 widths, (c) Lighthouse mobile score.
>
> Stop after PR opens. Phase 8 is the last UI-rebuild phase. Next handoff after merge is Phase P1 — Spec Importer (existing task #14).

---

## What ships when

- **After Phase 1:** page looks enterprise-grade, even though only Items view is live.
- **After Phase 2:** Items view is at Procore parity for density.
- **After Phase 3:** filters, bulk actions, saved views — toolbar power. The "outstanding-items in 3 clicks" promise lands.
- **After Phase 4:** Packages + Spec Sections + BIC views. Procore parity on view modes.
- **After Phase 5:** Kanban + Timeline + Schedule-Linked. *Exceeds* Procore on view modes.
- **After Phase 6:** detail page shell + Overview tab. Detail flow matches Procore IA.
- **After Phase 7:** workflow chain + citations side panel. Now we exceed Procore on detail.
- **After Phase 8:** mobile + login fix + polish. Lap 2 UI ships.

Then P1+ (spec importer, AI pre-flight, magic-link, rev-diff, mobile push, closeout, federal) layer on this parity-grade foundation.

---

## Verification protocol per phase

After each phase's PR opens, before merging:

1. **Read the PR description.** Claude Code's "I made these decisions" lines are your design-review moment.
2. **Open the live preview** (Vercel preview URL on the PR).
3. **Walk the acceptance criteria** above — each box must be checked.
4. **Side-by-side with Procore** for the equivalent surface (you have both tabs).
5. **Drop one screenshot in the PR thread** confirming the visual change, paste into the receipt for the audit log.
6. **Merge.** Then come back to me and we fire the next phase's prompt.

If a phase fails acceptance, request a fix-it commit on the same PR. Don't merge half-done phases — the next phase will compound the gap.

---

## Backlog map

This rebuild plan replaces tasks #11, #12, #13 in the cowork tasklist (the broad D39/D40/D41-D42 items). New tasks #20-#27 represent these 8 phases (created alongside this doc). Phases 1-8 must complete before P1+ tasks #14-#18 (Spec Importer through P5 Polish).

---

**End of plan.** When you're ready to start Phase 1, paste the Phase 1 prompt block above to Claude Code. Confirm D38 is merged first.
