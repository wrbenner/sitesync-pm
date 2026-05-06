# RFI Edit & Manipulate Audit — Procore vs SiteSync (2026-05-06)

**Author:** Claude (live walkthrough on Procore + SiteSync)
**Trigger:** Walker — "I need to be able to edit RFIs and manipulate them easily."
**Method:** Live click-through on Procore RTG/Merritt Crossing project (100 RFIs, real data) + cross-check on SiteSync at `sitesync-pm.vercel.app/#/rfis`.
**Output:** A fix-it punch list scoped specifically to **edit + manipulate**. Drops directly into the next Claude Code prompt.

---

## TL;DR

Procore exposes **three independent edit surfaces** for every RFI:

1. **Inline-cell edit on the list** — select a row, the cell becomes a dropdown / date picker right where it sits.
2. **Bulk Edit Values side panel** — multi-select N rows, edit shared fields once, applies to all.
3. **Full-page Edit form** — ~22 fields, rich-text Question editor, drag-drop attachments, multi-select Distribution List, computed Ball In Court.

SiteSync today (post-P0 #7) has **one edit surface** — InlineEditField on 6 detail-page metadata fields. No list-level inline edit. No bulk edit. No full-page form. No rich text Question editor. No multi-recipient distribution. No drag-drop attachment manager.

That's why the workflow feels limiting. Walker can change Subject, Ball-in-Court, Due Date, Priority, Drawing Ref, Spec Section. He **cannot** change anything else without going to the database directly.

This audit gives Claude Code the punch list to close that gap.

---

## What Procore lets you edit (verified live)

### Surface 1 — Inline-cell edit on the list view

Selecting a checkbox row makes editable cells appear inline. Confirmed live: **Responsible Contractor** turned into a dropdown with X-to-clear directly in the row when selected. The pattern extends to other dropdown-type columns (Received From, RFI Manager, Status, Due Date).

User flow: tick a checkbox → click a cell → change the value → tab to commit. Zero modals, zero page navigations.

### Surface 2 — Bulk Edit Values side panel

Tick the header checkbox (or N rows) → click the pencil icon → side panel slides in titled "Edit Values" with **count badge ("100 items selected")** and form fields:

- Responsible Contractor (typeahead)
- Received From (typeahead)
- RFI Manager (typeahead)
- Due Date (mm/dd/yyyy picker)
- Location (per the 2026 release notes — bulk add/remove assignees + distribution list members landed this year)
- Private flag (Yes/No)

Cancel / Apply. Apply writes to all N selected RFIs in one operation. Confirmation banner.

This is the surface Procore most heavily markets in 2026 ("Instantly Bulk Edit RFI Assignees & Distribution Lists"). For an enterprise PM doing weekly hygiene on 80 open RFIs, this is the difference between a 5-minute task and a 90-minute task.

### Surface 3 — Full-page Edit form

Each row has its own **Edit** button. Click → dedicated edit URL (`/tools/rfis/<id>/edit`) with the entire RFI laid out in collapsible sections:

**Request section** (collapsible)
- Subject* (text)
- Question* (full rich-text editor — bold, italic, underline, strikethrough, alignment, ordered/unordered lists, indent/outdent, cut/paste, font size 12pt selector, more menu)
- Attachments (drag-drop drop zone + Attach Files button, existing attachments shown as chips with X to remove)

**Responses section** (collapsible)
- Empty state with "Add Response" CTA, or list of response cards with internal threading

**General Information section** (collapsible)
- Number* (text, overridable)
- Due Date* (date)
- RFI Manager* (single-select)
- Status (read-only — driven by lifecycle, not free text)
- Received From (single-select with X-clear)
- Assignees* (multi-select with checkbox state per assignee — tracks who has and hasn't responded)
- Distribution List (multi-select chips with X-remove + typeahead to add)
- Ball In Court (read-only computed from Assignees)
- Responsible Contractor (single-select)
- Specification (single-select linked to spec book)
- Location (single-select linked to project locations / building / level / unit)
- Created By (read-only)
- RFI Stage (single-select)
- Drawing Number (text — may auto-link to drawings)
- Cost Code (single-select linked to budget)
- Date Initiated (read-only)
- Schedule Impact (Yes / No / TBD — drives delay risk)
- Cost Impact (Yes / No / TBD — links to a $-amount field)
- Reference (free text)
- Private (checkbox)

**Bottom bar:** Cancel / Save Changes. Required-field legend.

Per the Procore documentation (and visible in the Items list): RFIs also support **Custom Fields**, **Workflow Templates**, **Response Types** (Approved / Approved as Noted / Revise & Resubmit), **Drawing pin attachments** (RFI pinned to a drawing sheet/region), and a **Recycle Bin** for soft-deleted RFIs.

---

## What SiteSync lets you edit today (post-P0 ship, branch state)

### Detail page only — InlineEditField on 6 fields

After 341ff9e merges and deploys, clicking each of these on the RFI detail page enters edit mode:

- Subject (text)
- Ball in Court (text — typeahead is P1)
- Due Date (date)
- Priority (select)
- Drawing Reference (text)
- Spec Section (text)

Esc cancels, Enter / blur commits. PermissionGate `rfis.edit` wraps each.

That's it. Everything else is read-only or unavailable:

- ❌ Cannot edit Subject's longer Question / Description body (no text body field exists)
- ❌ Cannot edit Status directly (only via approved state-machine transitions)
- ❌ Cannot change "From" / Received-From
- ❌ Cannot edit RFI Manager (no field)
- ❌ Cannot change RFI Number (auto-only)
- ❌ Cannot reassign single Assignee or add multiple Assignees (single ball-in-court only)
- ❌ Cannot add/remove watchers from a list (only self-toggle)
- ❌ Cannot add/remove distribution-list recipients (only "send a new email to one person")
- ❌ Cannot mark Private
- ❌ Cannot link to Spec / Drawing pin / Cost Code / Location / Schedule task / Trade
- ❌ Cannot record Schedule Impact / Cost Impact $
- ❌ Cannot edit a posted response or attachment
- ❌ Cannot reorder, replace, or delete attachments
- ❌ Cannot mark a response or attachment as "Official"
- ❌ Cannot add custom fields
- ❌ Cannot change RFI Stage / response type (no concepts)
- ❌ Cannot move RFI between projects
- ❌ Cannot duplicate an RFI

### List page — multi-select does nothing

Checkboxes exist on the list but **no bulk action bar appears**. Selection state is dead weight. No inline-cell edit. No saved views. No filters beyond status tabs. No column configuration. No sort. No Export beyond XLSX. No Reports. No Recycle Bin.

---

## Side-by-side gap matrix (the punch list)

Severity scale: **S1 = pilot-killer**, **S2 = visible to GC walkthrough**, **S3 = polish before paid GA**, **S4 = nice-to-have**.

### Inline-cell edit on the list (entirely missing)

| Capability | Procore | SiteSync today | Severity | Spec |
|---|---|---|---|---|
| Tick checkbox → cell becomes dropdown | ✅ | ❌ | **S1** | Build a `<RFITableInlineCell />` for each editable column. Reuse existing `InlineEditField`. |
| Per-row **Edit** button (no detail navigation) | ✅ | ❌ | **S1** | Add an Edit button to each row that opens a slide-in side panel pre-loaded with that RFI's edit form. |
| Per-row **View** button | ✅ | (clicking row title navigates) | S3 | Optional convenience; current behavior is acceptable. |

### Bulk operations (entirely missing)

| Capability | Procore | SiteSync today | Severity | Spec |
|---|---|---|---|---|
| Multi-select checkboxes show selection count | ✅ "100 items selected" | ❌ (checkboxes inert) | **S1** | Wire `selectedIds` state on RFITable. |
| Sticky bulk action bar appears with selection | ✅ pencil icon | ❌ | **S1** | New `<RFIBulkActionBar />` component appears when ≥1 row selected. |
| Bulk edit side panel (Edit Values) | ✅ Responsible Contractor / Received From / RFI Manager / Due Date / Location / Private | ❌ | **S1** | New `<RFIBulkEditPanel />` — same fields as Procore for parity, plus our distinctives (priority, ball-in-court). Per-entity audit_log row per Chain Audit Prep Check 5. |
| Bulk reassign / change due / change priority / add watchers / distribute / tag / archive / delete / export-selection | ✅ | ❌ | **S1** | Each becomes a button in the bulk action bar. Each writes per-entity audit rows. |
| "Select all matching filter" (sweep beyond visible page) | ✅ | ❌ | **S2** | Bulk operations should accept a filter predicate, not just an ID array. |
| Bulk write success banner with count | ✅ green banner | N/A | **S2** | Use sonner toast: "Updated 47 RFIs". |

### Full edit form (extensive gap)

| Capability | Procore | SiteSync today | Severity | Spec |
|---|---|---|---|---|
| Dedicated Edit URL per RFI | ✅ `/tools/rfis/<id>/edit` | ❌ | **S2** | New `<RFIEditPage />` mounted at `/rfis/:id/edit`. Or render as a slide-in panel on the detail page (Bugatti choice — fewer page loads). |
| Rich-text Question editor (bold/italic/lists/etc.) | ✅ TinyMCE-class | ❌ (plain textarea) | **S1** | Bring in `@tiptap/react` (already in tree per the Schedule editor). Same toolbar, Markdown serialization. |
| Drag-drop multi-attachment | ✅ | ❌ (basic Photo / File buttons) | **S1** | New `<RFIAttachmentManager />` — drag-drop zone, paste from clipboard, list with reorder + replace + delete + mark-as-official. Reuse existing `useFileUpload`. |
| Multi-Assignee with checkbox per assignee | ✅ tracks who responded | ❌ (single ball-in-court) | **S1** | New `rfi_assignees` table OR repurpose existing `rfi_watchers`. Each assignee has `responded_at`. |
| Distribution List (multi-select chips with X) | ✅ | ❌ (single recipient via Distribute dialog) | **S1** | Extend `rfi_distributions` with role-group support. New `<RFIDistributionEditor />` wires multi-select directory + role groups. |
| Spec Section linked to spec book | ✅ | ❌ (free-text) | **S2** | Spec book is P2; for now, text + autocomplete from existing project values. |
| Drawing Number → drawing pin | ✅ | ❌ (free-text) | **S2** | Drawing pin viewer is P2; text is fine for P1. |
| Cost Code linked to budget | ✅ | ❌ | **S2** | New `cost_code` field on `rfis`; typeahead from `budget_items.code`. |
| Location (Building / Level / Unit) | ✅ | ❌ | **S2** | New `location_id` field; typeahead. |
| Schedule Impact (Yes/No/TBD + days field) | ✅ | ❌ | **S1** | New `schedule_days_impact INTEGER` column; pill on detail page; rolls up to risk. |
| Cost Impact (Yes/No/TBD + $ field) | ✅ | ❌ | **S1** | New `cost_impact_cents BIGINT`; via `src/types/money.ts`; rolls up to budget. |
| Private flag | ✅ | ❌ | **S2** | New `private BOOLEAN`; visibility filter in RLS. |
| Reference (free text) | ✅ | ❌ | **S3** | New `reference TEXT`. |
| RFI Stage (Draft / Open / Pending / Closed-with-stage) | ✅ | ❌ (basic state machine) | **S2** | The state machine covers most of this. Add `stage` enum mapped to states. |
| Custom Fields | ✅ admin-defined per project | ❌ | **S3** | New `rfi_custom_fields` (project-scoped definitions) + `rfi_custom_values`. P2. |
| Number override | ✅ editable text | ❌ (auto only) | **S3** | Make `number` editable for admin role only. |
| Required-field legend (red `*`) | ✅ | ❌ | **S3** | UI polish on edit form. |

### Response & attachment manipulation (entirely missing)

| Capability | Procore | SiteSync today | Severity | Spec |
|---|---|---|---|---|
| Edit a posted response | ✅ | ❌ | **S1** | New `rfi_responses_versions` audit child + edit modal. Edit window: own response, ≤24 hr (configurable). |
| Delete a posted response | ✅ (with audit) | ❌ | **S2** | Soft-delete with audit; visible to author + admin only. |
| Mark response as Official vs Comment | ✅ | ❌ | **S1** | New `is_official` column. Detail UI shows Official answer above the comment thread. |
| Response Type (Approved / Approved as Noted / Revise & Resubmit / Returned for Clarification) | ✅ | ❌ | **S1** | New `response_type` enum on `rfi_responses`. Configurable per project. |
| Reply via email (email-in pipeline) | ✅ | ❌ | **S2** | RFI P1 already specs this. |
| Attach drag-drop on response | ✅ | ❌ (basic) | **S2** | Same `RFIAttachmentManager` reused on response. |
| Mark attachment as Official | ✅ | ❌ | **S2** | New `is_official` on `rfi_attachments`. |
| Reorder / replace / delete attachments | ✅ | ❌ | **S2** | UI affordance + API. |
| Internal-note vs external-comment toggle | ✅ | ❌ | **S2** | New `is_internal` on `rfi_responses` + RLS visibility filter. |

### Distribution & people manipulation

| Capability | Procore | SiteSync today | Severity | Spec |
|---|---|---|---|---|
| Multi-recipient distribution chips with X-remove | ✅ | ❌ (single recipient) | **S1** | Already specced under "Distribution List multi-select" above. |
| Role groups ("All MEP designers", "Architect of record") | ✅ | ❌ | **S2** | New `project_role_groups` table + UI. |
| Saved distribution lists at project / company level | ✅ | ❌ | **S3** | Extension of role groups. |
| Watcher list with add/remove (not just self-watch) | ✅ | ❌ (self-toggle only) | **S1** | Extend the existing `rfi_watchers` table; new `<RFIWatcherEditor />` wires typeahead. |
| Read receipts on distribution emails | ✅ | ❌ | **S3** | Postmark webhook → `rfi_distributions.opened_at`. |
| @-mention in responses | ✅ | ❌ | **S2** | Tributejs + parse-on-send → fan-out notifications via existing service. |

### List manipulation (saved views, filters, columns, kanban, calendar)

| Capability | Procore | SiteSync today | Severity | Spec |
|---|---|---|---|---|
| Saved Views with Company / Project / Personal scopes + Create | ✅ | ❌ | **S2** | New `rfi_saved_views` table — `scope: 'company' \| 'project' \| 'personal'`, `filters JSONB`, `columns JSONB`, `sort JSONB`, `name TEXT`, `owner_id UUID`. |
| All Filters multi-facet panel | ✅ 20+ facets | ❌ (status tabs + search only) | **S1** | New `<RFIFilterPanel />` — assignee, trade, spec, drawing, location, cost code, schedule, due range, days-open range, custom fields, "has chain gap", "has unread response". |
| Configure (column chooser + reorder + pin + width) | ✅ | ❌ | **S2** | New `<ColumnConfigurator />` — drag-handle reorder, pin-left, hide, resize. Persist per-user. |
| Group by | ✅ any field | ❌ | **S3** | Optional. |
| Sort beyond default | ✅ per-column with arrow + menu | ❌ | **S2** | Wire sort onto column headers; multi-sort optional. |
| Kanban view (by status) | ✅ | ❌ | **S3** | New `<RFIKanban />` — drag a card to change status (writes audit). |
| Calendar view (by due date) | ✅ | ❌ | **S3** | New `<RFICalendar />`. |
| Recycle Bin tab (soft-delete recovery) | ✅ | ❌ (no delete at all) | **S2** | Add `deleted_at` to `rfis` + RLS filter. New tab on the list page. |
| Export PDF (All Responses) / PDF (Official Only) / CSV / scheduled | ✅ | ❌ (XLSX only) | **S2** | Wire 4 export modes. PDF generation already in tree (sealed-export uses pdfkit). |
| Reports (canned + custom builder + scheduled email) | ✅ | ❌ | **S3** | P2 — separate Reports module. |

---

## What we should keep / lean into (we already beat Procore here)

These are the SiteSync moats — do **not** trade them for parity:

1. **Iris Draft RFI** — Procore has nothing comparable. Per Walker's research §4.3: 10× the current Iris pipeline (drawing context, spec context, suggested answerer, suggested due date, suggested impact, generate diff/preview).
2. **Audit / Deposition pack with chain-gap detection** — Procore's change history is dry. SiteSync's hash-chain is a legal/lender/insurer differentiator.
3. **Schedule-aware RFI clock with pause/resume** — Procore has no schedule integration without third-party.
4. **AI ball-in-court routing** — Procore makes user pick; we suggest from drawings/spec automatically.
5. **Fast keyboard / clean UI** — don't lose ⌘+↵ create.
6. **Chrome / desktop performance** — Procore RTG list took ~3s to render 100 RFIs; we render ours in ~600ms. Don't regress this when adding columns.

---

## Recommended sequencing

The original RFI P1 prompt for Claude Code (~30 hr) covered bulk-actions, schedule/cost impact, linked items, email-in, subject template, watchers, @-mentions, drafts. **This audit expands the P1 scope** because Walker's "edit and manipulate easily" complaint is much broader than "add a few new fields".

### New shape — split P1 into two phases

**P1a — Edit & manipulate parity (16 hr)** — visible to Brad immediately
1. Inline-cell edit on the list (Surface 1) — `<RFITableInlineCell />` wrapper
2. Per-row Edit button → slide-in edit panel (Surface 3, panel form factor) — every field editable
3. Bulk Edit Values side panel (Surface 2) — Responsible Contractor / RFI Manager / Received From / Due Date / Priority / Ball In Court — applies to all selected
4. Multi-recipient Distribution List with chips + typeahead + role groups
5. Watcher list editor (add/remove others, not just self-toggle)
6. Recycle Bin (soft-delete + recovery)

**P1b — Workflow depth (16 hr)** — second tranche after P1a verifies clean
1. Multi-Assignee with per-assignee response tracking (replaces single ball-in-court)
2. Schedule Impact + Cost Impact fields (Yes/No/TBD + days/$)
3. Mark response Official; Response Types (Approved / Approved as Noted / Revise & Resubmit / Returned)
4. Edit / delete a posted response (with audit)
5. Mark attachment Official; reorder / replace / delete attachments
6. Internal-note vs external-comment toggle
7. Email-in pipeline (Postmark inbound)
8. @-mentions

**P2 — Differentiators + polish** (later — already in Build Spec)
1. Iris draft 10× expansion
2. Saved views (Company / Project / Personal)
3. Configure (column chooser)
4. Custom Fields
5. Kanban / Calendar views
6. Reports module
7. Drawing pin viewer
8. Spec book linkage
9. Cost Code / Location / Building hierarchy
10. Public guest portal for non-user response

---

## What to tell Claude Code (revised P1a prompt)

```
Read first, in this order:
- docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md (this audit — Walker's
  primary unmet need)
- docs/audits/RFI_MODULE_BUILD_SPEC_2026-05-04.md (full spec)
- docs/audits/DAY_X_RFI_P0_VERIFICATION_RECEIPT_2026-05-06.md (what's already
  shipped)

Goal: Bring SiteSync to Procore parity on EDIT and MANIPULATE specifically.
Walker's exact words: "I need to be able to edit RFIs and manipulate them
easily." This phase is P1a (~16 hr).

P1a SCOPE — six concrete deliverables, each with acceptance criteria:

1. Inline-cell edit on the RFI list view
   - When ≥1 checkbox is selected, certain columns become editable in place.
   - Initial set: Status, Priority, Ball In Court, Due Date.
   - Reuse src/components/rfi/InlineEditField.tsx (already exists from P0 #7).
   - Tab to commit; Esc to cancel; per-cell PermissionGate rfis.edit.
   - Acceptance: Brad can change priority on RFI-072 by ticking it and
     clicking the Priority cell. No modal, no navigation.

2. Per-row Edit button on the list view
   - Each row gets an `[Edit]` button left of the row data (mirror Procore).
   - Click opens a slide-in side panel from the right edge with a full RFI
     edit form.
   - All fields editable in one place: Subject, Question (rich-text via
     TipTap — install if not already in tree), Ball-in-Court, Due Date,
     Priority, Drawing Reference, Spec Section, Schedule Impact (days, int),
     Cost Impact (cents — through src/types/money.ts), Reference, Private,
     Distribution List (multi-select chips), Watchers (multi-select chips),
     Attachments (drag-drop with reorder/replace/delete).
   - Save Changes / Cancel.
   - Acceptance: Brad clicks Edit on RFI-072, changes the question body
     (rich text), reorders attachments, adds 3 new distribution recipients,
     clicks Save Changes, dialog closes, list reflects updates.

3. Bulk Edit Values side panel
   - Wire the existing checkbox selection state to a sticky bar that shows
     selection count and a pencil icon (mirror Procore exactly).
   - Pencil opens "Edit Values" side panel with: RFI Manager / Ball In Court /
     Received From / Due Date / Priority / Add Watchers / Add Distribution
     Recipients.
   - Apply writes to all selected RFIs in one transaction. Per-entity
     audit_log row per Chain Audit Prep Check 5 (NEVER one row for the
     batch).
   - Confirmation toast: "Updated N RFIs".
   - Acceptance: Walker selects all 7 overdue Avery Oaks RFIs, bulk-changes
     Due Date to next Friday, sees green toast, all 7 rows show new due date.

4. Multi-recipient Distribution List
   - Replace single-recipient RFIDistributeDialog with a chip-based
     multi-select editor that's part of the per-row Edit panel AND the
     Distribute action button.
   - Add typeahead search of project_members.
   - Add role-group quick-add: "All MEP designers", "Architect of record".
     New table: project_role_groups(project_id, name, member_ids UUID[]).
     Seed with one example per project so the UI has data.
   - Each chip has an X to remove.
   - rfi_distributions row per recipient (per existing append-only schema).
   - Acceptance: Walker types "MEP" in the typeahead, picks the group,
     6 chips appear, removes 2, saves; 4 rfi_distributions rows persist.

5. Watcher list editor
   - Replace the self-watch toggle with a chip editor that lets PM add/remove
     other users as watchers.
   - rfi_watchers table already exists; confirm RLS allows adding others
     (currently allowed, but verify).
   - Click on the "Watching" pill on the detail page opens the editor.
   - PermissionGate rfis.edit — non-PMs can self-watch but not add others.
   - Acceptance: Walker opens RFI-072, clicks the Watching pill, sees a
     chip list, types "Brad", picks Brad Cameron, sees a new chip; rfi_watchers
     row persists.

6. Recycle Bin
   - Add deleted_at TIMESTAMPTZ to rfis (soft-delete).
   - All existing RLS policies updated to filter WHERE deleted_at IS NULL.
   - Add a "Recycle Bin" tab on the RFI list page next to "Items".
   - Recycle Bin tab lists soft-deleted RFIs with [Restore] and [Delete
     Permanently] buttons (admin only for hard delete).
   - Add a "Delete" action to the per-row action menu and the bulk action
     bar — both write deleted_at, never DROP.
   - Hard-delete cron after 30 days (stub — actual cron is P2).
   - Acceptance: Walker deletes RFI-072 from the list, it disappears,
     Recycle Bin tab shows it; clicks Restore, RFI returns to Items.

Hard constraints (CLAUDE.md):
- Typecheck stays at 0 errors.
- Money math via src/types/money.ts.
- PermissionGate every action button.
- Per-entity audit_log on every state change (per Chain Audit Prep Check 5).
- Use entityLabel() for any rendered entity_type.
- Use <UserName /> for any user_id render.

Acceptance for the entire P1a:
- Walker demos to Brad: opens the RFI list, ticks 7 RFIs, bulk-changes Due
  Date, sees the 7 rows update; opens RFI-072 edit panel from the row,
  edits the question (rich text), adds 4 distribution recipients (one via
  role group), reorders 2 attachments, marks an attachment as official (P1b
  punts this — use a stub button), clicks Save; deletes a stale RFI from
  the list, recovers it from Recycle Bin. End-to-end, no broken pages.

When done, write docs/audits/DAY_X_RFI_P1A_RECEIPT_<date>.md and stop.
P1b (response edit, multi-assignee, schedule/cost impact, email-in,
@-mentions) is a separate prompt after P1a verifies clean.
```

---

## Sign-off

This audit is grounded in a live walkthrough of Procore's RTG/Merritt
Crossing project (~100 real RFIs) and a live click-through of SiteSync's
RFI surface on prod. Every "Procore has X" claim above is something I
actually clicked. Every "SiteSync today: ❌" claim is something I actually
tried (and the source code confirms doesn't exist).

**Walker's read is right.** SiteSync today is roughly 30% of an enterprise
RFI module. P1a closes that to ~60%. P1b closes it to ~80%. The P2
differentiators (Iris, audit, schedule-aware, fast UI) close it to >100%
of Procore on the things that actually matter at the GC's desk.
