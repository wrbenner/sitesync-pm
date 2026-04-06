# SiteSync PM — Product Genome
<!-- GENOME-VERSION: 1.0.0 -->
<!-- LAST-EVOLVED: 2026-04-05 -->
<!-- COMPLETION: 34% -->
<!-- AI AGENTS: Read this file before every build. Update checkboxes as work completes. -->

## Product

**Name:** SiteSync PM  
**Version:** 1.0.0 (Production Readiness Sprint)  
**Last Updated:** 2026-04-05  
**Stack:** React 19 · TypeScript (strict) · Vite · Supabase · Tailwind CSS  
**Scale:** 211+ TypeScript files · 37+ pages · 48 migrations · 9 state machines · 14 integration services

### Vision

SiteSync PM is the first construction project management platform built as a living, self-improving organism — where a superintendent on a job site can resolve an RFI from their phone in under 60 seconds, a project manager can forecast budget overruns before they happen, and every piece of information from drawings to daily logs flows through a single intelligent system that learns from every project. The platform targets the $1.8T global construction industry's 98% digital under-penetration, replacing Procore, Autodesk Build, and Sage with a unified AI-native OS that matches the pace of the job site, not the pace of the back office.

---

## Quality Gates

Every feature MUST pass ALL gates before being marked complete. AI agents MUST NOT check a feature box unless all applicable gates pass.

| Gate | Threshold | Current Status |
|------|-----------|----------------|
| Build passes | `npm run build` exits 0, zero errors | ⚠️ Unstable |
| Lint passes | `npm run lint` — zero warnings, zero errors | ⚠️ Warnings present |
| TypeScript strict | `tsc --noEmit --strict` — zero errors, zero `as any` | ❌ Violations present |
| Test coverage | `> 70%` lines covered (Vitest) | ❌ ~20% estimated |
| Bundle size | Initial chunk `< 300 KB` (gzipped) | ⚠️ Unverified |
| Zero mock data | No hardcoded arrays, `Math.random()`, or `faker` in production paths | ❌ 6+ pages affected |
| Zero `as any` | TypeScript `as any` grep returns 0 results | ❌ Present |
| WCAG 2.1 AA | `axe-core` reports 0 violations on every page | ❌ 0% compliance |
| All E2E pass | `playwright test` — 100% pass rate | ⚠️ Partial coverage |
| PermissionGate enforced | Every data-mutating action behind `<PermissionGate>` | ❌ 0 pages enforced |
| No service role key in client | AI edge functions use per-user JWT, not service role | ❌ Present violation |
| State machines complete | All 9 state machines have full handler coverage | ❌ Handlers missing |

---

## P0 — Production Blockers

These issues prevent any production deployment. All P0 items MUST be resolved before P1 work begins. Each is sourced from the V4 audit.

---

### P0-1: Mock Data Elimination

**Status:** 0% complete  
**Priority:** P0  
**Pages:** RFIs, Submittals, PunchList, DailyLog, FieldCapture, AICopilot  
**Blocks:** Every investor demo, every real user test

**Acceptance Criteria:**
- [ ] `grep -r "Math.random\|faker\|mockData\|MOCK\|hardcoded" src/ --include="*.ts" --include="*.tsx"` returns 0 results in production code paths
- [ ] RFIs page fetches all RFI records from `rfis` Supabase table with proper project_id filter and displays real data
- [ ] Submittals page fetches from `submittals` table; submittal list renders real rows with actual status, ball-in-court, and due date
- [ ] PunchList page fetches from `punch_items` table; items display real location, assignee, and photo attachments from Supabase Storage
- [ ] DailyLog page fetches from `daily_logs` table; entries show real manpower, weather (from API or stored value), and activity descriptions
- [ ] FieldCapture page uploads photos to Supabase Storage bucket `field-captures` and inserts record into `field_captures` table; gallery renders from real URLs
- [ ] AICopilot page sends user messages to a real Supabase Edge Function (`/functions/v1/ai-copilot`); responses come from actual LLM, not static strings
- [ ] Each page that previously used mock data now shows an empty state component (not a blank screen) when no real data exists
- [ ] Loading skeletons display during data fetch on all 6 pages

**Tests Required:**
- [ ] Unit: `RFIs.test.tsx` — mock Supabase client, assert `from('rfis').select()` is called with correct project_id on mount
- [ ] Unit: `Submittals.test.tsx` — assert fetch called, assert empty state renders when response is empty array
- [ ] Unit: `DailyLog.test.tsx` — assert weather field populates from stored DB value, not `Math.random()`
- [ ] E2E: `mock-data-elimination.spec.ts` — visit each of 6 pages with test project, assert no element has `data-testid="mock-*"` attribute
- [ ] E2E: `field-capture-upload.spec.ts` — upload a photo, assert storage object created, assert DB record inserted
- [ ] A11y: axe-core scan on each page passes with 0 violations after real data renders

**Known Issues:**
- V4 audit confirmed: RFIs, Submittals, PunchList, DailyLog, FieldCapture, and AICopilot all use hardcoded/random mock data
- AICopilot static responses include placeholder text visible in demos

---

### P0-2: WCAG 2.1 AA Accessibility

**Status:** 0% complete  
**Priority:** P0  
**Pages:** All 42 pages  
**Blocks:** Legal compliance, enterprise sales, government contracts

**Acceptance Criteria:**
- [ ] `axe-core` integrated into Vitest test suite via `@axe-core/react`; CI fails on any new violation
- [ ] All interactive elements (buttons, links, inputs) have accessible names — no `aria-label`-less icon-only buttons
- [ ] Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text across all pages (verify with Colour Contrast Analyser)
- [ ] All form inputs have associated `<label>` elements or `aria-labelledby` references
- [ ] All data tables use `<thead>`, `<th scope="col/row">` markup — no `div`-based table layouts
- [ ] Keyboard navigation: every interactive element reachable via Tab key, visible focus indicator present
- [ ] Skip-to-main-content link is first focusable element on every page
- [ ] Modal dialogs trap focus correctly and return focus to trigger element on close
- [ ] Images and icons have meaningful `alt` text or `aria-hidden="true"` if decorative
- [ ] `lang` attribute set on `<html>` element in `index.html`
- [ ] Error messages in forms announced via `role="alert"` or `aria-live="polite"`

**Tests Required:**
- [ ] A11y: `axe-scan.spec.ts` — Playwright test visits all 42 routes, runs axe, asserts 0 violations per page
- [ ] Unit: `AccessibleModal.test.tsx` — assert focus trapped in modal, assert Escape closes modal, assert focus returns to trigger
- [ ] Unit: `FormField.test.tsx` — assert every input has associated label, assert error message has `role="alert"`
- [ ] E2E: keyboard-only navigation through RFI creation flow completes without mouse

**Known Issues:**
- V4 audit: zero WCAG compliance currently — no axe-core tests, no aria attributes on interactive elements
- Icon buttons throughout sidebar and toolbar have no accessible names

---

### P0-3: PermissionGate Enforcement

**Status:** 0% complete  
**Priority:** P0  
**Pages:** All pages with data-mutating actions  
**Blocks:** Multi-tenant security, enterprise deployment

**Acceptance Criteria:**
- [ ] `PermissionGate` component exists and accepts `permission: string | string[]`, `projectId?: string`, `fallback?: ReactNode` props
- [ ] `PermissionGate` reads user role from `useAuth()` context and checks against `project_members` table role column
- [ ] Every "Create RFI" button wrapped in `<PermissionGate permission="rfi:create">`
- [ ] Every "Edit Submittal" action wrapped in `<PermissionGate permission="submittal:edit">`
- [ ] Every "Approve Budget Change" wrapped in `<PermissionGate permission="budget:approve">`
- [ ] Every "Delete" action on any record wrapped in `<PermissionGate permission="*:delete">`
- [ ] Every "Submit Pay App" action wrapped in `<PermissionGate permission="payapp:submit">`
- [ ] Owner Portal renders read-only view for `role=owner`; edit controls hidden entirely (not just disabled)
- [ ] Supabase RLS policies enforce same permissions at database level — client-side gates are UI convenience, not security
- [ ] Attempting to call a mutation without permission returns a user-friendly error, not an unhandled rejection
- [ ] Permission matrix documented in `docs/permissions.md`

**Tests Required:**
- [ ] Unit: `PermissionGate.test.tsx` — renders children when user has permission, renders fallback when not, renders null fallback by default
- [ ] Unit: `PermissionGate.test.tsx` — project-scoped permissions check correct project_id
- [ ] E2E: `permissions.spec.ts` — login as `role=viewer`, attempt to click "Create RFI" button, assert button absent or disabled
- [ ] E2E: `permissions.spec.ts` — login as `role=admin`, assert all create/edit/delete buttons present
- [ ] E2E: Direct API call to insert RFI without auth returns 403 from Supabase RLS

**Formal Properties:**
- PROP-060: No API call returns data the user's role cannot access
- PROP-061: Permission checks are idempotent
- PROP-062: Session token refresh happens before expiry, never after

**Known Issues:**
- V4 audit: `PermissionGate` component exists in codebase but is used on 0 pages
- No RLS policies enforce role-based access beyond project membership check

---

### P0-4: AI Edge Functions Security

**Status:** 0% complete  
**Priority:** P0  
**Pages:** AICopilot, AIAgents, Vision  
**Blocks:** SOC 2 compliance, enterprise deployment

**Acceptance Criteria:**
- [ ] All Supabase Edge Functions that call OpenAI/Anthropic APIs use the calling user's JWT, not the service role key
- [ ] Edge functions extract user identity from `Authorization: Bearer <jwt>` header and verify with `supabase.auth.getUser()`
- [ ] Rate limiting enforced per-user in edge functions: max 50 AI requests per minute per user
- [ ] AI responses are never stored with PII unredacted — user query logged to `ai_audit_log` table with user_id, timestamp, and token count only
- [ ] Service role key removed from all edge function environment variable sets visible to client
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not present in any `.env` file committed to git
- [ ] AI function responses are streamed (SSE) — no 30-second timeout risk from buffering

**Tests Required:**
- [ ] Unit: Edge function handler — assert request without valid JWT returns 401
- [ ] Unit: Edge function handler — assert rate limiter blocks 51st request within 60-second window
- [ ] E2E: `ai-security.spec.ts` — call AI endpoint without auth header, assert 401 response
- [ ] E2E: Call AI endpoint with valid JWT, assert response streams and contains non-mock content

**Known Issues:**
- V4 audit: AI edge functions currently use `SUPABASE_SERVICE_ROLE_KEY` — any compromised JWT can trigger AI calls billed to the account

---

### P0-5: Offline Sync — Missing Tables

**Status:** 0% complete  
**Priority:** P0  
**Pages:** DailyLog, FieldCapture, PunchList, Tasks  
**Blocks:** Field crew usability (spotty LTE on job sites)

**Acceptance Criteria:**
- [ ] `rfis`, `daily_logs`, `punch_items`, `tasks`, and `field_captures` tables added to PowerSync schema configuration
- [ ] Offline mutations queue in `localStorage` via PowerSync mutation queue when network is unavailable
- [ ] UI shows "Offline — changes will sync when connected" banner when `navigator.onLine === false`
- [ ] Sync conflict resolution strategy documented: server wins on concurrent edits, with last-write timestamp
- [ ] On reconnect, queued mutations replay in order; any conflict surfaces as a non-blocking toast notification
- [ ] Offline sync works for photo attachments: base64 stored locally, upload to Supabase Storage on reconnect

**Tests Required:**
- [ ] Unit: `useOfflineQueue.test.ts` — assert mutations enqueue when offline, dequeue and execute when online
- [ ] E2E: `offline-sync.spec.ts` — set network to offline via Playwright, create daily log entry, go online, assert entry appears in DB

**Known Issues:**
- V4 audit: offline sync configured but `rfis`, `daily_logs`, `punch_items`, and `field_captures` tables missing from sync schema

---

### P0-6: State Machine Handler Completion

**Status:** 0% complete  
**Priority:** P0  
**Pages:** RFIs, Submittals, Tasks, ChangeOrders, DailyLog, PunchList, PaymentApplications  
**Blocks:** Core workflow reliability

**Acceptance Criteria:**
- [ ] RFI state machine: all transitions implemented — `draft → submitted → under_review → responded → closed` and `* → void`
- [ ] Submittal state machine: `draft → submitted → in_review → approved | rejected | revise_and_resubmit`
- [ ] Task state machine: `open → in_progress → in_review → complete | blocked`
- [ ] Change Order state machine: `draft → submitted → owner_review → approved | rejected`
- [ ] Daily Log state machine: `draft → submitted → approved`
- [ ] Punch Item state machine: `open → in_progress → ready_for_inspection → closed | rejected`
- [ ] Payment Application state machine: `draft → submitted → certified → paid | disputed`
- [ ] Closeout state machine: all handlers for document collection and owner sign-off
- [ ] Agent stream state machine: connected, streaming, error, disconnected states handled
- [ ] Every state transition emits an event to `activity_log` table with actor, timestamp, from_state, to_state
- [ ] Invalid state transitions return typed error — not unhandled exception

**Tests Required:**
- [ ] Unit: `rfi-machine.test.ts` — assert each valid transition succeeds, assert each invalid transition throws typed error
- [ ] Unit: `submittal-machine.test.ts` — same pattern for all 5 transitions
- [ ] Property: XState model-based testing — all reachable states reachable, all unreachable states unreachable
- [ ] E2E: `rfi-workflow.spec.ts` — create RFI, submit, respond, close — verify status column in DB at each step

**Known Issues:**
- V4 audit: multiple state machine handlers not implemented — calling a missing transition throws unhandled Promise rejection

---

## P1 — Core Platform

The table-stakes features. Must be complete and production-quality before any sales motion.

---

### P1-1: Dashboard

**Status:** 40% complete  
**Priority:** P1  
**Pages:** Dashboard, ProjectHealth

**Acceptance Criteria:**
- [ ] Dashboard loads in < 2 seconds on 4G connection (measure with Lighthouse CI)
- [ ] KPI tiles (Open RFIs, Overdue Submittals, Budget Variance, Schedule SPI) pull from real Supabase aggregation queries
- [ ] Each KPI tile has a loading skeleton and an error state
- [ ] Activity feed shows last 20 events from `activity_log` table, real-time via Supabase Realtime
- [ ] Project Health score calculated server-side (Edge Function) from: schedule adherence, budget variance, RFI age, open punch items
- [ ] Charts (budget burn, schedule S-curve) render real project data — no sample data
- [ ] Multi-project selector filters all dashboard data to selected project(s)
- [ ] Dashboard is responsive at 320px, 768px, 1024px, 1440px breakpoints
- [ ] Empty state ("No projects yet — create your first") shows when user has no projects

**Tests Required:**
- [ ] Unit: `Dashboard.test.tsx` — KPI tiles receive props from mocked Supabase query results
- [ ] Unit: `ProjectHealthScore.test.ts` — algorithm returns correct score for known input data
- [ ] E2E: `dashboard.spec.ts` — load dashboard with seeded project, assert KPI values match DB aggregates
- [ ] A11y: axe-core on Dashboard page — 0 violations
- [ ] Performance: Lighthouse CI — Performance score ≥ 85

**Formal Properties:**
- PROP-001: Dashboard renders with empty database without throwing
- PROP-002: All data shown matches live Supabase query results
- PROP-003: No component unmounts with pending network requests

---

### P1-2: RFIs

**Status:** 35% complete  
**Priority:** P1  
**Pages:** RFIs

**Acceptance Criteria:**
- [ ] RFI list view: sortable by number, subject, ball-in-court, due date, status; paginated (25 per page)
- [ ] RFI create modal: all required fields (subject, question, from, to, due date, drawing reference, specification section)
- [ ] RFI create modal validates all required fields before submission; inline errors shown
- [ ] Submitting an RFI calls state machine `submit` transition and updates DB atomically
- [ ] RFI detail view shows full thread: original question, official response, attachments, and full activity history
- [ ] Drawing reference field links to specific drawing from Drawings page (typeahead from `drawings` table)
- [ ] Email notification sent to ball-in-court party on RFI submission (Supabase Edge Function + SendGrid)
- [ ] Overdue RFIs highlighted with amber/red indicator when past due date
- [ ] RFI number auto-incremented per project (project-scoped sequence)
- [ ] "Export to PDF" generates an AIA-formatted RFI response document

**Tests Required:**
- [ ] Unit: `RFIForm.test.tsx` — required fields block submission, validation errors display inline
- [ ] Unit: `RFIList.test.tsx` — sort by due date reorders list, pagination controls work
- [ ] E2E: `rfi-crud.spec.ts` — create, submit, respond to, and close an RFI end-to-end
- [ ] E2E: `rfi-notification.spec.ts` — submit RFI, assert email event logged in `email_log` table
- [ ] A11y: axe-core on RFI list and detail views — 0 violations

**Formal Properties:**
- PROP-010: RFI status transitions follow valid state machine (Open > Under Review > Answered > Closed)
- PROP-011: SLA calculation is always (created_date + 14 days) minus current_date
- PROP-012: Ball in court assignment changes only on status transition

---

### P1-3: Submittals

**Status:** 30% complete  
**Priority:** P1  
**Pages:** Submittals

**Acceptance Criteria:**
- [ ] Submittal log view: columns for number, description, spec section, type, ball-in-court, required date, status
- [ ] Submittal create form: type selector (shop drawings, product data, samples, O&M manuals), spec section field, contractor promised date
- [ ] File attachments: drag-and-drop upload to Supabase Storage, multiple files per submittal, version tracking
- [ ] Review workflow: reviewer can mark Approved, Approved as Noted, Revise and Resubmit, or Rejected — each with stamp and comment
- [ ] Revision tracking: each resubmission creates a new revision row linked to parent submittal
- [ ] Submittal register importable from CSV (column mapping UI)
- [ ] Ball-in-court visibility: each party sees only items in their court highlighted

**Tests Required:**
- [ ] Unit: `SubmittalForm.test.tsx` — spec section field validates format (e.g. 03 30 00), file upload shows progress
- [ ] E2E: `submittal-review.spec.ts` — create submittal, upload file, approve with stamp, assert status updated
- [ ] A11y: axe-core on Submittals page — 0 violations

**Formal Properties:**
- PROP-020: Submittal revision numbers are monotonically increasing
- PROP-021: Approval status cannot skip states

---

### P1-4: Tasks

**Status:** 45% complete  
**Priority:** P1  
**Pages:** Tasks

**Acceptance Criteria:**
- [ ] Three views: List, Kanban board (columns = task states), and Gantt (date-based)
- [ ] Task create: title, description, assignee (from project team), due date, priority (P0–P3), tags, parent task
- [ ] Subtasks supported: nesting up to 3 levels
- [ ] Drag-and-drop on Kanban board triggers state machine transition
- [ ] Bulk operations: select multiple tasks, assign, change status, or delete in one action
- [ ] Task dependencies: "blocked by" relationship renders as predecessor link in Gantt
- [ ] @mention in task description notifies mentioned user via Supabase Realtime + email
- [ ] Filter by assignee, status, priority, tag, and due date range

**Tests Required:**
- [ ] Unit: `TaskKanban.test.tsx` — drag card from "open" to "in_progress" column triggers state machine
- [ ] Unit: `TaskForm.test.tsx` — subtask nesting creates correct parent_id reference
- [ ] E2E: `tasks-kanban.spec.ts` — create task, drag to complete, verify state in DB
- [ ] A11y: axe-core on Tasks page — 0 violations; Kanban drag-and-drop accessible via keyboard

---

### P1-5: Schedule

**Status:** 25% complete  
**Priority:** P1  
**Pages:** Schedule, Lookahead

**Acceptance Criteria:**
- [ ] Gantt chart renders with CPM (Critical Path Method) logic — critical path activities highlighted red
- [ ] Activities support: name, start date, end date, duration, predecessors (FS/SS/FF/SF relationships), resources
- [ ] Lookahead view: rolling 3-week and 6-week windows showing only tasks due in that window
- [ ] Schedule import: P6 XER file import (parse XML, map to `schedule_activities` table)
- [ ] Schedule import: Microsoft Project MPP import via server-side conversion
- [ ] Baseline saved and compared to current schedule; variance column shows days ahead/behind
- [ ] SPI (Schedule Performance Index) calculated from earned value data
- [ ] Schedule is printable to PDF (landscape, A3 size)

**Tests Required:**
- [ ] Unit: `criticalPath.test.ts` — CPM algorithm returns correct critical path for known network diagram
- [ ] Unit: `scheduleImport.test.ts` — XER parser correctly maps activities to DB schema
- [ ] E2E: `schedule-import.spec.ts` — upload XER file, assert activities appear in Gantt
- [ ] A11y: axe-core on Schedule page — 0 violations

**Formal Properties:**
- PROP-030: Critical path calculation uses longest path algorithm
- PROP-031: Activity completion percentage is bounded [0, 100]

---

### P1-6: Budget

**Status:** 30% complete  
**Priority:** P1  
**Pages:** Budget, Financials, ChangeOrders

**Acceptance Criteria:**
- [ ] Budget breakdown structure (CBS) matches WBS hierarchy
- [ ] Each cost code shows: original budget, approved change orders, revised budget, committed costs, actual to date, EAC, variance
- [ ] Change order impacts update revised budget in real-time when CO approved
- [ ] Budget forecasting: EAC calculated using Earned Value formula `EAC = AC + (BAC - EV) / CPI`
- [ ] Cost code import from CSV (Sage 300, QuickBooks, custom)
- [ ] Budget locked after project completion — requires admin override to edit
- [ ] Overage alerts: toast + email when any cost code exceeds 90% of budget

**Tests Required:**
- [ ] Unit: `eacCalculator.test.ts` — EAC formula returns correct value for known inputs
- [ ] Unit: `BudgetTable.test.tsx` — change order approved updates revised budget cell without page reload
- [ ] E2E: `budget-co-impact.spec.ts` — approve change order, assert revised budget column updates
- [ ] A11y: axe-core on Budget page — 0 violations

**Formal Properties:**
- PROP-040: Budget total = sum of all line items (no floating point drift)
- PROP-041: Variance = (actual minus budget) / budget * 100
- PROP-042: Change order amounts flow through to revised budget automatically

---

### P1-7: Daily Log

**Status:** 20% complete  
**Priority:** P1  
**Pages:** DailyLog

**Acceptance Criteria:**
- [ ] Daily log entries stored in `daily_logs` table with project_id, log_date, created_by
- [ ] Sections: Weather (temperature, conditions, precipitation), Manpower (crew counts by trade), Work Performed (free text + structured activity log), Equipment Used, Visitors, Safety Incidents, Photos
- [ ] Weather auto-populated from weather API (OpenWeatherMap or National Weather Service) on log creation using project address
- [ ] Manpower section links to `crews` table — select crew and enter headcount
- [ ] Photo attachments stored in Supabase Storage `daily-log-photos` bucket
- [ ] Superintendent sign-off: digital signature captured (canvas element), stored as PNG in Storage
- [ ] Log can be locked after sign-off — no further edits without admin override
- [ ] Exportable to PDF with company letterhead

**Tests Required:**
- [ ] Unit: `DailyLogForm.test.tsx` — weather pre-population calls weather API on mount, populates fields
- [ ] Unit: `SignatureCanvas.test.tsx` — canvas captures strokes, converts to PNG blob on save
- [ ] E2E: `daily-log-complete.spec.ts` — create full daily log with weather, manpower, photos, sign-off; assert all data in DB
- [ ] A11y: axe-core on DailyLog page — 0 violations

**Formal Properties:**
- PROP-070: Daily log entries are immutable after superintendent signature
- PROP-071: Weather data auto fill matches GPS coordinates of project site
- PROP-072: Crew hours imported never exceed 24 per person per day
- PROP-073: Photo GPS tags are within project geofence boundary

---

### P1-8: Drawings

**Status:** 35% complete  
**Priority:** P1  
**Pages:** Drawings

**Acceptance Criteria:**
- [ ] PDF drawings upload to Supabase Storage `drawings` bucket; server-side thumbnail generation via Edge Function
- [ ] Drawing viewer: pan, zoom, fit-to-screen, page navigation for multi-page PDFs
- [ ] Drawing versioning: upload new version preserves history; version switcher in viewer
- [ ] Markup tools: freehand pen, arrow, rectangle, text annotation — stored as JSON overlays, not baked into PDF
- [ ] Drawing sets: group drawings by discipline (Architectural, Structural, MEP, Civil)
- [ ] RFI linkage: any markup can be linked to an RFI; RFI pin appears on drawing
- [ ] Drawing register: list view with drawing number, title, discipline, revision, date, upload status
- [ ] Sheet comparison: overlay two versions with diff highlighting

**Tests Required:**
- [ ] Unit: `DrawingUpload.test.tsx` — file upload shows progress, triggers thumbnail generation
- [ ] Unit: `DrawingMarkup.test.ts` — markup JSON serializes and deserializes correctly
- [ ] E2E: `drawings-markup.spec.ts` — upload drawing, add annotation, link to RFI, verify in RFI detail
- [ ] A11y: axe-core on Drawings page — 0 violations; drawing viewer keyboard controls documented

**Formal Properties:**
- PROP-150: Current set indicator points to exactly one revision per drawing
- PROP-151: Revision numbers are monotonically increasing per drawing
- PROP-152: Drawing links to RFIs/submittals reference valid existing records

---

### P1-9: Punch List

**Status:** 20% complete  
**Priority:** P1  
**Pages:** PunchList

**Acceptance Criteria:**
- [ ] Punch items stored in `punch_items` table; linked to project, location, trade, and drawing
- [ ] Punch item create: description, location (room/area), trade responsible, due date, photo attachment
- [ ] Location can be tagged on drawing (x,y coordinates on a specific sheet)
- [ ] Ball-in-court filter: trade contractor sees only their items
- [ ] Punch item closure requires photo of completed work
- [ ] Punch list printable as PDF, grouped by trade or by location
- [ ] Status summary: count of open/in-progress/closed per trade

**Tests Required:**
- [ ] Unit: `PunchItemForm.test.tsx` — location drawing pin saves x,y coordinates with drawing_id
- [ ] E2E: `punch-list.spec.ts` — create item, assign to trade, close with photo, assert status = closed in DB
- [ ] A11y: axe-core on PunchList page — 0 violations

**Formal Properties:**
- PROP-090: Punch item status transitions follow valid state machine (Open > In Progress > Ready for Inspection > Closed)
- PROP-091: Closed punch items require at least one verification photo
- PROP-092: Batch close operation is atomic (all succeed or all roll back)
- PROP-093: Floor plan location tags reference valid drawing revision

---

### P1-10: Field Capture

**Status:** 15% complete  
**Priority:** P1  
**Pages:** FieldCapture

**Acceptance Criteria:**
- [ ] Camera access via `navigator.mediaDevices.getUserMedia()` on mobile; file input fallback on desktop
- [ ] Photo tagged with: timestamp (auto), GPS coordinates (from Geolocation API), project, location label, trade, and optional description
- [ ] Photos stored in `field-captures` Supabase Storage bucket; DB record in `field_captures` table
- [ ] Gallery view: filterable by date, location, trade; infinite scroll
- [ ] Offline capture: photo saved to IndexedDB when offline, synced on reconnect
- [ ] Batch upload: select multiple photos from device camera roll

**Tests Required:**
- [ ] Unit: `FieldCapture.test.tsx` — GPS coordinates attached to photo metadata on capture
- [ ] E2E: `field-capture.spec.ts` — upload photo, assert Storage object created and DB record inserted with correct metadata
- [ ] A11y: axe-core on FieldCapture page — 0 violations; camera trigger button accessible

**Formal Properties:**
- PROP-080: Offline queue preserves capture order (FIFO sync)
- PROP-081: Photo upload never exceeds Supabase storage bucket limits
- PROP-082: GPS coordinates resolve to valid lat/long ranges
- PROP-083: Voice transcription result is always stored alongside original audio

---

## P2 — AI Native

Features that differentiate SiteSync from every incumbent. Must be genuinely useful, not demo-ware.

---

### P2-1: AI Copilot

**Status:** 15% complete  
**Priority:** P2  
**Pages:** AICopilot

**Acceptance Criteria:**
- [ ] Chat interface with persistent conversation history stored in `ai_conversations` table
- [ ] AI has full context of the active project: reads `rfis`, `submittals`, `tasks`, `budget`, `schedule` via function calling
- [ ] Copilot can create RFIs, tasks, and daily log entries on user's behalf via confirmed function calls
- [ ] Streaming responses via SSE — partial tokens render as they arrive
- [ ] Citations: AI responses include source references (e.g., "Based on RFI #47 from March 12...")
- [ ] Conversation history accessible from sidebar; conversations searchable
- [ ] Suggested prompts contextually surfaced based on project state (overdue items, budget alerts)
- [ ] Token usage displayed per conversation

**Tests Required:**
- [ ] Unit: `AICopilot.test.tsx` — SSE stream renders tokens progressively
- [ ] Unit: `ai-context.test.ts` — context builder includes correct project data in system prompt
- [ ] E2E: `ai-copilot.spec.ts` — send message, assert response streamed, assert non-mock content
- [ ] E2E: `ai-create-rfi.spec.ts` — ask copilot to create RFI, confirm action, assert RFI in DB
- [ ] A11y: axe-core on AICopilot page — 0 violations; chat input reachable by keyboard

**Formal Properties:**
- PROP-140: AI responses never expose data from projects the user cannot access
- PROP-141: Shadow mode prediction is always generated before user sees AI suggestion
- PROP-142: Claude API timeout (30s) never blocks the main UI thread
- PROP-143: Project context injection includes only current project data

---

### P2-2: Vision Safety

**Status:** 5% complete  
**Priority:** P2  
**Pages:** Vision, FieldCapture, Safety

**Acceptance Criteria:**
- [ ] Photo uploaded to FieldCapture runs through Vision Edge Function: detect PPE compliance (hard hat, vest, safety glasses)
- [ ] Safety violations flagged in `safety_observations` table with photo_id, violation_type, confidence score
- [ ] Safety dashboard shows violation trend over time by type and location
- [ ] Superintendent receives push notification (web push) when violation detected above 90% confidence
- [ ] False positive feedback loop: user can mark a detection as incorrect; feedback stored to improve model

**Tests Required:**
- [ ] Unit: `visionAnalysis.test.ts` — mock Vision API response, assert violation record inserted
- [ ] E2E: `vision-safety.spec.ts` — upload known test photo with PPE violation, assert safety observation created
- [ ] A11y: axe-core on Vision and Safety pages — 0 violations

---

### P2-3: Predictive Analytics

**Status:** 10% complete  
**Priority:** P2  
**Pages:** Dashboard, ProjectHealth, Budget, Schedule

**Acceptance Criteria:**
- [ ] Budget overrun prediction: ML model (simple linear regression on cost burn rate) predicts EAC with confidence interval
- [ ] Schedule delay prediction: based on current SPI trend, predicts project completion date with probability distribution
- [ ] Risk score: composite score (1–100) updated daily from budget variance, schedule variance, open RFI count, weather data
- [ ] Predictions stored in `project_predictions` table with model_version, timestamp, and input snapshot
- [ ] Historical predictions vs actuals tracked to show model accuracy
- [ ] Predictions display as confidence bands on charts, not point estimates

**Tests Required:**
- [ ] Unit: `predictionModel.test.ts` — regression algorithm produces correct coefficients for known dataset
- [ ] E2E: `predictive-dashboard.spec.ts` — project with seeded history shows prediction band on budget chart

---

### P2-4: Generative UI

**Status:** 0% complete  
**Priority:** P2  
**Pages:** AICopilot, AIAgents

**Acceptance Criteria:**
- [ ] AI can generate structured UI components in response (tables, charts, form pre-fills) — not just text
- [ ] Generated components are React components streamed as JSON schema, rendered client-side
- [ ] User can "pin" a generated component to their dashboard
- [ ] Generated components respect the design system (Tailwind classes, component library)

**Tests Required:**
- [ ] Unit: `GenUIRenderer.test.tsx` — renders table component from JSON schema without XSS vulnerability
- [ ] E2E: `gen-ui.spec.ts` — ask copilot "show me overdue RFIs as a table," assert table renders with correct data

---

### P2-5: AI Agents

**Status:** 5% complete  
**Priority:** P2  
**Pages:** AIAgents

**Acceptance Criteria:**
- [ ] Agent builder UI: define trigger (webhook, schedule, event), action chain (read data → analyze → write action), and notification
- [ ] Pre-built agents: "Daily Digest" (summarize yesterday's activity, send email at 7am), "Overdue Alert" (detect overdue items, notify responsible party)
- [ ] Agent runs stored in `agent_runs` table with status, input, output, token usage, and duration
- [ ] Agents use per-user JWT, never service role key
- [ ] Agent run history viewable and re-runnable from UI

**Tests Required:**
- [ ] Unit: `AgentBuilder.test.tsx` — trigger + action chain serializes to correct schema
- [ ] E2E: `agent-run.spec.ts` — enable daily digest agent, trigger manually, assert email event logged

---

## P3 — Differentiation

Features that justify premium pricing and create switching costs.

---

### P3-1: Financial Engine (AIA Billing)

**Status:** 20% complete  
**Priority:** P3  
**Pages:** PaymentApplications, Financials

**Acceptance Criteria:**
- [ ] AIA G702/G703 pay application generated from schedule of values
- [ ] Schedule of values: line items with original value, prior billings, current billing, stored materials, total to date, % complete
- [ ] Pay app PDF matches AIA form layout exactly (verified against official AIA template)
- [ ] Pay app submitted to owner via email with digital signature
- [ ] Lien waiver (conditional and unconditional) generated alongside pay app
- [ ] Pay app status tracked through state machine: draft → submitted → certified → paid
- [ ] Retainage calculation: configurable percentage (typically 10%), released at substantial completion

**Tests Required:**
- [ ] Unit: `PayAppCalculator.test.ts` — retainage, stored materials, % complete calculations correct for known inputs
- [ ] Unit: `AIA702Generator.test.ts` — generated PDF contains correct values from schedule of values
- [ ] E2E: `pay-app.spec.ts` — create SOV, fill pay app, submit, assert status updated and PDF generated

---

### P3-2: Real-Time Collaboration

**Status:** 10% complete  
**Priority:** P3  
**Pages:** All pages

**Acceptance Criteria:**
- [ ] Presence indicators: see who is viewing the same RFI, submittal, or document in real-time
- [ ] Optimistic UI updates for all mutations (no waiting for server round-trip before UI reflects change)
- [ ] Conflict resolution: last-write-wins with visual indicator when another user edited same field
- [ ] Live activity feed on all detail pages via Supabase Realtime
- [ ] Comment threads on any record (RFI, submittal, task, budget line) with @mention notifications

**Tests Required:**
- [ ] E2E: `realtime-presence.spec.ts` — two browser sessions open same RFI, assert both see each other's presence indicator
- [ ] E2E: `optimistic-update.spec.ts` — update task title, assert UI updates before network response

---

### P3-3: Offline-First Architecture

**Status:** 15% complete  
**Priority:** P3  
**Pages:** DailyLog, FieldCapture, PunchList, Tasks, RFIs

**Acceptance Criteria:**
- [ ] All P0-5 offline sync items completed (prerequisite)
- [ ] App shell loads from service worker cache in < 1 second with no network connection
- [ ] All read operations work offline (data served from PowerSync local SQLite)
- [ ] All write operations queue offline and sync on reconnect
- [ ] Sync status indicator in app header: "Synced," "Syncing...," "Offline — N changes pending"
- [ ] PWA installable on iOS and Android via "Add to Home Screen"

**Tests Required:**
- [ ] E2E: `offline-full.spec.ts` — disable network, perform 5 CRUD operations, re-enable, assert all synced

---

### P3-4: BIM / Digital Twin Integration

**Status:** 0% complete  
**Priority:** P3  
**Pages:** Drawings, Schedule, Budget

**Acceptance Criteria:**
- [ ] IFC file upload: parse IFC 2x3 and IFC 4 format, extract element metadata
- [ ] 3D viewer: render IFC model in browser via `web-ifc-viewer` or `xeokit`
- [ ] Link schedule activities to BIM elements — select element in viewer, link to schedule task
- [ ] Cost codes linkable to BIM elements for 5D cost modeling
- [ ] Clash detection: identify elements intersecting in 3D model, output clash report

**Tests Required:**
- [ ] Unit: `ifcParser.test.ts` — IFC 4 file parses correctly, element count matches known fixture
- [ ] E2E: `bim-viewer.spec.ts` — upload IFC fixture, assert 3D viewer renders without error

---

## P4 — Ecosystem

Network effects and platform lock-in. Build after P3.

---

### P4-1: API / SDK

**Status:** 10% complete  
**Priority:** P4  
**Pages:** Developers, Integrations

**Acceptance Criteria:**
- [ ] Public REST API documented with OpenAPI 3.1 spec (auto-generated from Supabase schema)
- [ ] API keys management: create, revoke, scope to specific resources
- [ ] JavaScript SDK published to npm: `@sitesync/sdk`
- [ ] Rate limiting: 1000 requests/hour per API key; headers `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Webhook system: subscribe to events (rfi.created, submittal.approved, etc.), receive POST to configured URL
- [ ] Developer portal with live API explorer (Swagger UI)

**Tests Required:**
- [ ] Unit: `apiKeyAuth.test.ts` — invalid key returns 401, scoped key blocked from out-of-scope resource
- [ ] E2E: `api-explorer.spec.ts` — make API call from Swagger UI, assert response matches DB state

---

### P4-2: Marketplace

**Status:** 5% complete  
**Priority:** P4  
**Pages:** Marketplace

**Acceptance Criteria:**
- [ ] Marketplace lists available integrations and add-ons with icon, description, pricing, and install button
- [ ] Installing an integration stores OAuth credentials in `integration_credentials` table (encrypted at rest)
- [ ] Uninstalling removes credentials and disables sync
- [ ] Partner app submission flow: form to submit app for review
- [ ] Ratings and reviews on each integration (minimum 1 review displayed before showing rating)

**Tests Required:**
- [ ] E2E: `marketplace-install.spec.ts` — click install on an integration, complete OAuth, assert credential record created

---

### P4-3: Integrations (14 Services)

**Status:** 20% complete  
**Priority:** P4  
**Pages:** Integrations

**Acceptance Criteria:**
- [ ] **Procore**: bidirectional sync of RFIs, submittals, drawings via Procore REST API v2
- [ ] **QuickBooks Online**: sync cost codes, invoices, and vendor payments; OAuth 2.0 flow
- [ ] **Sage 300 CRE**: import subcontracts, cost codes, and accounts payable via Sage API
- [ ] **SharePoint**: sync drawing files to/from SharePoint document library
- [ ] **Microsoft Project**: import/export MPP schedule files via Graph API
- [ ] **Primavera P6**: import/export XER schedule files
- [ ] **Autodesk BIM 360**: sync model files and RFIs via APS Data Exchange
- [ ] Each integration shows last-sync timestamp, record count synced, and error log
- [ ] Integration errors surface as non-blocking UI notifications, never silent failures

**Tests Required:**
- [ ] Unit: `procoreSync.test.ts` — mock Procore API, assert RFI maps to correct SiteSync schema
- [ ] Unit: `quickbooksSync.test.ts` — mock QBO API, assert cost code import maps correctly
- [ ] E2E: `integration-procore.spec.ts` — with mocked Procore server, trigger sync, assert records created

---

### P4-4: White Label

**Status:** 0% complete  
**Priority:** P4  
**Pages:** All pages, Onboarding

**Acceptance Criteria:**
- [ ] Theme configuration stored in `organizations` table: primary color, logo URL, favicon URL, custom domain
- [ ] CSS variables overridden at runtime from org theme without rebuild
- [ ] Custom domain support: `pm.contractor.com` routes to correct org
- [ ] White-label email templates: all transactional emails use org logo and colors
- [ ] "Powered by SiteSync" attribution: configurable on/off per org tier

**Tests Required:**
- [ ] Unit: `ThemeProvider.test.tsx` — CSS variables updated when org theme changes
- [ ] E2E: `white-label.spec.ts` — set custom logo, assert logo renders on all pages

---

### P4-5: FedRAMP / Compliance

**Status:** 0% complete  
**Priority:** P4  
**Pages:** All pages, AuditTrail

**Acceptance Criteria:**
- [ ] Audit trail: every data mutation (insert, update, delete) logged to `audit_log` table with user_id, timestamp, table_name, record_id, old_value (JSON), new_value (JSON)
- [ ] Data residency: option to select US-only Supabase region for federal projects
- [ ] FIPS 140-2 compliant encryption at rest (verify Supabase region compliance)
- [ ] Session timeout: configurable per org (default 8 hours); inactivity timeout after 30 minutes
- [ ] MFA enforced for all users on FedRAMP orgs
- [ ] SOC 2 Type II audit log exported on demand as signed JSON Lines file

**Tests Required:**
- [ ] Unit: `auditLog.test.ts` — every DB mutation triggers audit log insert via Postgres trigger
- [ ] E2E: `audit-trail.spec.ts` — perform 10 operations, assert 10 audit log entries with correct before/after values

---

## Remaining Pages — Acceptance Criteria

---

### Crews

**Status:** 25% complete  
**Priority:** P1  
**Pages:** Crews, Workforce

**Acceptance Criteria:**
- [ ] Crew roster stored in `crews` and `crew_members` tables linked to project
- [ ] Crew member record: name, trade, certification(s), contact info, company, rate
- [ ] Certifications tracked with expiration dates; alert when certification expires within 30 days
- [ ] Crew assignment to daily log entries via foreign key
- [ ] Workforce page: aggregate labor hours by trade, week, and cost code

**Tests Required:**
- [ ] Unit: `CrewForm.test.tsx` — certification expiry alert appears when expiry < 30 days from today
- [ ] E2E: `crew-daily-log.spec.ts` — create crew, add to daily log, assert crew member count in log entry

**Formal Properties:**
- PROP-100: Certification expiry alerts fire exactly 30, 14, and 7 days before expiration
- PROP-101: Daily headcount total equals sum of all crew members marked present
- PROP-102: No crew member appears on two active crews simultaneously

---

### Directory

**Status:** 30% complete  
**Priority:** P1  
**Pages:** Directory

**Acceptance Criteria:**
- [ ] Directory lists all project contacts: GC, owner, architect, engineer, subcontractors, vendors
- [ ] Contact card: name, company, role, email, phone, address, license number
- [ ] Contact linked to project via `project_contacts` join table
- [ ] Invite contact to project: sends email with magic link to join
- [ ] CSV import of contacts from Procore or generic format

**Tests Required:**
- [ ] E2E: `directory-invite.spec.ts` — invite contact, assert email event logged, assert user can accept invite

**Formal Properties:**
- PROP-110: Subcontractor role users see only their own company contacts
- PROP-111: Search results always respect current user RLS policies
- PROP-112: Directory export excludes contacts the user cannot view

---

### Meetings

**Status:** 20% complete  
**Priority:** P1  
**Pages:** Meetings

**Acceptance Criteria:**
- [ ] Meeting record: title, date, time, location, type (OAC, subcontractor, safety), attendees, agenda items
- [ ] Meeting minutes editor: structured agenda items with discussion notes, action items, and responsible party
- [ ] Action items from meetings auto-create Tasks with meeting linked as source
- [ ] Meeting minutes distributed via email (PDF attachment) to all attendees on publish
- [ ] Minutes locked after distribution (require admin to edit)

**Tests Required:**
- [ ] Unit: `MeetingMinutes.test.tsx` — publish action creates tasks for each action item with correct assignee
- [ ] E2E: `meeting-minutes.spec.ts` — create meeting, add action items, publish, assert tasks created

**Formal Properties:**
- PROP-120: Action items extracted from minutes always have an assignee and due date
- PROP-121: Meeting minutes are immutable after distribution
- PROP-122: Follow up status transitions: Open > In Progress > Complete

---

### Files

**Status:** 35% complete  
**Priority:** P1  
**Pages:** Files

**Acceptance Criteria:**
- [ ] File manager with folder hierarchy stored in `folders` table
- [ ] Upload any file type to Supabase Storage; virus scan via Edge Function on upload
- [ ] Version history: upload new version preserves old; version switcher
- [ ] File sharing: generate expiring signed URL (configurable 1hr–30 days)
- [ ] Full-text search across file names and folder names

**Tests Required:**
- [ ] Unit: `FileUpload.test.tsx` — upload triggers virus scan Edge Function, blocks file if scan returns positive
- [ ] E2E: `file-sharing.spec.ts` — generate signed URL, access file via URL, assert URL expires after configured time

**Formal Properties:**
- PROP-130: File version numbers are monotonically increasing per document
- PROP-131: Deleting a version never removes the latest version
- PROP-132: Permission based access respects RBAC roles at download time, not upload time
- PROP-133: Bulk download total size is validated before initiating

---

### Safety

**Status:** 15% complete  
**Priority:** P1  
**Pages:** Safety

**Acceptance Criteria:**
- [ ] Safety observations stored in `safety_observations` table: type, severity, location, description, photo, reporter
- [ ] Toolbox talk log: record topic, date, attendees, acknowledgment signatures
- [ ] OSHA 300 log: recordable incidents tracked with required OSHA fields
- [ ] Near-miss reporting: anonymous submission option
- [ ] Safety metrics dashboard: incident rate, near-miss rate, observations by type

**Tests Required:**
- [ ] Unit: `OSHA300Calculator.test.ts` — DART rate calculated correctly from recordable incidents and hours worked
- [ ] E2E: `safety-observation.spec.ts` — submit observation with photo, assert record created with correct severity

**Formal Properties:**
- PROP-160: Incident reports are immutable after submission (append only corrections)
- PROP-161: OSHA compliance status updates within 24 hours of incident creation
- PROP-162: Toolbox talk attendance requires at least one attendee signature
- PROP-163: Near miss reports are always anonymous unless reporter opts in

---

### Change Orders

**Status:** 25% complete  
**Priority:** P1  
**Pages:** ChangeOrders

**Acceptance Criteria:**
- [ ] Change order workflow: PCO (Potential Change Order) → COR (Change Order Request) → CO (Change Order)
- [ ] PCO created from RFI, drawing markup, or direct entry
- [ ] Cost breakdown by labor, material, equipment, subcontract, overhead, profit
- [ ] Owner approval: CO sent via email with PDF; owner approves via signed link
- [ ] Approved CO automatically updates Budget revised amount for affected cost codes

**Tests Required:**
- [ ] Unit: `ChangeOrderForm.test.tsx` — cost breakdown totals calculate correctly
- [ ] E2E: `co-approval.spec.ts` — create CO, submit for approval, approve via link, assert budget updated

---

### Estimating

**Status:** 10% complete  
**Priority:** P2  
**Pages:** Estimating

**Acceptance Criteria:**
- [ ] Estimate builder: line items with description, quantity, unit, unit cost, total
- [ ] Material cost library: saved unit costs by material type, updated manually or via supplier API
- [ ] Estimate can be converted to project budget with one click
- [ ] Historical cost data: import actuals from past projects to calibrate estimates
- [ ] Bid package generation: export estimate sections as subcontractor bid packages

**Tests Required:**
- [ ] Unit: `EstimateCalculator.test.ts` — line item totals, markup, and tax calculations correct
- [ ] E2E: `estimate-to-budget.spec.ts` — complete estimate, convert to budget, assert cost codes created

---

### Procurement

**Status:** 10% complete  
**Priority:** P2  
**Pages:** Procurement

**Acceptance Criteria:**
- [ ] Purchase order creation: vendor, line items, delivery date, shipping address
- [ ] PO approval workflow: configurable dollar threshold triggers approval requirement
- [ ] PO linked to cost codes in Budget
- [ ] Vendor invoice matching: match received invoice to PO, flag discrepancies
- [ ] Committed cost tracking: open POs count as committed costs in Budget

**Tests Required:**
- [ ] Unit: `POApproval.test.ts` — PO above threshold routes to approver, below threshold auto-approves
- [ ] E2E: `po-invoice-match.spec.ts` — create PO, create matching invoice, assert amounts reconcile

---

### Permits

**Status:** 10% complete  
**Priority:** P2  
**Pages:** Permits

**Acceptance Criteria:**
- [ ] Permit register: type, jurisdiction, permit number, issue date, expiration, status, inspector contact
- [ ] Permit expiration alerts: notification 30 days before expiration
- [ ] Inspection scheduling: log inspection date, inspector name, result (pass/fail/conditional)
- [ ] Required inspections checklist by jurisdiction (manually configured)
- [ ] Permit document storage in Supabase Storage

**Tests Required:**
- [ ] Unit: `PermitAlerts.test.ts` — expiration alert fires at 30-day mark
- [ ] E2E: `permit-inspection.spec.ts` — log inspection, record pass result, assert status updated

---

### Insurance

**Status:** 5% complete  
**Priority:** P2  
**Pages:** Insurance

**Acceptance Criteria:**
- [ ] Insurance certificate register: subcontractor, policy type (GL, WC, Auto, Umbrella), carrier, policy number, limits, expiration
- [ ] Compliance check: flag subcontractors with expired or insufficient coverage
- [ ] Certificate upload: PDF stored in Supabase Storage
- [ ] Expiration alerts: notification 60 days before expiration to subcontractor and GC PM
- [ ] Subcontractor compliance dashboard: % of subs with compliant certificates

**Tests Required:**
- [ ] Unit: `InsuranceCompliance.test.ts` — limit check flags insufficient coverage against project requirements
- [ ] E2E: `insurance-upload.spec.ts` — upload certificate, assert expiry date parsed and stored

---

### Sustainability

**Status:** 5% complete  
**Priority:** P3  
**Pages:** Sustainability

**Acceptance Criteria:**
- [ ] LEED credit tracker: credits by category (SS, WE, EA, MR, IEQ, IN), status, documentation status
- [ ] Material waste tracking: waste by material type, diversion rate calculated
- [ ] Carbon emissions tracker: embodied carbon from material quantities (ICE database)
- [ ] LEED documentation export: formatted for GBCI submission

**Tests Required:**
- [ ] Unit: `LEEDScoreCalculator.test.ts` — credit points sum correctly by category
- [ ] E2E: `sustainability-leed.spec.ts` — add LEED credits, assert score updates

---

### Warranties

**Status:** 5% complete  
**Priority:** P3  
**Pages:** Warranties

**Acceptance Criteria:**
- [ ] Warranty register: product/system, subcontractor/vendor, warranty period, start date, expiration
- [ ] Warranty claim creation: description, date, photos, responsible party
- [ ] Warranty expiration alerts: 90-day notification before expiration
- [ ] Closeout package: all warranties exported as PDF package for owner

**Tests Required:**
- [ ] E2E: `warranty-closeout.spec.ts` — add warranties, generate closeout package PDF, assert all warranties included

---

### Reports

**Status:** 15% complete  
**Priority:** P1  
**Pages:** Reports

**Acceptance Criteria:**
- [ ] Standard reports: Daily Log Summary, RFI Log, Submittal Log, Budget Summary, Schedule Status
- [ ] Custom report builder: select fields, group by, filter, sort from any table
- [ ] Reports export to PDF and Excel
- [ ] Scheduled reports: configurable email delivery (daily, weekly, monthly)
- [ ] Report templates shareable across projects

**Tests Required:**
- [ ] Unit: `ReportBuilder.test.ts` — custom query builder generates correct SQL from UI configuration
- [ ] E2E: `report-export.spec.ts` — generate RFI log report, export to PDF, assert PDF contains correct data

---

### Portfolio

**Status:** 20% complete  
**Priority:** P1  
**Pages:** Portfolio

**Acceptance Criteria:**
- [ ] Portfolio view: all projects with status, health score, budget variance, schedule variance
- [ ] Filter by project status (active, closeout, archived), type, region, client
- [ ] Portfolio-level analytics: aggregate spend, aggregate schedule performance, risk heat map
- [ ] Project creation wizard: name, address, type, start date, budget, team assignment

**Tests Required:**
- [ ] E2E: `portfolio.spec.ts` — create project via wizard, assert project appears in portfolio list with correct metadata

---

### Owner Portal

**Status:** 15% complete  
**Priority:** P1  
**Pages:** OwnerPortal

**Acceptance Criteria:**
- [ ] Owner receives read-only view: Dashboard, Reports, Schedule, Budget, RFI log, Submittal log, Photos
- [ ] Owner can approve Change Orders and Pay Applications (actions behind `PermissionGate permission="owner:approve"`)
- [ ] Owner portal accessible via separate URL (`owner.sitesync.io`) or project invite link
- [ ] No GC-internal data visible (markups, internal notes, cost-loaded schedule)
- [ ] Owner can download any document shared with them

**Tests Required:**
- [ ] E2E: `owner-portal.spec.ts` — login as owner, assert edit buttons absent, assert approve CO button present
- [ ] E2E: `owner-portal-isolation.spec.ts` — assert owner cannot access internal cost notes via direct API call

---

### AuditTrail

**Status:** 20% complete  
**Priority:** P3  
**Pages:** AuditTrail, Activity

**Acceptance Criteria:**
- [ ] Every data mutation logged via Postgres triggers to `audit_log` table
- [ ] Audit log UI: searchable by user, action type, table, date range
- [ ] Export audit log as signed JSON Lines file for compliance
- [ ] Activity feed (simpler view): chronological events for a specific record

**Tests Required:**
- [ ] Unit: `auditTrigger.test.sql` — trigger fires on INSERT/UPDATE/DELETE for key tables
- [ ] E2E: `audit-trail.spec.ts` — perform mutation, assert audit log entry matches

---

### Onboarding

**Status:** 30% complete  
**Priority:** P1  
**Pages:** Onboarding

**Acceptance Criteria:**
- [ ] Onboarding wizard: 5-step flow — Create Project, Invite Team, Import Drawings, Set up Budget, Go
- [ ] Each step validates completion before advancing
- [ ] Progress persists across sessions (stored in `onboarding_state` table)
- [ ] Skip option on each step with reminder to complete later
- [ ] Completion triggers welcome email and first AI Copilot message

**Tests Required:**
- [ ] E2E: `onboarding.spec.ts` — complete all 5 steps, assert project created with team, drawings, and budget

---

### Benchmarks

**Status:** 5% complete  
**Priority:** P3  
**Pages:** Benchmarks

**Acceptance Criteria:**
- [ ] Industry benchmarks database: cost per SF by building type and region (RSMeans data)
- [ ] Compare project budget to benchmarks: variance displayed as % above/below
- [ ] Schedule benchmarks: typical duration by project type and size
- [ ] Benchmark data refreshed quarterly

**Tests Required:**
- [ ] Unit: `BenchmarkComparison.test.ts` — variance calculation correct for known benchmark and project values

---

### TimeMachine

**Status:** 5% complete  
**Priority:** P3  
**Pages:** TimeMachine

**Acceptance Criteria:**
- [ ] Point-in-time restore: view any record's state at any past timestamp using audit log
- [ ] Diff view: side-by-side comparison of record at two timestamps
- [ ] Project snapshot: download complete project state as JSON at any past date

**Tests Required:**
- [ ] Unit: `timeMachine.test.ts` — reconstructing record state from audit log produces correct result for known audit sequence

---

## Implementation Order

AI agents MUST follow this order. Do not start a lower priority until all items in the higher priority are complete.

```
Phase 1 (now):     P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6
Phase 2 (next):    P1-1 → P1-2 → P1-3 → P1-4 → P1-5 → P1-6 → P1-7 → P1-8 → P1-9 → P1-10
Phase 3:           P2-1 → P2-2 → P2-3 → P2-4 → P2-5
Phase 4:           P3-1 → P3-2 → P3-3 → P3-4
Phase 5:           P4-1 → P4-2 → P4-3 → P4-4 → P4-5
```

---

## Genome Update Protocol

When an AI agent completes a checkbox:

1. Check the box: `- [ ]` → `- [x]`
2. Update the **Status** percentage on the parent feature
3. Update the **Current Status** column in the Quality Gates table if a gate now passes
4. If a full feature is complete, add `<!-- COMPLETED: YYYY-MM-DD -->` after the feature heading
5. Do NOT remove acceptance criteria — the history of what was built is part of the genome
6. Commit with message: `genome: mark [Feature Name] criterion complete`

---

*This document is the product genome. It is read before every build. It is updated after every verified completion. It is never deleted — only evolved.*
