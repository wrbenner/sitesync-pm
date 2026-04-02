# SiteSync AI — Product Vision

## The North Star
Build the construction operating system that makes Procore look like legacy software.
AI native. Field first. Beautiful. The platform a $50M funded startup would ship if they
had the best team in the world and zero technical debt.

## What We Are Building
A unified construction project management platform that replaces Procore, PlanGrid,
Buildertrend, and 15 other tools with one system. Every GC, superintendent, PM, and
CFO in construction should open SiteSync first thing in the morning and never need
to leave.

## Core Beliefs

1. **AI is not a feature, it is the foundation.** Every page, every workflow, every
   decision should have AI woven into it. Not a chatbot in the corner. AI that
   predicts delays before they happen, drafts RFIs from photos, flags coordination
   conflicts between trades, and writes daily reports automatically.

2. **Field first.** A superintendent standing in the rain with muddy hands should be
   able to log a safety incident, photograph a defect, and create a punch list item
   in under 30 seconds. If it doesn't work in the field, it doesn't work.

3. **Financial depth that earns CFO trust.** Real job costing by CSI division. AIA G702/G703
   billing. 13 week cash flow projections. Lien waiver tracking. Change order pipelines
   with markup and margin analysis. This is where Procore is weakest and where we win.

4. **Google level polish.** Every pixel matters. Clean, light, spacious UI. Subtle
   animations. Consistent color system. The app should feel like Linear or Stripe,
   not like enterprise software from 2015.

5. **Real time everything.** When a super approves a punch list item in the field, the
   PM sees it update instantly on their dashboard. Presence indicators, live notifications,
   zero stale data.

## Platform Capabilities (What "Done" Looks Like)

### Tier 1: Daily Workhorses (Must Be Perfect)
- **Dashboard**: Command center with live project health, weather, schedule risk, and AI insights
- **RFIs**: Create, route, respond, close. Drag and drop attachments. AI auto-draft from context.
  Ball in court tracking. Response time analytics.
- **Submittals**: Multi-party review chains. Re-submission tracking. Spec section linking.
  Automated reminders. Status matrix.
- **Daily Log**: Weather, crew hours, equipment, materials, visitors, incidents, notes.
  All legally defensible. AI auto-summary. Photo integration.
- **Schedule**: Gantt with baseline vs actual. Critical path highlighting. Lookahead views.
  AI delay prediction. Drag to reschedule.
- **Budget**: Job cost tracking by CSI division. Committed vs actual vs forecast. Change order
  impact. Burn rate. S-curve visualization.
- **Punch List**: Photo based. Location tagging. Assignee routing. Bulk close. Completion
  percentage by trade.

### Tier 2: Differentiators (What Makes Us Win)
- **AI Copilot**: Conversational project intelligence. Ask anything about the project and get
  accurate answers sourced from actual project data. Proactive risk alerts.
- **Financial Engine**: Pay applications (AIA G702/G703). Lien waiver tracking. Cash flow
  projections. Retainage management. SOV management.
- **Change Orders**: Full pipeline from PCO to CO. Markup calculation. Approval chains.
  Budget impact analysis. Margin tracking.
- **Field Capture**: One tap photo with AI annotation. Voice to text notes. GPS tagging.
  Offline capable. Instant sync when back online.
- **Safety**: Toolbox talks. Incident tracking. Safety scorecards. AI photo analysis for
  PPE compliance. OSHA 300 log generation.

### Tier 3: Vision Features (What Makes Procore Obsolete)
- **Predictive Delay Engine**: Tells the PM on Monday what will go wrong by Friday using
  schedule data, weather forecasts, crew availability, and historical patterns.
- **Subcontractor Scorecards**: Portfolio wide performance metrics. Quality, timeliness,
  safety, responsiveness. Inform future bidding decisions.
- **AI Conflict Detection**: Cross reference drawings, specs, and submittals to flag
  coordination conflicts before they become RFIs.
- **Digital Twin Integration**: BIM model viewer with real time project data overlay.
  Progress tracking by 3D element. Clash detection.
- **Portfolio Dashboard**: Multi-project overview for executives. Aggregate health scores,
  financial rollup, resource allocation across all active projects.
- **Owner Portal**: External facing view for project owners. Progress photos, schedule
  status, financial summary. No login required, token based access.

## What the Engine Should Prioritize

### Always (Every Cycle)
- Build must pass. Zero TypeScript errors.
- Every page must have metric cards, hoverable table rows, and meaningful empty states.
- No hardcoded colors or spacing. Use theme tokens.
- No hyphens in UI text. No placeholder copy.
- All data should feel real and construction specific.

### When Scores Are Low (< 70)
- Focus on making existing features work correctly.
- Fix broken interactions, missing states, and TypeScript errors.
- Make sure navigation works and pages load without errors.

### When Scores Are Medium (70-85)
- Improve data richness. More realistic mock data.
- Add transitions, loading states, error states.
- Wire up Supabase hooks to real data queries.
- Add real time subscriptions where they make sense.

### When Scores Are High (85+)
- Invent new features from the Tier 3 list.
- Add AI powered workflows.
- Build financial depth (pay apps, lien waivers, cash flow).
- Push for world class design polish.

## Competitive Positioning

| Capability | Procore | SiteSync AI |
|-----------|---------|-------------|
| AI Native | Bolt on chatbot | Built into every workflow |
| Financial Depth | Basic budget | Full job cost, pay apps, cash flow |
| Field UX | Desktop adapted | Field first, works offline |
| Speed | Enterprise slow | Startup fast |
| Price | $30K+ per year | Accessible to any GC |
| Modern Stack | Legacy React | React 19, Supabase, Edge Functions |

## Success Metrics
- A superintendent can complete their daily log in under 3 minutes
- A PM can create and route an RFI in under 60 seconds
- A CFO can see the 13 week cash flow projection for any project in 2 clicks
- Every page loads in under 1 second
- Zero critical bugs across all workflows
- AI copilot answers project questions with 90%+ accuracy
