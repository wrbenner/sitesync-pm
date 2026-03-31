# SiteSync AI — V4 Master Build Prompt

## Miles Ahead: The Category-Killer Playbook

**Audit Date:** March 30, 2026
**Scope:** 211+ TypeScript files, 32+ migrations, 9+ edge functions, 37+ pages, 6 state machines, full offline/sync layer, permissions system, AI functions, infrastructure config, CI/CD pipeline. Cross-referenced with: Procore Q4 2025 earnings ($1.323B revenue, NVIDIA digital twin partnership, Datagrid acquisition, FedRAMP authorization), multi-agent orchestration frameworks, generative UI protocols, digital twin platforms, spatial computing, embedded finance 2.0, construction workforce automation, PWA 2.0 architecture.

---

## THE COMPETITIVE REALITY (March 2026)

Procore is no longer just a project management tool. In the last 90 days they:
- **Partnered with NVIDIA** to build real-time digital twins using Omniverse DSX Blueprint (15+ BIM/CAD formats)
- **Acquired Datagrid** for AI reasoning across multi-source construction data
- **Launched Agent Builder** in open beta (2,000 customers, 14,000 MAUs on Helix AI)
- **Integrated United Rentals** telematics (equipment data flows into their platform)
- **Achieved FedRAMP Moderate** (entire government market unlocked)
- **Guiding $1.49B revenue** for 2026 (13% YoY growth, 17.5-18% operating margin)

To be miles ahead, we don't compete with where Procore is. We compete with where they CAN'T go because of their architecture, their legacy, and their pricing model.

**Our structural advantages:**
1. **AI-native from day one** — not bolted on. Every screen, every workflow, every decision has AI woven in.
2. **Modern stack** — React 19, Supabase, edge functions. We ship in days what takes their monolith months.
3. **Field-first** — built for the superintendent with dirty gloves, not the VP in the trailer.
4. **Open platform** — Stripe-quality API from the start, not an afterthought.
5. **Embedded fintech** — we don't just manage construction, we finance it.

---

## V4 HONEST ASSESSMENT

V3 implementation delivered real progress but the deep audit found **90+ remaining issues**:

| System | Status | Remaining Issues |
|--------|--------|-----------------|
| **Frontend Pages** | 60% complete | Mock data in 6+ pages. Zero WCAG compliance. Missing form modals for core workflows (New Submittal, Edit Punch Item). No real empty states. 5 instances of useMemo in 21K lines. |
| **Permissions** | Partially fixed | PermissionGate component exists but NOT used on any page. Dev bypass may still activate. RLS policies incomplete on UPDATE/DELETE. |
| **AI Edge Functions** | Partially fixed | Service role key still used in ai-insights. Prompt injection vectors in ai-chat. Agent auto-execute still possible. No message length limits. |
| **Offline Sync** | Improved | Upload queue never processed for non-image files. Missing tables in Dexie (meetings, fieldCaptures). Conflict resolution overwrites server metadata. |
| **State Machines** | Partially fixed | Change order RETURN_TO_PCO event defined but handler missing. Daily log draft→resubmit flow broken. |
| **Infrastructure** | Improved | No CSP headers. PDF.js RCE vulnerability. No SAST in CI. Test coverage threshold only 60%. Package version 0.0.0. Missing Prettier. No accessibility linting. |
| **Real-Time** | Started | Subscription hook exists but no presence indicators in UI. No reconnection UI. No visual indicator of real-time status. |
| **Mobile** | Scaffolded | Capacitor config exists but missing deep linking, allowNavigation incomplete, no signing config. Camera/photo capture simulated, not real. |

---

## SYSTEM CONTEXT — Paste Before Every Session

```
You are the founding CTO of SiteSync AI, building the construction industry's first AI-native operating system. Your competition just partnered with NVIDIA for digital twins and acquired an AI data company. You must be MILES ahead, not catching up.

Your standard is not "working" — it is world-class. Every file must be better than Procore, faster than Linear, more polished than Apple, more developer-friendly than Stripe.

STACK: React 19 + TypeScript 5.9 + Vite 8 + Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) + TanStack React Query 5 + Zustand 5 + XState 5 + Framer Motion 12 + Radix UI + Capacitor 8

ARCHITECTURE RULES (NEVER VIOLATE):
1. ZERO mock data in production paths. If you see hardcoded arrays, fake names, or simulated data — DELETE IT and replace with real queries or proper empty states. This is the #1 priority.
2. Every mutation: permission check → Zod validate → execute → invalidate ALL related caches → audit trail → toast → onError rollback. No exceptions.
3. Every page: error boundary → loading skeleton → empty state (illustration + CTA) → data display → real-time subscription → keyboard navigation.
4. Every action button wrapped in <PermissionGate>. Every route wrapped in <ProtectedRoute>.
5. Every list: search, filter, sort, cursor-based pagination, virtualization at 100+ items.
6. Every form: Zod schema validation, field-level errors, auto-save drafts to IndexedDB, submit loading state.
7. All styling from theme.ts tokens. ZERO hardcoded hex values, pixel values, or magic numbers.
8. All types from entities.ts. ZERO `as any`. Use generics, discriminated unions, and type guards.
9. State machines govern all workflows. UI reads machine state. UI NEVER manages workflow transitions.
10. Mobile: 44px touch targets, offline-first, 375px minimum, haptic feedback via Capacitor.
11. Real-time: every list subscribes to Supabase Realtime. Presence indicators on detail views.
12. Accessibility: WCAG 2.1 AA. Every interactive element has aria-label. Every modal traps focus. Every toast is aria-live. Color contrast ≥ 4.5:1. Keyboard navigable.
13. Edge functions: authenticated user client ONLY (never service role for user-initiated ops). Validate all inputs. Sanitize all outputs. Rate limit everything.
14. Performance: FCP < 1.2s, LCP < 2.0s, TTI < 3s, CLS < 0.05, INP < 150ms. Bundle < 250KB initial.
15. Every component wrapped in React.memo where props are stable. useMemo for derived data. useCallback for event handlers passed as props.
16. Generative UI: AI responses render as interactive React components, not just text. Forms, charts, tables, and approval buttons generated dynamically from AI tool calls.
```

---

# PHASE 0: PRODUCTION BLOCKERS (Week 1)

*These must be fixed before ANY other work. The app cannot ship with mock data, no accessibility, and missing form modals.*

---

## PROMPT 0.1 — Nuclear Option: Eliminate Every Last Piece of Mock Data

```
OBJECTIVE: Find and destroy every piece of mock, fake, hardcoded, or simulated data in the entire codebase. Replace with real Supabase queries or proper empty states.

THIS IS YOUR ONLY TASK. Do not stop until there is ZERO mock data anywhere.

KNOWN LOCATIONS (from V4 audit):
1. RFIs.tsx (~lines 33-45): Hardcoded commentCounts, drawingRefs, ballInCourt Records
2. Submittals.tsx (~lines 27-69): mockDescriptions, reviewTimelines, specSections, reviewCycles, leadTimes
3. PunchList.tsx (~lines 74-96): mockComments with fake team member conversations
4. DailyLog.tsx (~lines 56-74): Stub photo URLs and static weather arrays
5. FieldCapture.tsx (~lines 138-142): Hardcoded "AI Analysis: 85%" message
6. AICopilot.tsx (~lines 55-57): Mocked conversationHistory with no persistence
7. data/aiAnnotations.ts: Entire file is mock AI annotations — used by AIAnnotation components
8. PredictiveAlert components: Powered by mock prediction data
9. Dashboard.tsx: Check for hardcoded metric values

SEARCH STRATEGY:
Run these searches across the ENTIRE src/ directory:
- grep -rn "mock" src/ --include="*.ts" --include="*.tsx"
- grep -rn "fake" src/ --include="*.ts" --include="*.tsx"
- grep -rn "hardcoded" src/ --include="*.ts" --include="*.tsx"
- grep -rn "TODO.*real" src/ --include="*.ts" --include="*.tsx"
- grep -rn "placeholder" src/ --include="*.ts" --include="*.tsx"
- grep -rn "Lorem" src/ --include="*.ts" --include="*.tsx"
- grep -rn "John\|Jane\|Sarah\|Mike" src/ --include="*.ts" --include="*.tsx" (common fake names)
- Look for any array defined inline with 3+ objects that contain string values like names, descriptions, etc.

FOR EACH MOCK DATA INSTANCE:
a) If there's a real database table for this data → create a React Query hook and fetch it
b) If the data doesn't exist in the database yet → create the migration, table, and query
c) If it's supplementary display data (like comment counts) → derive from real relationships (COUNT queries)
d) If it's AI-generated data → show "AI analysis pending" until real AI processing runs

EMPTY STATES (when no data exists):
Every page needs a proper empty state component:
<EmptyState
  icon={<FileQuestion size={48} />}
  title="No RFIs yet"
  description="Create your first RFI to start tracking questions and responses."
  action={<Btn onClick={handleCreate}>Create RFI</Btn>}
/>

TEST: grep -rn "mock\|Mock\|MOCK\|fake\|Fake\|hardcode\|placeholder\|Lorem\|dummy" src/ must return ZERO results (excluding test files).
```

---

## PROMPT 0.2 — WCAG 2.1 AA Compliance Across Entire App

```
OBJECTIVE: The app has ZERO accessibility attributes. No aria-labels, no focus management, no keyboard traps, no screen reader support. Fix everything.

STEP 1 — Install and configure accessibility linting:
npm install -D eslint-plugin-jsx-a11y

Add to eslint.config.js:
import jsxA11y from 'eslint-plugin-jsx-a11y'
// Add jsxA11y.flatConfigs.recommended to configs array

Run eslint and fix EVERY warning and error.

STEP 2 — Fix Primitives.tsx (the shared component library):
Every component in this file is used across all pages. Fixing here fixes everywhere.

Btn component:
- Add aria-label when button has only an icon (no text children)
- Add aria-disabled when disabled prop is true
- Add role="button" if rendered as a non-button element

Card component:
- Add role="region" with aria-labelledby pointing to card title
- Make clickable cards have role="link" or role="button" with tabIndex={0} and onKeyDown={Enter/Space}

DetailPanel / Modal:
- Trap focus inside when open (use @radix-ui/react-focus-scope or custom hook)
- Return focus to trigger element on close
- Add aria-modal="true" and role="dialog"
- Add aria-labelledby pointing to panel title
- Close on Escape key

Tables:
- Add role="table", role="row", role="columnheader", role="cell"
- Add aria-sort on sortable columns
- Add aria-selected on selected rows

Forms:
- Every input MUST have a <label> with htmlFor OR aria-label
- Error messages linked via aria-describedby
- Required fields marked with aria-required="true"
- Form groups wrapped in <fieldset> with <legend>

STEP 3 — Fix every page component:
- Add <main> landmark to page content area
- Add <nav> landmark to sidebar
- Add <header> landmark to top bar
- Add aria-live="polite" to toast container
- Add aria-live="assertive" to error messages
- Add skip-to-content link (if not already present — check App.tsx)

STEP 4 — Color contrast audit:
- Orange (#F47820) on white background: contrast ratio 3.13:1 — FAILS AA for normal text
- FIX: Use darker orange (#D4691A or similar) for text. Keep #F47820 for backgrounds/buttons only where text is white.
- Run all status colors through contrast checker
- Ensure dark mode colors also meet 4.5:1 minimum

STEP 5 — Keyboard navigation:
- Every interactive element must be reachable via Tab
- Every custom dropdown, select, autocomplete must support arrow keys
- Every modal must trap focus
- Focus rings must be visible (2px solid, offset 2px, using brand color)
- Never use outline: none without an alternative focus indicator

TEST:
- Run axe-core browser extension on every page
- Navigate entire app using only keyboard
- Test with VoiceOver (macOS) or NVDA (Windows)
- Verify Lighthouse Accessibility score ≥ 95
```

---

## PROMPT 0.3 — Complete Missing Form Modals and Workflows

```
OBJECTIVE: Core creation workflows are broken. "New Submittal" shows a toast instead of a form. Punch list items can't be created from the UI. Detail panels show data but can't edit it. Fix all of them.

MISSING FORMS (create a reusable pattern):

Create src/components/forms/EntityFormModal.tsx — a generic modal form component:
- Props: title, schema (Zod), fields config, onSubmit, entity type
- Features: field-level validation, auto-save draft to IndexedDB, loading state on submit, error display
- Accessibility: focus trap, aria-modal, aria-labelledby, Escape to close

Then create specific form modals:

1. CreateRFIModal — fields: subject, question, assignee, due_date, spec_section, drawing_ref, priority
2. CreateSubmittalModal — fields: title, spec_section, type, subcontractor, due_date, description
3. CreatePunchItemModal — fields: title, location, assignee, priority, due_date, description, photo
4. CreateDailyLogModal — fields: date, weather, crew_entries[], activity_entries[], safety_notes
5. CreateChangeOrderModal — fields: title, type (PCO/COR/CO), description, amount, cost_codes[], justification
6. CreateMeetingModal — fields: title, date, time, location, attendees[], agenda
7. CreateTaskModal — fields: title, assignee, start_date, end_date, predecessor_ids[], priority

EDIT MODE for detail panels:
Every DetailPanel must have an "Edit" button that:
a) Transforms display fields into editable form fields
b) Shows Save/Cancel buttons
c) Validates changes via Zod before saving
d) Calls mutation hook with permission check
e) Shows optimistic update then reverts on error

INLINE TABLE EDITING:
For tables with editable cells (status, assignee, priority):
- Click cell → transforms to dropdown/input
- Tab to next editable cell
- Enter to save, Escape to cancel
- Optimistic update with rollback

BULK ACTIONS:
When multiple items selected (via checkbox or Shift+click):
- Floating action bar appears at bottom
- Actions: Change Status, Reassign, Change Priority, Delete
- Confirmation dialog for destructive actions
- Progress indicator for batch operations

TEST:
- Create an RFI from scratch through the modal → verify it appears in list
- Edit an RFI through detail panel → verify changes persist
- Inline-edit a task status → verify cache updates and other users see change
- Bulk-select 5 punch items → change status → verify all updated
```

---

## PROMPT 0.4 — Hardcoded Colors, Missing Memoization, and Design System Violations

```
OBJECTIVE: Eliminate every design system violation. Add memoization to prevent wasted renders.

HARDCODED COLORS TO FIX:
Search: grep -rn "#[0-9a-fA-F]\{3,8\}" src/ --include="*.tsx" --include="*.ts" | grep -v theme | grep -v node_modules

Known violations:
- App.tsx (~line 333): #F47820 in Sentry fallback
- RFIs.tsx (~line 201): #4A9EE8 for pending status
- PunchList.tsx (~line 104): #A09890 for icon color
- PunchList.tsx (~line 228): #6B6560 and #1A1613 in empty state
- DailyLog.tsx (~line 62): #8B5E3C for Carpentry color
- Submittals.tsx (~line 270): colors.red instead of colors.statusCritical
- OfflineBanner.tsx: hardcoded status dot colors

RULE: Every color MUST come from theme.ts. If a color doesn't exist in the theme, ADD it to the theme first, then reference it.

For trade-specific colors (Carpentry, Electrical, Plumbing), add a tradeColors map to theme.ts:
export const tradeColors = {
  carpentry: colors.warmSurface[600],
  electrical: colors.brand[500],
  plumbing: colors.statusInfo,
  concrete: colors.warmSurface[500],
  // etc.
}

MEMOIZATION (add across all pages):
The app has 5 instances of useMemo in 21K lines of component code. Target: every derived value, every array/object creation in render.

Pattern for every page component:
// BEFORE (re-creates every render)
const columns = kanbanStatuses.map(s => ({ id: s, items: data.filter(d => d.status === s) }))

// AFTER
const columns = useMemo(() =>
  kanbanStatuses.map(s => ({ id: s, items: data.filter(d => d.status === s) })),
  [data]
)

Apply to:
- Dashboard.tsx: memoize all metric calculations
- RFIs.tsx: memoize kanban columns
- Submittals.tsx: memoize kanban columns
- ChangeOrders.tsx: memoize computed metrics
- PunchList.tsx: memoize filtered/sorted lists
- Schedule.tsx: memoize Gantt data transformations
- Budget.tsx: memoize financial calculations

React.memo() for child components:
- Wrap all table row components in React.memo
- Wrap all card components in React.memo
- Wrap MetricBox, StatusBadge, and other primitives used in lists

useCallback for event handlers:
- Wrap all onClick, onChange, onSubmit handlers that are passed as props
- Especially handlers in list renderers (map callbacks)

TEST:
- React DevTools Profiler shows zero unnecessary re-renders on state change
- grep for hex color codes returns zero results outside theme.ts
- Lighthouse Performance score ≥ 90
```

---

# PHASE 1: FINISH THE FOUNDATION (Week 2-3)

*Complete what V3 started. Every system must be bulletproof.*

---

## PROMPT 1.1 — Complete Permission Enforcement End-to-End

```
OBJECTIVE: PermissionGate exists but is NOT used on any page. Fix this across the ENTIRE app.

STEP 1 — Wrap every action button on every page:
Search for every <Btn onClick=... that performs a mutation (create, edit, delete, approve, reject).
Wrap each one in <PermissionGate permission="entity.action">.

Example:
// BEFORE
<Btn onClick={handleCreateRFI}>New RFI</Btn>

// AFTER
<PermissionGate permission="rfis.create">
  <Btn onClick={handleCreateRFI}>New RFI</Btn>
</PermissionGate>

Apply to ALL pages. The complete permission map:

rfis: create, update, delete, void (admin only)
submittals: create, update, delete, approve (admin/PM only)
tasks: create, update, delete, assign
punch_items: create, update, delete, verify (GC only)
daily_logs: create, update, submit, approve (admin/super), reject
change_orders: create, update, delete, approve (admin/owner only), promote
budget: view (super+), edit (PM+), approve (admin+)
meetings: create, update, delete
files: upload, download, delete
directory: create, update, delete
crews: create, update, delete
drawings: upload, markup, delete

STEP 2 — Wrap every route in App.tsx with ProtectedRoute:
<Route path="/budget" element={
  <ProtectedRoute requiredPermission="budget.view">
    <Budget />
  </ProtectedRoute>
} />

STEP 3 — Complete RLS policies in Supabase:
For EVERY table, add UPDATE and DELETE policies using has_project_permission():

CREATE POLICY "members_can_update_rfis" ON rfis FOR UPDATE USING (
  has_project_permission(project_id, auth.uid(), 'rfis.update')
);
CREATE POLICY "members_can_delete_rfis" ON rfis FOR DELETE USING (
  has_project_permission(project_id, auth.uid(), 'rfis.delete')
);

Repeat for: submittals, tasks, punch_items, daily_logs, change_orders, budget_items, meetings, files, crews, drawings, incidents, safety_inspections, corrective_actions, payment_applications, closeout_items, warranties.

STEP 4 — Fix remaining edge function auth issues:
- ai-insights: Add CRON-only header check (only callable by Supabase scheduler)
- ai-chat: Add message array length limit (max 50). Validate projectContext fields.
- agent-runner: Remove auto-execute entirely. ALL actions require human approval.

STEP 5 — Fix stale permissions:
Reduce staleTime to 30 seconds.
Add Supabase Realtime subscription on project_members table to invalidate instantly on role change.

TEST:
- Log in as viewer → verify all create/edit/delete buttons hidden
- Log in as subcontractor → verify budget page returns 403
- Try direct API call as viewer for admin operation → verify RLS blocks it
- Change user role → verify permissions update within 30 seconds
```

---

## PROMPT 1.2 — Complete Real-Time and Presence System

```
OBJECTIVE: Subscription hooks exist but no visual indicators. Users don't see who else is online or what they're viewing. Fix this.

PRESENCE INDICATORS:
Create src/components/PresenceAvatars.tsx:
- Show circular avatar stack of users currently viewing the same page/entity
- Tooltip shows user name and what they're doing ("Sarah Chen — viewing", "Mike R — editing")
- Animate in/out with Framer Motion (200ms spring)
- Max 5 avatars, then "+3" overflow badge

Add PresenceAvatars to:
- Every detail panel header (show who's viewing this RFI/submittal/task)
- Every page header (show who's on this page)
- Entity rows in lists (small dots showing "someone is viewing this")

REAL-TIME VISUAL FEEDBACK:
When another user makes a change, show it:
- New item appears: slide-in animation with subtle green glow (1s), then normal
- Item updated: brief yellow flash (0.5s) on the changed fields
- Item deleted: red fade-out animation (0.3s)

CONNECTION STATUS:
Add to TopBar or StatusBar:
- Green dot: "Connected" (real-time active)
- Yellow dot: "Reconnecting..." (subscription dropped, attempting reconnect)
- Red dot: "Offline" (no connection, queuing changes)
- Click to expand: show sync status, pending changes count, last sync time

EDITING LOCKS:
When user A opens entity for editing:
- Broadcast via presence: { action: 'editing', entityType: 'rfi', entityId: '...' }
- User B sees banner: "Sarah is editing this RFI. Your changes may be overwritten."
- When user A saves or closes, broadcast { action: 'viewing' }
- If user A disconnects without saving, lock releases after 30 seconds

TEST:
- Open same RFI in two browser tabs → verify presence avatars show both users
- Edit in tab A → verify tab B shows yellow flash on changed field within 2 seconds
- Disconnect tab A network → verify tab B removes presence avatar within 30 seconds
- Test reconnection: disable/enable network → verify subscription restores without page reload
```

---

# PHASE 2: GENERATIVE UI AND MULTI-AGENT AI (Week 4-6)

*This is where we go miles ahead. Nobody in construction has this.*

---

## PROMPT 2.1 — Generative UI: AI That Renders, Not Just Responds

```
OBJECTIVE: When the AI copilot responds, it doesn't just send text. It renders interactive React components — forms, charts, approval buttons, data tables — directly in the chat interface. This is the 2026 frontier that Procore can't match.

CONCEPT: Generative UI means the AI's tool calls render as rich UI components in the chat stream. When the user asks "Show me overdue RFIs", instead of a text list, they see a fully interactive table with sort, filter, and action buttons.

IMPLEMENTATION:

1. Define AI tools that return structured UI descriptions:

// In ai-chat edge function, add tool response format:
{
  tool: "render_rfi_table",
  result: {
    ui_type: "data_table",
    columns: ["RFI #", "Subject", "Status", "Days Open", "Ball in Court"],
    data: [...actual RFI data from query...],
    actions: [
      { label: "Approve", action: "approve_rfi", requiresPermission: "rfis.update" },
      { label: "Reassign", action: "reassign_rfi", requiresPermission: "rfis.update" }
    ],
    filters: ["status", "assignee", "priority"]
  }
}

2. Create src/components/ai/GenerativeUIRenderer.tsx:
- Takes AI tool response and renders the appropriate React component
- Supported UI types:
  - data_table: Interactive sortable/filterable table with action buttons
  - metric_cards: Row of KPI cards with trend arrows
  - form: Dynamic form with validation (for "Create an RFI about..." requests)
  - chart: Recharts-based visualization (bar, line, pie)
  - approval_card: Entity card with Approve/Reject buttons that execute real mutations
  - timeline: Chronological event list
  - comparison: Side-by-side entity comparison
  - checklist: Interactive checklist with completion tracking

3. Modify AICopilot.tsx to render GenerativeUI:
- When AI response includes tool_use with ui_type, render the component instead of text
- Components are interactive — clicking "Approve" actually calls the mutation
- Permission gates still apply on action buttons
- Real-time: if another user approves while you're looking at the card, it updates

4. AI-initiated forms:
User: "Create an RFI for the HVAC conflict on level 3"
AI: Renders a pre-filled RFI form with:
  - Subject: "HVAC Conflict — Level 3" (editable)
  - Question: AI-drafted description (editable)
  - Assignee: suggested based on spec section
  - Due date: suggested based on project schedule
  - Submit button that calls useCreateRFI mutation

5. AI-initiated dashboards:
User: "Give me a project health overview"
AI: Renders a mini-dashboard with:
  - 4 metric cards (budget health, schedule health, safety score, quality score)
  - Risk items table
  - Upcoming milestones timeline
  - All interactive and clickable (navigate to full page)

TECHNOLOGY:
- Use Vercel's json-render pattern (open sourced Jan 2026) for structured UI descriptions
- AI returns JSON schema → frontend maps to React components
- Type-safe: define TypeScript discriminated unions for each UI type
- Lazy-load heavy renderers (chart components only loaded when needed)

TEST:
- Ask "Show me overdue RFIs" → renders interactive table, not text
- Ask "Create a punch item for broken tile in lobby" → renders pre-filled form
- Click Approve on a rendered approval card → mutation fires, card updates
- Ask "Compare this month vs last month" → renders chart with real data
```

---

## PROMPT 2.2 — Multi-Agent Orchestration: Specialized AI Crews

```
OBJECTIVE: Replace the single AI chat with a team of specialized agents that collaborate. A schedule agent, a safety agent, a cost agent, a compliance agent — each expert in their domain, orchestrated by a coordinator.

ARCHITECTURE (based on 2026 multi-agent patterns):

Coordinator Agent:
- Receives user request
- Routes to appropriate specialist agent(s)
- Aggregates responses
- Handles conflicts between agent recommendations

Specialist Agents:

1. SCHEDULE AGENT:
   - Tools: query_tasks, query_schedule, predict_delays, analyze_critical_path
   - Expertise: Gantt analysis, look-ahead scheduling, delay forensics, weather impact
   - Can suggest task reordering, flag float consumption, predict completion date

2. COST AGENT:
   - Tools: query_budget, query_change_orders, earned_value_analysis, forecast_costs
   - Expertise: EVM (CPI/SPI/EAC), cash flow projection, contingency tracking
   - Can draft change orders, flag budget overruns, project final cost

3. SAFETY AGENT:
   - Tools: query_incidents, query_inspections, analyze_safety_photos, query_weather
   - Expertise: OSHA compliance, PPE detection, hazard identification, EMR calculation
   - Can generate JHA (Job Hazard Analysis), flag unsafe conditions, track corrective actions

4. QUALITY AGENT:
   - Tools: query_punch_items, query_submittals, query_inspections, analyze_rework
   - Expertise: Punch list management, submittal review, QA/QC checklists
   - Can predict rework risk, suggest inspection schedules, track deficiency trends

5. COMPLIANCE AGENT:
   - Tools: query_certifications, query_insurance, query_payroll, check_prevailing_wage
   - Expertise: Davis-Bacon compliance, certified payroll, lien waivers, insurance tracking
   - Can flag expiring COIs, verify wage rates, generate compliance reports

6. DOCUMENT AGENT:
   - Tools: search_documents, extract_from_pdf, cross_reference_specs, generate_report
   - Expertise: Spec section lookup, drawing cross-reference, report generation
   - Can find relevant spec sections for RFIs, cross-reference drawings, generate closeout docs

IMPLEMENTATION:

Create supabase/functions/agent-orchestrator/index.ts:
- Receives user message + context
- Uses Claude to classify intent → routes to specialist(s)
- Specialist agents run in parallel when possible
- Coordinator synthesizes responses
- Each agent has its own system prompt with domain expertise
- Each agent has access only to tools relevant to its domain (principle of least privilege)

Agent definition in database:
CREATE TABLE ai_agents (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL, -- 'schedule', 'cost', 'safety', 'quality', 'compliance', 'document'
  system_prompt text NOT NULL,
  tools text[] NOT NULL, -- allowed tool names
  is_active boolean DEFAULT true
);

Multi-agent conversation in UI:
- Show which agent is responding (avatar + label: "Schedule Agent")
- When multiple agents contribute, show threaded responses
- User can @mention specific agent: "@cost what's the EAC for this project?"
- Agent handoffs visible: "Let me route this to the Safety Agent for the PPE analysis"

HUMAN-IN-THE-LOOP:
- ALL agent actions that modify data require human approval
- Show action preview before executing
- Batch approve/reject for multiple suggestions
- Audit trail records which agent suggested what

TEST:
- Ask "How's the project doing?" → coordinator routes to schedule + cost + safety agents → each provides domain-specific insight → coordinator synthesizes into unified response
- Ask "@safety are there any PPE violations this week?" → routes directly to safety agent
- Agent suggests rescheduling 3 tasks → shows preview → user approves → mutations execute
```

---

## PROMPT 2.3 — Voice-First Field Intelligence

```
OBJECTIVE: Build the most advanced voice capture system in construction tech. A superintendent walks the site, talks into their phone, and SiteSync creates structured data from natural speech — in English or Spanish.

VOICE CAPTURE ENGINE:

1. Real-time transcription:
- Use Web Speech API (SpeechRecognition) for on-device transcription
- Fallback to Deepgram or AssemblyAI API for noisy environments
- Show live transcription with word-by-word highlighting
- Support continuous mode (keep recording until user stops)

2. Multilingual support:
- English and Spanish as primary languages (80% of US construction workforce)
- Auto-detect language from first few words
- Mixed-language support (Spanglish is common on job sites)
- Construction vocabulary fine-tuning: "mud" = drywall compound, "J-box" = junction box, "mudsill" = foundation plate

3. AI structured extraction:
User says: "Concrete pour on level three east wing, about 80 percent done. Had six guys from Acme Concrete. Weather was clear, 72 degrees. Noticed a rebar spacing issue near column C4, need an RFI on that."

AI extracts and confirms:
{
  daily_log: {
    activities: [{ trade: "Concrete", location: "Level 3 East Wing", progress: 80 }],
    crew: [{ company: "Acme Concrete", headcount: 6 }],
    weather: { condition: "clear", temp_f: 72 }
  },
  rfi_draft: {
    subject: "Rebar Spacing Issue at Column C4",
    location: "Level 3 East Wing, Column C4",
    question: "Rebar spacing near column C4 appears inconsistent with structural drawings. Please clarify correct spacing requirements.",
    priority: "high"
  }
}

4. Confirmation UX:
- Show extracted data as editable cards
- User can tap to correct any field
- "Confirm All" button creates all entries with one tap
- Audio playback button to re-listen to original recording

5. Photo + Voice combo:
- User takes photo of issue, then describes it verbally
- AI combines photo analysis (Claude Vision) with voice description
- Auto-tags photo with location, trade, issue type
- Links photo to generated RFI/punch item

6. Offline voice capture:
- Record audio and cache locally when offline
- Process transcription and extraction when back online
- Queue all created entities for sync

IMPLEMENTATION:
- src/components/field/VoiceCapture.tsx — main voice capture component
- src/lib/voiceProcessor.ts — handles transcription + AI extraction
- Integrate with existing FieldCapture.tsx page
- Add voice button to every "Create" modal (microphone icon next to form fields)

TEST:
- Record 5 different daily log descriptions → verify correct structured extraction
- Test in noisy environment (play construction sounds in background)
- Test Spanish input: "Vaciado de concreto en el nivel tres, ala este, 80 por ciento completado"
- Test offline: record voice → go offline → come back online → verify data syncs
- Test mixed language: "The drywall guys finished las paredes del segundo piso"
```

---

# PHASE 3: DIGITAL TWIN AND SPATIAL INTELLIGENCE (Week 7-8)

*Procore just partnered with NVIDIA for digital twins. We build our own — faster, cheaper, in the browser.*

---

## PROMPT 3.1 — Browser-Native Digital Twin

```
OBJECTIVE: Build a real-time digital twin of the construction project that runs entirely in the browser using WebGPU. No NVIDIA required. No desktop install. Just open a URL.

This is the feature that makes headlines. When a superintendent opens SiteSync on their iPad, they can see a 3D model of their building with real-time data overlaid — which walls are complete, where the RFIs are, who's working where, and what's behind schedule.

CORE FEATURES:

1. BIM Viewer (Three.js + WebGPU):
- Load IFC files using web-ifc-three library
- WebGPU renderer for hardware acceleration (supported in all browsers as of Nov 2025)
- Fallback to WebGL2 for older devices
- Progressive LOD: bounding boxes → geometry → textures
- Web Worker for parsing (never block main thread)
- IndexedDB cache for parsed models

2. Data Overlay Layers (toggle on/off):
- PROGRESS LAYER: Color elements by completion percentage (red=0%, yellow=50%, green=100%)
  - Data source: tasks table (percent_complete field)
  - Link: task.spec_section → IFC element.specification

- RFI LAYER: Pin markers on elements with open RFIs
  - Click pin → shows RFI detail panel
  - Color: red=overdue, yellow=open, green=resolved

- SAFETY LAYER: Heatmap overlay showing incident locations
  - Data source: incidents table with GPS coordinates
  - Highlight zones with recurring safety issues

- SCHEDULE LAYER: Timeline slider
  - Drag timeline → see what should be installed by that date
  - Compare planned vs actual progress visually
  - Highlight tasks that are behind schedule in red

- CREW LAYER: Show crew locations (from field check-in GPS data)
  - Real-time dots showing where each crew is working
  - Click dot → show crew details, current task, progress

3. Markup and Measurement:
- 3D markup tools: pin, cloud, dimension line, section cut
- Save markups linked to entities (RFIs, punch items)
- Share viewpoints: save camera position + visible layers as shareable URL
- Measurement tool: point-to-point distance in 3D space

4. Photo Pins:
- Place photos at 3D locations in the model
- Click location → see all photos taken there, chronologically
- Compare progress photos over time at same viewpoint

5. IoT Integration (future-ready):
- Define data schema for sensor readings (temperature, humidity, vibration)
- Show sensor locations as icons in the model
- Real-time data from WebSocket feed
- Alert thresholds: highlight sensor if reading is out of range

PERFORMANCE TARGETS:
- 10M polygon model loads in < 5 seconds on M1 MacBook
- 60fps orbit/pan/zoom
- < 200MB memory for typical commercial building model
- Works on iPad Pro (A-series GPU supports WebGPU)

DATA MODEL:
Already defined in V3. Add:
CREATE TABLE bim_element_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES bim_models(id),
  ifc_element_id text NOT NULL,
  linked_entity_type text NOT NULL, -- 'task', 'rfi', 'punch_item', 'spec_section'
  linked_entity_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE spatial_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  model_id uuid REFERENCES bim_models(id),
  position jsonb NOT NULL, -- {x, y, z}
  camera_state jsonb, -- viewpoint for restoration
  photo_url text NOT NULL,
  taken_at timestamptz DEFAULT now(),
  taken_by uuid REFERENCES auth.users(id)
);

TEST:
- Load sample IFC file → verify 3D renders correctly
- Toggle progress layer → verify elements colored by completion
- Click RFI pin → verify detail panel opens with correct data
- Drag timeline → verify visual progress matches schedule data
- Place photo pin → verify photo appears at correct 3D location
- Test on iPad Pro → verify 60fps with 5M polygon model
```

---

# PHASE 4: CONSTRUCTION FINTECH (Week 9-10)

*This is where the real money is. Construction payments = $1.9 trillion annually.*

---

## PROMPT 4.1 — AIA Payment Applications + Embedded Payments

```
OBJECTIVE: Automate the AIA G702/G703 payment application workflow AND process payments through the platform. This single feature can generate more revenue than all subscriptions combined.

Refer to V3 PROMPT 5.1 for full G702/G703 specification. Add:

EMBEDDED PAYMENT PROCESSING:

1. Stripe Connect Integration:
- GC creates "Pay Sub" from approved payment application
- SiteSync processes payment via Stripe Connect (ACH for amounts > $5K, card for smaller)
- Transaction fee: 0.5% for ACH, 2.9% for card
- Retainage held in escrow (separate Stripe balance)
- Release retainage on project completion with owner approval

2. Cash Flow Intelligence:
- Real-time cash flow dashboard showing: money in (from owner), money out (to subs), money held (retainage)
- Predict cash flow gaps: "You have $150K due to subs on April 5 but owner payment expected April 20. 15-day gap of $150K."
- Suggest solutions: "Request early payment from owner" or "Use SiteSync Bridge Financing"

3. Bridge Financing (future revenue stream):
- Offer short-term working capital based on approved payment applications
- Approved pay app = guaranteed receivable = low-risk lending
- Revenue: origination fee (1-2%) + interest
- This is how Procore will NEVER compete — they don't do fintech

4. Lien Waiver Automation:
- Auto-generate state-specific conditional waivers with payment application
- On payment clearance → auto-convert to unconditional
- Track compliance: block next pay app until previous waivers received
- Support all 50 states (start with CA, TX, FL, NY — 60% of US construction)

5. Insurance Certificate Tracking:
- Upload COI → AI extracts: carrier, policy number, coverage amounts, expiration
- Track per-subcontractor: all required coverages met?
- Auto-notify 30 days before expiration
- Block sub from site access if COI expired (integration with crew check-in)

CERTIFIED PAYROLL (addresses $260B payroll complexity):
- Track worker hours by project, cost code, and classification
- Calculate prevailing wage rates (Davis-Bacon + state rates)
- Generate WH-347 certified payroll reports
- Auto-flag underpayments before submission
- Revenue: $5/employee/month for payroll tracking tier

TEST:
- Create payment application from budget data → verify G702 math is correct
- Generate G703 continuation sheet → verify line items match SOV
- Process test payment via Stripe → verify transaction recorded
- Generate conditional lien waiver → verify state-specific language (CA vs TX)
- Upload COI PDF → verify AI extracts correct fields
- Generate certified payroll report → verify prevailing wage calculations
```

---

# PHASE 5: WORKFORCE + SAFETY INTELLIGENCE (Week 11-12)

---

## PROMPT 5.1 — Computer Vision Safety + Workforce Management

```
OBJECTIVE: Turn every job site camera into an AI safety officer. Turn every worker check-in into workforce intelligence.

COMPUTER VISION SAFETY:

1. Photo Analysis Pipeline:
- User uploads site photo (or camera feed frame)
- Send to Claude Vision via edge function
- Detect: missing hard hats, missing safety vests, missing fall protection, improper scaffolding, unprotected edges, housekeeping violations
- Return: annotated image with bounding boxes + violation descriptions
- Auto-create safety observations or corrective actions from detections

2. Drone Integration (future-ready):
- Define API endpoint for drone footage upload
- Process frames at configurable interval (every 5 seconds for flyover)
- Generate progress photos automatically from drone GPS path
- Compare drone photos across dates for progress tracking

3. Safety Scoring:
- Calculate real-time safety score per project (0-100)
- Factors: incident rate, inspection frequency, corrective action closure rate, PPE compliance, training completion
- Trend analysis: improving or declining over time
- Benchmark against industry averages
- Surface on Dashboard as primary KPI

WORKFORCE MANAGEMENT:

1. Crew Check-In/Check-Out:
- QR code at site entrance (generated per project)
- Worker scans with phone → GPS verified → time recorded
- Track: who's on site, arrival time, departure time, total hours
- Real-time headcount dashboard
- Alert if expected crew doesn't check in by expected time

2. Workforce Analytics:
- Labor hours by trade, by week, by cost code
- Productivity metrics: units installed per labor hour
- Overtime tracking with alerts
- Historical staffing curves vs planned staffing

3. Certification Tracking:
- Track per-worker: OSHA 10/30, first aid, crane operator, welding certs
- Auto-flag expired certifications
- Block assignment to tasks requiring cert they don't have
- Integration with training completion records

DATA MODEL:
CREATE TABLE site_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  worker_id uuid,
  company_id uuid REFERENCES directory_companies(id),
  check_in_at timestamptz NOT NULL,
  check_out_at timestamptz,
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  method text DEFAULT 'qr_scan' -- 'qr_scan', 'manual', 'geofence'
);

CREATE TABLE worker_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  certification_type text NOT NULL,
  issued_date date,
  expiry_date date,
  issuing_body text,
  document_url text,
  status text DEFAULT 'active'
);

CREATE TABLE safety_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id),
  observed_by uuid REFERENCES auth.users(id),
  observation_type text, -- 'positive', 'violation', 'near_miss'
  category text, -- 'ppe', 'fall_protection', 'housekeeping', 'electrical', etc.
  description text,
  photo_url text,
  ai_detected boolean DEFAULT false,
  severity text,
  location text,
  corrective_action_id uuid REFERENCES corrective_actions(id),
  created_at timestamptz DEFAULT now()
);

TEST:
- Upload photo with missing hard hat → verify AI detects and creates observation
- Simulate crew check-in via QR → verify headcount updates in real-time
- Worker with expired OSHA 30 assigned to confined space task → verify system flags it
- Calculate safety score for test project → verify formula produces reasonable results
```

---

# PHASE 6: INFRASTRUCTURE AND SCALE (Week 13-14)

---

## PROMPT 6.1 — Security Hardening, CSP, and Vulnerability Fixes

```
OBJECTIVE: Fix all infrastructure security issues found in V4 audit.

1. Content Security Policy (CRITICAL):
Add to index.html:
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval' https://*.sentry.io https://*.posthog.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.posthog.com https://*.liveblocks.io;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://*.supabase.co;
  worker-src 'self' blob:;
">

2. PDF.js Vulnerability Fix:
pdfjs-dist@3.11.174 has GHSA-wgrm-67xf-hhpq (arbitrary JS execution on malicious PDFs).
Options:
a) Upgrade to pdfjs-dist@5.x (may break @react-pdf-viewer compatibility)
b) Sandbox PDF rendering in an iframe with sandbox attribute
c) Switch to @react-pdf/renderer for PDF generation only, remove viewer dependency

3. Environment Validation:
Create src/lib/env.ts:
import { z } from 'zod'
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),
})
export const env = envSchema.parse(import.meta.env)

Import and use throughout app instead of raw import.meta.env.

4. CI/CD Security:
Add to .github/workflows/ci.yml:
- npm audit --audit-level=moderate
- CodeQL analysis step
- Dependabot config (.github/dependabot.yml)
- Accessibility testing with axe-core

5. Fix package.json version: Change "0.0.0" to "1.0.0-alpha.1"

6. Add .prettierrc for consistent formatting

7. Update Capacitor allowNavigation to include all required domains

8. Fix service worker path to use import.meta.env.BASE_URL

9. Fix manifest.json icon paths (PNG vs SVG mismatch)

TEST:
- CSP blocks unauthorized scripts (test with inline script injection)
- Environment validation fails fast on missing required vars
- CI pipeline runs security audit on every PR
- npm audit returns 0 high/critical vulnerabilities
```

---

## PROMPT 6.2 — Public API V1 (Stripe-Quality)

```
Refer to V3 PROMPT 4.1 for full API specification. Add these enhancements:

WEBHOOK 2.0:
- Support SNS-style fan-out (one event → multiple webhook endpoints)
- Dead letter queue for failed deliveries (store in database, surface in admin UI)
- Webhook debugging: log last 100 deliveries per endpoint with response codes
- Support for webhook filtering: only subscribe to specific event types

RATE LIMITING 2.0:
- Per-endpoint rate limits (not just global)
- Tiered: /v1/projects (100/min), /v1/ai/analyze (10/min), /v1/files/upload (20/min)
- Return X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
- 429 response includes Retry-After header

SDK GENERATION:
- Define API in OpenAPI 3.1 spec
- Auto-generate TypeScript SDK from spec
- Publish as @sitesync/sdk on npm
- SDK includes: typed methods, automatic retry, pagination helpers, webhook signature verification

DEVELOPER PORTAL:
- Create /developers page in app
- API key management (create, revoke, rotate)
- Usage dashboard (requests, errors, latency)
- Interactive API explorer (like Stripe's)
- Code examples in: curl, JavaScript, Python, Ruby

TEST:
- Every endpoint returns correct status codes
- SDK type-checks against OpenAPI spec
- Webhook signatures verify with HMAC-SHA256
- Rate limiting correctly returns 429 with Retry-After
- Pagination cursor works across all list endpoints
```

---

# PHASE 7: NETWORK EFFECTS AND DATA MOAT (Week 15-16)

*This is what makes a $10B platform. Not features — network effects.*

---

## PROMPT 7.1 — Build the Construction Data Network

```
OBJECTIVE: Create network effects that make SiteSync more valuable as more people use it. This is the difference between a $1B tool and a $10B platform.

CROSS-PROJECT INTELLIGENCE (Data Moat):
When thousands of projects flow through SiteSync, we see patterns nobody else can:

1. Benchmarking Engine:
- Anonymous, aggregated metrics across all projects on the platform
- "Your RFI response time is 14 days. Average across similar projects: 8 days."
- "Your cost per SF is $312. Comparable projects in your market: $285."
- "Your safety incident rate is 3.2. Industry average: 4.8. You're 33% better."
- Metrics: cost/SF by project type and region, RFI turnaround, submittal cycle time, punch list density, change order rate, safety incident rate

2. Subcontractor Reputation Network:
- Every sub that works on a SiteSync project builds a performance profile
- Metrics: on-time delivery rate, RFI response speed, rework rate, safety record, payment history
- GCs can see sub performance before awarding contracts
- Subs with great track records get featured (incentive to perform well)
- THIS IS THE NETWORK EFFECT: the more GCs use SiteSync, the better the sub data. The better the sub data, the more GCs want to use SiteSync.

3. Material Price Intelligence:
- Track material costs from budget data across projects
- Build price index: concrete/CY, rebar/ton, drywall/SF by region and date
- Show trends: "Concrete prices in Dallas up 12% in last 90 days"
- Predict costs for new estimates using historical data
- More projects = better price data = more accurate estimates = more projects

4. Risk Prediction (ML on aggregate data):
- Train models on historical project data to predict:
  - Which projects will go over budget (and by how much)
  - Which RFIs will take longest to resolve
  - Which submittals will be rejected
  - Which tasks will slip their schedule
- These predictions improve with every project on the platform

MARKETPLACE (future phase):
- Sub discovery: GCs find qualified subs based on performance data
- Material procurement: compare prices across suppliers
- Equipment rental: integrated rental marketplace
- Insurance: embedded COI purchasing

DATA PRIVACY:
- All benchmarking data is anonymized and aggregated
- Individual project data NEVER shared across organizations
- Opt-in only for benchmarking participation
- SOC 2 compliance for data handling
- Data residency: keep data in user's selected region

IMPLEMENTATION:
CREATE TABLE benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL, -- 'cost_per_sf', 'rfi_turnaround', 'change_order_rate', etc.
  project_type text, -- 'commercial', 'residential', 'industrial', 'healthcare'
  region text, -- metro area
  value numeric,
  sample_size int,
  period text, -- '2026-Q1'
  calculated_at timestamptz DEFAULT now()
);

CREATE TABLE subcontractor_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES directory_companies(id),
  rated_by_org uuid, -- anonymized
  project_type text,
  metrics jsonb, -- { on_time: 0.92, rework_rate: 0.03, safety_score: 87 }
  period text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE material_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type text NOT NULL,
  unit text NOT NULL,
  price numeric(14,2),
  region text,
  source_project_id uuid, -- for internal tracking only, never exposed
  recorded_at timestamptz DEFAULT now()
);

TEST:
- Generate benchmark for "RFI turnaround" across 100 test projects → verify anonymization
- View sub reputation profile → verify metrics calculated correctly
- Check material price trend → verify chart shows accurate historical data
- New project uses benchmark data for budget estimation → verify suggestion accuracy
```

---

## PROMPT 7.2 — Integration Ecosystem + Marketplace

```
OBJECTIVE: Become the hub that all other construction tools connect to. Build an integration marketplace where third-party developers can build on SiteSync.

Refer to V3 PROMPT 7.1 for base integrations. Add:

APP MARKETPLACE:
1. Developer registration and app submission
2. OAuth 2.0 app authorization flow
3. App review and approval process
4. Per-app API rate limits and scoping
5. Revenue share: SiteSync takes 20% of paid app revenue
6. App categories: Accounting, Scheduling, Safety, Equipment, Estimating, BIM

NATIVE INTEGRATIONS (Priority 1 — build in-house):
- QuickBooks Online: bidirectional sync of invoices, payments, cost codes
- Procore: import projects from Procore (migration path for conquest sales)
- Microsoft Project: .mpp import/export
- Slack/Teams: notification bots, command interface
- Google Drive/SharePoint: document sync

PARTNER INTEGRATIONS (Priority 2 — co-build with partners):
- Autodesk BIM 360 / ACC: model sync
- Bluebeam Revu: markup sync
- PlanGrid (Autodesk): drawing sync
- Sage 300 CRE: accounting sync

ECOSYSTEM DATA FLOW:
When a change order is approved in SiteSync:
1. Budget updates in SiteSync → syncs to QuickBooks as journal entry
2. Webhook fires → Slack bot posts in #project-updates channel
3. Schedule impact recalculated → Microsoft Project updated
4. Payment application updated → lien waiver generated
5. Sub notified via email with payment timeline
6. Audit trail records entire chain

This is the INTEGRATION MOAT: once a GC has 5+ systems connected through SiteSync, switching cost is astronomical.

TEST:
- Connect QuickBooks test account → verify bidirectional sync of cost codes
- Trigger webhook on RFI creation → verify Slack message received
- Import Microsoft Project schedule → verify tasks created with dependencies
- Verify OAuth flow works end-to-end for third-party app
```

---

# EXECUTION RULES

1. **Phase 0 is NON-NEGOTIABLE.** Mock data, accessibility, and missing forms must be fixed before ANYTHING else.
2. **Every prompt is self-contained.** Paste System Context + one prompt per session.
3. **Every prompt ends with tests.** No prompt is complete without passing tests.
4. **Zero `as any`.** Zero hardcoded colors. Zero mock data. These are fireable offenses.
5. **Every mutation:** permission → validate → execute → invalidate → audit → toast → error handling.
6. **Every page:** error boundary → skeleton → empty state → data → real-time → keyboard nav → accessibility.
7. **Mobile-first.** Test at 375px before desktop. Test with gloves (44px targets).
8. **Keyboard-first.** Every action reachable without mouse. Tab order logical. Focus visible.
9. **AI-first.** Every feature should have an AI angle. Can the AI help with this workflow?
10. **Measure everything.** Sentry, PostHog, Core Web Vitals. If it's not measured, it doesn't exist.
11. **Ship daily.** Small PRs, frequent deploys, continuous improvement.
12. **Network effects in every decision.** Will this feature make the platform more valuable as more people use it?

---

# SUCCESS METRICS

| Metric | Current (V3) | Phase 0 Target | Phase 7 Target | Procore Equivalent |
|--------|-------------|---------------|----------------|-------------------|
| Mock data instances | 6+ pages | 0 | 0 | 0 |
| WCAG AA compliance | 0% | 90% | 100% | ~60% |
| PermissionGate usage | 0 pages | All pages | All pages | Partial |
| Mutations with full pattern | ~30% | 80% | 100% | ~70% |
| Pages with real-time | ~0% | 50% | 100% | Basic |
| useMemo/useCallback instances | 5 | 100+ | 200+ | N/A |
| Lighthouse Performance | ~70 | 85 | 95+ | ~75 |
| Lighthouse Accessibility | ~40 | 90 | 98+ | ~65 |
| Test coverage | ~5% | 40% | 80% | Unknown |
| Generative UI components | 0 | 0 | 8+ | 0 |
| AI agents (specialized) | 1 | 1 | 6 | 1 (Helix) |
| Voice capture languages | 0 | 2 | 5+ | 0 |
| Digital twin (browser BIM) | 0 | 0 | Full | Via NVIDIA (desktop) |
| Payment processing | 0 | 0 | Full | 0 |
| Certified payroll | 0 | 0 | Full | 0 |
| Computer vision safety | 0 | 0 | MVP | Via partner |
| Network effect features | 0 | 0 | 3 | 1 (marketplace) |
| API endpoints | 0 | 0 | 30+ | 100+ |
| Integrations | 0 | 0 | 5+ | 400+ |

---

# COMPETITIVE POSITIONING: MILES AHEAD

| Capability | SiteSync V4 | Procore (March 2026) | Why We Win |
|-----------|------------|---------------------|-----------|
| **AI Architecture** | Multi-agent orchestration with specialized crews | Single Helix AI assistant | 6 domain-expert agents vs 1 generalist |
| **Generative UI** | AI renders interactive React components | Text responses only | Users act on AI output without leaving chat |
| **Voice Capture** | Multilingual, field-optimized, creates structured data | None | Built for the 80% of workers who hate typing |
| **Digital Twin** | Browser-native WebGPU, no install needed | NVIDIA Omniverse (requires desktop, partnership) | Any device, any browser, offline-capable |
| **Embedded Payments** | Stripe Connect, retainage escrow, bridge financing | None | We monetize the $1.9T payment flow |
| **Certified Payroll** | Davis-Bacon, prevailing wage, WH-347 automated | None | Addresses $260B payroll complexity |
| **Computer Vision** | Real-time PPE detection from site photos | Via Helix (photo tagging) | Proactive safety vs reactive tagging |
| **Network Effects** | Benchmarks, sub reputation, material pricing | App marketplace (limited) | Data gets better with every project |
| **Speed/UX** | Linear-style keyboard-first, < 2s LCP | Traditional enterprise UI | 3x faster daily workflows |
| **Offline** | Full offline with conflict resolution | Partial | Works in tunnels, basements, rural sites |
| **Open API** | Stripe-quality from day 1 | Legacy REST API | Developers prefer us |
| **Pricing** | Usage-based + fintech revenue | ACV ($50K+ minimum) | Accessible to $5M projects, not just $50M+ |

---

# THE $10B FLYWHEEL

```
More GCs use SiteSync
  → More project data flows through
    → Better benchmarks, better sub ratings, better price data
      → More valuable for every user (network effect)
        → More GCs want SiteSync
          → More subs forced to use SiteSync (by their GCs)
            → Sub data gets richer
              → GCs trust sub data more
                → Award contracts through SiteSync (marketplace)
                  → Process payments through SiteSync (fintech)
                    → Revenue grows from subscriptions + transactions + data
                      → Fund more AI/features → REPEAT
```

This flywheel is what Procore has started with their marketplace but can't fully execute because they don't do payments, don't do certified payroll, and their AI is bolt-on, not native.

SiteSync wins by being the only platform where the AI, the payments, the workforce data, and the project data are all in one system — creating insights and automation that no integration of separate tools can match.

---

*This V4 prompt was generated from a line-by-line audit of 211+ files finding 90+ remaining bugs, cross-referenced with Procore's March 2026 NVIDIA/Datagrid/FedRAMP announcements, 2026 multi-agent orchestration frameworks (LangGraph, CrewAI, OpenAI Agents SDK), Vercel's json-render generative UI framework, digital twin market data ($4.18B in 2026), embedded finance 2.0 patterns, construction workforce automation (Trayd $10M raise, LumberFi), computer vision safety platforms (viact.ai, CompScience, EarthCam), and vertical SaaS network effect economics.*
