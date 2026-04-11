# Tonight's Direction — April 11, 2026 (Night 6)
**4 days until April 15 demo. Phase: INTELLIGENCE SURFACING. The brain exists. Make it visible.**

---

## The Gap (What Is vs What Should Be)

### The Honest Assessment

The organism has been building plumbing for five nights. The plumbing works. Nine demo pages fetch real data from Supabase. The ai-copilot edge function gathers RFIs, at-risk schedule phases, budget items, weather, and project info, then sends them to Claude Sonnet for synthesis. The ai-insights function generates rule-based alerts. The ai-schedule-risk function predicts schedule disruptions.

**The problem: none of this intelligence is visible to the superintendent.**

Page by page:

| Page | Data | Intelligence | Demo Ready? |
|------|------|-------------|-------------|
| Dashboard | Real KPI tiles, activity feed | AIInsightsWidget exists but not prominent. No above the fold insights. | Data: yes. Intelligence: no. |
| RFIs | Real CRUD, pagination, filtering | Copilot context set. AI annotations. Predictive alerts. | Best integrated page. |
| Budget | Real queries, divisions, line items | AI insights hook exists. Copilot context set. | Data: yes. AI visible: partial. |
| Schedule | Real-time data, phases | Copilot context set. Predictive risk function exists. Error boundary present. | Strongest AI page. |
| DailyLog | Real CRUD, weather, transcription | Copilot context set. AutoNarrative for AI summaries. | Good integration. |
| PaymentApplications | Real queries, mutations work | **No copilot context.** No AI annotations. | Data only. Intelligence: zero. |
| ChangeOrders | Real queries, state machine | **No copilot context.** No empty state. | Data only. Intelligence: zero. |
| PunchList | Real CRUD, photo management | **No copilot context** (but has AI annotations). Error boundary present. | Partial. |
| Submittals | Real CRUD, Kanban view | **No copilot context** (but has AI annotations). | Partial. |
| AI Copilot (standalone) | Conversation history from DB | Edge function works with full project context. Export menu is stubs. | Backend: ready. Frontend: needs polish. |

### The Three Largest Gaps

**Gap 1: Intelligence exists but is invisible.** The ai-copilot edge function already performs cross-domain synthesis: it fetches open RFIs, at-risk schedule phases, budget items, weather cache, and project info, then assembles a context string for Claude. The ai-insights function generates rule-based alerts without LLM calls. But when the GC opens the Dashboard, he sees numbers. Not insights. Not "here is what needs your attention." The intelligence layer is a backend capability that has not yet become a user experience.

**Gap 2: Four pages are intelligence dead zones.** PaymentApplications, ChangeOrders, PunchList, and Submittals do not call `setPageContext()`. When the copilot opens from those pages, it shows generic prompts instead of domain-specific ones. The vision says "intelligence surfaces everywhere." Reality: intelligence surfaces on 5 of 9 pages.

**Gap 3: Seven of nine pages will white-screen on any error.** Only Schedule and PunchList have ErrorBoundary protection. If a Supabase query times out, if the network hiccups, if the project has unexpected null data, the page crashes to blank white. During a live demo, this is fatal. Not "embarrassing." Fatal. The GC closes the app and opens Procore.

---

## The Insight (Cross-Domain Synthesis)

**Insight 1: The backend is ahead of the frontend.** The ai-copilot edge function already implements the CAG (Context-Augmented Generation) pattern that Night 5 proposed building client-side. The edge function gathers multi-table context (lines 76-137 of supabase/functions/ai-copilot/index.ts), compiles it into a structured prompt, and sends it to Claude. The client-side work proposed in Night 5's TONIGHT.md (adding useQuery hooks to gather RFIs, budget, punch items) is **redundant** with what the edge function already does. The real work is: make the frontend call this edge function properly, handle the response, and present the insights with polish. Do not rebuild server-side intelligence on the client.

**Insight 2: The polish wave created a trap.** The last 10 commits (all `polish(*)` or `[auto-*]`) improved touch targets and aria attributes across every page. This was good work. But it created a false sense of completion. The pages look and feel better. They are more accessible. But they still show data, not decisions. A beautifully polished filing cabinet is still a filing cabinet. The next commit must make the filing cabinet think.

**Insight 3: The quality floor reveals a hidden asset.** `anyCount: 1` (down from 260), `tsErrors: 0`, `a11yViolations: 0`. The codebase is in the best shape it has ever been for shipping a new capability. The technical debt that would normally slow down feature work has been paid down. Tonight is the night to use that investment.

---

## The Position (Competitive Context)

### Where We Are Differentiated

SiteSync has something no competitor offers: **an AI copilot that synthesizes across RFIs, schedule, budget, and weather in a single breath.** Procore's Helix AI can query your data. It can tell you how many RFIs are open. It cannot tell you which specific RFI is on the critical path and will delay your concrete pour if not answered by Thursday. That cross-domain reasoning is our edge function's core capability. It already works. It just needs to be the thing the GC sees first.

Procore launched Agentic APIs and Agent Builder in Q1 2026. These are consumption-priced API endpoints. SiteSync's intelligence is embedded. The user does not "use an AI tool." The AI uses the user's context to surface what matters. This is the difference between a search box and a recommendation engine.

### Where We Are Behind on Table Stakes

- **PDF export**: Payment Applications need G702/G703 PDF generation. The "Export PDF" button exists but may be a stub.
- **Email notifications**: RFI submission should notify the ball-in-court party. Edge function exists (send-notification-email) but wiring is uncertain.
- **State machine completeness**: Invalid transitions may throw unhandled errors.
- **Error handling**: 7 pages will crash on network failure.

These are not differentiators. They are table stakes. But they must work during the demo.

### The "I Have Never Seen That" Moment

The GC opens the app. Before touching anything, the Dashboard shows:

> "RFI-047 on electrical drawings is 3 days overdue and blocking the Thursday concrete pour. Budget Division 26 is trending $47K over. Rain forecast Wednesday will affect exterior crews."

That is one sentence that synthesizes data from four different domains (RFIs, schedule, budget, weather) into one actionable insight. No construction platform has ever done this. This is the moment the GC calls his operations director from the parking lot.

---

## The Direction (Strategic Focus)

### PRIMARY: Make Intelligence the First Thing the GC Sees

The edge functions work. The data layer is rich. Tonight's job is **surfacing**, not building.

Specific priorities:

1. **Dashboard intelligence above the fold.** The AIInsightsWidget or equivalent must show 2-3 cross-domain insights as the first thing visible. These should come from the ai-insights edge function (rule-based, fast, no LLM latency) or from a client-side assembly of the data already being fetched. The insights must reference real project entities by name and number.

2. **Wire copilot context on the 4 dead-zone pages.** PaymentApplications, ChangeOrders, PunchList, Submittals each need `setPageContext()` calls and context-aware suggested prompts in the CopilotPanel configuration. This is surgical: add the call, add the prompts, test.

3. **Error boundaries on 7 unprotected pages.** Dashboard, RFIs, Budget, PaymentApplications, ChangeOrders, DailyLog, Submittals. A simple `<ErrorBoundary fallback={<ErrorFallback onRetry={...} />}>` wrapper on each page component. The ErrorBoundary and ErrorFallback components may already exist in the codebase; reuse them.

### SECONDARY (if primary is blocked):

4. **Remove or implement the "Feature pending configuration" stubs.** The AICopilot export menu shows three stub toasts. Either implement clipboard/share/PDF export or remove the menu items. Visible stubs during a demo are worse than missing features.

5. **Verify AI Copilot edge function invocation.** The CopilotPanel talks to the ai-copilot edge function. Verify the request/response cycle works end to end. If the ANTHROPIC_API_KEY is not configured in the deployment, the fallback should still show useful project context (open RFIs count, budget status, etc.), not an error.

### DO NOT WORK ON:

- **Linux CI build failure.** The Vite 8/rolldown native binding issue is a known CI-only problem. The Vercel deployment works. This is not demo-blocking. Fix after April 15.
- **Offline sync.** Important for field crews. Not demo-blocking. P0-5 is deferred.
- **MCP server.** Procore has it. We need it. Not in 4 days.
- **Further accessibility polish.** The last 10 commits already brought a11yViolations to 0 and added 56px touch targets everywhere. More polish now has diminishing returns. The intelligence layer is the differentiator.
- **Test coverage.** At 43%, it is low. But writing tests tonight does not make the demo better. Write tests after April 15.

### The Reasoning

Intelligence compounds. A GC who sees cross-domain insights on the Dashboard will explore the copilot. A copilot that gives contextual answers on every page reinforces the "this thinks about my project" narrative. Error boundaries ensure the demo survives the unexpected. This sequence (insights > context > resilience) delivers the maximum demo impact per hour invested. Every other direction (polish, tests, infra) is either already done or not demo-relevant.

---

## Success Criteria

1. **The Dashboard shows at least 2 AI-generated insights above the fold that reference real project data.** Verification: open /dashboard. Read the top section. See specific RFI numbers, budget amounts, or schedule dates. If it shows generic text or no insights, this criterion fails.

2. **The AI Copilot from any of the 9 demo pages shows page-contextual suggested prompts.** Verification: navigate to PaymentApplications, open copilot, see payment-specific prompts like "Retainage analysis" or "G702 review." Repeat for ChangeOrders, PunchList, Submittals. All 4 previously generic pages now show domain-specific prompts.

3. **No demo page white-screens on query failure.** Verification: temporarily break the Supabase connection (e.g., invalid project_id). Navigate to each of the 9 demo pages. Each shows an error state with retry button, not a blank screen.

---

## Context for the Builder

### What Already Works (do not rebuild)
- `supabase/functions/ai-copilot/index.ts`: Fetches RFIs, schedule phases, budget items, weather, project info. Calls Claude Sonnet with assembled context. Returns synthesized response.
- `supabase/functions/ai-insights/index.ts`: Rule-based insight generator. No LLM needed. Analyzes schedule phases, budget items, RFIs, punch items, crews.
- `supabase/functions/ai-schedule-risk/index.ts`: Schedule risk prediction via Claude.
- `src/components/ai/CopilotPanel.tsx`: Already reads `currentPageContext` from copilot store. Already renders context-aware prompts for rfis, budget, schedule, daily-log. Just needs entries for payment-applications, change-orders, punch-list, submittals.
- `src/stores/copilotStore.ts`: Has `setPageContext()` function ready to use.

### What Needs Building
- Dashboard intelligence widget that calls ai-insights or assembles insights from existing queries.
- Four `setPageContext()` calls in PaymentApplications, ChangeOrders, PunchList, Submittals.
- Four new prompt sets in CopilotPanel for payment-applications, change-orders, punch-list, submittals.
- ErrorBoundary wrappers on 7 pages.
- Removal or implementation of "Feature pending configuration" stubs.

### Build Environment
- `npm install` works. `npm run build` fails on Linux due to Vite 8/rolldown native bindings. This is CI-only; local dev and Vercel deploy work fine. See LEARNINGS.md "Vite 8 / Rolldown" entry.
- TypeScript compiles clean: `tsErrors: 0`, `anyCount: 1`.
- Quality floor: ESLint has 1032 errors (mostly pre-existing, not regressions).

### Key Files to Read Before Coding
1. `src/pages/Dashboard.tsx` (understand current widget layout)
2. `src/components/ai/CopilotPanel.tsx` (understand context-aware prompt system)
3. `src/stores/copilotStore.ts` (understand setPageContext API)
4. `supabase/functions/ai-copilot/index.ts` (understand what context the edge function gathers)
5. `supabase/functions/ai-insights/index.ts` (understand rule-based insight generation)

### The 4-Day Clock
- Night 6 (tonight): Intelligence surfacing + resilience
- Night 7: Polish the copilot interaction (streaming, response quality, cited items as chips)
- Night 8: Demo rehearsal dry run. Fix whatever breaks.
- Night 9: Buffer. Fix only what the rehearsal revealed.

There is no Night 10. Ship what you have on April 15.
