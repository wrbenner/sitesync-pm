# MODULE_ASSIGNMENTS.md — Parallel Agent File Ownership

*Each agent owns specific files. No two agents ever touch the same file. This is what makes parallel execution safe.*

---

## Agent Alpha — "The Core PM Agent"
**Branch:** `auto/alpha-core-pm`
**Focus:** Connect core PM workflows to real Supabase data

### Owns These Files (ONLY these):
```
src/pages/RFIs.tsx
src/pages/Submittals.tsx
src/pages/Tasks.tsx
src/pages/PunchList.tsx
src/pages/Meetings.tsx
src/pages/Dashboard.tsx
src/hooks/queries/useRFIs.ts
src/hooks/queries/useSubmittals.ts
src/hooks/queries/useTasks.ts
src/hooks/queries/usePunchList.ts
src/hooks/mutations/useCreateRFI.ts
src/hooks/mutations/useCreateSubmittal.ts
src/hooks/mutations/useCreateTask.ts
e2e/rfi-workflow.spec.ts
e2e/submittal-workflow.spec.ts
src/test/pages/RFIs.test.tsx
src/test/pages/Submittals.test.tsx
src/test/pages/Tasks.test.tsx
```

### Acceptance Criteria (from SPEC.md):
1. Replace ALL mock arrays in these pages with real `supabase.from()` queries via React Query hooks
2. Every page: loading skeleton → error boundary → empty state → real data → real-time subscription
3. All action buttons wrapped in PermissionGate
4. RFI ball-in-court field shows correct responsible party
5. E2E test: create RFI, submit, verify appears in list

### NEVER touch:
- Any file not listed above
- src/stores/ (that's Agent Echo's territory)
- src/machines/ (that's Agent Echo's territory)
- src/pages/Budget.tsx, Drawings.tsx, etc. (other agents)

---

## Agent Beta — "The Field Agent"
**Branch:** `auto/beta-field`
**Focus:** Field operations — drawings, safety, daily log, field capture

### Owns These Files (ONLY these):
```
src/pages/Drawings.tsx
src/pages/DailyLog.tsx
src/pages/FieldCapture.tsx
src/pages/Safety.tsx
src/pages/Equipment.tsx
src/pages/Crews.tsx
src/pages/Activity.tsx
src/pages/Lookahead.tsx
src/hooks/queries/useDrawings.ts
src/hooks/queries/useDailyLog.ts
src/hooks/queries/useSafety.ts
src/hooks/mutations/useCreateDailyLog.ts
src/hooks/mutations/useCreateSafetyReport.ts
e2e/daily-log.spec.ts
e2e/mobile.spec.ts
src/test/pages/DailyLog.test.tsx
src/test/pages/Safety.test.tsx
```

### Acceptance Criteria (from SPEC.md):
1. Replace all mock data with real Supabase queries
2. DailyLog: voice capture via supabase/functions/voice-extract working end-to-end
3. FieldCapture: camera works on web (getUserMedia) with Capacitor bridge for native
4. Safety: AI safety analysis via supabase/functions/ai-insights wired up
5. All offline sync tables registered in Dexie for these entities
6. 44px minimum touch targets on all interactive elements

### NEVER touch:
- Any file not listed above
- src/pages/RFIs.tsx, Budget.tsx (other agents)

---

## Agent Gamma — "The Financial Agent"
**Branch:** `auto/gamma-financial`
**Focus:** Financial engine — the feature CFOs switch for

### Owns These Files (ONLY these):
```
src/pages/Budget.tsx
src/pages/ChangeOrders.tsx
src/pages/PaymentApplications.tsx
src/pages/Financials.tsx
src/pages/LienWaivers.tsx
src/pages/Estimating.tsx
src/pages/Procurement.tsx
src/hooks/queries/useBudget.ts
src/hooks/queries/useChangeOrders.ts
src/hooks/queries/usePaymentApplications.ts
src/hooks/mutations/useCreateChangeOrder.ts
src/hooks/mutations/useCreatePaymentApplication.ts
src/services/stripeService.ts
e2e/payment-workflow.spec.ts
src/test/pages/Budget.test.tsx
src/test/pages/PaymentApplications.test.tsx
```

### Acceptance Criteria (from SPEC.md):
1. Replace all mock data with real Supabase queries
2. AIA G702/G703 PDF pre-populated from the project's Schedule of Values
3. Change order approval workflow through state machine
4. Budget: real-time committed vs actual vs projected
5. Stripe payment processing for sub payments
6. LienWaiver: generate, send, track status

### NEVER touch:
- Any file not listed above
- Supabase migration files (create new ones, never edit existing)

---

## Agent Delta — "The AI Agent"
**Branch:** `auto/delta-ai`
**Focus:** Connect all AI features to real edge functions

### Owns These Files (ONLY these):
```
src/pages/AICopilot.tsx
src/pages/AIAgents.tsx
src/pages/ProjectHealth.tsx
src/pages/Benchmarks.tsx
src/pages/TimeMachine.tsx
src/pages/Vision.tsx
src/hooks/queries/useAIInsights.ts
src/hooks/mutations/useAIChat.ts
src/hooks/mutations/useAgentRunner.ts
src/lib/ai/
e2e/ai-copilot.spec.ts
src/test/pages/AICopilot.test.tsx
```

### Acceptance Criteria (from SPEC.md):
1. AICopilot: real streaming responses from supabase/functions/ai-copilot edge function
2. AI Insights: wired to supabase/functions/ai-insights (schedule risk, budget variance, safety alerts)
3. ProjectHealth: real health score from supabase/functions/generate-insights
4. Agent runner: supabase/functions/agent-runner executes autonomously with proper error handling
5. All AI calls use anon key + user JWT (NOT service role key)
6. Streaming responses with proper loading states (no full-page spinner)

### NEVER touch:
- supabase/functions/ (those are already built — just consume them from the frontend)
- src/stores/ (Agent Echo)

---

## Agent Echo — "The Architecture Agent"
**Branch:** `auto/echo-architecture`
**Focus:** Type safety, store migration, state machines, test coverage

### Owns These Files (ONLY these):
```
src/stores/
src/machines/
src/types/
src/hooks/ (any hook not owned by Alpha/Beta/Gamma/Delta)
src/lib/
src/components/shared/
src/test/ (any test not owned by other agents)
vitest.config.ts
tsconfig.json
```

### Acceptance Criteria (from SPEC.md — P5-A tier):
1. Migrate 13 non-audited stores to createAuditedMutation pattern
2. Reduce `as any` casts from 179 to under 50
3. Add state machine tests for all 9 machines (transition testing)
4. Increase test coverage from 8% to 25% (just by testing existing code)
5. Fix any TypeScript strict errors

### NEVER touch:
- src/pages/ (any of them — that's Alpha/Beta/Gamma/Delta territory)
- supabase/migrations/

---

## The Golden Rule

**If a file is not in your list, you do not touch it. Not even to fix a bug in it.**

If you find a bug in another agent's file, create a note in QUESTIONS.md:
```
## [today's date] Bug in [filename] (Agent [X]'s territory)
Found: [what the bug is]
Fix: [what should be done]
```
The owning agent will fix it on their next run.

---

## Conflict Resolution

If two agents accidentally modify the same file (should not happen with proper assignments), the merge order is:
1. Echo merges first (architecture changes are foundational)
2. Alpha merges second (core PM)
3. Beta merges third (field)
4. Gamma merges fourth (financial)
5. Delta merges last (AI features, depends on everything else)
