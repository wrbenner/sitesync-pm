# FEEDBACK.md — Founder Priorities

**Owner:** Walker Benner, Founder/CEO  
**Injected into:** Every autonomous agent session as P0 priority  
**Instructions:** Update this before running the organism. Clear it after each run. Be specific.

---

## Tonight's P0 Priorities

*Replace this section before each run. These override all other priorities.*

1. MOCK DATA ELIMINATION (P0-1). This is the single biggest blocker.
   Six pages still use hardcoded/random data: RFIs, Submittals, PunchList, DailyLog, FieldCapture, AICopilot.
   For each page: replace mock arrays with real Supabase queries using the existing React Query hooks.
   Every page must show a proper empty state ("No RFIs yet" + Create button) when the table is empty.
   Every page must show a loading skeleton during fetch.
   Run `grep -r "Math.random\|faker\|mockData\|MOCK\|hardcoded" src/` after and confirm zero results.
   This is what kills us in demos. Fix it first.

2. PERMISSIONGATE ON EVERY ACTION BUTTON (P0-3). The component exists but wraps zero pages.
   Start with the five highest traffic pages: RFIs.tsx, Submittals.tsx, Tasks.tsx, PunchList.tsx, ChangeOrders.tsx.
   Every "Create", "Edit", "Approve", "Reject", and "Delete" button must be inside a PermissionGate.
   Use these permission strings: rfi:create, rfi:edit, submittal:approve, task:assign, punchitem:close, co:approve, *:delete.
   Verify that a user with role=viewer sees NO mutation buttons. This is table stakes for enterprise sales.

3. STATE MACHINE HANDLER COMPLETION (P0-6). The nine state machines have incomplete handlers.
   Focus on the three most visible: RFI (draft, submitted, under_review, responded, closed, void),
   Submittal (draft, submitted, in_review, approved, rejected, revise_and_resubmit),
   and Change Order (draft, submitted, owner_review, approved, rejected).
   Every transition must: validate with Zod, check permissions, update the DB, write to activity_log, show a toast.
   Invalid transitions must return a typed error, not crash.
   These three workflows are what GCs evaluate in their first 10 minutes with the product.

---

## Ongoing Priorities (injected every run)

These never clear. They represent your permanent product north star.

1. **Zero mock data** — The app must work with real Supabase data. If a feature requires data that doesn't exist, create the migration and seed it. Never show hardcoded names, numbers, or arrays.

2. **Field-first UX** — Every interaction must work for a superintendent with dirty gloves on an iPad at a jobsite with slow internet. 44px touch targets. Offline-first. Fast.

3. **Better than Procore on every page** — Before finishing any page, ask: "What does Procore do here? What don't they do? What should we do that they can't?" The answer goes in the implementation.

4. **AI woven in, not bolted on** — Every page should have an AI insight, suggestion, or prediction that a superintendent couldn't get from Procore. Not a chat widget — contextual intelligence.

5. **Never regress quality** — If you improve a metric (coverage, bundle size, error count), update .quality-floor.json. These floors never go down.

---

## Completed (archive)

*Move items here after they're verified complete by the verifier agent.*

- [x] 2026-04-05: Initial organism infrastructure created (SPEC.md, AGENTS.md, homeostasis.yml, etc.)
