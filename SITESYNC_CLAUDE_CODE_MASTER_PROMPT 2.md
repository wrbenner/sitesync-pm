# SiteSync AI — The Definitive Claude Code Build Prompt

## Comprehensive Audit-Driven Execution Plan to Ship a Billion-Dollar Construction PM Platform

**Generated from:** Deep codebase audit of 211 TypeScript files, 27 DB migrations, 9 edge functions, 37 pages, 86 components, 15 test files, and the full SITESYNC_MASTER_PROMPTS.md document.

**Current Reality:** ~45K LOC. The foundation is solid (real Supabase backend, typed schema, working auth, React Query data layer). But the middle is half-baked and the polish is missing entirely. Most pages are UI shells with hardcoded mock data layered on top of real queries. AI features are stubbed. Testing is at ~5%. Offline sync is scaffolded but not wired. No approval workflows actually work. The gap between the vision document and reality is roughly 60%.

**What This Prompt Does:** This is a single, copy-pasteable Claude Code prompt that transforms the codebase from its current state into a production-grade, AI-native, field-ready, enterprise-scalable platform. It is organized by priority tiers so the most impactful work ships first.

---

## SYSTEM CONTEXT — Paste This Before Every Session

```
You are the founding CTO of SiteSync AI, building the category-defining construction project management platform. You are operating on a codebase with the following architecture:

STACK: React 19 + TypeScript 5.9 + Vite 8 + Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) + TanStack React Query 5 + Zustand 5 + XState 5 + Framer Motion 12 + Radix UI + Capacitor 8

KEY DIRECTORIES:
- src/pages/ — 37 page components (lazy-loaded via React Router 7 HashRouter)
- src/components/ — 86 components across 13 subdirectories + top-level shared components
- src/api/ — Supabase API client wrapper + endpoint files
- src/hooks/ — React hooks including queries/, mutations/ subdirectories
- src/stores/ — 5 Zustand stores (project, ui, user, notification, aiAnnotation)
- src/machines/ — XState state machines for RFI, submittal, task, daily log workflows
- src/lib/ — Core libraries (supabase, queryClient, offlineDb, realtime, search, sentry, analytics, storage, i18n, liveblocks, projectAnalytics)
- src/types/ — database.ts (auto-generated, 6253 lines), entities.ts (canonical frontend types)
- src/styles/ — theme.ts (design tokens + layout constants) and tokens.ts (extended token system)
- supabase/migrations/ — 27 migration files defining 100+ tables with RLS policies
- supabase/functions/ — 9 edge function directories

CRITICAL DESIGN RULES:
1. NEVER use hardcoded/mock data in production code paths. If a feature needs demo data, put it behind an explicit isDemoMode flag.
2. ALL entity types come from src/types/entities.ts which derives from src/types/database.ts. Never define ad-hoc interfaces for DB entities.
3. ALL data fetching uses TanStack React Query hooks in src/hooks/queries/. ALL mutations use hooks in src/hooks/mutations/. Pages never call Supabase directly.
4. Colors, spacing, typography come from src/styles/theme.ts. Never use raw hex values or magic numbers in components.
5. State machines in src/machines/ govern workflow transitions. UI components read machine state, they don't manage workflow logic.
6. Every Supabase query includes error handling that surfaces user-friendly messages via sonner toast.
7. Every page handles loading (skeleton), error (message + retry), and empty (illustration + CTA) states.
8. Every form validates inputs before submission and shows field-level errors.
9. Every list supports search, filter, and sort as appropriate.
10. Mobile-responsive by default. Touch targets minimum 44px for field use with gloves.
```

---

# TIER 1: KILL THE MOCK DATA — Nothing Else Matters Until This Is Real

**Why First:** 8 pages mix real Supabase data with hardcoded arrays bolted on. This creates a false sense of completeness and makes every downstream feature unreliable. A billion-dollar platform cannot have `const extraRFIs = [{ id: 'rfi-11', ...}]` anywhere in production code.

---

## PROMPT T1.1 — Purge All Hardcoded Mock Data From Pages

```
OBJECTIVE: Find and eliminate every instance of hardcoded/mock data in page components. Replace with real Supabase queries or remove entirely.

AUDIT FINDINGS — These pages have hardcoded data that must be removed:

1. src/pages/RFIs.tsx — Lines 32-43 contain 10 hardcoded RFIs appended to real query results. Mock timeline data for RFI detail views.
2. src/pages/Submittals.tsx — Lines 57-70 contain 12 hardcoded submittals. Mock description data and review timelines.
3. src/pages/PunchList.tsx — Lines 136-152 contain 16 hardcoded punch items. Lines 74-96 contain mock comments.
4. src/pages/Budget.tsx — Lines 69-74 contain hardcoded change orders (CO-004, CO-005). Fixed contingency calculations.
5. src/pages/Drawings.tsx — Hardcoded extra drawings and mock AI change annotations.
6. src/pages/Crews.tsx — Hardcoded crew colors, positions, foremen, certifications, task assignments, and map positions.
7. src/pages/Lookahead.tsx — Entirely local state with hardcoded crews and tasks (lines 26-41). No backend integration.
8. src/pages/Onboarding.tsx — Form submission not implemented. Steps are demo-only with confetti animation but no persistence.

FOR EACH PAGE:
1. Search for array literals, object literals, and string constants that represent entity data
2. If the data should come from the database: create or update the corresponding query hook in src/hooks/queries/ to fetch it. Create the Supabase query in src/api/endpoints/ if it doesn't exist.
3. If the data represents a feature not yet in the schema: create a migration in supabase/migrations/ to add the required columns/tables, then wire the query.
4. If the data is for demo/onboarding purposes only: move it to src/data/demo.ts behind an explicit isDemoMode check.
5. Ensure the page works correctly with zero data (empty state), one item, and many items.

SPECIFIC FIXES:
- Lookahead.tsx: Wire to schedule_phases + tasks tables. Add drag-to-reschedule mutation. Add constraint tracking query.
- Onboarding.tsx: Wire form submission to create a project, add team members, set preferences. Persist wizard progress so users can resume.
- Crews.tsx: Map positions should come from geolocation data or a project_locations table. Certifications from a crew_certifications table.
- All pages: Remove the pattern of `const allItems = [...realData, ...hardcodedData]` — this is the primary anti-pattern to eliminate.

VALIDATION: After changes, every page must render correctly with:
- An empty project (no data yet)
- The demo project (seeded via supabase/seed.sql)
- A project with 100+ items per entity (test pagination/virtualization)
```

---

## PROMPT T1.2 — Purge All Mock Data From Components

```
OBJECTIVE: Find and eliminate every instance of hardcoded/mock data in component files.

AUDIT FINDINGS — These components have mock data:

1. src/components/dashboard/ — Weather widget uses hardcoded weather data. Activity feed uses mock items.
2. src/components/ai/ — AI responses are mocked in copilot. AIContextPanel uses hardcoded suggestions.
3. src/components/drawings/ — Drawing viewer has mock annotations and markup data.
4. src/components/field/ — OCR transcription results are mocked.
5. src/components/schedule/ — GanttChart and ScheduleSimulator use local mock phases.
6. src/components/shared/CommandPalette.tsx — Search results may use hardcoded items.
7. src/components/export/ — Report templates contain hardcoded example data.
8. src/components/forms/ — Form defaults and validation may reference mock entities.

FOR EACH COMPONENT:
1. Find all hardcoded arrays, objects, and string constants that represent real data
2. Replace with props passed from the parent page (which gets data from React Query hooks)
3. If the component fetches its own data: use a proper useQuery hook, not inline fetch calls
4. Ensure the component renders a proper empty/loading/error state

CRITICAL: Components should be pure presentation. They receive data via props or context, not by constructing mock datasets internally.
```

---

# TIER 2: MAKE THE CORE WORKFLOWS ACTUALLY WORK

**Why Second:** A construction PM platform is only as good as its workflows. RFIs, submittals, tasks, daily logs, and change orders are the bread and butter. Right now the state machines exist but the full lifecycle (create → review → approve → close → audit trail) doesn't actually work end-to-end.

---

## PROMPT T2.1 — RFI Workflow: End-to-End Production Grade

```
OBJECTIVE: Make the RFI module the best RFI workflow in any construction PM tool.

CURRENT STATE: RFI page exists with table/kanban views. rfiMachine.ts state machine exists. Basic CRUD works. Missing: threading, response chain, numbering, PDF export, watchers, ball-in-court tracking, due date escalation.

REQUIREMENTS:

1. RFI NUMBERING: Auto-generate sequential numbers per project (RFI-001, RFI-002...). Store in `number` column. Never allow manual number entry. Never allow gaps.

2. RESPONSE THREADING:
   - rfi_responses table exists in schema. Wire it up.
   - Each response has: author, timestamp, body (rich text via TipTap), attachments
   - Responses are displayed in chronological order in the RFI detail panel
   - "Official Response" is flagged and triggers status change to "answered"
   - Anyone on the distribution list can add a response
   - The response that transitions the RFI to "answered" must be from the assigned_to user

3. BALL-IN-COURT TRACKING:
   - Track who currently needs to act on this RFI
   - Auto-update when status changes: Draft (creator) → Open (assigned_to) → Under Review (reviewer) → Answered (creator to verify) → Closed
   - Show "Ball in Court: [Name]" prominently on every RFI card/row
   - Filter by "My Ball" to see everything the current user needs to act on

4. DUE DATE & ESCALATION:
   - Default due date: 7 calendar days from creation (configurable per project)
   - Visual urgency: green (>3 days), yellow (1-3 days), red (overdue)
   - Overdue RFIs trigger notification to the RFI manager and project admin
   - Add "days open" and "days overdue" calculated fields

5. DISTRIBUTION LIST:
   - rfi_watchers table exists. Wire it up.
   - Users on the distribution list receive notifications on every response
   - Auto-add: creator, assigned_to, project admin
   - Manual add: any project member via @mention or explicit add

6. STATUS TRANSITIONS (enforce via rfiMachine.ts):
   - draft → open (when submitted)
   - open → under_review (when assigned user starts review)
   - under_review → answered (when official response posted)
   - answered → closed (when creator accepts answer)
   - answered → open (when creator rejects answer — "reopen")
   - Any status → void (admin only, with reason required)
   - Log every transition in activity_feed with actor, timestamp, from_status, to_status

7. RFI DETAIL PANEL:
   - Full detail view in a side panel (not a new page)
   - Shows: number, title, status badge, priority, ball-in-court, due date, spec section, drawing reference
   - Response thread below
   - Action buttons based on current state and user role
   - Linked items: related tasks, submittals, change orders
   - Attachment list with inline preview for images/PDFs

8. PDF EXPORT:
   - Single RFI export: official format with header, body, all responses, signatures placeholder
   - RFI Log export: table of all RFIs with status, dates, days open
   - Use @react-pdf/renderer (already installed)

9. KANBAN VIEW IMPROVEMENTS:
   - Drag between columns triggers status transition (with confirmation for backward moves)
   - Card shows: number, title, ball-in-court avatar, due date indicator, priority dot
   - Column counts in header
   - "My Ball" filter toggle at top

10. TABLE VIEW IMPROVEMENTS:
    - Columns: Number, Title, Status, Priority, Ball in Court, Assigned To, Due Date, Days Open, Spec Section
    - Sortable on all columns
    - Bulk actions: assign, change priority, export selected
    - Inline status change via dropdown

DO NOT touch other modules. Only modify files related to RFIs.
```

---

## PROMPT T2.2 — Submittal Workflow: Approval Chain That Actually Works

```
OBJECTIVE: Build a production-grade submittal approval workflow with multi-level review chain visualization.

CURRENT STATE: Submittal page exists with table/kanban views. submittalMachine.ts exists. Basic CRUD works. Missing: approval chain visualization, revision tracking, spec section linking, lead time tracking, substitution requests.

REQUIREMENTS:

1. APPROVAL CHAIN:
   - submittals table has reviewer columns. submittal_approvals table exists.
   - Define the approval chain per submittal: Subcontractor → GC PM → Architect → Engineer (configurable)
   - Visual chain: horizontal stepper showing each reviewer, their status (pending/approved/rejected/revise), and timestamp
   - When one reviewer approves, the ball moves to the next in chain
   - If any reviewer rejects or requests revision, the submittal goes back to submitter
   - Parallel review option: send to architect AND engineer simultaneously

2. REVISION TRACKING:
   - When a submittal is resubmitted after revision, increment revision number (Rev 0, Rev 1, Rev 2...)
   - Keep full history of all revisions with diff indicators
   - Show "Revision X of Y" on submittal cards
   - Each revision is a new row in submittal_approvals with the revision number

3. SPEC SECTION LINKING:
   - Every submittal must be tagged with a CSI spec section (Division 03 - Concrete, etc.)
   - Add a spec_section dropdown with standard CSI MasterFormat divisions
   - Filter submittals by spec section
   - Group submittals by spec section in the register view

4. LEAD TIME TRACKING:
   - Track required_on_site_date and manufacturing_lead_time
   - Auto-calculate: latest_submit_date = required_on_site_date - manufacturing_lead_time - review_time
   - Show "Submit By" warning when approaching latest_submit_date
   - Visual: green/yellow/red based on time remaining

5. SUBMITTAL REGISTER VIEW:
   - Add a third view mode: Register (traditional construction submittal log format)
   - Columns: Number, Rev, Spec Section, Description, Subcontractor, Status, Submit Date, Approval Date, Required Date
   - This is the view that gets printed and sent to the architect's office

6. STATUS TRANSITIONS (enforce via submittalMachine.ts):
   - draft → submitted (submitter sends for review)
   - submitted → under_review (first reviewer opens it)
   - under_review → approved (all reviewers approve)
   - under_review → rejected (any reviewer rejects)
   - under_review → revise_resubmit (any reviewer requests changes)
   - rejected/revise_resubmit → draft (submitter starts revision)
   - approved → closed (PM confirms receipt of approved materials)
   - Log every transition in activity_feed

7. NOTIFICATIONS:
   - Notify next reviewer when ball passes to them
   - Notify submitter on any status change
   - Notify PM when submittal is overdue
   - Weekly digest of pending submittals per reviewer
```

---

## PROMPT T2.3 — Task Engine: Dependencies, Critical Path, and Real Project Management

```
OBJECTIVE: Transform the task module from a simple kanban board into a real construction project management engine.

CURRENT STATE: Task page has kanban/list views with drag-and-drop. taskMachine.ts exists. No dependencies. No critical path. No Gantt integration. No predecessor/successor relationships.

REQUIREMENTS:

1. TASK DEPENDENCIES:
   - Add predecessor/successor fields to tasks table (if not present, create migration)
   - Dependency types: Finish-to-Start (FS), Start-to-Start (SS), Finish-to-Finish (FF), Start-to-Finish (SF)
   - UI: In task detail, add "Dependencies" section with ability to link other tasks
   - When moving a task's dates, warn if it would violate dependency constraints
   - When completing a task, auto-notify the owner of successor tasks

2. CRITICAL PATH CALCULATION:
   - Calculate critical path from task dependencies and durations
   - Highlight critical path tasks in the list/kanban view (red left border)
   - Show "Critical Path" filter toggle
   - Display float/slack for non-critical tasks
   - When a critical path task slips, propagate delay to successors and warn PM

3. GANTT INTEGRATION:
   - The Schedule page (src/pages/Schedule.tsx) has a Gantt chart using wx-react-gantt
   - Wire tasks into the Gantt view showing dependencies as arrows
   - Drag to resize (change duration) or move (change dates) on the Gantt
   - Mutations should update the task in the database on drag-end
   - Maintain the "What If Mode" that already exists but wire it to real data

4. TASK TEMPLATES:
   - Create task templates for common construction activities
   - Template = set of tasks with relative durations and dependency relationships
   - "Apply Template" creates all tasks and links dependencies
   - Templates: Foundation, Framing, MEP Rough-In, Drywall, Painting, Finish, Punchout

5. BULK OPERATIONS:
   - Select multiple tasks → bulk assign, bulk change status, bulk change priority, bulk set dates
   - "Assign crew" bulk action for field tasks
   - Export selected tasks to PDF/Excel

6. PERCENT COMPLETE:
   - Add percent_complete field (0-100) to tasks
   - Update via slider in task detail or inline in list view
   - Auto-calculate for parent tasks based on weighted children
   - Show progress bar on task cards
```

---

## PROMPT T2.4 — Daily Log: Voice-Ready, Weather-Integrated, Approval Workflow

```
OBJECTIVE: Make the daily log the fastest way for a superintendent to document their day in the field.

CURRENT STATE: Daily log page exists with entry forms and signature pad. Basic CRUD works. Missing: weather API integration, voice-to-text, approval workflow, photo capture flow, crew hour summation.

REQUIREMENTS:

1. WEATHER AUTO-FILL:
   - On creating a new daily log, auto-fetch weather from a free API (OpenWeatherMap or similar)
   - Store: temp_high, temp_low, conditions, precipitation, wind_speed
   - Allow manual override
   - Show weather prominently at top of daily log

2. APPROVAL WORKFLOW:
   - Daily log statuses: draft → submitted → approved (or rejected with comments)
   - Only the author can submit
   - Only PM or project admin can approve/reject
   - Rejected logs go back to draft with rejection reason shown
   - Approved logs are locked (no further edits without PM override)
   - Wire through dailyLogMachine.ts

3. CREW HOURS SUMMARY:
   - Sum total worker-hours per day across all crews
   - Break down by trade/crew
   - Compare to planned hours (from schedule)
   - Show variance: actual vs planned

4. PHOTO DOCUMENTATION:
   - Integrate with Capacitor Camera plugin for mobile
   - Each daily log can have unlimited photos
   - Photos tagged with: timestamp, GPS location (Capacitor Geolocation), caption, category (progress, safety, quality, weather)
   - Thumbnail grid in the daily log view
   - Full-screen preview with swipe navigation

5. QUICK ENTRY MODE:
   - Mobile-optimized form that can be filled in <2 minutes
   - Large touch targets (44px+ for glove use)
   - Swipe to advance between sections
   - Auto-save every 10 seconds to prevent data loss
   - Sections: Weather, Workforce, Equipment, Work Performed, Safety, Visitors, Notes

6. CALENDAR NAVIGATION:
   - Calendar view showing which days have logs (green dot), which are missing (red dot)
   - Click a date to view/create that day's log
   - "Missing logs" alert for any workday without a submitted log
```

---

## PROMPT T2.5 — Change Order Pipeline: PCO → COR → CO → Payment

```
OBJECTIVE: Build a complete change management workflow that tracks changes from inception through payment.

CURRENT STATE: Budget page shows change orders with basic status. No pipeline workflow. No cost tracking through stages. No approval chain.

REQUIREMENTS:

1. CHANGE ORDER PIPELINE:
   - Potential Change Order (PCO): identified cost impact, not yet formalized
   - Change Order Request (COR): formally requested with cost breakdown, sent to owner
   - Change Order (CO): approved by owner, added to contract value
   - Each stage has its own status: draft → submitted → under_review → approved/rejected

2. COST IMPACT TRACKING:
   - Every PCO has: description, reason_code (owner change, design error, field condition, regulatory), estimated_cost, schedule_impact_days
   - As it progresses through stages, cost gets refined
   - Show running total of pending, approved, rejected change order values
   - Impact on original contract value displayed prominently

3. APPROVAL CHAIN:
   - PCO: PM creates → Superintendent reviews → PM finalizes
   - COR: PM creates → Owner representative reviews → Owner approves/rejects
   - CO: Formal document signed by both parties
   - Track approval timestamps and comments at each stage

4. BUDGET INTEGRATION:
   - Approved COs immediately update the budget (revised contract = original + approved COs)
   - Show CO impact on budget charts (waterfall chart: original → pending → revised)
   - Link COs to specific budget line items / cost codes

5. SCHEDULE IMPACT:
   - Each CO can have schedule impact (days added)
   - Approved schedule impacts update the project completion date
   - Warn when cumulative CO schedule impacts threaten milestones
```

---

# TIER 3: AI THAT ACTUALLY DOES SOMETHING

**Why Third:** The AI features are the competitive moat. But they must sit on real data (Tier 1) and real workflows (Tier 2) to be useful. AI on mock data is demo-ware.

---

## PROMPT T3.1 — AI Copilot: Tool-Calling Agent That Takes Action

```
OBJECTIVE: Transform the AI copilot from a chat UI with mocked responses into a tool-calling agent that can query, analyze, and act on real project data.

CURRENT STATE: AICopilot.tsx has a chat interface. ai-chat edge function exists and connects to Anthropic. But responses are basic text with no ability to query the database or take actions.

REQUIREMENTS:

1. TOOL DEFINITIONS:
   Create tool schemas for the AI agent to use:
   - query_rfis(filters): Search and retrieve RFIs with optional filters (status, assigned_to, overdue, spec_section)
   - query_submittals(filters): Same for submittals
   - query_tasks(filters): Same for tasks
   - query_budget(type): Get budget summary, change orders, cost breakdown
   - query_schedule(type): Get schedule phases, milestones, critical path items
   - query_daily_logs(date_range): Get daily log summaries
   - create_rfi(data): Create a new RFI
   - create_task(data): Create a new task
   - update_status(entity_type, id, new_status): Change status of any entity
   - get_project_health(): Return composite health score with dimensions
   - search_everything(query): Full-text search across all entities

2. AI EDGE FUNCTION UPGRADE (supabase/functions/ai-chat/):
   - Use Anthropic API with tool_use capability
   - System prompt includes: project context, user role, current date, available tools
   - When the AI decides to use a tool: execute the Supabase query using the service role key, return results to the AI, let it formulate the response
   - Multi-turn: maintain conversation history for context
   - Rate limit: max 50 AI calls per user per day (track in ai_usage table)

3. CONTEXT AWARENESS:
   - When the user is on the RFIs page, pre-load RFI summary into AI context
   - When viewing a specific entity, include that entity's details
   - Use useAIAnnotationStore to track what page/entity the user is looking at
   - The AI should proactively mention relevant insights ("I notice RFI-034 has been overdue for 5 days...")

4. ACTION CONFIRMATIONS:
   - When the AI wants to create/update something, show a confirmation card in the chat
   - User clicks "Confirm" or "Cancel" before the action executes
   - Show the result after execution ("Created Task T-089: Install fire dampers, assigned to Mike")

5. CHAT UI IMPROVEMENTS:
   - Streaming responses (use @ai-sdk/react useChat hook with streaming)
   - Tool call results displayed as inline cards (not raw JSON)
   - Entity references are clickable links that navigate to the detail view
   - Suggested follow-up prompts after each response
   - Conversation persistence (store in Supabase, load on return)

6. PRESET PROMPTS:
   - "What needs my attention today?" → queries overdue items, my ball-in-court, pending approvals
   - "Weekly status summary" → aggregates metrics across all modules
   - "RFI bottleneck analysis" → finds longest-open RFIs and common blockers
   - "Budget risk assessment" → analyzes pending COs, burn rate, contingency remaining
```

---

## PROMPT T3.2 — Predictive Intelligence: Alerts That Prevent Problems

```
OBJECTIVE: Build prediction algorithms that detect risks before they become problems.

REQUIREMENTS:

1. SCHEDULE RISK PREDICTION:
   - Algorithm: For each task, calculate probability of delay based on:
     - Historical duration variance for similar tasks in past projects
     - Current percent complete vs elapsed time
     - Number and status of predecessor dependencies
     - Weather forecast impact (for outdoor work)
   - Display: "Risk Score" column in task list (Low/Medium/High/Critical)
   - AI Insight: Auto-generate insight when a task's risk score changes to High/Critical

2. BUDGET BURN RATE ANALYSIS:
   - Algorithm: Track cumulative cost vs planned spend curve (S-curve)
   - Calculate: Earned Value (EV), Planned Value (PV), Actual Cost (AC)
   - Derive: CPI (Cost Performance Index), SPI (Schedule Performance Index), EAC (Estimate at Completion)
   - Display: S-curve chart on Budget page with projected final cost
   - Alert: When CPI < 0.95 or SPI < 0.90, create AI insight

3. RFI BOTTLENECK DETECTION:
   - Identify reviewers with the most overdue items
   - Calculate average response time per reviewer
   - Detect RFIs that have been "Under Review" for >2x the average
   - Generate: "Bottleneck Alert: [Reviewer] has 5 overdue RFIs. Average response time: 12 days (project average: 4 days)"

4. SUBMITTAL DEADLINE RISK:
   - For each open submittal, calculate: days until required_on_site_date
   - Factor in: remaining review steps, average review time per reviewer, manufacturing lead time
   - Alert: When a submittal is projected to miss its required date

5. AI INSIGHTS TABLE:
   - Store all insights in ai_insights table with: type, severity, title, description, entity_type, entity_id, recommended_action, created_at, dismissed_at, acted_on_at
   - Show insights panel on Dashboard
   - Users can dismiss or act on insights
   - Track which insights led to action (for improving the model)

6. WEEKLY DIGEST:
   - Auto-generate weekly project health summary
   - Include: metrics changes, new risks identified, overdue items, upcoming milestones
   - Store as a project_snapshot for TimeMachine feature
```

---

# TIER 4: MAKE IT ENTERPRISE-READY

**Why Fourth:** Enterprises won't adopt without permissions, audit trails, and real-time collaboration. These are table-stakes for construction software.

---

## PROMPT T4.1 — Permissions & Multi-Tenancy That Actually Enforce

```
OBJECTIVE: Implement the permission system end-to-end from database RLS to UI element visibility.

CURRENT STATE: organizations, project_members tables exist. usePermissions hook exists. RLS policies exist in migrations. But permissions are not consistently enforced in the UI — many pages don't check permissions before showing edit/delete buttons.

REQUIREMENTS:

1. ROLE MATRIX — Define and enforce these roles:
   - Owner: Full access to everything in the organization. Can manage billing, members, projects.
   - Admin: Full access to project. Can manage project members, settings, approvals.
   - Project Manager: Can create/edit/approve most items. Cannot manage org settings.
   - Superintendent: Can create daily logs, field captures, punch items. Can update task progress. Cannot approve budget items.
   - Subcontractor: Can view assigned items. Can respond to RFIs assigned to them. Can submit submittals. Cannot see budget or financial data.
   - Viewer: Read-only access. Can view and comment but not create or edit.

2. UI ENFORCEMENT:
   - Create a `<PermissionGate permission="rfis.create" fallback={null}>` component
   - Wrap every create/edit/delete button and form in PermissionGate
   - Hide entire navigation items if the user has no access to that module
   - Show a "Request Access" prompt instead of the page if the user lacks permission

3. API ENFORCEMENT:
   - Every mutation must check permissions before executing
   - RLS policies in Supabase provide the database-level enforcement
   - The usePermissions hook provides the UI-level check
   - Both must agree — defense in depth

4. AUDIT TRAIL:
   - Every create, update, delete, and status change writes to activity_feed
   - Activity entries include: actor_id, action, entity_type, entity_id, old_value, new_value, timestamp, ip_address
   - Activity feed is append-only (never delete audit entries)
   - Admin can view the full audit trail filtered by user, entity, date range
   - Export audit trail to CSV for compliance

5. ORGANIZATION LAYER:
   - Organization → has many Projects → has many Members with Roles
   - User can belong to multiple organizations
   - Organization settings: default permissions, branding, billing plan
   - Project creation requires org membership
```

---

## PROMPT T4.2 — Real-Time Collaboration That Feels Alive

```
OBJECTIVE: Make the platform feel alive when multiple people are using it simultaneously.

CURRENT STATE: Liveblocks is configured in src/lib/liveblocks.ts. Supabase Realtime is configured in src/lib/realtime.ts with subscriptions for 17+ tables. But the UI doesn't show presence indicators, live cursors, or instant updates.

REQUIREMENTS:

1. REALTIME DATA UPDATES:
   - When another user creates/updates/deletes an item, the current user's view updates instantly
   - Use Supabase Realtime postgres_changes for all key tables: rfis, submittals, tasks, punch_items, daily_logs, change_orders, meetings
   - On receiving a change event: invalidate the relevant React Query cache (triggering a refetch)
   - Show a subtle toast: "[Name] updated RFI-034" with a link

2. PRESENCE INDICATORS:
   - Show avatar dots on the sidebar next to pages that have active users
   - On each page, show a "Currently viewing" bar with avatars of online users
   - On entity detail panels, show "Also viewing" avatars
   - Use Liveblocks Presence or build on Supabase Realtime presence

3. LIVE EDITING CONFLICTS:
   - When two users open the same entity for editing, show a warning
   - Implement optimistic locking: include an updated_at check on save
   - If conflict detected: show a merge dialog ("Your changes vs Their changes")
   - For rich text fields (meeting notes): use Yjs CRDT for concurrent editing

4. NOTIFICATION BELL:
   - Real-time notification count badge on the notification bell icon
   - Notifications appear instantly without page refresh
   - Categories: mentions, assignments, status changes, approvals needed, overdue alerts
   - Mark as read (individual or bulk)
   - Click-through to the relevant entity
```

---

# TIER 5: MOBILE & OFFLINE — WIN THE FIELD

**Why Fifth:** Construction happens in the field, not the office. The field experience must be exceptional.

---

## PROMPT T5.1 — Offline-First Architecture That Actually Syncs

```
OBJECTIVE: Make the app fully usable without internet connectivity, with reliable sync when connection returns.

CURRENT STATE: Dexie is configured in src/lib/offlineDb.ts with tables for 7 entity types. Workbox service worker exists in src/sw.ts with background sync. But there's no sync queue UI, no conflict resolution, and only 7 of 20+ tables are cached.

REQUIREMENTS:

1. OFFLINE DATA CACHE:
   - On initial load (or manual sync), cache the following to Dexie:
     - Projects, project_members, rfis, submittals, tasks, punch_items, daily_logs, drawings, directory_contacts, schedule_phases, budget_items, crews, meetings
   - Use React Query's built-in persistence or a custom sync layer
   - Last sync timestamp displayed in the UI

2. OFFLINE MUTATIONS:
   - When offline, mutations write to a Dexie mutation queue table
   - Queue stores: entity_type, action (create/update/delete), payload, timestamp, retry_count
   - Show a "Pending sync" badge with count of queued mutations
   - When connection returns: process queue in order, handling conflicts

3. CONFLICT RESOLUTION:
   - For each queued mutation, compare the offline timestamp with the server's updated_at
   - If no conflict: apply directly
   - If conflict (someone else updated the same entity while you were offline):
     - For status changes: last-write-wins with notification
     - For text fields: show conflict resolution UI (your version vs server version)
     - For new items: always apply (no conflict possible)
   - Never silently drop a user's offline work

4. SYNC STATUS UI:
   - OfflineBanner component (already exists) shows connection status
   - Add sync progress indicator during bulk sync
   - Show item-level sync status: synced (green check), pending (yellow clock), conflict (red warning)
   - Manual "Sync Now" button for users who want to force sync

5. SERVICE WORKER:
   - Pre-cache all app shell files (HTML, JS, CSS, fonts)
   - Cache API responses with NetworkFirst strategy
   - Background sync for mutations via Workbox BackgroundSync plugin
   - Update notification when new version is available
```

---

## PROMPT T5.2 — Mobile Field Experience

```
OBJECTIVE: Make the mobile experience purpose-built for construction field workers.

CURRENT STATE: MobileLayout component exists. Capacitor plugins installed (camera, geolocation, haptics, push notifications). Pages are "responsive" but not optimized for field use.

REQUIREMENTS:

1. MOBILE NAVIGATION:
   - Bottom tab bar with 5 tabs: Home, Tasks, Capture, Logs, More
   - "More" slides up a sheet with all other modules
   - Swipe gestures: swipe right for back navigation, swipe left for actions
   - Pull-to-refresh on all list views

2. QUICK CAPTURE:
   - Floating camera button (always visible in field mode)
   - Tap: opens camera immediately (no intermediate screen)
   - After photo: tag it (category, location, related item) and it's saved
   - Voice note: press-and-hold for voice capture, auto-transcribe with Tesseract.js or Whisper API
   - QR scan: scan equipment/location QR codes to auto-tag captures

3. FIELD-OPTIMIZED FORMS:
   - Large inputs (minimum 44px height for glove use)
   - Haptic feedback on button press (Capacitor Haptics)
   - Auto-advancing multi-step forms (fill one field, auto-advance to next)
   - Voice-to-text for description fields
   - GPS auto-tagging on all field entries

4. PUSH NOTIFICATIONS:
   - Wire Capacitor Push Notifications plugin
   - Notification types: assigned to you, overdue, mentioned, approval needed
   - Deep link: tapping notification opens the relevant item
   - Badge count on app icon

5. MOBILE-SPECIFIC VIEWS:
   - Daily log: swipeable card-based entry (not a long form)
   - Punch list: map view with pins at punch item locations (using GPS coordinates)
   - Tasks: simplified card view with swipe-to-complete
   - Drawings: pinch-to-zoom viewer with markup capability
```

---

# TIER 6: DESIGN SYSTEM & POLISH

**Why Sixth:** The foundation and features must work first. Then we make it beautiful.

---

## PROMPT T6.1 — Consolidate the Design System

```
OBJECTIVE: Eliminate all design inconsistencies and create a unified, premium design system.

CURRENT STATE: Two overlapping token systems (src/styles/theme.ts and src/styles/tokens.ts). Heavy inline styles throughout. Some components use theme tokens, others use raw hex values. No CSS modules or component-scoped styles.

REQUIREMENTS:

1. SINGLE SOURCE OF TRUTH:
   - Merge tokens.ts INTO theme.ts. Keep theme.ts as the canonical file.
   - Delete tokens.ts after migration
   - Every color, spacing, font, shadow, radius, and z-index value must come from theme.ts
   - Search entire codebase for raw hex values (#xxx), raw pixel values, and replace with theme tokens

2. COMPONENT CONSISTENCY:
   - Audit all 86 components for:
     - Consistent border radius (use theme.radius)
     - Consistent spacing (use theme.spacing)
     - Consistent shadows (use theme.shadows)
     - Consistent typography (use theme.typography)
   - Fix inconsistencies found in the audit

3. DUPLICATE COMPONENT CLEANUP:
   - TopBar.tsx and TopNav.tsx overlap — merge into one Header component
   - DataTable appears in multiple forms (shared/DataTable, VirtualDataTable) — consolidate
   - Form patterns are repeated 160+ LOC per form — extract shared form primitives

4. ACCESSIBILITY (WCAG 2.1 AA):
   - Add ARIA labels to all interactive elements
   - Ensure color contrast ratio ≥ 4.5:1 for text, ≥ 3:1 for large text
   - Keyboard navigation for all interactive elements (tab order, enter/space to activate)
   - Focus visible styles on all focusable elements
   - Screen reader announcements for status changes and notifications
   - The SkipToContent and RouteAnnouncer components exist — verify they work

5. ANIMATION POLISH:
   - Consistent enter/exit transitions on all modals, panels, dropdowns
   - Skeleton loading states on every page (some exist, ensure consistency)
   - Micro-interactions: button press feedback, checkbox check animation, progress bar fill
   - Respect prefers-reduced-motion (useReducedMotion hook exists — use it)

6. DARK MODE:
   - Add dark mode variants to all theme tokens
   - Respect system preference (prefers-color-scheme)
   - Manual toggle in user settings
   - Persist preference in user profile
```

---

# TIER 7: TESTING & RELIABILITY

**Why Seventh:** Ship fast, but don't ship broken. Testing comes after the features stabilize.

---

## PROMPT T7.1 — Test Coverage: From 5% to 60%

```
OBJECTIVE: Build comprehensive test coverage for the most critical paths.

CURRENT STATE: 15 test files, ~5% coverage. Vitest + React Testing Library + Playwright installed. jest-axe for accessibility testing available. fake-indexeddb for offline testing available.

REQUIREMENTS:

1. UNIT TESTS (src/test/unit/):
   Priority order:
   a. All state machines (src/machines/): Test every state transition, guard condition, and edge case
   b. All API endpoint functions (src/api/endpoints/): Mock Supabase client, test query construction and error handling
   c. All hooks (src/hooks/): Test with renderHook, mock dependencies
   d. Utility functions (src/utils/, src/lib/): Pure function tests

2. COMPONENT TESTS (src/test/components/):
   Priority order:
   a. Form components: Test validation, submission, error display
   b. DataTable: Test sorting, filtering, pagination, empty states
   c. Permission-gated components: Test visibility based on role
   d. Workflow components: Test status badges, action buttons based on state

3. INTEGRATION TESTS (src/test/integration/):
   a. RFI lifecycle: Create → Assign → Review → Answer → Close
   b. Submittal lifecycle: Create → Submit → Review chain → Approve
   c. Task lifecycle: Create → Assign → In Progress → Complete
   d. Daily log lifecycle: Create → Submit → Approve
   e. Change order lifecycle: PCO → COR → CO → Payment
   f. Auth flow: Login → Session → Protected route → Logout

4. E2E TESTS (e2e/):
   Expand from 4 to 12 specs:
   a. Critical user journey: Login → Dashboard → Create RFI → Submit → View → Close
   b. Mobile responsive: Test all 5 mobile tab views
   c. Offline mode: Disconnect → Create items → Reconnect → Verify sync
   d. Search: Command palette → Search → Navigate to result
   e. Export: Generate RFI log PDF → Download
   f. Permissions: Login as viewer → Verify read-only enforcement
   g. Real-time: Two sessions → Create item in one → Verify appears in other
   h. Budget workflow: Create PCO → Advance through stages → Verify budget update

5. ACCESSIBILITY TESTS:
   - Run jest-axe on all page components
   - Test keyboard navigation flows
   - Test screen reader announcements

6. COVERAGE CONFIG:
   - Add coverage thresholds to vitest.config.ts:
     - Statements: 60%
     - Branches: 50%
     - Functions: 60%
     - Lines: 60%
   - Fail the build if coverage drops below thresholds
```

---

# TIER 8: REPORTING, INTEGRATIONS, & EXPANSION

**Why Last:** These are growth features. They make the platform stickier and more valuable, but only after the core is solid.

---

## PROMPT T8.1 — Reporting Engine

```
OBJECTIVE: Build a PDF/Excel report generation pipeline for construction industry standard reports.

REQUIREMENTS:

1. REPORT TYPES:
   - Executive Summary (1-2 pages): Project health, milestone status, budget summary, key risks
   - Monthly Progress Report (5-10 pages): Detailed progress by phase, financial status, schedule update, safety summary, photos
   - RFI Log: All RFIs with status, dates, response summary
   - Submittal Log: All submittals with status, review chain, dates
   - Punch List: Open items with photos, location, responsible party
   - Daily Log Summary: Aggregated crew hours, weather, incidents by date range
   - Safety Report: TRIR, incidents, inspections, corrective actions

2. GENERATION:
   - Use @react-pdf/renderer for PDF generation (already installed)
   - Use xlsx package for Excel exports (already installed)
   - Reports generated client-side for speed (no server round-trip)
   - Progress bar during generation for large reports

3. TEMPLATES:
   - Professional formatting with SiteSync branding
   - Company logo placement (from project/org settings)
   - Page numbers, headers, footers
   - Table of contents for multi-page reports
   - Charts embedded as images

4. SCHEDULING:
   - "Generate weekly report every Monday at 6am" (store schedule, trigger via edge function)
   - Email report to distribution list
   - Store generated reports in project files

5. EXPORT CENTER:
   - The ExportCenter component exists — enhance it
   - Select report type → Configure options → Preview → Generate → Download
   - Recent exports list with re-download option
```

---

## PROMPT T8.2 — Integration Framework

```
OBJECTIVE: Build a pluggable integration framework and ship the first 3 integrations.

REQUIREMENTS:

1. INTEGRATION ARCHITECTURE:
   - src/lib/integrations/ directory with a standard interface:
     - IntegrationProvider: { id, name, icon, connect(), disconnect(), sync(), getStatus() }
   - Webhook receiver edge function (already scaffolded) for incoming data
   - OAuth2 flow for authenticated integrations
   - Sync history log per integration

2. FIRST INTEGRATIONS:
   a. Procore (Import): Import projects, RFIs, submittals from Procore via their API
   b. Microsoft Project (Import/Export): Import/export schedules as .mpp or .xml
   c. QuickBooks (Sync): Sync budget items and change orders as journal entries
   d. Email (Outbound): Send RFI responses, submittal transmittals, daily log summaries via email (Resend already installed)

3. INTEGRATIONS PAGE:
   - src/pages/Integrations.tsx exists as a placeholder — make it functional
   - Show available integrations with connect/disconnect buttons
   - Connection status indicator (connected, error, syncing)
   - Last sync timestamp and item count
   - Sync now button for manual trigger
```

---

# CROSS-CUTTING CONCERNS — Apply Across All Tiers

```
ACROSS EVERY PROMPT AND EVERY FILE YOU TOUCH:

1. ERROR HANDLING:
   - Every async operation has try/catch
   - User-facing errors shown via sonner toast with actionable message
   - System errors logged to Sentry
   - Network errors trigger offline mode gracefully
   - Never show raw error objects, stack traces, or Supabase error codes to users

2. LOADING STATES:
   - Every data-dependent view shows a skeleton loader while loading
   - Never show a blank screen, empty container, or spinner without context
   - Use Suspense boundaries where appropriate

3. EMPTY STATES:
   - Every list/table/grid has a designed empty state
   - Empty state includes: illustration/icon, message, primary CTA (e.g., "Create your first RFI")
   - Empty states are not errors — they are invitations

4. SEARCH & FILTER:
   - Every list page has a search bar that filters by relevant text fields
   - Every list has filter dropdowns appropriate to the entity (status, assignee, date range, priority)
   - Filters are reflected in the URL query params for shareability
   - Clear all filters button

5. AUDIT TRAIL:
   - Every mutation writes to activity_feed
   - Activity entries reference: actor, action, entity, old_value, new_value, timestamp

6. NOTIFICATIONS:
   - Every status change, assignment, and mention triggers a notification
   - Notifications are stored in the notifications table
   - In-app notification center shows unread count
   - Email notifications for critical items (overdue, assigned to you)

7. MOBILE RESPONSIVENESS:
   - Every page must work on 375px width (iPhone SE)
   - Tables collapse to card views on mobile
   - Modals become full-screen sheets on mobile
   - Touch targets ≥ 44px

8. PERFORMANCE:
   - Lists with >50 items use virtualization (TanStack Virtual)
   - Images are lazy-loaded
   - Heavy components are lazy-loaded (React.lazy)
   - Database queries use appropriate indexes and pagination

9. TYPESCRIPT:
   - Zero `any` types in new code
   - All props interfaces defined and exported
   - All API responses typed
   - Prefer type narrowing over type assertions
```

---

# EXECUTION SEQUENCE

For maximum impact with minimum wasted work, execute in this order:

```
WEEK 1-2: T1.1 → T1.2 (Purge mock data — everything after this depends on real data)
WEEK 2-3: T2.1 → T2.2 → T2.3 (RFI, Submittal, Task workflows — the core product)
WEEK 3-4: T2.4 → T2.5 (Daily Log, Change Orders — complete the core workflows)
WEEK 4-5: T3.1 → T3.2 (AI Copilot + Predictions — the competitive moat)
WEEK 5-6: T4.1 → T4.2 (Permissions + Realtime — enterprise readiness)
WEEK 6-7: T5.1 → T5.2 (Offline + Mobile — win the field)
WEEK 7-8: T6.1 (Design system polish — make it beautiful)
WEEK 8-9: T7.1 (Testing — make it reliable)
WEEK 9-10: T8.1 → T8.2 (Reporting + Integrations — growth features)
```

Each prompt is designed to be copy-pasted directly into Claude Code. They are self-contained — you don't need to reference this document while running them. Each prompt tells Claude exactly what to fix, where to find it, and what the end state should look like.

---

# WHAT WINNING LOOKS LIKE

When all tiers are complete, SiteSync AI will be:

- **Real**: Zero mock data in production paths. Every number comes from the database.
- **Complete**: Every core construction workflow works end-to-end with proper state machines, approval chains, and audit trails.
- **Intelligent**: AI copilot can query real data, detect risks, and take actions with user confirmation.
- **Secure**: Role-based permissions enforced at DB (RLS) and UI (PermissionGate) levels. Full audit trail.
- **Collaborative**: Real-time updates, presence indicators, concurrent editing with conflict resolution.
- **Field-Ready**: Offline-first, camera-ready, GPS-tagged, glove-friendly mobile experience.
- **Beautiful**: Unified design system, consistent animations, dark mode, WCAG AA accessible.
- **Reliable**: 60%+ test coverage, comprehensive E2E tests, error boundaries, Sentry monitoring.
- **Extensible**: Integration framework, reporting engine, webhook receiver ready for third-party connections.

This is what a billion-dollar construction PM platform looks like. Now build it.
