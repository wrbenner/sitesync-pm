# Tonight's Direction — April 10, 2026

**5 days until April 15 demo. The plumbing is done. Tonight we build the intelligence.**

---

## The Gap (What Is vs What Should Be)

The organism made real progress in the last 48 hours. Six commits landed since April 9: project creation flow, Dashboard onboarding, RFI create modal fix, AI Copilot fallback, Dashboard metrics fallback, DailyLog permission fix. The CRUD foundation is now solid.

But here is the honest page by page assessment:

| Page | Data State | Intelligence State | Demo Ready? |
|------|-----------|-------------------|-------------|
| Dashboard | REAL queries, project creation works, metric cards animate | KPI tiles show numbers. No narrative. No "here is what matters today." | Functional, not impressive |
| RFIs | REAL data, full CRUD, empty/error/loading states all handled | List view with status badges. No "this RFI is on the critical path." | Solid table stakes |
| DailyLog | REAL data, full workflow (create/submit/approve/reject), voice capture | Logs exist. No pattern matching across logs. No trend detection. | Good for demo |
| AI Copilot | LLM chat via useMultiAgentChat, graceful fallback when edge function unavailable | The edge function may not have project context. Responses may be generic or error out. | THE critical gap |
| Budget | REAL data via cost API, inline edits, treemap, S curve, earned value | Shows numbers. No forecasting. No "this line item is trending 15% over." | Missing error UI |
| Submittals | REAL data, full CRUD, approval chain visualization | Table with ball in court. No "this submittal blocks the drywall start." | Solid table stakes |
| PunchList | REAL data, full verification workflow, photo support | List with status. No "47 items, 12 in Zone C, 80% are electrical." | Solid table stakes |
| Schedule | Realtime queries, Gantt UI, KPI cards | Import/save to DB may be WIP. No float analysis or critical path. | Uncertain |
| PaymentApplications | Multiple real queries, complex G702/G703 flow | Some mutations return "Feature pending configuration." PDF gen uncertain. | Stubs remain |

**The three largest gaps between vision and reality:**

1. **The AI Copilot does not think about the project.** VISION_CORE.md says: "Walker types 'What needs attention this week?' and the response names real items: 'RFI-047 on the electrical drawings is 3 days overdue.'" Reality: the copilot has a chat UI that calls an edge function. That edge function may not query project data. It may return generic responses or fail entirely. This is the single biggest gap because the copilot IS the differentiator. Without it, we are Procore with better CSS.

2. **No page has a predictive or synthesized insight.** Every page shows data the user already knows (their RFI list, their budget numbers, their punch items). No page shows what the user does NOT know: which RFI threatens the schedule, which budget line is trending toward overrun, which subcontractor is consistently late on punch items. The vision says "we surface what no human would catch in time." Today we surface what a spreadsheet already shows.

3. **Payment Applications has stubs.** FEEDBACK.md Step 6 requires G702/G703 pre populated from SOV + change orders, editable line items, and PDF export. The page exists with complex queries but some mutation handlers show "Feature pending configuration" toasts. PDF generation may not work end to end. This is the most complex page and the one most likely to embarrass in a demo.

---

## The Insight (Cross Domain Synthesis)

**Insight 1: The hooks exist, the copilot does not use them.**

The codebase has 100 files using `fromTable`, 30 files with `useQuery`, and a massive mutations library with 50+ hooks (useCreateRFI, useUpdateBudgetItem, useApproveChangeOrder, etc.). The data layer is rich. But `AICopilot.tsx` uses `useMultiAgentChat` which calls an edge function — and that edge function is the only path to intelligence. It does not import `useRFIs` or `useBudgetData` or `useScheduleActivities`. The intelligence layer is completely disconnected from the data layer.

**The fix is not to make the edge function smarter. The fix is to gather project context on the client side and send it WITH the user's question.** The hooks already exist. The data is already queryable. The copilot panel just needs to call 4 or 5 hooks (open RFIs, overdue items, budget variance, schedule status), serialize the results, and include them in the prompt to the LLM. This is a wiring problem, not an AI problem.

**Insight 2: "Feature pending configuration" hides real capability.**

PaymentApplications.tsx has 6+ query hooks (usePayApplications, useContracts, useRetainageLedger, useLienWaivers, usePayAppSOV) and complex mutation hooks (upsertPayApplication, approvePayApplication, generateWaiversFromPayApp). The data model is sophisticated. But some handlers toast "Feature pending configuration" instead of calling the mutation. The gap between the API surface and the actual DB writes is likely small — the mutation hooks exist in `src/hooks/mutations/index.ts`. These stubs may just need the actual mutation call wired in where the toast placeholder sits.

---

## The Position (Competitive Context)

**Where we are already differentiated:**
- AI native architecture (copilot, multi agent chat, predictive alerts — the scaffolding exists even if the intelligence doesn't flow yet)
- Field first UX: 56px touch targets everywhere, voice capture in daily logs, mobile layout with Capacitor
- Modern stack speed: React 19 + Vite + Supabase realtime vs Procore's monolith

**Where we are behind on table stakes:**
- Payment Applications: Procore's AIA G702/G703 flow is battle tested. Ours has stubs.
- Schedule: Procore supports P6/XER import natively. Our schedule import may not save to DB.
- Reporting: No PDF export confirmed working across pages.

**The ONE capability that makes a GC say "I have never seen that":**

*The copilot that actually knows your project.*

When the GC types "What should I focus on today?" and the system responds: "You have 3 overdue RFIs. RFI-012 (mechanical coordination) is 6 days past due and the mechanical rough in is scheduled for next week — if this doesn't resolve by Thursday, you lose 4 days of float. Your budget is 3.2% under on electrical but committed costs suggest you will be 8% over by close out. And you have 12 new punch items from yesterday's walkthrough, 9 assigned to Pacific Drywall who has a 72 hour average response time."

Nobody does this. Procore's Helix AI can answer questions about your data. It cannot synthesize across RFIs, budget, schedule, and punch list in one breath and tell you what to DO about it. That is the ceiling.

---

## The Direction (Strategic Focus)

### Primary Direction: Make the AI Copilot deliver project aware intelligence.

This is the single highest leverage action because:
1. It is the differentiator that no competitor has
2. It uses infrastructure that already exists (hooks, data layer, edge function)
3. It compounds: once the copilot has context, every future enhancement (predictions, risk alerts, natural language queries) becomes possible
4. FEEDBACK.md Demo Step 2 explicitly requires it
5. VISION_CORE.md says the demo needs "one moment that stops him cold." This is that moment.

**What the Builder should do:**
Wire the CopilotPanel (or the edge function) to gather real project context before sending the user's question to the LLM. The context payload should include: open RFI count + overdue RFIs with subjects, budget summary (original, revised, billed, variance), recent daily log entries, open punch item count by status, and schedule status if available. The LLM receives this context as a system message and the user's question as the user message. The response should name real items and give actionable advice.

If the edge function is not configurable (ANTHROPIC_API_KEY not set, function not deployed), the fallback is to generate the "intelligence summary" client side using the data already available from hooks. A static (non LLM) summary that says "3 overdue RFIs, budget 2.1% under, 47 open punch items" is better than a broken chat. The AI streaming response is the wow moment, but the data synthesis alone is valuable.

### Fallback Direction: Unstub Payment Applications.

If the copilot direction is blocked after 30 turns (edge function errors, auth issues, API key missing with no workaround), switch to completing the PaymentApplications flow. Wire the "Feature pending configuration" handlers to their actual mutation hooks. Verify G702 summary pre populates from SOV. Verify line item editing saves. This is table stakes but it is Demo Step 6 and a GC who sees a broken pay app form will not trust the product.

### Do NOT work on tonight:
- **ESLint cleanup** (1032 errors — not demo visible, purely internal quality)
- **Bundle size reduction** (1868KB vs 250KB target — important but 5 day horizon, not tonight)
- **Schedule file import** (complex, uncertain outcome, not the wow moment)
- **Non demo pages** (Marketplace, Integrations, Sustainability, Estimating, Permits, etc.)
- **Test coverage** (43.2% — Swarm handles this, not the Builder)
- **Infrastructure or refactoring** (urgency.json explicitly forbids this: "NO infrastructure, NO refactoring")

---

## Success Criteria

Tonight is a success if:

1. **The AI Copilot responds with project specific information.** A user types "What needs attention this week?" and the response references actual data from the project — real RFI subjects, real budget numbers, real punch item counts. Not generic construction advice. Not "I don't have access to your data." The response names at least one real entity from the database.

2. **The Dashboard shows an intelligence layer above the KPI tiles.** Either an AI generated summary or a computed insight (e.g., "3 RFIs overdue, 1 on critical path" or "Budget tracking 2.1% under — on target") that synthesizes data from multiple sources. The GC should see something they did NOT ask for — the system surfacing what matters proactively.

3. **Zero "Feature pending configuration" toasts in the demo flow.** Every button the GC clicks in the 6 step demo flow (Dashboard → Copilot → RFI → DailyLog → Budget → PayApp) either performs its action or shows a meaningful error. No placeholder toasts.

---

## Context for the Builder

**DB and API state:**
- 48 Supabase migrations deployed. Tables exist for all entities.
- The project creation flow works (commit 3338102). Dashboard shows created projects.
- All core hooks exist: useRFIs, useSubmittals, usePunchItems, useDailyLogs, useBudgetData, useScheduleActivities, usePayApplications. These are REAL and query Supabase.
- The mutations library in `src/hooks/mutations/index.ts` has 50+ hooks ready to use.
- Edge function `ai-copilot` exists in `supabase/functions/`. It needs ANTHROPIC_API_KEY set in Supabase secrets to work. If that is not available, build the context gathering client side and use a fallback.

**Key files for the copilot direction:**
- `src/pages/AICopilot.tsx` — The chat page UI (856 lines)
- `src/components/ai/CopilotPanel.tsx` — The panel component (uses fromTable)
- `src/hooks/useMultiAgentChat.ts` — The chat hook
- `src/hooks/useSupabase.ts` — Contains useAICopilot hook
- `src/stores/copilotStore.ts` — Copilot state management

**Key files for the PayApp fallback:**
- `src/pages/PaymentApplications.tsx` — Main page
- `src/hooks/mutations/index.ts` — Contains mutation hooks
- `src/hooks/useSupabase.ts` — Contains query hooks

**Patterns that work (from LEARNINGS.md):**
- Copy CreateRFIModal.tsx pattern for any new form modal
- Use `createAuditedMutation` for write operations
- Never use floating point for money — integer cents
- Supabase RLS: always use `(select auth.uid())` wrapper, not bare `auth.uid()`

**What broke recently and was fixed:**
- DailyLog "New Entry" button had wrong permission key (fixed 478b8cf)
- RFIs empty state create modal was missing props (fixed 8609d98)
- Dashboard 404 on Vercel (fixed with vercel.json SPA routing, f05ec00)
- These suggest the create flows are fresh code — test them before building on top.

**The build may not compile locally** — `npm install` may be needed. The CI uses `rm -f package-lock.json && npm install` (LEARNINGS.md: Vite 8/Rolldown lockfile issue). Run that first.
