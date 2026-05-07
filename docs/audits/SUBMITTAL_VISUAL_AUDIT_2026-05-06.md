# Submittals Visual Audit — SiteSync vs. Procore (live)

**Date:** 2026-05-06
**Method:** Side-by-side live comparison via Chrome MCP. Procore project: Carleton Companies / RTG - Merritt Crossing (138 real submittals). SiteSync project: Avery Oaks Apartments (14 submittals, mostly empty data).
**Companion:** `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` (Walker's spec), `SUBMITTAL_COMPETITIVE_ANALYSIS_2026-05-06.md` (the desk research). This doc is what the desk research said *plus* what live A/B revealed.

---

## TL;DR

Walker's instinct is right: today's SiteSync submittals page is **"a thinner Procore."** It mimics the wrong things (KPI cards, fewer columns, a sparse aesthetic) and skips the things that actually make Procore tolerable (4 view modes, 16 filters, dense data per row, real ball-in-court, workflow chain table). Worse, two of the cards on top are misleading (Avg Review Time = 240 days?) and clicking a row bounced me to the login screen mid-audit.

**The fix isn't a redesign** — it's the spec. The spec already prescribes the 7-view log, 16-filter chip system, dense column set, real BIC, workflow chain visualizer, and AI surfaces Procore can't ship. This audit just adds the visual evidence and the count of how far off we are today: **we have ~30% of Procore's surface depth and ~10% of its data density**, and we're missing all four of Procore's killer view modes.

The Bugatti version isn't aesthetic — it's *informational*. Procore wins on submittals because every coordinator who opens the log can answer "what's overdue, who's holding it, what spec does it tie to" in 2 seconds without scrolling, clicking, or filtering. Today, SiteSync makes you scroll past 4 KPI cards before you reach the data.

---

## What Procore actually does well (live evidence)

### A. Density
- **11+ columns visible without horizontal scroll** at 1524px width: Spec Section, #, Rev., Title, Type, Status, Responsible Contractor, Submit By, Received From, Received Date, plus a paperclip/document icon column. Dense, scannable, decision-grade.
- Inline **Edit / View** buttons on every row — no need to enter the detail page for common edits.
- Column resize handles + show/hide via the `⋮` menu on each header.
- Footer says `1-138 of 138 · Page: 1` — coordinator knows the scope at a glance.

### B. The 4 view modes (the headline feature)
URL pattern: `?view=list|packages|spec_sections|ball_in_court`. Same data, four groupings:
- **Items**: flat dense table.
- **Packages**: rows nested under "#1: Beacon Concrete" expandable headers. Edit/View at both package + item level. *This is the entire vendor-bundling pattern we don't model.*
- **Spec Sections**: rows grouped under "323119 Decorative Metal Fences and Gates (1 item)" with collapse chevrons.
- **Ball-in-Court**: rows grouped by holder. "None (138 items)" since this project's all closed — but it's the view a PE reviews every Monday morning.

### C. Filters
**Add Filter ▾** opens a 16-chip menu: Approver, Ball In Court, Created By, Current Revision, Division, Location, Number, Private, Received From, Response, Responsible Contractor, Spec Section, Status, Submittal Manager, Submittal Package, Type. Each chip applies as a stacked filter pill on the toolbar.

### D. Bulk Actions
**Bulk Actions ▾** with row checkboxes. Edit, Apply Workflow, Delete.

### E. Reports menu
**Reports ▾**: canned ("Submittal Approvers' Response Time"), custom, "Create New Report."

### F. Detail page (`/tools/submittals/{id}`)
- Breadcrumb: Submittals > Excel Steel: Metal Fabrication > Dog park and pool fence
- Two stacked status banners: green "Workflow is complete" + blue "Submittal Distributed on Mon Jun 16, 2025 at 9:32 AM CDT"
- Title: "Submittal #323119-1 Revision 0: Dog park and pool fence" — number + rev + title.
- Top-right action cluster: **Redistribute** (orange primary), Export ▾, Edit, ⋮ More Options.
- 4 tabs with counts: General | Related Items (0) | Emails (0) | **Change History (66)** — the audit log is a first-class surface, not a hidden modal.
- Sections (collapsible, in order): Distribution Summary → General Information → **Workflow Responses** (cards: name, company, response, comments, attachments, CURRENT badge) → Submittal Workflow (expandable table: Step #, Name, Sent Date, Due Date, Returned Date, Response, Comments, Attachments, Version, Actions) → General Information (mirror) → Delivery Information.
- Step 4 of the workflow chain shows three reviewers sharing the step (Melissa Ellis, Adam Everett pending, Brandon Booher) — **parallel reviewers within a sequential step**, the model SiteSync's spec needs but the current build doesn't expose.

### G. Real-world data
Procore's project has 138 real submittals with real subs, real spec sections, real review chains, real comments on the Cross Architect line ("Per owner meeting on 06/12/25 — Simplex locks for pool fence gate"). The product looks lived-in.

---

## What SiteSync does today (live evidence)

### A. Density problems
- **Only 7 columns visible**: #, Title/Sub, Status, Priority, Due, Ball in Court, Chain.
- **No inline actions** — must click the row to do anything (and the click bounced me to the login screen, see below).
- **No column resize, no show/hide menu, no `⋮`** on headers.
- No `1-N of M` count footer; instead a small "12 divisions · 14 submittals" line above the table.

### B. Zero of Procore's 4 view modes
- We have **one** layout — the log, with a Group toggle (Spec Section / Subcontractor / None). That's a *sort*, not a view.
- No Items mode. No Packages mode (we don't even have a Submittal Package as a first-class concept in the UI). No proper Spec Sections mode (the grouping toggle is a partial). No Ball-in-Court mode.
- Two view-toggle icons in the toolbar (list / cards) but they're not Procore-scale view modes.

### C. Filters
- Only a search box. **Zero named filter chips.** Procore has 16.

### D. Bulk Actions
- **None visible.** No row checkboxes. Cannot multi-select to apply a workflow or bulk-edit.

### E. Reports
- **None.** No Reports menu. Just an Export button.

### F. Real BIC is broken
- Every visible row shows `—` (em-dash) in the Ball-in-Court column. The column exists; the data doesn't populate.
- Procore's entire BIC view is built around this column having real data. Ours has the column but no data — worst of both worlds.

### G. The Chain column is two grey dots
- Procore's workflow chain is a 4-step table with sent/due/returned/response/comments/attachments per reviewer per step.
- Ours: two small grey dots (a `1/1` or `0/1` count next to a tiny progress bar on group headers). No way to see *who* is in the chain or *where* in it the submittal is.

### H. The 4 KPI cards are wasted real estate
Top of page, before any data:
- **Pending Review: 0** (— 0%)
- **Overdue: 5** (— 0%, "Requires immediate attention")
- **Approval Rate: 64%** (— 0%, "9 of 14 approved")
- **Avg Review Time: 240d** (— 0%, "No approvals this week") ← *240 days is mathematically impossible for this dataset and almost certainly a bug or default.*

These cards eat the entire above-the-fold and don't decisively help anyone do their job. Procore puts equivalent metrics in a slim collapsed "Insights" panel on the right edge that you open when you want them.

### I. "Priority" is invented
Every visible row says **Priority: Medium**. Procore's submittals model has no Priority field. Either we're displaying placeholder data, or we've added a non-standard field that conflates Priority with `is_critical_path` from the schedule. The spec doesn't model Priority either — this looks like UI debt from an early build that never got cleaned up.

### J. The numbering doesn't match the industry
- Procore: `323119-1` (CSI section + sequence) and `Revision 0` separately.
- SiteSync today: `SUB-058` (opaque sequence). No revision number visible. No CSI alignment in the ID itself.

### K. Subtitle is fact, not function
- Procore: *"Easily create individual submittals or generate them from specifications, and then store and track all steps of the submittal process."* Tells the coordinator what the tool does.
- SiteSync: *"5 active · 5 overdue."* Just numbers, and the math is confusing — every overdue is also active, so 5+5=10≠14.

### L. Page header is overweight
- Page title "Submittals" rendered in 56px+. Eats vertical space.
- Procore's "Submittals" sits in a smaller header next to a gear icon for settings. Settings access in SiteSync is **not visible at all** on the log page.

### M. No Recycle Bin tab
Procore: 5th top tab is Recycle Bin. SiteSync: no soft-deletes view.

### N. Detail page is gated by a login bounce
Clicking SUB-045's row navigated to `/login` instead of the detail page. Either the session expired mid-audit (possible) or there's a real bug routing logged-in users to login. Either way, **a coordinator who lost session mid-day loses every open tab's context** — that's a P1 bug if it's not session expiry.

---

## The visual evidence in numbers

| Dimension | Procore (today) | SiteSync (today) | Gap |
|---|---|---|---|
| Visible columns on log | 11+ | 7 | -36% data density |
| View modes | 4 (Items, Packages, Spec Sections, BIC) | 0 (1 layout w/ grouping toggle) | -100% |
| Filter chips | 16 named | 1 (search box) | -94% |
| Bulk operations | 3 (Edit, Apply Workflow, Delete) | 0 | -100% |
| Reports menu | Canned + Custom + Create New | 0 (Export only) | -100% |
| Real BIC data populated | Yes | No (column exists, all em-dashes) | broken |
| Workflow chain visualization | 4-step table with sent/due/returned/response/comments/attachments per reviewer | 2 grey dots + 0/1 progress | -90% |
| Detail page tabs | 4 (General, Related Items, Emails, Change History) | unknown — bounced to login | TBD |
| Inline row actions | Edit + View on every row | None | -100% |
| Settings surface | Gear icon + 7 sub-tabs | Not visible from log | -100% |
| Number format | CSI-aligned + separate Rev# | `SUB-NNN` opaque, no Rev | -100% |
| Real submittals in tested project | 138 | 14 (mostly hollow data) | demo-feel |

**Total surface depth ratio: SiteSync ≈ 30% of Procore today.** And *that's the floor we're starting from* — the spec target is 95/100 vs Procore's ~78.

---

## What we have that Procore doesn't (don't lose these in the rebuild)

Be careful — the rebuild can't accidentally delete the things SiteSync already does better:

1. **Status pills with color** — Approved (green), Rejected (light red), Resubmit (light red). Procore shows status as plain text ("Closed"). Our pills are scannable; Procore's text is not.
2. **CSI Division group headers with overdue badge** — "Division 03 — Concrete · ⚠ 1 overdue · 1 total · 0/1 approved." Procore's grouping is silent; we annotate. Keep this.
3. **Sidebar app navigation** — Procore makes you go up to the project picker then drill into a tool. We have direct sidebar access to RFIs / Submittals / Drawings / Punch List etc. Don't lose the sidebar in the rebuild.
4. **Iris button (orange sparkle, lower-right)** — visible on every page. Procore has no equivalent persistent AI affordance.
5. **Cmd-K search bar** prominent in the sidebar. Procore has Cmd-K but it's not as discoverable.
6. **Light/dark theme toggle** in the user footer. Procore has none.
7. **The 12-division CSI grouping with inline `1 total · 1/1` mini progress bars** is genuinely better than Procore's silent grouping. Bigger version: bring this energy to every group header.
8. **Project-context dropdown** ("Avery Oaks Apartments" with the role beneath). Procore's project picker is in a pill at the top with company + project number — clunkier.

---

## Concrete fixes mapped to the spec phases

Every gap above maps to a phase in the build spec. Some need spec patches (small) — most are already covered.

### P0 (Days 35-42, in flight)

- **D39: Rebuild log with 7 view modes.** Spec Part 2.2 already prescribes this. Concretely: add tabs Items / Packages / Spec Sections / Ball in Court / Kanban / Timeline / Schedule-Linked, plus Recycle Bin sub-tab. *Don't ship D39 without all 7.*
- **D39: Add the 16-filter chip system.** Match Procore exactly + add 4 SiteSync-specific (Iris pre-flight finding present, Schedule activity at risk, Required-on-site within N days, Critical path). *Patch the spec to enumerate the 16 chips explicitly.*
- **D39: Add Bulk Actions menu.** Edit, Apply Workflow, Delete, plus SiteSync-only: Re-run Iris pre-flight, Distribute to field, Generate stamp PDF. Row checkboxes.
- **D39: Drop the 4 KPI cards in their current form.** Replace with a slim collapsed Insights panel on the right edge (Procore-style) or a single-line strip at the top: `1,247 active · 23 overdue · 4 awaiting your response · 6 architect-late · [Iris suggests]`. Reclaim the vertical space.
- **D39: Fix the column set.** 11 columns visible at 1440px+: Spec Section, #, Rev, Title, Type, Status, Sub, Submit By, BIC, Days in Court, attachment-icon. Resize handles. Show/hide via `⋮`.
- **D39: Inline Edit and Open buttons** on every row. No "open detail to do anything" pattern.
- **D39: Numbering format.** Switch from `SUB-NNN` to CSI-aligned `{section}-{seq}` per project setting (`numbering_format`). Show Rev as a separate column.
- **D39: Drop "Priority" column entirely** unless it ties to `is_critical_path` from the schedule. Coordinators don't think in Priority for submittals; they think in "is the schedule going to slip if this is late."
- **D39: Page header.** Smaller title. Settings gear next to it. Subtitle that says what the tool does, not the count. Move the count to the same line as the action buttons.
- **D40: Detail page.** Spec Part 2.4 already prescribes the layout. Match Procore's: breadcrumb, status banners, primary Redistribute action, Export/Edit/⋮ cluster, 4+ tabs (Overview/Markup/Revisions/Citations/History/Distribute/Emails — plus Change History counter). Workflow chain table per Procore step pattern (#1-#4, parallel reviewers within a step, sent/due/returned dates).
- **P1 incident:** the login bounce is a P1. Track it. If it's session expiry, add an inline "your session is about to expire — refresh?" toast 5 minutes before the bounce. If it's a routing bug, fix it before D40 lands.

### Spec patches (do today)

Append a new sub-section under Part 2.2:

> **2.2.1 Filter chips (parity + extension).** The log toolbar exposes 20 filter chips by default. 16 mirror Procore exactly: Approver, Ball In Court, Created By, Current Revision, Division, Location, Number, Private, Received From, Response, Responsible Contractor, Spec Section, Status, Submittal Manager, Submittal Package, Type. 4 are SiteSync-only: Iris Pre-flight Finding, Schedule Activity At Risk, Required-on-Site Within N Days, On Critical Path. Chips stack as toolbar pills with `×` to clear; saved-view persists chip state.

Append under Part 2:

> **2.5 Density target.** At 1440px viewport width, the log shows 11 visible columns without horizontal scroll: Spec Section, #, Rev, Title, Type, Status, Sub, Submit By, BIC, Days in Court, paperclip-icon. Below 1280px, columns 7-11 collapse into a tooltipped overflow indicator. Never below 6 visible columns.

Append under Part 2.4:

> **2.4.1 KPIs are right-rail, not top-band.** Top-band shows a single inline strip: `{N} active · {N} overdue · {N} awaiting you · {N} architect-late`. Detailed metrics (approval rate, cycle time p50/p95, BIC heatmap) live in a slim collapsed "Insights" panel on the right edge, opened on demand. The 4-jumbo-card pattern is **not** allowed for submittals — it eats above-the-fold and forces a scroll before the data.

Append under Part 12 (was: Open questions; now patch new findings):

> **Live audit findings 2026-05-06 (must address in D39/D40):**
> - Login bounce on row click (P1) — cause unclear; could be session expiry. If expiry, add 5-min warning toast. If routing bug, fix before D40 lands.
> - "Avg Review Time = 240d" KPI is showing a bogus default. Either the metric is mis-computed or showing seed data. Drop the card; replace with the inline strip in 2.4.1.
> - "Priority" field is rendering "Medium" on every row and is not in the spec. Drop the column from the log unless we tie it to `is_critical_path` and rename it accordingly.
> - Numbering format: today's `SUB-NNN` is not industry-standard. The spec already mandates `{spec_section}-{seq}` as default; D39 must do the cutover and migrate display (not data — keep `submittals.number` as-is, change presentation).

---

## What this means for the next PRs

- **PR #325 (D36, in flight)**: nothing changes. Land it.
- **PR #326 (D37)**: nothing changes. Land it.
- **PR #327 (D38)**: nothing changes. Land it.
- **PR #328 (D39 — log rebuild)**: this is where the visual gap closes. The prompt to Claude Code must reference this audit doc + the spec patches above. Don't merge D39 until all 7 view modes are present, all 20 filter chips are in the dropdown, the 4 KPI cards are gone, the column set is dense, and inline Edit/Open works.
- **PR #329 (D40 — detail page)**: must match Procore's information architecture (breadcrumb, status banners, 4+ tabs, workflow chain table) plus our citations side panel.

The killer features in P1+ (spec importer, AI pre-flight, magic-link, rev-diff, mobile, closeout, federal) are what makes us 95/100 vs Procore's 78. But they only land on a foundation that's at parity. **D39 + D40 are where parity gets earned.** Don't ship them light.

---

## Receipts

- Procore project: `https://us02.procore.com/webclients/host/companies/562949953425254/projects/562949954438548/tools/submittals` (Carleton / RTG - Merritt Crossing, 138 real submittals)
- SiteSync project: `https://sitesync-pm.vercel.app/#/submittals` (Avery Oaks Apartments, 14 submittals)
- 18 screenshots captured during the live A/B (Items view, Packages view, Spec Sections view, Ball-in-Court view, Add Filter dropdown both halves, Detail page top, Detail page workflow responses, Detail page workflow chain table, SiteSync log, SiteSync log scrolled, login bounce).
- Companion: spec `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md`, desk research files in same folder.
