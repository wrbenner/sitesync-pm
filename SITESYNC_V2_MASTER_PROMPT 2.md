# SiteSync AI — V2 Master Build Prompt

## From Beta to Billion: The Definitive Execution Plan

**Audit Date:** March 30, 2026
**Audited:** 211 TypeScript files, 32 migrations, 9 edge functions, 37 pages, 104 components, 24 test files, competitive landscape, emerging technologies, enterprise requirements

---

## WHERE WE ARE (Honest Assessment)

The V1 overhaul delivered real infrastructure: tool-calling AI copilot, XState workflow machines, offline Dexie layer, real-time Supabase subscriptions, 32 database migrations with RLS, presence tracking, conflict resolution architecture. The bones are good.

But the audit exposed **five systemic gaps** that must be closed before this is a multi-billion-dollar platform:

| Gap | Current State | Target State |
|-----|--------------|--------------|
| **Data Integrity** | Mutations don't invalidate React Query caches; local state diverges from server | Every mutation invalidates, refetches, and writes audit trail |
| **Security** | Permissions enforced on 1 of 37 pages; AI tools bypass RLS; dev mode grants full access | Every action permission-gated at UI + API + DB layers |
| **Real-Time** | Subscriptions configured but no page uses them; no presence indicators in UI | Every list auto-updates; presence shown on every detail view |
| **Mock Data** | 8 pages still mix hardcoded arrays with real queries | Zero mock data in any production code path |
| **Field Experience** | Responsive but not field-optimized; no voice, no LiDAR, no glove-friendly forms | Voice-first capture, offline-first forms, AR-ready architecture |

**Competitive Context (from research):**
- Construction software market: $10.76B (2025) → $24.72B (2034), 9.7% CAGR
- Procore just launched Helix (AI layer) and Assist (conversational AI with photo intelligence)
- Autodesk Build has Construction IQ (ML risk detection) and auto-photo tagging
- WebGPU now in all major browsers (enables browser-based BIM viewers at desktop CAD speed)
- 76% of construction leaders increasing AI investment
- Offline-first is table stakes, not a feature

---

## SYSTEM CONTEXT — Paste Before Every Session

```
You are the founding CTO of SiteSync AI, building the category-defining construction operating system. Your standard is not "working" — it is world-class. Every file you touch must be better than Procore, cleaner than Linear, faster than Fieldwire.

STACK: React 19 + TypeScript 5.9 + Vite 8 + Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) + TanStack React Query 5 + Zustand 5 + XState 5 + Framer Motion 12 + Radix UI + Capacitor 8

ARCHITECTURE RULES (NEVER VIOLATE):
1. ZERO mock data in production paths. Period.
2. Every mutation MUST: (a) call the API, (b) invalidate relevant React Query caches via queryClient.invalidateQueries(), (c) write to the audit trail, (d) show toast feedback, (e) check permissions first.
3. Every page MUST handle: loading (skeleton), error (message + retry button), empty (illustration + CTA).
4. Every action button MUST be wrapped in <PermissionGate permission="entity.action">.
5. Every list MUST support: search, filter, sort, pagination/virtualization for 100+ items.
6. Every form MUST validate before submit, show field-level errors, auto-save drafts.
7. All styling from src/styles/theme.ts. Zero raw hex values. Zero magic numbers.
8. All entity types from src/types/entities.ts. Zero ad-hoc interfaces.
9. State machines in src/machines/ govern workflow transitions. UI reads state, never manages workflow logic.
10. Mobile: 44px minimum touch targets. Offline-first. Works at 375px width.
11. Real-time: Every list page subscribes to Supabase Realtime for its entity type. Changes from other users appear instantly.
12. Accessibility: WCAG 2.1 AA. Keyboard navigable. Screen reader friendly. Color contrast ≥ 4.5:1.
```

---

# PHASE 1: DATA INTEGRITY & SECURITY (Week 1-2)

*Nothing else matters until every mutation is atomic, audited, and authorized.*

---

## PROMPT 1.1 — Mutation Hardening: Every Write Is Atomic, Audited, and Authorized

```
OBJECTIVE: Fix the systemic mutation pattern so every write operation in the entire codebase follows an ironclad pattern: check permissions → validate input → execute mutation → invalidate cache → write audit trail → show toast.

CURRENT PROBLEM: Mutations update local state but don't invalidate React Query caches, don't write to audit trail, don't check permissions. Example from Tasks.tsx line 144: `setLocalTasks(prev => prev.map(...))` — updates UI but server state is stale.

REQUIREMENTS:

1. CREATE a mutation wrapper utility in src/lib/mutationHelpers.ts:
   ```typescript
   export function createAuditedMutation<TInput, TOutput>({
     mutationFn,
     entityType,        // 'rfi' | 'submittal' | 'task' | etc
     action,            // 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject'
     permission,        // 'rfis.create' | 'tasks.update' | etc
     getInvalidateKeys, // (result) => QueryKey[]
     getAuditData,      // (input, result) => { old_value?, new_value?, description }
     successMessage,    // string | (result) => string
     errorMessage,      // string
   })
   ```
   This wrapper:
   a. Checks permission via usePermissions hook BEFORE executing
   b. Executes the mutation
   c. Calls queryClient.invalidateQueries() with the correct keys
   d. Writes to audit_trail table via Supabase insert
   e. Captures analytics via posthog
   f. Shows success/error toast via sonner
   g. Returns the standard useMutation result

2. REWRITE src/hooks/mutations/index.ts to use createAuditedMutation for EVERY mutation:
   - createRFI → invalidates ['rfis'], writes audit "RFI created: {title}"
   - updateRFI → invalidates ['rfis', id], writes audit with old/new values
   - updateRFIStatus → invalidates ['rfis'], writes audit "Status changed from {old} to {new}"
   - createSubmittal, approveSubmittal, rejectSubmittal → same pattern
   - createTask, updateTask, deleteTask, bulkUpdateTasks → same pattern
   - createChangeOrder, promoteChangeOrder, approveChangeOrder → same pattern
   - submitDailyLog, approveDailyLog, rejectDailyLog → same pattern
   - Every other mutation in the file → same pattern

3. AUDIT every page component to ensure it uses mutation hooks (NOT direct Supabase calls or local-only state updates):
   - Tasks.tsx: Replace all setLocalTasks mutations with proper mutation hooks
   - ChangeOrders.tsx: Wrap approve/reject/void in permission-checked mutations
   - RFIs.tsx: Wire status transitions through rfiMachine + audited mutation
   - Submittals.tsx: Wire approval chain through submittalMachine + audited mutation
   - DailyLog.tsx: Wire submit/approve/reject through dailyLogMachine + audited mutation
   - PunchList.tsx: Wire status changes through punchItemMachine + audited mutation
   - All other pages with mutations: Apply same pattern

4. ADD query invalidation cascade rules:
   - Mutating an RFI invalidates: ['rfis'], ['rfis', id], ['activity'], ['project-health']
   - Mutating a submittal invalidates: ['submittals'], ['submittals', id], ['activity'], ['project-health']
   - Mutating a task invalidates: ['tasks'], ['tasks', id], ['schedule'], ['activity'], ['project-health']
   - Mutating a change order invalidates: ['change-orders'], ['budget'], ['activity'], ['project-health']
   - Mutating a daily log invalidates: ['daily-logs'], ['activity']
   - Any mutation invalidates: ['activity'] (activity feed always refreshes)

5. VERIFY audit trail writes are working by checking the AuditTrail page shows entries after each mutation type.

VALIDATION: After this prompt, open browser dev tools Network tab. Perform a mutation. You should see:
1. A Supabase INSERT to the entity table
2. A Supabase INSERT to the audit_trail table
3. React Query refetch requests for all invalidated keys
4. A toast notification
```

---

## PROMPT 1.2 — Permission Enforcement: Defense in Depth

```
OBJECTIVE: Enforce permissions at three layers: UI (hide unauthorized actions), API (reject unauthorized requests), and DB (RLS blocks unauthorized queries).

CURRENT PROBLEM: Only AuditTrail page uses PermissionGate. AI chat tools don't check permissions. Dev mode bypass in usePermissions grants full access if VITE_SUPABASE_URL is missing. Agent auto-execution bypasses RLS entirely.

REQUIREMENTS:

1. FIX the dev mode bypass in src/hooks/usePermissions.ts:
   - Remove or gate the fallback that returns all permissions when env vars are missing
   - In development: use a seeded test user with a specific role, NOT a god-mode bypass
   - Add a console.warn if running without proper auth so developers know

2. WRAP every action button on every page with PermissionGate:
   - Tasks: create, edit, delete, bulk operations, apply template
   - RFIs: create, edit status, respond, void, assign
   - Submittals: create, submit, approve, reject, revise
   - ChangeOrders: create, submit, approve, reject, void, promote
   - DailyLog: create, submit, approve, reject
   - PunchList: create, update, resolve, verify
   - Budget: edit line items, approve change orders
   - Drawings: upload, markup, delete
   - Files: upload, delete, move
   - Crews: create, edit, assign
   - Directory: create, edit, delete contacts
   - Meetings: create, edit, start, end, add action items
   - Safety: create inspection, log incident, assign corrective action

   Pattern:
   ```tsx
   <PermissionGate permission="rfis.create" fallback={null}>
     <Btn onClick={openCreateRFI}>New RFI</Btn>
   </PermissionGate>
   ```

3. ADD permission checks to ALL AI edge function tools:
   - In supabase/functions/ai-chat/index.ts: Before executing each tool, verify the requesting user has the corresponding permission
   - query_rfis → requires rfis.view
   - query_budget → requires budget.view (subcontractors CANNOT see this)
   - create_rfi → requires rfis.create
   - update_status → requires {entity}.update
   - Add a permission check helper that validates against the user's project role

4. FIX agent-runner RLS enforcement:
   - In supabase/functions/agent-runner/index.ts: Agent actions must be created with the project's service account, NOT bypassing RLS
   - Auto-execution threshold (0.8) must be configurable per project, not hardcoded
   - Every auto-executed action writes to audit trail with actor = "ai_agent:{agent_type}"
   - Add a "require human approval" flag that project admins can toggle per agent type

5. ADD role-based navigation:
   - In Sidebar.tsx: Hide nav items the user cannot access
   - Subcontractor role: Only sees items assigned to them (Tasks, RFIs, Submittals, Files)
   - Viewer role: Sees everything but all action buttons hidden
   - Show "Contact your admin for access" when navigating to a restricted page

6. CREATE a permission test suite:
   - Test that each role can/cannot perform expected actions
   - Test that PermissionGate renders/hides correctly
   - Test that API rejects unauthorized mutations
```

---

## PROMPT 1.3 — Kill All Remaining Mock Data

```
OBJECTIVE: Eliminate every last instance of hardcoded mock data in the entire codebase. Replace with real database queries or remove.

STILL PRESENT (from audit):
1. RFIs.tsx lines 33-45: mock commentCounts, drawingRefs, ballInCourt
2. Submittals.tsx lines 27-69: mock descriptions, reviewTimelines, specSections, reviewCycles, leadTimes
3. PunchList.tsx lines 74-96: mock comments; lines 128-149: expanded mock data
4. DailyLog.tsx lines 56-64: mock crew hours; lines 67-74: mock photos
5. Crews.tsx lines 11-62: mock crewColors, crewPositions, crewForemen, crewCerts
6. Drawings.tsx lines 24-47: mock aiChanges, linkedItems, lastViewed
7. Schedule.tsx lines 68-76: hardcoded recovery plan
8. Meetings.tsx lines 39-51: mock agenda data
9. Tasks.tsx lines 53-60: mock assignee map
10. Components: dashboard weather, AI suggestions, drawing annotations, OCR results, CommandPalette search results

FOR EACH INSTANCE:
a. If the field should exist in the database schema: check if the column exists in migrations. If not, create a new migration to add it. Then update the query to fetch it.
b. If the field is derived/calculated: compute it in the query hook or a utility function, not hardcode it.
c. If it's display-only metadata (like colors per crew): store in a config table or derive from a hash function.
d. Remove all `const mock*`, `const fake*`, `const extra*`, `const hardcoded*` patterns.

SPECIFIC FIXES:
- RFI ballInCourt: Compute from rfiMachine.getBallInCourt(status, assigned_to). Already in the machine.
- RFI commentCounts: Query rfi_responses grouped by rfi_id to get counts.
- Submittal specSections: Add spec_section column to submittals table if missing. Populate from CSI MasterFormat.
- Submittal leadTimes: Use manufacturing_lead_time column from submittals table.
- PunchList comments: Query from a punch_item_comments table (create if needed).
- DailyLog crew hours: Sum from daily_log_entries where type = 'workforce'.
- DailyLog photos: Query from field_captures linked to the daily log.
- Crews metadata: Derive colors from a hash of crew name. Query certifications from crew_certifications.
- Drawings AI annotations: Query from drawing_annotations table (create if needed).
- Tasks assignee map: Join with project_members to get user names.

VALIDATION: Search the entire src/ directory for these patterns and confirm zero results:
- `const mock` (case insensitive)
- `const fake` (case insensitive)
- `const extra` followed by entity names
- `const hardcoded`
- Array literals with 3+ objects that look like entity data
```

---

# PHASE 2: REAL-TIME & COLLABORATION (Week 2-3)

*Make it feel alive. When someone changes something, everyone sees it instantly.*

---

## PROMPT 2.1 — Real-Time Everything: Instant Multi-User Updates

```
OBJECTIVE: Wire Supabase Realtime subscriptions into every list page so changes from other users appear instantly without refresh.

CURRENT STATE: src/lib/realtime.ts has subscriptions for 14 tables with smart invalidation. useRealtimeSubscription hook exists. But NO page component actually consumes these updates visually.

REQUIREMENTS:

1. CREATE a useRealtimeList hook that combines React Query + Realtime:
   ```typescript
   function useRealtimeList<T>(
     queryKey: QueryKey,
     queryFn: () => Promise<T[]>,
     tableName: string,
     projectId: string
   ) {
     // Standard useQuery for initial load
     const query = useQuery({ queryKey, queryFn });

     // Subscribe to realtime changes for this table
     useEffect(() => {
       const channel = supabase
         .channel(`${tableName}_${projectId}`)
         .on('postgres_changes',
           { event: '*', schema: 'public', table: tableName, filter: `project_id=eq.${projectId}` },
           (payload) => {
             // On INSERT: add to cache optimistically
             // On UPDATE: update in cache
             // On DELETE: remove from cache
             // Show toast: "[User] created/updated/deleted [entity]"
             queryClient.invalidateQueries({ queryKey });
           }
         )
         .subscribe();
       return () => { supabase.removeChannel(channel); };
     }, [tableName, projectId]);

     return query;
   }
   ```

2. REPLACE useQuery with useRealtimeList in every list page:
   - Tasks → useRealtimeList for tasks table
   - RFIs → useRealtimeList for rfis table
   - Submittals → useRealtimeList for submittals table
   - PunchList → useRealtimeList for punch_items table
   - ChangeOrders → useRealtimeList for change_orders table
   - DailyLog → useRealtimeList for daily_logs table
   - Meetings → useRealtimeList for meetings table
   - Files → useRealtimeList for files table
   - Activity → useRealtimeList for activity_feed table
   - Drawings → useRealtimeList for drawings table
   - Crews → useRealtimeList for crews table

3. ADD presence indicators to every page:
   - Use the existing usePresence hook
   - Show "Currently viewing" bar at top of each page with avatars of other users on the same page
   - On entity detail panels: show "Also viewing: [avatars]"
   - In Sidebar: show colored dots next to pages that have active users

4. ADD edit locking:
   - Use the existing EditConflictGuard component
   - When a user opens an entity for editing, broadcast via presence: { editing: entityId }
   - If another user tries to edit the same entity, show: "[Name] is currently editing this. Open read-only?"
   - Implement optimistic locking: on save, check updated_at matches the version you loaded

5. ADD live notification badge:
   - Notification bell shows real-time unread count (subscribe to notifications table)
   - New notifications appear as they arrive, no page refresh needed
   - Desktop notifications for high-priority items (overdue, assigned to you, approval needed)

6. HANDLE reconnection:
   - On network reconnect: resubscribe to all channels
   - Show "Reconnecting..." indicator
   - On successful reconnect: full cache refresh to catch missed events
   - Use exponential backoff for reconnection attempts (not fixed 3-second polling)
```

---

## PROMPT 2.2 — Conflict Resolution That Humans Trust

```
OBJECTIVE: Complete the offline sync conflict resolution flow so field workers never lose data.

CURRENT STATE: ConflictResolutionModal component exists with a 2-column diff view. syncManager tracks conflict count. offlineDb has conflict detection. But: no UI triggers the modal, conflicts queue indefinitely, polling is too aggressive (3 seconds).

REQUIREMENTS:

1. WIRE ConflictResolutionModal into App.tsx:
   - When syncManager reports conflicts > 0, show a persistent banner: "X items need your attention"
   - Clicking the banner opens ConflictResolutionModal
   - Modal loads all pending conflicts from Dexie
   - For each conflict: show side-by-side "Your version" vs "Server version" with field-level diffs
   - User chooses: "Keep mine", "Keep theirs", or "Merge" (field-by-field selection)
   - On resolve: call offlineDb.resolveMutationConflict() with the chosen strategy

2. FIX syncManager polling:
   - Change from 3-second polling to event-driven + 30-second heartbeat
   - On online event: immediate sync
   - On mutation: immediate sync attempt
   - Heartbeat: check for pending/conflicts every 30 seconds (not 3)
   - Add exponential backoff on sync failures (5s, 10s, 30s, 60s, max 5min)

3. ADD field-level merge for text conflicts:
   - When both versions changed the same entity but different fields: auto-merge non-conflicting fields
   - Only show conflict UI for fields where both versions differ
   - Example: You changed the title offline, someone else changed the status → auto-merge both changes

4. ADD sync progress to OfflineBanner:
   - "Syncing 12 of 34 items..."
   - Progress bar
   - When complete: "All changes synced" (auto-dismiss after 3 seconds)
   - If errors: "3 items failed to sync. Tap to retry"

5. PREVENT data loss:
   - Before clearing offline cache: verify all mutations are synced
   - On app close/refresh with pending mutations: show "You have unsaved changes" warning
   - Never silently drop queued mutations, even after 5 retries — keep them in an error state for manual review
```

---

# PHASE 3: AI THAT CHANGES THE GAME (Week 3-4)

*Procore just launched Helix. Autodesk has Construction IQ. Our AI must be smarter, faster, and more integrated.*

---

## PROMPT 3.1 — Fix AI Security & Reliability

```
OBJECTIVE: Fix critical security and reliability issues in the AI layer before building new capabilities.

CRITICAL BUGS FOUND IN AUDIT:

1. FIX: AI chat tools bypass permissions
   - In supabase/functions/ai-chat/index.ts: Add permission validation before every tool execution
   - Each tool must check: does this user's role allow this operation?
   - Subcontractor asking "show me the budget" should get: "You don't have access to budget data"
   - Implementation: Pass user role to tool executor, check against permission matrix

2. FIX: check_ai_rate_limit RPC doesn't exist
   - Either: Create the RPC function in a new migration
   - Or: Replace with a direct table query: SELECT COUNT(*) FROM ai_usage WHERE user_id = X AND created_at > now() - interval '1 day'
   - Must actually work — currently silently fails

3. FIX: AI tool confirmations not enforced
   - System prompt says "ALWAYS ask for user confirmation" but code auto-executes mutations
   - For read-only tools (query_*): execute immediately, no confirmation needed
   - For write tools (create_*, update_*): return a "pending action" object to the UI
   - UI renders confirmation card: "Create RFI: [title] — Assigned to: [name] — Confirm / Cancel"
   - Only execute the write after user confirms

4. FIX: RFI bottleneck detection returns 0
   - In supabase/functions/generate-insights/index.ts: responded_at field never populated
   - Create a trigger in a new migration: When an rfi_response with is_official = true is inserted, set responded_at on the parent RFI
   - Verify bottleneck detection now returns meaningful data

5. FIX: Agent auto-execution is dangerous
   - In supabase/functions/agent-runner/index.ts: Remove auto-execution for all write operations
   - Auto-execution should only apply to: notifications, insights, read-only analysis
   - All write operations (status changes, assignments, creation) require human approval
   - Move hardcoded thresholds (14 days, 7 days, 3 days) to a project_settings table
   - Add RLS policies to ai_agent_actions table that respect project membership

6. FIX: generate-insights processes ALL projects in one execution
   - Add pagination: process max 10 projects per invocation
   - Add a cursor/offset parameter
   - Set up Supabase CRON to invoke every hour with pagination

7. FIX: weekly-digest generates but never sends
   - In supabase/functions/weekly-digest/index.ts: Add actual email sending via Resend
   - Query notification_preferences to get recipient list
   - Template the HTML with project metrics
   - Set up CRON for Monday 6am
```

---

## PROMPT 3.2 — Voice-First AI for the Field

```
OBJECTIVE: Build a voice-first AI experience so superintendents can manage their project without touching a keyboard.

COMPETITIVE CONTEXT: Procore Assist now has conversational AI with photo intelligence and multilingual support (Spanish, Polish). We need to match and exceed.

REQUIREMENTS:

1. VOICE CAPTURE & TRANSCRIPTION:
   - Add a persistent voice button (microphone icon) in the mobile bottom bar and desktop floating AI button
   - On press-and-hold: start recording via Web Audio API (or Capacitor microphone plugin on native)
   - On release: send audio to a new edge function supabase/functions/voice-transcribe/
   - Edge function uses Anthropic or OpenAI Whisper API for transcription
   - Return transcript to the AI chat for processing
   - Support English and Spanish (80%+ of US construction workforce)

2. NATURAL LANGUAGE COMMANDS:
   - Train the AI system prompt to recognize field commands:
     - "Log 12 ironworkers on site today" → creates daily log workforce entry
     - "RFI for the architect: what's the flashing detail at the parapet?" → creates RFI
     - "Mark punch item 47 complete" → updates punch item status
     - "What submittals are due this week?" → queries submittals
     - "Take a progress photo of level 3 east" → opens camera with auto-tag
   - Parse intent from natural speech (AI already has tools, just needs better system prompt)

3. VOICE DAILY LOG:
   - Special mode: "Start daily log"
   - AI asks structured questions: "How's the weather? How many workers on site? Any safety incidents? What work was completed today?"
   - User answers verbally, AI fills in the daily log form
   - At end: "Here's your daily log. Review and submit?" Shows summary card
   - User says "Submit" or taps confirm button
   - Time to complete: <2 minutes (vs 10-15 minutes typing)

4. PHOTO INTELLIGENCE:
   - When a user takes a photo via field capture:
     - Auto-tag location via GPS
     - Auto-detect context using Anthropic vision: "Steel framing, level 3, east wing"
     - Suggest related items: "This looks related to RFI-034 (steel connection detail)"
     - Add to daily log automatically if daily log is in progress

5. MULTILINGUAL SUPPORT:
   - AI system prompt includes: "If the user speaks in Spanish, respond in Spanish"
   - Voice transcription supports: English, Spanish, Polish, Portuguese (top construction languages)
   - UI labels already support i18n (i18next installed) — add Spanish locale
```

---

## PROMPT 3.3 — Predictive Intelligence 2.0: Earn the Trust

```
OBJECTIVE: Fix the prediction algorithms so they produce trustworthy, actionable insights — not noise.

CURRENT PROBLEMS: Schedule predictor assumes linear progress. Earned value assumes uniform distribution. Safety metric doesn't distinguish near-misses. Quality score includes voided RFIs.

REQUIREMENTS:

1. FIX SCHEDULE RISK PREDICTION:
   - Replace linear progress assumption with S-curve model:
     - Construction tasks follow: slow start (mobilization) → rapid middle → slow finish (punch/closeout)
     - Use a sigmoid function: expected_progress = 1 / (1 + e^(-k*(elapsed - midpoint)))
     - Compare actual vs expected on the S-curve, not linear
   - Add weather impact factor:
     - Fetch 10-day forecast via weather API
     - Outdoor tasks with rain/snow forecast → increase risk score by 15-25%
     - Indoor tasks unaffected by weather
   - Add predecessor dependency factor:
     - If ANY predecessor is behind schedule → increase this task's risk proportionally
     - If predecessor is blocked → this task is automatically high-risk

2. FIX EARNED VALUE MANAGEMENT:
   - Replace BAC * (progress/100) with milestone-weighted PV:
     - Construction spending is front-loaded (foundation, structure) then tapers (finishes, closeout)
     - Use the planned cost schedule from budget items to weight PV by phase
   - Add forecasting:
     - EAC (Estimate at Completion) = AC + (BAC - EV) / CPI
     - TCPI (To-Complete Performance Index) = (BAC - EV) / (BAC - AC)
     - Show on Budget page: "At current spend rate, project will cost ${EAC} (${variance} over budget)"
   - Add trend analysis:
     - Track CPI and SPI over time (weekly snapshots)
     - Show trend line: "CPI has been declining for 3 weeks"
     - Alert when CPI drops below 0.95 or SPI drops below 0.90

3. FIX SAFETY PREDICTIONS:
   - Distinguish incident types: near-miss, first-aid, medical-treatment, lost-time, fatality
   - TRIR calculation: (total recordable incidents * 200,000) / total hours worked
   - LTIR calculation: (lost-time incidents * 200,000) / total hours worked
   - Predict safety risk based on:
     - Weather conditions (heat/cold extremes increase risk)
     - Crew experience (new crews have higher incident rates)
     - Task type (steel erection, excavation = high inherent risk)
     - Time of day (incidents spike in first hour and last hour of shift)
   - Dashboard shows: TRIR trend, LTIR trend, next predicted risk window

4. FIX QUALITY SCORING:
   - Exclude voided RFIs from quality calculations
   - Weight by priority: critical RFI overdue = 3x impact vs low-priority
   - Factor in: rework rate, punch items per area, inspection pass rate

5. ADD INSIGHT CONFIDENCE SCORING:
   - Every AI insight gets a confidence: High (>80%), Medium (50-80%), Low (<50%)
   - Show confidence badge on each insight card
   - Only auto-surface High confidence insights on Dashboard
   - Medium/Low go to a "Possible Risks" secondary panel
   - Track hit rate: what % of insights led to real issues?
```

---

# PHASE 4: ENTERPRISE FEATURES (Week 4-5)

*SOC 2, SSO, API, multi-tenancy. The features that unlock 6 and 7-figure contracts.*

---

## PROMPT 4.1 — SSO, API, and Enterprise Infrastructure

```
OBJECTIVE: Build the enterprise infrastructure that unlocks large customer contracts.

COMPETITIVE CONTEXT: SOC 2 is table-stakes. SAML SSO is required for any company with >500 employees. Public API unlocks integrations and stickiness. Procore has all three.

REQUIREMENTS:

1. SAML SSO INTEGRATION:
   - Supabase Auth supports SAML 2.0 natively
   - Enable SAML provider in Supabase project settings
   - Create organization settings page: Admin → Settings → SSO
   - Support: Okta, Azure AD, Google Workspace, OneLogin
   - Flow: User enters email → detect org domain → redirect to IdP → callback → session created
   - Organization admins can enforce: "All users must sign in via SSO"
   - Create migration for sso_configurations table: org_id, provider, metadata_url, entity_id, enabled

2. PUBLIC REST API:
   - Create supabase/functions/api-v1/ directory
   - Endpoints mirror internal queries but with API key auth:
     - GET /api/v1/projects
     - GET /api/v1/projects/:id/rfis
     - POST /api/v1/projects/:id/rfis
     - GET /api/v1/projects/:id/submittals
     - GET /api/v1/projects/:id/tasks
     - GET /api/v1/projects/:id/daily-logs
     - GET /api/v1/projects/:id/change-orders
     - Webhooks: POST /api/v1/webhooks/register
   - API keys: Create api_keys table (org_id, key_hash, scopes, created_at, last_used_at, expires_at)
   - Rate limiting: 1000 requests/hour per API key
   - Response format: JSON with pagination (cursor-based), filtering, sorting
   - API documentation: Auto-generate OpenAPI spec from edge function schemas

3. WEBHOOK SYSTEM:
   - The webhook-receiver edge function exists — enhance it
   - Organizations can register webhook URLs for events:
     - rfi.created, rfi.status_changed, rfi.overdue
     - submittal.created, submittal.approved, submittal.rejected
     - task.completed, task.overdue
     - daily_log.submitted, daily_log.approved
     - change_order.approved
     - safety.incident_reported
   - Webhook payloads include: event_type, entity_id, entity_data, timestamp, project_id
   - Retry with exponential backoff: 1min, 5min, 30min, 2hr, 24hr
   - Webhook logs: show delivery status, response code, retry count

4. MULTI-TENANCY HARDENING:
   - Verify organization → project → member hierarchy is enforced everywhere
   - Users can belong to multiple organizations
   - Switching organizations: clear all project-scoped caches, resubscribe to new org's projects
   - Organization-level settings: default permissions, branding (logo, colors), billing plan
   - Organization admin dashboard: user management, project list, usage metrics

5. DATA EXPORT & PORTABILITY:
   - "Export all project data" feature for organization admins
   - Export format: ZIP containing JSON files per entity type + file attachments
   - Required for enterprise procurement (data portability clause)
   - Background job via edge function for large exports
```

---

# PHASE 5: NEXT-GENERATION CAPABILITIES (Week 5-7)

*The features that make SiteSync the future of construction, not just a better Procore.*

---

## PROMPT 5.1 — BIM Viewer: Browser-Based, Lightning Fast

```
OBJECTIVE: Add a browser-based BIM/3D model viewer that integrates with the drawing and document management system.

COMPETITIVE CONTEXT: WebGPU is now in all major browsers (Chrome, Firefox, Safari, Edge as of Nov 2025). Resolve's Lightning Viewer proves you can view massive IFC files in-browser using WebAssembly + WebGPU. Autodesk Build has BIM integration but it's slow and requires Forge viewer. This is our chance to leapfrog.

REQUIREMENTS:

1. CHOOSE VIEWER LIBRARY:
   - Option A: xeokit (open-source, optimized for construction, handles massive models)
   - Option B: Apryse WebViewer BIM (commercial, Autodesk-compatible)
   - Option C: Build on Three.js (already installed) with IFC.js for IFC parsing
   - Recommend: Start with Three.js + IFC.js since Three.js is already in the stack

2. VIEWER FEATURES:
   - Load IFC, glTF, OBJ model files uploaded to project files
   - Orbit, pan, zoom with mouse and touch gestures
   - Section planes (cut through model to see interior)
   - Element selection: click an element → show properties panel (material, dimensions, classification)
   - Isolation: hide everything except selected elements
   - Measurement tool: click two points → show distance

3. PM INTEGRATION (the differentiator):
   - Click a model element → see linked RFIs, submittals, punch items for that area
   - Color-code elements by status: green (complete), yellow (in progress), red (issues), gray (not started)
   - Overlay daily log progress photos onto the 3D model (georeferenced)
   - Create an RFI directly from the model: select element → "Create RFI" → auto-fill location and spec reference

4. DRAWING INTEGRATION:
   - Split view: 2D drawing on left, 3D model on right
   - Synchronized navigation: click a room in 2D → 3D camera flies to that room
   - Toggle between 2D and 3D views

5. PROGRESSIVE ENHANCEMENT:
   - If WebGPU available: use GPU-accelerated rendering (massive models)
   - If WebGPU not available: fallback to WebGL (Three.js default)
   - Show "Your browser supports enhanced 3D" banner when WebGPU is active
   - Mobile: simplified view with touch gestures
```

---

## PROMPT 5.2 — Computer Vision for Safety & Progress

```
OBJECTIVE: Use AI vision to automatically analyze site photos for safety compliance and progress tracking.

COMPETITIVE CONTEXT: Oracle just launched AI-powered safety management trained on 10,000+ project-years. Procore has auto-photo tagging. We can build this as a core feature, not a bolt-on.

REQUIREMENTS:

1. SAFETY DETECTION (Edge Function):
   - Create supabase/functions/vision-safety/
   - When a field photo is uploaded, send to Anthropic Vision API
   - Detect: Missing PPE (hard hat, safety vest, safety glasses), fall hazards (unprotected edges), housekeeping issues (debris, tripping hazards), equipment hazards
   - Return: list of detected issues with bounding box coordinates and confidence scores
   - Auto-create safety observation records for high-confidence detections
   - Notification to safety manager for critical detections

2. PROGRESS DETECTION:
   - Create supabase/functions/vision-progress/
   - Compare current photo to previous photo of same location
   - Detect: new construction activity, material deliveries, equipment changes
   - Estimate progress percentage based on visual comparison
   - Auto-tag photo with detected elements (concrete pour, steel erection, drywall, etc.)

3. PHOTO INTELLIGENCE:
   - On every field capture upload:
     - Auto-classify: progress / safety / quality / weather / general
     - Auto-tag: location (from GPS), trade (from visual detection), related items (from context)
     - Generate caption: "Steel framing in progress, Level 3 East wing"
   - Searchable: "Show me all photos of concrete work on Level 2"

4. DASHBOARD INTEGRATION:
   - Safety dashboard: Real-time detection statistics, trend over time
   - Photo timeline: Visual history of site progress with AI annotations
   - Alert feed: Safety detections appear in notification center with photo thumbnail

5. PRIVACY & CONSENT:
   - Never identify specific workers (no facial recognition)
   - Only detect PPE compliance, not individual identity
   - Store detection results, not biometric data
   - Add disclaimer in settings: "AI analyzes photos for safety compliance. No facial recognition is used."
```

---

## PROMPT 5.3 — Advanced Mobile Field Experience

```
OBJECTIVE: Make the mobile experience the best field app in construction — better than Fieldwire, better than PlanGrid, better than Procore Go.

REQUIREMENTS:

1. MOBILE NAVIGATION OVERHAUL:
   - Bottom tab bar: Home, Tasks, Capture (camera icon, center, prominent), Logs, Menu
   - "Menu" opens a bottom sheet with all other modules
   - Swipe right on any list item for quick actions (complete, assign, flag)
   - Pull-to-refresh on all lists
   - Haptic feedback on all taps (Capacitor Haptics)

2. ONE-TAP CAPTURE:
   - Camera button is ALWAYS visible (floating action button on every screen)
   - Single tap: opens camera immediately, no intermediate UI
   - After photo capture:
     - GPS tag added automatically
     - AI auto-classifies (progress/safety/quality)
     - AI generates caption
     - Quick-tag: tap to add to daily log, RFI, punch item, or general
     - Save and return in <3 seconds total
   - Voice button next to camera: tap and speak, AI creates the appropriate record

3. QR CODE SYSTEM:
   - Generate QR codes for: locations (rooms, floors, areas), equipment, materials
   - Print QR stickers (PDF generation)
   - Scan QR: opens context panel for that location/item
     - Show recent photos, open punch items, active tasks, assigned crew
   - "Log progress" button on scan: quick photo + note for that location

4. OFFLINE DAILY LOG:
   - Swipeable card-based entry (not a long scrolling form)
   - Cards: Weather (auto-filled) → Workforce → Equipment → Work Performed → Safety → Notes → Photos → Review & Submit
   - Auto-save every field change to Dexie
   - Show green checkmark on completed cards
   - "Submit" available only when all required cards are complete
   - Works 100% offline, syncs when connected

5. PUSH NOTIFICATIONS:
   - Wire Capacitor Push Notifications fully:
     - Register device token with Supabase
     - Notification types: assigned, overdue, mentioned, approval_needed, safety_alert
     - Deep link: tap notification → navigate directly to the entity
     - Badge count: show unread count on app icon
     - Configurable: user controls which types they receive

6. GESTURES & SPEED:
   - Double-tap a task card: toggle complete
   - Long-press: open context menu (edit, assign, flag, delete)
   - Swipe between related items (next/prev RFI, submittal, etc.)
   - Shake to undo last action (haptic + undo toast)
   - Pinch-to-zoom on all images and drawings
```

---

# PHASE 6: POLISH & SCALE (Week 7-9)

---

## PROMPT 6.1 — Dark Mode, Responsive Design, and CI/CD

```
OBJECTIVE: Activate dark mode, fix responsive design, and build the CI/CD pipeline.

CURRENT STATE: Dark mode tokens exist in theme.ts (complete darkColors object) but are NOT applied to any component. No CSS variables injected. No responsive breakpoint tokens. No CI/CD pipeline.

REQUIREMENTS:

1. DARK MODE ACTIVATION:
   - Create a ThemeProvider context that wraps the app
   - On mount: check (1) user preference in profile, (2) system preference via prefers-color-scheme
   - Inject CSS custom properties on document.documentElement:
     - --color-surface-page, --color-surface-raised, --color-text-primary, etc.
   - Update theme.ts to export a getThemeColors(mode: 'light' | 'dark') function
   - Add toggle in user settings (light / dark / system)
   - Persist preference in user profile (Supabase)
   - CRITICAL: Update every component that uses theme.colors.* to use CSS variables instead
   - This is a large change — prioritize: Sidebar, pages, cards, modals, forms

2. RESPONSIVE BREAKPOINTS:
   - Add to theme.ts:
     ```typescript
     export const breakpoints = {
       mobile: 375,
       tablet: 768,
       desktop: 1024,
       wide: 1440,
     }
     ```
   - Create useBreakpoint() hook that returns current breakpoint
   - Fix all pages with two-column layouts to collapse on mobile:
     - Budget, Drawings, ChangeOrders: stack columns vertically on mobile
     - Kanban boards: horizontal scroll on mobile (not side-by-side columns)
     - DataTables: collapse to card view on mobile
     - Modals: full-screen on mobile
   - Test at 375px width (iPhone SE) — every page must be usable

3. CI/CD PIPELINE:
   - Create .github/workflows/ci.yml:
     ```yaml
     on: [push, pull_request]
     jobs:
       lint:
         - npm run lint
       typecheck:
         - npx tsc --noEmit
       test:
         - npm run test:run
       coverage:
         - npm run test:coverage
         - Fail if below thresholds (60% statements, 50% branches)
       build:
         - npm run build
       e2e:
         - npm run test:e2e
     ```
   - Create .github/workflows/deploy.yml:
     - Trigger: push to main
     - Run full CI first
     - Deploy to GitHub Pages
     - Post-deploy: run smoke test against live URL

   - Add pre-commit hooks via husky + lint-staged:
     - On commit: lint + typecheck staged files
     - Prevent commits with lint errors or type errors

4. BUNDLE ANALYSIS:
   - Activate rollup-plugin-visualizer in vite.config.ts (already installed)
   - Add npm script: "build:analyze": "ANALYZE=true npm run build"
   - Generate stats.html on every build
   - Set performance budget: warn if any chunk > 500KB gzipped
   - Verify all heavy libraries (Three.js, PDF, Maps, OCR) are in lazy chunks

5. ADDITIONAL POLISH:
   - Add `<link rel="preconnect" href="https://YOUR_SUPABASE_URL">` to index.html
   - Add `<meta name="description">` for SEO
   - Add apple-mobile-web-app-capable and status-bar-style meta tags
   - Fix manifest.json icon references (ensure PNG icons exist if referenced)
   - Add Lighthouse CI to pipeline with performance budget thresholds
```

---

## PROMPT 6.2 — Test Coverage: Ship With Confidence

```
OBJECTIVE: Expand test coverage from ~55% to 80%+ with focus on critical user paths.

CURRENT STATE: 24 test files, 2,279 LOC. Good machine coverage (6/6 tested). Good library coverage. Weak component and page coverage.

REQUIREMENTS:

1. ADD MSW (Mock Service Worker) for API mocking:
   - Install msw
   - Create src/test/mocks/handlers.ts with mock responses for all Supabase queries
   - Create src/test/mocks/server.ts for test server setup
   - Wire into vitest setup file
   - This enables testing components that depend on API data without hitting Supabase

2. CRITICAL PATH INTEGRATION TESTS (priority order):
   a. RFI Lifecycle: Create → Submit → Assign → Respond → Close → Verify audit trail
   b. Submittal Lifecycle: Create → Submit → GC Review → Architect Review → Approve → Verify chain
   c. Change Order Pipeline: Create PCO → Promote to COR → Promote to CO → Approve → Verify budget impact
   d. Task Dependency Chain: Create 3 tasks with dependencies → Complete predecessor → Verify successor unblocked
   e. Daily Log Workflow: Create → Add entries → Submit → Approve → Verify locked
   f. Offline → Online Sync: Create items offline → Come online → Verify sync → Verify no data loss

3. COMPONENT TESTS (add these):
   - PermissionGate: renders children when authorized, hides when unauthorized
   - ConflictResolutionModal: displays conflicts, allows resolution, calls correct callbacks
   - ApprovalChain: displays chain correctly, highlights current step
   - KanbanBoard: drag-and-drop triggers correct mutations
   - RichTextEditor: renders content, handles mentions
   - OfflineBanner: shows correct status for online/offline/syncing/conflicts

4. E2E EXPANSION (add these):
   - Change order workflow: PCO → COR → CO with approvals
   - Submittal approval chain: multi-reviewer flow
   - Offline resilience: create items offline → verify sync
   - Permission enforcement: login as viewer → verify read-only
   - AI copilot: ask a question → verify tool calling → verify result display
   - Mobile viewport: complete daily log on 375px width

5. ACCESSIBILITY TESTS:
   - Run axe-core on every page component
   - Test keyboard navigation: Tab through all interactive elements
   - Test focus management: After modal close, focus returns to trigger
   - Test screen reader: Route changes announced, form errors announced

6. RAISE COVERAGE THRESHOLDS:
   - Statements: 70% (from 60%)
   - Branches: 60% (from 50%)
   - Functions: 70% (from 60%)
   - Lines: 70% (from 60%)
   - Add per-file minimum: no file below 50%
```

---

# PHASE 7: GROWTH MOAT (Week 9-10)

---

## PROMPT 7.1 — Integration Ecosystem & Reporting Engine

```
OBJECTIVE: Build the integration framework and reporting engine that make SiteSync irreplaceable.

REQUIREMENTS:

1. INTEGRATION FRAMEWORK:
   - Create src/lib/integrations/types.ts:
     ```typescript
     interface IntegrationProvider {
       id: string;
       name: string;
       icon: string;
       category: 'accounting' | 'scheduling' | 'design' | 'communication' | 'storage';
       connect: (config: ConnectConfig) => Promise<void>;
       disconnect: () => Promise<void>;
       sync: (options: SyncOptions) => Promise<SyncResult>;
       getStatus: () => Promise<ConnectionStatus>;
     }
     ```
   - Create integration providers:
     a. QuickBooks: Sync change orders → journal entries, budget items → chart of accounts
     b. Microsoft Project: Import/export schedules as XML
     c. Email (Resend): Send RFI transmittals, submittal transmittals, daily log summaries
     d. Google Drive / OneDrive: Sync project documents bidirectionally

   - Wire Integrations page (src/pages/Integrations.tsx) to show:
     - Available integrations with category grouping
     - Connect/disconnect buttons
     - Last sync timestamp, item count, error count
     - Manual "Sync Now" button
     - Sync history log

2. ZAPIER / WEBHOOK INTEGRATION:
   - Build on the webhook system from Prompt 4.1
   - Add Zapier-compatible trigger format
   - Document webhook payload schemas
   - Add webhook testing tool in Settings (send test event → see if it arrives)

3. REPORTING ENGINE:
   - Use @react-pdf/renderer for PDF generation
   - Use xlsx package for Excel exports
   - Report types:
     a. Executive Summary (2 pages): Health score, milestones, budget summary, risks, next week preview
     b. Monthly Progress (10 pages): Phase-by-phase progress, financial status, schedule update, safety, weather impact, photos
     c. RFI Log: All RFIs with status, dates, ball-in-court, response summary
     d. Submittal Register: All submittals with spec section, status, review chain, dates
     e. Punch List: Open items with photos, location, responsible party, due date
     f. Safety Report: TRIR/LTIR trends, incidents, inspections, corrective actions
     g. Change Order Summary: PCOs, CORs, COs with financial impact waterfall
   - Professional formatting: SiteSync branding, company logo, page numbers, TOC
   - Generate client-side (no server round-trip)
   - Schedule recurring reports: "Generate weekly executive summary every Monday at 6am"
   - Email reports to distribution list via Resend

4. EXPORT CENTER ENHANCEMENT:
   - Select report type → Configure (date range, sections to include) → Preview → Generate → Download
   - Recent exports with re-download
   - Bulk export: "Export all reports for this month"
```

---

# CROSS-CUTTING: Apply to Every File You Touch

```
1. MUTATIONS: permission check → validate → execute → invalidate cache → audit trail → toast
2. PAGES: skeleton loading → error with retry → empty with CTA → real data with search/filter/sort
3. MOBILE: 44px touch targets, works at 375px, offline-capable
4. ACCESSIBILITY: ARIA labels, keyboard nav, 4.5:1 contrast, screen reader announcements
5. PERFORMANCE: virtualize lists >50 items, lazy-load heavy components, preconnect to APIs
6. SECURITY: PermissionGate on actions, RLS on database, input validation on forms
7. REAL-TIME: every list subscribes to changes, presence shown, edit locking on detail views
8. AUDIT: every mutation writes to audit_trail with actor, action, entity, old/new values
9. TYPESCRIPT: zero `any`, all props typed, all API responses typed, prefer narrowing over assertion
10. STYLING: all values from theme.ts, CSS variables for dark mode, responsive breakpoints
```

---

# EXECUTION SEQUENCE

```
Week 1:   1.1 (Mutation hardening) → 1.2 (Permissions) → 1.3 (Kill mock data)
Week 2:   2.1 (Real-time everything) → 2.2 (Conflict resolution)
Week 3:   3.1 (Fix AI security) → 3.2 (Voice-first AI)
Week 4:   3.3 (Predictive intelligence 2.0) → 4.1 (Enterprise infrastructure)
Week 5:   5.1 (BIM viewer) → 5.2 (Computer vision safety)
Week 6:   5.3 (Mobile field experience)
Week 7:   6.1 (Dark mode + responsive + CI/CD)
Week 8:   6.2 (Test coverage to 80%)
Week 9:   7.1 (Integrations + reporting)
Week 10:  Final QA, performance profiling, Lighthouse audit, SOC 2 documentation prep
```

---

# WHAT MULTI-BILLION LOOKS LIKE

When V2 is complete, SiteSync AI will be:

**Procore+AI+Figma for Construction:**

- **Data-tight**: Every mutation is audited, every cache is fresh, every permission is enforced at 3 layers
- **AI-native**: Voice commands in the field, photo intelligence, predictive risk engine that earns trust
- **Real-time**: Changes appear instantly, presence shows who's online, edit conflicts are resolved intelligently
- **Offline-first**: Field workers never lose data, sync is intelligent, conflicts are human-resolvable
- **BIM-integrated**: WebGPU-powered 3D viewer linked to RFIs, submittals, punch items (no competitor does this natively)
- **Vision-powered**: Camera captures auto-analyze for safety and progress (Oracle charges separately for this)
- **Enterprise-ready**: SSO, public API, webhooks, audit trail, data export, SOC 2 documentation
- **Beautiful**: Dark mode, responsive, WCAG AA, Framer Motion animations, skeleton loading, empty state illustrations
- **Tested**: 80%+ coverage, E2E for all critical paths, CI/CD pipeline, Lighthouse performance budgets
- **Extensible**: Integration framework, Zapier-compatible webhooks, recurring reports

The construction software market is $10.76B and growing at 9.7% annually. 75% of firms plan to increase software spending in 2026. Procore is the incumbent but vulnerable — they're catching up on AI, not leading. SiteSync can be the platform that was AI-native from day one, field-first by design, and beautiful enough that people actually want to use it.

Build it like the future depends on it. Because for every construction team, it does.
