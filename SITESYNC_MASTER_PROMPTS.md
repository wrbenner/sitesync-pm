# SiteSync AI — Master Build Prompts

## The War Plan: 42 Claude Code Prompts to Build a Billion-Dollar Construction PM Platform

**Codebase:** React 19 + TypeScript + Vite + Supabase + TanStack Query + Zustand + XState
**Current State:** ~40K LOC, 128 components, 36 pages, 11 DB migrations. Core CRUD works. AI is stubbed. Testing at ~5%. Many features are UI-only shells.
**Target State:** Production-grade, AI-native, field-ready, enterprise-scalable construction PM that dominates Procore, PlanGrid, and Autodesk Build.

---

## HOW TO USE THESE PROMPTS

Each prompt is designed to be copy-pasted directly into Claude Code. They are sequenced with dependencies noted. Run them in order within each phase. Phases can overlap where noted.

**Before each prompt session**, paste this system context:

```
You are the founding CTO of SiteSync AI, building the category-defining construction project management platform. This is a React 19 + TypeScript + Vite app with Supabase backend, TanStack React Query for server state, Zustand for UI state, XState for workflow state machines, Framer Motion for animations, and Radix UI primitives. The codebase is in the current directory. Always write production-grade code. Never use placeholder data in production paths. Follow existing patterns in the codebase. Every file you touch must be better than you found it.
```

---

# PHASE 0: FOUNDATION — Fix What's Broken Before Building Forward

*These prompts fix structural issues that would compound into debt if left unfixed.*

---

## PROMPT 0.1 — API Layer Overhaul: Kill the Mock Client

```
OBJECTIVE: Replace the mock API client (src/api/client.ts) with real Supabase calls across ALL endpoints.

CONTEXT: The current api/client.ts uses a mockFetch wrapper that returns fake data. Every file in src/api/endpoints/ needs to be rewritten to use the real Supabase client from src/lib/supabase.ts. The hooks in src/hooks/queries/index.ts and src/hooks/mutations/index.ts already use React Query but call through the mock layer.

REQUIREMENTS:
1. Rewrite src/api/client.ts to be a thin typed wrapper around supabase-js. No mock data. No fake delays. Export typed helper functions: supabaseQuery<T>, supabaseMutation<T>, supabaseRpc<T>.

2. Rewrite every file in src/api/endpoints/ to use real Supabase queries:
   - projects.ts: supabase.from('projects').select/insert/update/delete with proper RLS
   - rfis.ts: Full CRUD with response threading, status transitions, file attachments
   - submittals.ts: Full CRUD with approval chain, revision tracking
   - tasks.ts: Full CRUD with assignees, dependencies, status transitions
   - budget.ts: Budget items, change orders, earned value calculations
   - schedule.ts: Schedule phases with dependencies, progress tracking
   - activity.ts: Activity feed with polymorphic entity references
   - documents.ts: File upload/download via Supabase Storage
   - field.ts: Daily logs with entries, weather, crew counts
   - people.ts: Project members, directory, crew management
   - ai.ts: Keep the interface but wire to Supabase edge functions

3. Update src/hooks/queries/index.ts:
   - Every useQuery hook must call the real endpoint
   - Add proper queryKey factories: queryKeys.rfis.list(projectId), queryKeys.rfis.detail(id)
   - Add staleTime and gcTime appropriate for each entity type
   - Construction data that changes frequently (daily logs, activity): staleTime 30s
   - Reference data (project settings, directory): staleTime 5min
   - Static data (completed RFIs, closed submittals): staleTime 30min

4. Update src/hooks/mutations/index.ts:
   - Every mutation must call the real endpoint
   - Add optimistic updates for status changes (RFI, submittal, task, punch item)
   - Invalidate the correct query keys on success
   - Show toast notifications on success/error using sonner
   - Add proper error typing and user-friendly error messages

5. Add a src/api/queryKeys.ts factory:
   ```typescript
   export const queryKeys = {
     projects: {
       all: ['projects'] as const,
       lists: () => [...queryKeys.projects.all, 'list'] as const,
       list: (filters: ProjectFilters) => [...queryKeys.projects.lists(), filters] as const,
       details: () => [...queryKeys.projects.all, 'detail'] as const,
       detail: (id: string) => [...queryKeys.projects.details(), id] as const,
     },
     rfis: { /* same pattern */ },
     // ... for every entity
   }
   ```

6. Delete all mock data from src/data/ that was only used by the mock API. Keep any data used for UI demos/onboarding.

7. Ensure every Supabase query includes proper error handling:
   ```typescript
   const { data, error } = await supabase.from('rfis').select('*')
   if (error) throw new ApiError(error.message, error.code, error.details)
   return data
   ```

8. Add request/response type safety using the generated types from src/types/database.ts.

DO NOT change any component files in this prompt. Only touch src/api/, src/hooks/queries/, src/hooks/mutations/, and src/data/.
```

---

## PROMPT 0.2 — Type Safety & Schema Alignment

```
OBJECTIVE: Audit and fix all type mismatches between the frontend types and the actual Supabase database schema.

CONTEXT: The database types are auto-generated in src/types/database.ts (4858 lines). Many components use ad-hoc interfaces that don't match. The mutations have comments noting type mismatches.

REQUIREMENTS:
1. Run `npx supabase gen types typescript --local > src/types/database.ts` to regenerate fresh types (or verify the existing ones match the migrations in supabase/migrations/).

2. Create src/types/entities.ts that exports clean, frontend-friendly types derived from the database types:
   ```typescript
   import { Database } from './database'

   type Tables = Database['public']['Tables']

   // Base row types
   export type Project = Tables['projects']['Row']
   export type RFI = Tables['rfis']['Row']
   export type Submittal = Tables['submittals']['Row']
   // ... etc

   // Insert types (for mutations)
   export type ProjectInsert = Tables['projects']['Insert']
   export type RFIInsert = Tables['rfis']['Insert']

   // Update types (for mutations)
   export type ProjectUpdate = Tables['projects']['Update']
   export type RFIUpdate = Tables['rfis']['Update']

   // Rich types with joins (for queries)
   export type RFIWithDetails = RFI & {
     assigned_to_user: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
     responses: RFIResponse[]
     attachments: FileAttachment[]
   }
   ```

3. Find every component that defines its own inline type for database entities and replace with the canonical types from entities.ts. Search for patterns like:
   - `interface RFI {` or `type RFI = {` in component files
   - `interface Task {` or `type Task = {` in component files
   - Any ad-hoc type that duplicates database schema

4. Fix the XState machines in src/machines/ to use the canonical status enums from the database types, not hardcoded strings.

5. Ensure all form components use the Insert/Update types for their form state.

6. Add a src/types/index.ts barrel export.

7. Run `npx tsc --noEmit` and fix every type error. Zero tolerance.
```

---

## PROMPT 0.3 — Auth Flow Hardening

```
OBJECTIVE: Make authentication production-grade with proper session management, role-based access, and security.

CONTEXT: Login/Signup exist in src/pages/auth/ and src/components/auth/. There's a useAuth hook and a userStore. Supabase Auth is configured but the flow has gaps.

REQUIREMENTS:
1. Audit and fix the auth flow end-to-end:
   - Login with email/password → Supabase auth.signInWithPassword
   - Signup with email/password → Supabase auth.signUp → email confirmation
   - Password reset → Supabase auth.resetPasswordForEmail
   - Session refresh → Supabase auth.onAuthStateChange listener
   - Logout → Clear all stores, React Query cache, redirect to /login

2. Harden the ProtectedRoute component:
   - Check session validity, not just presence of a user object
   - Handle expired sessions gracefully (redirect to login with return URL)
   - Add role-based route protection: some routes require admin/owner
   - Add project-membership checks for project-scoped routes

3. Fix the userStore to properly sync with Supabase auth state:
   - On mount: check for existing session
   - On auth state change: update store
   - Store the user's role per project (from project_members table)
   - Add a loading state so the app doesn't flash login screen

4. Add proper error messages for auth failures:
   - Invalid credentials → "Email or password is incorrect"
   - Email not confirmed → "Please check your email to confirm your account"
   - Rate limited → "Too many attempts. Please try again in a few minutes"
   - Network error → "Unable to connect. Check your internet connection"

5. Add an auth middleware that attaches the Supabase auth token to any edge function calls.

6. Ensure the onboarding flow (src/pages/Onboarding.tsx) only shows for new users who haven't completed setup, then never again.

7. Add PKCE flow support for OAuth providers (Google, Microsoft) — stub the UI buttons now, wire later.
```

---

## PROMPT 0.4 — Error Handling & Resilience Layer

```
OBJECTIVE: Build a comprehensive error handling system so the app never shows a blank screen or swallows errors silently.

CONTEXT: ErrorBoundary exists but error handling is inconsistent. Many catch blocks swallow errors. Sentry is configured in src/lib/sentry.ts but not all errors reach it.

REQUIREMENTS:
1. Enhance the ErrorBoundary component (src/components/ErrorBoundary.tsx):
   - Catch render errors with a beautiful, branded fallback UI
   - Include "Try Again" and "Go to Dashboard" actions
   - Report to Sentry with full context (route, user, project)
   - Different fallback for full-page vs component-level errors

2. Create a global React Query error handler in src/lib/queryClient.ts:
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         retry: (failureCount, error) => {
           if (error instanceof ApiError && error.status === 404) return false
           if (error instanceof ApiError && error.status === 403) return false
           return failureCount < 3
         },
         throwOnError: (error) => {
           // Only throw to error boundary for fatal errors
           return error instanceof ApiError && error.status >= 500
         },
       },
       mutations: {
         onError: (error) => {
           // Global mutation error handler
           if (error instanceof ApiError) {
             toast.error(error.userMessage)
             Sentry.captureException(error)
           }
         },
       },
     },
   })
   ```

3. Create src/api/errors.ts with a typed error hierarchy:
   ```typescript
   export class ApiError extends Error {
     constructor(
       message: string,
       public status: number,
       public code: string,
       public userMessage: string,
       public details?: unknown
     ) { super(message) }
   }

   export class NetworkError extends ApiError { /* offline handling */ }
   export class AuthError extends ApiError { /* redirect to login */ }
   export class PermissionError extends ApiError { /* show access denied */ }
   export class ValidationError extends ApiError { /* show field errors */ }
   export class NotFoundError extends ApiError { /* show 404 page */ }
   ```

4. Add a Supabase error transformer that converts raw Supabase errors into typed ApiErrors with user-friendly messages.

5. Ensure every mutation shows appropriate feedback:
   - Loading: disable the submit button, show spinner
   - Success: toast with action description ("RFI #42 created")
   - Error: toast with actionable message, NOT raw error text

6. Add a NetworkStatusProvider that detects offline state and shows a persistent banner. When back online, trigger React Query refetch.

7. Wire Sentry breadcrumbs for navigation, API calls, and user actions so every error report has full context.
```

---

# PHASE 1: CORE PLATFORM — Make Every Feature Production-Grade

*These prompts take existing features from 60% to 100%.*

---

## PROMPT 1.1 — RFI Module: Best-in-Class

```
OBJECTIVE: Make the RFI module the most powerful RFI tracker in construction software.

CONTEXT: RFIs page exists (src/pages/RFIs.tsx) with list/kanban views and a create form. The RFI state machine is in src/machines/rfiMachine.ts. Basic CRUD works through the API layer (now real after Prompt 0.1).

REQUIREMENTS:
1. Enhance the RFI data model (add migration if needed):
   - Add fields: ball_in_court (user who must act next), cost_impact, schedule_impact, drawing_reference, spec_section, response_due_date, days_open (computed), overdue flag
   - Add an rfi_responses table if not exists: id, rfi_id, user_id, body (rich text), attachments (jsonb), created_at
   - Add an rfi_watchers table: rfi_id, user_id (for notification targeting)

2. Upgrade the RFI list view:
   - Add column sorting on every column
   - Add multi-filter: status, priority, assigned_to, ball_in_court, trade, overdue, date range
   - Add saved filter presets ("My Open RFIs", "Overdue", "Awaiting My Response")
   - Add bulk actions: bulk assign, bulk change status, bulk export
   - Show days open with color coding (green <7, yellow 7-14, red >14)
   - Add inline status change (click status badge → dropdown → confirm)

3. Build an RFI detail slide-over panel (not a separate page):
   - Full RFI details with edit-in-place for all fields
   - Threaded response conversation with rich text (TipTap), @mentions, file attachments
   - Status timeline showing every state change with who/when
   - Related items section: linked submittals, tasks, drawings, daily log entries
   - Activity log specific to this RFI
   - "Ball in Court" indicator prominently displayed

4. Upgrade the RFI state machine:
   - States: draft → open → under_review → answered → closed → reopened
   - Add guard conditions (only assignee can answer, only creator can close)
   - Track state transitions with timestamp and user in an audit trail
   - Auto-calculate ball_in_court based on current state

5. Add RFI numbering: auto-increment per project (RFI-001, RFI-002, etc.)

6. Add RFI PDF export: professional format matching industry standard with full response thread.

7. Add email notifications via Supabase edge function:
   - New RFI assigned → notify assignee
   - Response added → notify creator and watchers
   - Overdue → notify assignee and project admin
```

---

## PROMPT 1.2 — Submittal Module: Full Approval Workflow

```
OBJECTIVE: Build an enterprise-grade submittal tracking system with multi-level approval chains.

CONTEXT: Submittals page exists with basic CRUD. The submittal state machine is in src/machines/submittalMachine.ts. There's a submittal_approvals table for the chain.

REQUIREMENTS:
1. Enhance the submittal workflow:
   - States: draft → submitted → gc_review → architect_review → approved | rejected | revise_and_resubmit
   - Each approval level tracks: reviewer, decision, comments, stamp, date
   - Support revision cycles: when "revise and resubmit", create a new revision linked to the original
   - Track revision history: Rev 0, Rev 1, Rev 2... with diff highlighting

2. Build the submittal register view:
   - Sortable/filterable table with: number, title, spec section, status, current reviewer, lead time, required date, actual approval date, days in review
   - Color-coded status pills matching construction industry conventions
   - Gantt-style timeline bar showing submittal schedule vs actual
   - Filter by: spec division, status, reviewer, trade, overdue

3. Build submittal detail panel:
   - Full details with revision history tab
   - Approval chain visualization (step indicator showing who approved/pending)
   - Document preview for attached PDFs/drawings
   - Stamp overlay: "APPROVED", "APPROVED AS NOTED", "REJECTED", "REVISE & RESUBMIT"
   - Comments thread per revision
   - Related RFIs and drawing references

4. Add submittal scheduling:
   - Lead time tracking (required on site date → approval duration → submit by date)
   - Calendar integration showing submittal deadlines on the project schedule
   - Overdue alerts when approval takes longer than expected

5. Add spec section linking:
   - Organize submittals by CSI MasterFormat divisions
   - Bulk import from spec table of contents
   - Cross-reference between spec sections and submittals

6. Add submittal log PDF export matching AIA G810 format.
```

---

## PROMPT 1.3 — Task Engine: Dependencies, Critical Path, Gantt

```
OBJECTIVE: Build a task management engine that understands construction sequencing, dependencies, and critical path.

CONTEXT: Tasks page has kanban board and list views. Basic CRUD works. No dependency tracking yet.

REQUIREMENTS:
1. Enhance the task data model:
   - Add: predecessor_ids (array), successor_ids (array), dependency_type (FS/FF/SS/SF with lag), float (computed), is_critical_path (computed)
   - Add: estimated_hours, actual_hours, percent_complete, trade, location (building/floor/area)
   - Add: constraint_type (ASAP, must_start_on, must_finish_on, start_no_earlier_than), constraint_date

2. Build dependency management:
   - In task detail, add "Dependencies" section with add/remove predecessors and successors
   - Dependency type selector: Finish-to-Start (default), Start-to-Start, Finish-to-Finish, Start-to-Finish
   - Lag/lead time input (in days)
   - Circular dependency detection with clear error message

3. Add critical path calculation:
   - Forward pass: calculate early start/early finish for each task
   - Backward pass: calculate late start/late finish for each task
   - Float = late start - early start
   - Critical path = tasks with zero float
   - Highlight critical path tasks in red on all views

4. Enhance the Gantt chart (src/components/schedule/GanttChart.tsx):
   - Show dependency arrows between tasks
   - Critical path highlighting
   - Drag to reschedule (update dates, cascade to dependents)
   - Zoom levels: day, week, month, quarter
   - Baseline comparison (planned vs actual)
   - Progress bar overlay on each task bar
   - Milestone diamonds

5. Add task views:
   - Kanban: existing, add swimlanes by trade or location
   - List: sortable table with all fields
   - Gantt: enhanced as above
   - Calendar: tasks on a calendar view
   - Add view toggle that remembers preference per user

6. Add task templates:
   - Pre-built task sequences for common construction phases (foundation, framing, MEP rough-in, drywall, etc.)
   - One-click import of a template that creates linked tasks with dependencies
```

---

## PROMPT 1.4 — Daily Log: The Field Superintendent's Best Friend

```
OBJECTIVE: Build the daily log that superintendents actually want to use — fast to fill, impossible to forget, audit-ready.

CONTEXT: DailyLog page exists with form fields for crew, weather, notes. SignaturePad component exists. DailyLog state machine exists.

REQUIREMENTS:
1. Redesign the daily log entry flow for speed:
   - Pre-populate from yesterday's log (crew, weather station, subcontractors)
   - Weather auto-fill from GPS location using a free weather API (OpenWeatherMap)
   - Voice-to-text for notes (using browser SpeechRecognition API)
   - Quick-add buttons for common entries: "concrete pour", "inspection passed", "rain delay"
   - Photo capture with auto-GPS tagging and timestamp overlay

2. Build the daily log sections:
   - MANPOWER: Crew name, trade, headcount, hours worked. Running total at bottom.
   - WEATHER: Temp high/low, conditions, wind, precipitation. AM/PM split.
   - WORK PERFORMED: Rich text with photo inline. Organized by area/trade.
   - MATERIALS RECEIVED: Item, quantity, PO#, condition (accept/reject/partial)
   - EQUIPMENT: Equipment on site, hours used, downtime reason
   - VISITORS: Name, company, purpose, time in/out
   - SAFETY: Any incidents, near misses, toolbox talks conducted (link to Safety module)
   - DELAYS: Cause (weather, material, labor, design), duration, impact description
   - INSPECTIONS: Type, inspector, result, deficiencies noted

3. Add the daily log state machine flow:
   - draft → submitted → approved | rejected (with comments)
   - Only project admin/owner can approve
   - Rejected logs return to superintendent with reviewer comments

4. Add daily log analytics:
   - Crew productivity trends (manpower over time per trade)
   - Weather impact analysis (delays correlated with weather)
   - Day-over-day comparison (src/components/dailylog/DayComparison.tsx — make it real)
   - Auto-narrative generation: "Today's focus was structural steel on levels 3-4. 47 workers on site. No safety incidents."

5. Build the monthly summary report:
   - Aggregate all daily logs for a month
   - Total manpower hours by trade
   - Total delays by cause
   - Weather summary
   - Export as PDF matching owner-facing report standards

6. Add signature workflow:
   - Superintendent signs on submit
   - Project manager signs on approval
   - Both signatures appear on the final PDF
   - Store signatures as base64 in the database
```

---

## PROMPT 1.5 — Budget & Financial Controls

```
OBJECTIVE: Build financial tracking that gives owners and GCs real-time cost visibility with proper change order management.

CONTEXT: Budget page exists with basic line items. Change order state machine exists. S-curve, treemap, and earned value components exist but may use mock data.

REQUIREMENTS:
1. Build the Schedule of Values (SOV):
   - Line items with: code, description, scheduled_value, work_completed_previous, work_completed_this_period, materials_stored, total_completed, balance_to_finish, retainage
   - Support CSI MasterFormat cost codes
   - Automatic rollup calculations (subtotals by division, grand total)
   - Percent complete auto-calculation

2. Build Change Order management:
   - Change order workflow: draft → pending_review → approved → rejected → void
   - Each CO has: number, title, description, reason, cost items, schedule impact
   - CO cost items: add/deduct with cost code mapping
   - Running change order log with running total impact on contract
   - Potential Change Order (PCO) → Change Order Request (COR) → Change Order (CO) pipeline

3. Build the Pay Application (AIA G702/G703):
   - Generate from SOV with current period entries
   - Track application number, period dates, contract amounts
   - Calculate: original contract, net change orders, contract to date, work completed, retainage, amount due
   - PDF export matching AIA G702/G703 format exactly

4. Wire the financial dashboard components to real data:
   - S-Curve: Plot planned vs actual cost over time with forecast projection
   - Earned Value: CPI, SPI, EAC, ETC, VAC with trend indicators
   - Budget vs Actual: By cost code with variance highlighting
   - Cash Flow: Monthly forecasted vs actual expenditure
   - Contingency Burn: Track contingency usage over time

5. Add cost alerts:
   - Line item exceeds budget → yellow warning
   - Cost code trending over budget → predictive alert
   - Change order impact exceeds threshold → email notification to owner
   - Contingency below 5% → critical alert

6. Add financial permissions:
   - Viewers can see budget summaries but not detailed costs
   - Members can enter work completed
   - Admins can approve change orders
   - Owners see everything including markup/margin
```

---

## PROMPT 1.6 — Safety Module: Zero Incidents

```
OBJECTIVE: Build a safety management system that makes compliance effortless and keeps workers safe.

CONTEXT: Safety page exists with forms for inspections, incidents, toolbox talks, certifications. Database tables exist from migration 00005.

REQUIREMENTS:
1. Build Safety Inspection workflows:
   - Inspection templates: daily site walk, weekly safety audit, OSHA-style inspection
   - Template builder: checklist items with pass/fail/NA, photo required flag, corrective action required flag
   - Inspection execution: mobile-first form, tap-to-score, photo capture, voice notes
   - Deficiency tracking: auto-create corrective action items from failed inspection items
   - Corrective action workflow: identified → assigned → in_progress → verified → closed

2. Build Incident Management:
   - Incident report form: date, time, location, type (injury, near miss, property damage, environmental), severity, description, witnesses, immediate actions taken
   - OSHA recordability assessment wizard
   - Root cause analysis template (5-Why, fishbone)
   - Corrective/preventive actions (CAPA) tracking
   - Incident investigation workflow with findings and follow-up

3. Build Toolbox Talk system:
   - Library of pre-written toolbox talks by trade/topic (fall protection, electrical safety, excavation, heat illness, etc.)
   - Attendance tracking: QR code scan or name list with signatures
   - Schedule recurring talks (weekly per crew)
   - Completion tracking dashboard

4. Build Certification Tracker:
   - Worker certifications: type, issue date, expiration date, document upload
   - Auto-alerts 30/60/90 days before expiration
   - Gate check: prevent assigning workers to tasks requiring certs they don't have
   - Certification types: OSHA 10/30, first aid/CPR, crane operator, scaffolding competent person, confined space, etc.

5. Build Safety Dashboard:
   - TRIR (Total Recordable Incident Rate) calculation and trend
   - EMR (Experience Modification Rate) tracking
   - Days since last recordable incident (prominent display)
   - Open corrective actions by priority/age
   - Inspection completion rate by area
   - Upcoming certification expirations

6. Add safety scoring:
   - Score each subcontractor based on their safety record
   - Score project overall safety health
   - Benchmark against industry averages
```

---

## PROMPT 1.7 — Drawings & Document Management

```
OBJECTIVE: Build a construction document management system that handles drawings, specs, and project files with version control and markup.

CONTEXT: Drawings page exists with a viewer, BIM preview stub, and markup toolbar. Files page exists with upload. Supabase Storage is configured.

REQUIREMENTS:
1. Build the Drawing Register:
   - Drawing list with: number, title, discipline (A/S/M/E/P), revision, date, status
   - Revision tracking: Rev 0, Rev A, Rev B... with upload date and change description
   - Drawing set management: group drawings into sets (IFC, ASI, Bulletin)
   - Discipline filtering: Architectural, Structural, Mechanical, Electrical, Plumbing, Civil
   - Search by drawing number, title, or content (OCR-indexed)

2. Enhance the Drawing Viewer:
   - PDF viewer with pan/zoom/rotate
   - Side-by-side revision comparison (overlay with opacity slider)
   - Markup tools: pen, highlighter, text, shapes, dimensions, cloudmark (revision cloud)
   - Pin annotations: drop a pin, add a note, link to an RFI or punch item
   - Markup layers: personal, shared, official
   - Save and share markup sets

3. Build Document Management:
   - Folder structure: Drawings, Specs, Submittals, Contracts, Correspondence, Photos, Reports
   - Version control: upload new version, keep history, revert
   - File metadata: title, description, tags, discipline, trade
   - Full-text search across all documents
   - Access control: some folders restricted by role
   - Transmittal generation: select documents → create transmittal letter with recipient, purpose, action required

4. Build the Spec Section browser:
   - Parse CSI MasterFormat spec table of contents
   - Link spec sections to submittals and RFIs
   - Quick reference for field teams

5. File upload enhancements:
   - Drag-and-drop multi-file upload (already using Uppy)
   - Auto-detect file type and suggest folder
   - Image compression for photos (already have browser-image-compression)
   - Large file handling with chunked upload (Uppy TUS)
   - Upload progress with cancel capability

6. Add download/share:
   - Download individual files or bulk download as ZIP
   - Share link generation with optional expiration and password
   - QR code for quick mobile access to a drawing
```

---

# PHASE 2: AI ENGINE — The Intelligence That Creates the Moat

*This is what separates SiteSync from every other construction PM tool.*

---

## PROMPT 2.1 — AI Backend Infrastructure

```
OBJECTIVE: Build the AI backend that powers all intelligent features. This is the brain of SiteSync AI.

CONTEXT: Six Supabase edge functions exist in supabase/functions/ (ai-chat, ai-insights, generate-insights, liveblocks-auth, send-notification, weekly-digest). The frontend has AI SDK integration (@ai-sdk/anthropic, @ai-sdk/react). Currently ALL AI functions return empty arrays.

REQUIREMENTS:
1. Build the ai-chat edge function (supabase/functions/ai-chat/):
   - Accept messages array + context (current page, project ID, selected entity)
   - Use Anthropic Claude API via the AI SDK
   - System prompt that includes:
     * Project context (name, type, status, key dates)
     * Current page context (what the user is looking at)
     * User's role and permissions
     * Construction domain knowledge
   - Tool calls the AI can make:
     * query_rfis(filters) → search RFIs by status, assignee, date range
     * query_submittals(filters) → search submittals
     * query_tasks(filters) → search tasks
     * query_budget(metric) → get budget metrics
     * query_schedule(filters) → get schedule data
     * query_daily_logs(date_range) → get daily log summaries
     * create_rfi(data) → create an RFI (requires user confirmation)
     * update_task_status(id, status) → update a task
     * generate_report(type, params) → trigger report generation
   - Stream responses back to the frontend using server-sent events

2. Build the ai-insights edge function (supabase/functions/ai-insights/):
   - Called on page load to generate contextual insights
   - Input: page_type (dashboard, rfis, submittals, schedule, budget), project_id, user_id
   - Logic per page:
     * Dashboard: overall project health, top risks, upcoming deadlines
     * RFIs: overdue RFIs, bottleneck reviewers, trending topics
     * Submittals: approval chain delays, upcoming deadlines, procurement risks
     * Schedule: critical path risks, weather impacts, resource conflicts
     * Budget: cost trending, change order patterns, cash flow concerns
   - Output: array of insights with { id, severity, title, description, reasoning, suggested_actions, entity_references }
   - Cache insights in ai_insights table with TTL (regenerate if stale >1 hour)

3. Build the generate-insights edge function (supabase/functions/generate-insights/):
   - Cron-triggered (run nightly) to generate proactive insights
   - Analyze patterns across the project:
     * RFI aging: which RFIs have been open too long?
     * Budget burn rate: is the project tracking to budget?
     * Schedule variance: which tasks are behind?
     * Safety trends: increasing near misses?
     * Submittal delays: which are blocking construction?
   - Store in ai_insights table with notification flag
   - Create notifications for high-severity insights

4. Build the weekly-digest edge function (supabase/functions/weekly-digest/):
   - Generate a weekly project summary email per user
   - Content based on user's role:
     * Owner: budget status, milestones achieved, risks
     * PM: tasks completed, upcoming deadlines, open issues count
     * Superintendent: daily log summary, safety stats, schedule lookahead
   - Use @react-email/components for email templates
   - Send via Resend (already in dependencies)

5. Add proper environment variables for edge functions:
   - ANTHROPIC_API_KEY
   - RESEND_API_KEY
   - SUPABASE_SERVICE_ROLE_KEY (for edge functions to bypass RLS)

6. Add rate limiting and cost tracking:
   - Track AI API usage per project per day
   - Rate limit: 100 AI chat messages per user per day
   - Track token usage for billing (store in a usage tracking table)
```

---

## PROMPT 2.2 — AI Copilot: The Construction PM Assistant

```
OBJECTIVE: Build the AI Copilot chat interface that understands construction projects and can take actions.

CONTEXT: AICopilot page exists at src/pages/AICopilot.tsx with chat UI and suggested prompts. The @ai-sdk/react useChat hook is available. After Prompt 2.1, the backend will be live.

REQUIREMENTS:
1. Wire the AICopilot to the real ai-chat edge function:
   - Use useChat from @ai-sdk/react with streaming
   - Pass context: current project, current page, user role
   - Show typing indicator while AI is generating
   - Render markdown in responses with proper formatting

2. Build intelligent context awareness:
   - When user navigates to RFIs page and opens copilot, pre-load RFI context
   - When user is viewing a specific RFI, the AI knows which one and can answer questions about it
   - When user is on the budget page, the AI can discuss financial data
   - Context panel on the right showing what data the AI can see

3. Build suggested prompts that are contextual:
   - Dashboard: "What are the top 3 risks?", "Give me a project status summary", "What needs my attention today?"
   - RFIs: "Which RFIs are overdue?", "Who's the bottleneck reviewer?", "Draft an RFI for [issue]"
   - Schedule: "What's on the critical path?", "Which tasks are behind?", "What's the lookahead for next week?"
   - Budget: "Are we on budget?", "What's the change order trend?", "Project the final cost"

4. Build action confirmations:
   - When the AI wants to create/update data, show a confirmation card:
     "I'd like to create an RFI: [preview]. Shall I proceed?"
   - User can approve, edit, or cancel
   - On approve, execute the action and show confirmation

5. Add conversation persistence:
   - Store conversation history per user per project
   - "Continue where I left off" on return
   - Clear conversation button

6. Build the Floating AI Button (src/components/ai/FloatingAIButton.tsx):
   - Bottom-right floating button with gradient
   - Badge showing number of new insights
   - Click → slide-out panel with copilot mini-chat
   - Quick actions: "Summarize today", "What's urgent?", "Draft daily log"

7. Add AI personas for different user types:
   - For PMs: focus on schedule, cost, risk
   - For Superintendents: focus on daily ops, safety, crew
   - For Owners: focus on milestones, budget, quality
```

---

## PROMPT 2.3 — Predictive Intelligence & Smart Alerts

```
OBJECTIVE: Build the predictive engine that warns about problems before they happen.

CONTEXT: PredictiveAlert component exists (src/components/ai/PredictiveAlert.tsx) with UI for severity, reasoning, and actions. AIAnnotation (src/components/ai/AIAnnotation.tsx) shows inline sparkle indicators. Both currently render nothing because the data functions return empty arrays.

REQUIREMENTS:
1. Wire the PredictiveAlert component to real data:
   - Fetch insights from the ai_insights table via the API
   - Filter by current page context
   - Show as a dismissible banner at the top of relevant pages
   - Severity levels: info (blue), warning (yellow), critical (red)
   - Each alert has: title, description, expandable reasoning, action buttons

2. Build predictive algorithms (in the generate-insights edge function):

   a. Schedule Risk Prediction:
      - Analyze task completion rates vs planned dates
      - Flag tasks likely to miss deadlines based on historical velocity
      - Detect critical path impact cascades
      - Weather-based delay prediction (integrate weather forecast)

   b. Budget Overrun Detection:
      - Track cost burn rate vs timeline progress
      - Flag cost codes trending over budget
      - Detect change order patterns that suggest scope creep
      - Project final cost based on current trajectory

   c. RFI/Submittal Bottleneck Detection:
      - Identify reviewers with growing queues
      - Flag items that have been in review too long
      - Predict downstream construction delays from document delays

   d. Safety Risk Indicators:
      - Increasing near-miss frequency → flag elevated risk
      - Weather conditions + work type → safety alert (heat, wind, rain)
      - Crew fatigue indicators (consecutive long days)

   e. Resource Conflict Detection:
      - Overlapping crew assignments
      - Equipment double-booking
      - Material delivery conflicts

3. Wire AIAnnotation to entity-level insights:
   - On RFI list: sparkle icon on RFIs that AI has flagged
   - On task board: annotation on tasks at risk
   - On budget lines: annotation on line items trending over
   - Tooltip shows the insight summary
   - Click navigates to detail or opens AI copilot with context

4. Build the Insight Feed (new component):
   - Chronological feed of all AI-generated insights
   - Filterable by severity, category, date
   - Dismissible with "snooze" option (don't show for 24h/7d)
   - "Was this helpful?" feedback for AI learning

5. Add notification integration:
   - Critical insights → push notification + email
   - Warning insights → in-app notification
   - Info insights → visible in feed only
```

---

## PROMPT 2.4 — AI Agents: Autonomous Workflows

```
OBJECTIVE: Build AI agents that autonomously handle routine construction PM tasks with human oversight.

CONTEXT: AIAgents page exists with agent list, pending actions, and approval workflow UI. Database tables ai_agents and ai_agent_actions exist. Currently no actual agent execution.

REQUIREMENTS:
1. Build the Agent Execution Engine (Supabase Edge Function: agent-runner):
   - Accept: agent_type, project_id, trigger (cron/event/manual)
   - Execute agent logic with access to project data
   - Record all actions in ai_agent_actions table
   - Actions that modify data require approval (confidence < threshold)
   - Actions that only notify can auto-execute

2. Build these agents:

   a. Daily Log Agent:
      - Trigger: 5 PM daily
      - Action: Pre-fill daily log from today's data
        * Pull crew assignments from workforce schedule
        * Pull weather from weather API
        * Pull completed tasks from task updates
        * Pull material deliveries from procurement
        * Pull safety incidents/observations
      - Output: Draft daily log for superintendent to review and sign

   b. RFI Follow-up Agent:
      - Trigger: Daily at 9 AM
      - Action: Check for overdue RFIs
        * If 3+ days overdue: draft follow-up notification to assignee
        * If 7+ days overdue: escalate to PM with summary
        * If 14+ days overdue: flag as critical, notify project admin
      - Output: Draft notifications pending approval

   c. Submittal Deadline Agent:
      - Trigger: Weekly Monday
      - Action: Review submittal schedule
        * Calculate days until each submittal is needed on site
        * Factor in review duration and resubmit risk
        * Flag submittals that need to be submitted this week
      - Output: Prioritized submittal action list

   d. Schedule Update Agent:
      - Trigger: End of each work day
      - Action: Analyze today's progress
        * Compare planned vs actual task completions
        * Update percent complete based on daily log entries
        * Recalculate critical path
        * Flag new schedule risks
      - Output: Schedule status update with risk flags

   e. Cost Tracking Agent:
      - Trigger: Weekly
      - Action: Analyze financial data
        * Compare actual costs to budgeted amounts
        * Track change order pipeline
        * Project final cost
        * Flag budget concerns
      - Output: Weekly cost report draft

3. Build the Agent Dashboard (enhance src/pages/AIAgents.tsx):
   - Agent list with: name, status (active/paused/error), last run, next run, success rate
   - Agent detail: configuration, run history, actions taken
   - Pending Actions queue: actions requiring human approval
   - Action detail: what the agent wants to do, confidence score, reasoning, approve/reject/edit
   - Agent performance metrics: actions taken, approval rate, time saved estimate

4. Build the Agent Configuration:
   - Enable/disable per agent
   - Set run schedule (cron expression or event triggers)
   - Set confidence threshold for auto-execution (default 0.8)
   - Set notification preferences (email/in-app/both)
   - Agent-specific settings (e.g., overdue threshold for RFI agent)

5. Add agent audit trail:
   - Every action logged with: agent, action_type, entity_affected, confidence, approved_by, result
   - Exportable for compliance purposes
```

---

# PHASE 3: ENTERPRISE FEATURES — What Makes Enterprise Buyers Say Yes

---

## PROMPT 3.1 — Real-Time Collaboration Engine

```
OBJECTIVE: Build real-time collaboration that makes SiteSync feel alive — presence, live cursors, concurrent editing, instant updates.

CONTEXT: Liveblocks is configured (src/lib/liveblocks.ts). @liveblocks/client and @liveblocks/react are installed. A liveblocks-auth edge function exists. Basic presence might be partially wired.

REQUIREMENTS:
1. Build the Liveblocks integration:
   - Configure room per project: "project:{projectId}"
   - Auth endpoint that verifies Supabase session and returns Liveblocks token with user info
   - User presence data: { name, avatar, color, cursor, currentPage }

2. Add presence indicators across the app:
   - TopNav: show avatars of users currently viewing this project
   - Page-level: "Sarah is also viewing RFIs" indicator
   - Entity-level: "Mike is editing RFI #42" lock indicator
   - Typing indicators in comment threads

3. Add real-time data sync:
   - When User A creates an RFI, User B sees it appear instantly
   - Use Supabase Realtime subscriptions (LISTEN/NOTIFY)
   - Subscribe to changes on project-scoped tables
   - Merge real-time updates with React Query cache:
     ```typescript
     supabase.channel('project-rfis')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'rfis', filter: `project_id=eq.${projectId}` },
         (payload) => {
           queryClient.invalidateQueries({ queryKey: queryKeys.rfis.lists() })
         })
       .subscribe()
     ```

4. Add collaborative editing:
   - Rich text fields (RFI responses, daily log notes) use TipTap + Yjs for concurrent editing
   - Show other users' cursors in the editor
   - Conflict resolution: last-write-wins for simple fields, CRDT for rich text

5. Add live notifications:
   - When another user @mentions you → instant notification
   - When a status changes on something you're watching → instant notification
   - Use Supabase Realtime for notification delivery
   - Desktop notification permission prompt

6. Add "working on" indicators:
   - When a user starts editing an entity, broadcast to the room
   - Other users see a lock icon with the editor's name
   - Auto-release after 5 minutes of inactivity
   - Manual "done editing" action
```

---

## PROMPT 3.2 — Permissions & Multi-Tenancy

```
OBJECTIVE: Build an enterprise-grade permission system with organization → project → role hierarchy.

CONTEXT: project_members table has role (owner/admin/member/viewer). RLS policies exist but are basic. No organization-level entity exists.

REQUIREMENTS:
1. Add organization layer (new migration):
   - organizations table: id, name, slug, logo_url, plan (free/pro/enterprise), created_at
   - organization_members table: org_id, user_id, role (owner/admin/member)
   - Update projects to belong to an organization: projects.organization_id
   - Update project_members to check org membership

2. Build the permission matrix:
   ```
   Action                    Owner  Admin  Member  Viewer
   ─────────────────────────────────────────────────────
   View project              ✓      ✓      ✓       ✓
   Edit project settings     ✓      ✓      ✗       ✗
   Delete project            ✓      ✗      ✗       ✗
   Create RFI/submittal      ✓      ✓      ✓       ✗
   Approve/reject            ✓      ✓      ✗       ✗
   View budget details       ✓      ✓      ✓       ✗
   Edit budget               ✓      ✓      ✗       ✗
   Approve change orders     ✓      ✓      ✗       ✗
   View all daily logs       ✓      ✓      ✓       ✓
   Submit daily log          ✓      ✓      ✓       ✗
   Approve daily log         ✓      ✓      ✗       ✗
   Manage team               ✓      ✓      ✗       ✗
   AI copilot access         ✓      ✓      ✓       ✗
   Export data               ✓      ✓      ✓       ✗
   ```

3. Implement permission checks:
   - Create src/hooks/usePermissions.ts:
     ```typescript
     export function usePermissions() {
       const { user } = useAuth()
       const { currentProject } = useProjectStore()
       const role = currentProject?.members?.find(m => m.user_id === user.id)?.role

       return {
         canCreate: role !== 'viewer',
         canApprove: role === 'owner' || role === 'admin',
         canEditBudget: role === 'owner' || role === 'admin',
         canDeleteProject: role === 'owner',
         canManageTeam: role === 'owner' || role === 'admin',
         canUseAI: role !== 'viewer',
         role,
       }
     }
     ```
   - Apply to every create/edit/delete button and action
   - Hide UI elements the user can't use (don't just disable)

4. Update all RLS policies in Supabase:
   - Every table policy must check project_members for the current user
   - Budget tables restrict detailed view to admin/owner
   - Safety incidents restrict certain fields by role
   - AI usage tracks per-user

5. Add invitation flow:
   - Invite by email → creates pending invite → email sent → user accepts → added to project
   - Bulk invite via CSV upload
   - Set role on invite

6. Build the org-level admin panel:
   - Member management: invite, remove, change role
   - Project list across the org
   - Usage dashboard: storage, AI calls, members
   - Billing overview (UI ready, payment integration later)
```

---

## PROMPT 3.3 — Reporting Engine: Export Everything Beautifully

```
OBJECTIVE: Build a reporting engine that generates beautiful, professional reports that construction companies actually need.

CONTEXT: Export components exist in src/components/export/. PDF generation uses @react-pdf/renderer. Excel uses xlsx. Various report formats exist but may be incomplete.

REQUIREMENTS:
1. Build the Report Engine core:
   - Report template system: define report structure, data sources, formatting
   - Report generation pipeline: query data → transform → render → export
   - Output formats: PDF, Excel, Word (via edge function)
   - Branding: company logo, colors, contact info on every report

2. Build these reports:

   a. Project Executive Summary:
      - Overall status (green/yellow/red)
      - Budget summary with variance
      - Schedule summary with milestones
      - Key risks and issues
      - Photos (top 4 recent)
      - Next period lookahead

   b. Monthly Progress Report:
      - Work completed by trade/area
      - Manpower summary (chart + table)
      - Schedule comparison (planned vs actual)
      - Budget comparison (planned vs actual)
      - Change order log
      - Safety statistics
      - RFI/Submittal status summary
      - Photo documentation
      - 20-30 page professional PDF

   c. RFI Log:
      - Full RFI register with status, dates, ball in court
      - Aging analysis
      - Export as PDF or Excel

   d. Submittal Log:
      - Full submittal register
      - Status summary pie chart
      - Upcoming deadlines
      - Export as PDF or Excel

   e. Daily Log Summary:
      - Weekly or monthly compilation
      - Manpower chart
      - Weather summary
      - Key activities by date

   f. Safety Report:
      - Incident summary
      - TRIR trend
      - Inspection completion rate
      - Open corrective actions
      - Training/certification status

   g. Punch List Report:
      - Open items by location/trade/priority
      - Photo documentation
      - Progress summary

3. Build the Export Center (enhance src/components/export/ExportCenter.tsx):
   - Central place to generate any report
   - Report type selector
   - Date range picker
   - Filter options per report type
   - Format selector (PDF/Excel/Word)
   - Generation progress indicator
   - Download when ready

4. Add scheduled reports:
   - Set up recurring report generation (weekly exec summary, monthly progress)
   - Auto-email to distribution list
   - Store generated reports in project files

5. Ensure every report has:
   - Professional header with logo and project info
   - Page numbers
   - Generated date and "CONFIDENTIAL" watermark option
   - Print-optimized layout
```

---

## PROMPT 3.4 — Integrations Framework

```
OBJECTIVE: Build an integration framework that connects SiteSync to the construction ecosystem.

CONTEXT: Integrations page exists (src/pages/Integrations.tsx) as a placeholder. No real integrations are built.

REQUIREMENTS:
1. Build the integration framework:
   - src/services/integrations/ directory
   - Base integration class with: authenticate, sync, disconnect, healthCheck
   - Webhook receiver endpoint (edge function)
   - OAuth 2.0 flow handler for third-party auth
   - Integration status tracking: connected, syncing, error, disconnected

2. Build these integration connectors (interface + UI, actual API calls can be stubbed with clear TODO markers):

   a. Procore Import:
      - Import projects, RFIs, submittals from Procore
      - Map Procore fields to SiteSync fields
      - One-time migration or ongoing sync

   b. Autodesk Build (BIM 360):
      - Import drawing sets
      - Import issues → RFIs
      - Import models for BIM viewer

   c. Microsoft Project / Primavera P6:
      - Import/export schedule (XML format)
      - Map activities to SiteSync tasks
      - Two-way sync option

   d. QuickBooks / Sage:
      - Sync cost codes
      - Export pay applications
      - Import actual costs

   e. Email Integration:
      - Create RFIs by forwarding email
      - Daily log submission via email
      - Parse email threads into conversations

   f. Calendar:
      - Sync meetings to Google/Outlook calendar
      - Sync milestones and deadlines
      - Inspection scheduling

3. Build the Integrations page:
   - Grid of available integrations with logos
   - Connected status badge
   - Configuration panel per integration
   - Sync history and error log
   - "Request an integration" form

4. Build webhook infrastructure:
   - Webhook receiver edge function
   - Event processing queue
   - Retry logic for failed webhooks
   - Webhook log for debugging

5. Build the SiteSync API (for third-party integrations into us):
   - REST API with API key auth
   - Rate limiting
   - API documentation (auto-generated OpenAPI spec)
   - Endpoints for all core entities: projects, rfis, submittals, tasks, daily logs
```

---

## PROMPT 3.5 — Search & Navigation: Find Anything Instantly

```
OBJECTIVE: Build a global search that finds anything across the entire project in milliseconds.

CONTEXT: @orama/orama is installed for client-side search. A command palette (cmdk) is installed. src/lib/search.ts exists. Keyboard shortcuts are configured.

REQUIREMENTS:
1. Build the global command palette (enhance existing cmdk integration):
   - Trigger with Cmd+K (Mac) / Ctrl+K (Windows)
   - Search across ALL entities: RFIs, submittals, tasks, punch items, daily logs, drawings, people, meetings
   - Show results grouped by type with icons
   - Show recent searches and recently viewed items
   - Quick actions: "Create RFI", "Go to Budget", "Open Daily Log"
   - Keyboard navigation: arrow keys, enter to select, esc to close

2. Build the search backend:
   - Full-text search using Supabase's built-in PostgreSQL full-text search
   - Create GIN indexes on searchable text columns
   - Search function that queries across multiple tables:
     ```sql
     CREATE OR REPLACE FUNCTION search_project(project_uuid UUID, query TEXT)
     RETURNS TABLE(entity_type TEXT, entity_id UUID, title TEXT, description TEXT, rank REAL)
     ```
   - Fuzzy matching for typos
   - Search by entity number (RFI-042, SUB-017, TASK-103)

3. Build the client-side search index (using Orama):
   - Index recently accessed items for instant offline search
   - Sync index when data changes
   - Fall back to server search for comprehensive results

4. Add search result previews:
   - Hover over a search result → show preview panel
   - Preview shows key fields, status, assignee
   - Click → navigate to the item

5. Build contextual search within pages:
   - RFI page has its own search bar filtering the RFI list
   - Drawing page has search by drawing number
   - Budget page has search by cost code or description
   - Each search uses Orama for instant filtering

6. Add smart filters:
   - "my open rfis" → filters RFIs assigned to current user with status open
   - "overdue submittals" → filters submittals past due date
   - "critical tasks this week" → filters critical path tasks due this week
   - Natural language filter parsing (simple keyword matching, not full NLP)
```

---

# PHASE 4: MOBILE & FIELD — Win the Jobsite

---

## PROMPT 4.1 — Mobile-First Field Experience

```
OBJECTIVE: Make SiteSync the app that superintendents and foremen actually want to use in the field.

CONTEXT: Capacitor is configured for iOS/Android. Mobile layout components exist (src/components/layout/MobileLayout.tsx). Camera, geolocation, haptics, push notifications, and share plugins are installed.

REQUIREMENTS:
1. Build the mobile field dashboard:
   - Optimize for one-handed use on a phone in a gloved hand
   - Large touch targets (minimum 48x48px, prefer 56x56px)
   - Big status cards: today's weather, crew count, open issues
   - Quick action buttons: "Take Photo", "Daily Log", "Report Issue", "Punch Item"
   - Pull-to-refresh on all lists
   - Haptic feedback on actions

2. Build mobile-optimized forms:
   - Daily log mobile form: swipe between sections, auto-save
   - Punch item capture: photo → annotate → add details → submit (3-tap flow)
   - Safety observation: photo → select type → add notes → submit
   - RFI from field: photo → describe issue → select drawing → submit
   - All forms work offline and sync when connected

3. Build photo capture flow:
   - Camera integration via Capacitor Camera plugin
   - Auto-add: GPS coordinates, timestamp, compass heading
   - Quick annotate: draw on photo, add text labels
   - Auto-compress before upload
   - Organize by date, area, trade
   - Batch upload when on WiFi

4. Build mobile navigation:
   - Bottom tab bar with: Dashboard, Tasks, Log, Capture, Menu
   - Swipe gestures: left/right for next/previous items in lists
   - Back navigation that makes sense (not just browser back)
   - Deep linking: open specific RFI/task from notification or QR code

5. Build QR code integration:
   - Generate QR codes for: drawings, locations, equipment, materials
   - Scan QR code → opens relevant item in app
   - Print QR code sheets for jobsite posting
   - QR-based attendance: workers scan to sign in/out

6. Add offline indicators:
   - Clear offline banner when disconnected
   - Pending sync counter showing queued items
   - Sync status per item (synced ✓, pending ↻, failed ✗)
   - Manual "Sync Now" button

7. Build push notification handling:
   - Register device token with Supabase
   - Handle notification tap → deep link to relevant screen
   - Notification categories: urgent (red), action needed (yellow), FYI (blue)
   - Quiet hours setting (default: 7pm-6am)
```

---

## PROMPT 4.2 — Offline-First Architecture

```
OBJECTIVE: Make SiteSync work flawlessly without internet, because construction sites have terrible connectivity.

CONTEXT: Dexie (IndexedDB wrapper) is installed at src/lib/offlineDb.ts. Workbox service worker is configured at src/sw.ts. Basic offline support exists but is incomplete.

REQUIREMENTS:
1. Build the offline data layer (enhance src/lib/offlineDb.ts):
   - Define Dexie schema matching critical Supabase tables:
     * projects, rfis, submittals, tasks, punch_items, daily_logs, files_metadata
   - Sync strategy per table:
     * On app open: sync all project data user has access to
     * On data change: update local DB immediately, queue sync to server
     * On reconnect: process sync queue in order
   - Storage budget: ~50MB per project, clear old data when space is low

2. Build the sync engine:
   - Queue-based: every offline mutation goes into a sync queue
   - Queue persistence: survive app close/crash
   - Conflict resolution:
     * Last-write-wins for simple fields
     * Merge for array fields (attachments, watchers)
     * Flag conflicts for user resolution when data diverges
   - Sync queue UI: show pending items, retry failed, manual resolve

3. Build offline-first React Query adapter:
   - Custom queryFn that checks Dexie first, falls back to network
   - Custom mutationFn that writes to Dexie immediately, queues network sync
   - Optimistic UI: show changes immediately, reconcile on sync
   ```typescript
   const offlineQueryFn = async (key, networkFn) => {
     const cached = await dexieDb.getByKey(key)
     if (navigator.onLine) {
       const fresh = await networkFn()
       await dexieDb.put(key, fresh)
       return fresh
     }
     if (cached) return cached
     throw new OfflineError('No cached data available')
   }
   ```

4. Build offline file handling:
   - Photos taken offline: store in IndexedDB as blobs
   - Upload queue: track pending file uploads
   - Show thumbnail from local storage while pending upload
   - Retry failed uploads with exponential backoff

5. Build the service worker (enhance src/sw.ts):
   - Pre-cache app shell (HTML, CSS, JS, fonts, icons)
   - Runtime cache API responses with stale-while-revalidate
   - Background sync for queued mutations (using workbox-background-sync)
   - Cache key project files (current drawings, specs) for offline viewing

6. Add offline testing utilities:
   - Dev toggle to simulate offline mode
   - Log all sync operations for debugging
   - Health check endpoint to verify connectivity
```

---

# PHASE 5: POLISH, PERFORMANCE & PRODUCTION

---

## PROMPT 5.1 — Design System & UI Polish

```
OBJECTIVE: Create a cohesive, premium design system that makes SiteSync look like a $1B product.

CONTEXT: The app uses custom CSS with a theme in src/styles/. Radix UI primitives. Framer Motion for animations. No design tokens system. Inconsistent styling across components.

REQUIREMENTS:
1. Build the design token system (src/styles/tokens.ts):
   ```typescript
   export const tokens = {
     color: {
       // Brand
       primary: { 50: '#E8F4FD', 100: '#B8DDF7', ..., 900: '#0A3D62' },
       // Semantic
       success: { light: '#E6F9E8', DEFAULT: '#22C55E', dark: '#15803D' },
       warning: { light: '#FEF3C7', DEFAULT: '#F59E0B', dark: '#B45309' },
       danger: { light: '#FEE2E2', DEFAULT: '#EF4444', dark: '#B91C1C' },
       info: { light: '#E0F2FE', DEFAULT: '#3B82F6', dark: '#1D4ED8' },
       // Construction-specific status colors
       status: {
         open: '#3B82F6',
         in_review: '#F59E0B',
         approved: '#22C55E',
         rejected: '#EF4444',
         closed: '#6B7280',
         draft: '#9CA3AF',
       },
       // Neutral
       gray: { 50: '#F9FAFB', 100: '#F3F4F6', ..., 900: '#111827' },
     },
     spacing: { 0: '0', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' },
     radius: { none: '0', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
     shadow: {
       sm: '0 1px 2px rgba(0,0,0,0.05)',
       md: '0 4px 6px rgba(0,0,0,0.07)',
       lg: '0 10px 15px rgba(0,0,0,0.1)',
       xl: '0 20px 25px rgba(0,0,0,0.15)',
     },
     font: {
       family: { sans: "'Inter', -apple-system, sans-serif", mono: "'JetBrains Mono', monospace" },
       size: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '30px' },
       weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
     },
     transition: {
       fast: '150ms ease',
       normal: '200ms ease',
       slow: '300ms ease',
     },
   }
   ```

2. Build core UI components using tokens (enhance src/components/Primitives.tsx):
   - Button: primary, secondary, ghost, danger. Sizes: sm, md, lg. Loading state.
   - Input: text, number, date, search. With label, helper text, error state.
   - Select: single, multi. With search. Using Radix Select.
   - Badge: status colors, sizes. Dot variant for status indicators.
   - Card: with header, body, footer. Hover state. Click variant.
   - Dialog/Modal: sizes. Slide-over variant for detail panels.
   - Table: header, body, pagination. Sortable columns. Row actions.
   - Tabs: underline variant, pill variant. With counts.
   - Avatar: sizes, with online indicator. Group with +N overflow.
   - Tooltip: delay, placement. Arrow.
   - Toast: success, error, warning, info. With actions.
   - Empty State: icon, title, description, action button.
   - Loading: skeleton, spinner, progress bar.

3. Add animation standards using Framer Motion:
   - Page transitions: fade + slight slide
   - Modal: scale up from 95% + fade
   - Slide-over: slide from right
   - List items: stagger fade-in
   - Status changes: color morph
   - Micro-interactions: button press scale, checkbox bounce
   - Respect prefers-reduced-motion

4. Add dark mode support:
   - CSS custom properties for all colors
   - Toggle in user settings
   - Respect system preference
   - Smooth transition between modes

5. Ensure consistency:
   - Audit every page for spacing consistency
   - Standardize all forms to use the same input components
   - Standardize all tables to use DataTable
   - Standardize all status displays to use the same Badge component
   - Remove all inline styles that conflict with the design system
```

---

## PROMPT 5.2 — Performance Optimization

```
OBJECTIVE: Make SiteSync blazingly fast — sub-second page loads, instant interactions, smooth scrolling.

REQUIREMENTS:
1. Bundle optimization:
   - Analyze bundle with rollup-plugin-visualizer: `npm run build -- --mode analyze`
   - Code split every page route (already using lazy() — verify all pages)
   - Move heavy dependencies to dynamic imports:
     * Three.js / React Three Fiber: only load on Drawings page
     * MapLibre GL: only load on map views
     * TipTap: only load when rich text editor is opened
     * PDF renderer: only load when generating PDFs
     * Recharts/Nivo: only load on dashboard/reports
   - Tree-shake unused Lucide icons (import individual icons, not the whole package)
   - Target max initial JS bundle: <250KB gzipped

2. Rendering optimization:
   - Audit all components for unnecessary re-renders using React DevTools Profiler
   - Add React.memo to all list item components
   - Use useMemo for expensive computations (budget calculations, schedule critical path)
   - Use useCallback for event handlers passed as props
   - Virtual scrolling for all lists >50 items (already have @tanstack/react-virtual)
   - Pagination: default 25 items per page, load more on scroll or page button

3. Data fetching optimization:
   - Prefetch data on hover (router.prefetch for navigation links)
   - Stale-while-revalidate for all queries
   - Parallel queries where possible (useQueries for dashboard widgets)
   - Selective field fetching: don't SELECT * when you only need id, title, status
   - Database indexes: ensure all filtered/sorted columns have indexes

4. Image optimization:
   - Lazy load all images below the fold
   - Use srcset for responsive images
   - Compress uploaded photos client-side before upload (already have browser-image-compression)
   - Serve thumbnails for list views, full resolution for detail views
   - Use WebP format where supported

5. CSS optimization:
   - Extract critical CSS for initial render
   - Remove unused CSS
   - Consolidate duplicate styles

6. Caching strategy:
   - Service worker caching for static assets (1 year cache)
   - API response caching with proper cache-control headers
   - React Query cache persistence to localStorage for instant app open
   - Supabase realtime for cache invalidation
```

---

## PROMPT 5.3 — Testing: Build Confidence to Ship Fast

```
OBJECTIVE: Build a test suite that gives confidence to ship daily. Target: 60%+ coverage on critical paths.

CONTEXT: Vitest + React Testing Library + Playwright configured. Only 10 test files exist (~5% coverage).

REQUIREMENTS:
1. Build the testing infrastructure:
   - src/test/setup.ts: global test setup with mocks for Supabase, React Query, router
   - src/test/factories.ts: test data factories for every entity type
     ```typescript
     export const rfiFactory = {
       build: (overrides?: Partial<RFI>): RFI => ({
         id: crypto.randomUUID(),
         project_id: 'test-project-id',
         number: 'RFI-001',
         title: 'Test RFI',
         status: 'open',
         priority: 'medium',
         created_at: new Date().toISOString(),
         ...overrides,
       }),
       buildList: (count: number, overrides?: Partial<RFI>) =>
         Array.from({ length: count }, (_, i) =>
           rfiFactory.build({ number: `RFI-${String(i + 1).padStart(3, '0')}`, ...overrides })
         ),
     }
     ```
   - src/test/mocks/supabase.ts: typed mock for Supabase client
   - src/test/mocks/handlers.ts: MSW handlers for API mocking (install msw if needed)
   - src/test/utils.tsx: custom render with all providers (QueryClient, Router, stores)

2. Write unit tests for critical business logic:
   - Budget calculations: earned value, CPI, SPI, EAC, variance
   - Schedule calculations: critical path, float, early/late dates
   - Permission checks: role-based access control logic
   - State machine transitions: every valid and invalid transition
   - Date utilities: working days calculation, duration estimation
   - Search ranking algorithm
   - Offline sync conflict resolution

3. Write component tests for core workflows:
   - RFI creation flow: open form → fill fields → submit → appears in list
   - Submittal approval flow: view → approve/reject → status updates
   - Task status change: drag on kanban → status updates → notification
   - Daily log submission: fill form → sign → submit → approval workflow
   - Auth flow: login → redirect → session management → logout
   - Error states: network error → retry → success

4. Write integration tests for data flows:
   - Create RFI → query invalidation → list updates
   - Update budget → financial calculations recalculate
   - Change task status → dependent tasks update
   - Offline create → sync → server receives correct data

5. Write E2E tests with Playwright (src/e2e/):
   - Happy path: login → create project → create RFI → respond → close
   - Mobile viewport: daily log entry on phone
   - Offline: create while offline → reconnect → data synced
   - Performance: page load times under thresholds

6. Add CI/CD test running:
   - npm test runs all unit + component tests
   - npm run test:e2e runs Playwright tests
   - Add to package.json: "test:coverage": "vitest run --coverage"
   - Target coverage thresholds: statements 60%, branches 50%, functions 60%
```

---

## PROMPT 5.4 — Dashboard: The Command Center

```
OBJECTIVE: Build a dashboard so good that PMs open SiteSync first thing every morning.

CONTEXT: Dashboard page exists with widget registry and KPI cards. Uses react-grid-layout for drag-and-drop layout. Currently may use mock data.

REQUIREMENTS:
1. Build the widget system:
   - Configurable grid layout with drag-and-drop (react-grid-layout)
   - User-specific layouts saved to database
   - Default layout per role (PM gets budget-heavy, Super gets field-heavy)
   - Widget resize with responsive content adaptation

2. Build these dashboard widgets (all pulling real data):

   a. Project Health Score:
      - Single metric: 0-100 score
      - Factors: schedule performance, budget performance, safety, quality, team sentiment
      - Trend arrow (improving/declining)
      - Click → navigate to Project Health page

   b. Key Metrics Bar:
      - Budget: total / spent / remaining with progress bar
      - Schedule: % complete, days ahead/behind
      - Open Items: RFIs, submittals, punch items counts
      - Safety: days since last incident

   c. Tasks Due This Week:
      - List of tasks due in next 7 days
      - Color coded by priority
      - Quick-complete checkbox
      - "View All" link

   d. Recent Activity:
      - Live feed of project activity
      - Filterable by type
      - Clickable items navigate to detail

   e. Schedule Lookahead:
      - Next 2 weeks of scheduled activities
      - Mini Gantt view
      - Critical path highlighted

   f. Budget Summary:
      - Mini S-curve chart
      - Budget vs actual with variance
      - Change order impact

   g. Weather Widget:
      - Current conditions + 5-day forecast
      - Impact on scheduled work
      - Auto-populated from project location

   h. AI Insights:
      - Top 3 AI-generated insights
      - Severity indicators
      - Dismiss / take action

   i. Photo Feed:
      - Recent photos from daily logs and field capture
      - Carousel view
      - Click → full photo with context

   j. Open Issues Summary:
      - Stacked bar chart: RFIs, submittals, punch items by status
      - Click segments to filter

3. Add dashboard personalization:
   - "Add Widget" button with widget gallery
   - Remove widgets with X button
   - Reset to default layout
   - Share layout with team option

4. Add morning briefing:
   - Auto-show on first visit of the day
   - Summary: "Good morning, Walker. Here's what needs your attention today."
   - List of urgent items, today's meetings, overdue tasks
   - Dismiss after reading
```

---

## PROMPT 5.5 — Notifications & Activity System

```
OBJECTIVE: Build a notification system that keeps everyone informed without overwhelming them.

CONTEXT: Notification store exists. Toast notifications (sonner) are used. A notifications table exists in the database. NotificationCenter component exists.

REQUIREMENTS:
1. Build the notification backend:
   - Notification types: mention, assignment, status_change, approval_needed, overdue, ai_insight, comment, system
   - Delivery channels: in-app, email, push (mobile)
   - User preferences per type × channel matrix
   - Batching: group similar notifications (5 new RFI comments → 1 notification)
   - Quiet hours: respect user's do-not-disturb setting

2. Build notification triggers (Supabase database triggers or edge functions):
   - RFI assigned → notify assignee
   - RFI response added → notify creator + watchers
   - Submittal status changed → notify submitter + reviewers
   - Task assigned → notify assignee
   - Task completed → notify dependent task owners
   - Daily log submitted → notify approver
   - @mention in any comment → notify mentioned user
   - AI critical insight → notify relevant users
   - Approaching deadline (3 days out) → notify assignee

3. Build the Notification Center (enhance existing):
   - Bell icon in top nav with unread count badge
   - Dropdown panel with notification list
   - Group by: today, yesterday, this week, older
   - Each notification: icon, title, description, timestamp, read/unread indicator
   - Click → navigate to relevant item
   - "Mark all as read" and "Mark as read" actions
   - Notification preferences link

4. Build the Activity Feed (enhance src/pages/Activity.tsx):
   - Project-wide chronological feed
   - Filter by: entity type, user, date range
   - Each activity: user avatar, action description, timestamp, entity link
   - Real-time updates (new activities appear at top)
   - "Load more" pagination

5. Build email notifications (via Resend + @react-email):
   - Beautiful, branded email templates
   - Templates for: assignment, status change, mention, daily digest, weekly summary
   - Unsubscribe link per notification type
   - Smart batching: don't send 10 emails, send 1 summary

6. Build notification preferences:
   - Per-notification-type settings: in-app, email, push, off
   - "Mute project" option (no notifications from this project)
   - "Mute thread" option (stop following a specific RFI/conversation)
   - Daily digest option: get all notifications as one end-of-day email
```

---

## PROMPT 5.6 — Owner Portal & External Stakeholder Views

```
OBJECTIVE: Build a read-only portal for project owners/clients that makes them feel confident and informed.

CONTEXT: OwnerPortal page exists as a TODO stub. Portfolio page exists with basic UI.

REQUIREMENTS:
1. Build the Owner Portal:
   - Separate, simplified view for external stakeholders (owners, architects, investors)
   - Accessible via unique invite link (no SiteSync account required, token-based auth)
   - Read-only: no edit capabilities
   - Branded with the contractor's logo

2. Owner Portal pages:

   a. Project Overview:
      - Hero banner with project photo, name, status, key dates
      - Budget summary: contract value, approved COs, current commitment, % complete
      - Schedule summary: milestone timeline with actual vs planned
      - Recent progress photos (carousel)

   b. Financial Summary:
      - Budget overview (not detailed line items)
      - Change order log with amounts
      - Pay application history
      - Cash flow projection chart

   c. Schedule & Milestones:
      - High-level milestone timeline (not detailed task view)
      - Key milestones with status (completed, on track, at risk, delayed)
      - Current phase description

   d. Progress Photos:
      - Photo gallery organized by date and area
      - Before/after comparison view
      - Filterable by date, location

   e. Reports:
      - Access to published reports only
      - Monthly progress reports
      - Safety summaries

   f. Documents:
      - Access to shared documents only
      - Not full project file system
      - Download permitted, upload not

3. Build the Portfolio View (enhance src/pages/Portfolio.tsx):
   - For organizations with multiple projects
   - Card grid showing all projects with health indicators
   - Aggregate metrics across projects
   - Sort/filter by: status, health, location, PM
   - Map view showing project locations

4. Add portal customization:
   - Choose which sections to expose per stakeholder
   - Set data visibility level (summary vs detail)
   - Custom portal URL subdomain option (future)
```

---

# PHASE 6: COMPETITIVE MOAT — Features Nobody Else Has

---

## PROMPT 6.1 — Construction-Specific Workflows

```
OBJECTIVE: Build construction-specific workflows that generic PM tools can't replicate.

REQUIREMENTS:
1. Build the Lookahead Schedule (enhance src/pages/Lookahead.tsx):
   - Rolling 3-week lookahead (industry standard)
   - Pull from master schedule, filter to near-term activities
   - Add constraints: material delivery, inspection required, weather dependent
   - Weekly planning meeting workflow:
     * Generate lookahead from schedule
     * Review in meeting (editable)
     * Assign responsible parties
     * Track commitments made vs completed (PPC - Percent Plan Complete)
   - Lean construction metrics: PPC tracking over time
   - Reasons for non-completion analysis

2. Build the Procurement Tracker (enhance src/pages/Procurement.tsx):
   - Material tracking: item, vendor, PO#, quantity, cost, delivery date, status
   - Long-lead item tracking with alerts
   - Delivery schedule tied to construction schedule
   - Material approval workflow (submittal → approved → ordered → delivered → installed)
   - Vendor management: contact info, performance rating

3. Build the Closeout Manager:
   - Closeout checklist by trade/system
   - Required documents tracker: as-builts, O&M manuals, warranties, training, attic stock
   - Punch list completion tracking (link to Punch List module)
   - Final inspection scheduling
   - Certificate of Substantial Completion generation
   - Final payment application

4. Build Weather Impact Tracking:
   - Auto-record weather per project location daily
   - Tag daily log entries as "weather impacted"
   - Calculate weather delay days
   - Weather impact on schedule analysis
   - Time extension justification report generation

5. Build the Permit Tracker (enhance src/pages/Permits.tsx):
   - Permit applications: type, jurisdiction, status, dates, fees
   - Inspection scheduling tied to permits
   - Permit conditions tracking
   - Auto-reminders for upcoming inspections
   - Permit timeline on the project schedule
```

---

## PROMPT 6.2 — Advanced Analytics & Project Health

```
OBJECTIVE: Build analytics that give construction executives insights they can't get anywhere else.

CONTEXT: ProjectHealth page exists. Various chart components exist.

REQUIREMENTS:
1. Build the Project Health Score algorithm:
   - Composite score: 0-100 based on weighted factors
   - Schedule Performance (25%): SPI, milestone achievement, critical path health
   - Cost Performance (25%): CPI, budget variance, change order rate
   - Quality (20%): punch list closure rate, rework rate, inspection pass rate
   - Safety (15%): TRIR trend, inspection completion, corrective action closure
   - Team Performance (15%): task completion rate, response times, collaboration metrics
   - Display as radial chart with each dimension
   - Trend over time (weekly health score)
   - Benchmark against similar projects (when data exists)

2. Build predictive analytics:
   - Completion date prediction: based on current velocity, what's the likely finish date?
   - Final cost prediction: based on burn rate and remaining work
   - Risk probability: likelihood of major delay based on current metrics
   - Show predictions with confidence intervals

3. Build the analytics dashboard:
   - Executive metrics: one-page summary for C-suite
   - Drill-down capability: click a metric → see the details
   - Trend charts for all KPIs over time
   - Comparison: plan vs actual for every metric
   - Export as PDF executive report

4. Build cross-project analytics (Portfolio level):
   - Compare project performance across the organization
   - Identify best-performing and at-risk projects
   - Resource utilization across projects
   - Financial rollup: total backlog, total billings, total profit margin
   - Map view with project health colors

5. Build automated reporting:
   - Weekly stakeholder email with key metrics
   - Monthly board report generation
   - Quarterly portfolio review pack
   - All auto-generated from real data, not manual input
```

---

## PROMPT 6.3 — Meetings & Action Items

```
OBJECTIVE: Make construction meetings productive by tracking every commitment.

CONTEXT: Meetings page exists with basic create/view. meeting_attendees and meeting_action_items tables exist.

REQUIREMENTS:
1. Build the Meeting Workflow:
   - Meeting types: OAC (Owner-Architect-Contractor), weekly coordination, safety, pre-construction, progress, closeout
   - Create meeting: type, date, time, location, agenda, attendees
   - Meeting agenda builder: ordered items with time allocation, presenter, attachments
   - Roll-forward: auto-include open items from last meeting of same type

2. Build Meeting Minutes:
   - During meeting: real-time note-taking template
   - Auto-capture from agenda structure
   - Record decisions made, action items assigned
   - Attendee sign-in sheet (digital)
   - Auto-generate formatted meeting minutes document

3. Build Action Item Tracking:
   - Each action item: description, assignee, due date, status, source meeting
   - Action items flow into the task system
   - Dashboard widget showing open action items per user
   - Overdue action item alerts
   - Track action item completion rate per meeting type

4. Build Meeting Analytics:
   - Meeting effectiveness: % of action items completed before next meeting
   - Average meeting duration vs planned
   - Action items generated per meeting trend
   - Top assignees by open action items

5. Calendar Integration:
   - Sync meetings to Google Calendar / Outlook
   - Include agenda and relevant documents in calendar invite
   - Meeting reminders with preparation checklist
```

---

# UTILITY PROMPTS — Run These Anytime

---

## PROMPT U.1 — Code Quality Sweep

```
OBJECTIVE: Run a comprehensive code quality audit and fix issues.

Run these checks and fix everything found:
1. `npx tsc --noEmit` — fix all TypeScript errors
2. `npx eslint . --fix` — fix all linting issues
3. Search for console.log statements and remove (except in dev-only code)
4. Search for TODO/FIXME/HACK comments — create a list, fix the easy ones
5. Search for any hardcoded API keys, passwords, or secrets — remove immediately
6. Search for `any` type usage — replace with proper types
7. Search for unused imports — remove them
8. Search for unused variables — remove them
9. Search for duplicate code blocks (>10 lines identical) — extract to shared functions
10. Verify all images have alt text
11. Verify all interactive elements are keyboard accessible
12. Verify all forms have proper labels
13. Run `npm audit` and fix critical vulnerabilities
```

---

## PROMPT U.2 — Database Migration Generator

```
When you need to add a new feature that requires database changes, follow this pattern:

1. Create a new migration file: supabase/migrations/00013_[feature_name].sql
2. Include:
   - CREATE TABLE with all columns, types, defaults, constraints
   - Foreign key relationships
   - Row-Level Security policies (enable RLS, create policies for select/insert/update/delete)
   - Indexes on columns that will be filtered or sorted
   - Triggers for updated_at timestamps
   - Comments on the table and columns for documentation

3. Pattern to follow:
   ```sql
   -- Description of what this migration adds
   CREATE TABLE IF NOT EXISTS public.[table_name] (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
     -- ... columns
     created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
     created_by UUID REFERENCES auth.users(id)
   );

   -- Enable RLS
   ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;

   -- RLS Policies
   CREATE POLICY "[table]_select" ON public.[table_name]
     FOR SELECT USING (
       project_id IN (
         SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
       )
     );

   -- Indexes
   CREATE INDEX idx_[table]_project ON public.[table_name](project_id);
   CREATE INDEX idx_[table]_status ON public.[table_name](status);

   -- Updated at trigger
   CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.[table_name]
     FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
   ```

4. After creating the migration, regenerate types: `npx supabase gen types typescript --local > src/types/database.ts`
5. Update src/types/entities.ts with the new entity types.
```

---

## PROMPT U.3 — New Feature Scaffold

```
When adding a new feature/page to SiteSync, scaffold it using this pattern:

1. Database: Create migration (follow U.2)
2. Types: Add to src/types/entities.ts
3. API: Create src/api/endpoints/[feature].ts with CRUD operations
4. Query Keys: Add to src/api/queryKeys.ts
5. Hooks: Add queries in src/hooks/queries/index.ts, mutations in src/hooks/mutations/index.ts
6. Page: Create src/pages/[Feature].tsx with:
   - Top bar with title, filters, actions
   - Data table or list view
   - Empty state when no data
   - Loading skeleton
   - Error boundary
7. Form: Create src/components/forms/[Feature]Form.tsx for create/edit
8. Routes: Add to App.tsx router configuration
9. Sidebar: Add navigation entry in src/components/Sidebar.tsx
10. Permissions: Add permission checks for all actions
11. Search: Add to global search index
12. Tests: Write at minimum:
    - Unit test for business logic
    - Component test for create flow
    - Component test for list rendering with filters
```

---

## PROMPT U.4 — Accessibility Audit

```
OBJECTIVE: Make SiteSync WCAG 2.1 AA compliant.

Run a comprehensive accessibility audit:
1. Every page must have a proper heading hierarchy (h1 → h2 → h3, no skips)
2. Every image must have meaningful alt text
3. Every form input must have an associated label
4. Every interactive element must be keyboard accessible (Tab, Enter, Escape, Arrow keys)
5. Focus management: modal open → focus first element, modal close → return focus
6. Color contrast: all text meets 4.5:1 ratio (3:1 for large text)
7. Status colors must not rely on color alone (add icons or text)
8. All animations respect prefers-reduced-motion (src/hooks/useReducedMotion.ts)
9. ARIA roles and labels on custom components (menus, tabs, dialogs, tooltips)
10. Screen reader announcements for dynamic content (live regions)
11. Skip-to-content link (already exists — verify it works)
12. Touch targets minimum 44x44px on mobile
13. Zoom to 200% without horizontal scroll
```

---

# EXECUTION ORDER

```
Phase 0 (Foundation):     0.1 → 0.2 → 0.3 → 0.4          [Week 1]
Phase 1 (Core):           1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7   [Weeks 2-4]
Phase 2 (AI):             2.1 → 2.2 → 2.3 → 2.4           [Weeks 3-5]
Phase 3 (Enterprise):     3.1 ∥ 3.2 → 3.3 → 3.4 → 3.5    [Weeks 4-6]
Phase 4 (Mobile):         4.1 ∥ 4.2                         [Week 5-6]
Phase 5 (Polish):         5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6   [Weeks 6-8]
Phase 6 (Moat):           6.1 → 6.2 → 6.3                  [Weeks 7-9]
Utility prompts:          Run U.1 after every 3 prompts. U.2-U.4 as needed.

∥ = can run in parallel
→ = must run sequentially (depends on previous)
```

---

*Total: 42 prompts. 6 phases. 9 weeks to category-defining product.*
*Every prompt produces shippable code. No placeholder. No hand-waving.*
*This is how you build a billion-dollar platform.*
