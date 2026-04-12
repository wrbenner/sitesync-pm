# Tonight's Direction — April 12, 2026 (Night 9)

**URGENCY: 3 days to demo. The intelligence is BUILT but DISCONNECTED. Tonight is about wiring, not building.**

---

## The Gap (What Is vs What Should Be)

### Page by Page Reality Check

| Page | Data | Intelligence | Demo Ready? |
|------|------|-------------|-------------|
| Dashboard | Real KPIs from Supabase. No weather widget (removed, not replaced). | DeterministicInsightsBanner shows COUNT based alerts ("3 overdue RFIs"). Entity specific insights EXIST in API but are NOT rendered. | 75% — intelligence gap |
| RFIs | Real data. AI RFI draft from field notes. PredictiveAlertBanner. | ai-rfi-draft wired. Copilot context set. | 95% |
| Budget | Real data. Line items with variance coloring. | Copilot context set. Computed insights flag overruns. | 85% |
| Schedule | Real data. GanttChart. ai-schedule-risk wired. | PredictiveAlertBanner. Risk analysis on demand. | 80% |
| PaymentApplications | Real G702/G703 flow. SOV line items. Auto calc. | Copilot context set. | 85% |
| ChangeOrders | Real data. | Copilot context set. | 80% |
| DailyLog | Real data. Voice transcription. AI daily summary. | ai-daily-summary wired. Copilot context set. | 95% |
| Submittals | Real data. Ball in court tracking. PredictiveAlertBanner. | Copilot context set. | 90% |
| PunchList | Real data. Location and assignee. PredictiveAlertBanner. | Copilot context set. | 90% |

### The Three Largest Gaps

**Gap 1: The rich intelligence exists in the API but the Dashboard renders generic counts.**

This is the most important finding tonight. The `getAiInsights` function in `src/api/endpoints/ai.ts` already:
- Queries specific overdue RFIs by rfi_number, subject, due_date, and ball_in_court
- Queries specific over budget line items by description and dollar amounts
- Queries specific at risk schedule phases by name
- Formats them as AIInsight objects with entity specific titles like "RFI 047 is 3 days past due. Ball in court: Architect"

But the Dashboard calls `useAiInsightsMeta(projectId)` which returns `{ live: boolean; lastUpdated: string }` — NOT the insights themselves. The condition at line 1002 (`insightsData?.insights`) is always undefined. The Dashboard always falls through to `DeterministicInsightsBanner`, which shows generic counts like "3 overdue RFIs need response" without naming any specific RFI.

The intelligence is built. The mouth is built. They are not connected to each other. This is a wiring gap, not a feature gap.

**Gap 2: The Dashboard has no weather data whatsoever.**

The weather widget was removed (the old hardcoded one is gone) but nothing replaced it. FEEDBACK.md Step 1 explicitly requires "a weather widget pulled from the weather edge function using the project's lat/lon." The weather_cache table exists in Supabase. A weather edge function exists. The Dashboard currently shows zero weather information. This is table stakes for the demo — a GC expects to see weather because it affects every field decision.

**Gap 3: Cross entity conflict detection remains unwired (third consecutive night).**

The `ai-conflict-detection` edge function at `supabase/functions/ai-conflict-detection/index.ts` accepts `{ project_id }` and returns `{ conflicts: ConflictItem[] }` with type, severity, description, affected_items, and recommendation. It analyzes schedule phases against weather, RFI dependencies blocking critical path items, and submittal lead time conflicts. It calls Claude Sonnet for analysis.

This has been the primary direction for Night 7 and Night 8. It has not been built either night. The builder has instead worked on error states, skeleton traps, and stub cleanup — valuable polish, but not capability building.

---

## The Insight (Cross Domain Synthesis)

**Connection 1: The insights rendering pipeline is the integration point for everything.**

The `AIInsightsBanner` component and `InsightRow` component already render severity colored, clickable alerts with titles, descriptions, and suggested actions. The `getAiInsights` function already produces entity specific insights. Conflict detection results have the same shape (severity, description, affected_items, recommendation). Weather alerts have the same shape. 

The builder does NOT need to create new UI components. Everything should flow through the existing insights pipeline:
- Step A: Connect `getAiInsights` (which exists) to the Dashboard (which renders insights)
- Step B: Add weather based insights to the computed fallback chain (query weather_cache, generate insight if precipitation > 50% on a day with outdoor activity)
- Step C: Add cross entity conflict insights (either from the edge function or computed deterministically)

Three capabilities, one rendering path, zero new components.

**Connection 2: Computed conflicts are more demo reliable than LLM conflicts.**

The ai-conflict-detection edge function calls Claude Sonnet. This means it needs API keys configured, takes 5 to 10 seconds, and can fail. For a demo in 3 days, deterministic conflict detection is more reliable:
- If an RFI due date falls within 48 hours of a schedule phase start date, flag it
- If weather_cache shows precipitation and an outdoor phase is scheduled that day, flag it
- If a submittal lead time exceeds the gap between now and the phase it feeds, flag it

These are SQL queries against existing tables. They produce the same "I have never seen that" reaction because they connect entities across domains. The LLM powered version can be the v2.

---

## The Position (Competitive Context)

### Where We Are Already Differentiated
- **Project aware conversational AI.** The ai-copilot with 11 tools and conversation history surpasses Procore Helix (reactive data queries only). Working today.
- **AI RFI drafting from field notes.** No competitor does this. 2 hour to 10 second Amazon Test win.
- **Entity specific computed insights.** The API generates insights naming "RFI 047" and "Electrical rough in division." Procore shows counts. We show names. But the Dashboard doesn't render them yet.

### Where We Are Behind on Table Stakes
- **Weather on Dashboard.** Every field app shows weather. Ours shows nothing. This is below table stakes.
- **PDF export for AIA G702/G703.** FEEDBACK.md Step 6 requires it. Status unclear. A GC who cannot export a pay app to PDF will not take the platform seriously.

### The One Capability for "I Have Never Seen That"
**Cross entity conflict detection surfaced proactively.** "The electrical rough in start date is 2 days after the RFI 047 response deadline. If RFI 047 response slips, Phase 3 is at risk. Weather forecast shows rain on the Phase 3 start date. Recommend: escalate RFI 047 and identify indoor backup scope."

This connects schedule, RFIs, weather, and submittals in a single proactive alert. No construction platform does this. Not Procore. Not ACC. Not Fieldwire. This is category creation.

---

## The Direction (Strategic Focus)

### PRIMARY: Connect Existing Intelligence to the Dashboard

The highest leverage work tonight is NOT building new capabilities. It is connecting capabilities that already exist but are disconnected:

1. **Wire the rich insights to the Dashboard.** The `getAiInsights` function already generates entity specific insights. The Dashboard already has an `AIInsightsBanner` component that renders them beautifully. They are disconnected because the Dashboard calls `useAiInsightsMeta` (metadata only) instead of a hook that calls `getAiInsights`. Connect them. The superintendent should see "RFI 047 is 3 days past due. Ball in court: Architect" — not "3 overdue RFIs need response."

2. **Add weather to the Dashboard.** Query `weather_cache` for the project's location. Show current conditions and a brief forecast. This can be a small card in the hero section or an additional insight in the AI banner ("Rain forecast for Thursday — review outdoor schedules").

3. **Add at least one cross entity conflict insight.** This can be computed deterministically: check if any RFI due date falls near a schedule phase start date, or if weather conditions conflict with scheduled outdoor work. Add it to the computed insights array in `getAiInsights`. It renders through the existing banner with zero new UI.

### SECONDARY (if primary is blocked): Wire the Edge Function Directly

If computed cross entity insights prove insufficient, wire `ai-conflict-detection` directly. Call the edge function from a new API endpoint, add a React Query hook, and merge results into the insights banner. The edge function is fully implemented and returns typed conflict objects.

### EXPLICITLY DO NOT

- **Do not add new pages.** 40 pages exist. The product is feature rich. More pages create more surface area for demo failures.
- **Do not refactor.** The architecture is working. Any structural change 3 days before demo risks regression.
- **Do not fix CI/CD scoring infrastructure.** The verification pipeline scoring 0/25 is infrastructure debt. It does not affect the demo. Fix it after April 15.
- **Do not add tests.** 576 test cases at 43.2% coverage. Sufficient for demo.
- **Do not touch Supabase migrations.** 48 migrations, database stable. Migration risk is unacceptable at T minus 3.

---

## Success Criteria

1. **The Dashboard AI Insights banner names specific entities.** At least one insight says something like "RFI 047 is 3 days past due" or "Electrical division is $12,000 over budget" — not just "3 overdue RFIs." Observable: load Dashboard, read the top insight, it must contain a specific entity name (RFI number, budget line description, phase name, or trade name).

2. **The Dashboard shows weather data.** Either a dedicated weather section or a weather based insight appears on the Dashboard, derived from the weather_cache table or weather edge function. Observable: load Dashboard, see weather information that is not hardcoded and not absent.

3. **At least one insight connects two different entity types.** Something like "RFI 047 response deadline coincides with Phase 3 electrical start" or "Rain forecast on Thursday conflicts with scheduled concrete pour." Observable: read the insights on Dashboard, at least one references entities from two different domains (schedule + RFI, weather + schedule, submittal + phase, etc.).

---

## Context for the Builder

### Build Status
- **Build: GREEN** — vite build compiles with 0 TypeScript errors
- **Dependencies:** `npm install` required before build (not installed in CI runner)
- **Bundle: ~1869KB** — large but code split behind routes
- **`as any` count: 23** (down from 27 on Night 8, 11 in test files, 1 in lib)

### The Critical Wiring Gap (Read This First)
The Dashboard at `src/pages/Dashboard.tsx` line 726 calls:
```typescript
const { data: insightsData } = useAiInsightsMeta(projectId);
```
This returns `{ live: boolean; lastUpdated: string }`. It does NOT return insights.

At line 1002, the check `insightsData?.insights` is always undefined, so it falls through to `DeterministicInsightsBanner` every time.

The function `getAiInsights` in `src/api/endpoints/ai.ts` already produces rich, entity specific insights. It queries RFIs by number, budget lines by description, phases by name. It has a 4 tier fallback chain (AI service → cached → computed with entities → onboarding). The computed tier (lines 75 to 238) is the workhorse — it runs entirely on Supabase queries, no LLM needed, and produces insights like:
- "RFI 047 is 3 days past due. Ball in court: Architect"
- "Electrical division is $12,000 over budget"
- "Phase 3 Electrical Rough In is at risk or delayed"

The fix: create or use a hook that calls `getAiInsights` and pass the results to `AIInsightsBanner`. The banner component already handles rendering, severity colors, clickable navigation, everything.

### Key Files
- `src/pages/Dashboard.tsx` — The page to modify. Lines 1001 to 1006 are the insights rendering logic.
- `src/api/endpoints/ai.ts` — Contains `getAiInsights` with full computed fallback. This is the intelligence source.
- `src/hooks/queries/index.ts` — Where `useAiInsightsMeta` is likely exported. Check if `useAiInsights` exists.
- `src/types/ai.ts` — The `AIInsight` type and `AiInsightsResponse` type.
- `supabase/functions/ai-conflict-detection/index.ts` — Full edge function for LLM powered conflicts. Use only if computed approach is insufficient.

### Weather Data
- `weather_cache` table exists in Supabase
- Check if it has data: query `weather_cache` filtered by project location
- A weather edge function exists in `supabase/functions/`
- The simplest path: query weather_cache directly from a Dashboard hook and render a small weather card or weather insight

### Quality Floor (do not regress)
- tsErrors: 0
- anyCount: ≤23 (11 in test files)
- a11yViolations: 0
- coveragePercent: 43.2%
- testCount: 576

### The Standard
VISION_CORE.md: "He calls his operations director from the parking lot and says 'you need to see this.'"

That phone call happens because the Dashboard showed him "RFI 047 is blocking the electrical rough in. The response deadline is tomorrow. Phase 3 starts in 3 days. Rain is forecast for the start date. Recommend: escalate RFI 047 today and identify indoor backup scope for the Phase 3 crew."

He has never seen that on Procore. He has never seen that anywhere. Build the wiring tonight.
