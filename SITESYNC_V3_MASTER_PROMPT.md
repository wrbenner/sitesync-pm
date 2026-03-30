# SiteSync AI — V3 Master Build Prompt

## From Platform to Category King: The Tech Giant Playbook

**Audit Date:** March 30, 2026
**Audited:** 211 TypeScript files, 32 migrations, 9 edge functions, 37 pages, 104 components, 24 test files, 6 state machines, full offline/sync layer, complete permissions system, all AI edge functions, competitive landscape, tech giant architectures (Stripe, Figma, Linear, Apple), vertical SaaS playbooks, emerging construction tech

---

## WHERE WE ARE (V3 Honest Assessment)

V2 delivered real infrastructure. V3's deep audit exposed **120+ specific bugs** across every critical system. The platform is architecturally right but execution-incomplete. Here is the ground truth:

| System | Critical Bugs | Status |
|--------|-------------|--------|
| **Offline/Sync** | Retry logic broken (both branches identical, line 265). Race condition in conflict resolution. Silent error suppression hides data loss. No exponential backoff. Memory leak in event listeners. | Fundamentally broken |
| **Permissions** | Dev mode bypass grants owner access when env var missing (line 173). Client-side only enforcement. Zero backend permission validation on mutations. 5-minute stale cache on role changes. | Security theater |
| **AI Edge Functions** | ALL 4 functions use service role key bypassing RLS entirely. No user authorization. Prompt injection via unvalidated projectContext. Auto-execute agent actions without audit trail. | Wide open |
| **Mutations** | Zero `onError` callbacks. Zero optimistic updates. 7+ cache invalidation gaps. Partial updates corrupt data (reorder tasks, template apply). No permission checks. | Fragile |
| **State Machines** | Submittal has unreachable `architect_review` state. Daily log rejection maps to wrong status. Punch item missing direct verification path. | Logic errors |
| **Queries** | Missing individual entity queries (only useRFI exists). No pagination. No folder-specific file invalidation. Earned value cache key mismatch. | Incomplete |

**Competitive Context (Updated):**
- Procore: $1.323B revenue (2025), 106% net retention, ACV pricing model, Helix AI with Agent Builder
- Construction software market: $10.76B → $24.72B by 2034, 9.7% CAGR
- WebGPU now in all browsers (Nov 2025): browser-based BIM at desktop CAD speed
- Construction tech funding: $4.4B milestone
- 76% of construction leaders increasing AI investment

**Tech Giant Standards We Must Match:**
- **Stripe**: API versioning, OpenAPI spec, code-generated SDKs, three-column docs, backward-compatible evolution
- **Figma**: Server-authoritative multiplayer, Eg-walker CRDT algorithm, 33ms batching, operational transform
- **Linear**: Keyboard-first everything, Cmd+K command palette, speed as core feature, say-no design philosophy
- **Apple**: Purposeful animations (200-500ms), haptic feedback on mobile, progressive disclosure, accessibility-first

---

## SYSTEM CONTEXT — Paste Before Every Session

```
You are the founding CTO of SiteSync AI, building the category-defining construction operating system. Your standard is not "working" — it is world-class. Every file you touch must be better than Procore, cleaner than Linear, faster than Fieldwire.

STACK: React 19 + TypeScript 5.9 + Vite 8 + Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) + TanStack React Query 5 + Zustand 5 + XState 5 + Framer Motion 12 + Radix UI + Capacitor 8

ARCHITECTURE RULES (NEVER VIOLATE):
1. ZERO mock data in production paths. Period.
2. Every mutation MUST: (a) check permissions via usePermissions, (b) validate input with Zod schema, (c) execute mutation, (d) invalidate ALL related React Query caches, (e) write audit trail entry, (f) show toast feedback, (g) implement onError rollback.
3. Every page MUST handle: loading (skeleton), error (message + retry button), empty (illustration + CTA).
4. Every action button MUST be wrapped in <PermissionGate permission="entity.action">.
5. Every list MUST support: search, filter, sort, pagination/virtualization for 1000+ items.
6. Every form MUST validate before submit, show field-level errors, auto-save drafts to IndexedDB.
7. All styling from src/styles/theme.ts. Zero raw hex values. Zero magic numbers.
8. All entity types from src/types/entities.ts. Zero ad-hoc interfaces. Zero `as any` casts.
9. State machines in src/machines/ govern workflow transitions. UI reads state, never manages workflow logic.
10. Mobile: 44px minimum touch targets. Offline-first. Works at 375px width. Haptic feedback on actions.
11. Real-time: Every list page subscribes to Supabase Realtime for its entity type. Changes from other users appear instantly with presence indicators.
12. Accessibility: WCAG 2.1 AA. Keyboard navigable. Screen reader friendly. Color contrast ≥ 4.5:1.
13. Every Supabase Edge Function MUST: (a) extract user from auth header, (b) verify project membership, (c) check role permissions, (d) use user-scoped client (NEVER service role key for user-initiated operations), (e) validate all inputs.
14. Performance budgets: First paint < 1.5s, TTI < 3s, bundle < 300KB initial, 60fps animations.
15. Error boundaries on every route. Sentry integration for production errors. No unhandled promise rejections.
```

---

# PHASE 1: FIX THE FOUNDATION (Week 1-2)

*Every bug found in the V3 audit must be eliminated before adding features.*

---

## PROMPT 1.1 — Fix Broken Offline Sync System

```
OBJECTIVE: The offline sync system has 25+ bugs including a BROKEN retry mechanism that prevents any offline mutations from ever syncing. Fix every issue.

CRITICAL BUG #1 — Retry Logic Does Nothing (offlineDb.ts ~line 265):
Both branches of the retry logic are IDENTICAL. The else branch sets status to 'failed' instead of 'pending', so mutations never retry:

BEFORE (broken):
  if (retryCount >= 5) {
    await offlineDb.pendingMutations.update(m.id!, { status: 'failed', retryCount })
  } else {
    await offlineDb.pendingMutations.update(m.id!, { status: 'failed', retryCount }) // ← SAME!
  }

FIX: Change else branch to status: 'pending'. Add exponential backoff with nextRetryAt timestamp.

CRITICAL BUG #2 — Race Condition in Conflict Resolution (offlineDb.ts ~lines 140-164):
resolveMutationConflict does put() then delete() without a transaction. If put() succeeds but delete() fails, server data is cached but mutation retries forever.

FIX: Wrap in offlineDb.transaction('rw', [...tables], async () => { ... })

CRITICAL BUG #3 — Silent Error Suppression (offlineDb.ts ~lines 378-405):
Cache operations use empty catch blocks. Network errors, permission errors, quota errors all silently ignored. Function returns success metrics that are lies.

FIX: Log errors. Track which tables failed. Return { cached, failed, errors: string[] }. Show warning toast if cache is incomplete.

CRITICAL BUG #4 — Upload Retries Never Stop (offlineDb.ts ~lines 296-317):
All upload errors treated identically. A 403 permission error retries forever. A 413 file-too-large retries forever.

FIX: Parse HTTP status codes. Give up immediately on 401, 403, 413, 415. Retry with backoff on 500, 502, 503, 429.

CRITICAL BUG #5 — Memory Leak (syncManager.ts ~lines 43-48):
Arrow function handlers create new references per instantiation. removeEventListener won't match them.

FIX: Use bound methods or store handler references that removeEventListener can match.

ADDITIONAL FIXES REQUIRED:
- Add storage quota checking before caching (navigator.storage.estimate())
- Add configurable queue size limits (max 500 pending mutations)
- Add priority field to PendingMutation for sync ordering
- Validate table names in queueMutation against SUPABASE_TO_DEXIE mapping
- Make SUPABASE_TO_DEXIE private (remove export)
- Add error handling in refreshCounts() polling (try-catch in setInterval callback)
- Fix hardcoded 1000-record cache limit: make configurable, log warning when truncated
- Replace window.location.hash navigation in realtime.ts with proper React Router navigate()
- Add duplicate sync prevention in handleOnline (check syncInProgress flag)
- Add Zod validation for Dexie read results before type casting

TEST: Create test file src/lib/__tests__/offlineDb.test.ts with fake-indexeddb:
- Test retry logic actually retries (status stays 'pending' until max retries)
- Test conflict resolution is atomic (both operations succeed or both fail)
- Test upload error classification (403 → permanent failure, 500 → retry)
- Test queue size limits
- Test quota checking
```

---

## PROMPT 1.2 — Fix Permissions: Dev Mode Bypass and Backend Enforcement

```
OBJECTIVE: The permission system is client-side theater. A dev mode bypass grants owner access when an env var is missing. Zero mutations check permissions server-side. Fix everything.

CRITICAL BUG #1 — Dev Mode Bypass (usePermissions.ts ~line 173):
When VITE_SUPABASE_URL is missing, the hook returns: role: 'owner', hasPermission: () => true, canAccessModule: () => true.
If this env var is accidentally unset in production, EVERY user gets owner access to EVERYTHING.

FIX:
- Replace with explicit opt-in: only bypass if process.env.NODE_ENV === 'development' AND VITE_DEV_BYPASS === 'true'
- In dev bypass, use 'viewer' role, not 'owner'
- Log a giant console.warn when bypass is active
- NEVER allow bypass in production builds (Vite strips NODE_ENV check)

CRITICAL BUG #2 — No Backend Permission Enforcement (mutations/index.ts ALL mutations):
Every mutation calls supabase.from(table).insert/update/delete directly with zero permission checks. A viewer can approve change orders by calling the API.

FIX:
a) In EVERY mutation hook, add permission check BEFORE the API call:
   const { hasPermission } = usePermissions()
   if (!hasPermission('change_orders.approve')) throw new PermissionError('...')

b) In Supabase, apply RLS policies that use has_project_permission() for UPDATE and DELETE (not just SELECT).

c) The SQL function has_project_permission() already exists in migration 00032. Apply it to ALL tables:
   CREATE POLICY "members_update" ON rfis FOR UPDATE USING (
     has_project_permission(project_id, auth.uid(), 'rfis.update')
   );

   Do this for: rfis, submittals, tasks, punch_items, daily_logs, change_orders, budget_items, meetings, files, crews, drawings, incidents, safety_inspections, corrective_actions.

CRITICAL BUG #3 — Stale Permissions Cache (usePermissions.ts ~line 167):
staleTime is 5 minutes. If admin changes a user's role, user keeps old permissions for 5 minutes.

FIX: Reduce to 30 seconds. Add Supabase Realtime subscription on project_members table to invalidate permissions cache instantly when role changes.

CRITICAL BUG #4 — Missing Audit Trail (mutations/index.ts):
write_audit_entry() SQL function exists but ZERO mutations call it.

FIX: Use the createAuditedMutation wrapper from V2 Phase 1.1. Every mutation must write to audit_trail with: user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent.

ADDITIONAL FIXES:
- Add ProtectedRoute wrapper to every route in App.tsx (currently only some routes are protected)
- Add field-level permissions for sensitive data (budget amounts, financial fields)
- Add org-level permission checks for org.settings, org.billing, org.members
- Add rate limiting on approval operations (max 10 approvals per minute)
- Remove userId parameter from useRejectDailyLog (line 273) — it's dead code

TEST: Create src/hooks/__tests__/usePermissions.test.ts:
- Test dev bypass only activates with explicit flag
- Test every role level gets correct permissions
- Test stale permissions are refreshed on role change
- Test ProtectedRoute redirects unauthorized users
```

---

## PROMPT 1.3 — Fix AI Edge Functions: RLS Bypass and Security

```
OBJECTIVE: ALL FOUR Supabase edge functions use SUPABASE_SERVICE_ROLE_KEY, bypassing RLS entirely. Any user can access any project's data through AI chat. Fix every function.

CRITICAL PATTERN — Every function has this:
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey) // ← BYPASSES ALL RLS

FIX FOR ALL FUNCTIONS:
Replace service role client with user-authenticated client:
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

FUNCTION 1 — ai-chat/index.ts:
- Remove service role key usage for user operations
- Validate projectId is UUID format before using in filter (prevent injection)
- Validate user is a member of the project before executing ANY tool
- Add permission checks per tool: create_rfi requires 'rfis.create', update_status requires entity-specific permission
- Sanitize projectContext before injecting into system prompt (prevent prompt injection)
- Add message array length limit (max 50 messages to prevent cost explosion)
- Add output sanitization before returning Claude's response
- Fix CORS: replace Access-Control-Allow-Origin: '*' with specific trusted origins

FUNCTION 2 — agent-runner/index.ts:
- Add user authentication
- Add rate limiting (missing entirely)
- REMOVE auto-execution of agent actions. All actions MUST go through pending_review regardless of confidence score. Human-in-the-loop is mandatory for a construction platform where mistakes cost millions.
- Write audit trail entry BEFORE executing any action
- Add input validation on agent configuration

FUNCTION 3 — generate-insights/index.ts:
- Keep service role for CRON-triggered execution, but add explicit check that request comes from Supabase scheduler (not user-callable)
- Add pagination for data fetching (current: loads ALL projects, ALL budgets at once)
- Validate computed metrics (CPI, SPI) aren't NaN/Infinity before saving
- Add deduplication: compare new insights against existing before inserting
- Wrap task updates in transaction (current: partial updates if function crashes mid-loop)

FUNCTION 4 — weekly-digest/index.ts:
- Same CRON-only restriction as generate-insights
- HTML-escape all user content before email rendering (current: project names can inject script tags)
- Add user notification preference check before sending (current: emails ALL members)
- Add actual email sending (current: generates HTML but never calls email service)

SECURITY HARDENING FOR ALL:
- Replace Access-Control-Allow-Origin: '*' with allowlist
- Add request size limits
- Add execution timeout handling
- Validate all env vars at startup, return generic errors on failure (don't leak env var names)

TEST: Create supabase/functions/__tests__/ with:
- Test that unauthenticated requests return 401
- Test that user can only access their own projects
- Test that tool permissions are enforced
- Test that prompt injection attempts are sanitized
```

---

## PROMPT 1.4 — Fix Mutations: Cache Invalidation, Error Handling, and Optimistic Updates

```
OBJECTIVE: Zero mutations have onError callbacks, zero have optimistic updates, 7+ have cache invalidation gaps, and partial updates can corrupt data. Fix the entire mutation layer.

CACHE INVALIDATION GAPS (specific fixes):

1. useCreateRFIResponse (~line 58):
   ADD invalidation of ['rfis', 'detail', rfiId] — users on detail page see stale responses

2. useUpdateSubmittal (~line 91):
   ADD invalidation of ['submittals', 'detail', id] if detail queries exist

3. useUpdateDailyLog (~line 202):
   ADD invalidation of ['daily_logs', 'detail', id]

4. useApproveDailyLog (~line 251):
   ADD invalidation of ['daily_logs', 'detail', id]

5. usePromoteChangeOrder (~line 319):
   ADD invalidation of ['change_orders', projectId] (all types, not just promoted record). Also invalidate ['costData'] AND ['earned_value', projectId] since CO promotion affects financials.

6. useDeleteFile (~line 457):
   FIX: Current invalidation ['files', projectId] doesn't match query key ['files', projectId, folder]. Use queryClient.invalidateQueries({ queryKey: ['files', projectId], exact: false }) to catch all folder variations.

7. Safety mutations (useCreateCorrectiveAction, useCreateSafetyInspection, useCreateIncident):
   ADD cross-invalidation of aggregate safety queries and weekly digest snapshots.

EARNED VALUE CACHE MISMATCH:
useEarnedValueData uses key ['earned_value', projectId] but budget mutations invalidate ['budget_items', projectId]. ADD ['earned_value', projectId] to budget mutation invalidations.

ERROR HANDLING (add to ALL mutations):
onError: (error, variables, context) => {
  // 1. Rollback optimistic update if applicable
  if (context?.previousData) {
    queryClient.setQueryData(cacheKey, context.previousData)
  }
  // 2. Show error toast with actionable message
  toast.error(getErrorMessage(error))
  // 3. Log to Sentry
  Sentry.captureException(error, { extra: { mutation, variables } })
}

OPTIMISTIC UPDATES (add to user-facing mutations):
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey })
  const previousData = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, (old) => optimisticUpdate(old, newData))
  return { previousData }
}

Priority mutations for optimistic updates: useUpdateTask, useUpdateRFI, useApproveChangeOrder, useSubmitDailyLog, useUpdatePunchItem

ATOMIC OPERATIONS FIX:
useReorderTasks (~line 828): Currently loops through individual updates. If 3rd of 5 fails, sort_order is corrupted.
FIX: Use Supabase RPC function:
  CREATE FUNCTION reorder_tasks(task_ids uuid[], new_orders int[]) RETURNS void AS $$
    UPDATE tasks SET sort_order = new_orders[idx]
    FROM unnest(task_ids, new_orders) WITH ORDINALITY AS t(id, ord, idx)
    WHERE tasks.id = t.id
  $$ LANGUAGE sql;

useApplyTaskTemplate (~line 875): Same issue. Wrap in single INSERT with multiple rows.

DEAD CODE REMOVAL:
- useRejectDailyLog line 273: Remove unused userId parameter

MISSING REJECTION FIELDS:
useRejectDailyLog: ADD rejected_at: new Date().toISOString() and rejected_by: userId to the update payload (currently only sets rejection_comments).

MISSING ENTITY QUERIES:
Create individual detail queries that mutations can invalidate:
- useSubmittal(id): fetch single submittal with approval chain
- usePunchItem(id): fetch single punch item with photos
- useTask(id): fetch single task with assignees
- useDailyLog(id): fetch single daily log with weather, crew, activities
- useChangeOrder(id): fetch single CO with history
- useMeeting(id): fetch single meeting with attendees and action items

Add to ALL list queries: enabled: !!projectId (prevent firing when projectId is null)

TEST: Create src/hooks/__tests__/mutations.test.ts:
- Test that cache invalidation fires for all related queries
- Test optimistic update rolls back on error
- Test reorder tasks is atomic (all succeed or all fail)
- Test permission check fires before mutation
```

---

## PROMPT 1.5 — Fix State Machines: Unreachable States and Wrong Transitions

```
OBJECTIVE: Fix logic errors in all 6 XState state machines.

BUG #1 — Submittal Machine Unreachable State (submittalMachine.ts):
architect_review state (~line 32) is defined but never entered. gc_review transitions directly to approved/rejected.

FIX: Either:
a) Add gc_review → architect_review transition (if architect review is a real step in the workflow), OR
b) Remove architect_review state entirely and update getValidSubmittalTransitions to remove references to it

Construction industry standard: Submittals typically go Subcontractor → GC Review → Architect Review → Approved/Rejected. So option (a) is correct:
  gc_review: { on: { GC_APPROVE: { target: 'architect_review' }, GC_REJECT: { target: 'rejected' } } }
  architect_review: { on: { ARCHITECT_APPROVE: { target: 'approved' }, ARCHITECT_REJECT: { target: 'rejected' }, ARCHITECT_REVISE: { target: 'revise_resubmit' } } }

BUG #2 — Daily Log Wrong Status After Rejection (dailyLogMachine.ts ~line 63):
getNextDailyLogStatus maps 'Edit and Resubmit' → 'submitted'. Should be → 'draft'. User needs to edit before resubmitting.

FIX: Change mapping to 'draft'. Add separate 'Resubmit' action that transitions from 'draft' → 'submitted'.

BUG #3 — Punch Item Missing Transitions (punchItemMachine.ts):
- No direct open → verified path (for items already complete at creation)
- No verified → open path (for failed verification that needs rework)
- Missing helper functions (getValidTransitions, getStatusConfig) that other machines have

FIX:
- Add VERIFY_DIRECT event: open → verified
- Add REJECT_VERIFICATION event: verified → in_progress (needs rework)
- Add getValidPunchTransitions() and getPunchStatusConfig() helper functions matching the pattern in rfiMachine.ts

BUG #4 — RFI Void Inconsistency (rfiMachine.ts):
getValidTransitions for 'void' returns [] (terminal), but admin override allows voiding from any state. Non-admin users see void as available even though they can't use it.

FIX: Filter void action by role in getValidTransitions:
  if (state === 'void') return []
  const transitions = [...standardTransitions]
  if (userRole === 'admin' || userRole === 'owner') {
    transitions.push({ action: 'Void', event: 'VOID' })
  }

BUG #5 — Change Order Machine Missing Rejection Flow:
Promote transitions exist (PCO → COR → CO) but rejection at COR stage has no path back to PCO for revision.

FIX: Add RETURN_TO_PCO event on COR state that transitions back with a revision_notes field.

TEST: Create src/machines/__tests__/ for each machine:
- Test every valid state transition
- Test that invalid transitions throw/are rejected
- Test helper functions return correct available actions per state
- Test role-based transition filtering
```

---

# PHASE 2: REAL-TIME AND COLLABORATION (Week 3-4)

*Figma-quality multiplayer. Every user sees every change instantly.*

---

## PROMPT 2.1 — Real-Time Subscriptions on Every Page

```
OBJECTIVE: Supabase Realtime subscriptions are configured but NO page component uses them. Every list must auto-update when other users make changes.

PATTERN — Create a useRealtimeQuery hook that wraps React Query with Supabase Realtime:

// src/hooks/useRealtimeQuery.ts
export function useRealtimeQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T[]>,
  table: string,
  projectId: string,
  options?: { filter?: string }
) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey, queryFn, ...options })

  useEffect(() => {
    const channel = supabase
      .channel(`${table}_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        // Invalidate and refetch — don't try to merge locally
        queryClient.invalidateQueries({ queryKey })

        // Show toast for changes by OTHER users
        if (payload.new?.updated_by !== currentUserId) {
          showRealtimeToast(table, payload.eventType, payload.new)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, projectId])

  return query
}

APPLY TO EVERY PAGE:
Replace useQuery with useRealtimeQuery in:
- RFIs.tsx, Submittals.tsx, Tasks.tsx (Schedule.tsx), PunchList.tsx
- DailyLog.tsx, Budget.tsx, ChangeOrders.tsx, Meetings.tsx
- Files.tsx, Directory.tsx, Crews.tsx, Drawings.tsx
- AuditTrail.tsx, Dashboard.tsx (aggregate metrics)

PRESENCE INDICATORS:
- Show avatar dots on entities currently being viewed/edited by other users
- Use the existing Liveblocks/presence system (already imported in App.tsx)
- Show "X is editing this RFI" banner on detail views when another user has the same entity open
- Use 33ms batching for presence updates (Figma pattern) to reduce network chatter

CONFLICT PREVENTION:
- When user opens an entity for editing, broadcast presence
- If another user is already editing, show warning: "Sarah is currently editing this. Changes may conflict."
- On save, check if entity was modified since load (optimistic locking via updated_at timestamp)

TEST:
- Open same RFI in two browser tabs, edit in one, verify other tab updates within 2 seconds
- Verify presence indicators appear and disappear correctly
- Verify conflict warning shows when two users edit simultaneously
```

---

## PROMPT 2.2 — Keyboard-First UX (Linear Pattern)

```
OBJECTIVE: Make SiteSync as fast to use as Linear. Every action reachable by keyboard. Speed is the feature.

COMMAND PALETTE (Cmd+K / Ctrl+K):
The CommandPalette component exists but needs enhancement:

1. GLOBAL SHORTCUTS (register in App.tsx):
   - Cmd+K: Open command palette
   - Cmd+N: New entity (context-aware: new RFI on RFI page, new task on Tasks page)
   - Cmd+/: Open AI copilot
   - Cmd+F: Focus search
   - Cmd+1-9: Navigate to page (1=Dashboard, 2=RFIs, 3=Tasks, etc.)
   - Cmd+Shift+P: Open project switcher
   - Escape: Close any modal/panel
   - ?: Show keyboard shortcut help

2. COMMAND PALETTE FEATURES:
   - Fuzzy search across all entities (RFIs, tasks, submittals, etc.) using Orama
   - Recent items at top
   - Action commands: "Create RFI", "Approve CO-003", "Assign to Sarah"
   - Navigation commands: "Go to Budget", "Open Drawing A2.1"
   - AI commands: "Ask AI about schedule delays", "Generate daily log"

3. LIST NAVIGATION:
   - J/K: Move up/down in any list
   - Enter: Open selected item
   - X: Select/deselect for bulk actions
   - Shift+Click: Range select
   - Cmd+A: Select all visible

4. DETAIL VIEW SHORTCUTS:
   - E: Edit current entity
   - A: Approve (if applicable)
   - R: Reject (if applicable)
   - C: Add comment
   - Cmd+Enter: Save and close
   - Escape: Cancel edit

5. VISUAL FEEDBACK:
   - Show shortcut hints in tooltips on all buttons
   - Show shortcut legend in bottom-right corner (togglable)
   - Animate focus ring on keyboard navigation (2px solid #F47820, 2px offset)

IMPLEMENTATION:
- Use a useKeyboardShortcuts hook that registers/unregisters on mount/unmount
- Shortcuts must be context-aware (don't fire when typing in an input/textarea)
- Shortcuts must respect focus trap in modals
- Add aria-keyshortcuts attributes for accessibility

TEST:
- Every shortcut works from every page
- Shortcuts don't fire inside text inputs
- Command palette search returns results in < 100ms
- Navigation shortcuts work without mouse
```

---

# PHASE 3: AI THAT WINS AGAINST PROCORE HELIX (Week 5-6)

*Not just a chatbot. A construction-aware copilot that does real work.*

---

## PROMPT 3.1 — AI Copilot V2: Procore Helix Competitive Feature Set

```
OBJECTIVE: Procore launched Helix AI with Agent Builder, photo intelligence, and conversational search. Our AI must match and exceed this.

FEATURE 1 — VOICE-FIRST FIELD CAPTURE:
Construction workers wear gloves and work in loud environments. Voice is the primary input.

Implementation:
- Use Web Speech API (SpeechRecognition) for real-time transcription
- Process transcription through Claude to extract structured data:
  Input: "Concrete pour on level 3 east wing completed about 80 percent, weather was clear and 72 degrees, had 6 workers from ABC Concrete on site"
  Output: {
    type: 'daily_log',
    entries: [
      { category: 'concrete', location: 'Level 3 East Wing', progress: 80 },
      { weather: { condition: 'clear', temp_f: 72 } },
      { crew: 'ABC Concrete', headcount: 6 }
    ]
  }
- Support multilingual input (Spanish and English at minimum for US construction)
- Show real-time transcription with AI-parsed fields below
- One-tap confirm to create daily log entry

FEATURE 2 — PHOTO INTELLIGENCE:
- Upload photo → AI identifies: safety violations, progress status, material types, equipment
- Use Claude vision to analyze construction photos
- Auto-tag photos with: location, trade, date, safety status
- Compare photos across time for progress tracking
- Flag safety violations: missing PPE, improper scaffolding, unprotected edges

FEATURE 3 — PREDICTIVE INTELLIGENCE:
- Schedule risk scoring: analyze task dependencies, weather forecasts, crew availability, material delivery dates to predict delays
- Budget variance prediction: use earned value (CPI/SPI) trends to forecast final costs
- RFI bottleneck detection: identify reviewers who consistently delay responses
- Submittal risk: flag submittals likely to be rejected based on historical patterns

FEATURE 4 — AGENT BUILDER (matches Procore Helix):
- Let users create custom AI agents with natural language:
  "Create an agent that checks every morning for tasks due this week with no crew assigned and sends a Slack notification"
  "Create an agent that auto-generates the weekly progress report every Friday at 3pm"
  "Create an agent that flags any change order over $50k for VP approval"
- Store agent definitions in database with: trigger (schedule/event/manual), conditions, actions, notification targets
- All agent actions require human approval (no auto-execute)
- Audit trail for every agent action

FEATURE 5 — CONTEXTUAL AI SIDEBAR:
- On any entity detail page, show AI context panel with:
  - Related items (RFIs related to this task, submittals for this spec section)
  - Risk assessment for this specific item
  - Suggested next actions
  - Historical patterns ("Similar RFIs took 12 days on average")
  - Draft responses (for RFIs, submittals)

IMPLEMENTATION:
- Refactor ai-chat edge function to use authenticated user client (Phase 1.3)
- Add new tools: analyze_photo, predict_schedule_risk, search_similar_items, generate_report
- Add streaming responses (Anthropic streaming API) for better UX
- Cache AI responses for repeated queries (same question within 5 minutes)
- Rate limit: 100 requests/day for free tier, unlimited for enterprise

TEST:
- Voice capture correctly parses 5 different daily log formats
- Photo analysis identifies PPE violations in test images
- Predictive scoring correlates with actual delays in historical data
- Agent builder creates valid agent definitions from natural language
```

---

# PHASE 4: ENTERPRISE GRADE (Week 7-8)

*SOC 2 ready. SSO. Public API. Multi-tenant.*

---

## PROMPT 4.1 — Public API: Stripe-Quality Developer Experience

```
OBJECTIVE: Build a public REST API that construction tech integrators actually want to use. Follow Stripe's playbook exactly.

API DESIGN PRINCIPLES (from Stripe):
1. Consistent resource naming: /v1/projects/{id}/rfis, /v1/projects/{id}/tasks
2. Predictable pagination: { data: [...], has_more: true, next_cursor: "..." }
3. Idempotency keys on all POST/PUT requests (Idempotency-Key header)
4. Versioning via header: API-Version: 2026-03-30
5. Expand parameter: ?expand=assignee,responses (avoid N+1 on client)
6. Webhook events for every state change: rfi.created, rfi.status_changed, task.completed

IMPLEMENTATION:
Create Supabase Edge Functions for API endpoints:

/v1/projects — List projects, create project
/v1/projects/:id — Get, update, delete project
/v1/projects/:id/rfis — List RFIs, create RFI
/v1/projects/:id/rfis/:id — Get, update, delete RFI
/v1/projects/:id/tasks — List tasks, create task
/v1/projects/:id/submittals — List submittals, create submittal
/v1/projects/:id/daily-logs — List daily logs, create daily log
/v1/projects/:id/change-orders — List change orders, create CO
/v1/projects/:id/budget — Get budget data
/v1/projects/:id/files — List files, upload file
/v1/projects/:id/members — List members, invite member

AUTHENTICATION:
- API keys (not user tokens) for server-to-server
- API keys stored in api_keys table with: key_hash, project_id, scopes[], rate_limit, created_by
- Scope-based access: read:rfis, write:rfis, read:budget, etc.
- Rate limiting: 100 req/min per API key (configurable per plan)

WEBHOOKS:
- Webhook endpoints table: url, events[], secret, active, failure_count
- Signed payloads (HMAC-SHA256 with webhook secret)
- Retry with exponential backoff (1s, 10s, 60s, 300s, 3600s)
- Event types for every entity lifecycle event

DOCUMENTATION:
- OpenAPI 3.1 spec auto-generated from endpoint definitions
- Three-column layout: description | parameters | code example
- Language-specific code examples (curl, Python, JavaScript, Ruby)
- Interactive API explorer (try requests from docs)

TEST:
- Every endpoint returns correct status codes (200, 201, 400, 401, 403, 404, 429)
- Pagination works with cursor-based navigation
- Idempotency keys prevent duplicate creation
- Webhook signatures verify correctly
- Rate limiting returns 429 with Retry-After header
```

---

## PROMPT 4.2 — Enterprise Security: SSO, Audit, Compliance

```
OBJECTIVE: Enterprise customers (ENR Top 100 contractors) require SSO, audit trails, and SOC 2 readiness.

SSO / SAML:
- Integrate Supabase Auth SSO with SAML 2.0
- Support: Okta, Azure AD, OneLogin, Google Workspace
- Just-in-time user provisioning on first SSO login
- Enforce SSO for org (disable password login when SSO is active)
- SCIM 2.0 for user provisioning/deprovisioning

AUDIT TRAIL (fix from Phase 1):
- Every mutation writes to audit_trail table
- Fields: user_id, action, entity_type, entity_id, project_id, old_values (JSONB), new_values (JSONB), ip_address, user_agent, timestamp
- Immutable: no UPDATE or DELETE policies on audit_trail
- Retention: configurable per org (default 7 years for construction)
- Export: CSV and PDF audit reports
- UI: searchable, filterable audit log page with date range, user, entity type filters

DATA RESIDENCY:
- Support multi-region Supabase deployment
- Allow org admin to select data region (US, EU, AU)
- Ensure all data (including backups and AI processing) stays in selected region

ENCRYPTION:
- At rest: Supabase handles via PostgreSQL encryption
- In transit: TLS 1.3 minimum
- Field-level encryption for sensitive data: SSN (for worker compliance), financial amounts, contract terms
- Encryption key management via Supabase Vault

COMPLIANCE REPORTING:
- Generate SOC 2 Type II evidence automatically from audit trail
- Track access patterns for anomaly detection
- Export compliance reports per project for general contractor requirements

TEST:
- SSO login flow works end-to-end with Okta test account
- Audit trail captures every mutation with correct old/new values
- Audit trail records cannot be deleted or modified
- Export generates valid CSV/PDF
```

---

# PHASE 5: CONSTRUCTION-SPECIFIC MOAT (Week 9-10)

*Features that only make sense for construction. This is the moat.*

---

## PROMPT 5.1 — AIA Payment Applications (G702/G703)

```
OBJECTIVE: Automate AIA G702/G703 payment application workflow. This is the #1 most painful paper process in construction. Automating it is a massive competitive advantage.

AIA G702 (Application and Certificate for Payment):
- Auto-populate from budget data: original contract sum, net change orders, contract sum to date
- Calculate: total completed and stored to date, retainage, total earned less retainage, less previous certificates, current payment due
- Support percentage-of-completion and stored materials methods
- Digital signatures (use existing react-signature-canvas)
- PDF generation matching official AIA format

AIA G703 (Continuation Sheet):
- Line-item breakdown by cost code
- Columns: item number, description of work, scheduled value, work completed (previous, this period), materials presently stored, total completed and stored, percentage, balance to finish, retainage
- Auto-calculate all totals and percentages from budget line items
- Support SOV (Schedule of Values) import from spreadsheet

WORKFLOW:
1. Subcontractor submits G703 line items →
2. GC reviews, adjusts percentages →
3. GC generates G702 summary →
4. Owner reviews and approves →
5. Payment certificate issued →
6. Retainage tracked separately

LIEN WAIVER INTEGRATION:
- Auto-generate conditional lien waivers with payment application
- Track waiver status: pending, conditional, unconditional, final
- State-specific waiver forms (California, Texas, Florida, New York at minimum)
- Block payment processing until waivers are received

DATA MODEL:
CREATE TABLE payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  application_number int NOT NULL,
  period_to date NOT NULL,
  contractor_id uuid REFERENCES directory_companies(id),
  original_contract_sum numeric(14,2),
  net_change_orders numeric(14,2),
  total_completed numeric(14,2),
  retainage_percent numeric(5,2) DEFAULT 10.00,
  retainage_amount numeric(14,2),
  current_payment_due numeric(14,2),
  status text DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  contractor_signature jsonb,
  owner_signature jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE payment_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES payment_applications(id),
  cost_code text NOT NULL,
  description text NOT NULL,
  scheduled_value numeric(14,2),
  previous_completed numeric(14,2) DEFAULT 0,
  this_period numeric(14,2) DEFAULT 0,
  materials_stored numeric(14,2) DEFAULT 0,
  retainage numeric(14,2) DEFAULT 0,
  sort_order int
);

PDF GENERATION:
- Use @react-pdf/renderer (already installed) to generate AIA-formatted PDFs
- Match official AIA form layout exactly
- Include digital signature images
- Support batch generation (all subs for a pay period)

TEST:
- Generate G702 from mock budget data and verify all calculations
- Generate G703 continuation sheet and verify line-item math
- PDF output matches AIA format specifications
- Workflow transitions correctly through all states
- Lien waiver tracking blocks payment when waivers missing
```

---

## PROMPT 5.2 — BIM Viewer and Drawing Intelligence

```
OBJECTIVE: Browser-based BIM/3D model viewer using WebGPU. Construction teams need to view IFC models without installing desktop software.

BIM VIEWER:
- Use Three.js (already installed) with WebGPU renderer for hardware-accelerated 3D
- Support IFC file format (Industry Foundation Classes — the standard for BIM)
- Use web-ifc library for parsing IFC files in the browser
- Features: orbit, pan, zoom, section planes, element selection, property inspection
- Isolate by floor, trade, system (mechanical, electrical, plumbing)
- Clash detection visualization (highlight intersecting elements)
- Measure tool (point-to-point distance in 3D)

DRAWING INTELLIGENCE:
- Upload PDF drawings → AI extracts: sheet number, sheet name, scale, revision, discipline
- OCR (Tesseract.js already installed) for text extraction from drawings
- Auto-link drawings to: specs, RFIs, submittals, punch items by spec section
- Markup tools: cloud, arrow, text, dimension, photo pin
- Markup layers: per user, per trade, per review cycle
- Compare revisions: overlay two drawing versions with difference highlighting

INTEGRATION:
- Link BIM elements to schedule tasks (click a wall → see installation task and status)
- Link BIM elements to RFIs (click an element → see related RFIs)
- Show real-time progress in BIM (color elements by completion percentage)
- Photo pins: place photos at 3D locations in the model

PERFORMANCE:
- Progressive loading: load LOD0 (bounding boxes) first, then LOD1 (geometry), then LOD2 (textures)
- Web Workers for IFC parsing (don't block main thread)
- IndexedDB caching for parsed models (don't re-parse on every visit)
- Target: 10M triangle model loads in < 5 seconds on modern laptop

DATA MODEL:
CREATE TABLE bim_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  element_count int,
  uploaded_by uuid REFERENCES auth.users(id),
  processed boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE bim_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES bim_models(id),
  created_by uuid REFERENCES auth.users(id),
  markup_type text, -- 'measurement', 'note', 'photo_pin', 'clash'
  position jsonb, -- {x, y, z}
  camera_state jsonb, -- save viewpoint for restoring
  data jsonb,
  linked_entity_type text,
  linked_entity_id uuid,
  created_at timestamptz DEFAULT now()
);

TEST:
- Load sample IFC file and verify 3D rendering
- Section plane cuts model correctly
- Element selection shows property panel
- Markup tools create and persist annotations
- Drawing comparison highlights differences between revisions
```

---

## PROMPT 5.3 — Construction Closeout Automation

```
OBJECTIVE: Project closeout is the most document-intensive phase. Automate the entire process.

CLOSEOUT CHECKLIST:
Generate project-specific closeout checklist from contract requirements:
- O&M Manuals (Operation & Maintenance)
- As-built drawings
- Warranty letters (per trade/subcontractor)
- Lien waivers (final, unconditional)
- Certificate of Substantial Completion
- Certificate of Occupancy
- Training records
- Spare parts inventory
- Attic stock delivery
- Commissioning reports
- Final punch list completion
- Final payment application
- Consent of surety

WORKFLOW PER ITEM:
1. Required (from contract parsing) →
2. Requested (notification sent to responsible party) →
3. Submitted (document uploaded) →
4. Under Review (GC/architect reviewing) →
5. Approved (accepted) or Rejected (resubmit required)

AUTOMATION:
- Auto-generate closeout list from project type (commercial, residential, industrial, healthcare)
- Auto-assign responsible parties by trade from directory
- Send automated reminders (7 days, 3 days, 1 day before deadline)
- Track percentage complete per category and overall
- Generate closeout status report for owner

WARRANTY TRACKING:
- Extract warranty periods from submittal data
- Track start date, end date, responsible subcontractor
- Auto-notify before warranty expiration (30 days, 7 days)
- Dashboard showing all active warranties with expiration timeline

COMMISSIONING:
- Functional performance testing checklists
- Equipment start-up verification
- System balancing reports
- Training documentation and sign-off sheets

DATA MODEL:
CREATE TABLE closeout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  category text NOT NULL, -- 'warranty', 'om_manual', 'as_built', 'lien_waiver', etc.
  title text NOT NULL,
  description text,
  responsible_company_id uuid REFERENCES directory_companies(id),
  responsible_contact_id uuid,
  status text DEFAULT 'required',
  due_date date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  document_ids uuid[],
  spec_section text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  item_description text NOT NULL,
  subcontractor_id uuid REFERENCES directory_companies(id),
  warranty_period_months int NOT NULL,
  start_date date,
  end_date date,
  document_id uuid,
  spec_section text,
  status text DEFAULT 'active', -- 'active', 'expiring_soon', 'expired'
  created_at timestamptz DEFAULT now()
);

TEST:
- Generate closeout list for commercial project (should have 50+ items)
- Workflow transitions correctly through all states
- Reminders fire at correct intervals
- Warranty tracking correctly calculates expiration
- Status report shows accurate completion percentages
```

---

# PHASE 6: POLISH AND PERFORMANCE (Week 11-12)

*Apple-quality interactions. Linear-speed performance.*

---

## PROMPT 6.1 — Design System: Animation, Dark Mode, and Haptics

```
OBJECTIVE: Apply Apple HIG principles. Every interaction should feel deliberate, responsive, and delightful.

ANIMATION SYSTEM (Apple pattern):
Create src/lib/animations.ts with Framer Motion variants:

- Page transitions: slide + fade, 200ms, ease-out
- Modal entry: scale from 0.95 + fade, 250ms, spring(stiffness: 300, damping: 30)
- List items: stagger children by 30ms on mount
- Status changes: color crossfade 300ms with subtle scale pulse (1.0 → 1.02 → 1.0)
- Delete: height collapse 200ms + fade out
- Skeleton loading: shimmer effect (gradient animation)
- Toast notifications: slide in from top-right, 300ms spring
- Sidebar expand/collapse: width transition 200ms ease-in-out

RULES:
- Never animate for more than 500ms (feels sluggish)
- Always use will-change on animated properties
- Use transform and opacity only (never animate width/height/top/left — triggers layout)
- Respect prefers-reduced-motion: disable all non-essential animations
- 60fps minimum (use Framer Motion's useReducedMotion hook)

DARK MODE:
- darkColors already defined in theme.ts but NOT activated anywhere
- Create ThemeProvider context that reads system preference + allows manual toggle
- Apply dark colors to every component:
  - Sidebar: already dark, no change needed
  - Cards: dark surface (#1A1F2E), elevated surface (#242938)
  - Text: primary (#F0F0F0), secondary (#A0A4B0), tertiary (#6B7080)
  - Borders: rgba(255,255,255,0.08)
  - Status colors: slightly muted versions for dark backgrounds
- Store preference in localStorage + sync to user profile
- Toggle in TopBar settings dropdown

HAPTIC FEEDBACK (Capacitor, mobile only):
- Import @capacitor/haptics (already installed)
- Light haptic: toggle switches, checkbox, selection change
- Medium haptic: button press, action confirmation
- Heavy haptic: delete confirmation, error state
- Create useHaptics() hook that wraps Capacitor Haptics with platform detection (no-op on web)

MICRO-INTERACTIONS:
- Button press: subtle scale down (0.98) for 100ms
- Card hover: 2px translateY + subtle shadow increase
- Checkbox: spring animation on check mark drawing
- Badge count: bounce animation when number changes
- Pull-to-refresh on mobile lists (Capacitor gesture)

TYPOGRAPHY REFINEMENT:
- Use system font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Size scale: 12, 13, 14, 16, 20, 24, 32 (remove any sizes not in this list)
- Line height: 1.4 for body, 1.2 for headings
- Letter spacing: -0.01em for headings, normal for body

TEST:
- Toggle dark mode and verify every page renders correctly
- Test animations complete in < 500ms
- Test prefers-reduced-motion disables animations
- Test haptic feedback fires on mobile (Capacitor test build)
- Lighthouse performance score ≥ 90 (animations don't impact score)
```

---

## PROMPT 6.2 — Performance and Observability

```
OBJECTIVE: Sentry for errors. Real User Monitoring for performance. Performance budgets that block deploys.

SENTRY INTEGRATION:
- @sentry/react already installed. Configure properly:
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0.01, // 1% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    environment: import.meta.env.MODE,
  })

- Wrap App in Sentry.ErrorBoundary with fallback UI
- Add Sentry.withProfiler to heavy components (Dashboard, BIM Viewer)
- Set user context on login: Sentry.setUser({ id, email, role })
- Add breadcrumbs for navigation, mutations, and AI interactions

REAL USER MONITORING:
- Track Core Web Vitals: LCP, FID, CLS, INP, TTFB
- Send to Sentry Performance or PostHog (already installed)
- Custom metrics:
  - Time to Interactive per page
  - Mutation latency (submit → server response)
  - AI response time
  - Offline sync duration
  - Drawing load time
  - Search query time

PERFORMANCE BUDGETS:
Add to vite.config.ts build configuration:
- Initial JS bundle: < 300KB gzipped
- Per-route chunk: < 100KB gzipped
- CSS: < 50KB gzipped
- Images: WebP format, max 200KB per image
- Fonts: max 2 font files
- Total page weight: < 1MB on first load

CODE SPLITTING:
- Already using React.lazy for routes (good)
- Add lazy loading for heavy components: BIM viewer, PDF viewer, chart libraries, map
- Preload adjacent routes on hover (React Router prefetch)
- Dynamic import for Nivo charts, Recharts, Three.js, MapLibre only when needed

BUILD OPTIMIZATION:
- Add rollup-plugin-visualizer (already in devDeps) to CI pipeline
- Tree-shake unused Lucide icons (only import used icons, not entire library)
- Deduplicate dependencies (check for duplicate React, etc.)
- Enable Vite's build.rollupOptions.output.manualChunks for vendor splitting

CI/CD PIPELINE:
Create .github/workflows/ci.yml:
1. Install dependencies (npm ci)
2. Lint (eslint)
3. Type check (tsc --noEmit)
4. Unit tests (vitest run)
5. Build (vite build)
6. Bundle size check (fail if over budget)
7. E2E tests (Playwright against preview build)
8. Deploy to staging (on PR merge to develop)
9. Deploy to production (on tag/release)

TEST:
- Lighthouse CI score ≥ 90 for performance, accessibility, best practices
- Bundle analyzer shows no unexpected large chunks
- Core Web Vitals meet "good" thresholds (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- Sentry captures errors in production with source maps
```

---

# PHASE 7: GROWTH MOAT (Week 13-16)

*Integrations, marketplace, embedded fintech. The flywheel.*

---

## PROMPT 7.1 — Integration Ecosystem

```
OBJECTIVE: Construction teams use 10-15 tools. SiteSync must integrate with all of them to become the hub.

PRIORITY INTEGRATIONS:

1. ACCOUNTING:
   - QuickBooks Online (REST API, OAuth 2.0)
   - Sage 300 CRE (API or file import)
   - Sync: budget items ↔ cost codes, change orders → journal entries, payment applications → invoices

2. SCHEDULING:
   - Microsoft Project (.mpp import/export via XML)
   - Primavera P6 (XER file import/export)
   - Sync: tasks, dependencies, milestones, resource assignments

3. DOCUMENT STORAGE:
   - Google Drive (API v3)
   - Box (API)
   - SharePoint/OneDrive (Microsoft Graph API)
   - Sync: drawings, submittals, RFI attachments, daily log photos

4. COMMUNICATION:
   - Slack (webhook + bot)
   - Microsoft Teams (webhook + bot)
   - Email (already have Resend)
   - Notifications for: RFI responses, submittal reviews, daily log approvals, schedule changes

5. BIM:
   - Autodesk Construction Cloud (ACC API)
   - BIM 360 (legacy API)
   - Sync: model versions, issues, markups

INTEGRATION FRAMEWORK:
Create src/lib/integrations/ with:
- Base connector class with OAuth flow, token refresh, rate limiting, error handling
- Webhook receiver edge function for incoming events
- Sync engine: full sync on connect, incremental sync on schedule, real-time sync on webhook
- Conflict resolution: SiteSync is source of truth for construction data, external system is source of truth for its native data
- Integration status dashboard: connected/disconnected, last sync, error count, data flow direction

DATA MODEL:
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  provider text NOT NULL, -- 'quickbooks', 'procore', 'slack', etc.
  status text DEFAULT 'connected',
  config jsonb, -- OAuth tokens (encrypted), settings
  last_sync_at timestamptz,
  sync_errors jsonb[],
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id),
  direction text, -- 'inbound', 'outbound'
  entity_type text,
  entity_count int,
  status text, -- 'success', 'partial', 'failed'
  errors jsonb,
  started_at timestamptz,
  completed_at timestamptz
);

TEST:
- OAuth flow connects and stores tokens securely
- Incremental sync correctly identifies changed records
- Conflict resolution follows source-of-truth rules
- Rate limiting respects provider limits (QuickBooks: 500/min, etc.)
- Integration status dashboard shows accurate sync state
```

---

## PROMPT 7.2 — Reporting Engine and Dashboards

```
OBJECTIVE: Construction executives need reports. Build a reporting engine that generates every report a GC or owner needs.

STANDARD REPORTS:

1. PROJECT EXECUTIVE SUMMARY:
   - Overall progress (% complete)
   - Budget summary (original, approved changes, current, committed, forecast)
   - Schedule summary (planned vs actual, days ahead/behind)
   - Open items count (RFIs, submittals, punch items, change orders)
   - Safety metrics (incidents, near-misses, inspection scores)
   - Photo timeline

2. COST REPORT:
   - Budget vs actual by cost code
   - Change order log with approval status
   - Cash flow projection (S-curve)
   - Earned value analysis (CPI, SPI, EAC, ETC, VAC)
   - Contingency burn rate

3. SCHEDULE REPORT:
   - Gantt chart with critical path highlighted
   - 3-week look-ahead
   - Milestone tracker
   - Delay analysis (cause codes, responsible parties)

4. SAFETY REPORT:
   - OSHA recordable incident rate
   - Near-miss frequency
   - Safety inspection scores by trade
   - Corrective action closure rate
   - EMR (Experience Modification Rate) impact

5. SUBCONTRACTOR PERFORMANCE:
   - RFI response times by sub
   - Submittal rejection rates by sub
   - Punch item closure rates by sub
   - Safety record by sub
   - Payment history by sub

REPORT BUILDER:
- Drag-and-drop report builder for custom reports
- Save report templates
- Schedule automated delivery (weekly, monthly)
- Export formats: PDF (via @react-pdf/renderer), Excel (via xlsx library), PowerPoint (via pptx.js)
- White-label: customizable logo, colors, header/footer

DASHBOARD FRAMEWORK:
- Use react-grid-layout (already installed) for customizable dashboards
- Pre-built widgets: metric card, trend chart, pie chart, table, calendar, map
- Save dashboard layouts per user per project
- Real-time data refresh (combine with Phase 2 realtime subscriptions)

TEST:
- Every standard report generates correctly from test data
- PDF export matches professional formatting standards
- Dashboard layouts save and restore correctly
- Scheduled reports generate and email on time
- Custom report builder creates valid report definitions
```

---

## PROMPT 7.3 — Embedded Fintech and Monetization

```
OBJECTIVE: Embedded financial services are the highest-margin revenue stream in vertical SaaS. Construction payments are $1.9 trillion annually.

PAYMENT PROCESSING:
- Integrate Stripe Connect for construction payments
- GC pays subcontractor through SiteSync (0.5-1.5% processing fee)
- Tied to payment application workflow (Phase 5.1)
- Hold/release retainage through platform
- ACH transfers for large amounts (lower fees)

LIEN WAIVER MANAGEMENT:
- Auto-generate state-specific lien waivers
- Conditional → Unconditional conversion on payment clearance
- Compliance tracking: block payments without matching waivers
- Digital signatures with audit trail

INSURANCE VERIFICATION:
- Upload and parse COI (Certificate of Insurance) documents
- Track expiration dates and coverage amounts
- Auto-notify subcontractors when COI expires
- Block non-compliant subs from working on site

PRICING MODEL (Procore pattern: ACV based on project volume):
- Starter: $0/month, 1 project, 5 users, basic features
- Professional: $499/month, 5 projects, 25 users, AI copilot, integrations
- Enterprise: Custom pricing, unlimited projects, SSO, API, dedicated support, SLA
- Per-transaction fees on payment processing (0.5-1.5%)
- Per-document fees on AI document processing ($0.10/page)

IMPLEMENTATION:
- Create billing module in Supabase: plans, subscriptions, usage_tracking tables
- Stripe subscription integration for recurring billing
- Usage-based billing tracking for AI and document processing
- In-app upgrade prompts when hitting plan limits
- Admin dashboard for org billing management

TEST:
- Payment flow end-to-end (create application → approve → process payment → update status)
- Lien waiver auto-generation produces legally valid documents
- Insurance expiration alerts fire correctly
- Subscription upgrade/downgrade works correctly
- Usage tracking accurately counts billable events
```

---

# EXECUTION RULES

1. **Fix Phase 1 bugs BEFORE starting Phase 2.** The foundation must be solid.
2. **Every prompt is self-contained.** Paste the System Context + one prompt at a time.
3. **Every prompt ends with tests.** No prompt is complete without passing tests.
4. **Zero `as any` casts.** Use proper TypeScript generics and type guards.
5. **Every mutation follows the pattern:** permission check → validate → execute → invalidate cache → audit → toast → handle error.
6. **Every page follows the pattern:** skeleton loading → error boundary → empty state → data display → real-time subscription.
7. **Mobile-first design.** Test every page at 375px before desktop.
8. **Keyboard-first interaction.** Every action reachable without a mouse.
9. **Measure everything.** If it's not in Sentry or PostHog, it doesn't exist.
10. **Ship weekly.** Each phase = 2 weeks = deployable increment.

---

# SUCCESS METRICS

| Metric | Current | Phase 1 Target | Phase 7 Target |
|--------|---------|---------------|----------------|
| Mutations with permission checks | 0% | 100% | 100% |
| Mutations with audit trail | ~10% | 100% | 100% |
| Mutations with cache invalidation | ~60% | 100% | 100% |
| Mutations with error handling | 0% | 100% | 100% |
| Pages with real-time subscriptions | 0% | 100% | 100% |
| State machine bugs | 5 | 0 | 0 |
| Edge function RLS bypass | 4/4 | 0/4 | 0/4 |
| Offline sync reliability | Broken | 99.5% | 99.9% |
| Test coverage | ~5% | 40% | 80% |
| Lighthouse performance | Unknown | ≥ 85 | ≥ 95 |
| Core Web Vitals (LCP) | Unknown | < 2.5s | < 1.5s |
| Bundle size (initial) | Unknown | < 400KB | < 300KB |
| API endpoints | 0 | 0 | 30+ |
| Integrations | 0 | 0 | 5+ |
| AIA G702/G703 automation | Manual | Digital | AI-assisted |

---

# COMPETITIVE POSITIONING

| Feature | SiteSync V3 | Procore | Autodesk Build | Fieldwire |
|---------|------------|---------|---------------|-----------|
| AI Copilot with Voice | ✅ | Helix (limited) | Construction IQ | ❌ |
| Agent Builder | ✅ | Helix Agent Builder | ❌ | ❌ |
| Offline-First | ✅ | Partial | Partial | ✅ |
| Browser BIM Viewer | ✅ (WebGPU) | Via ACC | Forge Viewer | ❌ |
| AIA G702/G703 | ✅ Automated | Manual | ❌ | ❌ |
| Keyboard-First UX | ✅ (Linear-style) | ❌ | ❌ | ❌ |
| Open Public API | ✅ (Stripe-quality) | REST API | REST API | REST API |
| Real-Time Collaboration | ✅ (Figma-quality) | Basic | Basic | Basic |
| Embedded Payments | ✅ | ❌ | ❌ | ❌ |
| Closeout Automation | ✅ | Basic checklist | ❌ | ❌ |
| Dark Mode | ✅ | ❌ | ❌ | ❌ |

---

*This prompt was generated from a line-by-line audit of 211 TypeScript files, 32 database migrations, 9 edge functions, 6 state machines, cross-referenced with architectural patterns from Stripe, Figma, Linear, and Apple, competitive analysis of Procore ($1.3B revenue), vertical SaaS growth playbooks from Veeva, Toast, and ServiceTitan, and emerging construction technology research.*
