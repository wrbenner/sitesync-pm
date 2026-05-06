# ROADMAP.md — SiteSync PM, 18-month sequence

> Operational roadmap. Each quarter has a primary deliverable, supporting work,
> and an exit criterion that must be met before the next quarter starts.
>
> See `VISION.md` for the strategic frame. This document is execution.
>
> **Last updated:** 2026-04-27

---

## Q2 2026 — Demo to ship

**Primary:** The April 15 demo lands. Every step under its latency budget.

**Engineering:**
- Lock the 6-step demo flow (Dashboard → Iris → RFI → Daily Log → Budget → Pay App)
- Latency budget per step (data-demo-step attributes; CI fails if any step exceeds budget):
  - Dashboard cold load: ≤3.0 s
  - Iris first token: ≤800 ms
  - RFI submit + machine + audit + toast: ≤500 ms
  - Daily Log mic-tap → first transcribed word: ≤1.0 s
  - Pay App G702/G703 render: ≤2.0 s
- `npm run seed:demo` regenerates "Riverside Tower" with a real story arc:
  - Slight budget burn over plan
  - One overdue RFI on electrical
  - Daily log mentioning a sub no-show
  - Pending pay app
- Network-throttled rehearsal on a 3G profile

**Exit criterion:** Demo runs end-to-end on a 3G profile with zero console errors. Two GCs sign LOIs after seeing it.

---

## Q3 2026 — Iris that ACTS (v1)

**Primary:** Iris drafts actions, not just answers. Approval-gated. Audit-logged.

**Engineering:**
- `drafted_actions` table (already scaffolded — see migration `20260427000010_drafted_actions.sql`)
- Drafted-action handlers, in priority order:
  1. **RFI from clash** — manual flag → AI drafts → user approves → auto-routes
  2. **Daily log narration** — photos + crew + weather → drafted log → super edits
  3. **Pay app draft** — schedule of values + change orders + completion % → G702/G703
  4. **Schedule conflict alert** — CPM run → drafted resequence
  5. **Punch item from photo** — vision model → drafted defect entry
- Iris Inbox at `/iris/inbox` (already scaffolded — see `IrisInboxPage.tsx`)
- `<IrisApprovalGate>` UI primitive for one-click approve/reject
- DurableAgent or equivalent for long-running drafts (clash detection across 200+ drawings)

**Exit criterion:** First pilot GC has Iris drafting 50+ actions/week with ≥80% approve-rate. Drift telemetry instrumented.

---

## Q4 2026 — Field super app

**Primary:** The 5-tab gloved-thumbs experience. Free for the field.

**Tabs (already shipped pattern in `MobileLayout.tsx`):**
1. Home — today's actions
2. Tasks — assigned + watched
3. Check In — QR scan to start shift, logs to time tracking
4. Capture — photo / voice / quick note → routed to RFI / daily log / punch
5. Logs — recent activity feed

**Engineering:**
- Voice-first daily log: tap mic → narrate → AI structures into the log
- Photo-driven RFI: tap photo → annotate location → AI drafts the RFI text
- Offline-first: every mutation queued, synced on reconnect (already shipped)
- 56px touch targets enforced via lint rule (already shipped)
- One-tap-to-call superintendent
- Free tier: 1 active project, unlimited captures

**Exit criterion:** 60%+ DAU/WAU among onboarded supers. 8+ sessions per super per day median.

---

## Q1 2027 — Open API + audit log as product

**Primary:** Make integrations + compliance the moat.

**Engineering:**
- Public REST + GraphQL API at `api.sitesync.app`. OpenAPI spec auto-generated.
- TypeScript and Python SDK (`@sitesync/sdk`)
- Webhooks: every mutation fires an event; user-configurable endpoints
- Audit log query language: `WHERE resource_type='rfi' AND action='close' AND actor=? AND date > ?`
- Audit log PDF export — court-ready format with hash-chain attestation
- First marquee integrations:
  - Sage 100/300 contractor: bidirectional CO + pay-app sync
  - QuickBooks Online: vendor + invoice export
  - P6 / Microsoft Project: schedule import (one-shot, then ongoing)
  - BIM360 / ACC: drawing sync

**Exit criterion:** First $150K+ ACV signed. Two third-party developers shipping integrations against our API.

---

## Q2 2027 — Data compound

**Primary:** Make every project make every other project smarter.

**Engineering:**
- Drawing-to-RFI graph queries: surface clash hot-spots at column-line crossings
- Change-order causal taxonomy: enrich every CO with `cause`, `originator_role`, `stage`
- Schedule-recovery event capture: when a project recovers from a slip, capture `recovery_type` + `actions_taken`
- "Project Comparables" page: input project type/size/region, output budget + schedule comparables with confidence intervals
- AI estimating add-on: `$2,000/project` estimate generation from project history

**Exit criterion:** AI estimating module sells to 5 paying customers. Project Comparables surfaces non-obvious patterns in user testing ("I didn't know that").

---

## Q3 2027 — The Procore migration moment

**Primary:** Automated import + 30-day bake-off. The "switch in 30 seconds" moment.

**Engineering:**
- One-shot Procore import (already shipped, harden it):
  - All RFIs, submittals, drawings, change orders, pay apps
  - All users + roles
  - All audit history (preserved)
- 30-day side-by-side bake-off mode:
  - Read from Procore + write to both
  - Daily reconciliation report
  - One-click cutover when ready
- Migration playbook (Mintlify docs)
- "Switching cost calculator" landing page

**Exit criterion:** 50 GCs migrated. 5 marquee logos. $5M ARR run-rate.

---

## Cross-quarter discipline

These run in parallel with the quarterly themes:

- **Quality floor ratchet** (`.quality-floor.json`) blocks regressions. Math.random count must remain 0. `as any` count drops 1/quarter.
- **Latency budget** (`data-demo-step` attributes) enforced in CI. Any step exceeding its budget fails the build.
- **3-viewport polish audit** (`e2e/page-*.spec.ts`) runs on every PR. Visual diffs posted in PR comments.
- **Audit log integrity** — every mutation goes through `useAuditedMutation`. Lint rule blocks raw `supabase.from(...).update()` in production code.
- **Quarterly kill-criteria check** (see `VISION.md` § "Kill criteria"). Honor them.

---

## What we are NOT building (for now)

Pruning is half the strategy. We are not building:

- **Generic CRM features.** That's not what GCs hire us for.
- **Owner-portal as a hero feature.** Owners are downstream; GCs are the buyer. Owner-facing UI is a low-priority bonus.
- **Multi-language UI.** Latin-American GC market is real, but English-first wins year 1. The `t()` scaffolding stays in place; we don't translate yet.
- **Native mobile (Swift/Kotlin) apps.** PWA + Capacitor is faster to ship and gives us 80% of the perceived experience. Revisit in 2028.
- **A "marketplace" of third-party plugins.** This is a year-3 distraction. The API is the platform; user-built integrations are the bonus.

---

## Reading list (for the team)

- *Crossing the Chasm* — Geoffrey Moore. We are pre-chasm. Pick one bowling pin.
- *Working Backwards* — Bryar & Carr. PR/FAQ for every major launch.
- *The Hard Thing About Hard Things* — Ben Horowitz. Read chapter 9 quarterly.
- *Demystifying Procore* — internal teardown deck (`docs/competitive/`).
