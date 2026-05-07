# RFI Mega Prompt — Bugatti Finalization (2026-05-07)

You are running unattended. This is the largest RFI prompt yet. ~35-40 hr.
Plan internally; ship one mega-PR per major phase if it gets unwieldy
(prefer: ONE PR with clear commit boundaries per phase; OK to split into
two PRs if context limits force it).

Read first, in this order:
- docs/audits/RFI_EDIT_MANIPULATE_AUDIT_2026-05-06.md
- docs/audits/RFI_MODULE_BUILD_SPEC_2026-05-04.md
- docs/audits/UX_BUGATTI_AUDIT_FRAMEWORK_2026-05-04.md (the 12 categories)
- docs/audits/UX_BUGATTI_AUDIT_FINDINGS_2026-05-04.md (RFI-relevant items)
- docs/audits/IRIS_TELEMETRY_SPEC_2026-05-04.md
- docs/audits/IRIS_VOICE_GUIDE_SPEC_2026-05-04.md
- docs/audits/BUGATTI_LAUNCH_ROADMAP_2026-05-04.md (Program 5 perf budgets)

Goal: bring the RFI module to ≥9.5/10 on every Bugatti audit category.
This is the closing-out phase. After this PR (or two), RFI is shippable
to Brad Cameron's pilot and competitive against Procore on every axis we
care about.

Branch off main once #332 + the P2b PR have merged: rfi/p2c-mega-bugatti.

═══════════════════════════════════════════════════════════════════════
PHASE 1 — Cross-module wiring (~6 hr)
═══════════════════════════════════════════════════════════════════════

## 1.1 Linked items system (~3 hr)

- New table: `rfi_links(
    id UUID PK,
    rfi_id UUID NOT NULL REFERENCES rfis ON DELETE CASCADE,
    target_type ENUM('submittal','drawing','schedule_phase','budget_item',
                     'punch_item','daily_log','meeting','rfi','change_order'),
    target_id UUID NOT NULL,
    link_kind ENUM('blocks','blocked_by','related','derived_from','converts_to'),
    created_by UUID REFERENCES auth.users,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(rfi_id, target_type, target_id, link_kind)
  );`
- RLS: project members can read/insert; sender or admin can delete.
- New `<RFILinkedItemsPanel />` on RFI Detail and Edit panel: typeahead
  to add by entity type; chips with X-remove; click chip → navigate.
- Reverse-render: opening a Submittal/Drawing/Schedule/etc. shows
  "Linked RFIs" section with the RFIs that link to it.
- Audit row per link added/removed.
- **Acceptance:** Walker links RFI-072 to Submittal SUB-014 with link_kind
  "blocks"; opens SUB-014 → sees "RFI-072 blocks this submittal" in a
  Linked RFIs section.

## 1.2 Convert RFI → other entity (~2 hr)

- Action menu on RFI detail: "Convert to Submittal" / "Convert to
  Change Event" / "Convert to Punch Item" / "Convert to Field Directive".
- Each conversion opens a pre-filled creation form for the target
  entity, with an automatic rfi_link of kind 'converts_to'.
- Original RFI stays open; conversion is non-destructive.
- **Acceptance:** Walker clicks "Convert to Change Event" on RFI-072;
  CE form opens with subject, description, cost impact pre-filled
  from the RFI; saves; both RFI-072 and CE-007 show the converts_to
  link.

## 1.3 Cost code + location + trade typeahead (~1 hr)

- The RFI Edit panel's Cost Code / Location / Trade fields become
  typeaheads sourced from:
  - Cost Code: `budget_items.code` on the project
  - Location: `project_locations` table (if present; if not, free-text)
  - Trade: trades enum or `project_trades` junction (use enum if
    project_trades doesn't exist)
- **Acceptance:** Walker types "03" in Cost Code; gets dropdown with
  "03 30 00 — Cast-in-Place Concrete", "03 33 00 — Architectural
  Concrete"; picks one; field commits the code + label.

═══════════════════════════════════════════════════════════════════════
PHASE 2 — Drawing pin + Spec book (~7 hr)
═══════════════════════════════════════════════════════════════════════

## 2.1 Drawing pin viewer (~4 hr)

- New `rfi_drawing_pins` table: pin coordinates (x, y, sheet_id) per RFI.
- On RFI detail, "Drawing References" section gains a "Place pin"
  button per drawing ref; opens the existing drawing viewer with a
  cursor in pin-placement mode; click commits the pin.
- The drawing sheet now renders RFI pins as numbered dots; clicking a
  pin opens that RFI in a side panel without leaving the sheet.
- Reuse the existing drawing-viewer component (find it via grep —
  likely `src/pages/drawings/DrawingViewer.tsx`).
- **Acceptance:** Walker opens RFI-072, clicks "Place pin" on drawing
  A2.02; drawing opens; clicks at column line 7; pin saves; opens
  A2.02 directly; sees the pin; clicks it; RFI-072 panel opens.

## 2.2 Spec book uploader + linkage (~3 hr)

- New `project_spec_book` table: section_code (e.g. "09 30 00"),
  section_title, division (e.g. "09 — Finishes"), responsible_party
  (typeahead from directory).
- Project Settings → Spec Book gains an upload button: parses a
  CSI-format CSV or PDF (use existing pdf-extract infra if present;
  else CSV-only for P2c); inserts spec_book rows.
- The RFI Spec Section field becomes a typeahead from project_spec_book
  with the section_title preview + "Responsible: <party>" hint.
- Iris pass 4 (answerer suggestion) reads `spec_book.responsible_party`
  for an additional confidence boost.
- **Acceptance:** Walker uploads the project's spec CSV (50 sections);
  opens RFI-072, types "09 30" in Spec Section; gets dropdown with
  the actual section titles; picks one; Iris auto-suggests the
  responsible firm in Ball In Court.

═══════════════════════════════════════════════════════════════════════
PHASE 3 — RFI Settings module (~7 hr)
═══════════════════════════════════════════════════════════════════════

New route: `/projects/:id/settings/rfi` with sub-tabs.

## 3.1 Workflow Templates (~2 hr)

- New `project_rfi_workflows` table: name, stages JSONB
  (array of {name, sla_days, ball_in_court_role, response_type_filter}),
  default boolean.
- UI: list templates, [Edit] / [Duplicate] / [Delete], [+ New Template].
- Editor: drag-reorder stages, set SLA per stage, pick
  ball-in-court role, pick allowed response types.
- Default templates seeded per project: "Standard", "Design", "Cost
  Impact", "Owner Approval", "Field-Only".
- When creating an RFI, picker lets PM choose the workflow template.

## 3.2 Response Types config (~1 hr)

- New `project_rfi_response_types` table: type_code, label, color,
  counts_as_answered boolean, requires_resubmittal boolean.
- Default seeded: the 7 P1b values.
- UI: list types, edit label/color/flags, [+ New Type], [Delete].
- Composer's response_type select reads from this table per project.

## 3.3 Custom Fields (~2 hr)

- New `project_rfi_custom_fields` table: field_code, label,
  field_type ENUM('text','number','date','select','user'),
  options TEXT[] (for select), required boolean, applies_to_template_id UUID.
- New `rfi_custom_values` table: rfi_id, field_code, value JSONB.
- UI on Settings → Custom Fields: list, edit, [+ New Field].
- Custom fields render in the RFI Edit panel below the standard fields,
  in a "Project-Specific" section.
- **Acceptance:** Walker creates a "Permit Number" text custom field
  marked required; new RFI form requires it; existing RFIs show it
  as editable in the Edit panel.

## 3.4 Permissions matrix UI (~1 hr)

- New page: Settings → RFI Permissions. Renders a matrix:
  rows = roles (owner / project_admin / project_manager / member /
  sub / external), columns = actions (create / respond / mark official
  / close / reopen / see_private / distribute / export / change_settings
  / delete).
- Each cell is a checkbox. Persists to `project_rfi_permissions` table.
- PermissionGate references this table at runtime instead of hardcoded
  rules.
- **Acceptance:** Walker unchecks "sub.export"; subcontractor login no
  longer sees the Export button.

## 3.5 Numbering rules (~0.5 hr)

- Settings → RFI Numbering: prefix (default "RFI-"), suffix, padding
  width (default 3), per-trade sequences toggle, manual override per
  RFI toggle.
- Persisted to `project_rfi_settings`.
- **Acceptance:** Walker sets prefix "MERCRO-RFI-" and width 4; next new
  RFI is "MERCRO-RFI-0072".

## 3.6 Notifications config (~0.5 hr)

- Settings → RFI Notifications: per-event matrix (created / assigned /
  responded / closed / overdue / mention / distribute_delivered /
  distribute_bounced) × per-channel (email / in-app / SMS).
- Per-user override on Profile.
- Persisted to `project_rfi_notification_prefs` + `user_notification_overrides`.

═══════════════════════════════════════════════════════════════════════
PHASE 4 — Reports module (~6 hr)
═══════════════════════════════════════════════════════════════════════

New route: `/projects/:id/rfis/reports`.

## 4.1 Canned reports (~3 hr)

Six pre-built reports:
- Avg response time per firm (bar chart by ball-in-court firm)
- On-time close % (gauge per project, trend over time)
- Cost at risk ($ sum of open RFIs with cost_impact_cents > 0)
- Schedule at risk (days sum of open RFIs with schedule_days_impact > 0)
- RFI by trade/spec/location heatmap
- Designer scorecard (response time + accuracy by firm)

Use Chart.js (already CDN-friendly per artifacts skill if needed; or
the existing chart lib in tree — grep for it).

## 4.2 Custom report builder (~2 hr)

- Drag-and-drop or form-based: pick chart type / x-axis / y-axis /
  filters / group-by.
- Save as named report (`rfi_custom_reports` table).
- Run on demand; render inline; export as PNG / CSV / PDF.

## 4.3 Scheduled email delivery (~1 hr)

- For any saved report, enable scheduled delivery: daily/weekly/monthly,
  recipients (typeahead), subject template.
- Hooks into the same hybrid cron from P2b Iris weekly digest
  (per ADR-003).
- Persisted to `rfi_scheduled_reports`.

═══════════════════════════════════════════════════════════════════════
PHASE 5 — Bugatti Polish Pass (~12-14 hr)
═══════════════════════════════════════════════════════════════════════

This phase converts the RFI module from "feature-complete" to
"≥9.5/10 on every Bugatti audit category."

## 5.1 Accessibility — WCAG 2.1 AA (~3 hr)

- Run axe-core on every RFI surface (list, detail, edit panel,
  bulk edit panel, settings, reports, kanban, calendar).
- Fix every violation:
  - Color contrast ≥4.5:1 body text, ≥3:1 large text + UI elements
    (use WebAIM contrast checker; adjust theme if needed)
  - Every interactive element has accessibilityLabel / aria-label
  - Logical focus order (tab through every page; document the order
    if non-default)
  - Keyboard navigable (no mouse-only flows; Esc closes panels;
    Enter/Space activates)
  - Screen reader tested (VoiceOver on Mac, document the test)
  - Color not sole conveyor of meaning (status color + text + icon)
  - Tap targets ≥44px (mobile)
  - Alt text on all images (drawing thumbnails, attachment previews,
    avatars)
- Reduce Motion respected on every animation.
- **Acceptance:** axe-core reports zero violations on every RFI surface;
  receipt includes axe output.

## 5.2 Voice linter — 100% copy coverage (~2 hr)

- Run the voice linter (`src/lib/iris/style.ts`) over every string in
  every RFI surface: tooltips, labels, placeholders, button text,
  empty-state text, error messages, toasts.
- Auto-fix what's auto-fixable (acronym casing); manually rewrite
  the rest.
- Add CI gate: voice linter runs on RFI-related files in PR; fails
  on regression.
- **Acceptance:** zero voice linter warnings on rfi-touching files;
  CI gate added.

## 5.3 Performance budgets (~3 hr)

Per BUGATTI_LAUNCH_ROADMAP Program 5:
- RFI list initial render < 600ms p95 (use react-virtual if rendering
  > 200 rows; lazy-load Kanban + Calendar views)
- Iris draft first token < 2s p95 (verify by instrumenting
  ai-rfi-draft-v2 + setting up a benchmark in tests)
- PDF export < 3s p95 (verify by benchmarking the deposition export
  for a 50-row dataset)
- Audit chain row write < 100ms p95 (verify by profiling
  audit_log inserts)
- No N+1 queries (run query analyzer; document any unavoidable)
- Code splitting per route (verify via bundle analyzer; if any RFI
  route bundle > 100KB gzip, lazy-load components)
- Cold-open eager bundle ≤ 600 KB (verify via build output)
- Add CI perf budget: fail if any of the above regresses by >100ms
  on the RFI surfaces.
- **Acceptance:** each budget verified with a number in the receipt;
  CI gate added.

## 5.4 Mobile field-test rig (~2 hr)

Per ADR-010 § Field-Test Rig — every RFI mobile surface tested in 7
adversarial conditions:
- Direct-sun readability (max brightness, outdoor; reads cleanly)
- Gloved-thumb tap targets (≥44px verified)
- 95°F-heat resilience (no thermal throttle crash — exercise iPad
  with heavy use simulation)
- Dropped-device survival (case-protected; functions after fall —
  document test)
- 12-hour-shift battery drain (background-aware — measure baseline)
- Cellular-dead-zone offline + sync (Dexie persistence verified —
  per ADR-010)
- Port-a-potty one-handed operation (every action reachable with
  one thumb on iPhone portrait)
- Sign off in code as `// FIELD-TESTED 2026-05-XX` on every RFI
  mobile surface.
- **Acceptance:** every RFI surface has the FIELD-TESTED comment;
  receipt includes Walker-grade test notes.

## 5.5 Keyboard navigation (~1 hr)

Per RFI_MODULE_BUILD_SPEC § keyboard:
- `?` — opens shortcuts help modal
- `/` — focus search
- `c` — new RFI
- `g i` — Iris draft
- `j` / `k` — navigate rows
- `e` — export
- `f` — filter (open All Filters panel)
- `Esc` — close any open panel
- `Cmd+Enter` — submit (already wired on response composer; verify
  on every form)
- New `<KeyboardShortcutsHelp />` modal triggered by `?`.
- **Acceptance:** Walker can drive the entire RFI module from the
  keyboard without touching the mouse for 5 minutes; document the
  driver journey in the receipt.

## 5.6 Audit-chain coverage validation (~2 hr)

- Write a script: `scripts/validate-rfi-audit-coverage.mjs`
- Walks every mutation hook in `src/hooks/queries/useRFI*.ts`
- Asserts each writes an audit_log row (matches a known template)
- Runs in CI as a gate
- Also: exercise the deposition export over a project with 50+ RFIs
  + 200+ responses + 100+ attachments + bulk operations + email
  inbound + Iris drafts. Verify the resulting PDF reconstructs the
  exact sequence of who-did-what-when.
- **Acceptance:** deposition export verified on a real Avery Oaks dataset;
  no audit gaps; CI gate added.

## 5.7 Empty / loading / error states (~1 hr)

Per UX_BUGATTI_AUDIT_FRAMEWORK categories 3, 4, 5:
- Every empty list state: "you don't have X yet" + actionable next
  step + on-brand illustration (not stock; use the existing illustration
  set)
- Every loading state: skeleton matching eventual layout, max 2s
  before timeout, shimmer respects Reduce Motion
- Every error state: specific message (not "Something went wrong"),
  retry button, logged to Sentry
- Sweep every RFI surface; fix any blank screens / stuck skeletons /
  vague errors.

═══════════════════════════════════════════════════════════════════════
CONSTRAINTS (CLAUDE.md, hard)
═══════════════════════════════════════════════════════════════════════

- Typecheck stays at 0 errors on both `tsconfig.app.json` and `tsconfig.node.json`
- Money math via `src/types/money.ts` (cost rollups in reports)
- PermissionGate every action; reference `project_rfi_permissions` for
  per-role gates
- Per-entity audit_log on every state change
- `entityLabel()` for entity_type renders
- `<UserName />` for user_id renders
- Voice linter clean on all new copy (and CI gate added per 5.2)
- Reduce Motion respected on all animations
- Accessibility: zero axe-core violations on RFI surfaces
- Performance: budgets verified per 5.3; CI perf gate added
- Tests: add or update for every new component / hook / function;
  maintain or improve current vitest count

═══════════════════════════════════════════════════════════════════════
ACCEPTANCE — entire mega-prompt
═══════════════════════════════════════════════════════════════════════

Brad Cameron walks through SiteSync RFI module on his iPad, in direct
sun, wearing gloves, on a flaky cell connection. He:

1. Opens his Procore project's RFI list (now imported via the
   Procore→SiteSync bridge that already exists).
2. Filters to overdue RFIs assigned to MEP via the All Filters panel;
   saves as a personal view "MEP overdue Q2".
3. Switches to Kanban; drags a stale Open card to Under Review; the
   card animates (or jumps with Reduce Motion); audit row writes.
4. Holds the FAB; voice-records a new RFI about a wall finish conflict
   on drawing A2.02; releases. Iris pipeline drafts the RFI: cited
   drawings + spec sections + suggested architect-of-record + due
   date 12 days out + cost impact $0-2K. Brad accepts.
5. Opens the new RFI Edit panel; types in Cost Code "03"; sees CSI
   typeahead with section codes; picks one. Adds Custom Field "Permit
   Number" (defined in Settings → Custom Fields). Adds a drawing pin
   on A2.02 at column line 7; pin saves; opens A2.02 from a different
   tab; sees the pin; clicks it; RFI panel opens.
6. Distributes to 3 emails; one bounces; chip turns red within 1 min.
7. Architect replies via email with PDF attached; reply lands in
   thread within 2 min with envelope badge + 3 attachments. Iris
   triage suggests "Approved as noted" + "Close RFI"; Brad clicks
   Apply; RFI closes.
8. Brad opens Reports → "On-time close %"; sees gauge at 87%, 3-month
   trend up. Schedules a Monday morning email to himself + project
   owner.
9. Opens Iris Inbox Monday morning; sees Iris weekly digest with the
   5 highest-risk open RFIs.
10. Hits `?`; shortcuts modal appears; navigates the next 5 RFIs with
    `j`/`k`; opens one with Enter; closes with Esc.

End-to-end, no broken pages. Sub-600ms list render. Sub-2s Iris first
token. Zero axe-core violations. Zero voice-linter warnings. Zero
audit-chain gaps. Field-tested in direct sun with gloves.

═══════════════════════════════════════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════════════════════════════════════

- Progress receipts every ~6 hr at `docs/audits/
  DAY_X_RFI_MEGA_CHECKPOINT_<phase>_<date>.md`
- Final receipt: `docs/audits/DAY_X_RFI_MEGA_RECEIPT_<date>.md` with:
  - Phase-by-phase status table
  - Bugatti audit score per category (target ≥9.5; document why each
    surface scores what it does)
  - Performance benchmark numbers
  - Axe-core report
  - Voice linter report
  - Field-test rig sign-off matrix
  - Audit-chain validation output
  - Deferred items (if any) with rationale
- PR title: "RFI Mega — Bugatti finalization (cross-module + settings
  + reports + polish)"
- Do NOT approve the PR yourself.

If context limits force a split, do Phases 1-4 as one PR titled
"RFI P2c — cross-module + settings + reports" and Phase 5 as a
follow-up titled "RFI Bugatti Polish Pass". Phase 5 must wait for
Phase 1-4 to land first.
