# SiteSync AI — V5 Definitive Master Build Prompt
## The Platform That Is Actually Miles Ahead

**Generated:** March 31, 2026
**Audit Scope:** Every single file. 211 TypeScript files, 48 Supabase migrations, 9 edge functions, 47 pages, 100+ components, 37+ hooks, 23 Zustand stores, 6 state machines, the full V1-V4 prompt history, and the live running application.

**Honest Rating of Current State: 5.5 / 10**

The skeleton is genuinely impressive. Real Supabase backend, auto-generated types, TanStack React Query, XState machines, Framer Motion, Capacitor — this is a serious engineering foundation. The score drops because:
- Core data flows are broken or faked in critical places
- Two conflicting auth systems exist simultaneously (module singleton + Zustand store)
- The sidebar has your name hardcoded: `Walker Benner`
- The project name is hardcoded: `Meridian Tower` with hardcoded `62%` and `154d left`
- `useProjectId()` hardcodes the seed UUID for every query, making multi-project impossible
- Budget and RFI legacy endpoints still hardcode `const PID = 'aaaaaaaa...'`
- 6+ pages mix real queries with hardcoded overlay data
- Auth has a dev bypass that can accidentally activate
- 0 PermissionGate components actually in use on any page
- AI features are 100% stubbed
- Mobile camera/photo capture is simulated, not real
- Offline sync queue never processes non-image files

---

## PASTE THIS SYSTEM CONTEXT BEFORE EVERY SESSION

```
You are the founding CTO of SiteSync AI — construction's first AI-native operating system. You are not building a tool. You are building the platform that makes Procore obsolete.

STACK: React 19 + TypeScript 5.9 + Vite 8 + Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) + TanStack React Query 5 + Zustand 5 + XState 5 + Framer Motion 12 + Radix UI + Capacitor 8 + Sonner + date-fns + Zod 4

CRITICAL ARCHITECTURE RULES — NEVER VIOLATE:
1. ZERO mock/hardcoded data in production code paths. No fake names, no hardcoded UUIDs, no `const mockItems = [...]`. Empty states show real UI, not fake data.
2. ALL data fetching: TanStack React Query hooks in src/hooks/queries/index.ts. ALL mutations: hooks in src/hooks/mutations/index.ts. Pages NEVER call Supabase directly.
3. ALL types: src/types/entities.ts (derived from database.ts). ZERO `as any`. Use generics and discriminated unions.
4. ALL colors, spacing, typography: src/styles/theme.ts tokens. ZERO raw hex values or magic numbers inline.
5. EVERY page: error boundary wrapper → loading skeleton (exact layout match) → empty state (illustration + CTA) → data → realtime subscription.
6. EVERY mutation: PermissionGate check → Zod validate → execute → invalidate ALL related query keys → audit trail entry → toast feedback → onError rollback.
7. EVERY form: Zod schema, field-level errors, submit loading state, auto-save drafts to IndexedDB via offlineDb.
8. EVERY list: search, filter, sort controls. Virtualization via @tanstack/react-virtual for 100+ items.
9. EVERY interactive element: aria-label, keyboard navigable, 44px minimum touch target for field use.
10. State machines (src/machines/) govern ALL workflows. UI reads machine state — UI never manages workflow transitions directly.
11. useProjectId() must read from route params or project context store, NOT a hardcoded UUID.
12. The active project name, progress, and days remaining shown in the Sidebar must come from the useProject() hook, not hardcoded strings.
13. The user name and role in the Sidebar must come from useAuth() and usePermissions(), not hardcoded "Walker Benner".
14. Auth: use the module-level singleton pattern in src/hooks/useAuth.ts exclusively. Remove the conflicting authStore.ts Zustand store to eliminate dual auth state.
15. Performance targets: FCP < 1.2s, LCP < 2.0s, TTI < 3s. Bundle < 250KB initial. Every page is lazy-loaded.
```

---

# PHASE 0: PRODUCTION BLOCKERS (Fix These First — Nothing Else Matters)

## PROMPT 0.1 — Fix The Broken Foundation (1 day)

```
TASK: Fix the 6 critical foundation bugs that make the app broken at its core.

BUG 1 — Hardcoded project ID in useProjectId.ts
File: src/hooks/useProjectId.ts
Problem: Always returns 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'. Multi-project is impossible.
Fix: Read from route params first (/projects/:projectId), then from projectContextStore, then fallback to the seed UUID for demo mode only.
New implementation:
  import { useParams } from 'react-router-dom'
  import { useProjectContextStore } from '../stores'
  const DEMO_PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  export function useProjectId(): string | undefined {
    const { projectId: routeProjectId } = useParams()
    const { activeProjectId } = useProjectContextStore()
    return routeProjectId || activeProjectId || (import.meta.env.DEV ? DEMO_PROJECT_ID : undefined)
  }

BUG 2 — Hardcoded PID in legacy API endpoints
Files: src/api/endpoints/budget.ts, src/api/endpoints/rfis.ts, and any other endpoint file with `const PID = 'aaaaaaaa...'`
Problem: These endpoints ignore the projectId parameter and always query the seed project.
Fix: Remove the PID constant. All functions must accept projectId as a parameter and use it in the Supabase query. Update all callers to pass the projectId from useProjectId().

BUG 3 — Dual auth systems
Files: src/stores/authStore.ts vs src/hooks/useAuth.ts
Problem: Two conflicting auth implementations. authStore.ts is a Zustand store with its own session/user state. useAuth.ts is a module-level singleton. They can get out of sync.
Fix: Keep useAuth.ts (module-level singleton with useSyncExternalStore — this is the correct pattern). Delete authStore.ts. Update any component that imports from authStore to use useAuth() instead.

BUG 4 — Hardcoded user and project in Sidebar
File: src/components/Sidebar.tsx
Problem: "Walker Benner" is hardcoded on line ~278. "Meridian Tower", "62% complete", "154d left" are hardcoded in the project context section.
Fix:
  - Replace "Walker Benner" with: const { user } = useAuth(); const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  - Replace hardcoded project info with: const projectId = useProjectId(); const { data: project } = useProject(projectId); const progress = computed from useSchedulePhases(); const daysLeft = computed from project.target_completion
  - Replace "WB" initials with dynamic computation from user name

BUG 5 — Budget page uses old-style useQuery wrapper that loses projectId
File: src/pages/Budget.tsx line 37-38
Problem: `useQuery('costData', getCostData)` calls getCostData with no arguments. But getCostData needs a projectId.
Fix: Replace the custom useQuery wrapper call with the direct TanStack hook pattern used elsewhere:
  const projectId = useProjectId()
  const { data: costData, isPending: costLoading } = useTanstackQuery({
    queryKey: queryKeys.budget(projectId),
    queryFn: () => getCostData(projectId!),
    enabled: !!projectId,
  })
  Do the same for getProject call on the same page.

BUG 6 — Dev bypass in ProtectedRoute can silently activate
File: src/components/auth/ProtectedRoute.tsx
Problem: isDevBypassActive() has multiple conditions but they can fail silently. If VITE_SUPABASE_URL is not set but VITE_DEV_BYPASS is not explicitly 'true', the app falls through to auth check with no Supabase, causing infinite loading.
Fix: Explicitly handle the "no Supabase configured" case: if DEV mode AND no VITE_SUPABASE_URL AND VITE_DEV_BYPASS !== 'true', show a clear "Configure Supabase or set VITE_DEV_BYPASS=true" error screen, not a spinner.

Run `npm run build` after each fix and confirm zero TypeScript errors before moving to the next bug.
```

---

## PROMPT 0.2 — Kill Every Last Piece of Hardcoded Data (1 day)

```
TASK: Find and destroy ALL mock/hardcoded data in page components. This is a zero-tolerance audit.

Search the codebase for these patterns and eliminate them all:
- `const mock` or `const fake` or `const stub` arrays
- Hardcoded strings like 'Turner Construction', 'James Rodriguez', 'Meridian Tower' in JSX
- `commentCounts`, `drawingRefs`, `ballInCourt` objects defined inline in pages
- Photo URL placeholders like '/api/placeholder/' or 'via.placeholder.com'
- Hardcoded weather strings
- Any `|| 'fallback name'` that substitutes real data with a fake name

SPECIFIC FILES TO FIX:

1. src/pages/RFIs.tsx
   Remove: Any hardcoded commentCounts record, drawingRefs record, ballInCourt record
   Replace: These fields should come from the RFI record itself (add columns to DB if missing) or be derived from related data via JOIN in the Supabase query
   The useRFIs hook should select: rfis.*, count(rfi_responses) as response_count

2. src/pages/Submittals.tsx
   Remove: mockDescriptions, reviewTimelines, specSections, reviewCycles, leadTimes objects
   Replace: These are columns that should exist on the submittals table. Add them to the query via useSubmittals hook. If columns don't exist in the schema, add a migration.

3. src/pages/PunchList.tsx
   Remove: mockComments arrays with fake team conversation data
   Replace: Comments should be fetched from a punch_item_comments table via a separate query hook usePunchItemComments(itemId). If that table doesn't exist, create a migration.

4. src/pages/DailyLog.tsx
   Remove: Stub photo URLs array. Static weather data array.
   Replace: Photos come from field_captures table filtered by daily_log_id. Weather comes from the weather column on the daily_log record itself.

5. src/pages/FieldCapture.tsx
   Remove: Hardcoded "AI Analysis: 85%" and any simulated capture entries
   Replace: Real captures from the field_captures table via useFieldCaptures(projectId) hook. AI analysis score comes from the ai_confidence column on the record.

6. src/data/aiAnnotations.ts
   This entire file is mock data. Do NOT delete it — instead, wrap all exports in a isDemoMode check:
   export function getAnnotationsForEntity(entityType: string, entityId: string) {
     if (!import.meta.env.VITE_DEMO_MODE) return []
     // existing mock data below
   }
   This makes AI annotations opt-in for demos only, not always-on in production.

7. src/pages/AICopilot.tsx
   The conversationHistory should NOT be initialized with mock messages. Initialize as empty [].
   Persistence: on mount, load conversation from localStorage key `sitesync_copilot_${projectId}`.
   On message add, save to localStorage.

After removing mock data, every list must show a proper EmptyState component when data is empty.
EmptyState for RFIs: icon=HelpCircle, title="No RFIs yet", body="Submit your first request for information to get started.", action={<Btn variant="primary">New RFI</Btn>}
Do the same for Submittals, PunchList, DailyLog, FieldCapture.

Confirm: `grep -r "mockComments\|mockDescriptions\|reviewTimelines\|ballInCourt\|commentCounts\|via.placeholder" src/pages/` returns zero results.
```

---

# PHASE 1: EVERY PAGE MUST ACTUALLY WORK (Week 1-2)

## PROMPT 1.1 — Wire Every Page To Real Data

```
TASK: Audit every page in src/pages/. For each page, verify the data flow is: useProjectId() → React Query hook → real Supabase table → render. Fix any page that deviates.

Go through these pages in order:

PAGES THAT NEED DATA WIRING (confirmed from audit):

1. src/pages/Portfolio.tsx
   Should show all projects from the projects table for the current user/company.
   Use: const { data: projects } = useProjects() — add this hook if missing.
   Query: supabase.from('projects').select('*, budget_items(original_amount, actual_amount)').order('created_at', { ascending: false })
   Show: project name, contract value, progress %, days remaining, status badge, last activity

2. src/pages/ProjectHealth.tsx
   Should compute health scores from real data across: schedule variance, budget variance, open RFI count, overdue punch items, safety incidents last 30 days.
   Wire in: useSchedulePhases, useBudgetItems, useRFIs, usePunchItems — all already exist.
   Compute health score: a weighted formula across these metrics. Show red/amber/green per category.

3. src/pages/Safety.tsx
   Should query the safety_incidents table.
   Add hook: useSafetyIncidents(projectId) — query safety_incidents table, order by occurred_at desc.
   Show: incident list, severity breakdown chart (recharts PieChart), days since last incident counter.

4. src/pages/Estimating.tsx
   Should query estimate_items table (exists in migration 00018).
   Add hook: useEstimateItems(projectId).
   Show: CSI division breakdown, labor vs material split, markup calculations.

5. src/pages/Procurement.tsx
   Should query purchase_orders table.
   Add hook: usePurchaseOrders(projectId).
   Show: PO list, vendor, amount, status, delivery date.

6. src/pages/Equipment.tsx
   Should query equipment table.
   Add hook: useEquipment(projectId).
   Show: equipment list, status (active/idle/maintenance), operator, location.

7. src/pages/Permits.tsx
   Should query permits table.
   Add hook: usePermits(projectId).
   Show: permit number, type, authority, status, expiry date, inspection schedule.

8. src/pages/Warranties.tsx
   Should query warranties table.
   Add hook: useWarranties(projectId).
   Show: system/equipment covered, warranty provider, start/end dates, contact info.

9. src/pages/Financials.tsx
   Should compute from budget_items + change_orders + payment_applications.
   Show: cash flow projection, cost-to-complete, projected final cost, variance analysis.

10. src/pages/PaymentApplications.tsx
    Should query payment_applications table.
    Add hook: usePaymentApplications(projectId).
    Show: pay app number, period, scheduled value, work completed, % complete, net payment, status.

11. src/pages/Insurance.tsx
    Should query insurance_policies table (migration 00048 adds COI tracking).
    Add hook: useInsurancePolicies(projectId).
    Show: carrier, policy number, type, coverage amount, expiry, status.

12. src/pages/Workforce.tsx
    Should query crew_members table joined with crews.
    Show: headcount by trade, hours this week vs baseline, productivity index.

13. src/pages/Sustainability.tsx
    Should query sustainability_metrics table (migration 00003 or later).
    Show: LEED points accumulated, waste diversion rate, embodied carbon, energy use.

14. src/pages/Benchmarks.tsx
    This is platform intelligence — show anonymized cross-project benchmarks.
    For now: use the project's own historical data to show cost/SF, schedule performance index, RFI rate.
    Do NOT use hardcoded industry averages unless they come from a benchmarks table.

15. src/pages/Reports.tsx
    Each report button should trigger real data export.
    Executive Summary: aggregate from project + budget + schedule + rfis + submittals.
    Safety Report: aggregate from safety_incidents.
    Budget Report: from budget_items + change_orders.
    Use the existing exportXlsx utility in src/lib/exportXlsx.ts.

For EVERY page:
- Wrap in ErrorBoundary (already in App.tsx but each page should also handle its own query errors)
- Show Skeleton components while loading (match the layout exactly — same grid, same heights)
- Show EmptyState when no data
- Show error message + retry button on query error

After wiring each page, run it against the seed database and confirm real data appears.
```

---

## PROMPT 1.2 — Forms That Actually Work

```
TASK: Every "New X" button must open a working modal form that creates a real database record. Currently most modals are missing or broken.

FORMS TO BUILD/FIX (in priority order):

1. New Submittal Modal (MISSING)
   File to create: src/components/forms/CreateSubmittalModal.tsx
   Fields: submittal_number (auto), title, spec_section, trade, assigned_to (select from directory), due_date, description
   Validation schema: already in src/components/forms/schemas.ts (submittalSchema)
   On submit: useCreateSubmittal() mutation → invalidate ['submittals', projectId] → toast success → close modal
   Trigger: "New Submittal" button in Submittals.tsx

2. Edit Punch Item Modal (MISSING)
   File to create: src/components/forms/EditPunchItemModal.tsx
   Fields: title (editable), status (select), assignee (select), due_date, location, trade, description
   On submit: useUpdatePunchItem() mutation
   Trigger: clicking a punch item row in PunchList.tsx

3. New Change Order Modal (EXISTS but broken)
   File: src/components/forms/CreateChangeOrderModal.tsx
   Fix: The form does not pass projectId to the mutation. Add useProjectId() inside the modal.
   Fix: The 'type' field (co/sco/nco) is not being sent to the DB — it's being dropped somewhere.
   Fix: After successful creation, invalidate BOTH ['change_orders', projectId] AND ['budget', projectId].

4. New Daily Log Entry (MISSING proper form)
   The DailyLog page creates entries but the form is incomplete.
   Add fields: weather_condition (select: clear/cloudy/rain/snow/wind), temperature (number), wind_speed (number), crew_count (number), visitor_log (textarea), work_performed (textarea, required), issues_encountered (textarea), photos (file upload via Uppy).

5. New Meeting Modal (MISSING)
   File to create: src/components/forms/CreateMeetingModal.tsx
   Fields: title, meeting_type (select: OAC/subcontractor/safety/kickoff/other), date, time, location, attendees (multi-select from directory), agenda (rich text via Tiptap)
   On submit: useCreateMeeting() mutation

6. New Equipment Record (MISSING)
   File to create: src/components/forms/CreateEquipmentModal.tsx
   Fields: name, type, make, model, serial_number, daily_rate, status (select), assigned_operator (select from crews)

FOR ALL FORMS:
- Implement auto-save to IndexedDB on every field change: offlineDb.saveDraft(entityType, formState)
- On mount, check for a saved draft and restore it with a banner: "You have an unsaved draft from [time]"
- Show field-level validation errors below each field (not just a generic toast)
- Disable submit button while mutation isPending
- Show a loading spinner inside the submit button while pending
- Close modal on success
- Keep modal open and show error on failure
```

---

## PROMPT 1.3 — PermissionGate Everything

```
TASK: Wrap every create, edit, delete, and approve action in the correct PermissionGate. Currently ZERO action buttons use PermissionGate despite the component being fully built.

The permission system is in src/hooks/usePermissions.ts. The gate component is src/components/auth/PermissionGate.tsx.

Permission format: '{entity}.{action}'
Valid permissions (from usePermissions.ts MODULE_PERMISSIONS):
  rfis.create, rfis.edit, rfis.respond, rfis.close
  submittals.create, submittals.edit, submittals.approve, submittals.reject
  tasks.create, tasks.edit, tasks.delete
  daily_logs.create, daily_logs.submit, daily_logs.approve, daily_logs.reject
  punch_list.create, punch_list.edit, punch_list.complete
  change_orders.create, change_orders.edit, change_orders.approve, change_orders.reject, change_orders.void
  drawings.upload, drawings.supersede
  budget.edit, budget.approve
  project.settings, project.export

GO THROUGH EVERY PAGE and wrap action buttons:

RFIs.tsx:
  <PermissionGate permission="rfis.create"><Btn>New RFI</Btn></PermissionGate>
  <PermissionGate permission="rfis.respond"><Btn>Submit Response</Btn></PermissionGate>
  <PermissionGate permission="rfis.close"><Btn>Close RFI</Btn></PermissionGate>

Submittals.tsx:
  <PermissionGate permission="submittals.create"><Btn>New Submittal</Btn></PermissionGate>
  <PermissionGate permission="submittals.approve"><Btn>Approve</Btn></PermissionGate>
  <PermissionGate permission="submittals.reject"><Btn>Revise & Resubmit</Btn></PermissionGate>

PunchList.tsx:
  <PermissionGate permission="punch_list.create"><Btn>New Item</Btn></PermissionGate>
  <PermissionGate permission="punch_list.complete"><Btn>Mark Complete</Btn></PermissionGate>

Budget.tsx:
  <PermissionGate permission="change_orders.approve">...Approve CO button...</PermissionGate>
  <PermissionGate permission="budget.edit">...Edit budget line button...</PermissionGate>

DailyLog.tsx:
  <PermissionGate permission="daily_logs.create"><Btn>New Entry</Btn></PermissionGate>
  <PermissionGate permission="daily_logs.submit"><Btn>Submit for Approval</Btn></PermissionGate>
  <PermissionGate permission="daily_logs.approve"><Btn>Approve</Btn></PermissionGate>

ChangeOrders.tsx:
  <PermissionGate permission="change_orders.create"><Btn>New CO</Btn></PermissionGate>
  <PermissionGate permission="change_orders.approve"><Btn>Approve</Btn></PermissionGate>
  <PermissionGate permission="change_orders.void"><Btn>Void</Btn></PermissionGate>

Tasks.tsx:
  <PermissionGate permission="tasks.create"><Btn>New Task</Btn></PermissionGate>
  <PermissionGate permission="tasks.delete"><Btn>Delete</Btn></PermissionGate>

The PermissionGate component renders null (hiding the button entirely) when the user lacks permission — this is correct. Do NOT show disabled buttons for missing permissions; hide them.
```

---

# PHASE 2: AI THAT ACTUALLY WORKS (Week 2-3)

## PROMPT 2.1 — Real AI Copilot

```
TASK: Replace the stubbed AI Copilot with a real streaming AI integration.

The AI SDK is already installed: @ai-sdk/anthropic, @ai-sdk/react, ai.
The edge function stub is at supabase/functions/ai-chat/.

BACKEND — Fix the edge function (supabase/functions/ai-chat/index.ts):
1. Authenticate the request: extract the JWT from Authorization header, verify with Supabase auth. NEVER use service role key for user-initiated operations.
2. Load project context: fetch the project, recent RFIs, budget summary, open tasks, and schedule phases for the projectId from the request body.
3. Build the system prompt:
   You are SiteSync AI, an expert construction project management assistant.
   Current project: {project.name}, {project.city} {project.state}
   Contract value: ${project.contract_value}M | Progress: {overallProgress}% | Days remaining: {daysRemaining}
   Open RFIs: {openRfiCount} | Active tasks: {activeTaskCount} | Budget spent: {budgetPercent}%
   Today: {currentDate}

   Answer questions about this project. Be direct and field-appropriate.
   When you reference specific items (RFI-007, Task X, etc.), format them as [RFI-007] so the UI can render them as clickable links.
4. Stream the response using Anthropic claude-sonnet-4-6 with max_tokens: 1024.
5. Rate limit: 20 requests per user per minute (use the existing rateLimiter utility).
6. Sanitize user input: strip HTML, limit to 2000 characters.

FRONTEND — Fix src/pages/AICopilot.tsx:
1. Replace mock message state with useChat() from @ai-sdk/react:
   const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
     api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
     headers: { Authorization: `Bearer ${session?.access_token}` },
     body: { projectId },
   })
2. Persist messages to localStorage: `sitesync_copilot_${projectId}`. Load on mount.
3. Render [RFI-007] style references as clickable chips that navigate to that item.
4. Show a typing indicator (animated dots) while isLoading.
5. Show an error state with retry button if the request fails.
6. Add suggested prompts for first-time use:
   "What are the top risks on this project right now?"
   "Summarize all open RFIs and their ball-in-court status"
   "Which budget divisions are at risk of overrun?"
   "What critical path tasks are overdue?"
7. The send button must be disabled when input is empty or when isLoading.
8. Pressing Enter submits (Shift+Enter adds newline).
9. Auto-scroll to bottom on new message.
10. Show message timestamps.
```

---

## PROMPT 2.2 — AI Agents Page

```
TASK: Make the AI Agents page (src/pages/AIAgents.tsx) actually functional.

The database tables ai_agents and ai_agent_actions exist (from migration 00032 or similar).
The agents schema has: id, name, description, status (active/paused/idle), last_run_at, action_count.

BACKEND — Create edge function supabase/functions/agent-run/index.ts:
1. Accept: { agentId, projectId, parameters }
2. Auth: verify JWT, check user has 'ai.run_agent' permission
3. Load agent config from ai_agents table
4. Based on agent type, execute the appropriate action:
   - schedule_optimizer: fetch schedule phases, find critical path issues, suggest resequencing
   - rfi_drafter: given a question, draft an RFI with proper fields
   - budget_auditor: scan budget_items for anomalies (cost codes mismatched, unusual variances)
   - safety_monitor: scan recent daily logs for safety keywords
5. Insert result into ai_agent_actions table with status='pending_review'
6. Return the action record for the UI to display

FRONTEND — Rewrite src/pages/AIAgents.tsx:
1. Fetch agents via: const { data: agents } = useQuery({ queryKey: ['ai_agents', projectId], queryFn: () => supabase.from('ai_agents').select('*, ai_agent_actions(count)').eq('project_id', projectId) })
2. Fetch pending actions: useQuery for ai_agent_actions where applied=false, ordered by created_at desc
3. Each agent card shows: name, description, status badge, last run time, pending action count
4. "Run Now" button calls the agent-run edge function (show loading spinner, disable button while running)
5. Pending Actions section: for each action, show what the agent proposes to do with Apply/Dismiss buttons
6. Apply: mark applied=true, then execute the actual change (e.g., update the schedule phase)
7. Dismiss: mark status='dismissed'
8. Show a real-time feed of agent activity using Supabase Realtime subscription on ai_agent_actions

This implements "human in the loop" AI — agents propose, humans approve. Never auto-execute.
```

---

# PHASE 3: FIELD-FIRST MOBILE (Week 3)

## PROMPT 3.1 — Real Camera and Photo Capture

```
TASK: Replace simulated camera capture with real Capacitor camera integration.

File: src/pages/FieldCapture.tsx
The Capacitor Camera plugin is installed: @capacitor/camera

CURRENT PROBLEM: The capture flow is simulated. Photos are fake placeholder URLs.

FIX:
1. Import Camera from @capacitor/camera
2. The "Capture Photo" button should call:
   import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

   const takePhoto = async () => {
     try {
       const photo = await Camera.getPhoto({
         resultType: CameraResultType.DataUrl,
         source: CameraSource.Camera,
         quality: 85,
         width: 1920,
         allowEditing: false,
         saveToGallery: true,
       })
       // photo.dataUrl is the image
       await uploadAndSave(photo.dataUrl!)
     } catch (err) {
       if ((err as Error).message !== 'User cancelled photos app') {
         toast.error('Camera access failed. Check app permissions.')
       }
     }
   }

3. Upload via src/lib/storage.ts (uploadFile function — already exists):
   const { url } = await uploadFile(dataUrlToBlob(dataUrl), `field-captures/${projectId}/${Date.now()}.jpg`, 'field-captures')

4. Save to database:
   await supabase.from('field_captures').insert({
     project_id: projectId,
     photo_url: url,
     captured_by: user.id,
     captured_at: new Date().toISOString(),
     latitude: location?.coords.latitude,
     longitude: location?.coords.longitude,
     notes: captureNotes,
   })

5. After saving, invalidate ['field_captures', projectId] to refresh the list.

6. On web (not Capacitor): fall back to a file input:
   <input type="file" accept="image/*" capture="environment" />

7. Show photo preview immediately after capture (optimistic update).

8. Add geolocation: use @capacitor/geolocation to tag each photo with GPS coordinates. Show a small map pin icon on photos that have location data.

9. The photo grid should display real uploaded photos from the field_captures table, not placeholder images.
```

---

## PROMPT 3.2 — Offline First That Actually Works

```
TASK: Make offline support real. Currently the offline layer is scaffolded but mutations are not queued for non-image entities.

File: src/lib/offlineDb.ts (Dexie)
File: src/lib/syncManager.ts
File: src/hooks/useOfflineMutation.ts

CURRENT PROBLEMS:
1. The Dexie offline DB does not have tables for meetings, field_captures (fixed above), or equipment
2. The sync queue processes but never calls the actual mutation functions for queued RFIs/submittals/tasks
3. Conflict resolution in the ConflictResolutionModal just overwrites the server version — this should be a true diff UI

FIX 1 — Add missing Dexie tables to offlineDb.ts:
  meetings: '++id, project_id, synced, created_at',
  field_captures: '++id, project_id, photo_url, synced, created_at',
  equipment: '++id, project_id, synced, updated_at',
  daily_log_entries: '++id, project_id, log_date, synced, updated_at',

FIX 2 — Wire useOfflineMutation.ts to all mutation hooks:
  In src/hooks/mutations/index.ts, every mutation that creates/updates an entity should:
  1. First try the Supabase mutation (if online)
  2. If offline (navigator.onLine === false OR fetch throws NetworkError):
     - Save to the appropriate Dexie table with synced=false
     - Show a toast: "Saved locally. Will sync when connected."
     - Return an optimistic result so the UI updates immediately
  3. The syncManager.sync() function should:
     - Query all Dexie tables for rows where synced=false
     - For each row, execute the appropriate Supabase insert/update
     - On success: mark synced=true, invalidate the React Query cache
     - On conflict (409/23505): add to conflicts list for ConflictResolutionModal

FIX 3 — Real conflict resolution UI in ConflictResolutionModal:
  Show side-by-side diff: "Your version" vs "Server version"
  Highlight changed fields in orange
  Three options: "Keep Mine", "Keep Server's", "Merge" (opens a form with both values pre-filled)

FIX 4 — Service worker background sync:
  When the app comes back online, the SW should fire the 'background-sync-complete' event
  App.tsx already listens for this event (line 213-217) and calls syncManager.refreshCounts()
  Make sure the SW (public/sw.js or vite-pwa generated) actually registers a sync event and calls the sync endpoint
```

---

# PHASE 4: ENTERPRISE GRADE (Week 4)

## PROMPT 4.1 — Security Hardening

```
TASK: Fix every security vulnerability identified in the V4 audit.

ISSUE 1 — Missing CSP headers
File: supabase/functions/_shared/headers.ts (create if not exists)
Add: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
Every edge function response must include these headers.

ISSUE 2 — PDF.js RCE vulnerability
File: package.json — pdfjs-dist is at ^3.11.174
Action: Update to latest pdfjs-dist (4.x). Run: npm install pdfjs-dist@latest
Then fix any breaking API changes in the PDF viewer components.

ISSUE 3 — Service role key exposure in edge functions
Search: grep -r "SUPABASE_SERVICE_ROLE_KEY" supabase/functions/
For any function that uses the service role key for user-initiated operations:
Replace with: const authHeader = req.headers.get('Authorization')
  const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
The service role key is ONLY acceptable in: scheduled functions, admin-triggered migrations, background jobs that run server-side with no user context.

ISSUE 4 — Prompt injection in AI chat
File: supabase/functions/ai-chat/index.ts
Before passing user message to Claude:
  function sanitizeMessage(msg: string): string {
    return msg
      .replace(/\bsystem:\b/gi, '') // strip attempts to inject system role
      .replace(/\bignore (previous|all) instructions?\b/gi, '')
      .replace(/<[^>]*>/g, '') // strip HTML tags
      .slice(0, 2000) // hard limit
  }

ISSUE 5 — Missing input validation on edge functions
Every edge function must:
1. Parse and validate the request body with Zod before using any field
2. Return 400 with a clear error if validation fails
3. Never pass unsanitized user input to a database query

ISSUE 6 — RLS gaps on UPDATE and DELETE
Run this query to find tables missing UPDATE/DELETE policies:
  select tablename from pg_policies where cmd = 'SELECT'
  except select tablename from pg_policies where cmd = 'UPDATE'
For each gap, add a migration that creates proper RLS policies:
  CREATE POLICY "Users can update own project records" ON {table}
  FOR UPDATE USING (project_id IN (SELECT id FROM projects WHERE company_id = auth.jwt()->>'company_id'))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE company_id = auth.jwt()->>'company_id'));
```

---

## PROMPT 4.2 — Performance That Matches Linear

```
TASK: Hit the performance targets: FCP < 1.2s, LCP < 2.0s, bundle < 250KB initial.

ISSUE 1 — Bundle size
Run: npm run build:analyze to see the treemap.
Expected large offenders: framer-motion (imported everywhere), recharts, pdfjs, three.js
Fix: All chart components import directly (recharts/es/...) not the barrel export.
Fix: three.js and web-ifc are only loaded on the BIM/digital twin page — already lazy loaded in App.tsx but confirm the imports in those page components don't accidentally import at the top level.
Fix: pdfjs-dist loads the entire PDF.js — use dynamic import inside the drawing viewer component only.

ISSUE 2 — No virtualization on long lists
Files: Tasks.tsx (can have 500+ tasks), Drawings.tsx, Directory.tsx, Activity.tsx
Fix: Wrap the table body in @tanstack/react-virtual:
  import { useVirtualizer } from '@tanstack/react-virtual'
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // row height in px
    overscan: 5,
  })
  // Render only rowVirtualizer.getVirtualItems() in the DOM

ISSUE 3 — Missing React.memo on frequently re-rendered components
Every sidebar nav item re-renders on any store change.
Wrap: export const SidebarNavItem = React.memo(({ item, isActive, onNavigate }) => ...)
Same for: TableRow, MetricBox, Tag, StatusTag, Avatar — all leaf components in Primitives.tsx.
Add React.memo wrapping to each.

ISSUE 4 — Images not optimized
Field capture photos are uploaded as full-resolution JPEGs and displayed at thumbnail size.
Use browser-image-compression (already installed) to compress before upload:
  import imageCompression from 'browser-image-compression'
  const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true })

ISSUE 5 — No pagination on any list
Every list query fetches ALL records with no limit.
Fix: Add .range(page * pageSize, (page + 1) * pageSize - 1) to every list query.
Add pagination controls (prev/next buttons + page indicator) to every table.
Or use TanStack Query's useInfiniteQuery for scroll-based loading.
```

---

## PROMPT 4.3 — Real-Time Collaboration Indicators

```
TASK: Make the presence system visible and functional. Currently usePresence() runs in App.tsx but no UI shows who else is on the page.

ALREADY EXISTS:
- src/hooks/useRealtimeSubscription.ts (subscribes to DB changes)
- src/hooks/usePresence() (tracks which page each user is on via Supabase Realtime presence)
- src/components/collaboration/PresenceBar.tsx
- src/components/shared/PresenceAvatars.tsx
- src/components/collaboration/SidebarPresenceDot (used in Sidebar)

WHAT'S MISSING:
1. SidebarPresenceDot is rendered in every nav item but never actually shows a dot because the presence store is not reading from the Supabase Realtime presence channel.

Fix src/components/collaboration/PresenceBar.tsx:
  const { presenceState } = usePresenceChannel(`project:${projectId}`)
  // presenceState is a map of userId → { page, name, initials, color }
  // Show a small avatar cluster for users currently on the same page

Fix SidebarPresenceDot: Read from the presence store to count users on each page and show a colored dot with count.

2. The RFI detail panel (and Submittals, Tasks) should show "3 people viewing" when other users have the same record open.

Add to every DetailPanel:
  const viewers = usePresenceViewers(`rfi:${selectedRfi?.id}`)
  // Show: <PresenceAvatars users={viewers} /> near the panel title

3. Realtime list updates: when a new RFI is created by another user, the RFI list should update without a page refresh.

This ALREADY works if the useRealtimeSubscription hook is running AND the query keys are correct.
Verify: in useRealtimeSubscription.ts, confirm it invalidates ['rfis', projectId] on INSERT/UPDATE/DELETE to the rfis table.
If not: add the invalidation.

4. Edit lock: when a user opens a detail panel for editing, lock that record for other users.
Show EditingLockBanner (src/components/ui/EditingLockBanner.tsx — already exists) when another user is editing the same record.
Use the presence channel: broadcast { type: 'editing', recordId: rfi.id } when editing starts. Clear on close.
```

---

# PHASE 5: WORLD-CLASS POLISH (Week 4-5)

## PROMPT 5.1 — Design That Beats Linear

```
TASK: Elevate every page to world-class visual quality. The design system is solid — the execution needs polish.

GLOBAL FIXES:

1. Hover states on ALL interactive elements
   Every table row, card, list item must have:
   onMouseEnter: backgroundColor → colors.surfaceHover
   onMouseLeave: backgroundColor → 'transparent' or original
   Transition: 'background-color 0.1s ease'
   This is currently inconsistent across pages.

2. Focus rings for keyboard navigation
   Every button, link, input must show a visible focus ring on keyboard focus:
   ':focus-visible': { outline: `2px solid ${colors.primaryOrange}`, outlineOffset: '2px' }
   This is an accessibility requirement AND feels polished.

3. Loading skeletons must match content layout
   The current skeleton in Budget.tsx shows 4 boxes then content renders as an entirely different layout.
   Every skeleton must be a pixel-accurate placeholder for the exact content that will load.

4. Empty states with personality
   Every empty state must have:
   - A relevant icon (large, ~48px, colors.textTertiary)
   - A bold title: "No RFIs open"
   - A helpful subtitle: "When questions come up in the field, track them here. Avg response time is 3 days."
   - A primary CTA button (if the user has create permission)
   This makes the app feel alive even with no data.

5. Page headers are inconsistent
   Every page must use the same header pattern:
   <PageContainer
     title="RFIs"
     subtitle="{openCount} open · {totalCount} total"
     breadcrumb={[{ label: 'Project', href: '/dashboard' }, { label: 'RFIs' }]}
     actions={<PermissionGate permission="rfis.create"><Btn variant="primary" icon={<Plus size={14} />}>New RFI</Btn></PermissionGate>}
   >

6. Status tags must be consistent
   The StatusTag component exists but is used inconsistently. Some pages use raw colored spans.
   Replace ALL inline status styling with <StatusTag status={item.status} />.
   Make sure StatusTag covers all status values: open, closed, approved, rejected, pending, in_progress, draft, submitted, under_review, revise_resubmit, void.

7. Number formatting
   All currency values must use the fmt() helper from Budget.tsx or a shared utility.
   Create: src/utils/format.ts with:
     formatCurrency(n: number): string — "$1.2M" / "$450K" / "$12,000"
     formatDate(date: string): string — "Mar 31, 2026"
     formatRelativeTime(date: string): string — "2 hours ago"
     formatDuration(days: number): string — "14 days" / "2 weeks" / "3 months"
   Replace ALL inline formatting logic across every page with these utilities.

8. Micro-animations on data updates
   When a metric value changes (e.g., a new RFI is submitted and the count updates):
   Use the existing useAnimatedNumber hook to animate the number transition.
   Apply this to: Dashboard KPIs, all MetricBox values, sidebar project progress.

9. Toast messages must be specific
   Replace generic "Created successfully" with specific messages:
   RFI created: "RFI-{number} submitted · Awaiting response from {assignee}"
   CO approved: "CO-{number} approved · Contract value updated to {newTotal}"
   Daily log submitted: "Daily log for {date} submitted · {supervisorName} will review"
```

---

## PROMPT 5.2 — Make The Dashboard A Real Command Center

```
TASK: The Dashboard should be the most powerful screen in the app. Currently it shows KPIs and then delegates to DashboardGrid. Make it genuinely useful.

CURRENT STATE: Dashboard.tsx fetches real data and shows animated KPIs, then renders <DashboardGrid />. The DashboardGrid widget components need to be inspected — most likely they have hardcoded data inside.

AUDIT EVERY WIDGET IN src/components/dashboard/:
For each widget file, verify it uses real React Query hooks, not hardcoded data.
Fix any widget that has hardcoded data using the same pattern as the Dashboard page.

ADD THESE WIDGETS (if not already present and wired to real data):

1. Critical Path Widget
   Show: The 3 tasks on the critical path that are currently overdue or at risk.
   Data: useSchedulePhases() filtered for tasks where is_critical=true AND percent_complete < 100 AND due_date < now()
   Display: compact list with task name, phase, days overdue, responsible party

2. Open Items Summary Widget
   Show: Count of open RFIs, open submittals (pending approval), open punch items, overdue tasks
   Data: useRFIs, useSubmittals, usePunchItems, useTasks — all filtered for open status
   Display: 4 clickable count badges that navigate to the respective pages

3. Budget Burn Rate Widget
   Show: Sparkline of daily spend for the last 30 days
   Data: Aggregate from budget_items actual_amount changes — or from daily_logs if that data isn't available
   Display: recharts AreaChart, thin and minimal, with projected overrun/underrun annotation

4. Weather Widget
   Show: Today's weather from the existing weather utility (src/lib/weather.ts)
   Display: Icon, temp, conditions, wind. Auto-refresh every 30 minutes.
   If weather fails: hide widget gracefully, do not show error

5. Recent Activity Widget
   Show: Last 10 activity feed items from the project
   Data: useActivityFeed(projectId) hook — query activity_feed table
   Display: compact list, icon per type, user name, time ago, clickable to navigate to item

6. AI Daily Brief Widget
   Show: 3 AI-generated bullets summarizing overnight project status
   Data: Call the ai-chat edge function on mount with a structured prompt for a project brief
   Cache for 1 hour (staleTime: 1000 * 60 * 60)
   Show skeleton while loading, fallback text if AI call fails
```

---

# PHASE 6: TEST COVERAGE TO 80%

## PROMPT 6.1 — Test Suite

```
TASK: Bring test coverage from ~5% to 80% on critical paths.

PRIORITY ORDER:
1. Auth flow (login, session refresh, logout, protected routes)
2. Permission system (role-based access, PermissionGate rendering)
3. RFI creation and status workflow
4. Budget calculation logic (fmt(), contingency drawdown, approved total)
5. Change order state machine transitions
6. Form validation (rfiSchema, submittalSchema, etc.)
7. useProjectId hook
8. Error handling (ApiError hierarchy, transformSupabaseError)

FOR EACH TEST:
- Use Vitest + @testing-library/react
- Mock Supabase calls via vi.mock('../lib/supabase')
- Test the component, not the implementation
- Every test should assert what the USER sees, not internal state

EXAMPLE TEMPLATE FOR RFI LIST TEST:
  import { render, screen, waitFor } from '@testing-library/react'
  import { vi } from 'vitest'
  import { RFIs } from '../pages/RFIs'
  import * as supabaseModule from '../lib/supabase'

  vi.mock('../lib/supabase', () => ({
    supabase: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRFIs, error: null }),
      }),
    }
  }))

  test('shows RFI list when data loads', async () => {
    render(<RFIs />, { wrapper: QueryClientWrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument() // skeleton
    await waitFor(() => expect(screen.getByText('RFI-001')).toBeInTheDocument())
  })

  test('shows empty state when no RFIs exist', async () => {
    // mock returns empty array
    await waitFor(() => expect(screen.getByText('No RFIs yet')).toBeInTheDocument())
  })

Set vitest coverage threshold to 80% in vitest.config.ts:
  coverage: { thresholds: { lines: 80, branches: 75, functions: 80 } }

Confirm `npm run test:coverage` passes before shipping.
```

---

# THE COMPLETE EXECUTION CHECKLIST

Run through this checklist to confirm a billion-dollar platform:

**Foundation**
- [ ] useProjectId() reads from route params or context, NOT hardcoded UUID
- [ ] Budget and RFI legacy endpoints accept projectId as parameter
- [ ] Only one auth system: useAuth.ts module singleton. authStore.ts deleted.
- [ ] Sidebar shows real user name from useAuth(), real project data from useProject()
- [ ] Budget page uses TanStack Query directly, not the legacy useQuery wrapper
- [ ] Dev bypass requires explicit VITE_DEV_BYPASS=true, shows warning banner

**Data**
- [ ] Zero mock data in any page file (`grep -r "const mock\|via.placeholder\|Walker Benner\|Meridian Tower" src/pages/` → 0 results)
- [ ] Every page shows skeleton on load, empty state when empty, error + retry on error
- [ ] All 15 pages listed in Phase 1 are wired to real Supabase queries

**Forms**
- [ ] New Submittal modal created and working
- [ ] Edit Punch Item modal created and working
- [ ] New Change Order modal sends type field correctly and invalidates both change_orders and budget caches
- [ ] New Daily Log form has all required fields including weather
- [ ] All forms: field-level validation errors, auto-save draft, loading state on submit

**Permissions**
- [ ] Every create/edit/approve/delete button wrapped in correct PermissionGate
- [ ] All routes wrapped in ProtectedRoute

**AI**
- [ ] AI Copilot streams real responses from Anthropic via edge function
- [ ] AI Copilot persists conversation history per project in localStorage
- [ ] AI Agents page loads agents from DB, shows pending actions, Apply/Dismiss works
- [ ] aiAnnotations.ts only returns data when VITE_DEMO_MODE is set

**Mobile**
- [ ] Real Capacitor camera capture on native, file input fallback on web
- [ ] Photos upload to Supabase Storage, save to field_captures table with GPS coordinates

**Offline**
- [ ] All Dexie tables defined including meetings, field_captures, equipment
- [ ] Mutations queue to Dexie when offline, sync on reconnect
- [ ] ConflictResolutionModal shows actual diff, not just "overwrite server"

**Security**
- [ ] CSP headers on all edge functions
- [ ] pdfjs-dist updated to 4.x
- [ ] No service role key in user-initiated edge functions
- [ ] AI chat input sanitized against prompt injection
- [ ] All edge functions validate input with Zod
- [ ] RLS UPDATE/DELETE policies on all tables

**Performance**
- [ ] Bundle < 250KB initial (run npm run build:analyze to verify)
- [ ] Virtualization on Tasks, Drawings, Directory, Activity lists
- [ ] React.memo on all leaf components in Primitives.tsx
- [ ] Images compressed before upload via browser-image-compression
- [ ] All list queries use pagination (.range())

**Real-Time**
- [ ] SidebarPresenceDot shows real user counts
- [ ] Detail panels show other users viewing the same record
- [ ] RFI/Submittal/Task lists update in real-time via Supabase Realtime

**Polish**
- [ ] Consistent hover states on every interactive element
- [ ] Visible focus rings on all interactive elements
- [ ] Skeletons match content layout exactly
- [ ] All empty states have icon + title + subtitle + CTA
- [ ] All pages use consistent PageContainer header pattern
- [ ] All status values use StatusTag component (no inline color spans)
- [ ] All numbers formatted via src/utils/format.ts utilities
- [ ] Toast messages are specific and actionable

**Testing**
- [ ] `npm run test:coverage` passes at 80% threshold
- [ ] Auth flow tests passing
- [ ] RFI create/update/delete tests passing
- [ ] Budget calculation tests passing
- [ ] Form validation tests passing

**Build**
- [ ] `npm run build` exits with 0 TypeScript errors
- [ ] `npm run lint` exits clean
- [ ] No console.log or console.error in production code

---

*When every box is checked, SiteSync is a 9.5/10. That last half point comes from actual construction crews using it every day.*
