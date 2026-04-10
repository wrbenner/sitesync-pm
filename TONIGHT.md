# TONIGHT.md — April 10, 2026 (Night 5)
**5 days until April 15 demo. Phase: FEATURE-SPRINT. The intelligence layer begins.**

---

## What Was Accomplished (Night 4)
Five features shipped: project creation flow, Dashboard onboarding, RFI create modal fix, AI Copilot graceful fallback, DailyLog permission fix. 8 of 9 demo-critical pages now have real database queries. The plumbing works.

## The Gap That Remains
The Strategic Intelligence identified it clearly: **The AI Copilot does not think about the project.** It has a chat UI that calls an edge function, but it doesn't gather project context before asking the LLM. When a GC types "What should I focus on today?" the system can't answer because it doesn't know what RFIs are overdue, what the budget variance is, or what's on the schedule.

This is the difference between SiteSync and Procore. Procore's Helix AI can query your data. SiteSync's copilot should SYNTHESIZE across RFIs, budget, schedule, and punch list in one breath and tell you what to DO about it.

## Tonight's Direction

### Primary: Wire the AI Copilot to project-aware intelligence

The hooks already exist. The data layer is rich. The copilot just needs to gather context before sending the user's question to the LLM.

**Specific implementation:**

1. **In AICopilot.tsx (or the useMultiAgentChat hook):**
   Before sending the user's message to the edge function, gather project context:

```typescript
// Gather project context from existing hooks
const { data: openRfis } = useQuery({
  queryKey: ['rfis-summary'],
  queryFn: () => fromTable('rfis')
    .select('id, subject, status, due_date, priority')
    .in('status', ['open', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(10)
})

const { data: budgetSummary } = useQuery({
  queryKey: ['budget-summary'],
  queryFn: () => fromTable('budget_line_items')
    .select('description, original_amount, committed_amount, projected_amount')
    .limit(20)
})

const { data: recentLogs } = useQuery({
  queryKey: ['recent-daily-logs'],
  queryFn: () => fromTable('daily_logs')
    .select('id, date, weather, crew_count, notes')
    .order('date', { ascending: false })
    .limit(5)
})

const { data: openPunchItems } = useQuery({
  queryKey: ['punch-items-summary'],
  queryFn: () => fromTable('punch_list_items')
    .select('id, description, status, assigned_to, location')
    .eq('status', 'open')
    .limit(15)
})
```

2. **Build the context string and send it WITH the user's question:**

```typescript
const projectContext = {
  openRfis: openRfis || [],
  budgetItems: budgetSummary || [],
  recentDailyLogs: recentLogs || [],
  openPunchItems: openPunchItems || [],
  projectName: currentProject?.name || 'Unknown Project',
  contractValue: currentProject?.contract_value || 0,
}

// When user sends a message:
const enrichedMessage = {
  question: userMessage,
  projectContext: JSON.stringify(projectContext),
  systemPrompt: `You are an AI assistant for ${projectContext.projectName}, a construction project managed in SiteSync PM. You have access to real-time project data. Answer the user's question using the project context provided. Be specific — reference actual RFI numbers, budget line items, and dates. If you identify risks or items needing attention, prioritize them.`
}
```

3. **Call the edge function with the enriched context:**

```typescript
const { data, error } = await supabase.functions.invoke('ai-copilot', {
  body: enrichedMessage
})

// If the edge function fails (ANTHROPIC_API_KEY not set), show graceful fallback:
if (error || !data) {
  return {
    response: `Based on your project data, here's what I can see:\n\n` +
      `**Open RFIs:** ${openRfis?.length || 0} (${openRfis?.filter(r => r.status === 'overdue').length || 0} overdue)\n` +
      `**Open Punch Items:** ${openPunchItems?.length || 0}\n` +
      `**Recent Daily Logs:** ${recentLogs?.length || 0} entries\n\n` +
      `_Full AI analysis requires the AI service to be configured. The data above is live from your project._`
  }
}
```

**This is critical:** Even if the ANTHROPIC_API_KEY isn't set in Supabase, the copilot should STILL show useful information by reading the project data directly. The fallback should feel intelligent, not broken.

4. **Check the edge function (supabase/functions/ai-copilot/index.ts):**
   - Make sure it reads the `projectContext` from the request body
   - Make sure it includes the project context in the prompt to Claude
   - If ANTHROPIC_API_KEY isn't set, return a structured error (not a 500)

### Secondary: Fix Payment Applications stubs

The Strategic Intelligence noted that some mutation handlers show "Feature pending configuration" instead of calling the actual mutation. The mutation hooks exist (upsertPayApplication, approvePayApplication). The fix is to replace the toast placeholders with actual mutation calls.

```typescript
// BEFORE (stub):
onClick={() => toast.info('Feature pending configuration')}

// AFTER (real):
onClick={() => upsertPayApplication.mutate(payAppData)}
```

Find all instances of "Feature pending configuration" or "pending" toasts and wire them to the actual mutations.

### Tertiary: Budget error boundary

The Budget page has real queries but no error boundary. If any query fails, the page white-screens. Add error boundary + retry button.

## Success Criteria

Tonight is a success if:
1. The AI Copilot shows project-aware context (even without the edge function working)
2. The "Feature pending configuration" stubs in Payment Applications are replaced with real mutations
3. Budget page has an error boundary

## Boundaries — Do NOT

- Touch type safety, eslint, or code quality
- Work on non-demo pages (Marketplace, Integrations, Sustainability, etc.)
- Refactor or restructure existing working code
- Create new pages or routes

## Fallback

If the AI Copilot wiring is blocked after 30 turns (e.g., the hook infrastructure doesn't support the pattern above), switch to: make the copilot show a rich project summary dashboard instead of a chat interface — display the key metrics (open RFIs, budget status, schedule status, punch items) in a clean layout. This is less impressive than a chat but still shows intelligence.

## Research Insights

**Context-Augmented Generation (CAG) pattern** — The latest approach (InfoQ, April 2026) says don't just do RAG (retrieve documents). Instead, assemble user, session, and project context at the application layer BEFORE invoking the LLM. This is exactly what we're doing: gather RFIs, budget, schedule, punch items client-side, then send with the question. The LLM gets pre-assembled context, not raw document retrieval.

**Supabase edge function invocation pattern:**
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { question, projectContext }
})
```
The Supabase client automatically forwards the user's auth token. The edge function receives it in `req.headers.get('Authorization')`.
