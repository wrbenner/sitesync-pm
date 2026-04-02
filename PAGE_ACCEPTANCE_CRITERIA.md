# PAGE ACCEPTANCE CRITERIA — SiteSync PM

> **Purpose**: This document is the single source of truth for what "done" means on every critical page. The QA engine, AI audit system, and all contributors MUST treat these criteria as gospel. Every assertion is testable. Every state is defined. No guessing.
>
> **Philosophy**: Borrowed from the best — Google's Design Sprints (define before you build), Apple's HIG (every pixel has a job), Stripe's API-first thinking (every state is a contract), Meta's performance budgets (if it's slow it's broken), and Linear's opinionated defaults (the happy path should be flawless).

---

## Global Acceptance Standards (Apply to ALL Pages)

These are non-negotiable baselines. If a page violates any of these, it fails regardless of page-specific criteria.

### Loading States
- Every page MUST show a skeleton loader within 100ms of navigation — never a blank screen, never a raw spinner with no context.
- Skeleton loaders MUST match the final layout geometry (card shapes, table row heights, chart placeholders). No generic pulsing rectangles.
- Data fetches that exceed 3 seconds MUST show a secondary indicator: "Still loading — this is taking longer than usual."
- Staggered animation entrance (`staggerChildren: 0.05s`) on all card/row groups per existing Framer Motion config.

### Empty States
- Every page MUST have a designed empty state — illustration or icon, a single-sentence explanation, and ONE primary CTA.
- Empty states MUST be contextual: "No RFIs yet — create your first one" not "No data found."
- Empty states for filtered/searched results MUST differ from true-empty: "No results match your filters" with a "Clear filters" action.
- Subcontractor/viewer roles seeing empty states due to permission filtering MUST see "You don't have access to items in this view" — not a misleading "nothing here."

### Error States
- Network failures: toast notification + inline retry button. Never a full-page error for a single failed fetch.
- 403/Permission denied: `<RequestAccessPage>` component with role name and a "Request Access" action — never a blank page or redirect loop.
- 404/Not found: contextual message with navigation back to parent list. "This RFI may have been deleted or you don't have access."
- Optimistic update rollbacks: toast with "Changes couldn't be saved — your edits have been restored" and the pre-edit state rendered.

### Permissions & RBAC
- Every page gated by `<ProtectedRoute moduleId="...">` per the routing config — no page accessible without valid module permission.
- UI elements (buttons, forms, menus) MUST be hidden or disabled (with tooltip explaining why) based on `usePermissions().hasPermission()`.
- Viewers see read-only views with no edit affordances. Subcontractors see only their scoped data. Project Executives see everything.
- Permission checks MUST be enforced at both UI layer (PermissionGate) AND API layer (RLS policies). Client-side-only gating is a failure.

### Responsive & Mobile
- Every page MUST be usable at 375px width (iPhone SE). No horizontal scroll, no overlapping elements, no truncated CTAs.
- Touch targets: minimum 44×44px per Apple HIG.
- Tables MUST collapse to card-based layouts on mobile or provide horizontal scroll with a frozen first column.
- Bottom sheet modals on mobile, dialog modals on desktop.

### Performance
- First Contentful Paint: < 1.5s on 4G.
- Time to Interactive: < 3s on 4G.
- No layout shift after initial paint (CLS < 0.1).
- List pages with > 50 items MUST use virtualization (TanStack Virtual or equivalent).

### Real-Time
- Any entity modified by another user MUST reflect within 2 seconds via Supabase Realtime subscription.
- Presence indicators (Liveblocks) on pages where concurrent editing is possible.
- Edit lock conflicts: "Walker is currently editing this item" with the user's avatar — never a silent overwrite.

### Accessibility
- All pages MUST pass axe-core automated audit with zero critical/serious violations.
- Keyboard navigable: Tab order follows visual order. Focus rings visible. Escape closes modals/panels.
- Screen reader: all images have alt text, all icons have aria-labels, all status changes announced via aria-live regions.
- Color contrast: WCAG 2.1 AA minimum (4.5:1 for text, 3:1 for large text and UI components).

### Offline
- Pages with offline support (daily-log, field-capture, punch-list) MUST show a banner: "You're offline — changes will sync when you reconnect."
- Queued mutations MUST be visible: "3 changes pending sync."
- Conflict resolution on reconnect: last-write-wins with toast notification of any overwrites.

---

## 1. Dashboard (`/dashboard`)

**Module ID**: `dashboard` | **Min Role**: viewer | **Permission**: `dashboard.view`

### What This Page Does
The command center. One glance tells you if your project is healthy or bleeding. It is NOT a dumping ground for every metric — it surfaces the 6-8 numbers that drive decisions today.

### Data Displayed
- **Schedule Health**: Schedule variance in days (green ≤0, amber 1-5, red >5). Percentage of phases on track. Critical path item count.
- **Budget Health**: Total budget vs. committed + spent. Budget utilization percentage with progress ring. Variance dollar amount and percentage.
- **RFI Status**: Open count, overdue count, average days to close. Trend arrow (improving/declining vs. last 30 days).
- **Punch List**: Open items, items resolved this week, verified count. Completion percentage ring.
- **Safety**: Days since last incident. Open corrective actions. Incident rate trending.
- **Financial**: Pending pay apps dollar total. Outstanding lien waivers count. Cash flow status.
- **Crew Utilization**: Active crews today, utilization percentage.
- **Weather Widget**: Today's forecast with impact assessment on scheduled outdoor work.

### Acceptance Criteria
1. Dashboard loads all metric cards within a single batched query — no waterfall of 8 sequential fetches.
2. Each metric card shows: current value, trend indicator (↑↓→), comparison period label ("vs. last 30 days"), and severity color.
3. Numbers use compact formatting: `$1.2M` not `$1,200,000`. Days show integers. Percentages show one decimal.
4. Progress rings animate from 0 to current value on first paint (Framer Motion, 0.8s ease-out).
5. Clicking any metric card navigates to the corresponding detail page (e.g., clicking RFI card → `/rfis`).
6. Empty project (no data in any module): show onboarding checklist — "Set up your project in 5 steps" with progress tracker. Steps: Add team members, Upload drawings, Create budget, Log first daily entry, Configure safety settings.
7. Widgets are draggable and resizable via React Grid Layout. Layout persists per-user in localStorage (with Supabase backup for cross-device).
8. Viewer role: sees all metrics but no action buttons. Subcontractor: sees only punch list, RFIs assigned to them, and their crew data.
9. Real-time: if another user submits a daily log or closes an RFI, the relevant metric card updates live without page refresh.
10. Mobile: cards stack vertically in a single column. No drag-to-rearrange on mobile — fixed priority order (Schedule → Budget → RFIs → Punch → Safety).
11. Skeleton loader: 6 card placeholders matching the 2×3 grid layout with pulsing gradient animation.
12. Error in one metric fetch does NOT block others — show "Unable to load" on the failed card with a retry icon.

---

## 2. Tasks (`/tasks`)

**Module ID**: `tasks` | **Min Role**: viewer | **Permission**: `tasks.view`

### What This Page Does
Kanban-first task management purpose-built for construction workflows. Every task lives in one of four lanes. Tasks link to RFIs, submittals, drawings, and schedule phases — they are not standalone to-dos.

### Data Displayed
- **Kanban Columns**: `todo` → `in_progress` → `in_review` → `done`
- **Task Card**: Title, assignee avatar, priority badge (critical/high/medium/low), due date, subtask progress (3/7), linked items count, tag pills, comment count, attachment count.
- **Filters**: Priority, assignee, due date range, tags, linked item type, critical path only.
- **Bulk Bar**: Appears when ≥1 task selected. Actions: reassign, change priority, move to column, delete.

### Acceptance Criteria
1. Drag-and-drop between columns updates task status optimistically — card moves instantly, API call fires in background, rolls back with toast on failure.
2. Critical path tasks show a red left-border and a 🔴 indicator. Filtering to "Critical Path Only" hides all non-critical tasks.
3. Overdue tasks (past due_date, not in `done`): due date text turns red, card gets a subtle red background tint.
4. Subtask progress bar renders inline: green fill proportional to completed/total. Clicking expands subtask checklist inline.
5. Search: real-time filtering as you type (debounced 200ms). Matches against title and tags. No search results: "No tasks match — try different keywords" with clear button.
6. Empty state (no tasks at all): illustration of a clipboard, "No tasks yet — break your project into actionable items" with "Create First Task" CTA.
7. Empty column: light dashed border placeholder — "Drag tasks here or click + to add."
8. Create task: modal with fields — title (required), description (rich text), assignee (searchable dropdown of project members), priority (default: medium), due date, tags, linked items. Saving adds card to `todo` column with entrance animation.
9. Task detail panel: slides in from right (480px width on desktop, full-screen on mobile). Shows full description, activity log, comments thread, attachments, linked items with clickable navigation, edit history.
10. Permissions: `tasks.create` required to see "+ New Task" button. `tasks.edit` to drag cards. `tasks.delete` for delete in bulk bar. `tasks.assign` for assignee field. Viewers see read-only board.
11. Keyboard: `N` opens new task. Arrow keys navigate between cards. `Enter` opens detail. `Escape` closes detail panel.
12. Column counts update in real-time: "In Progress (7)" reflects current filtered count.
13. Mobile: columns become horizontally swipeable tabs. Cards are full-width. Drag-and-drop replaced with "Move to..." action menu.
14. Performance: 200+ tasks MUST render without jank. Cards use virtualization if column exceeds 50 items.

---

## 3. RFIs (`/rfis`)

**Module ID**: `rfis` | **Min Role**: viewer | **Permission**: `rfis.view`

### What This Page Does
The RFI register tracks every question from field to resolution. The "Ball In Court" (BIC) system makes accountability instant and visible. Overdue RFIs are the #1 schedule killer — this page makes them impossible to ignore.

### Data Displayed
- **Table Columns**: RFI # (auto-incremented), Title, From (creator), Priority, Status (open/under_review/answered/closed), Days Open, Due Date, Ball In Court (BIC party), AI Annotation indicator.
- **BIC Color Coding**: GC (#3B82F6 blue), Architect (#8B5CF6 purple), Engineer (#14B8A6 teal), Owner (#F47820 orange), Sub (#6B7280 gray).
- **KPI Bar**: Total open, overdue count (red badge), avg days to close, closed this week.
- **Views**: Table (default) and Kanban (by status).

### Acceptance Criteria
1. Table uses TanStack React Table with virtual scrolling. 500+ RFIs render at 60fps. Column sorting on all columns. Column resize by dragging borders.
2. RFI numbers are sequential per-project and immutable once created. Format: `RFI-001`, `RFI-002`. Never reused after deletion (soft delete only).
3. Overdue detection: any RFI where `due_date < today AND status !== 'closed'` shows a red "OVERDUE" badge and the due date cell turns red.
4. Ball In Court: shows the party name + colored dot. Clicking BIC opens the response thread filtered to that party's pending action.
5. Days Open: calculated as `today - created_at` for open RFIs, `closed_at - created_at` for closed. Displays as integer.
6. Create RFI modal: Title (required), Description (rich text with image embedding), Priority, Due Date, Assigned To (BIC party), Spec Section reference, Drawing reference (searchable linking to `/drawings`), Cost Impact toggle (yes/no with amount field), Schedule Impact toggle (yes/no with days field).
7. RFI detail panel: full thread view showing question → responses → resolution. Each response has author, timestamp, attachments. Official answer marked with green checkmark. Status transition buttons based on role.
8. Status transitions: Open → Under Review (when BIC party views), Under Review → Answered (when BIC party responds), Answered → Closed (when originator accepts). Rejection sends back to Open with note.
9. `rfis.void` permission required to void an RFI (soft delete). Voided RFIs show with strikethrough in list, filterable.
10. AI annotations: sparkle icon appears when AI has flagged a potential conflict or suggested a response. Clicking opens AI insight panel.
11. Empty state: "No RFIs — that's a good sign. When questions arise in the field, create an RFI to get a documented answer."
12. Filtered empty: "No RFIs match your filters" with each active filter shown as a removable chip.
13. Export: CSV and PDF export of current filtered view. PDF uses project letterhead. Export requires `export.data` permission.
14. Mobile: table collapses to card view — shows RFI #, title, BIC badge, status, and overdue indicator. Tap opens full detail.
15. Real-time: new RFI from another user appears at top of list with subtle highlight animation. Status changes reflect immediately.

---

## 4. Submittals (`/submittals`)

**Module ID**: `submittals` | **Min Role**: viewer | **Permission**: `submittals.view`

### What This Page Does
Tracks every material and shop drawing approval from submission through the approval chain. The approval workflow is the core — each submittal passes through a defined sequence of reviewers with enforced order.

### Data Displayed
- **Table Columns**: Submittal #, Title, Spec Section, Type (shop drawing/product data/sample/mock-up), Status, Submitted By, Current Reviewer, Due Date, Lead Time (days), Revision #.
- **Status Pipeline**: Pending → Under Review → Approved / Approved as Noted / Rejected / Resubmit.
- **Approval Chain Visualization**: horizontal stepper showing each reviewer with their decision status (pending/approved/rejected).

### Acceptance Criteria
1. Submittal numbers follow CSI spec section format: `01 33 00 - 001` (spec section - sequence). Configurable per project.
2. Approval chain: defined at creation. Each reviewer in sequence receives notification only when the previous reviewer approves. Cannot skip reviewers.
3. "Approved as Noted" allows the reviewer to attach markup/redline PDFs that the submitter must acknowledge.
4. Rejection triggers a resubmittal workflow: original submittal linked to revision. Revision number increments (Rev 0, Rev 1, Rev 2). Full history preserved.
5. Lead time tracking: calculates business days between submission and final approval. Flags submittals exceeding spec-defined lead times.
6. Due date auto-calculated from schedule phase need-by date minus lead time. Shown as "X days until needed on site."
7. `submittals.approve` permission required to see approve/reject buttons. Only the current reviewer in the chain can act.
8. Bulk submission: select multiple submittals → "Submit for Review" sends all to their first reviewer.
9. Empty state: "No submittals yet — track material approvals to keep procurement on schedule." CTA: "Create Submittal" and "Import from Spec."
10. Linked to procurement: approved submittals can trigger PO creation. Link shown in detail panel.
11. PDF viewer: inline preview of submittal documents with markup tools (for reviewers). Side-by-side comparison for resubmittals (old vs. new).
12. Mobile: approval actions available via swipe gestures — swipe right to approve, swipe left to reject (with confirmation).

---

## 5. Budget (`/budget`)

**Module ID**: `budget` | **Min Role**: project_engineer | **Permission**: `budget.view`

### What This Page Does
The financial backbone. Shows original budget, approved changes, committed costs, and actual costs by CSI division. The budget is not a spreadsheet — it's a living financial model that connects to change orders, pay apps, and procurement.

### Data Displayed
- **Summary Bar**: Original Contract, Approved Changes, Revised Contract, Committed, Actual to Date, Projected Final, Variance.
- **Line Item Table**: CSI Division, Description, Original Budget, Approved COs, Revised Budget, Committed, Actual, Projected, Variance, Variance %.
- **Charts**: Budget vs. Actual bar chart by division. S-curve (planned vs. actual spend over time). Cost breakdown pie chart.
- **Contingency Tracker**: Original contingency, used, remaining, burn rate.

### Acceptance Criteria
1. All dollar values formatted with `$` prefix, thousand separators, and two decimal places in detail view. Summary cards use compact format (`$1.2M`).
2. Variance calculation: `Revised Budget - Projected Final`. Positive = under budget (green). Negative = over budget (red). Zero = on budget (neutral).
3. Contingency burn rate: `used / original × 100`. Amber at >50%, red at >75%. Visual progress bar.
4. Editing a line item shows the delta inline before saving: "This changes the projected total from $1,250,000 to $1,310,000 (+$60,000)."
5. Change orders flow in automatically: when a CO is approved, the relevant budget line items update. Link to source CO shown.
6. Budget lock: project_manager+ can lock the budget to prevent edits during pay app periods. Locked state shows a banner: "Budget locked for Period 7 billing. Unlock after pay app submission."
7. `budget.edit` required to modify line items. `budget.approve` required to lock/unlock and approve reallocations. Viewers see read-only with no edit affordances.
8. Export: Excel export with formulas intact (not just values). PDF export matching AIA format. Both require `export.data` permission.
9. Empty state: "Set up your budget to track every dollar. Import from estimate or start from a CSI template." CTAs: "Import from Excel" and "Start from Template."
10. S-curve chart: plots planned cumulative spend (dashed line) vs. actual cumulative spend (solid line) vs. projected (dotted). Hover shows exact values at any date.
11. Real-time: if another user edits a budget line item, the row flashes briefly and updates. Edit lock prevents simultaneous edits to the same line.
12. Filtering: by CSI division, variance threshold (show only items >5% over), cost type (labor/material/equipment/sub).
13. Mobile: summary cards stack vertically. Table becomes a scrollable card list grouped by division. Charts remain interactive with pinch-to-zoom.

---

## 6. Schedule (`/schedule`)

**Module ID**: `schedule` | **Min Role**: viewer | **Permission**: `schedule.view`

### What This Page Does
Interactive Gantt chart with critical path analysis, weather-aware risk prediction, and what-if scenario planning. This is not a static timeline — it's a living schedule that responds to reality.

### Data Displayed
- **Gantt Chart**: Phase bars with start/end dates, dependencies (FS/FF/SS/SF), milestones (diamonds), critical path highlighting (red).
- **KPI Cards**: Schedule Variance (days), Critical Path Items, On Track %, Complete %.
- **Risk Panel**: AI-predicted delays based on weather, RFI aging, submittal lead times, crew availability.
- **What-If Mode**: Drag phases to simulate impact on downstream tasks and project completion.

### Acceptance Criteria
1. Gantt renders phases as horizontal bars. Color-coded by status: on-track (green), at-risk (amber), delayed (red), complete (gray).
2. Critical path calculated automatically from dependency chain. Highlighted in red. Any change to a critical path item shows projected completion date impact.
3. Dependencies: click-and-drag from one phase's end to another's start to create a dependency. Dependency type selectable (FS default). Circular dependency detection with error message.
4. Zoom levels: day, week, month, quarter. Keyboard: `+`/`-` to zoom. Mouse scroll on timeline to pan.
5. Schedule Variance: `planned_end - projected_end` for each phase. Overall SV is the project milestone variance. Negative = behind (red), zero = on track (green), positive = ahead (blue).
6. What-If mode: toggle activates a sandbox. Changes shown in a diff color (orange). "Apply Changes" commits them. "Discard" reverts. Banner: "What-If Mode — changes are not saved until you apply them."
7. Weather integration: overlay weather forecast on timeline. Rain/snow days flagged with icons. AI calculates impact: "3 rain days forecasted next week — outdoor concrete work at risk."
8. Baseline comparison: toggle to show original baseline dates as ghost bars behind current bars. Variance visible at a glance.
9. `schedule.edit` required for drag-to-reschedule and creating phases. Viewers see read-only Gantt.
10. Milestones: diamond markers on specific dates. Hover shows milestone name and status. Overdue milestones pulse red.
11. Empty state: "Build your schedule to track every phase from mobilization to closeout." CTA: "Create First Phase" and "Import from P6/MS Project."
12. Mobile: Gantt replaced with a timeline list view (vertical). Each phase is a card with start/end dates, progress bar, and status. Tap to expand details.
13. Performance: 500+ phases render smoothly. Virtualized rendering for phases outside the visible viewport.
14. Print: landscape PDF export with configurable date range, showing dependencies and critical path. Fits on standard paper sizes.

---

## 7. Daily Log (`/daily-log`)

**Module ID**: `daily-log` | **Min Role**: superintendent | **Permission**: `daily_log.view`

### What This Page Does
The daily record of what happened on site — crew counts, work performed, weather, visitors, deliveries, and incidents. This is a legal document. Accuracy and completeness are non-negotiable.

### Data Displayed
- **Log Entry**: Date, weather conditions (auto-populated from weather API), temperature, wind, precipitation.
- **Sections**: Manpower (crew counts by trade), Work Performed (narrative + linked schedule phases), Equipment Used, Materials Received, Visitors, Safety Observations, Delays/Issues.
- **Status**: Draft → Submitted → Approved.
- **Calendar View**: Monthly calendar showing which days have logs, their status, and gaps.

### Acceptance Criteria
1. One log per day per project. Attempting to create a duplicate shows: "A daily log for [date] already exists" with link to open it.
2. Weather auto-populates from weather API based on project location. Superintendent can override. Auto-populated data marked with "Auto" badge.
3. Manpower section: table of trade/company/headcount/hours. Running total at bottom. Links to crew definitions.
4. Work Performed: rich text with ability to link schedule phases. When a phase is linked, its percent-complete can be updated directly from the daily log.
5. Draft → Submitted: superintendent clicks "Submit for Approval." Once submitted, the log is locked for editing (except by project_manager+ who can return to draft).
6. Submitted → Approved: project_manager+ reviews and approves. Approved logs are permanently locked. Amendments create a linked addendum, not an edit.
7. `daily_log.create` required to start a new log. `daily_log.submit` to submit. `daily_log.approve` to approve. `daily_log.reject` to return to draft with rejection note.
8. Calendar view: green dots for approved days, yellow for submitted, orange for draft, red outline for missing days. Clicking a missing day opens the create form pre-filled with that date.
9. Photo attachments: each section supports photo upload with caption and GPS coordinates (from field capture). Photos display as a thumbnail strip.
10. Offline support: daily logs can be drafted offline. Queued for sync with banner indicator. Conflict resolution: if another user submitted the same date's log, show both versions for manual merge.
11. Empty state: "No daily logs yet. The daily log is your project's official record." CTA: "Start Today's Log."
12. Empty day (no log for today): persistent banner at top of page — "Today's daily log hasn't been started" with "Start Log" button. Visible to superintendent+ only.
13. Export: PDF export with project header, weather, all sections formatted for printing. Supports date range export (weekly/monthly compilation).
14. Mobile: optimized for field use. Large touch targets, voice-to-text for narrative sections, camera integration for quick photo capture. Works fully offline.
15. SPEED BENCHMARK: A superintendent must be able to submit a complete daily log (weather + 3 crew entries + 2 work items + 2 photos) in under 90 seconds from page load. Measure and optimize for this target.
16. "Same as yesterday" button: one tap pre-fills crew, equipment, and visitors from the previous day's log. Superintendent only needs to update work performed and add photos.
17. Default toggles: "No incidents today" and "No visitors today" default to ON. Sections expand only when toggled OFF. This eliminates 2 form sections for 90% of days.
18. Photo multi-select: "Add Photos" opens camera/gallery with multi-select. All photos upload in parallel with progress indicator. Auto-tag with timestamp and GPS.
19. Voice-to-text: microphone icon next to every text input. Tap to speak, auto-transcribe. Essential for gloved hands in winter.

---

## 8. Punch List (`/punch-list`)

**Module ID**: `punch-list` | **Min Role**: viewer | **Permission**: `punch_list.view`

### What This Page Does
Tracks deficiencies from identification through two-step verification. Every punch item has a responsible party, a location, and before/after photo evidence. The verification workflow (Sub completes → GC verifies) is the core differentiator.

### Data Displayed
- **Item Card/Row**: Item #, Title, Area/Location, Responsible Party (Sub/GC/Owner), Status, Priority, Due Date, Before Photo, After Photo.
- **Status Pipeline**: Open → In Progress → Sub Complete → Verified (or Rejected → back to Open).
- **Filters**: Status, responsible party, area, priority, trade.
- **Stats Bar**: Total items, open, in progress, sub complete (awaiting verification), verified, overdue.

### Acceptance Criteria
1. Two-step verification: Sub marks "Complete" → item moves to "Sub Complete" state → GC verifies by reviewing after-photo and clicking "Verify" or "Reject."
2. Rejection requires a note explaining why. Rejected items return to "Open" with the rejection note visible in the activity thread.
3. Status colors: Open = amber/pending, In Progress = blue/active, Sub Complete = purple/awaiting, Verified = green/complete, Rejected = red/critical.
4. Responsible party color coding: Subcontractor (warm background), GC (blue background), Owner (orange background). Consistent everywhere.
5. Due date aging: >4 days remaining = green text, 1-4 days = amber text, overdue = red text with "X days overdue" label.
6. Before/after photos: side-by-side comparison view in detail panel. Photos tagged with GPS coordinates plotted on floor plan if drawing is linked.
7. Location: hierarchical — Building → Floor → Room/Area. Searchable. Links to drawing sheet when available.
8. `punch_list.create` to add items. `punch_list.edit` to modify. `punch_list.verify` (project_manager+) to verify/reject. Subcontractors can only mark their own items complete.
9. Bulk operations: select multiple → "Assign to Sub," "Change Priority," "Set Due Date." Bulk verify for GC (with individual photo review required).
10. Empty state: "No punch list items — your project is looking clean! Items will appear here as deficiencies are identified during inspections."
11. Floor plan overlay: toggle to view items plotted on the drawing sheet. Items appear as colored pins. Click pin to open detail.
12. Export: PDF punch list report grouped by area or responsible party. Includes photos. Excel export for bulk editing and re-import.
13. Mobile: camera-first workflow. "Add Item" opens camera immediately. After photo capture, form appears with location auto-detected from GPS. Swipe to view before/after photos.
14. Real-time: when a sub marks an item complete, the GC's list updates with a notification badge on the "Awaiting Verification" filter.

---

## 9. Drawings (`/drawings`)

**Module ID**: `drawings` | **Min Role**: viewer | **Permission**: `drawings.view`

### What This Page Does
The plan room. Every drawing sheet is versioned, linked to RFIs and submittals, and AI-analyzed for coordination conflicts. This replaces the physical plan table — it must be faster than unrolling a blueprint.

### Data Displayed
- **Drawing List/Grid**: Sheet number, title, discipline, revision number, date issued, linked RFIs count, linked submittals count, last viewed timestamp.
- **Discipline Filters**: Architectural (blue), Structural (red), Mechanical (green), Electrical (yellow), Plumbing (purple), Civil (brown), Fire Protection (orange). Color-coded pills.
- **AI Panel**: Coordination conflicts detected across disciplines. "A-201 Rev3 conflicts with S-101 — beam location shifted 6 inches."
- **Revision History**: Timeline of all revisions per sheet with change summary.

### Acceptance Criteria
1. Drawing viewer: full-screen pan/zoom with smooth rendering. Pinch-to-zoom on mobile. Double-tap to zoom to fit.
2. Revision management: uploading a new version auto-increments revision number. Previous revisions remain accessible. Current revision is the default view. "View Previous Revisions" dropdown in viewer.
3. Markup tools: pen, highlighter, text, rectangle, circle, arrow, cloud, dimension. Color picker. Markups are saved per-user as a layer that can be toggled. Shared markups require `drawings.markup` permission.
4. Linked items: RFI pins appear as numbered blue circles on the drawing at their referenced location. Submittal pins are green. Clicking opens the linked item detail.
5. AI Insights panel: lists detected conflicts with severity (high/medium/low). Each insight links to the specific drawing area. "Analyze" button triggers on-demand AI analysis for a single sheet.
6. `drawings.upload` required to add/update drawings. `drawings.markup` for shared annotations. `drawings.delete` to remove sheets. Viewers can view and add personal (private) markups only.
7. Discipline filter: clicking a discipline pill toggles it. Multiple disciplines can be active. Active pills are filled, inactive are outlined.
8. Search: by sheet number or title. Instant results.
9. Upload: drag-and-drop or file picker. Supports PDF (multi-page = multiple sheets), DWG, DXF. Processing indicator: "Processing sheet 3 of 12..."
10. Empty state: "No drawings uploaded yet. Upload your plans to enable digital markup, RFI linking, and AI coordination analysis." CTA: "Upload Drawings."
11. Grid view: thumbnail of each sheet (auto-generated from first page of PDF). List view: table with sortable columns.
12. Side-by-side comparison: overlay two revisions with opacity slider to spot differences. Or split-screen left/right.
13. Mobile: drawing viewer with pinch-to-zoom. Markup tools in a collapsible bottom toolbar. Quick-link to create RFI from a markup.
14. Offline: recently viewed drawings cached locally. Markups saved offline and synced on reconnect.

---

## 10. Payment Applications (`/pay-apps`)

**Module ID**: `pay-apps` | **Min Role**: project_engineer | **Permission**: `financials.view`

### What This Page Does
Generates AIA G702/G703 payment application documents. This is the money page — every number must be auditable, every calculation must be correct to the penny. Errors here mean delayed payments or legal disputes.

### Data Displayed
- **Pay App List**: Period #, Date, Status (draft/submitted/approved/rejected), Gross Amount, Retainage, Net Amount, Previous Certifications.
- **G702 Summary**: Original contract sum, net change by COs, contract sum to date, total completed and stored to date, retainage, total earned less retainage, less previous certificates, current payment due.
- **G703 SOV Table**: Item #, Description of Work, Scheduled Value, Work Completed (previous periods), Work Completed (this period), Materials Stored, Total Completed & Stored, % Complete, Balance to Finish, Retainage.

### Acceptance Criteria
1. All financial calculations MUST be server-verified — never trust client-side math alone. Discrepancies between client and server calculations trigger an error, not a silent override.
2. SOV line items must sum to the contract total. Adding a line item that would break the sum shows: "Line items total $X, but contract sum is $Y. Adjust values to match."
3. Retainage calculation: configurable percentage per line item or global. Retainage auto-calculated. Manual override with audit trail entry noting the reason.
4. Period locking: submitting a pay app locks that period. Previous periods' completion percentages become read-only. No backdating.
5. This-period completion: shown as both dollar amount and percentage. Percentage auto-calculated from dollar amount and scheduled value. Editing either updates the other.
6. Status workflow: Draft → Submitted (locks for editing by creator) → Approved (by project_manager+) → Rejected (returns to draft with notes). Each transition logged in audit trail.
7. G702 PDF: generates pixel-perfect AIA G702 form. All fields populated. Signature blocks for contractor and architect. Date fields auto-populated.
8. G703 PDF: continuation sheet with all SOV line items. Multi-page with running totals. Matching column widths to AIA standard.
9. Previous certifications: auto-populated from prior approved pay apps. Cannot be edited in current period — they are historical records.
10. Lien waiver integration: each pay app period linked to required lien waivers. Cannot submit pay app until all required lien waivers are attached. Warning: "Missing lien waivers for: [list of subcontractors]."
11. Change order integration: approved COs auto-generate new SOV line items. CO items clearly marked as "CO #X — [description]."
12. Empty state: "No payment applications yet. Create your first pay app to start billing against the schedule of values." CTA: "Create Pay App Period 1." Prerequisite check: "You need a schedule of values before creating a pay app" with link to SOV setup.
13. Mobile: view-only for pay app detail. Approval buttons accessible. SOV table scrolls horizontally with frozen description column.
14. Export: G702 and G703 as separate PDFs. Combined PDF option. Excel export of SOV data for offline editing and re-import.
15. Audit trail: every edit to every cell logged with user, timestamp, old value, new value. Accessible from the pay app detail panel.

---

## 11. Safety (`/safety`)

**Module ID**: `safety` | **Min Role**: viewer | **Permission**: `safety.view`

### What This Page Does
Tracks incidents, inspections, observations, toolbox talks, and certifications. Safety is not optional — this page enforces documentation discipline and ensures compliance with OSHA reporting requirements.

### Data Displayed
- **Dashboard Cards**: Days Since Last Incident, TRIR (Total Recordable Incident Rate), Open Corrective Actions, Inspections This Week, Certifications Expiring Soon.
- **Incident Log**: Date, type, severity (first_aid/medical_treatment/lost_time/fatality), location, involved parties, status (open/investigating/closed).
- **Inspection Schedule**: Upcoming and past inspections by template (daily safety walk, weekly site audit, monthly equipment inspection).
- **Certifications**: Personnel certifications with expiration tracking.

### Acceptance Criteria
1. Incident severity color coding: First Aid (yellow), Medical Treatment (orange), Lost Time (red), Fatality (black). These colors are immutable and match OSHA standards.
2. "Days Since Last Incident" counter: prominent display, resets to 0 on any incident with severity ≥ medical_treatment. First aid incidents do not reset the counter.
3. TRIR calculation: `(Total Recordable Incidents × 200,000) / Total Hours Worked`. Auto-calculated from incident and manpower data. Displayed with industry benchmark comparison.
4. Incident creation: requires date, location, description, severity, involved persons. Photos required for severity ≥ medical_treatment. OSHA 300 form fields auto-populated.
5. Corrective actions: each incident generates required corrective actions. Each action has an assignee, due date, and status. Overdue corrective actions trigger notifications to safety_manager and project_manager.
6. `safety.manage` required to create incidents, inspections, and manage certifications. `safety.view` for read-only access. Field engineers can submit safety observations.
7. Toolbox talk attendance: digital sign-in sheet with topic, date, presenter, and attendee list. Attendees can sign on their device. Signature capture via touch.
8. Certification tracking: alerts at 90, 60, and 30 days before expiration. Expired certifications shown in red with "EXPIRED" badge. Worker cannot be assigned to tasks requiring that certification until renewed.
9. Empty state: "Safety tracking not yet set up. Configure your safety program to track incidents, inspections, and certifications." CTA: "Set Up Safety Program" which walks through initial configuration.
10. Inspection templates: customizable checklists. Each item is pass/fail/NA with photo and note fields. Completed inspections generate a PDF report.
11. Mobile: incident reporting optimized for field use — photo-first, voice-to-text for description, GPS auto-tag location. Works offline with priority sync.
12. Export: OSHA 300/300A/301 form generation. Monthly safety report PDF with all metrics and charts.

---

## 12. Directory (`/directory`)

**Module ID**: `directory` | **Min Role**: viewer | **Permission**: `directory.view`

### What This Page Does
The project phone book — every person, company, and contact method for everyone involved. From the owner to the last subcontractor's foreman. Searchable, filterable, and linked to project roles.

### Data Displayed
- **Contact Card**: Name, company, role/title, email, phone (mobile + office), trade/discipline, status (active/inactive).
- **Company View**: Group contacts by company. Company info: name, address, insurance status, contract status.
- **Search**: Global search across all fields.

### Acceptance Criteria
1. Search: instant results across name, company, email, phone, role, and trade. Fuzzy matching for typos.
2. Contact card: click-to-call on phone numbers (mobile), click-to-email on email addresses. Copy to clipboard option for all contact fields.
3. Company grouping: expandable company cards showing all associated contacts. Company-level info: insurance certificate status (current/expired/missing), contract status.
4. `directory.manage` required to add/edit/delete contacts. Viewers can view and search.
5. Import: CSV/Excel import with column mapping wizard. Duplicate detection: "This email already exists for [Name]. Update or skip?"
6. Export: CSV, Excel, PDF contact list. vCard export for individual contacts. Bulk vCard export for syncing to phone.
7. Empty state: "Build your project directory. Add every stakeholder so your team always knows who to call." CTA: "Add First Contact" and "Import from CSV."
8. Linked data: contact cards show linked RFIs (where they're BIC), tasks assigned, submittals, and meeting attendance. Quick navigation to those items.
9. Insurance integration: contacts linked to companies that have insurance certificates show the certificate status. Expiring within 30 days shows warning.
10. Mobile: contact list with large tap targets. Tap phone number to call. Tap email to compose. Search bar fixed at top.

---

## 13. Meetings (`/meetings`)

**Module ID**: `meetings` | **Min Role**: viewer | **Permission**: `meetings.view`

### What This Page Does
OAC (Owner-Architect-Contractor) meetings, subcontractor meetings, and internal meetings — all with agendas, minutes, and action item tracking. Meeting minutes are a contractual record.

### Data Displayed
- **Meeting List**: Date, title, type (OAC/internal/subcontractor/safety), attendees count, action items (open/total), status (scheduled/in-progress/completed), series name.
- **Meeting Detail**: Agenda items (ordered), discussion notes per item, decisions made, action items generated.
- **Action Items**: description, assignee, due date, status, linked meeting.

### Acceptance Criteria
1. Meeting series: recurring meetings (weekly OAC, daily standup) created as a series. Each occurrence inherits the template agenda but can be customized.
2. Agenda management: ordered list of items. Drag-to-reorder. Each item has a title, presenter, allocated time, and notes section.
3. During meeting: real-time collaborative note-taking (Liveblocks). Multiple attendees can type simultaneously. Presence indicators show who's active.
4. Action items: created inline during meeting. Each action has: description, assignee (from directory), due date. Open actions from previous meetings carry forward to next meeting in the series.
5. Attendance tracking: attendee list from directory. Mark present/absent/remote. Attendees can self-check-in via their device.
6. Minutes generation: "Generate Minutes" button produces a formatted PDF: header with project info, date, attendees (present/absent), agenda with notes, decisions, action items, next meeting date.
7. `meetings.create` required to schedule and manage meetings. `meetings.view` to see meetings and minutes. Attendees receive calendar invitations.
8. Empty state: "No meetings scheduled. Set up your recurring OAC meeting or schedule a one-off." CTA: "Schedule Meeting."
9. Carry-forward: unresolved action items and tabled agenda items automatically appear on the next meeting in the series with "Carried from [date]" label.
10. Mobile: meeting view optimized for laptops/tablets. On phone, attendee check-in and action item viewing prioritized.
11. Integration: calendar sync (Google Calendar, Outlook). Video conferencing link generation (LiveKit).

---

## 14. Field Capture (`/field-capture`)

**Module ID**: `field-capture` | **Min Role**: field_engineer | **Permission**: `field_capture.view`

### What This Page Does
Photo and data capture from the field — georeferenced, timestamped, and linked to drawings, tasks, and punch items. This is built for dusty boots and gloved hands, not desk workers.

### Data Displayed
- **Photo Feed**: Chronological grid of captured photos with metadata overlays (date, time, location, tags).
- **Map View**: Photos plotted on site plan or satellite map by GPS coordinates.
- **Linked Items**: Each capture can link to a drawing, task, punch item, daily log, or RFI.

### Acceptance Criteria
1. Camera-first UX: "Capture" button opens camera immediately (native camera via Capacitor on mobile, file picker on desktop). No form before the photo.
2. Auto-metadata: every capture auto-tagged with GPS coordinates, timestamp, device info, and weather conditions. User cannot modify timestamp or GPS (integrity guarantee).
3. Post-capture form: after taking photo, overlay form appears — Title (optional), Notes (optional), Tags (multi-select), Link to (searchable: drawing/task/punch/RFI/daily log). All optional — user can "Save" with just the photo.
4. Drawing pin: when linked to a drawing, the user taps the location on the drawing sheet. A pin appears at that spot. The photo is retrievable from both the field capture feed and the drawing viewer.
5. AI photo analysis: auto-detects safety violations (missing PPE), progress status, and material types. Results shown as suggestions, not assertions. "AI detected: possible missing hard hat — review and confirm."
6. `field_capture.create` required to capture. `field_capture.view` for browsing. Subcontractors can capture but only see their own photos.
7. Offline: full capture workflow works offline. Photos queued with metadata for background sync when connectivity returns. Queue visible: "12 photos pending upload."
8. Empty state: "No field captures yet. Start documenting site conditions with photos." CTA: "Open Camera."
9. Bulk operations: select multiple photos → add tags, link to item, export, or delete.
10. Time-lapse: photos taken at the same GPS location over time presented as a time-lapse slider. "Show progress at this location."
11. Export: selected photos as ZIP with metadata CSV. Or PDF report with photos, captions, and map.
12. Mobile: THE primary interface. Designed for one-handed use. Large capture button. Swipe between photos. Voice notes for hands-free annotation.

---

## 15. Change Orders (`/change-orders`)

**Module ID**: `change-orders` | **Min Role**: viewer | **Permission**: `change_orders.view`

### What This Page Does
Tracks every scope change from proposal through approval and budget integration. Change orders are the financial control mechanism — no cost can change without a documented, approved CO.

### Data Displayed
- **CO List**: CO #, Title, Type (owner-directed/contractor-initiated/field-directive/allowance draw), Status (pending/approved/rejected), Amount, Impact (schedule days), Requested By, Date.
- **Summary Bar**: Total COs, approved total ($), pending total ($), rejected total ($), net change to contract.
- **CO Detail**: Description, justification, cost breakdown (labor/material/equipment/sub markups), schedule impact assessment, supporting documents, approval chain.

### Acceptance Criteria
1. CO numbers: sequential, immutable. Format: `CO-001`. Prefix configurable per project.
2. Cost breakdown: itemized by cost type — labor (hours × rate), materials (quantity × unit cost), equipment (days × rate), subcontractor (with markup %), overhead and profit markup. All calculations shown, not just totals.
3. Markup percentages: configurable per project (default: 10% overhead, 10% profit on sub work; 15%/10% on self-performed). Applied automatically, editable per CO.
4. Status workflow: Draft → Pending (submitted for review) → Approved / Rejected. Approved COs automatically update budget line items and SOV. Rejected COs archived with reason.
5. `change_orders.create` to draft. `change_orders.approve` (project_manager+) to approve/reject. `change_orders.promote` to convert a potential change to a formal CO.
6. Potential Change Orders (PCOs): tracked separately as potential scope changes. Promoted to formal COs when confirmed. PCO → CO link maintained.
7. Schedule impact: mandatory field. Options: "No impact," or "X days added to [phase]." If days added, linked to schedule phase. Approved CO with schedule impact auto-extends the phase.
8. Supporting documents: attach proposals, quotes, photos, correspondence. Required before submission (configurable).
9. Approval chain: configurable per project. Multi-level approval for COs above threshold (e.g., >$50K requires owner approval in addition to PM).
10. Empty state: "No change orders — scope is holding steady. When changes arise, document them here to keep the budget accurate." CTA: "Create Change Order."
11. Contract integration: running total of approved COs shows net contract change. Percentage change from original contract.
12. Export: individual CO as PDF with cost breakdown and signatures. CO log as Excel/PDF summary report.
13. Mobile: view and approve COs. Create only from desktop (due to cost breakdown complexity).
14. Real-time: pending COs show notification badge. Approval/rejection triggers notification to all watchers.

---

## 16. Email Notifications (System-wide)

**Module ID**: `notifications` | **Min Role**: viewer | **Permission**: automatic

### What This Does
Sends transactional email notifications when important events happen. Without email notifications, RFIs sit unanswered for weeks because nobody knows they were assigned.

### Notification Triggers and Acceptance Criteria
1. RFI assigned to user → email within 60 seconds with RFI title, due date, and direct link.
2. RFI response received → email to RFI creator with response preview and link.
3. RFI overdue (3 days past due) → email to ball-in-court party AND project manager.
4. Submittal returned for revision → email to submitter with reviewer comments.
5. Submittal approved → email to submitter and PM with approval status.
6. Change order pending approval → email to approver with CO summary and amount.
7. Daily log not submitted by 6 PM local time → reminder email to superintendent.
8. Payment application ready for review → email to GC PM and owner rep.
9. Punch item assigned → email to subcontractor with item description, location, and photo.
10. Meeting scheduled → email to all invitees with date, time, location, agenda.
11. User preferences: each notification type can be set to instant, daily digest, or off. Settings page at `/settings/notifications`.
12. Daily digest email: sent at 7 PM local time, summarizes all project activity for the day (new RFIs, status changes, overdue items, upcoming deadlines).
13. Every email includes: project name in subject line, direct link to entity, unsubscribe link.
14. Emails render correctly on mobile (responsive HTML, tested on iOS Mail and Gmail).
15. Notification queue: all emails queued in `notification_queue` table with status tracking (pending/sent/failed).
16. Failed emails retry 3 times with exponential backoff. After 3 failures, logged as failed with error.

---

## Cross-Page Verification Checklist

The QA engine MUST verify these cross-cutting concerns across all 15 pages:

| Check | Pass Criteria |
|-------|--------------|
| Skeleton → Content transition | No layout shift. Skeleton geometry matches final. |
| Empty → Populated transition | First item creation dismisses empty state instantly. |
| Permission downgrade | Removing a permission hides the UI element on next render (within realtime subscription window). |
| Offline → Online sync | All queued mutations resolve. Conflict toast if applicable. |
| Deep link | Every entity detail view has a shareable URL. Opening that URL cold-loads directly to the entity. |
| Browser back/forward | Navigation state preserved. Filters, scroll position, and open panels restored. |
| Concurrent edit | Second editor sees lock message. First editor's changes persist. |
| Bulk action + undo | Bulk operations show "X items updated" toast with "Undo" for 8 seconds. |
| Keyboard-only flow | Every CRUD operation completable without a mouse. |
| Export consistency | Exported data matches on-screen data exactly (same filters, same sort). |
| Notification linking | Tapping a notification navigates to the exact entity referenced, not just the list page. |
| Search result ranking | Exact matches first, then partial, then fuzzy. Never show irrelevant results. |

---

## How the Engine Should Use This Document

1. **Before auditing any page**: read the corresponding section above. Treat every numbered criterion as a test case.
2. **Severity classification**: if a criterion is violated, classify as — **P0** (blocks user workflow or causes data loss), **P1** (incorrect data display or broken permission), **P2** (UX polish, animation, or formatting), **P3** (nice-to-have enhancement).
3. **Ambiguity resolution**: if a criterion is ambiguous, interpret it in the way that is **safest for data integrity and most restrictive for permissions**. When in doubt, the answer is "lock it down and show a clear error."
4. **Criterion not listed**: for pages not in the top 15, apply the Global Acceptance Standards plus the patterns established by the closest analogous page above.
5. **Versioning**: this document is versioned with the codebase. Any change to acceptance criteria MUST be accompanied by a matching code change or a documented exception.

---

*Last updated: 2026-04-01*
*Author: Walker + Claude*
*Version: 1.0*
