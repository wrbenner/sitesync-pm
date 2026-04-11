# Tonight's Direction — April 11, 2026 (Night 8)

**URGENCY: 4 days to demo. The foundation is solid. Now build the moment that no competitor can replicate.**

---

## The Gap (What Is vs What Should Be)

### Page by Page Reality Check

| Page | Data | Intelligence | Error Handling | Demo Ready? |
|------|------|-------------|----------------|-------------|
| Dashboard | Real KPIs from Supabase. Weather widget: HARDCODED mock. Live Site: HARDCODED mock. | AI insights banner above fold with entity names (e.g. "RFI 047 is 3 days past due"). 3 tier fallback working. | ErrorBoundary wraps page. No inline query error state. | 85% — weather fakes it |
| RFIs | Real data. AI RFI draft from field notes. PredictiveAlertBanner. | ai-rfi-draft wired. Copilot context set. | ErrorBoundary + inline error banner + refetch. | 95% |
| Budget | Real data. Line items table with variance coloring. | Copilot context set. Computed insights flag overruns. | ErrorBoundary but no inline error state (toast only). | 85% |
| Schedule | Real data. GanttChart. ai-schedule-risk wired. | PredictiveAlertBanner. Risk analysis on demand. | ErrorBoundary wraps GanttChart only, NOT full page. | 80% — weakest error handling |
| PaymentApplications | Real G702/G703 flow. SOV line items. Auto calc. | Copilot context set. | ErrorBoundary. Row validation. Toast for query errors. | 85% — PDF export status unclear |
| ChangeOrders | Real data. | Copilot context set. | ErrorBoundary. No inline error state. | 80% |
| DailyLog | Real data. Voice transcription. AI daily summary. | ai-daily-summary wired. Copilot context set. | ErrorBoundary + inline error banner. | 95% |
| Submittals | Real data. Ball in court tracking. PredictiveAlertBanner. | Copilot context set. | ErrorBoundary + error banner + refetch. | 90% |
| PunchList | Real data. Location and assignee. PredictiveAlertBanner. | Copilot context set. | ErrorBoundary + error UI with AlertTriangle. | 90% |

### The Three Largest Gaps

**Gap 1: The wow moment does not exist yet.**
VISION_CORE.md says: "One moment that stops him cold. Something he has never seen before." We have not built this. The Dashboard shows intelligence, but it is intelligence the GC could derive by reading a spreadsheet carefully. The ai-conflict-detection edge function — which analyzes scheduling conflicts, weather impacts, RFI dependencies, and submittal lead times — EXISTS in `supabase/functions/ai-conflict-detection/index.ts` with complete implementation. It returns typed conflict objects with severity, affected items, and recommendations. But it has ZERO frontend invocation. This is a built brain with no mouth.

**Gap 2: Dashboard weather widget is visibly fake.**
The weather widget in Dashboard.tsx uses hardcoded forecast data (Mon/Tue/Wed with mock temps). A weather edge function and weather_cache table exist. The FEEDBACK.md demo flow explicitly requires "a weather widget pulled from the weather edge function using the project's lat/lon." This gap is small in effort but high in demo credibility. Fake weather next to real KPIs breaks the illusion.

**Gap 3: Build verification and infrastructure scoring.**
The build compiles cleanly (3.56s, 0 TS errors). But the nightly scoring system reported "Build status unclear or failing" on Night 6, costing 5/10 points. The verification pipeline scored 0/25 (no agents reporting). This is pure infrastructure debt, not a code problem. The code is healthier than the scoring system can perceive.

---

## The Insight (Cross Domain Synthesis)

**Connection 1: Eight AI edge functions exist. The UI surfaces three.**
The organism has built significant intelligence infrastructure:
- ai-copilot (conversational, 11 tools, role-based) — WIRED
- ai-chat (multi-turn with tool use) — WIRED
- ai-rfi-draft (field notes to formal RFI) — WIRED
- ai-daily-summary (narrative generation) — WIRED
- ai-schedule-risk (delay prediction) — WIRED
- ai-conflict-detection (cross entity conflicts) — NOT WIRED
- ai-insights (rule based alerts, CRON) — WIRED (via cache)
- generate-insights (alternative generator) — PARTIALLY WIRED

The pattern: every function that is wired to a UI delivers clear demo value. Every unwired function is wasted intelligence. The ai-conflict-detection function is the single highest leverage unwired capability because it synthesizes ACROSS entities (schedule + weather + RFIs + submittals), which is exactly what no competitor does.

**Connection 2: The computed insights evolution reveals the right pattern.**
Commit 0991304 enhanced computed insights to reference specific entity names ("RFI 047 is 3 days past due. Ball in court: Architect") instead of generic counts ("1 RFI is overdue"). This was the right instinct. The next evolution is not more insights — it is CONFLICT insights that connect entities the human brain would not connect: "The electrical rough-in Phase 3 start date is 2 days after the RFI-047 response deadline. If RFI-047 response slips, Phase 3 is at risk. Current weather forecast shows rain on the Phase 3 start date. Recommend: escalate RFI-047 and identify indoor backup scope for Phase 3 crew." THAT is the parking lot phone call.

---

## The Position (Competitive Context)

### Where We Are Already Differentiated
- **Project-aware conversational AI.** Procore's Helix AI queries data. Our ai-copilot reasons about it across 11 data sources with tool use and conversation history. This is real and working. But the demo audience will only discover it if they ask a question. Passive intelligence is invisible intelligence.
- **Entity-specific insights.** The AI insights banner on Dashboard names real RFIs, budget lines, and schedule phases. Procore cannot do this. But the GC needs to SEE this in the first 10 seconds, not after scrolling.
- **AI RFI drafting.** No competitor generates formal RFIs from field notes. This is a 2-hour-to-10-second Amazon Test win. Working today.

### Where We Are Behind on Table Stakes
- **PDF export for AIA G702/G703.** Every GC expects this. It is in the FEEDBACK demo flow (Step 6). Status unclear. If this doesn't work, the PM loses credibility on the financial side.
- **Weather integration.** Hardcoded weather on the dashboard is worse than no weather. A GC who sees "72 degrees, sunny" when it's raining outside will question everything else.

### The One Capability for "I Have Never Seen That"
**Proactive cross-entity conflict detection surfaced on the Dashboard.** "Your concrete pour scheduled for Thursday conflicts with the weather forecast (72% chance of rain). RFI-047 response (electrical rough-in) is due the same day — if both slip, Phase 3 delays by an estimated 4 days." This connects schedule + weather + RFIs + cost impact in a single proactive alert. No construction platform does this. Procore's Helix AI can answer questions about data. It cannot VOLUNTEER a connection between weather, RFIs, and schedule risk that the PM didn't know to ask about.

---

## The Direction (Strategic Focus)

### PRIMARY: Surface the Conflict Intelligence (The Wow Moment)

Wire `ai-conflict-detection` to the Dashboard and/or Schedule page. This edge function already:
- Analyzes schedule phases against weather forecasts
- Detects RFI dependencies blocking critical path items
- Identifies submittal lead time conflicts
- Returns typed conflict objects with severity, affected_items, and recommendations

The implementation is: call the function, display the conflicts prominently (above the fold or as a dedicated "Conflicts Detected" alert section), and make affected items clickable to navigate to the relevant entity.

This is the ONE thing the GC has never seen. Build it tonight.

### SECONDARY (if primary is complete): Weather Widget + Error State Hardening

1. Wire the weather edge function (or weather_cache table data) to the Dashboard weather widget, replacing the hardcoded forecast. This is a small change with high demo credibility impact.
2. Add inline query error states to Dashboard, Budget, ChangeOrders, and Schedule pages. Currently these pages only show toasts on query failure — a demo audience clicking around during a network blip would see silent failures. Copy the pattern from RFIs.tsx (error banner with refetch button).

### EXPLICITLY DO NOT

- **Do not add new pages or features.** 40 pages exist. The organism is feature-rich. More features add surface area for bugs 4 days before demo.
- **Do not refactor or restructure.** The architecture is working. Any refactor risks regression.
- **Do not work on CI/CD scoring infrastructure.** The verification pipeline scoring 0/25 is real but it is a CI problem, not a product problem. The code is healthy. Fix the scoring system AFTER demo.
- **Do not add tests tonight.** 74 financial tests just landed (e79ae78). Coverage is at 43.2%. More tests are good but not what moves the demo forward.
- **Do not touch Supabase migrations.** 48 migrations exist. The database is stable. Any migration risk 4 days before demo is unacceptable.

---

## Success Criteria

1. **The Dashboard or Schedule page shows at least one proactive cross-entity conflict** that connects two or more entity types (e.g., schedule phase + weather, or RFI deadline + schedule dependency). The conflict must name specific entities and include a recommended action. Observable in under 10 seconds of page load.

2. **The Dashboard weather widget shows data from the weather_cache table or weather edge function**, not hardcoded values. If no weather data exists for the project, show a clear empty state ("No weather data — configure project location"), not fake temperatures.

3. **No demo-critical page can silently fail.** Every query error on Dashboard, Budget, ChangeOrders, and Schedule surfaces a visible error state with a retry option — not just a toast notification.

---

## Context for the Builder

### Build Status
- **Build: GREEN** — `npx vite build` completes in 3.56s with 0 errors
- **TypeScript: CLEAN** — 0 errors
- **Bundle: 1869KB** — large chunks (vendor-pdf at 1.9MB) but code-split behind routes

### Key Files for Tonight's Primary Direction
- `supabase/functions/ai-conflict-detection/index.ts` — The edge function to wire. Read it first. It expects a project_id and returns an array of conflict objects.
- `src/pages/Dashboard.tsx` — Where conflicts should surface (above fold, near AI insights banner)
- `src/components/dashboard/widgets/AIInsightsWidget.tsx` — Existing pattern for displaying intelligence
- `src/api/endpoints/ai.ts` — The getAiInsights fallback chain. Conflict detection could follow this pattern.
- `src/pages/Schedule.tsx` — Alternative surface for conflicts if Dashboard placement is awkward

### Key Files for Weather Fix
- `src/pages/Dashboard.tsx` — Lines 18-25 contain the hardcoded weather forecast
- The weather_cache table exists in Supabase. Check if it has data for Riverside Tower.
- A weather edge function exists. Check `supabase/functions/` for weather-related functions.

### Key Files for Error State Hardening
- `src/pages/RFIs.tsx` lines 403-410 — The gold standard pattern: checks query error, shows inline banner with refetch button
- `src/pages/Dashboard.tsx` — Needs inline error state (currently relies on ErrorBoundary only)
- `src/pages/Budget.tsx` — Same need
- `src/pages/ChangeOrders.tsx` — Same need
- `src/pages/Schedule.tsx` — ErrorBoundary wraps only GanttChart, not the full page export

### Quality Floor (do not regress)
- tsErrors: 0
- anyCount: 1
- a11yViolations: 0
- coveragePercent: 43.2%
- testCount: 45

### The Standard
VISION_CORE.md: "He calls his operations director from the parking lot and says 'you need to see this.'"

That phone call happens because of ONE moment. Not because the KPIs load fast. Not because the touch targets are 56px. Not because the error boundaries work. Those are table stakes. The phone call happens because the system told him something he did not know, connecting dots he could not have connected in time. Build that moment tonight.
