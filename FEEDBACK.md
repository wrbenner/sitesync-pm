# FEEDBACK.md — SiteSync PM Nightly Build Priorities
*Walker is calling GCs this week. Every overnight build must make the product more demoable.*
*Last updated: April 22, 2026 by Chief Product Strategist*
*Standard: A Fortune 500 GC's CTO opens this and thinks "this is better than the $80K/year Procore we use."*

---

## 🚨 CRITICAL: Builder Down FOUR Nights — Product Is Stalling

The nightly builder has not executed a single commit since April 18. Commit `2a3a7df` disabled all scheduled workflow crons. This is now **night FOUR** with zero builder activity. 16 `Math.random()` calls still in production code. Zero WorkflowTimeline component. The strategist has written four consecutive nights of priorities that went nowhere. **Walker: this is the single biggest bottleneck. Re-enable `nightly-build.yml` or run the builder manually. No amount of strategy fixes a disabled execution pipeline.**

---

## Tonight's P0 Priorities (April 22 → April 23 2am CDT)

### 1. MOCK DATA ELIMINATION — KILL ALL 16 Math.random() CALLS (CARRIED FORWARD — NIGHT 4)
**SPEC ref:** P0-1 (Mock Data Elimination — 0% complete, blocks every investor demo and GC call)
**Files to change (16 occurrences confirmed via grep):**
- `src/components/budget/SCurve.tsx:282` — DEMO KILLER: fake budget variance
- `src/pages/Procurement.tsx:1084` — DEMO KILLER: random PO numbers
- `src/pages/payment-applications/index.tsx:235` — DEMO KILLER: random fallback ID
- `src/components/drawings/MeasurementOverlay.tsx:83` — ID generation
- `src/components/drawings/DrawingTiledViewer.tsx:330` — ID generation
- `src/components/drawings/AnnotationCanvas.tsx:39` — ID generation
- `src/components/shared/PhotoAnnotation.tsx:84` — ID generation
- `src/components/shared/DrawingMarkup.tsx:100` — ID generation
- `src/components/shared/Whiteboard.tsx:109` — ID generation
- `src/components/shared/FileDropZone.tsx:32` — ID generation
- `src/components/submittals/SubmittalCreateWizard.tsx:527` — ID generation
- `src/components/punch-list/PunchItemCreateWizard.tsx:571,608` — ID generation (2 occurrences)
- `src/hooks/useRealtimeInvalidation.ts:48` — ID generation
- `src/lib/scheduleHealth.ts:86` — ID generation
- `src/pages/whiteboard/WhiteboardPage.tsx:26` — ID generation
**What to do:**
1. **Three demo-killing fakes (FIX FIRST — these destroy credibility in GC calls this week):**
   - `SCurve.tsx:282` — `0.95 + Math.random() * 0.1` generates fake budget variance that changes on every reload. Replace with: query real `actual_amount` from `budget_line_items` grouped by `period_date`. If no actuals exist, render only the planned line with label "Actuals will appear as costs are recorded." Use integer cents (LEARNINGS.md). A chart with one honest line beats two fabricated ones.
   - `Procurement.tsx:1084` — `PO-${2045 + Math.floor(Math.random() * 10)}` generates random PO numbers. Replace with deterministic: `PO-${req.id.slice(0,8).toUpperCase()}`.
   - `payment-applications/index.tsx:235` — `String(Math.random())` as fallback ID. Replace with `crypto.randomUUID()`.
2. **Mechanical ID generation fix (13 remaining files):** Every `Math.random().toString(36).slice(2, 9)` → `crypto.randomUUID().slice(0, 8)`. Every `Math.random().toString(36).slice(2)` → `crypto.randomUUID()`. Every `Math.random().toString(36).slice(2, 7)` → `crypto.randomUUID().slice(0, 5)`. Every standalone `Math.random()` ID pattern → `crypto.randomUUID()`. Include `MeasurementOverlay.tsx:83`, `DrawingTiledViewer.tsx:330`, and `scheduleHealth.ts:86` which were missed in previous priority lists.
3. **Exceptions:** `IntelligenceGraph.tsx` uses Math.random() for force-directed graph physics — visual algorithm, not mock data. Leave as-is.
4. **Verify:** `grep -rn "Math\.random" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v "IntelligenceGraph"` returns 0 results.
5. **Update `.quality-floor.json`:** set `mockCount` to 1 (IntelligenceGraph exception only).
6. **Commit:** `git add -A && git commit -m "fix(P0-1): eliminate all 16 Math.random calls — crypto.randomUUID + real budget data [auto]"`
**Done looks like:** `grep -rn "Math\.random" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v IntelligenceGraph | wc -l` returns 0. The S-Curve chart shows only the planned line when no actuals exist. PO numbers are deterministic. No ID changes between page reloads. mockCount in `.quality-floor.json` = 1.
**WHY:** Night FOUR. Walker is calling GCs this week. The Budget S-Curve (Demo Step 5) generates visibly different fake numbers on every page reload — a CTO who opens the budget page twice will catch this in 10 seconds. The Procurement page creates different PO numbers for the same requisition on repeated conversions. These aren't edge cases; they're front-and-center credibility killers. This is the lowest-effort, highest-impact fix in the entire codebase: 13 of the 16 fixes are a mechanical find-and-replace that takes under 5 minutes total.

### 2. RFI STATE MACHINE + WORKFLOWTIMELINE — DEMO STEP 3 MUST WORK END-TO-END
**SPEC ref:** P0-6 (State Machine Handler Completion — 0% complete) + P1-2 (RFIs — 35% complete)
**Files to change:** `src/machines/rfiMachine.ts`, `src/pages/RFIs.tsx` (or wherever the RFI detail/list view lives), `src/components/WorkflowTimeline.tsx` (CREATE — confirmed absent, 0 references in codebase)
**What to do:**
1. **Audit `src/machines/rfiMachine.ts`** — the machine exists with proper XState `setup()` and has SUBMIT, START_REVIEW, RESPOND, CLOSE, VOID events defined. Verify each transition has:
   - A `guard` checking user permission via the role from context
   - An `entry` action that calls `persistTransition` actor to update `status` and `ball_in_court` in the `rfis` table
   - An `entry` action that writes to `activity_log` with `{ from_state, to_state, actor_id, timestamp }`
   - Invalid transitions must throw a typed `InvalidTransitionError` — never silently no-op
2. **Create `src/components/WorkflowTimeline.tsx`** — horizontal stepper component:
   - Props: `states: string[]`, `currentState: string`, `completedStates: string[]`
   - Renders each state as a step with connecting lines. Completed states show checkmarks (green). Current state is highlighted (brand blue). Future states are gray.
   - Use inline styles with theme tokens (ADR-003). 56px minimum touch targets (LEARNINGS.md).
   - This component is reusable across Submittals, Change Orders, Pay Apps — building it once enables 4 workflows.
3. **Wire the RFI detail page:**
   - Top: `<WorkflowTimeline states={['draft','submitted','under_review','responded','closed']} currentState={rfi.status} />`
   - Action buttons computed from the machine's available events for current state. `draft` → "Submit" only. `submitted` → "Start Review" only. Never show unavailable transitions.
   - Each button: fire machine event → optimistic UI → Supabase persist → rollback + toast on error
   - Activity feed at bottom: query `activity_log WHERE resource_type='rfi' AND resource_id=rfi.id ORDER BY created_at DESC`
4. **Unit tests:** `src/machines/__tests__/rfiMachine.test.ts` — test each valid transition (5 happy paths), each invalid transition (e.g., draft → closed throws), and verify activity_log write on each transition.
5. **Commit:** `git add -A && git commit -m "feat(P0-6): complete RFI state machine + WorkflowTimeline component [auto]"`
**Done looks like:** Open any RFI detail page. See the horizontal WorkflowTimeline showing progress. Click through the full lifecycle: draft → submitted → under_review → responded → closed. Each click transitions the status, updates the ball-in-court, and appends an activity log entry. Invalid transitions throw typed errors. `npm test src/machines/rfiMachine` passes. The WorkflowTimeline renders cleanly at 768px (iPad demo width).
**WHY:** Demo Step 3 is the moment a superintendent sees their real workflow reflected in software. "I submit it, the architect reviews it, they respond, I close it." That's the daily reality. If the transitions silently fail or the status gets stuck, the superintendent thinks "this doesn't understand my job." The WorkflowTimeline is a force multiplier — it's one component that makes RFIs, Submittals, Change Orders, and Pay Apps all look more polished instantly. Building it now enables 4 demo steps with one piece of UI. Procore shows status as a dropdown. We show it as a visual journey. That visual difference is what makes a PM screenshot it and send it to their VP.

### 3. ESLINT WARNINGS — CUT 607 → 300 BY FIXING AUTO-FIXABLE VIOLATIONS
**SPEC ref:** Quality Gates (ESLint: ⚠️ Warnings present, target: 0)
**Files to change:** Run `npx eslint --fix src/` across the codebase, then manually fix the highest-frequency warning categories
**What to do:**
1. **Run auto-fix first:** `npx eslint --fix src/ --ext .ts,.tsx` — this will handle all auto-fixable warnings (unused imports, formatting, simple type issues). Expect ~200-300 fixes for free.
2. **Identify top warning categories:** `npx eslint src/ --ext .ts,.tsx --format json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const m={};d.forEach(f=>f.messages.forEach(msg=>{m[msg.ruleId]=(m[msg.ruleId]||0)+1}));Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([r,c])=>console.log(c,r))"` — fix the top 3 categories manually if they aren't auto-fixable.
3. **Do NOT use `eslint-disable` comments** to suppress warnings. Fix the code or downgrade the rule in `eslint.config.js` if the rule is wrong for this project.
4. **Update `.quality-floor.json`:** set `eslintWarnings` to the new count (target: ≤ 300).
5. **Commit:** `git add -A && git commit -m "fix(quality): eslint auto-fix + top warning categories — 607 → N warnings [auto]"`
**Done looks like:** `npx eslint src/ --ext .ts,.tsx 2>&1 | grep -c "warning"` returns ≤ 300. Zero new errors introduced. `npm run build` still passes. `.quality-floor.json` `eslintWarnings` updated to new floor.
**WHY:** 607 ESLint warnings is a blinking red light for any CTO who runs `npm run lint`. It signals "this team doesn't clean up after themselves." More practically: warnings hide real bugs. Unused imports bloat the bundle. Missing return types cause runtime surprises. Cutting warnings in half is a 30-minute investment (most are auto-fixable) that immediately improves code health scores and makes the codebase more navigable for both humans and AI agents. The quality ratchet (ADR-010) means once we get to 300, we never go above 300 again — every future commit must maintain or improve. This is the kind of compounding hygiene that separates enterprise-grade codebases from prototypes. It also directly unblocks the "ESLint: zero warnings" quality gate in SPEC.md, moving us from ⚠️ to a measurable number.

---

## Completed Archive

### April 19-22: FOUR CONSECUTIVE NIGHTS — BUILDER DISABLED, PRIORITIES UNEXECUTED
- **Status:** All 3 priorities (mock data, RFI state machine, dashboard KPIs) carried forward for 4 consecutive nights. Zero builder commits since April 18.
- **Root cause:** Commit `2a3a7df` disabled all scheduled workflow crons to halt API spend. The nightly builder has never re-triggered.
- **Impact:** mockCount stuck at 7 (actually 16 — grep found additional occurrences in MeasurementOverlay, DrawingTiledViewer, scheduleHealth, and a second PunchItemCreateWizard call). Dashboard KPIs partially wired. RFI state machine exists but WorkflowTimeline component is absent (0 references). ESLint warnings at 607.
- **What changed in tonight's priorities:** (1) Expanded mock data list from 12 to 16 files after fresh grep — 3 files were missed in previous scans. (2) Replaced Dashboard KPI priority #3 with ESLint cleanup — the dashboard queries may already partially work and the KPI tile wiring is complex enough to be a standalone night's work, while ESLint auto-fix is high-ROI mechanical work. (3) Added explicit WorkflowTimeline creation confirmation (0 references in codebase).
- **Action needed:** Walker must re-enable `nightly-build.yml` or run the builder manually. Four nights of strategic direction have been written with zero execution. The product is falling behind the GC call schedule.

### April 17-18: Test Coverage Foundation + UX Polish (Phase A/B)
- **Completed:** 75 mutation hook tests, 51 page smoke tests, drift guard, CI workflow, vitest coverage config, skeleton loading states, 56px touch targets, no-hex-colors lint rule, harness detector
- **Commits:** 0a42b2c (Phase A), a2ba759 (Phase B), ed64e09 through 4ba340d (Phase A substeps)
- **Impact:** Coverage rose from ~20% to 43.2%. Touch targets now meet industrial gloved-use requirements.

### April 16-17: Security Hardening + Platform Audit
- **Completed:** Wrapped 26+ mutations in useAuditedMutation, 5 new Zod schemas, CO state machine guards, FormModal focus trap, platform-wide functional audit harness (55/55 pages @ 100% actionable)
- **Commits:** a66535e, df4e26d, 84af4a9, 4b23cfe through d618aeb
- **Impact:** Every mutation is now audited. Zod validation on core forms. Change order machine has proper guards.

### April 15-16: Crash Fixes + Entity CRUD Completion
- **Completed:** Fixed universal crash on project creation (null safety, auto-add creator to project_members, self-heal existing projects), scaffolded ChangeOrders page, completed CRUD for Vendors/Contracts/Permits/PayApps
- **Commits:** 0ae50df through 61cc0fe, ffa1075 through 4b23cfe
- **Impact:** App no longer crashes when creating a new project. All entity pages have full CRUD operations.

---

## Reference: Enterprise Demo Flow (unchanged from April 6 plan)

---

## THE STANDARD

This is not demo software. Demo software looks good for 10 minutes. Enterprise software is unbreakable under adversarial conditions: bad network, wrong permissions, concurrent users, unexpected input, partial failures. Every decision made this week must serve that standard.

The GC demo on April 15th is the proof point — but the bar is the CTO who presses F12, checks the Network tab, tries to break the RFI form, and asks "where are your audit logs?" Build for that person.

---

## THE DEMO FLOW (non-negotiable, enterprise-grade)

Six steps. Every step runs on real data, behind real auth, with real AI, with zero console errors.

**Step 1 — Dashboard** (`/dashboard`)
App loads in under 3 seconds. GC sees Riverside Tower: KPI tiles (% complete, open RFIs, budget burn %, schedule float in days), real-time activity feed (last 10 actions with actor + relative timestamp), and a weather widget pulled from the `weather` edge function using the project's lat/lon. Every number is live from Supabase. The dashboard auto-refreshes when a new RFI or task is created (Supabase realtime subscription). Zero mock data. Zero console errors.

**Step 2 — AI Copilot** (`/copilot` panel)
Walker types "What needs attention this week?" The UI shows a streaming word-by-word response (not a spinner). The `ai-copilot` edge function fetches real project context (open RFIs, overdue tasks, budget variance, schedule risk) and passes it to the LLM. The response names real items: "RFI-047 on the electrical drawings is 3 days overdue" — not generic platitudes. Cited items render as chips that navigate to the actual record. Response streams in under 8 seconds. No mock. No hardcoded strings.

**Step 3 — RFI Workflow** (`/rfis/new` → `/rfis/:id`)
Walker creates an RFI. Form validated with Zod before any network call. On submit: Supabase insert → state machine fires `SUBMIT` event → status transitions `draft → submitted` → `ball_in_court` updates → activity log entry written → toast confirms. Walker clicks "Mark Under Review" → `submitted → under_review`. Walker clicks "Approve" → `under_review → responded → closed`. Every transition is enforced by the XState machine; invalid transitions throw typed errors, never silently succeed. Status badge on the detail page reflects real DB state via realtime subscription.

**Step 4 — Daily Log** (`/daily-logs/new`)
Walker taps the mic (64×64px button, minimum). Recording starts with a red pulse animation. Web Speech API transcribes in real-time (word by word as Walker speaks). On stop, the transcript populates the notes field. Entry saves to `daily_logs` with transcript, date, weather snapshot, and manpower count. Appears immediately at top of log list via realtime subscription. If microphone permission is denied, a clear actionable error is shown — not a silent failure.

**Step 5 — Budget** (`/budget`)
Six-figure budget summary: original contract, approved COs, revised contract, billed to date, cost-to-complete, variance. All live from Supabase. Line items table: Category | Budgeted | Actual | Committed | Variance — with red/green coding. Recharts stacked bar chart (budgeted vs actual by category). Virtualized if > 50 rows. CSV export button. No hardcoded numbers anywhere.

**Step 6 — Payment Application** (`/payment-applications/new`)
Click "New Pay App." G702 summary pre-populates from `schedule_of_values` + `change_orders`. G703 continuation sheet renders every SOV line item: Item No | Description | Scheduled Value | Prev Billings | This Period (editable) | Stored | Total | % | Balance | Retainage. Totals auto-calculate on keystroke. "Save Draft" commits to DB. "Export PDF" generates a clean AIA-formatted PDF (not print-to-PDF — real PDF generation via `@react-pdf/renderer` or equivalent). Every SOV row pre-filled before the GC touches anything.

---

## Phase 1: Unbreakable Foundation (April 6–8, Runs 1–6)
**Goal: Security, data integrity, and permission enforcement locked down. The app is safe to show to a CTO.**

---

### E0-1: Security Lockdown — 2am April 7 (Run 1)

**Context:** A Fortune 500 CTO will have a security team. This must pass a basic audit before any demo happens.

**Files:** `supabase/migrations/20260407000001_rls_fix.sql` (already deployed — verify), all `supabase/functions/*/index.ts`, `vercel.json` or `next.config.js`, `src/lib/supabase.ts`

**What to do:**

1. **Verify migration 20260407000001 applied cleanly:**
   ```bash
   npx supabase db query "SELECT version, name FROM supabase_migrations ORDER BY version DESC LIMIT 5"
   # Must show 20260407000001 in the output with no error state
   ```
   If missing, apply it now: `npx supabase db push`. If it errors, read the migration file and fix the conflict — do NOT skip it.

2. **Audit ALL RLS policies across all 24 tables.** Every table must have RLS enabled. The pattern for project-scoped tables is:
   ```sql
   -- SELECT: org members who are project members
   CREATE POLICY "project_members_select" ON {table} FOR SELECT
   USING (project_id IN (
     SELECT project_id FROM org_members
     WHERE user_id = auth.uid() AND status = 'active'
   ));
   -- INSERT/UPDATE/DELETE: same check + role guard
   CREATE POLICY "project_members_mutate" ON {table} FOR ALL
   USING (project_id IN (
     SELECT project_id FROM org_members
     WHERE user_id = auth.uid() AND status = 'active'
   ));
   ```
   Run: `npx supabase db query "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=false"` — the result must be empty. Any table with `rowsecurity=false` is a critical vulnerability. Fix immediately.

3. **Edge function auth — zero service role keys on any edge function.** Run:
   ```bash
   grep -r "service_role\|SERVICE_ROLE" supabase/functions/ | grep -v ".env"
   # Must return nothing. If it returns any file, replace with user JWT pattern:
   ```
   Every edge function must extract the user JWT: `const token = req.headers.get('Authorization')?.replace('Bearer ', '')` and create a per-request Supabase client: `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: \`Bearer ${token}\` } } })`. This ensures RLS applies inside edge functions.

4. **Security headers via Vercel.** Add to `vercel.json`:
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           { "key": "Permissions-Policy", "value": "camera=(), microphone=(self), geolocation=()" },
           { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
           { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline';" }
         ]
       }
     ]
   }
   ```
   After deploying, verify: `curl -I https://sitesync-pm.vercel.app | grep -E "x-frame|x-content|strict-transport"`

5. **`src/lib/supabase.ts` must use the anon key only.** Confirm: `grep -r "SERVICE_ROLE\|service_role" src/`. Must return nothing. The anon key is public; the service role key is never in frontend code, ever.

**Verify:**
```bash
npx supabase db query "SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false"
# Empty result = pass

grep -rn "service_role" supabase/functions/ src/
# No output = pass

curl -I https://sitesync-pm.vercel.app 2>/dev/null | grep -c "x-frame-options\|strict-transport"
# Must return >= 2
```

---

### E0-2: PermissionGate on Every Action — 2am April 7 (Run 1, parallel with E0-1)

**Files:** `src/components/PermissionGate.tsx` (create if absent), every page with action buttons

**What to do:**

1. Create `src/components/PermissionGate.tsx` if absent:
   ```tsx
   interface PermissionGateProps {
     action: 'create' | 'update' | 'delete' | 'approve' | 'submit';
     resource: 'rfi' | 'submittal' | 'change_order' | 'daily_log' | 'payment_application' | 'budget' | 'punch_item' | 'task';
     projectId: string;
     children: React.ReactNode;
     fallback?: React.ReactNode;
   }
   ```
   It reads the current user's role from `org_members` (cached in React Query with `staleTime: Infinity`). If the user lacks permission, render `fallback` (default: null — button simply disappears). Never disable buttons with a tooltip saying "you don't have permission" — hide them entirely. A GC demo user has full permissions; the component should not block anything during the demo.

2. Wrap every action button on every page. Grep for unguarded buttons:
   ```bash
   grep -rn "<Button\|<button" src/pages/ --include="*.tsx" | grep -v "PermissionGate\|type=\"submit\"\|disabled" | head -30
   ```
   Every "Create RFI", "Submit", "Approve", "Delete", "Export", "Save" button must be inside `<PermissionGate>`.

3. State machine transitions (RFI, Submittal, CO, etc.) must also check permissions at the machine level — in the `guard` condition of each transition event, call `canUserPerformAction(userId, role, action)`. If the guard fails, the machine logs the attempt to the audit table with `outcome: 'blocked'` and throws a typed error: `throw new PermissionError('User lacks APPROVE role for RFIs')`.

**Verify:**
```bash
grep -rn "PermissionGate" src/pages/ --include="*.tsx" | wc -l
# Must be >= 20 (every action button on every page)

grep -rn "<Button" src/pages/ --include="*.tsx" | grep -v "PermissionGate" | grep -v "type=\"submit\"" | wc -l
# Must be < 5 (only non-action buttons like navigation are exempt)
```

---

### E0-3: Zod Validation on Every Form — 2am April 8 (Run 3)

**Context:** Bad data reaching Supabase corrupts the demo. Validate at the boundary — before any network call.

**Files:** `src/lib/schemas/` (create directory), every form component

**What to do:**

1. Create `src/lib/schemas/index.ts`. Define Zod schemas for every form:
   ```ts
   export const RFISchema = z.object({
     title: z.string().min(3, 'Title must be at least 3 characters').max(200),
     description: z.string().min(10, 'Description required').max(5000),
     assignee_id: z.string().uuid('Invalid assignee'),
     due_date: z.string().datetime().optional(),
     priority: z.enum(['low', 'medium', 'high', 'critical']),
     specification_section: z.string().max(20).optional(),
   });

   export const DailyLogSchema = z.object({
     date: z.string().datetime(),
     manpower_count: z.number().int().min(0).max(9999),
     weather_condition: z.enum(['clear', 'cloudy', 'rain', 'snow', 'wind_delay']),
     notes: z.string().max(10000).optional(),
     transcript: z.string().max(50000).optional(),
   });

   export const ChangeOrderSchema = z.object({ /* ... */ });
   export const SubmittalSchema = z.object({ /* ... */ });
   export const PunchItemSchema = z.object({ /* ... */ });
   ```

2. In every form component, use `react-hook-form` with `zodResolver`:
   ```tsx
   const form = useForm<z.infer<typeof RFISchema>>({
     resolver: zodResolver(RFISchema),
     defaultValues: { priority: 'medium' },
   });
   ```
   Inline field errors must appear below each field on blur. The submit button must be disabled while the form is invalid.

3. **Server-side validation in edge functions:** Every edge function that accepts a POST body must also validate with Zod before touching the DB:
   ```ts
   const body = await req.json();
   const parsed = RFICreateSchema.safeParse(body);
   if (!parsed.success) {
     return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422 });
   }
   ```

**Verify:**
```bash
ls src/lib/schemas/index.ts
# Must exist

grep -rn "zodResolver\|z\.object" src/pages/ src/components/ --include="*.tsx" | wc -l
# Must be >= 8 (one per major form)

grep -rn "safeParse\|zodResolver" supabase/functions/ | wc -l
# Must be >= 4 (RFI, Submittal, CO, DailyLog edge functions)
```

---

### E0-4: Bulletproof Data Layer — 2am April 8 (Run 3, parallel with E0-3)

**Context:** Every mutation must be atomic: validate → optimistic update → execute → rollback on error → audit log. Every list query must be bulletproof: skeleton → error boundary → empty state → real data → realtime.

**Files:** `src/hooks/useMutation.ts` (create), `src/components/QueryBoundary.tsx` (create), all list hooks

**What to do:**

1. Create `src/hooks/useSupabaseMutation.ts` — a wrapper that enforces the mutation contract:
   ```ts
   async function mutate<T>(opts: {
     optimisticUpdate?: () => void;
     rollback?: () => void;
     execute: () => Promise<{ data: T | null; error: PostgrestError | null }>;
     onSuccess?: (data: T) => void;
     auditAction: string;
     auditResourceId: string;
     auditResourceType: string;
   })
   ```
   On execute error: call `rollback()`, show error toast with the PostgrestError message, write a failed audit entry. On success: write a success audit entry, call `onSuccess`. Every mutation in the codebase uses this wrapper — no bare `supabase.from(...).update(...)` calls in components.

2. Create `src/components/QueryBoundary.tsx` — wraps every list page:
   - `isLoading` → render `<SkeletonList rows={8} />`
   - `isError` → render `<ErrorCard message={error.message} onRetry={refetch} />`
   - `data.length === 0` → render `<EmptyState resource={resource} ctaTo={ctaPath} />`
   - `data.length > 0` → render children
   
   Every list page (`/rfis`, `/submittals`, `/tasks`, `/daily-logs`, `/budget`, `/payment-applications`) must be wrapped in `<QueryBoundary>`.

3. **React Query configuration** in `src/lib/queryClient.ts`:
   ```ts
   export const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000,      // 5 minutes
         gcTime: 30 * 60 * 1000,         // 30 minutes
         retry: 3,
         retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),
         refetchOnWindowFocus: false,     // prevent surprising refetches during demo
       },
     },
   });
   ```

4. **Cursor-based pagination** on all list pages. Add `cursor` and `pageSize=25` to all list queries. Implement `useInfiniteQuery` with `getNextPageParam`. "Load more" button at bottom of each list — not page numbers. Current baseline likely uses `LIMIT/OFFSET` — replace it. Offset pagination breaks when rows are inserted between page loads, which happens constantly on a construction site.

5. **Offline queue** — when `navigator.onLine === false`, mutations queue to `localStorage` key `sitesync_offline_queue`. On `online` event, flush the queue in order. Show a banner: "You're offline — changes will sync when reconnected." This is not a nice-to-have; field workers have spotty LTE.

**Verify:**
```bash
grep -rn "useSupabaseMutation" src/hooks/ src/pages/ --include="*.ts" --include="*.tsx" | wc -l
# Must be >= 10

grep -rn "QueryBoundary" src/pages/ --include="*.tsx" | wc -l
# Must be >= 8

grep -rn "staleTime.*300000\|staleTime.*5 \* 60" src/lib/queryClient.ts
# Must match

grep -rn "useInfiniteQuery\|getNextPageParam" src/hooks/ --include="*.ts" | wc -l
# Must be >= 5
```

---

## Phase 2: All 9 State Machines (April 8–10, Runs 4–9)
**Goal: Every workflow in the app is machine-enforced. Invalid transitions are impossible, not just improbable.**

---

### E1-1: XState 5 — All 9 Machines Working — 2am April 9 (Run 5)

**Context:** 9 machines are "built" but may have gaps. This run audits and completes all 9. State machines are the backbone — without them, the app is just a form.

**Files:** `src/machines/rfiMachine.ts`, `src/machines/submittalMachine.ts`, `src/machines/changeOrderMachine.ts`, `src/machines/paymentAppMachine.ts`, `src/machines/punchItemMachine.ts`, `src/machines/taskMachine.ts`, `src/machines/dailyLogMachine.ts`, `src/machines/closeoutMachine.ts`

**Required states and transitions for each machine:**

| Machine | States | Terminal States |
|---|---|---|
| RFI | draft → submitted → under_review → responded → closed | closed, void |
| Submittal | draft → submitted → in_review → approved / rejected / revise_and_resubmit | approved, rejected |
| Change Order | draft → submitted → under_review → approved / rejected | approved, rejected |
| Payment App | draft → submitted → certified → paid | paid, void |
| Punch Item | open → in_progress → completed → verified | verified, void |
| Task | todo → in_progress → completed | completed |
| Daily Log | draft → submitted | submitted |
| Closeout | in_progress → items_complete → closed | closed |

**For each machine, every transition must:**
1. Have a `guard` that checks user role via `canPerform(context.userRole, event.type)` — typed, not string-matched.
2. Have an `entry` action that calls `supabase.from(table).update({ status, ball_in_court, updated_at })`.
3. Have an `entry` action that writes to `audit_log`: `{ resource_type, resource_id, action, actor_id, from_state, to_state, timestamp }`.
4. Have an `entry` action that calls the `notify` service to create a notification for the new ball-in-court owner.
5. Throw a `InvalidTransitionError` (typed) if the guard fails — never silently return without doing anything.

**Unit tests — each machine needs a test file `src/machines/__tests__/{name}Machine.test.ts`:**
```ts
describe('rfiMachine', () => {
  it('transitions draft → submitted on SUBMIT event', () => { ... });
  it('rejects APPROVE from draft state', () => { ... });
  it('transitions through full happy path to closed', () => { ... });
  it('writes audit entry on each transition', () => { ... });
});
```

**Verify:**
```bash
ls src/machines/*.ts | wc -l
# Must be >= 8

grep -rn "InvalidTransitionError\|guard.*canPerform" src/machines/ | wc -l
# Must be >= 20

ls src/machines/__tests__/ | wc -l
# Must be >= 8

npm test src/machines/ -- --run 2>&1 | tail -5
# Must show all tests passing
```

---

### E1-2: RFI and Submittal Machines — UI Wired — 2am April 10 (Run 7)

**Files:** `src/pages/RFIDetail.tsx`, `src/pages/SubmittalDetail.tsx`, `src/components/WorkflowTimeline.tsx` (create)

**What to do:**

1. Create `src/components/WorkflowTimeline.tsx` — a reusable horizontal stepper that renders all states of a machine, highlights the current state, and marks completed states with a checkmark. Used by RFI, Submittal, CO detail pages.

2. `src/pages/RFIDetail.tsx`:
   - Top: `<WorkflowTimeline states={rfiStates} current={rfi.status} />`
   - Ball-in-court banner: bold name, role, avatar. Updates via realtime subscription on `rfis` table for this row.
   - Action buttons: computed from machine's available events for current state. A `draft` RFI shows only "Submit." A `submitted` RFI shows only "Mark Under Review." Never show unavailable transitions.
   - Clicking an action button fires the machine event, optimistically updates the UI, and persists to DB. If DB write fails, machine rolls back to previous state and shows error toast.
   - Activity feed at bottom: all `audit_log` entries for this RFI, newest first.

3. `src/pages/SubmittalDetail.tsx`: same pattern. The `revise_and_resubmit` state is critical — when a submittal is sent back, show a prominent yellow banner: "Revisions Required — See Comments." The new submission resets the review cycle.

**Verify:**
```bash
grep -rn "WorkflowTimeline" src/pages/ src/components/ | wc -l
# Must be >= 3

grep -rn "useMachine\|useActor\|interpret" src/pages/RFIDetail.tsx src/pages/SubmittalDetail.tsx | wc -l
# Must be >= 2

# Manual: create RFI, walk to closed state, verify audit_log has 5 entries (one per transition)
npx supabase db query "SELECT action, from_state, to_state FROM audit_log WHERE resource_type='rfi' ORDER BY created_at DESC LIMIT 10"
```

---

## Phase 3: World-Class AI (April 10–11, Runs 8–11)
**Goal: The AI Copilot is smarter than anything a GC has seen in a construction PM tool.**

---

### E2-1: Streaming AI Copilot — 2am April 10 (Run 8)

**Files:** `supabase/functions/ai-copilot/index.ts`, `src/hooks/useCopilotStream.ts` (create), `src/components/CopilotPanel.tsx`

**What to do:**

1. **Streaming response in `ai-copilot` edge function.** The function must use Server-Sent Events:
   ```ts
   const stream = await openai.chat.completions.create({
     model: 'gpt-4o',
     stream: true,
     messages: [systemMessage, ...conversationHistory, userMessage],
   });
   const encoder = new TextEncoder();
   const readable = new ReadableStream({
     async start(controller) {
       for await (const chunk of stream) {
         const text = chunk.choices[0]?.delta?.content ?? '';
         controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
       }
       controller.enqueue(encoder.encode('data: [DONE]\n\n'));
       controller.close();
     },
   });
   return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
   ```

2. **System prompt must include real project context.** Before calling the LLM, fetch:
   - Open RFIs (title, number, days open, assignee)
   - Overdue tasks (title, due date, days overdue)
   - Budget: total variance, categories in the red
   - Schedule: tasks starting this week, any float < 3 days
   - Last 5 daily log entries (summary)
   Build a structured system prompt: "You are SiteSync AI, the project intelligence for [Project Name], a $[Contract Value] construction project. Current status: [% complete]. Critical items: [list]. Answer questions about this project using only the data below..."

3. **`src/hooks/useCopilotStream.ts`** — reads the SSE stream and appends tokens to a `React.useState` string, triggering re-render on each token. API: `{ messages, sendMessage, isStreaming, error }`.

4. **`src/components/CopilotPanel.tsx`** — renders the streaming response word-by-word. Shows a blinking cursor while `isStreaming`. Renders `cited_items` as chips after `[DONE]`. Input bar uses `env(safe-area-inset-bottom)` padding so iOS keyboard doesn't cover it.

**Verify:**
```bash
grep -rn "ReadableStream\|text/event-stream" supabase/functions/ai-copilot/index.ts
# Must find streaming setup

grep -rn "useCopilotStream\|isStreaming" src/components/CopilotPanel.tsx
# Must find streaming hook usage

# Manual: ask "What are the 3 biggest risks on Riverside Tower?" — response must stream word-by-word, not pop in all at once
# Response must mention at least 2 actual items by name from the DB
```

---

### E2-2: AI Insights and Schedule Risk — 2am April 11 (Run 9)

**Files:** `supabase/functions/ai-insights/index.ts` (create), `supabase/functions/ai-schedule-risk/index.ts` (create), `src/components/InsightsBanner.tsx` (create)

**What to do:**

1. **`ai-insights` edge function** — called on dashboard load (cached with `staleTime: 15min`). Fetches the same context as ai-copilot. Returns:
   ```json
   {
     "insights": [
       { "type": "budget_risk", "severity": "high", "message": "MEP category is 12% over budget", "action_url": "/budget?category=mep" },
       { "type": "schedule_risk", "severity": "medium", "message": "3 tasks on critical path are delayed", "action_url": "/schedule" },
       { "type": "rfi_backlog", "severity": "low", "message": "7 RFIs have been open > 14 days", "action_url": "/rfis?filter=overdue" }
     ]
   }
   ```

2. **`ai-schedule-risk` edge function** — analyzes tasks with `is_critical_path=true` and computes: `{ overallRiskScore: 0-100, confidenceInterval: [low, high], topRisks: [...], predictedCompletionDate, scheduledCompletionDate }`. Uses simple heuristic scoring (days of float, number of delayed predecessors, resource conflicts) if full CPM data isn't available.

3. **`src/components/InsightsBanner.tsx`** — rendered at top of Dashboard below the header. Shows 1–3 insight pills with color-coded severity. Clicking navigates to `action_url`. Dismissible per session (stored in `sessionStorage`).

**Verify:**
```bash
ls supabase/functions/ai-insights/index.ts
ls supabase/functions/ai-schedule-risk/index.ts

# Test ai-insights returns structured data
curl -s -X POST https://[your-project].supabase.co/functions/v1/ai-insights \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"[riverside-tower-id]"}' | jq '.insights | length'
# Must return >= 1
```

---

## Phase 4: Performance and Real-Time (April 11–13, Runs 10–15)
**Goal: The app is visibly faster than Procore. Real-time updates happen without page refresh.**

---

### E3-1: Lighthouse > 90 and Bundle Size < 250KB — 2am April 12 (Run 11)

**Files:** `src/main.tsx`, `vite.config.ts`, all heavy page components

**What to do:**

1. **Code splitting** — every page not in the critical path (the 6 demo pages) must be lazy-loaded:
   ```ts
   const DrawingsPage = React.lazy(() => import('./pages/Drawings'));
   const BIMPage = React.lazy(() => import('./pages/BIM'));
   const ReportsPage = React.lazy(() => import('./pages/Reports'));
   const AdminPage = React.lazy(() => import('./pages/Admin'));
   ```
   The 6 demo pages (Dashboard, Copilot, RFI, DailyLog, Budget, PayApp) are eagerly imported.

2. **Virtualization** — any list with potential for > 50 rows must use `@tanstack/react-virtual`. This includes: RFI list, Submittal log, Task list, Budget line items, SOV rows in pay app, Punch item list. Pattern:
   ```tsx
   const rowVirtualizer = useVirtualizer({ count: items.length, getScrollElement: () => parentRef.current, estimateSize: () => 56 });
   ```

3. **`React.memo` on all widget/card components.** `useMemo` on all computed values (budget totals, KPI calculations, sorted/filtered lists). Rule: if a component re-renders when its props haven't changed, add `memo`. If a value is recomputed on every render, add `useMemo`.

4. **Image optimization.** All images in `public/`: convert to WebP, max 200KB. Add `loading="lazy"` and `width`/`height` attributes to every `<img>`. Add `fetchpriority="high"` to the hero/logo image only.

5. **`homeostasis.yml` bundle guard** (if the CI config exists):
   ```yaml
   bundle:
     max_chunk_kb: 250
     fail_on_exceed: true
   ```

**Verify:**
```bash
npm run build
ls -lh dist/assets/*.js | awk '{print $5, $9}' | sort -rh | head -10
# No file > 250KB

npx lighthouse https://sitesync-pm.vercel.app/dashboard --only-categories=performance --output=json 2>/dev/null | jq '.categories.performance.score * 100'
# Must be >= 90
```

---

### E3-2: Real-Time Subscriptions on All 6 Demo Resources — 2am April 12 (Run 11, parallel with E3-1)

**Files:** `src/hooks/useRealtimeSubscription.ts` (create), all data hooks

**What to do:**

1. Create `src/hooks/useRealtimeSubscription.ts`:
   ```ts
   export function useRealtimeSubscription<T>(
     table: string,
     filter: string, // e.g. "project_id=eq.{id}"
     onInsert?: (record: T) => void,
     onUpdate?: (record: T) => void,
     onDelete?: (record: { id: string }) => void,
   )
   ```
   Uses `supabase.channel(...).on('postgres_changes', ...)`. Cleanup on unmount: `return () => supabase.removeChannel(channel)`.

2. Wire realtime to the 6 demo resources:
   - **Dashboard KPI tiles**: subscribe to `rfis`, `tasks`, `budget_line_items` for the project. On any change, invalidate the `dashboardKpis` query key.
   - **RFI list**: subscribe to `rfis`. On INSERT, prepend to list. On UPDATE, update the row in place.
   - **RFI detail**: subscribe to `rfis` for this `id`. On UPDATE, update `status`, `ball_in_court` in the UI immediately.
   - **Daily log list**: subscribe to `daily_logs`. On INSERT, prepend new entry.
   - **Budget**: subscribe to `budget_line_items`. On UPDATE, recalculate totals.
   - **Activity feed**: subscribe to `audit_log`. On INSERT, prepend new activity item.

3. **Notification toasts** — when a realtime event affects the current user:
   - `rfis` UPDATE where `ball_in_court = currentUser.id` → toast: "RFI-047 is now in your court — action required."
   - `submittals` UPDATE where `status = 'approved'` → toast: "Submittal S-023 has been approved."
   - `tasks` UPDATE where `assignee_id = currentUser.id AND status = 'overdue'` → toast: "Task overdue: [title]."

**Verify:**
```bash
grep -rn "useRealtimeSubscription" src/hooks/ src/pages/ | wc -l
# Must be >= 6

# Manual: open /rfis in two browser tabs. Create a new RFI in Tab 1. Verify it appears in Tab 2 within 2 seconds without refresh.
```

---

## Phase 5: Enterprise Polish (April 13–14, Runs 13–18)
**Goal: The product looks like it was built by a team of 50. Not a startup prototype.**

---

### E4-1: Complete PDF Export — 2am April 13 (Run 13)

**Files:** `src/lib/pdf/`, `src/components/PDFExport.tsx`
**Package:** `@react-pdf/renderer` (install if not present: `npm install @react-pdf/renderer`)

**What to do:**

1. Build PDF templates for the 4 documents GCs care about:
   - **RFI PDF** (`src/lib/pdf/RFIDocument.tsx`): RFI number, title, project, submitted by, date, description, response, attachments list. Company logo in header. AIA-style formatting.
   - **Daily Log PDF** (`src/lib/pdf/DailyLogDocument.tsx`): Date, weather, manpower breakdown by trade, work performed (transcript), equipment, safety incidents, photos list.
   - **Payment Application PDF** (`src/lib/pdf/PaymentAppDocument.tsx`): AIA G702 summary page + G703 continuation sheet. All totals. Signature line.
   - **Submittal Transmittal PDF** (`src/lib/pdf/SubmittalDocument.tsx`): submittal number, spec section, description, revision, status, action stamps.

2. Each PDF template uses `@react-pdf/renderer` `<Document>`, `<Page>`, `<View>`, `<Text>`, `<Image>`. The download button uses `pdf(Document).toBlob()` → `URL.createObjectURL()` → programmatic `<a>` click.

3. Print styles for all 6 demo pages (`@media print` in global CSS): hide navigation, hide action buttons, expand tables to full width. GCs sometimes just print — this must look professional.

**Verify:**
```bash
ls src/lib/pdf/*.tsx | wc -l
# Must be >= 4

grep -rn "react-pdf\|@react-pdf" src/lib/pdf/ | wc -l
# Must be >= 4

# Manual: open an RFI detail page, click "Export PDF", verify a clean AIA-formatted PDF downloads
```

---

### E4-2: Audit Trail Page — 2am April 13 (Run 13, parallel with E4-1)

**Files:** `src/pages/AuditTrail.tsx` (create), `src/hooks/useAuditLog.ts`
**Supabase table:** `audit_log` (`id`, `resource_type`, `resource_id`, `resource_title`, `action`, `actor_id`, `actor_name`, `from_state`, `to_state`, `ip_address`, `user_agent`, `outcome`, `created_at`)

**What to do:**

1. Ensure every state machine transition writes to `audit_log` (verify from E1-1 work).
2. Ensure `useSupabaseMutation` wrapper (from E0-4) also writes to `audit_log` for all mutations (create, update, delete) — not just state transitions.
3. Build `src/pages/AuditTrail.tsx`:
   - Filterable by: resource type, actor, date range, outcome (success/blocked)
   - Columns: Timestamp | Actor | Action | Resource | From → To State | Outcome
   - Export to CSV button
   - Virtualized (can have thousands of rows)
   - Accessible at `/audit-trail` for admin roles only (PermissionGate with `role: 'admin'`)
4. The audit trail is what a CTO asks for when evaluating enterprise software. "Can you show me every action taken on this project in the last 30 days?" — answer must be yes, immediately.

**Verify:**
```bash
ls src/pages/AuditTrail.tsx
grep -rn "audit_log" src/hooks/ supabase/functions/ src/machines/ | wc -l
# Must be >= 15 — audit log written from many places

# Manual: perform 10 actions (create RFI, submit, approve, create daily log, etc.), then open /audit-trail, verify all 10 appear with correct actor and timestamp
```

---

### E4-3: Accessibility and Keyboard Navigation — 2am April 14 (Run 15)

**Context:** Fortune 500 companies require WCAG 2.1 AA compliance. This is not optional.

**What to do:**

1. **Keyboard navigation** — open the app, press Tab repeatedly. Every interactive element must receive focus in logical order. Focus indicator must be visible (2px solid outline in brand color). Run axe DevTools on all 6 demo pages. Fix all critical and serious violations.

2. **Focus trapping in modals** — when a modal opens, focus must move to the first interactive element inside it. Tab must cycle within the modal only (use `focus-trap-react` or equivalent). When modal closes, focus returns to the triggering element.

3. **ARIA labels** — every icon-only button must have `aria-label`. Every status badge must have `role="status"` and `aria-label="Status: Under Review"`. Every form field must have a visible `<label>` (not just a placeholder).

4. **Page titles and breadcrumbs** — every page must set `document.title` to: "RFI-047: Electrical Drawings — Riverside Tower | SiteSync PM". Every page below the top level must have a breadcrumb: `Projects > Riverside Tower > RFIs > RFI-047`.

5. **404 and 500 pages** — `src/pages/NotFound.tsx` and `src/pages/ServerError.tsx` must exist, match the design system, and include navigation back to Dashboard. Do not use default Vite/Next error pages.

**Verify:**
```bash
grep -rn "aria-label\|role=\"status\"\|role=\"alert\"" src/components/ src/pages/ --include="*.tsx" | wc -l
# Must be >= 30

grep -rn "document.title\|<title>" src/pages/ --include="*.tsx" | wc -l
# Must be >= 12 (one per page)

ls src/pages/NotFound.tsx src/pages/ServerError.tsx
# Must both exist

# Manual: tab through the RFI create form with keyboard only. Complete and submit the form without touching a mouse.
```

---

### E4-4: iPad Responsive — Final Polish — 2am April 14 (Run 15, parallel with E4-3)

**The GC demo will be on an iPad Air. This is non-negotiable.**

**What to do:**

1. **Every demo page at 768×1024 (portrait) and 1024×768 (landscape):**
   - No horizontal scroll on any page.
   - All inputs use `font-size: 16px` minimum (iOS Safari auto-zooms inputs below 16px — this destroys the demo).
   - All tap targets: minimum 44×44px (WCAG 2.5.5). The mic button on Daily Log: minimum 64×64px.
   - No content hidden behind the iOS safe area (use `env(safe-area-inset-*)` padding).
   - G703 table: `<div class="overflow-x-auto">` wrapper with snap scrolling. Sticky first column (description).

2. **Navigation:** sidebar collapses to a bottom tab bar on screens < 1024px. Bottom tabs: Dashboard, RFIs, Daily Log, Budget, More. "More" reveals the full nav in a sheet. One-thumb reachability is essential.

3. **Copilot input:** pinned to bottom above the keyboard when iOS keyboard is open. Use `visualViewport` resize event to adjust position: when `window.visualViewport.height < window.innerHeight * 0.7`, the keyboard is open — shift the input up by `window.innerHeight - window.visualViewport.height`.

4. **Swipe gestures** on list pages: swipe left on an RFI row to reveal "Quick Actions" (Submit, Assign). Use `@use-gesture/react` or CSS `touch-action`. This is a GC wow moment — feels native.

**Verify:**
```bash
# All inputs >= 16px font size
grep -rn "fontSize.*1[0-5]px\|text-xs\|text-sm" src/pages/ --include="*.tsx" | grep "input\|textarea" | wc -l
# Must return 0

# Manual: Chrome DevTools → iPad Air (768x1024) → run all 6 demo steps → zero horizontal scroll
# Manual: test Copilot input visibility when virtual keyboard is open
```

---

### E4-5: Final Quality Gates — 2am April 14 (Run 17)

**What to do:**

1. **ESLint to zero errors.** Current baseline: 1,379. Run `npm run lint --fix` to handle auto-fixable violations. Remaining errors: fix manually. Do NOT use `eslint-disable` comments unless the rule is a false positive and the comment includes a clear explanation. Target: 0 errors.

2. **TypeScript strict mode.** `tsconfig.json` must have `"strict": true`. Zero `@ts-ignore` or `@ts-expect-error` without a comment explaining why. Zero implicit `any`.

3. **Test coverage to 75%.** Write tests for anything uncovered. Priority:
   - `src/machines/__tests__/` — all 9 machines, all happy paths and all guard rejections
   - `src/hooks/__tests__/` — all data hooks, mocking Supabase
   - `src/lib/schemas/__tests__/` — all Zod schemas, valid and invalid inputs
   - `src/components/__tests__/` — QueryBoundary, PermissionGate, WorkflowTimeline

4. **`SPEC.md` checkoff sweep.** Grep every unchecked criterion. Check off everything that is now verifiably complete. Add `<!-- verified: April 14 via [method] -->` comments. Count: should be substantially higher than the 0/431 baseline.

5. **`LEARNINGS.md` update.** Record: every migration run this week, every Supabase secrets change, every Vercel env var added, every non-obvious pattern discovered, every bug that bit you and how you fixed it. Future sessions depend on this.

**Verify:**
```bash
npm run lint 2>&1 | grep " error " | wc -l
# Must return 0

npm run build 2>&1 | grep "error TS" | wc -l
# Must return 0

npm test -- --coverage --run 2>&1 | grep "Statements" | grep -oE "[0-9]+\.[0-9]+" | head -1
# Must be >= 75

grep -c "\- \[x\]" SPEC.md
# Log this number in LEARNINGS.md
```

---

## Ongoing Rules (apply to every session, every run)

**Session startup (non-negotiable — takes 5 minutes, saves hours):**
```bash
# 1. Read AGENTS.md — defines constraints and tooling
cat AGENTS.md

# 2. Read LEARNINGS.md migration safety section
cat LEARNINGS.md

# 3. Understand what yesterday's session did
git log --oneline -10
git diff HEAD~1 --stat

# 4. Check current quality floor
npm run build 2>&1 | tail -5
npm run lint 2>&1 | grep " error " | wc -l
npm test -- --run 2>&1 | tail -5
```
Never skip this. The organism has no memory. This is its memory.

**Database migrations — iron rules:**
- `ls supabase/migrations/ | sort` before writing any migration. Read the last 3.
- Every migration is idempotent: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Never drop a column with data. Add → migrate → verify → drop in a later migration.
- Test locally first: `npx supabase start && npx supabase db reset`. If it fails locally, it will fail in production.
- Migration 20260407000001 is the RLS fix. Do not modify it. Build on top of it.

**Mock data — zero tolerance after April 8th:**
- After 2am April 8, if any of the 6 demo pages shows a value from `MOCK_`, `demoData`, a hardcoded constant, or a `TODO` comment — it is a blocking bug. Seed the database instead.
- Mocks are acceptable only in unit test files (`*.test.ts`, `*.spec.ts`).

**Edge functions — security contract:**
- Every edge function: extract user JWT from `Authorization` header, create per-request Supabase client with that JWT, never use the service role key.
- Every edge function: validate request body with Zod before touching any DB.
- Every edge function: return typed error responses: `{ error: { code: string, message: string, details?: unknown } }` with appropriate HTTP status codes (422 for validation, 401 for auth, 403 for permissions, 500 for unexpected).

**Commits and deployments:**
- Every 2am run pushes to `main`. Vercel auto-deploys. After push: `curl -s -o /dev/null -w "%{http_code}" https://sitesync-pm.vercel.app/dashboard` must return `200`. Log in LEARNINGS.md.
- If the build fails: fix the build before ending the session. A broken deployment is worse than no deployment — the GC could open the URL before April 15th.

**Quality gates before every commit:**
```bash
npm run build        # Zero TS errors
npm run lint         # Zero errors (by April 14)
npm test -- --run    # Zero regressions
npx tsc --noEmit     # Belt and suspenders TS check
```

---

## April 15th Readiness Check

The final 2am run on April 14th must execute this script and achieve exit code 0. Save as `scripts/demo-readiness-check.sh`.

```bash
#!/bin/bash
# SiteSync PM — April 15th Enterprise Readiness Check
# Exit 0 = ready. Exit 1 = DO NOT DEMO.

set -euo pipefail
PASS=0; FAIL=0
PROD_URL="https://sitesync-pm.vercel.app"

check() {
  local desc="$1" cmd="$2" expect="$3"
  local result; result=$(eval "$cmd" 2>&1) || true
  if echo "$result" | grep -qE "$expect"; then
    echo "  ✓  $desc"; PASS=$((PASS+1))
  else
    echo "  ✗  FAIL: $desc"
    echo "     Expected pattern: $expect"
    echo "     Got: $(echo "$result" | head -3)"
    FAIL=$((FAIL+1))
  fi
}

echo ""; echo "╔══════════════════════════════════════════════╗"
echo "║  SITESYNC PM — APRIL 15TH READINESS CHECK    ║"
echo "║  $(date '+%Y-%m-%d %H:%M:%S %Z')                    ║"
echo "╚══════════════════════════════════════════════╝"; echo ""

echo "── BUILD & TYPES ──────────────────────────────"
check "TypeScript: zero errors"        "npm run build 2>&1 | grep -c 'error TS' || echo 0" "^0$"
check "ESLint: zero errors"            "npm run lint 2>&1 | grep -c ' error ' || echo 0"   "^0$"
check "Test suite: all passing"        "npm test -- --run 2>&1 | grep -E 'passed|Tests'" "passed"
check "Coverage >= 75%"                "npm test -- --coverage --run 2>&1 | grep 'Statements' | grep -oE '[0-9]+\.[0-9]+' | head -1" "^[7-9][0-9]\|^100"

echo ""; echo "── SECURITY ───────────────────────────────────"
check "No service_role in functions"   "grep -r 'service_role' supabase/functions/ | wc -l"        "^0$"
check "No service_role in src"         "grep -r 'SERVICE_ROLE' src/ | wc -l"                       "^0$"
check "RLS enabled on all tables"      "npx supabase db query \"SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=false\"" "^0$"
check "Security headers deployed"      "curl -sI $PROD_URL | grep -ci 'x-frame-options'"            "^[1-9]"

echo ""; echo "── DATABASE ───────────────────────────────────"
check "Riverside Tower project"        "npx supabase db query \"SELECT COUNT(*) FROM projects WHERE slug='riverside-tower'\"" "^1$"
check "SOV >= 12 line items"           "npx supabase db query \"SELECT COUNT(*) FROM schedule_of_values WHERE project_id=(SELECT id FROM projects WHERE slug='riverside-tower')\"" "^1[2-9]\|^[2-9][0-9]"
check "Budget line items >= 8"         "npx supabase db query \"SELECT COUNT(*) FROM budget_line_items WHERE project_id=(SELECT id FROM projects WHERE slug='riverside-tower')\"" "^[89]\|^[1-9][0-9]"
check "Demo user in org_members"       "npx supabase db query \"SELECT COUNT(*) FROM org_members WHERE user_id=(SELECT id FROM auth.users WHERE email='demo@sitesync.app')\"" "^[1-9]"
check "Audit log table populated"      "npx supabase db query \"SELECT COUNT(*) FROM audit_log WHERE created_at > now() - interval '7 days'\"" "^[1-9][0-9]"

echo ""; echo "── MOCK DATA AUDIT ────────────────────────────"
MOCK_COUNT=$(grep -rn "MOCK_\|mockData\|hardcoded\|TODO.*data" \
  src/pages/Dashboard.tsx src/pages/Budget.tsx \
  src/pages/RFICreate.tsx src/pages/RFIDetail.tsx \
  src/pages/DailyLogNew.tsx src/pages/PaymentApplicationNew.tsx \
  src/components/CopilotPanel.tsx 2>/dev/null | wc -l || echo 0)
if [ "$MOCK_COUNT" -eq 0 ]; then
  echo "  ✓  No mock data in demo pages"; PASS=$((PASS+1))
else
  echo "  ✗  FAIL: $MOCK_COUNT mock data references found in demo pages"; FAIL=$((FAIL+1))
fi

echo ""; echo "── EDGE FUNCTIONS ─────────────────────────────"
check "ai-copilot function"       "ls supabase/functions/ai-copilot/index.ts"          "index.ts"
check "ai-insights function"      "ls supabase/functions/ai-insights/index.ts"         "index.ts"
check "ai-schedule-risk function" "ls supabase/functions/ai-schedule-risk/index.ts"    "index.ts"
check "weather function"          "ls supabase/functions/weather/index.ts"             "index.ts"
check "transcribe function"       "ls supabase/functions/transcribe/index.ts"          "index.ts"
check "AI copilot streams"        "grep -c 'text/event-stream' supabase/functions/ai-copilot/index.ts" "^[1-9]"

echo ""; echo "── STATE MACHINES ─────────────────────────────"
for machine in rfi submittal changeOrder paymentApp punchItem task dailyLog closeout; do
  file="src/machines/${machine}Machine.ts"
  check "$machine machine exists" "ls $file" ".ts"
done
check "All machines have audit entry action" "grep -rl 'audit_log' src/machines/ | wc -l" "^[89]\|^[1-9][0-9]"
check "Machine unit tests all pass"          "npm test src/machines/ -- --run 2>&1 | grep 'passed'" "passed"

echo ""; echo "── ARCHITECTURE ───────────────────────────────"
check "PermissionGate used >= 20x"       "grep -rn 'PermissionGate' src/pages/ --include='*.tsx' | wc -l"     "^[2-9][0-9]\|^[1-9][0-9][0-9]"
check "Zod schemas present"              "ls src/lib/schemas/index.ts"                                          "index.ts"
check "React Query config present"       "grep -c 'staleTime.*300000' src/lib/queryClient.ts"                  "^[1-9]"
check "Realtime subscriptions present"   "grep -rn 'useRealtimeSubscription' src/ | wc -l"                     "^[6-9]\|^[1-9][0-9]"
check "Audit trail page exists"          "ls src/pages/AuditTrail.tsx"                                          ".tsx"
check "PDF templates present"            "ls src/lib/pdf/*.tsx | wc -l"                                         "^[4-9]"
check "404 page exists"                  "ls src/pages/NotFound.tsx"                                            ".tsx"

echo ""; echo "── PRODUCTION HEALTH ──────────────────────────"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/dashboard")
check "Dashboard returns HTTP 200"  "echo $HTTP_STATUS"  "^200$"

echo ""
echo "╔══════════════════════════════════════════════╗"
printf  "║  RESULTS: %3d passed · %3d failed             ║\n" $PASS $FAIL
echo "╚══════════════════════════════════════════════╝"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "  ✗  ENTERPRISE DEMO NOT READY — $FAIL checks failed."
  echo "     A Fortune 500 CTO will find these gaps."
  echo "     Fix all failures before Walker returns."
  exit 1
else
  echo ""
  echo "  ✓  ALL CHECKS PASSED."
  echo "  ✓  Enterprise-grade. CTO-ready. Ship it."
  echo "  Walker returns tomorrow. The product is ready."
  exit 0
fi
```

**Manual checks — organism logs results in `LEARNINGS.md` on April 14th morning:**

- [ ] Load `https://sitesync-pm.vercel.app/dashboard` on physical iPad Air. No horizontal scroll. All KPI tiles load with real data in < 3 seconds.
- [ ] Press F12 in Chrome on any demo page. Zero red console errors during the full 6-step demo flow.
- [ ] Run the full 6-step demo from start to finish without touching developer tools. Under 8 minutes.
- [ ] Ask AI Copilot "What are the top 3 risks on Riverside Tower?" Verify streaming response names 3 real items from the database.
- [ ] Create an RFI from scratch, walk it to `closed` state. Open Supabase Studio → `audit_log`. Verify 5 rows appear for that RFI with correct `from_state → to_state`.
- [ ] Open `/audit-trail`. Verify it shows the last 30 days of all actions with correct actors, timestamps, and outcomes.
- [ ] Click "Export PDF" on an RFI detail page. Verify a clean, AIA-formatted PDF downloads with no blank fields.
- [ ] Tab through the RFI create form with keyboard only. Complete and submit without touching a mouse.
- [ ] Temporarily disconnect WiFi on the iPad. Attempt to create an RFI. Verify offline banner appears. Reconnect. Verify RFI syncs automatically.
- [ ] Open the app as a user with read-only role. Verify all action buttons (Submit, Approve, Delete) are hidden — not disabled, hidden.

---

*Mission complete when `bash scripts/demo-readiness-check.sh` exits 0 and all manual checks pass.*
*Walker doesn't need a demo. He needs enterprise software. Build accordingly.*
