# TONIGHT.md — April 10, 2026
**5 days until April 15 demo. Urgency: FEATURE-SPRINT. No infrastructure. No refactoring.**

## Strategic Reasoning

After 3 nights, the organism has made 16 code quality improvements and 0 features. 30 of 44 pages render without database queries. The AI Copilot — the single biggest differentiator from Procore — is UI only with no backend wiring. A GC seeing this product today would see an empty shell.

The database has no seed data. Loading seed data requires the DB password, which isn't available. This means we cannot rely on pre-loaded data for the demo. Instead, we must make the CREATE flow work beautifully:

**The demo is not "look at this data." The demo is "watch me create a project and see the platform come alive."**

This is actually BETTER than pre-loaded data because:
1. It proves the app actually works (not just displaying static data)
2. It shows the GC the exact workflow they'd use on day one
3. It makes the AI Copilot more impressive (it responds to data the GC just created)

## Tonight's Direction

**Wire the 5 demo-critical pages to Supabase with full CRUD flows — create, read, update. Every page must handle empty state beautifully ("Create your first project"), loading state (skeleton), and error state (graceful message). The create flow IS the demo.**

## Success Criteria

Tonight is a success if a person can:
1. Open /dashboard and see a meaningful empty state with "Create Project" CTA
2. Click "Create Project" → fill a form → submit → project appears on dashboard
3. Navigate to /rfis → see empty state → click "Create RFI" → fill form → RFI appears in list
4. Navigate to /submittals → see empty state → create a submittal → it appears
5. Navigate to /daily-log → create a daily log entry → it appears with today's date
6. Navigate to /copilot → type a question → get a response (even if it's "No project data yet, create a project first")

If 4 of these 6 work by end of tonight, the demo is on track.

## Boundaries — Do NOT Spend Time On

- Type safety fixes (as any removal) — DONE ENOUGH
- ESLint cleanup — NOT DEMO VISIBLE
- Test writing — SWARM HANDLES THIS
- Touch target fixes — ALREADY DONE
- Hardcoded color removal — NOT DEMO VISIBLE
- Any page not in the demo flow (Marketplace, Integrations, Sustainability, etc.)
- Infrastructure, refactoring, or architecture changes

## Fallback

If wiring Dashboard + create flow is blocked after 30 turns (e.g., the Supabase schema doesn't match what the page expects), switch to: wire the 3 pages that ALREADY have some DB queries (RFIs, DailyLog, Schedule) to handle empty state + create flow properly. These pages have partial wiring — completing them is faster than starting from scratch.

## Research Insights (from real competitor analysis)

### How Procore Does It (and how to beat them)
Procore's project dashboard shows: project address, weather, open items count, recently changed items, today's tasks, and milestones. It requires 6+ clicks to get to the first actionable insight. Their RFI workflow is functional but feels like filling out a government form.

**Beat them by**: Making the dashboard show the ONE thing that matters today (not a wall of widgets). Make RFI creation feel like sending a text message, not filing paperwork. Make the AI Copilot the central nervous system — "What should I focus on today?" with a real answer.

### How to Wire Pages to Supabase (specific patterns)

**For pages that already import hooks (RFIs, DailyLog, Schedule, Budget):**
```typescript
// These pages have useQuery or fromTable somewhere but may not handle states.
// Pattern: find the existing query, add Suspense + ErrorBoundary + empty state.
import { useQuery } from '@tanstack/react-query'
import { fromTable } from '@/lib/supabase'

// The query (may already exist — check before creating):
const { data, isLoading, error } = useQuery({
  queryKey: ['rfis', projectId],
  queryFn: () => fromTable('rfis').select('*').order('created_at', { ascending: false })
})

// Add these three states:
if (isLoading) return <SkeletonLoader />
if (error) return <ErrorState message="Couldn't load RFIs" onRetry={refetch} />
if (!data?.length) return <EmptyState icon="📋" title="No RFIs yet" action="Create RFI" />
```

**For pages with 0 DB queries (Dashboard, PunchList, Tasks, AICopilot):**
```typescript
// Start by adding the query hook. Check which Supabase table it should query.
// Database tables (from migrations): projects, rfis, submittals, daily_logs,
// change_orders, punch_list_items, schedule_activities, budget_line_items,
// safety_incidents, directory_contacts, files, meetings

// For Dashboard specifically:
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: () => fromTable('projects').select('*')
})
const { data: rfis } = useQuery({
  queryKey: ['rfis'],
  queryFn: () => fromTable('rfis').select('id, status').eq('project_id', projectId)
})
// Then display: project name, open RFI count, open submittal count, etc.
```

**For AI Copilot (the wow moment):**
```typescript
// Call the edge function. The Supabase client handles auth:
const { data: { session } } = await supabase.auth.getSession()
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ question: userInput })
  }
)
// NOTE: This requires ANTHROPIC_API_KEY set in Supabase Edge Function secrets.
// If the edge function returns a 500, display a graceful message:
// "AI Copilot needs to be configured. Set ANTHROPIC_API_KEY in Supabase."
// This is fine for the demo — we'll configure it before April 15.
```

### Create Flow Pattern (use for every page)
```typescript
// useMutation for creating records:
const createRfi = useMutation({
  mutationFn: async (newRfi) => {
    const { data, error } = await fromTable('rfis').insert(newRfi).select().single()
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['rfis'] })
    toast.success('RFI created')
  },
  onError: (err) => {
    toast.error(`Failed to create RFI: ${err.message}`)
  }
})
```

## The GC's 10-Minute Demo Experience (what we're building toward)

1. **0:00** — GC opens app. Clean, modern dashboard. "Welcome to SiteSync PM. Create your first project." Big CTA.
2. **0:30** — GC clicks Create. Simple form: project name, address, contract value. Submits.
3. **1:00** — Dashboard populates: "Riverside Tower — $52M" with status cards (all at zero — that's fine, it's new).
4. **1:30** — GC navigates to RFIs. Empty state. Clicks "New RFI." Types a question. Submits. RFI appears in list.
5. **3:00** — GC navigates to Daily Log. Empty state. Clicks "Log Today." Fills in weather, crew count, notes. Saves.
6. **4:00** — GC navigates to AI Copilot. Types "What should I focus on today?" AI responds with context from the project they just created.
7. **5:00** — GC navigates to Schedule. Sees a timeline (even empty, a Gantt view looks professional).
8. **6:00** — GC navigates to Budget. Sees budget tracking layout.
9. **8:00** — GC goes back to Dashboard. Now it shows: 1 RFI open, 1 daily log, schedule on track.
10. **10:00** — GC thinks: "This is clean, fast, and the AI actually understands my project. This is not Procore."

That's the demo. Tonight's organism builds toward this.
