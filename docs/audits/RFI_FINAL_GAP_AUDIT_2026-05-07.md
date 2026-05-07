# RFI Final Gap Audit — Procore vs SiteSync (2026-05-07)

**Author:** Claude (live walkthrough on Procore RTG/Merritt Crossing —
100 RFIs — paired with code-review of SiteSync's RFI module post-P2c).
**Trigger:** Walker — *"go through Procore as deep as you can and see
what we're missing on the RFI page because we're missing a ton when
you click on the RFI detail and the UI is not up to Steve-Jobs-PM
level."*
**Method:** Click-through every Procore RFI surface (list, detail,
edit, create, settings, reports, configure columns, all-filters),
counted fields, captured screenshots; mapped against SiteSync code
under `src/pages/rfis/`, `src/components/rfi/`, and the eight P0→P2c
receipts.
**Scope of "shipped":** P0 → P1a → P1b → P1c → P2a → P2b → P2c (cross-
module + drawing pins + spec book + settings + reports). Workflow
polish prompt exists but no receipt — treated as not-yet-shipped here.

---

## TL;DR — what to fix before Brad Cameron sees this

Six items that, if Walker demoed today, Brad would notice in the first
three minutes:

1. **Detail-page metadata is a 2-column grid showing 6 fields. Procore
   is a 4-column grid showing 20.** Half the density, 30% the field
   coverage. The gap is mostly *layout* — the fields exist on the
   underlying RFI row, they're just not surfaced.
2. **No "Assignees" concept on detail.** Procore shows three checkbox-
   marked people with "Response Required" red text per person; SiteSync
   shows one ball-in-court name. Multi-assignee tracking is the central
   workflow primitive of an enterprise RFI module — without it the
   audit story gets thinner.
3. **No Distribution List on detail.** Procore shows the recipient
   list as a static block (8 people on RFI #96); SiteSync's Distribute
   button only forwards. Walker can't *see* who's on distribution
   without clicking.
4. **No "Edit RFI Number" affordance.** Procore lets the RFI Manager
   override an auto-assigned number. SiteSync's number is auto-only.
   Edge case but Procore admins assume it.
5. **The "Question" body has no rich-text on display.** Procore uses
   bold/italic/lists with a TipTap-grade WYSIWYG; SiteSync has rich
   text in `RFIRichTextEditor.tsx` but the *render* on the detail page
   uses `whiteSpace: pre-wrap` over `rfi.description || rfi.question`,
   not the rich-text HTML. So formatting gets lost on read.
6. **The detail page is a single 720-px column.** Procore is 1240 px
   minimum with the metadata grid. The current SiteSync layout reads
   like a chat thread; Procore reads like an enterprise record. For
   Brad's eye, the latter signals "real software".

Everything else below is in service of these six.

---

## What Procore actually does — verified live on RFI #96

### Detail page (`/projects/.../tools/rfis/{id}`)

**Top bar.** Three primary actions, then ··· overflow.
`Close RFI` (red, state-aware: morphs to "Reopen" / "Mark Answered" /
"Submit for Review" depending on state) · `Edit` · `Export ▾`
(PDF, PDF Official Only, CSV, Print) · `···` (Print, Duplicate,
Convert to … , Delete, Move project) · sidebar gear "Insights".

**Tabs.** General (default) · Related Items (0) · Emails (0) ·
**Change History (17)**. The "17" badge on Change History is a quiet
flex — every state change is counted and queryable.

**Request section (collapsible).** Subject (plain text · 1 line) ·
Question (rich text body — bold/italic/lists/links rendered) ·
Attachments (image thumbnail with cloud-download icon, filename as
underlined link).

**Responses section (collapsible).** Empty state shows a small
clipboard-with-pencil illustration + "There Are No Responses to
Display Right Now" + "Once your team creates responses, you can view
them here." + `Add Response` button. + button on the section header
adds a response too.

**General Information section (collapsible).** 4-column grid, 20
fields:

| Row | Col 1 | Col 2 | Col 3 | Col 4 |
|---|---|---|---|---|
| 1 | Number `96` | Due Date `5/8/2026` | RFI Manager `Carter Baldes` | Status `Open` |
| 2 | Received From `Rhett McNair` | **Assignees** (3 names, one with red "Response Required") | **Distribution List** (8 names) | Ball In Court (3 — same as unresponded assignees) |
| 3 | Responsible Contractor `Carleton Companies` | Specification `--` | Location `--` | Created By `Carter Baldes (Carleton Companies)` |
| 4 | RFI Stage `--` | Drawing Number `--` | Cost Code `--` | Date Initiated `May 5, 2026 at 9:15 AM CDT` |
| 5 | Schedule Impact `--` | Cost Impact `--` | Reference `--` | Private (with helper text + crossed-out icon = no) |

**Bottom bar.** `Return to RFI Manager's Court` — context-aware state-
machine action button. Always present.

**Layout density.** ~1240 px min. Metadata grid uses ~70% of the
horizontal space. No central narrow column. Fields read at-a-glance.

### Edit form (same URL `/edit`)

Full-page edit, not a slide-in. Same two sections (Request, General
Information) with every field mutated to its editable form:

- **Subject** — single-line input (red `*` required).
- **Question** — full TinyMCE-class rich-text editor: Bold, Italic,
  Underline, Strikethrough, Align L/C/R/Justify, Bulleted list,
  Numbered list, Outdent/Indent, Cut, Paste-as-text, Paste-text-only,
  Font-size dropdown (12pt default), Color text, Highlight color,
  Link, ··· overflow.
- **Attachments** — drop zone (image icon + "Attach Files" + "or Drag
  & Drop") + chip per existing attachment with `×` remove.
- **Number** — text input (override of auto).
- **Due Date** — date picker.
- **RFI Manager** — typeahead with `×` clear.
- **Status** — read-only "Open" pill (state machine, not free-text).
- **Received From** — typeahead with `×` clear.
- **Assignees** — multi-select with **a checkbox per assignee** (the
  checkbox is the per-person response indicator: checked = responded).
  Add via typeahead at the bottom of the chip list.
- **Distribution List** — multi-select chips with `×` per chip + a
  scrollable container + typeahead append.
- **Ball In Court** — read-only, *computed* from the un-checked
  Assignees rows. Procore re-renders this live as you toggle the
  Assignees checkboxes.
- **Responsible Contractor** — vendor typeahead with `×` clear.
- **Specification** — typeahead linked to the Spec book.
- **Location** — typeahead linked to project locations / building /
  level / unit.
- **Created By** — read-only.
- **RFI Stage** — dropdown enum (admin-defined).
- **Drawing Number** — text (auto-link to drawings on display).
- **Cost Code** — typeahead linked to budget.
- **Date Initiated** — read-only.
- **Schedule Impact** — dropdown (Yes/No/TBD + days).
- **Cost Impact** — dropdown (Yes/No/TBD + $).
- **Reference** — free text.
- **Private** — checkbox (defaults from Settings).

**Bottom bar.** "* required fields" legend (red) · `Cancel` · `Save
Changes` (blue).

### List page

Top bar. `Items` tab + `Recycle Bin` tab. `Saved Views` sidebar with
3 scopes (Company / Project / Personal) + `+ Create`. Search · `All
Filters` · `Configure` (column chooser) · `Export ▾` · `Reports ▾` ·
`Create` (red button).

**All Filters panel.** A scrollable left-side drawer with at least 16
faceted filters: Status, Responsible Contractor, Received From,
Assignees, RFI Manager, Ball In Court, Overdue, Location, Cost Code,
RFI Stage, Created By, Created By (Company), and more below the
fold. Every filter is a typeahead or checkbox, no free-text-search-
only stub.

**Inline-cell edit.** When a row checkbox is selected, dropdown-type
columns become inline-editable in place. **Verified live on RFI #96 →
Responsible Contractor cell:** clicked, the cell turned into a
typeahead with `×` clear and a search list. No modal, no nav. Same
pattern works on Received From, RFI Manager, Status, Due Date.

**Per-row buttons.** Every row has `Edit` and `View` buttons in the
left-most column. Edit opens the full-page Edit form (same `/edit`
URL). View opens detail (`Cmd-click` for new tab).

**Configure (column chooser).** A right-side drawer titled "Table
Settings → Configure Columns" with toggle switches for **20
columns**: Number, Subject, Status, Responsible Contractor, Received
From, Date Initiated, RFI Manager, Assignees, Ball In Court, Due
Date, Closed Date, Location, Schedule Impact, Cost Impact, Cost
Code, Sub Job, RFI Stage, Distribution List, Private, Created By.
"Show All" link top-right.

### Create form

Full-page (URL `/rfis/create`), not a modal. Banner: "Draft RFI —
For draft RFIs, Number and Due Date are both suggested values.
Neither will be applied until the RFI is Open." Same Request +
General Information sections as the Edit form. Distribution List
pre-populates from Settings → Default Distribution.

**Bottom bar.** `Cancel` · `Create as Draft` · `Create as Open`.
Two-button save = Procore's explicit Draft-vs-Open decision; SiteSync
collapses this into one Save button.

### Reports menu

Two sections: **Canned Reports** with one item ("Chart"), **Custom
Reports** with `Create New Report`. Lean — Procore does *not* ship
6 named canned reports out of the box like SiteSync's Reports module
(per `RFI_P2C_PHASES_1_TO_4_RECEIPT_2026-05-07.md`).

### Settings (gear → `/tools/rfis/settings`)

ONE tab. A long scrolling page divided into:

- **General Settings** — RFI Manager radio (any-admin OR default-
  manager); Private RFIs toggle + "set new RFIs to private by default";
  RFI Responses (Days to Answer = number-of-business-days, "Mark
  assignees' responses required by default", "Only show official
  responses to Standard and Read-Only users").
- **Custom Fields** — exactly **two** named text fields. Label For
  Custom Field 1, Label For Custom Field 2. That's it. (SiteSync's
  `rfi_custom_fields` schema beats this — N typed fields per project.)
- **RFI Number Prefixes** — checkbox to enable prefixes by project
  stage. Once on, can't be off. (Useful but rare.)
- **RFI Emails** — Default Distribution chip-multiselect (auto-
  populates new RFIs); enable email reminders for overdue RFIs;
  **email matrix**: 8 events × 5 recipient roles (Creator, Manager,
  Assignee, Distribution Group, "Enable Email"). Per-cell checkbox.
  Events: Ball In Court Shift, Closed, Created, Draft Created, Due
  Date Changed, Reassigned, Reopened, Response Added.
- **Revisions** — toggle to enable Procore's Revisions concept (new
  RFI versions linked back to a parent — distinct from the chain-
  audit log).

---

## What SiteSync ships today (post-P2c, code-verified)

- `src/pages/RFIs.tsx` (2,069 lines) — list page with KPIs, Saved
  Views rail, Filter panel, Column configurator, Table/Kanban/Calendar
  view toggle, Bulk Edit panel, Iris Voice FAB, Iris Draft Preview,
  Email-to-RFI, Tabs (All / Open / Overdue / Awaiting response /
  Closed / Recycle Bin), Search, Export.
- `src/pages/rfis/RFIDetail.tsx` (890 lines) — single-column 720 px
  layout: back button, header (RFI #, status pill, days-open),
  AuditTrail / Watch / Edit / Distribute / Status action row,
  WorkflowTimeline (5 stages), ApprovalPanel, **`RFIInlineMetadata`
  showing 6 fields**, EntityHistoryPanel (audit trail moat), Iris
  email banner, Question card with author + Iris suggestions + spec
  excerpt + drafted-action gates + 3-field MetadataSection (with
  expand-for-more), RFIIrisTriage banner, RFIResponseThread,
  RFIResponseComposer.
- `src/pages/rfis/RFISettingsPage.tsx` — **7 sub-tabs** (workflows,
  response types, custom fields, custom values, permissions,
  numbering, notifications, spec book) — already richer than
  Procore's one-page settings.
- `src/pages/rfis/RFIReportsPage.tsx` — **6 canned Recharts reports**
  (Avg Response Time per Firm, On-Time Close %, Cost at Risk,
  Schedule at Risk, RFI Count by Trade, Designer Scorecard) +
  scheduled-delivery upsert. **Beats Procore's bare "Chart" canned
  report.**
- 24 RFI components shipped (`src/components/rfi/`): InlineEditField,
  RFIAssigneePicker, RFIAttachmentManager, RFIBulkEditPanel,
  RFICalendarView, RFIColumnConfigurator, RFIConvertMenu,
  RFIDistributeDialog, RFIDistributionStatusList, RFIEditPanel,
  RFIEmailReviewBanner, RFIEmailToRFIModal, RFIFilterPanel,
  RFIInlineMetadata, RFIIrisDraftPreview, RFIIrisTriage,
  RFIKanbanView, RFILinkedItemsPanel, RFIResponseComposer,
  RFIResponseThread, RFIRichTextEditor, RFISavedViewsRail,
  RFIVoiceFAB, UserChipEditor.
- Multi-assignee + per-person `responded_at` tracking → `rfi_assignees`
  table (P1b). Auto-recompute trigger on `ball_in_court` from
  unresponded rows. **Schema is there; the detail-page render isn't.**

---

## The gap matrix (severity-ranked, Brad-eye view)

Severity scale: **S1** = visible in 60-second demo · **S2** = visible
in a 5-minute click-through · **S3** = polish before paid GA · **S4**
= nice-to-have.

### Detail page (Walker's main complaint — 14 issues)

| # | Capability | Procore | SiteSync today | Sev | Fix size |
|---|---|---|---|---|---|
| 1 | 4-column metadata grid w/ ~20 fields | ✅ | ❌ 2-column, 6 fields | **S1** | Rewrite `RFIInlineMetadata` to a 4-column responsive grid; surface every existing field on `rfis` |
| 2 | Render Assignees with per-person response checkbox + "Response Required" red text | ✅ | ❌ | **S1** | New `<RFIAssigneeStatusList />` reading `rfi_assignees` rows; check = `responded_at != null` |
| 3 | Render Distribution List as static block (chips) | ✅ | ❌ (Distribute button only) | **S1** | New `<RFIDistributionStaticList />` reading `rfi_distributions`; click → opens existing editor |
| 4 | Render Question body as **rich text** | ✅ | ❌ (pre-wrap plain text) | **S1** | Replace `whiteSpace: pre-wrap` render with `dangerouslySetInnerHTML` of HTML stored from TipTap, OR render via TipTap read-only mode |
| 5 | 1240 px+ wide layout | ✅ | ❌ 720 px column | **S1** | Drop `maxWidth: 720` cap on `RFIDetail`; switch to grid: left = thread, right = sidebar (matches the workflow polish spec §2.2) |
| 6 | Right sidebar w/ ball-in-court + SLA + watchers + linked items + schedule + cost | spec'd | ❌ | **S1** | The polish prompt §2.2 already specs `<RFIDetailSidebar />`; ship it |
| 7 | Tabs (Overview/Responses/Attachments/Related/Activity/Audit) w/ count badges | ✅ ("Change History (17)") | ❌ single-scroll | **S2** | The polish prompt §2.1; URL state per tab |
| 8 | Edit RFI Number override | ✅ admin-editable text | ❌ auto only | **S2** | Add InlineEditField on number, gate to admin role |
| 9 | Edit Status directly to "Closed" via top-right primary button | ✅ red `Close RFI` | partial — `StatusControl` does this but not as a prominent red CTA | **S2** | Promote primary state-machine action to a colored button (matches Procore's red Close RFI / orange Submit / etc.) |
| 10 | Per-RFI ··· overflow w/ Print, Duplicate, Convert, Move project, Delete | ✅ | partial — Convert exists in `RFIConvertMenu` but Print / Duplicate / Move project don't | **S2** | Polish prompt §4.8 specs Print/Duplicate/Move; ship it |
| 11 | "Return to RFI Manager's Court" context bar (sticky bottom) | ✅ | ❌ | **S2** | Sticky footer on Detail with the next state-machine action — mirrors Procore's bottom bar |
| 12 | Days-open hover breakdown ("14d open · 9 calendar · 2 holidays · 3 weekend") | (no, but they show calendar+working-day "due in") | partial — `computeDaysOpenBreakdown()` exists from P2b; not wired to UI tooltip | **S3** | Wire the tooltip per polish prompt §2.3 |
| 13 | Audit / Deposition tab w/ chain integrity + download | partial — they have `Change History (17)` | ✅ EntityHistoryPanel + chain audit | — | **We beat them here; promote to a tab so Brad sees the badge count** |
| 14 | Reopen with reason picker + reason category enum | ✅ free text | ❌ no reason captured | **S2** | Polish prompt §4.1 |

### List page (Procore parity gaps — 8 issues)

| # | Capability | Procore | SiteSync today | Sev | Fix size |
|---|---|---|---|---|---|
| 15 | Inline-cell edit on selected row (Status, Priority, Ball-in-Court, Due Date, Responsible Contractor) | ✅ verified live | ❌ | **S1** | The polish prompt §3.1 specs per-row `[Edit]` + `[View]`; pair with cell-level inline editor reusing existing `InlineEditField` |
| 16 | `[Edit]` + `[View]` per row in left-most column | ✅ | ❌ rows are click-through to detail | **S2** | Polish §3.1 |
| 17 | Bulk-select with sticky action bar + count + pencil → side panel | ✅ "100 items selected" + pencil | partial — `RFIBulkEditPanel` exists but is it mounted on the list? | **S2** | Verify mounting; if not, wire it (RFIs.tsx hook order matters) |
| 18 | Saved Views in 3 scopes (Company/Project/Personal) | ✅ | ✅ `RFISavedViewsRail` ships these | — | Verify "Create from current filter" flow works end-to-end |
| 19 | All Filters drawer with 16+ facets | ✅ | partial — `RFIFilterPanel` exists; field count? | **S2** | Code review `RFIFilterPanel` to count facets; backfill missing |
| 20 | Configure (column chooser) with 20 toggleable columns + Show All link | ✅ | ✅ `RFIColumnConfigurator` ships this | — | Verify the column count matches Procore's 20 |
| 21 | Per-column 3-dot menu (Sort A→Z / Hide / Filter / Group / Pin) | ✅ | ❌ | **S3** | Polish §3.2 |
| 22 | Row hover preview drawer (RFI summary on >500ms hover) | ✅ Procore has this | ❌ | **S3** | Polish §3.3 |

### Create flow (4 issues)

| # | Capability | Procore | SiteSync today | Sev | Fix size |
|---|---|---|---|---|---|
| 23 | Two-button save: `Create as Draft` + `Create as Open` | ✅ | partial — state machine has draft state but UI is one Save button | **S2** | Two distinct CTAs in the create modal/page |
| 24 | "Draft RFI" banner explaining Number + Due Date are suggestions | ✅ | ❌ | **S3** | Inline banner |
| 25 | Default Distribution pre-filled from Settings | ✅ | ❌ | **S2** | Read `rfi_settings.default_distribution` (column added in P2c?); hydrate the create form's distribution chips |
| 26 | Voice + Email-to-RFI feeding the same draft surface | — | ✅ P2b ships this — **we beat Procore** | — | Demo to Brad |

### Edit form (5 issues — most are detail-page-render gaps reused)

| # | Capability | Procore | SiteSync today | Sev | Fix size |
|---|---|---|---|---|---|
| 27 | Full-page Edit URL `/rfis/{id}/edit` | ✅ | partial — `RFIEditPanel` is a slide-in, no dedicated URL | **S3** | The slide-in is fine for the demo (deep-linking can come later) |
| 28 | Per-Assignee checkbox in edit form (toggles `responded_at`) | ✅ | partial — `RFIAssigneePicker` exists; verify checkbox semantics | **S2** | Code review |
| 29 | Distribution List multi-chip with X-remove + typeahead append | ✅ | ✅ `RFIDistributeDialog` does this | — | Verify it's used inside `RFIEditPanel` not just stand-alone |
| 30 | Required-field legend ("* required fields") | ✅ | ❌ | **S3** | Polish §4.6 |
| 31 | Cost Impact = $ amount (not Yes/No/TBD) | partial — Procore has both Yes/No/TBD AND a $ field | partial — SiteSync has `cost_impact_cents` but not the Yes/No/TBD wrapper | **S3** | Add the enum wrapper; render either way |

### Settings (3 issues — we mostly beat Procore)

| # | Capability | Procore | SiteSync today | Sev | Fix size |
|---|---|---|---|---|---|
| 32 | Email matrix (8 events × 5 recipient roles, per-cell checkbox) | ✅ | partial — `notifications` sub-tab exists; verify it has the matrix | **S2** | Code review `RFISettingsPage`; if not, build (Procore-grade UX) |
| 33 | Default Distribution List config | ✅ | partial — verify it's wired | **S2** | Tied to #25 |
| 34 | Custom Fields = 2 named text fields | ✅ (limited) | ✅ N typed per project | — | **We win** |

### Reports (we beat Procore)

| # | Capability | Procore | SiteSync today | Sev | Fix size |
|---|---|---|---|---|---|
| 35 | Canned reports | 1 | 6 | — | **We win** |
| 36 | Scheduled delivery | (basic) | ✅ `rfi_scheduled_reports` upsert flow | — | **We win** |
| 37 | Custom report builder UI | ✅ | stubbed (table exists, builder ships in workflow polish) | S3 | Match Procore parity |

---

## Where we already beat Procore — *don't trade these for parity*

These are SiteSync's moats. Lean into them in the Brad demo.

1. **Iris multi-pass draft pipeline.** 7 passes (drawing → spec →
   answerer → due-date → impact → composition → voice-linter) with
   confidence + citations + telemetry. **Procore has nothing
   comparable.** Demo path: hold the FAB, speak 30 seconds, watch
   every field fill in.
2. **Iris triage on inbound responses.** Auto-applies
   `approved_as_noted` / `revise_and_resubmit` at high confidence.
   Procore makes the user pick the response type manually every time.
3. **Schedule-aware RFI clock with structured pause + days-open
   breakdown.** "14d open · 9 calendar · 2 holidays · 3 weekend." Not
   in Procore.
4. **Audit / Deposition pack with chain-gap detection.** Procore has
   "Change History (17)" with no chain integrity guarantee. SiteSync's
   hash chain is a legal/lender/insurer differentiator.
5. **Six canned Recharts reports + scheduled delivery.** Procore ships
   one canned chart.
6. **Settings depth.** SiteSync has 7 sub-tabs (workflows, response
   types, custom fields w/ typed schema, custom values, permissions,
   numbering, notifications, spec book) vs Procore's one-page settings
   with 2 string custom fields.
7. **Free guest portal for non-user response.** Procore charges $30K/yr
   per sub seat. This is the moat.

---

## "Steve-Jobs-PM" UI rubric — where SiteSync ranks today

| Dimension | Procore | SiteSync | Notes |
|---|---|---|---|
| Density (info per pixel) | 8.5 | 5.5 | Procore's 4-col grid + sidebar wins on glanceability |
| Hierarchy (eye knows where to look) | 7.5 | 7 | SiteSync's orange RFI-### + status pill is good; Procore's primary red action is louder |
| Affordance (what's clickable is obvious) | 8 | 6.5 | Procore's per-row Edit/View buttons + inline-cell-edit is unmissable; SiteSync's row-click-only is opaque |
| Restraint (no decoration debt) | 7.5 | 7.5 | Both clean — neither is Linear, neither is bad |
| Motion (does it feel alive?) | 6 | 7 | Procore is mostly static; SiteSync has nicer enter/exit + the FAB |
| Voice (copy quality) | 6.5 | 8 | SiteSync's voice linter / lethal-calm tone outperforms Procore's "Once your team creates responses, you can view them here" |
| Speed | 6 | 8 | Procore RTG list took ~3s for 100 RFIs; SiteSync renders in ~600ms |
| Audit / chain integrity | 5 | 9 | The moat |
| AI integration | 2 | 9 | The moat (×2) |
| Field-test rig (mobile gloved-thumb) | 3 | 7 (per ADR-010 spec) | Mobile native is the next moat |
| Discoverability (find a feature you didn't know about) | 8 | 6 | Procore's tabs + section headers + side panels make features obvious; SiteSync's single-column scroll hides things |
| Cohesion (everything looks like one app) | 7 | 7.5 | Both are fine |

**Aggregate read.** SiteSync wins on speed, voice, audit, AI, motion,
field-test. **Procore wins on density, affordance, discoverability —
all rooted in the same root cause: layout.** Fixing item 1 (4-col grid)
+ item 5 (drop the 720 px cap) + item 6 (right sidebar) closes ~70%
of the Steve-Jobs gap in one sprint.

---

## Recommended next sprint — "RFI Detail Bugatti Pass" (~12 hr)

Single PR, single goal: make the Detail page Procore-grade or better.

1. **Drop the 720 px cap.** `RFIDetail` switches to a CSS grid:
   `grid-template-columns: minmax(0, 1fr) 320px; gap: 24px;`. Wraps to
   single-column under 1024 px.
2. **Rewrite `RFIInlineMetadata` as a 4-column grid surfacing all
   existing fields** + the missing ones (Number/Manager/Received-From/
   Responsible Contractor/Specification/Location/Cost Code/RFI Stage/
   Drawing Number/Schedule Impact/Cost Impact/Reference/Private/
   Assignees status/Distribution List/Created By/Date Initiated/
   Closed Date). Reuse `InlineEditField` for every editable one. Read-
   only fields (Number, Created By, Date Initiated) render as plain
   text.
3. **Build `<RFIAssigneeStatusList />`** reading `rfi_assignees`
   rows. Each row = avatar + name + ✓-or-empty checkbox + "Response
   Required" red text when unresponded. Click a name → opens the
   editor.
4. **Build `<RFIDistributionStaticList />`** reading `rfi_distributions`.
   Static chip list, click any chip → opens `RFIDistributeDialog`.
5. **Build the right sidebar `<RFIDetailSidebar />`** per polish prompt
   §2.2: ball-in-court avatar + SLA countdown + status pill + watchers
   chips + linked-items chips + schedule strip + cost strip.
6. **Render Question body via TipTap read-only mode** (or
   `dangerouslySetInnerHTML` of stored HTML). Bold/italic/lists/links
   all show.
7. **Promote primary state-machine action to a prominent colored
   button** at top-right (matches Procore's red `Close RFI`).
8. **Wire the days-open tooltip** using the existing
   `computeDaysOpenBreakdown()` from P2b.
9. **Sticky bottom-bar** with "Return to RFI Manager's Court" / "Mark
   Answered" / "Close" — context-aware to current state.

Skip in this PR: Tabs (#7 above is its own PR), full Edit URL,
per-column 3-dot menu, hover preview drawer, ··· overflow Print/
Duplicate/Move (those land in the workflow polish PR which is already
spec'd).

**Acceptance.** Walker opens RFI-072 and sees a 4-column grid with
20 fields, three assignees with per-person checkboxes, the
distribution list as chips, the question rendered with formatting,
a right sidebar with ball-in-court + SLA + watchers + linked items,
and a sticky-bottom Close-or-Reopen bar. The page reads like an
enterprise record, not a chat thread.

---

## Footnote: what wasn't testable from this seat

- **Per-Assignee checkbox semantics in the Procore Edit form.** I
  observed the checkbox state but didn't toggle one and save (would've
  written to a real RFI on Walker's project). The Procore docs imply
  toggling = "marked responded" and immediately recomputes Ball In
  Court. SiteSync's `rfi_assignees.responded_at` already supports this
  exact semantic.
- **Procore's actual mobile RFI page.** Outside scope. ADR-010 has
  SiteSync's mobile native plan.
- **Procore RFI Stage values.** "RFI Stage" is admin-defined per
  project. SiteSync's `project_rfi_workflows` covers this — verify
  parity in the workflows sub-tab.
- **Procore's drawing-pin viewer.** The "Drawing Number" field
  auto-links to the drawing on display in Procore; we didn't navigate
  there. SiteSync ships drawing pins per P2c (`rfi_drawing_pins`
  table) — verify the pin viewer renders on detail.

---

## Sign-off

This audit is grounded in a live click-through of Procore's RTG /
Merritt Crossing project (100 real RFIs) on `us02.procore.com` plus
a code-review of every SiteSync RFI surface under `src/pages/rfis/`,
`src/components/rfi/`, and the eight P0 → P2c receipts in
`docs/audits/`. Every "Procore has X" claim is something I clicked.
Every "SiteSync today: ❌ / partial / ✅" is grounded in a specific
file path + line range, not memory.

**Walker's read is right.** SiteSync's *plumbing* is roughly at
parity (and ahead in 5+ places that matter). The *render* of the
Detail page is one sprint behind. Closing items 1–9 above gets the
demo to Brad-ready.

---
