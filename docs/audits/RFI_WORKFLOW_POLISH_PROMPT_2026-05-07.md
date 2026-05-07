# RFI Workflow Polish Mega Prompt — Bugatti Micro-Details (2026-05-07)

You are running unattended. Walker's exact ask: *"the whole workflow and the
minor details — creating RFIs, editing, the whole thing."* This is the
"every interaction has been thought about" pass. ~30-35 hr.

Read first, in this order:
- docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md (Procore baseline)
- docs/audits/RFI_DEEP_DIVE_2026-05-04.md (the original 39-issue inventory)
- docs/audits/RFI_MODULE_BUILD_SPEC_2026-05-04.md (full spec, esp. § 4.2 Create flow + § 4.4 Detail page)
- docs/audits/RFI_MEGA_PROMPT_2026-05-07.md (what JUST landed)
- docs/audits/UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md (12 categories)
- docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md

Branch off main once #335 + the polish branch have merged: rfi/workflow-polish.

═══════════════════════════════════════════════════════════════════════
PHASE 1 — Create RFI flow (Quick + Full + Voice + Email-to-RFI) (~7 hr)
═══════════════════════════════════════════════════════════════════════

## 1.1 Two-tier Create modal (~3 hr)
- **Quick RFI** (current modal, keep ⌘+Enter): subject, question (rich text),
  to (single ball-in-court typeahead), due (default 7d), priority, attachments.
  Shows a "+ Add details" link that expands to Full mode.
- **Full RFI** (new): collapsible sections that progressively reveal:
  - **Question(s)** — supports multiple questions in one RFI (each renders
    as its own thread on detail; RFI closes when all answered). Add/remove
    question buttons.
  - **Context** — Trade typeahead, Cost Code typeahead (from budget_items),
    Spec Section typeahead (from spec_book), Location typeahead, Drawing
    Refs (multi-select drawings with optional pin placement on each).
  - **Impact** — Cost Impact $ range or TBD, Schedule Impact days, link to
    schedule activity (typeahead from schedule_phases) — Gantt impact preview
    if linked.
  - **People** — From, Ball-in-Court (or multi-Assignee chips per P1b),
    Reviewers (chain), Distribution (multi with role-group quick-add),
    Watchers, "CC vendor" toggle.
  - **Workflow** — pick a workflow template from project_rfi_workflows.
  - **Attachments** — same drag-drop manager as Edit panel.
  - **Privacy** — Internal-only / Shared, Private toggle.
  - **Custom Fields** — render project_rfi_custom_fields with required gating.
  - **Related items** — link to Submittals/CEs/Punch/Daily Log/Meetings/RFIs.
  - **Numbering** — auto by default; "Override" gives manual input (admin).
- Footer: **Save Draft** / **Send** / **Send & New** (clears + reopens).
- ⌘+Enter sends from any focused field. Esc warns if dirty.
- **Acceptance:** Walker creates a 3-question RFI in Full mode with
  drawing-pin + spec link + multi-assignee + cost impact + custom field;
  saves; detail page shows 3 separate question threads.

## 1.2 Voice-to-RFI in Create modal (~1.5 hr)
- "Mic" button next to the Question field opens a voice recorder
  (already wired in P2b). Transcript flows through the multi-pass Iris
  pipeline; result populates every field.
- Walker can edit any field before saving.
- **Acceptance:** Walker hits Mic, speaks 30s, releases; Iris fills every
  field including drawing/spec citations.

## 1.3 Email-to-RFI in Create modal (~1 hr)
- "Convert email" button opens a paste-area; user pastes an email thread;
  Iris parses and fills every field per P2b §1.5.
- **Acceptance:** Walker pastes an architect's email; modal fills with
  question + suggested ball-in-court + spec ref.

## 1.4 Save Draft auto-recovery (~1 hr)
- Drafts persist to localStorage keyed by user × project × draft_id (or "new").
- If a draft exists for a returning user, show "Recover draft from N min ago"
  banner with Restore / Discard.
- **Acceptance:** Walker starts an RFI, closes the tab, reopens 5 min later,
  sees recovery banner, restores; all fields populate.

## 1.5 Quick RFI FAB (~0.5 hr)
- The existing FAB (bottom-right) opens Quick mode by default. Long-press
  opens voice; right-click (or hold + slide) opens Full.
- Tooltip shows ⌘K shortcut.
- **Acceptance:** Walker triggers from FAB; ⌘K opens Quick mode globally.

═══════════════════════════════════════════════════════════════════════
PHASE 2 — Detail page rebuild (~7 hr)
═══════════════════════════════════════════════════════════════════════

## 2.1 Tabbed layout (~3 hr)
Replace the one-long-scroll detail page with **6 tabs**:
- **Overview** — question + responses + status pipeline + key metadata
- **Questions & Responses** — when multi-question, full thread per question
- **Attachments** — drag-drop manager (already exists, promote to dedicated tab)
- **Related Items** — RFILinkedItemsPanel (from P2c phase 1)
- **Activity** — entity_history with filters (mutations / responses / Iris /
  emails / status changes)
- **Audit / Deposition** — chain integrity + deposition pack download
  (existing functionality, promote)

URL state: `/rfis/:id/(overview|responses|attachments|related|activity|audit)`.
Default: overview. Tab badges show counts (e.g., "Responses (5)", "Attachments (3)").

**Acceptance:** Walker clicks Activity tab; sees a filterable feed with
mutations/responses/Iris/emails/status as facet filters.

## 2.2 Sticky right sidebar (~2 hr)
While on any tab, render a 320px right sidebar with:
- Ball In Court — avatar + name + SLA countdown ("Due in 3 days")
- Status pill (with mini timeline preview)
- Distribution List — chips (read-only summary, click to open editor)
- Watchers — chips (read-only summary, click to open editor)
- Linked Items — chips (read-only summary, click to open Related tab)
- Schedule strip — if linked, show the activity + how this RFI affects it
- Cost strip — if cost_impact_cents > 0, show budget line affected

Sidebar collapses on < 1024px viewport.

**Acceptance:** Walker opens RFI-072; sidebar shows everything at a glance
without scrolling; clicking a watcher chip opens the watcher editor in a
modal.

## 2.3 Action header polish (~1 hr)
Header bar with:
- Back to RFIs (breadcrumb)
- RFI-### number + status pill + days-open counter (with hover breakdown:
  "14 days open · 9 calendar days · 2 holidays · 3 weekend days")
- **Watching** toggle (existing)
- **Distribute** button (existing)
- **Edit** button (opens slide-in panel from list)
- **Audit trail** button (opens Audit tab)
- Primary action (state-aware: Send for Review / Mark Answered / Mark
  Official / Close / Reopen)
- "···" overflow menu: Print / Duplicate / Convert to Submittal/CE/Punch/FD
  / Delete / Move project

**Acceptance:** Walker hovers days-open counter → tooltip shows the
breakdown; clicks "···" → menu with all 7 actions.

## 2.4 Status pipeline polish (~1 hr)
The 5-stage pipeline (Draft → Open → Under Review → Answered → Closed)
gets:
- Closed = green checkmark (not orange "5" — Field Manual Part II item #13)
- Current stage highlighted with subtle pulse animation (Reduce Motion-aware)
- Each stage shows duration ("3 days here")
- Hover any stage → tooltip with who advanced + when
- Void/Returned shown as a separate path (not in main pipeline)

**Acceptance:** Walker hovers each stage; tooltip shows "Advanced by Brad
Cameron · May 6 · 2 days here".

═══════════════════════════════════════════════════════════════════════
PHASE 3 — List page micro-polish (~5 hr)
═══════════════════════════════════════════════════════════════════════

## 3.1 Per-row Edit/View buttons (~1 hr)
Match Procore exactly: each row gets `[Edit]` and `[View]` buttons in a
column at the left. Edit opens the slide-in panel (from P1a). View opens
the detail page in a new tab on Cmd-click; same tab otherwise.

## 3.2 Per-column 3-dot menu (~1 hr)
Each column header gets a kebab menu: Sort A→Z / Sort Z→A / Hide column /
Filter by this column / Group by this column / Pin left.

## 3.3 Row hover preview drawer (~1.5 hr)
Hovering a row for >500ms shows a right-side drawer with the RFI summary
(question + ball-in-court + recent activity) without leaving the list.
Click anywhere else to dismiss.

## 3.4 KPI hover affordances (~0.5 hr)
The 5 KPI cards (already clickable from P2a) get:
- Hover: cursor-pointer + subtle shadow + tooltip showing the filter
- Active state when clicked (matches the URL filter)
- Number animates with count-up on first render (Reduce Motion-aware)

## 3.5 Bulk action bar refinements (~1 hr)
- Sticky position when scrolling
- "Select all matching filter" link when partial selection
- Each bulk action shows confirmation modal with count ("Apply to 47 RFIs?")
- Progress bar during bulk operations (per-item progress, not just spinner)

═══════════════════════════════════════════════════════════════════════
PHASE 4 — Workflow micro-details (~6 hr)
═══════════════════════════════════════════════════════════════════════

## 4.1 Reopen with reason (~1 hr)
- Reopen button opens a modal with required reason text + reason category
  enum ('clarification_needed' | 'scope_changed' | 'response_inadequate' |
  'other'). Persist to rfi_state_changes.
- **Acceptance:** Walker reopens RFI-099; modal requires a reason; close
  button disabled until filled; persisted on the timeline.

## 4.2 Void with reason (~0.5 hr)
- Same pattern as Reopen. Void requires reason + admin/owner role.

## 4.3 Pause clock with reason picker (~0.5 hr)
- Already wired in P2b. Refine the picker UI: dropdown with the 4 enum
  values + free text. Auto-save on close.

## 4.4 Dirty-form warning (~0.5 hr)
- Any modal/panel with unsaved changes warns on close attempt: "Discard
  changes?" with [Cancel] / [Discard].
- Cmd+S saves from any form.

## 4.5 Toast feedback on every action (~1 hr)
- Every mutation produces a sonner toast: success (green), warn (amber),
  error (red).
- Bulk operations show count + "Undo" link (where reversible) for 5s.
- **Acceptance:** Walker bulk-changes priority on 7 RFIs; toast says
  "Updated 7 RFIs · Undo"; clicking Undo reverts.

## 4.6 Required field legend (~0.5 hr)
- All forms with required fields show "* required" legend at the bottom.
- Required field errors are inline (red border + error text), not toast.

## 4.7 Confirmation patterns (~0.5 hr)
- Destructive actions (Delete, Void, Permanently Delete from Recycle Bin)
  always confirm with explicit "Type RFI-XXX to confirm" for permanent
  delete.
- Non-destructive bulk actions confirm with count only.

## 4.8 Print / Duplicate / Move project (~1.5 hr)
- **Print**: opens browser print dialog with print-optimized layout
  (no sidebar, no nav, full question + responses + attachments listed).
- **Duplicate**: creates a new draft RFI with all fields copied + "(Copy)"
  appended to subject; opens edit panel.
- **Move project**: admin-only modal to pick a target project; warns
  about RLS implications and re-numbers per target's settings; persists
  audit row to both source and target projects.

═══════════════════════════════════════════════════════════════════════
PHASE 5 — Visual / motion / accessibility polish (~5 hr)
═══════════════════════════════════════════════════════════════════════

## 5.1 Empty avatar fallback (~0.5 hr)
- Replace orange "?" default avatar (Field Manual Part II item #8) with
  initials on a tinted background (color from username hash).
- Apply globally via the Avatar primitive.

## 5.2 Sidebar user identity fix (~0.5 hr)
- Sidebar bottom-left currently shows "—" (Field Manual Part II item #6).
  Wire to current user's full_name + role.
- Apply globally.

## 5.3 Skeleton loaders match real layout (~1.5 hr)
- Sweep every RFI surface; replace any generic skeleton (rectangles) with
  layout-matching skeletons (column widths, row heights, chip shapes).
- Ensure no skeleton lasts > 2s (timeout to error state).

## 5.4 Empty states (~1 hr)
- Every empty list state: "No RFIs match this filter" / "You haven't
  created any RFIs yet" with on-brand illustration (use existing
  illustration set, NOT stock).
- Each empty state has an actionable CTA ("Create your first RFI" /
  "Clear filters").

## 5.5 Error states (~0.5 hr)
- Every error state has specific message (no "Something went wrong"),
  retry button, Sentry-logged.
- Network errors get specific copy: "Couldn't reach SiteSync. Check
  your connection — your changes are saved locally."

## 5.6 Animations (~1 hr)
- Audit every animation in RFI surfaces (Kanban drag, panel slide-in,
  toast enter/exit, modal fade, card hover).
- Use easing curves (cubic-bezier(0.16, 1, 0.3, 1) for standard, 0.34
  for elastic) — not linear.
- Reduce Motion respected on all (use useReducedMotion hook from
  framer-motion or media query).

═══════════════════════════════════════════════════════════════════════
CONSTRAINTS (CLAUDE.md, hard)
═══════════════════════════════════════════════════════════════════════

- Typecheck stays at 0 errors.
- Money math via src/types/money.ts.
- PermissionGate every action button.
- Per-entity audit_log on every state change.
- entityLabel() / <UserName /> reused.
- Voice linter clean on all new copy.
- Reduce Motion respected on all animations.
- Performance budgets maintained: list <600ms, Iris draft <2s, PDF <3s.
- Tests: add or update for every new component / hook / function.

═══════════════════════════════════════════════════════════════════════
ACCEPTANCE — entire prompt
═══════════════════════════════════════════════════════════════════════

Walker creates an RFI from the FAB by holding it, voice-recording for 30
seconds about a wall finish conflict at column line 7. The Iris pipeline
fills every field. He hits "+ Add details" → Full mode expands → he places
a drawing pin on A2.02 → adds a Cost Code from typeahead → fills the
"Permit Number" custom field → picks the "Standard" workflow template →
hits Send & New (clears, ready for the next RFI).

He opens RFI-072. Tabs: Overview / Responses / Attachments / Related /
Activity / Audit. Right sidebar shows ball-in-court + SLA + watchers +
linked items at a glance. He hovers the days-open counter; tooltip shows
the breakdown. He clicks "···" → Convert to Change Event → CE form opens
pre-filled.

He bulk-changes priority on 7 RFIs from the list; toast says "Updated 7
RFIs · Undo"; clicks Undo; all 7 revert. He reopens a closed RFI; modal
requires a reason; he picks "scope_changed" and types details; reopen
proceeds; timeline records the reason.

The sidebar bottom-left shows "Walker Benner · Project Manager" (not "—").
The default avatars show initials, not orange "?". Every empty state has
an illustration + CTA. Every loading is a layout-matching skeleton. Every
error has a retry. Every animation is smooth (or instant under Reduce
Motion).

End-to-end no broken pages.

═══════════════════════════════════════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════════════════════════════════════

- Progress receipts every ~6 hr at docs/audits/
  DAY_X_RFI_WORKFLOW_POLISH_CHECKPOINT_<phase>_<date>.md
- Final receipt: docs/audits/DAY_X_RFI_WORKFLOW_POLISH_RECEIPT_<date>.md
  with phase-by-phase status + screenshots referenced + Bugatti per-category
  re-score (target ≥9.5).
- PR title: "RFI Workflow Polish — Bugatti micro-details"
- Do NOT approve the PR yourself.

If context limits force a split:
- Phase 1+2 → "RFI Workflow Polish A — create + detail" (~14 hr)
- Phase 3+4+5 → "RFI Workflow Polish B — list + workflow + visual" (~16 hr)
