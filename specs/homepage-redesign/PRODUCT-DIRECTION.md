# SiteSync AI — Product Direction (Final)

## What This Is
The definitive product direction for SiteSync AI's homepage redesign and role-based command architecture. Every spec in this folder derives from this document. Read this first, then `CONTRACT.md`, then your assigned `SESSION-N-*.md`.

## Initiative Status
**Active as of 2026-04-30.** This homepage redesign is the agreed re-architecture. The standing polish-only mandate is **explicitly paused** for the duration of the initiative; it resumes once Wave 2 merges to main. Polish discipline still applies to all *other* pages during the initiative — no new decorative features on RFIs, Budget, Schedule, etc.

## Locked Vision Clause (do not violate)
**Only the dashboard (Command stream at `/day`) is role-dynamic.** The dashboard's content, sort order, and visual emphasis change based on the user's role; that's where role-tailoring lives.

**Every other page is reachable by every authenticated user.** No role hides RFIs, Drawings, Budget, Schedule, or any other Record-layer page from anyone. Permissions (admin-managed via `Permission` keys + `PermissionGate`) gate per-action behavior **inside** pages — they do not gate page visibility.

**AI is geared to your occupation.** Iris drafts, suggestions, and emphasis adapt to the user's role. The platform itself does not.

This was clarified after Wave 1 over-applied role filtering to the navigation. Wave 1 nav has been corrected: `getNavForRole(_role)` returns the full `NAV_ITEMS` list for every role. Mobile bottom-tab primary set still varies by role for a tailored first-screen UX, but every page is one tap away in the More sheet.

## Core Mission
SiteSync is the place where every construction stakeholder goes to answer:
**What matters, what do I owe, who owes me, what changed, what is blocked, and what should happen next?**

Everything else supports that.

---

## The Architecture (Three Layers)

### Layer 1: Command Layer (where users live)
The homepage. A single prioritized stream that answers the six questions above. Role-filtered — same data, different lens. This is where 80% of daily app time is spent.

### Layer 2: Work Layer (where users execute)
Inline actions on stream items: respond to RFIs, approve submittals, review drafts, assign tasks, send follow-ups. Users act without leaving the stream when possible. For deep work, they navigate to source pages.

### Layer 3: Record Layer (where data lives)
Dedicated pages for RFIs, Submittals, Schedule, Budget, Drawings, Daily Log, Documents, Reports. Full audit trail. Traditional table/log views with AI insights woven in (not as a separate mode — as inline enhancements on the same view). These pages exist for deep work, recordkeeping, and compliance.

---

## The Non-Negotiable Principles

### 1. No user should ever have to hunt.
The system brings the right information to the right person at the right time. If a user is searching for something that should have been surfaced, the product failed.

### 2. Every card has a next action.
No dead information. A risk card offers: Assign, Draft Follow-up, Escalate, Add to Report, Open Source, Snooze, Mark Resolved. An RFI card offers: Respond, Reassign, View Drawing, View Source.

### 3. Every AI claim has a source trail.
Drawing, spec, RFI, submittal, schedule activity, budget line, photo, meeting note. No source = no claim. Users must trust the system.

### 4. AI prepares, humans approve.
AI can: draft, summarize, rank, compare, detect, route, suggest, explain, package.
Humans must: approve, send, certify, sign, decide, override.

### 5. Reduce clicks aggressively.
- 1 tap to see why something matters (expand)
- 1 tap to open source
- 1 tap to review AI draft
- 2 taps maximum to complete the most common workflows (respond, approve, send draft, mark complete)
- Assign is sometimes 2 taps (More → Assign) when it's not the primary action; that's accepted

### 6. Every action is permission-gated.
Visible ≠ allowed. Each `StreamAction` carries a `permissionKey` (existing `Permission` type). The UI wraps action buttons with `PermissionGate`. Users without permission don't see the button.

---

## The Command Stream (Homepage)

### What It Is
A single vertical stream of everything that needs the user's attention, sorted by urgency and filtered by their role. Not a dashboard. Not a grid of widgets. A prioritized list with inline actions.

### What It Contains (in scroll order)

**1. Morning Brief** *(post-Wave-1)*
A short, role-specific paragraph. 2–4 sentences. Generated from project data.
- **Wave 1: skip this section entirely.** The stream itself IS the brief.
- Later: Iris generates a natural-language summary personalized to the user's role.

**2. Action Stream**
Every actionable item across the project, unified and sorted:
- Overdue RFIs
- Pending submittals
- Open punch items
- Missing daily logs
- Schedule conflicts
- Budget changes
- Safety incidents
- Commitment deadlines
- Decision requests

Each item is a card (see Card System below). Cards expand inline for details and actions. For deep work, one tap navigates to the source page.

**3. Project Pulse**
A compact horizontal strip below the stream. Text only, no charts.

| Metric | Source | v1 display |
|--------|--------|------------|
| Schedule | `useScheduleActivities` — count of critical-path activities behind > 0 days | "On track" if 0; "N activities behind" otherwise |
| Budget | existing budget metrics — % committed of approved budget | "82% committed" with rust color if > 100% |
| Weather | existing weather hook | icon + temperature |
| Crew | `useWorkforceMembers` count for today | "47 on site" |

Each tappable to navigate deeper. No CPM math required for v1 — count of behind-activities is sufficient signal; full days-behind ranking is post-Wave-1.

**4. Stream Nav** *(formerly "The Nine")*
A horizontal row of role-filtered page icons (max 9 per role). Quick access to the Record Layer. The label "The Nine" is retired — it implied a fixed set, but the set varies by role.

### Empty State
When the stream is empty *for this user* — i.e., zero items remain after role filter, snooze, and dismiss are applied — the page shows the project name, today's date, and "Nothing waiting on you." in serif type. This is the reward.

Note: empty for this user does **not** mean the project is quiet. A PM with a clean inbox may still see a non-empty Pulse strip (schedule behind, budget at 82%). Empty refers to the action stream specifically.

---

## Persistence Model (locked)

| State | Storage | Lifetime | Owner |
|-------|---------|----------|-------|
| Snooze | `localStorage` `stream:snoozed:{userId}` → Map<id, ISO datetime> | until resurface time | Tab A `streamStore.ts` |
| Dismiss | Zustand in-memory | session | Tab A `streamStore.ts` |
| Mark Resolved / Mark Complete | mutates source record via existing mutation hooks | permanent | source page mutation |
| React Query invalidation | re-pulls source after mutation | per-query cache | existing infra |

Snooze options exposed to UI: **1 hour**, **tomorrow morning** (8 AM local), **next week** (next Monday 8 AM local).

---

## Role-Based Filtering

### Stream Personas (UI lens, not auth)
Six personas drive the homepage. They are **derived** from the canonical 15-value `ProjectRole` defined in `src/types/database.ts`. They are not a new auth role.

The mapping lives in `src/types/stream.ts → toStreamRole(ProjectRole)`:

| ProjectRole | StreamRole |
|-------------|------------|
| `project_manager`, `admin` | `pm` |
| `superintendent`, `foreman`, `field_engineer`, `field_user` | `superintendent` |
| `owner`, `owner_rep` | `owner` |
| `subcontractor` | `subcontractor` |
| `architect`, `project_engineer`, `safety_manager` | `architect` |
| `project_executive` | `executive` |
| `viewer`, `member`, anything else | `pm` (default, restricted by permissions) |

### How Filtering Works
One data layer. One stream component. One card system. The StreamRole determines:
1. **Which items appear** (filter)
2. **How items are sorted** (priority logic)
3. **Which nav items are visible** (nav mask)
4. **What the morning brief says** (Iris prompt template — post-Wave-1)

Permissions still gate individual actions on visible cards via `PermissionGate`.

### Role Definitions

**Project Manager** (`pm`)
- Sees: everything
- Sort priority: risk impact → overdue → commitments owed to PM → due date
- Stream emphasis: accountability, risk, documentation completeness

**Superintendent** (`superintendent`)
- Sees: field items (daily log, punch, inspections, safety, crew, photos), schedule (today + lookahead), drawings, blockers
- Filters OUT: budget details, submittal procurement chain, owner-level decisions
- Sort priority: time-of-day relevance → safety → overdue field items → inspections
- Stream emphasis: what's happening on site today, what needs documentation

**Owner / Developer** (`owner`)
- Sees: decisions needing owner input, budget status, schedule status, risk items, progress photos
- Filters OUT: operational items, trade-level coordination, individual RFIs (unless cost/schedule impact)
- Sort priority: decisions requiring owner action → budget exposure → schedule risk → milestone status
- Stream emphasis: "do I need to make a decision or spend money?"

**Subcontractor** (`subcontractor`)
- Sees: items assigned to their company ONLY — punch items, submittals, RFIs where they're ball-in-court, schedule activities for their trade, closeout docs, pay app requirements
- Filters OUT: everything not assigned to them
- Sort priority: items blocking payment → overdue items → upcoming due dates
- Stream emphasis: "what do I need to do to get paid?"

**Architect / Engineer** (`architect`) — *minimal v1*
- Sees: RFIs awaiting their response, submittals awaiting their review
- v1 nav: Command, RFIs, Submittals, Drawings only
- Sort priority: overdue RFIs → submittals at risk → schedule impact of their delays
- **Deferred to post-Wave-1:** Response Packet (AI-packaged RFI context bundle), drawing-conflict surfacing

**Executive** (`executive`) — *minimal v1*
- Sees: critical + risk items only (single-project view)
- v1 nav: Command, Reports
- **Deferred to post-Wave-1:** Portfolio view (multi-project), margin exposure, PM workload indicators — these wait until multiple projects exist on the platform

### Implementation
```typescript
// src/config/roleFilters.ts (Tab A creates)
const ROLE_FILTERS: Record<StreamRole, (item: StreamItem) => boolean> = {
  pm: () => true,
  superintendent: (item) =>
    ['daily_log', 'punch', 'incident', 'schedule', 'task'].includes(item.type),
  owner: (item) =>
    item.cardType === 'decision' || item.type === 'schedule' || item.costImpact != null,
  subcontractor: () => false, // Tab A: filter by assigned company id
  architect: (item) => ['rfi', 'submittal'].includes(item.type),
  executive: (item) => item.urgency === 'critical' || item.cardType === 'risk',
}
```

The `useActionStream(role?)` hook accepts a `StreamRole` and applies the corresponding filter and sort. The stream UI doesn't change — it renders whatever items the hook returns.

---

## Subcontractor Identity (auth + magic-link)

Subs reach the stream two ways. Both render the same UI; both pass through the same role filter; both are recorded in the audit hash-chain with distinct actor attribution.

| Path | Auth | Audit `actor_kind` | UI |
|------|------|-------------------|----|
| Authenticated sub user | full session, ProjectRole = `'subcontractor'` | `'user'` | `/day` (Command stream) |
| Magic-link recipient | token → `/sub/[token]` | `'magic_link'` (with `magic_link_token_id`) | same Command stream component, scoped to their company |

Magic-link route is implemented by Tab C as a thin wrapper that hydrates `ActorContext` and renders the same stream UI with `subcontractor` lens.

**"Items blocking payment" v1 scope:** open punch items in their pay zone. Post-Wave-1 expands to include missing closeout docs, missing lien waivers for prior pay app, and pay-apps rejected with comments.

---

## The Card System

Every item in the stream and on source pages uses a consistent card format. Six card types, one visual system.

### Card Anatomy
```
┌─ urgency bar (3px, left edge, color = urgency) ─────────────────┐
│ [type icon]  Title                              [status badge]   │
│              Reason · Source · Assignee                           │
│              ✦ Iris drafted this — review before sending          │
│                                                                   │
│  ── expanded content (on tap) ──                                  │
│  Description / details / draft preview                            │
│  Source trail: Drawing A3.2 → Spec 08 41 13 → RFI #247           │
│                                                                   │
│  [Primary Action]  [Secondary]  [Snooze]  [More ▾]               │
└───────────────────────────────────────────────────────────────────┘
```

Each action button is wrapped in `<PermissionGate permission={action.permissionKey}>` when set. Buttons the user can't use are hidden, not disabled.

### Card Types

**Action Card** — what the user should do next
- urgency bar: orange (critical), rust (high), none (medium/low)
- actions: context-specific (Respond, Approve, Review, Assign, Send)

**Risk Card** — something that could hurt cost, schedule, quality, safety, or closeout
- urgency bar: rust
- impact chain: optional. UI renders only when `item.impactChain` is populated. v1 risk cards usually ship without it (Iris Phase 4 fills it in).
- actions: Assign, Escalate, Draft Follow-up, Add to Report

**Decision Card** — an approval or choice needed
- urgency bar: none (decisions are presented neutrally)
- includes: options, AI recommendation (if available), cost/schedule impact per option
- actions: Approve, Reject, Request More Info, Defer

**Commitment Card** — who owes what by when
- includes: party, commitment, source (where it was committed — meeting, email, RFI)
- urgency bar: orange if past due
- actions: Send Reminder, Escalate, Mark Received

**Draft Card** — AI-prepared work ready for review
- accent: indigo left bar (AI color)
- always labeled: **"Iris drafted this — review before sending"** (never just "AI")
- includes: draft preview, sources used, confidence indicator
- actions: Send As-Is, Edit First, Dismiss Draft
- ✦ glyph identifies Iris in the card header

**Source Card** — reference to a drawing, spec, photo, document
- no urgency bar
- appears in expanded views and search results, not directly in the action stream
- includes: thumbnail if visual, metadata, related items
- actions: Open, Add to Report, Share

### Visual Rules
- Cards are separated by whitespace, not borders (except the left urgency bar)
- Backgrounds: surfacePage (parchment) default, surfaceInset for expanded draft previews
- No shadows on cards in the stream (they're not floating — they're list items)
- Hover: subtle background shift to surfaceHover
- One accent color at a time: orange for urgency, indigo for AI/Iris, moss for resolved

---

## The Commitment Tracker

### What It Is
A view that tracks accountability: who owes what, from what source, by when.

### Data Model
Defined in `src/types/stream.ts` (`Commitment`, `CommitmentSource`).

### Where It Lives
- **In the Command stream:** commitment cards appear alongside action cards, sorted by urgency
- **Dedicated view:** accessible from nav as "Commitments" — focused list of all open commitments grouped by party, filterable by status. Visible to **PM, Owner, Architect, Subcontractor** (everyone who needs accountability visibility). Hidden from Superintendent (field-focused) and Executive (single-project executives don't need this lens; portfolio executive view is post-Wave-1).
- **On source pages:** each RFI, submittal, etc. shows its associated commitments

### AI Enhancement (Phase 4)
Iris extracts commitments from meeting notes, emails, daily logs. Wave 1 ships the dedicated view with manually-entered or RFI-derived commitments.

---

## Source Trail System

### What It Is
Every AI insight, every risk card, every commitment links back to its source records. Non-negotiable for trust and legal defensibility.

### Implementation
`SourceReference` type defined in `src/types/stream.ts`. Tab B renders source trails as a horizontal scrollable row of pills inside expanded cards. Each pill is tappable and opens the source.

`Drawing A3.2 → Spec 08 41 13 → RFI #247 → Photo 2024-04-15`

---

## Navigation

### Structure (universal)
One nav, shared across all roles. **Every authenticated user sees every nav item.** Permissions handle what they can do once on the page.

| Nav Item | Icon | Route |
|----------|------|-------|
| Command | Zap | `/day` |
| RFIs | MessageCircle | `/rfis` |
| Submittals | FileCheck | `/submittals` |
| Schedule | Calendar | `/schedule` |
| Budget | DollarSign | `/budget` |
| Drawings | Layers | `/drawings` |
| Daily Log | BookOpen | `/daily-log` |
| Punch | CheckCircle | `/punch-list` |
| Photos | Camera | `/field-capture` |
| Inspections | ClipboardCheck | `/permits` |
| Reports | FileText | `/reports` |
| Documents | FolderOpen | `/files` |
| Commitments | Handshake | `/commitments` |

Subcontractors see all pages but, once on each page, RLS + permission gates restrict their view to items assigned to their company.

### Mobile primary tabs (role-tailored first-screen UX)

The bottom tab bar surfaces 4 primary tabs per role + a "More" sheet that exposes the rest of the nav. Nothing is hidden.

| Role | Primary tabs |
|------|--------------|
| PM | Command, RFIs, Schedule, Budget |
| Superintendent | Command, Daily Log, Punch, Photos |
| Owner | Command, Budget, Schedule, Reports |
| Subcontractor | Command, Punch, Photos, Documents |
| Architect | Command, RFIs, Submittals, Drawings |
| Executive | Command, Reports, Budget, Schedule |

### Command Palette (Cmd+K)

**Wave 1 scope:**
- Always accessible (Cmd+K / Ctrl+K)
- Empty state: shows role-filtered nav items as top results
- Search: fuzzy match across nav items + recent items (last 20 RFIs by number, submittals by spec, punch by title)
- Keyboard navigation within results, Enter to navigate, Escape to close

**Deferred (post-Wave-1):**
- "Ask this project anything..." natural-language query to Iris

### Mobile

**Wave 1 scope:**
- Bottom tab bar with 4–5 most-used items per role + "More" sheet
- Pull-to-refresh on Command stream
- Swipe right → mark done; swipe left → snooze (Tab B `SwipeActions`)
- Offline: render last-cached stream + a hairline banner ("Showing cached items — last sync N min ago"); use existing offline detection
- Magic-link sub route `/sub/[token]` renders the same Command stream component
- Bottom safe-area padding for iOS

---

## Iris Integration (progressive)

### Phase 1: No AI Required (Wave 1 — Tab A)
The Command stream works entirely on data logic. Overdue = overdue. Critical path = math. Due dates = calendar. No AI needed for the product to be useful.

### Phase 2: Smart Drafts (Wave 1 — Tab D)
Iris drafts follow-up emails for overdue items, generates daily logs from field entries, drafts owner updates from project data. Every draft requires human review. Drafts appear as Draft Cards in the stream, always labeled "Iris drafted this — review before sending."

### Phase 3: Intelligent Ranking *(post-Wave-1)*
Iris learns from user behavior — what gets acted on first, what gets snoozed, what gets escalated — and adjusts stream sorting. Still shows all items, just reorders.

### Phase 4: Proactive Detection *(post-Wave-1)*
Iris surfaces risks the user hasn't noticed: "Storefront submittal delay may cascade to dry-in date. Impact chain: late approval → delayed fabrication → install pushed 2 weeks." Always with source trail. Fills in the optional `impactChain` on Risk Cards.

### Phase 5: Institutional Memory *(post-Wave-1)*
Iris traces decision history: "Decided in OAC meeting March 3, confirmed by email March 5, reflected in ASI #7." Answers "why is it like this?" with a decision trail.

---

## Audit Attribution (magic-link safe)

Every action committed from the stream is recorded in the existing hash-chain audit (Enterprise Compliance Pack). Wave 1 adds explicit `actor_kind` capture so the deposition-grade audit pack distinguishes:

- `actor_kind: 'user'` — authenticated session, `actor_id = user.id`
- `actor_kind: 'magic_link'` — `actor_id = magic_link_token_id`, plus the `companyId` it represents

The hash-chain invariants (see `docs/HASH_CHAIN_INVARIANTS.md`) already capture both. Tab C threads `ActorContext` through the magic-link route; existing audit writers pick it up.

---

## Success Metrics (post-launch instrumentation)

| Metric | Target | Why |
|--------|--------|-----|
| Time from Command page load to first action committed | ≤ 5s (p95) | proves the stream surfaces what matters |
| % of stream sessions ending with at least one action | ≥ 50% | proves the stream is acted on, not just read |
| % of sessions invoking search for an item that should have been in the stream ("hunt event") | ≤ 1% | proves principle 1 — no hunting |
| Snooze : Dismiss ratio | < 4 : 1 | high snooze suggests sort is wrong |
| Iris Draft accept-rate (Phase 2) | ≥ 30% | proves drafts are useful, not noise |

Tab A wires basic instrumentation hooks; full dashboard is post-Wave-1.

---

## Key Workflows

### Morning PM Workflow
1. Open SiteSync → Command stream shows today's priorities
2. Scan 5–7 items, expand the critical ones
3. Approve Iris-drafted follow-ups (send with one tap)
4. Review and send Iris-drafted owner update
5. Check Commitments view for who owes what today
6. Total time: 10 minutes instead of 90

### Field Walk Workflow (Superintendent) — *post-Wave-1*
Walk Mode is deferred. Wave 1 superintendent experience = Command stream + existing Daily Log page.

### Sub "Get Paid" Workflow
1. Sub receives magic link (email/text) → opens directly to `/sub/[token]`
2. Sees: required photos, open punch items, missing closeout docs, pay app requirements
3. Uploads photos, marks punch complete, submits documents
4. Status updates visible to PM immediately
5. No app download required for basic actions
6. All actions audit-attributed via `actor_kind: 'magic_link'`

### Owner Update Workflow
1. PM taps "Generate Owner Update" in Reports
2. Iris drafts: executive summary, schedule status, budget status, key risks, decisions needed, progress photos, lookahead
3. PM reviews, edits, sends
4. Owner receives clean report with their specific decisions highlighted

---

## What We Do NOT Build (Yet)

- Living Project Map (spatial view) — wait for tagged data to accumulate
- Architect Response Packets (AI-bundled RFI context) — Phase 2 of architect role
- Executive portfolio view — wait until multiple projects are on platform
- Walk Mode (Super mobile guided field walk) — Phase 2
- Voice-to-Daily-Log — Phase 2
- TCO/CO Readiness Engine — Phase 3
- AI commitment extraction from meetings/emails — Phase 4
- Cmd+K natural-language Iris queries — Phase 4
- Risk Card impact-chain text — Phase 4 (cards still ship; just no chain)

---

## Implementation Sessions — Wave 1 (4 parallel tabs)

| Tab | Session | Owns | Depends on |
|-----|---------|------|------------|
| A | SESSION-1 — Stream Data Layer | `useActionStream`, `roleFilters`, `streamStore` | locked contract |
| B | SESSION-2 — Stream UI | `components/stream/*`, `pages/day/index.tsx` | locked contract |
| C | SESSION-3 — Navigation | `Sidebar`, `navigation` config, Cmd+K, mobile tab bar, `/sub/[token]` route | locked contract |
| D | SESSION-4 — Iris Service | `services/iris/*`, `irisDraftStore` | locked contract |

All four run **simultaneously**. Pre-flight stubs for the contract files are already committed on this branch (see `CONTRACT.md`). Merge order after all four complete: A → D → B → C.

### Wave 2 (post-Wave-1)
- Commitment Tracker dedicated view (Tab A wires data; UI is a thin extension of stream views)
- Source Trail integration across non-stream pages
- Walk Mode (Superintendent mobile)
- Owner Update generator (Reports page)
- Cmd+K NL queries
- Architect Response Packet
