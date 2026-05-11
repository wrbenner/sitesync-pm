# IRIS Phase 4 — Per-Page Insight Slot + Ambient Layer (Spec)

**Date:** 2026-05-08
**Author:** Walker (with Claude as drafting partner)
**Status:** Draft. Target Lap 5, ~Nov 2026 → Jan 2027 (T-180 → T-100 in the reverse-engineered calendar).
**Companions:**
`IRIS_NATIVENESS_PLAN_2026-05-08.md` (§7 — Phase 4 origin),
`SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` (this spec extends the existing pipeline),
`IRIS_CITATIONS_SPEC_2026-05-04.md` (every insight is cited),
`ADR_004_CITATION_SIDE_PANEL_2026-05-04.md` (citation rendering surface),
`ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` (insights, like drafts, auto-withdraw on state change),
`ADR_008_TELEMETRY_RETENTION_2026-05-04.md` (12-month default; 24-month soft-pilot),
`IRIS_TELEMETRY_SPEC_2026-05-04.md` (telemetry column patterns).
**Format reference:** `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` + `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md`.
**ADR introduced inline:** ADR-022 (insight-slot placement & coverage contract).

---

## 1. Status

**Draft.** Target window: **Lap 5, T-180 → T-100 (Nov 17 2026 → Jan 20 2027)**. Spec opens for build the day Phase 3 (Universal Knowledge Absorption) closes its exit gate. Estimated build effort: ~45 engineer-days, mapped day-by-day in §16.

**Dependencies:**
- Phase 0 — citations live, side-panel surface live (✅ shipped Days 38–41).
- Phase 1 — Context Fabric Builder live, 5 personas keyed (gate: ≥80% Iris calls go through Context Fabric).
- Phase 2 — Specialist sub-agents (Drafter, Money, Schedule, Code) live; executors close the loop on RFI + Submittal + DailyLog.
- Phase 3 — pgvector + ingestion workers live; recall@5 ≥ 0.85 on goldens.

**Without all four upstream phases green, Phase 4 is a deterministic-only veneer.** Do not open until the prerequisites are.

---

## 2. The promise being kept

Walker's standard, verbatim from the 2026-05-08 question that opened the IRIS Nativeness Plan:

> *"Actionable insights across every page and piece of information — no piece of information is not absorbed and made useful."*

**Today (2026-05-08):** ~10–15% of pages have any IRIS surface. The Drafts Inbox, the `/iris` route, the RFIs list, the Submittals list, the Daily Logs index, and the (in-flight) Schedule weather-warning chip are it. Schedule details, Budget, Punch List, Crews, Photo Gallery, Reports, Settings, Analytics, Owner Portal — **AI dead zones**.

**After Phase 4 closes:** **100% of the ~50 production pages have a uniform Insight Slot.** Where the slot has nothing to say, it renders empty — but the *pattern* is universal, so users learn one place to look on every page. The ambient layer pushes the day's top three insights via Morning Brief before the user opens the app.

This is **Pillar 8** in the IRIS Nativeness Plan ("Ambient, proactive insights — not just reactive Q&A"), which today is rated `Partial`. Phase 4 graduates it to `Real`.

---

## 3. The Insight Slot pattern

### 3.1 One component, three placements

**Component:** `src/components/iris/InsightSlot.tsx`. Single React component, < 250 LOC.

**Placement choices (page chooses one via prop):**

| `slotPlacement` | Where it renders | When to use |
|---|---|---|
| `'header_right_rail'` | Right edge of page header, next to the page title and primary actions | Default for entity-list pages (RFIs, Submittals, Punch List, Crews) where the slot is contextual to the list |
| `'sidebar_bottom_card'` | Below the navigation tree on entity-detail pages with a left sidebar (Drawing detail, Spec detail) | Pages where the user is deep in one entity and the page header is tight |
| `'floating_panel'` | Bottom-right floating chip that expands on hover/tap into a card | Dense canvas pages (Schedule Gantt, BIM viewer, Photo gallery) where header + sidebar are fully claimed |

The page declares its placement once. The slot component handles all three layouts internally.

```tsx
// Example: src/pages/Budget.tsx
<PageHeader title="Budget" actions={<BudgetActions />}>
  <InsightSlot
    pageId="budget"
    entityType="project"
    entityId={projectId}
    slotPlacement="header_right_rail"
  />
</PageHeader>
```

### 3.2 What the slot renders

The slot reads up to 3 insights from `iris_insights` (schema in §4). For each insight, it renders an `InsightCard`:

- **Eyebrow:** generator name + persona pill (e.g., `Schedule Risk · PM`).
- **Severity dot:** `info` (slate), `warn` (amber), `block` (rose).
- **Summary (Markdown, 1–3 lines):** generator-supplied. Voice-linted (per `IRIS_VOICE_GUIDE_SPEC`).
- **Citations (inline numbered chips):** open the existing side panel via `useOpenCitationPanel` (per ADR-004).
- **Action buttons (0–3):** `Accept`, `Dismiss`, `Snooze 7d`. `Accept` invokes `action_jsonb.executor_id` (a Phase-2 executor) wrapped in `PermissionGate`; `Dismiss` flips `dismissed_at`; `Snooze` flips `snoozed_until`.

If 0 insights apply: slot renders a small, low-contrast empty state (`No insights for this view.`). **Empty is intentional, not a bug.** The pattern is universal — users learn that the slot is *always there*, sometimes silent.

### 3.3 Telemetry per slot

Every slot mount fires `record_slot_impression(page_id, entity_id)`. Every render of an insight inside the slot fires `record_insight_impression(insight_id)`. Every action button fires the corresponding action telemetry. Columns and RPCs in §11.

### 3.4 ADR-022 — Insight-Slot Placement & Coverage Contract (inline)

**Decision:** Every page in `src/pages/**` gets exactly one `<InsightSlot>` with one of three `slotPlacement` values. Coverage is enforced by a CI gate (`scripts/audit-insight-slot.mjs`, modeled on `scripts/audit-permission-gate.mjs`).

**Why a contract, not a convention:**
- A convention drifts: the next engineer adds a page without a slot, the universal-pattern promise breaks.
- A CI gate makes the universal coverage falsifiable on every PR.
- The placement enum (3 values) is small enough to be reviewed in a PR and large enough to fit every layout we have.

**Locked vs. tunable:**
- *Locked:* the contract that every page declares a slot. The 3 placement values.
- *Tunable:* the per-page generator registry. The 3-insight cap. The empty-state copy.

**Failure mode if violated:** CI fails on the PR with `audit-insight-slot.mjs: page <X> missing <InsightSlot>`. Build does not ship.

---

## 4. `iris_insights` schema (DDL)

### 4.1 New table, not an extension of `drafted_actions`

**Decision:** New table `iris_insights`, not a column added to `drafted_actions`. Rationale:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Add `scope` column to `drafted_actions` | Single table; reuses existing CI gates, dedupe table, withdraw RPC. | `drafted_actions` is the **commit-track** artifact (something the user approves and Iris executes). Insights are **observation-track** artifacts (something the user *might* care about, no commitment implied). Mixing them contaminates the audit-chain hash semantics — every insight impression would otherwise be a row in the chain meant to track committed actions. The `[withdrawn by system]` decision-note convention also mismatches: insights don't have decisions, they have impressions. | Rejected |
| **New `iris_insights` table** | Clean separation of observation vs. commitment. Distinct retention policy (per ADR-008). Independent indexing. Insights that warrant an action embed the action's executor in `action_jsonb` and create the actual `drafted_action` only on `Accept` click. | Two tables to maintain; some shared concepts (citations, dedupe) duplicated. | **Chosen.** |
| Hybrid: `iris_insights` + `drafted_actions` linked via FK | Ideal long-term. | Extra schema work for marginal Lap 5 benefit. | Defer to Lap 6. |

### 4.2 DDL

```sql
-- Migration: 20261117010000_iris_insights.sql

CREATE TYPE iris_insight_scope AS ENUM (
  'page_insight',     -- attached to a page; renders in InsightSlot
  'proactive_alert',  -- urgent; surfaces as a banner on home + push
  'ambient_brief'     -- bundled into a daily Morning Brief
);

CREATE TYPE iris_insight_severity AS ENUM (
  'info',   -- worth knowing; slate dot
  'warn',   -- worth attention this week; amber dot
  'block'   -- act today; rose dot + push notification
);

CREATE TABLE iris_insights (
  insight_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope (project_id required; user_id nullable for project-wide insights)
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  persona             TEXT NOT NULL CHECK (persona IN
                        ('pm','superintendent','foreman','owner_rep','office')),
  scope               iris_insight_scope NOT NULL,

  -- Where it renders
  page_id             TEXT,            -- 'budget' | 'rfis' | 'schedule' | etc. (FK-by-convention to slot registry)
  entity_type         TEXT,            -- e.g., 'rfi','submittal','project','drawing'
  entity_id           UUID,            -- the in-view entity (NULL for list pages)

  -- Provenance
  generator_name      TEXT NOT NULL,   -- e.g., 'schedule.weather_risk', 'budget.co_ledger_delta'
  generator_version   INTEGER NOT NULL DEFAULT 1,

  -- Content
  summary_md          TEXT NOT NULL,           -- 1–3 line Markdown; voice-linted
  citation_jsonb      JSONB NOT NULL,          -- array of {kind, ref, payload, snippet} per IRIS_CITATIONS_SPEC
  action_jsonb        JSONB,                   -- nullable; {executor_id, payload, label}
  severity            iris_insight_severity NOT NULL DEFAULT 'info',

  -- Lifecycle
  expires_at          TIMESTAMPTZ NOT NULL,    -- hard expiry; rows past this filtered out + GC'd nightly
  snoozed_until       TIMESTAMPTZ,             -- user-snooze; NULL means active
  dismissed_at        TIMESTAMPTZ,             -- user-dismiss; NULL means undismissed
  accepted_at         TIMESTAMPTZ,             -- user clicked Accept and the executor ran
  withdrawn_at        TIMESTAMPTZ,             -- generator-driven withdraw (state change made it stale)
  withdrawn_reason    TEXT,                    -- '[withdrawn by system] state-change: ...' (per ADR-007)

  -- Telemetry
  impressed_at        TIMESTAMPTZ,             -- first time slot rendered this insight
  impression_count    INTEGER NOT NULL DEFAULT 0,
  context_fabric_version TEXT,                 -- version of Phase-1 fabric used at generation
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (created_at < expires_at),
  CHECK (NOT (dismissed_at IS NOT NULL AND accepted_at IS NOT NULL))
);

-- Indexes per access pattern
CREATE INDEX idx_iris_insights_slot_lookup
  ON iris_insights(project_id, page_id, expires_at)
  WHERE dismissed_at IS NULL AND withdrawn_at IS NULL AND accepted_at IS NULL;

CREATE INDEX idx_iris_insights_user_active
  ON iris_insights(user_id, scope, expires_at)
  WHERE dismissed_at IS NULL AND withdrawn_at IS NULL;

CREATE INDEX idx_iris_insights_generator
  ON iris_insights(generator_name, generator_version, created_at);

CREATE INDEX idx_iris_insights_brief
  ON iris_insights(user_id, scope, severity, created_at DESC)
  WHERE scope = 'ambient_brief' AND dismissed_at IS NULL;
```

### 4.3 RLS

Row-level security is **persona + permission-aware**. Phase 1 Context Fabric supplies the user's persona; that persona drives row visibility.

```sql
ALTER TABLE iris_insights ENABLE ROW LEVEL SECURITY;

-- A row is visible to a user iff:
--   1. The user is a member of the row's project, AND
--   2. Either user_id IS NULL (project-wide) or user_id = auth.uid(), AND
--   3. The row's persona matches one of the user's personas on this project, AND
--   4. The user has the page-level read permission implied by page_id
--      (looked up through a persona-permission matrix; see Phase 1 spec).
CREATE POLICY iris_insights_read ON iris_insights FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = iris_insights.project_id
      AND pm.user_id = auth.uid()
      AND (iris_insights.user_id IS NULL OR iris_insights.user_id = auth.uid())
      AND pm.persona = iris_insights.persona
      AND user_has_page_read(auth.uid(), iris_insights.project_id, iris_insights.page_id)
  )
);

-- Inserts are SECURITY DEFINER from generators only; users never insert directly.
CREATE POLICY iris_insights_no_user_insert ON iris_insights FOR INSERT WITH CHECK (false);

-- Updates limited to the lifecycle columns the user can change (dismiss/snooze).
CREATE POLICY iris_insights_user_update ON iris_insights FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = iris_insights.project_id
      AND pm.user_id = auth.uid()
      AND (iris_insights.user_id IS NULL OR iris_insights.user_id = auth.uid())
  )
) WITH CHECK (
  -- Only dismissed_at, snoozed_until, impressed_at, impression_count are user-writable
  -- via the dedicated RPCs; direct UPDATE is locked down at the application layer.
  true
);
```

The `user_has_page_read` helper composes the persona's read-scope with project-member ACLs — the Phase 1 fabric defines this function once; this spec consumes it.

---

## 5. Per-page insight generators

### 5.1 Generator signature

```ts
// src/services/iris/generators/types.ts

export interface IrisGenerator<T = unknown> {
  name: string;                                  // e.g., 'schedule.weather_risk'
  version: number;                               // bump on prompt or logic change
  pageIds: readonly PageId[];                    // pages this generator may surface on
  personas: readonly Persona[];                  // personas this generator targets
  ttlMs: number;                                 // default expiry from creation

  // Pure compute. Receives Context Fabric + the in-view entity (or null).
  // Returns 0+ insights.
  run(ctx: IrisContext, entity: T | null): Promise<Insight[]>;
}
```

**Registration:** generators register at module-load via `registerGenerator(g)` into a global registry indexed by `(pageId, persona)`. The slot-fan-out worker (§6.2) iterates the registry for the page+persona pair.

### 5.2 The 80/20 rule

**80% of generators are deterministic.** They run as plain TypeScript reading the entity, computing thresholds, comparing dates, summing money via `src/types/money.ts`. They cite sources by ID directly. No LLM call.

**20% are LLM-synthesis.** They take the output of 2+ deterministic detectors and ask an LLM (via `IrisSynthAgent`, the Phase 2 specialist) to weave them into a single coherent narrative. Example: "MEP rough-in is 4 days ahead of schedule (deterministic) AND 3 RFIs in MEP scope are aging past spec answer time (deterministic). LLM synthesis: *'MEP is moving fast on the field but the answer queue is the bottleneck — clear the 3 aging RFIs before the wave hits.'*"

The LLM call routes through Phase 2's `IrisRouter` and uses Phase 1's Context Fabric. **No generator gets to call an LLM directly.**

### 5.3 Reference generators (one per major page)

| Page | Generator | Det / LLM | Persona(s) | Reuses |
|---|---|---|---|---|
| `schedule` | `schedule.weather_risk` — N outdoor activities at risk in next H days | Det | PM, Super | existing weather detector (Day 35) |
| `budget` | `budget.co_ledger_delta` — sum(CO log) ≠ sum(ledger CO entries); $ delta surfaced | Det | PM, Office | `IrisMoneyAgent` (Phase 2) |
| `punch-list` | `punch.aging_owner_blocked` — N items >30d, M of them owner-blocked | Det | PM, Super | aging detector (Day 31) |
| `crew` | `crew.lookahead_gap` — Tuesday lookahead needs X carpenters, Y confirmed | Det | Super | staffing detector (Day 34) |
| `photos` | `photos.progress_signal` — N photos this week show MEP rough-in M days ahead | LLM-synth | PM, Super | Phase 5 photo OCR + Phase 3 KB |
| `rfis` | `rfis.aging_past_spec_time` — N RFIs aging past spec answer time | Det | PM | aging detector + spec-section answer-time field |
| `submittals` | `submittals.cp_unactioned` — N submittals on critical-path items unactioned >14d | Det | PM, Office | cascade detector (Day 32) + schedule CP |
| `daily-log` | `daily_log.gap_detected` — 3-day gap (no log Mon–Wed) | Det | Super, PM | aging detector |
| `reports` | `reports.weekly_summary_ready` — auto-drafted Friday 4pm; click to review | LLM-synth | PM, Owner_rep | `IrisSynthAgent` |
| `settings` | `settings.dormant_team_members` — 2 team members haven't logged in 30d | Det | PM, Office | none |

These 10 are the **launch set** that close the major-page coverage gap. All ~50 pages get an `<InsightSlot>` (per §3.4 contract), but the 40 secondary pages may have zero generators registered at Phase-4 launch and render empty until Phase 6.

### 5.4 Generator-level dismissal tracking

Every dismissal increments `iris_generator_health.dismiss_7d`. The matview refreshes hourly:

```sql
CREATE MATERIALIZED VIEW iris_generator_health AS
SELECT
  generator_name,
  generator_version,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS produced_7d,
  COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL
                     AND created_at > NOW() - INTERVAL '7 days') AS dismissed_7d,
  COUNT(*) FILTER (WHERE accepted_at IS NOT NULL
                     AND created_at > NOW() - INTERVAL '7 days') AS accepted_7d,
  COUNT(*) FILTER (WHERE impressed_at IS NOT NULL
                     AND created_at > NOW() - INTERVAL '7 days') AS impressed_7d,
  CASE
    WHEN COUNT(*) FILTER (WHERE impressed_at IS NOT NULL
                            AND created_at > NOW() - INTERVAL '7 days') > 0
    THEN COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL
                            AND created_at > NOW() - INTERVAL '7 days')::NUMERIC
       / COUNT(*) FILTER (WHERE impressed_at IS NOT NULL
                            AND created_at > NOW() - INTERVAL '7 days')::NUMERIC
    ELSE 0
  END AS dismiss_rate_7d
FROM iris_insights
GROUP BY 1, 2;
```

**Auto-disable:** when `dismiss_rate_7d > 0.70` over a 7-day window with `impressed_7d >= 50`, a `pg_cron` job flips `iris_generators_disabled.is_disabled = TRUE` and posts a Slack alert tagging Walker. Re-enable is **manual** — Walker reviews the dismissed sample, decides whether to retire, retune, or accept the rate.

---

## 6. Ambient layer — Morning Brief

### 6.1 Extends `scheduled-insights-worker`

The existing pipeline (per `SCHEDULED_INSIGHTS_SPEC`) is `pg_cron heartbeat → pgmq queue → edge fn worker → drafted_actions`. Phase 4 extends it with a second fan-out path: **brief assembly per user**.

```
pg_cron heartbeat (every 15 min, existing)
     │
     │ enqueues per-(project × detector) jobs as today
     ▼
pgmq.q_insights (existing)
     │
     │ worker pulls; runs detector
     ▼
detector output  ──►  iris_insights (NEW; scope='page_insight')

pg_cron at 06:00 local (NEW; per-tenant time zone)
     │
     │ enqueues "assemble brief for user X" jobs
     ▼
pgmq.q_briefs (NEW)
     │
     │ brief-worker pulls; reads user's last 24h iris_insights;
     │ ranks; writes scope='ambient_brief' rows;
     │ triggers email + in-app banner
     ▼
iris_insights (scope='ambient_brief') + email + banner
```

### 6.2 Brief assembly

For each pilot user, every morning at 06:00 in the user's local time zone:

1. Pull all `iris_insights` rows where:
   - `user_id` matches OR `user_id IS NULL AND project_id IN user's projects`
   - `created_at > NOW() - INTERVAL '24 hours'`
   - `dismissed_at IS NULL AND withdrawn_at IS NULL`
   - `severity` IN `('warn','block')`
2. Rank by: `severity DESC, generator_priority DESC, created_at DESC`. Break ties by deterministic hash of insight_id (for stable ordering).
3. Take **top 3**. Insert as `scope='ambient_brief'` rows with the same `summary_md` + `citation_jsonb` (deduped via FK back to source insights).
4. Render brief as Markdown email + in-app banner. Each line cites; clicking jumps to the source page with `?cite=<insight_id>` deep link.
5. Phase 5 adds push notification for `severity='block'` items only.

### 6.3 Persona tuning

Brief content is filtered by the user's primary persona:

- **PM:** RFIs aging, CO ledger delta, schedule slip risk, owner-rep response queue.
- **Super:** crew lookahead gaps, weather risk, daily-log gaps, safety walks due.
- **Office:** lien waivers stale, pay-app math drift, contract-renewal expirations.
- **Owner_rep:** weekly progress summary, CO approvals queued, milestone status.
- **Foreman:** today's tasks, weather impact on today's work, T&M tickets pending.

A user with multiple personas (e.g., owner-side PM who's also office) gets a merged brief with persona-pill labeling.

### 6.4 Brief telemetry

- `email_sent_at`, `email_opened_at` (via tracked-pixel; opt-in per ADR-008).
- `banner_impressed_at`, `banner_dismissed_at` (in-app).
- `click_through_count` per insight (clicked the deep link to the source page).
- `unsubscribe_at` (per-user opt-out — never blocked).

---

## 7. Cards on Home — cross-entity insights

Pre-Phase-6 (no formal cross-project firm memory), but Phase 4 already surfaces cross-project at the **insight level**.

### 7.1 The "Across all your projects" card

Existing home dashboard (`src/pages/dashboard/Home.tsx` per persona — created in Phase 1) gets a new card: `<HomePortfolioInsightsCard>`.

For each user, runs the same generator registry across **all projects the user has access to**, aggregates the top 3 by severity, and renders them in a single card. Each row labels the source project.

**Example (PM persona):**

> *Across your 4 active projects:*
> 1. **Block — 1234 Main**: pay-app math drift $42K. Owner submits Friday.
> 2. **Warn — Carleton HQ**: 3 RFIs >30d on critical-path MEP scope.
> 3. **Warn — Nexus Tower**: weather puts 4 outdoor activities at risk Tue–Thu.

### 7.2 Why this is not "cross-project memory" yet

Phase 4 cross-project = **same generator, applied across N projects, surfaced together**. There's no pattern-detection across projects; no "you saw this on the Nexus job 6 months ago and the same shape is appearing here." That's Phase 6 (`IrisHistorian` + firm_memory).

The naming convention reflects this: `HomePortfolioInsightsCard` (Phase 4) vs. `HomeFirmMemoryCard` (Phase 6).

---

## 8. Coverage milestone

### 8.1 The 50-page audit

Today's `src/pages/**` and `src/pages/*/` directories yield **~50 production pages** after deduping numbered duplicates (`Commitments 2.tsx` etc.). The complete list is captured in `scripts/audit-insight-slot.mjs` as the canonical registry; the column below is the launch-set inventory.

| Page | Generators registered at launch | Default placement | Empty-state copy |
|---|---|---|---|
| `dashboard/Home` (per persona) | `home.portfolio_top3` (LLM-synth, cross-project) | `header_right_rail` | "No portfolio-level insights." |
| `RFIs` | `rfis.aging_past_spec_time` | `header_right_rail` | "No aging RFIs in your view." |
| `submittals` | `submittals.cp_unactioned` | `header_right_rail` | "No critical-path submittals stale." |
| `daily-log` | `daily_log.gap_detected` | `header_right_rail` | "Logs are current." |
| `Budget` | `budget.co_ledger_delta` | `header_right_rail` | "Budget reconciles." |
| `ChangeOrders` | `co.unactioned_owner` | `header_right_rail` | "No COs awaiting owner action." |
| `LienWaivers` | `lien.expired_waivers` | `header_right_rail` | "All waivers current." |
| `Tasks` | `tasks.aging` | `header_right_rail` | "No stale tasks." |
| `punch-list` | `punch.aging_owner_blocked` | `header_right_rail` | "Punch list is current." |
| `Lookahead` | `lookahead.gap_next7` | `header_right_rail` | "Lookahead is fully staffed." |
| `Crews` | `crew.lookahead_gap` | `header_right_rail` | "Crews are fully assigned." |
| `Workforce` | `workforce.skills_mismatch` | `header_right_rail` | "Workforce matches plan." |
| `Equipment` | `equipment.idle` | `header_right_rail` | "All equipment in use." |
| `schedule` | `schedule.weather_risk`, `schedule.slip_risk` | `floating_panel` | "Schedule is on track." |
| `drawings` | `drawings.unread_revisions` | `sidebar_bottom_card` | "All revisions reviewed." |
| `Specifications` | `spec.unread_addenda` | `sidebar_bottom_card` | "All addenda reviewed." |
| `bim` | `bim.clash_unreviewed` | `floating_panel` | "No unreviewed clashes." |
| `Drawings` (detail) | `drawings.related_rfis` | `sidebar_bottom_card` | "No related RFIs." |
| `photos` | `photos.progress_signal` (LLM) | `floating_panel` | "No progress signals this week." |
| `field-capture` | `field.unsynced_observations` | `floating_panel` | "All field captures synced." |
| `walkthrough` | `walkthrough.findings_unactioned` | `header_right_rail` | "No open walkthrough findings." |
| `digital-twin` | `twin.alignment_drift` | `floating_panel` | "Twin is aligned." |
| `site-intelligence` | `intel.recent_signals` | `header_right_rail` | "No new signals." |
| `Reports` | `reports.weekly_summary_ready` (LLM) | `header_right_rail` | "No reports ready to draft." |
| `OwnerReportPage` | `owner.summary_due` | `header_right_rail` | "Owner report current." |
| `OwnerPortal` | `owner.queued_approvals` | `header_right_rail` | "No approvals queued." |
| `Activity` | (none at launch) | `header_right_rail` | "No insights for activity." |
| `AuditTrail` | `audit.integrity_warnings` | `header_right_rail` | "Audit chain healthy." |
| `Files` | `files.unfiled` | `header_right_rail` | "All files filed." |
| `Wiki` | `wiki.outdated_pages` | `sidebar_bottom_card` | "Wiki is current." |
| `Directory` | (none at launch) | `header_right_rail` | "No directory insights." |
| `Vendors` | `vendors.expiring_insurance` | `header_right_rail` | "All vendor insurance current." |
| `Contracts` | `contracts.expiring` | `header_right_rail` | "No contracts expiring." |
| `Commitments` | `commitments.unfunded` | `header_right_rail` | "All commitments funded." |
| `Procurement` | `procurement.long_lead` | `header_right_rail` | "Procurement on track." |
| `Deliveries` | `deliveries.late` | `header_right_rail` | "All deliveries on time." |
| `Estimating` | (none at launch) | `header_right_rail` | "No estimating insights." |
| `Preconstruction` | (none at launch) | `header_right_rail` | "No precon insights." |
| `Closeout` | `closeout.unsigned_punch` | `header_right_rail` | "Closeout on track." |
| `payment-applications` | `payapp.math_drift` (LLM-synth + IrisMoneyAgent) | `header_right_rail` | "Pay app math reconciles." |
| `Permits` | `permits.expiring` | `header_right_rail` | "All permits current." |
| `Safety` | `safety.walks_overdue` | `header_right_rail` | "Safety walks current." |
| `Meetings` | `meetings.unactioned_minutes` | `header_right_rail` | "All meeting actions assigned." |
| `Transmittals` | `transmittals.pending_ack` | `header_right_rail` | "All transmittals acknowledged." |
| `Resources` | (none at launch) | `header_right_rail` | "No resource insights." |
| `TimeTracking` | `time.unsubmitted` | `header_right_rail` | "All time submitted." |
| `Settings` | `settings.dormant_team_members` | `header_right_rail` | "No settings issues." |
| `UserProfile` | (none at launch) | `header_right_rail` | "No profile alerts." |
| `Integrations` | `integrations.broken` | `header_right_rail` | "All integrations healthy." |
| `SecurityOverview` | `security.recent_incidents` | `header_right_rail` | "No security incidents." |
| `iris` (Drafts Inbox) | (slot disabled — page IS the slot) | n/a | n/a |

**~50 pages, 35+ generators, 3 placements, 1 contract.** The CI gate (§3.4) enforces 100% coverage of pages.

---

## 9. Insight fatigue mitigation

Three layers, defense in depth:

### 9.1 Per-page cap of 3

Hard cap. The slot renders at most 3 insights regardless of how many the registry produces for the page. Ranking: `severity DESC, generator_priority DESC, created_at DESC`. The 4th-and-onward are simply not surfaced (still in `iris_insights` table, used in brief assembly + dashboards).

### 9.2 Decay-on-dismiss

When a user dismisses insight `I`, all insights from the same `(generator_name, entity_id)` get a `lower_priority_until` of `created_at + 14 days`. They still surface, but ranked behind anything else. After 14 days, normal priority resumes. The user's signal is honored without permanently silencing the generator.

### 9.3 Generator-level auto-disable

Per §5.4. Crosses the `dismiss_rate_7d > 0.70` threshold (with `impressed_7d >= 50` as the volume floor) → generator is disabled, Slack alerts Walker, manual re-enable required. The threshold is **per-generator-per-version** — bumping `generator_version` resets the counter, so the natural workflow is "tune the prompt, bump version, see if dismiss rate improves."

### 9.4 User-level frequency preference

`user_preferences.iris_insight_frequency` ∈ `('low','med','high')`, default `'med'`. Mapping:

| Pref | Slot cap | Brief delivery | Push (Phase 5) |
|---|---|---|---|
| `low` | 1 per page | weekly digest only | block-only |
| `med` (default) | 3 per page | daily | warn + block |
| `high` | 3 per page | daily + midday | all severities |

Pref is a one-line setting, set-and-forget. Honored by the slot renderer and brief worker.

---

## 10. Eval / acceptance

### 10.1 Goldens — 50 fixtures × 5 personas

`tests/iris/goldens/phase4/` holds 50 fixture project states (JSON). Each fixture defines:

- The project entity tree (RFIs, submittals, schedule, budget, etc.) at a frozen moment.
- The current page being viewed.
- The expected set of insights per persona (`expected[persona] = string[]` of generator names).

The runner mounts each fixture × persona, invokes the generator registry, asserts the produced insights match the expected set within tolerance: ≥ 90% precision, ≥ 80% recall.

### 10.2 Generator-level test coverage

Each generator gets a `*.test.ts` under `src/services/iris/generators/__tests__/`. Coverage target: **≥ 90% line coverage**. Patterns:

- **Trigger case:** entity in the state that should produce the insight; assert `output.length === 1`.
- **Boundary case:** entity one threshold-step away; assert `output.length === 0`.
- **Empty case:** entity in a clean state; assert `output.length === 0`.
- **Multi case:** entity producing 2+ matching sub-cases; assert single insight (the generator dedupes its own output).
- **Citation case:** assert every produced insight has at least one citation, and `verifyCitationSnippet` (per `IRIS_CITATIONS_SPEC`) returns `ok` for each.

### 10.3 End-to-end synthetic project run-through

A synthetic 60-day project (`tests/iris/goldens/synthetic-project/`) is replayed day-by-day. At each simulated day, the runner:

1. Mutates the project state.
2. Runs the cron heartbeat.
3. Mounts each of the 50 pages × 5 personas.
4. Asserts the slot is non-empty on **≥ 80% of expected page-persona pairs** (where "expected" is hand-labeled per fixture day).

This is the **acceptance proof** that 80% coverage is real, not just a CI-gate count.

### 10.4 Privacy + permission tests

50 cases of "user X queries page P on project Q, must not see insight I." Adapted from Phase 3's RLS tests. **100% pass required.** Single failure blocks ship.

---

## 11. Telemetry

### 11.1 Columns (already in §4.2)

`iris_insights.impressed_at`, `impression_count`, `dismissed_at`, `accepted_at`, `snoozed_until`, `withdrawn_at`, `withdrawn_reason`, `context_fabric_version`.

### 11.2 RPCs

```sql
CREATE OR REPLACE FUNCTION record_insight_impression(p_insight_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE iris_insights
    SET impressed_at = COALESCE(impressed_at, NOW()),
        impression_count = impression_count + 1
    WHERE insight_id = p_insight_id
      AND EXISTS (SELECT 1 FROM iris_insights ii WHERE ii.insight_id = p_insight_id);
END $$;

CREATE OR REPLACE FUNCTION record_insight_dismiss(p_insight_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE iris_insights
    SET dismissed_at = NOW()
    WHERE insight_id = p_insight_id
      AND dismissed_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION record_insight_snooze(p_insight_id UUID, p_until TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE iris_insights
    SET snoozed_until = p_until
    WHERE insight_id = p_insight_id
      AND dismissed_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION record_insight_accept(p_insight_id UUID, p_drafted_action_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE iris_insights
    SET accepted_at = NOW()
    WHERE insight_id = p_insight_id
      AND accepted_at IS NULL;
END $$;
```

### 11.3 Per-generator dashboard queries

```sql
-- Dismiss / accept rates per generator (last 7 days)
SELECT generator_name, generator_version,
       impressed_7d, dismissed_7d, accepted_7d,
       ROUND(dismiss_rate_7d * 100, 1) AS dismiss_pct
FROM iris_generator_health
ORDER BY dismiss_rate_7d DESC;

-- Time-to-action per generator
SELECT generator_name,
       PERCENTILE_CONT(0.5) WITHIN GROUP
         (ORDER BY EXTRACT(EPOCH FROM (accepted_at - impressed_at))) AS p50_seconds,
       PERCENTILE_CONT(0.95) WITHIN GROUP
         (ORDER BY EXTRACT(EPOCH FROM (accepted_at - impressed_at))) AS p95_seconds,
       COUNT(*) FILTER (WHERE accepted_at IS NOT NULL) AS accepted_count
FROM iris_insights
WHERE created_at > NOW() - INTERVAL '7 days'
  AND impressed_at IS NOT NULL
GROUP BY 1
ORDER BY 4 DESC;

-- Pushed-vs-asked ratio (acceptance gate metric)
-- "Pushed" = surfaced via brief or slot before user query; "Asked" = surfaced via /iris chat.
SELECT
  COUNT(*) FILTER (WHERE source = 'pushed')::NUMERIC
    / NULLIF(COUNT(*), 0)::NUMERIC AS pushed_ratio
FROM iris_session_events
WHERE event_kind = 'insight_surfaced'
  AND occurred_at > NOW() - INTERVAL '14 days';
```

### 11.4 Brief telemetry queries

```sql
-- Open rate (gate: ≥ 40%)
SELECT
  COUNT(*) FILTER (WHERE email_opened_at IS NOT NULL)::NUMERIC
    / NULLIF(COUNT(*), 0)::NUMERIC AS open_rate
FROM iris_briefs
WHERE email_sent_at > NOW() - INTERVAL '14 days';

-- Click-through (deep-link clicks per brief sent)
SELECT
  AVG(click_through_count) AS avg_ctr,
  COUNT(*) AS briefs_sent
FROM iris_briefs
WHERE email_sent_at > NOW() - INTERVAL '14 days';

-- Dismiss rate of briefs (gate: < 30%)
SELECT
  COUNT(*) FILTER (WHERE banner_dismissed_at IS NOT NULL)::NUMERIC
    / NULLIF(COUNT(*) FILTER (WHERE banner_impressed_at IS NOT NULL), 0)::NUMERIC AS dismiss_rate
FROM iris_briefs
WHERE banner_impressed_at > NOW() - INTERVAL '14 days';
```

---

## 12. Test plan

### 12.1 Unit (Vitest)

- Each generator: trigger / boundary / empty / multi / citation cases.
- Slot component: renders 0, 1, 2, 3 insights; renders empty state; placement variants don't break layout.
- Telemetry RPCs: idempotent on repeat calls; respect status invariants.
- Decay: a dismissed insight's siblings get `lower_priority_until` set; ordering reflects it.

### 12.2 Integration (Postgres + Vitest)

- Mount page → slot fires `record_slot_impression`; insights fire `record_insight_impression`.
- Generator registry: registering 2 generators on the same `(page, persona)` produces both, ranked by priority.
- RLS: an `office` persona user cannot read `superintendent`-scoped insights even on the same project.
- Auto-disable: seed `iris_insights` with > 70% dismissal at impressed_7d ≥ 50 → matview refresh → cron fires → generator flagged disabled.

### 12.3 Brief end-to-end

- Synthetic 10-user pilot org. Seed 24h of mixed-severity insights. Run brief worker. Assert:
  - 10 briefs rendered.
  - Each contains exactly 3 entries (or fewer if not enough warn/block insights).
  - Persona filtering correct (PM brief contains 0 superintendent-only insights).
  - Email rendered as Markdown with intact citation deep-links.
  - In-app banner mounts in `Home.tsx`.

### 12.4 Fatigue simulation

- Spin up a 30-day virtual usage timeline. Generator G fires 60 times; user dismisses 50.
- Assert auto-disable triggers within 24h of crossing the threshold.
- Assert Slack webhook fires (in tests, mocked).

### 12.5 Coverage CI

`scripts/audit-insight-slot.mjs` walks `src/pages/**/*.tsx`, parses the JSX, asserts every page mounts an `<InsightSlot>` exactly once. Adapted from `scripts/audit-permission-gate.mjs`. Wired into `lap-5-acceptance.yml`.

### 12.6 Acceptance dry-run

The synthetic project run-through (§10.3) is the acceptance proof. CI runs nightly on `main`; results posted to a Slack channel. Going-into-pilot release tags require the run-through to pass.

---

## 13. Failure modes

### 13.1 Generator throws

A single generator throwing (e.g., a SQL query times out, an LLM-synth hits its budget mid-call) **must not break the slot.** The slot renderer wraps each generator invocation in `try/catch`, logs to `iris_generator_errors`, and renders the slot with whatever generators succeeded (possibly empty). The user sees no error.

Per-generator error rate is monitored — > 10 errors/hour for one generator alerts to Walker.

### 13.2 LLM synthesis exceeds budget

`IrisSynthAgent` (Phase 2) has a per-call latency budget of 8s and a per-day token budget per project (default $1.50/day, configurable). When either exceeds:

- Latency: the synthesis call is cancelled; the generator falls back to **deterministic-only output** (the underlying signals as plain text, no narrative weave). The insight still surfaces.
- Token budget: the synthesis call is skipped entirely; deterministic-only fallback kicks in.

This means **LLM-synth generators always produce a working insight, even when the LLM is unavailable.** They just produce less elegant prose.

### 13.3 Brief send fails

The brief-worker uses `pgmq` retry semantics (per `SCHEDULED_INSIGHTS_SPEC`). 3 attempts with exponential backoff (60s → 240s → 480s). After 3 failures, the job moves to DLQ (`pgmq_archive`) and a `audit_incidents` row is inserted at `severity='medium', category='brief_delivery_failed'`. Walker reviews DLQ daily.

### 13.4 User has no permission for a cited entity

The `iris_insights` row is filtered out by RLS at read time — the user simply doesn't see it. **No leak**, no rendered placeholder. Citation resolver per ADR-004 handles partial-permission cases inside the side panel (returns `forbidden` status; renders "[source not visible to you]").

### 13.5 Page has no generators registered

Slot renders empty with the page-specific empty-state copy. **Intentional.** The universal-pattern promise is "the slot is always there" — silence is part of the promise.

### 13.6 Cross-tenant data exposure via shared generators

Generators run server-side under `SECURITY DEFINER`. Each generator is responsible for scoping queries to `WHERE project_id = ctx.project_id`. **Two-engineer review required** on every generator that joins across tables — same protocol as Phase 3 retrieval. A single tenancy-leak slip kills enterprise trust irreparably.

### 13.7 Brief opt-out not honored

Per ADR-008 (telemetry retention) and platform policy, `iris_user_preferences.briefs_opted_out = TRUE` must short-circuit the brief worker for that user. The worker does a `WHERE NOT briefs_opted_out` filter before enqueueing. A failing test in §12 specifically asserts this; CI blocks on regression.

---

## 14. Acceptance gate

Phase 4 closes when **all five** of the following hold for **two consecutive weeks** on the soft-pilot cohort:

1. **Coverage:** ≥ 80% of pages have a non-empty Insight Slot at least once a week per active user. Measured by `SELECT COUNT(DISTINCT page_id) FROM iris_insights WHERE impressed_at > NOW() - INTERVAL '7 days' AND user_id = u.id` per user.
2. **Pushed-vs-asked:** ≥ 50% of insights surfaced before the user formed a query. Measured per §11.3.
3. **Brief open rate:** ≥ 40% on pilot. Measured per §11.4.
4. **Dismiss rate:** mean per-generator dismiss rate < 50% across the active generator set.
5. **Zero cross-tenant leaks:** the 50 RLS test cases pass on every nightly run for two weeks.

CI workflow: `.github/workflows/lap-5-acceptance.yml`. Same shape as `lap-2-acceptance.yml`. The 5 thresholds live in `lap-5-acceptance.config.yml` as the source of truth.

---

## 15. Cross-references

**Depends on:**
- **Phase 0 (Citations)** — every insight cites; the side-panel surface (ADR-004) is the citation viewer.
- **Phase 1 (Context Fabric)** — persona-tuning, `IrisContext` shape, `user_has_page_read` permission helper.
- **Phase 2 (Specialists)** — `IrisSynthAgent` for the 20% LLM generators; `IrisMoneyAgent` / `IrisScheduleAgent` for deterministic checks; the `Accept` button invokes Phase 2 executors.
- **Phase 3 (KB retrieval)** — cross-entity insights (`photos.progress_signal`, `home.portfolio_top3`) pull KB chunks via `retrieve()`.

**Reuses:**
- `scheduled-insights-worker` (extended; adds `q_briefs` queue + brief-assembly worker).
- 5 detectors from Days 31–35: cascade, aging, variance, staffing, weather.
- `useOpenCitationPanel` hook (per ADR-004).
- `PermissionGate` (per Sprint Invariant #5).
- `voiceLinter` / `style.ts` (per `IRIS_VOICE_GUIDE_SPEC`).

**Hands off to:**
- **Phase 5 (Multi-modal)** — adds photo-anchored citations to existing `photos.progress_signal` generator; adds push notifications for `severity='block'`.
- **Phase 6 (Cross-project memory)** — replaces `home.portfolio_top3` with `IrisHistorian` cross-project pattern detection.

---

## 16. Day-by-day breakdown (~45 days, Lap 5 first half)

Lap 5 opens on **2026-11-17** (T-180 in the reverse-engineered calendar) and Phase 4's window is T-180 → T-100, Nov 17 2026 → Jan 20 2027. The 45 build-days fit inside the first 9 weeks of Lap 5.

| Lap-5 Day | Week | What ships |
|---|---|---|
| 1 | W1 | Migration `20261117010000_iris_insights.sql` applied to staging. RLS policies + `user_has_page_read` helper composed. |
| 2 | W1 | `iris_generators_disabled` table + `iris_generator_health` matview + nightly refresh job. |
| 3 | W1 | `IrisGenerator` interface + `registerGenerator` + global registry module. |
| 4 | W1 | `<InsightSlot>` v1 — `header_right_rail` placement only; reads from table; renders 0–3 cards. |
| 5 | W1 | `<InsightCard>` — eyebrow, severity dot, summary_md, citation chips (using existing `useOpenCitationPanel`), action buttons. |
| 6 | W2 | Telemetry RPCs (`record_insight_*`); client-side hooks; impression tracking on slot mount. |
| 7 | W2 | `<InsightSlot>` v2 — adds `sidebar_bottom_card` placement. |
| 8 | W2 | `<InsightSlot>` v3 — adds `floating_panel` placement. Three-placement coverage complete. |
| 9 | W2 | `scripts/audit-insight-slot.mjs` written. CI integration. Audits the existing 5 IRIS-aware pages first; expects 45 failures. |
| 10 | W2 | First 5 generators wired (the 5 detectors graduating from `drafted_actions` to `iris_insights`): cascade, aging, variance, staffing, weather. |
| 11 | W3 | RFIs page: `<InsightSlot>` mounted; `rfis.aging_past_spec_time` registered. CI gate now expects 44 failures. |
| 12 | W3 | Submittals page + `submittals.cp_unactioned`. |
| 13 | W3 | Daily-log page + `daily_log.gap_detected`. |
| 14 | W3 | Budget + `budget.co_ledger_delta`. |
| 15 | W3 | ChangeOrders + `co.unactioned_owner`. |
| 16 | W4 | LienWaivers + `lien.expired_waivers`. Tasks + `tasks.aging`. |
| 17 | W4 | Punch-list + `punch.aging_owner_blocked`. Lookahead + `lookahead.gap_next7`. |
| 18 | W4 | Crews + `crew.lookahead_gap`. Workforce + `workforce.skills_mismatch`. Equipment + `equipment.idle`. |
| 19 | W4 | Schedule + `schedule.weather_risk` + `schedule.slip_risk` (floating panel). |
| 20 | W4 | Drawings index + `drawings.unread_revisions`. Specifications + `spec.unread_addenda`. |
| 21 | W5 | BIM + `bim.clash_unreviewed` (floating panel). Drawings detail + `drawings.related_rfis`. |
| 22 | W5 | Photos + `photos.progress_signal` (LLM-synth — first synthesis generator). Hooks `IrisSynthAgent`. |
| 23 | W5 | Field-capture + `field.unsynced_observations`. Walkthrough + `walkthrough.findings_unactioned`. |
| 24 | W5 | Digital-twin + `twin.alignment_drift`. Site-intelligence + `intel.recent_signals`. |
| 25 | W5 | Reports + `reports.weekly_summary_ready` (LLM-synth). OwnerReportPage + `owner.summary_due`. |
| 26 | W6 | OwnerPortal + `owner.queued_approvals`. Activity + AuditTrail (latter gets `audit.integrity_warnings`). |
| 27 | W6 | Files + `files.unfiled`. Wiki + `wiki.outdated_pages`. Directory (no generator). |
| 28 | W6 | Vendors + `vendors.expiring_insurance`. Contracts + `contracts.expiring`. Commitments + `commitments.unfunded`. |
| 29 | W6 | Procurement + `procurement.long_lead`. Deliveries + `deliveries.late`. Estimating + Preconstruction (no generators). |
| 30 | W6 | Closeout + `closeout.unsigned_punch`. payment-applications + `payapp.math_drift` (LLM-synth + `IrisMoneyAgent`). |
| 31 | W7 | Permits + `permits.expiring`. Safety + `safety.walks_overdue`. Meetings + `meetings.unactioned_minutes`. |
| 32 | W7 | Transmittals + `transmittals.pending_ack`. Resources (no generator). TimeTracking + `time.unsubmitted`. |
| 33 | W7 | Settings + `settings.dormant_team_members`. UserProfile (no generator). Integrations + `integrations.broken`. SecurityOverview + `security.recent_incidents`. **CI insight-slot gate now passes — 100% coverage.** |
| 34 | W7 | Decay-on-dismiss logic. Auto-disable cron job. Slack webhook integration. |
| 35 | W7 | User-level frequency preference UI in Settings. Migration for `user_preferences.iris_insight_frequency`. |
| 36 | W8 | Brief schema (`iris_briefs` table) + `q_briefs` queue + brief-assembly edge fn. |
| 37 | W8 | Brief Markdown rendering + email integration (Postmark/Resend per existing config). |
| 38 | W8 | In-app banner component (`<HomeBriefBanner>`) on `Home.tsx`. |
| 39 | W8 | Brief telemetry: open-tracking, click-through, dismiss tracking. |
| 40 | W8 | `<HomePortfolioInsightsCard>` — cross-project insight aggregation per persona. |
| 41 | W9 | 50-fixture goldens harness scaffolded; first 10 fixtures hand-labeled; runner runs nightly. |
| 42 | W9 | Remaining 40 fixtures hand-labeled; precision/recall measurement live. |
| 43 | W9 | Synthetic 60-day project run-through harness + acceptance proof. |
| 44 | W9 | Privacy + permission test suite (50 cases). RLS coverage gates wired. |
| 45 | W9 | Lap-5 acceptance CI workflow (`lap-5-acceptance.yml`); receipt drafted; tracker updated. **Phase 4 build complete; enters 2-week measurement window for acceptance.** |

**Two-week measurement window** (Lap 5 W10–W11) follows. If the 5 acceptance thresholds hold, Phase 4 closes and Phase 5 (multi-modal) opens.

---

## 17. Risks specific to Phase 4

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Insight fatigue collapses adoption.** Users dismiss everything within 2 weeks. | High | Phase 4 gate fails; pillar 8 stays Partial. | Three-layer fatigue mitigation (§9). Auto-disable at 70% dismissal. Nightly Slack on dismissal-rate trends. Walker reviews top 3 dismissed generators every Monday. |
| 2 | **Generators are LLM-heavy in practice; cost runs hot.** The 80/20 deterministic/LLM target slips to 50/50 because LLM-synth feels easier to write. | Medium | $$/project blows past Phase-3 budget; CFO asks pointed questions. | Per-generator cost metering. LLM-synth generators require explicit signoff from Walker before merge. Deterministic-first PR review checklist. |
| 3 | **Per-page coverage CI gate becomes a chore that gets skipped via `// audit-skip` comments.** | Medium | Universal-pattern promise rots. | No `audit-skip` flag in `audit-insight-slot.mjs` — any skip requires editing the registry, which requires a PR review with Walker as required reviewer. |
| 4 | **Brief is delivered at the wrong time** (UTC instead of user-local TZ; or 6am when the PM doesn't open email until 9am). | Medium | Open rate < 40%; gate fails. | User-local TZ from `users.timezone` (already populated by Phase 1). A/B test 6am vs. 7am vs. 8am within 30-day pilot window; lock the winner. |
| 5 | **Cross-project insights leak data across tenants.** A generator with imprecise project scoping exposes insight metadata to a user from a different tenant. | Low (defense in depth) but Catastrophic | Reputation event. Pilot pulls. | Two-engineer review on every generator that joins across tables. RLS test suite with 50 cases (§10.4) — single failure blocks ship. SECURITY DEFINER scope audit. |
| 6 | **The 50-page coverage commitment outpaces engineer capacity.** 35+ generators in 33 days is ambitious for a 1.5-engineer team. | Medium-High | Phase 4 slips into Lap 6; cascades into Phase 5. | Generators are sequenced cheapest-first (the 5 existing detectors graduate Day 10; deterministic single-table generators batch 3-per-day Days 11–18; LLM-synth generators lag). Drop secondary-page generators (`Activity`, `Resources`, `UserProfile`) before LLM generators if needed; the slot still mounts (empty), the contract still holds. |
| 7 | **Acceptance metric definitions drift between spec and CI.** "Coverage" gets measured one way in code, another way in this doc, and the team argues at gate time. | Medium | Gate becomes unfalsifiable. | Threshold definitions live in `lap-5-acceptance.config.yml` as the single source of truth. The CI workflow imports from it. The receipt at gate time quotes from it. |
| 8 | **Phase 1 `user_has_page_read` helper isn't ready when Phase 4 opens.** Phase 4 RLS depends on it. | Low (Phase 1 closes 60+ days earlier) | Migration blocks; Phase 4 W1 pushes a week. | Phase 1 spec explicitly lists `user_has_page_read` as a required deliverable. Phase 4 W1 has a 1-day buffer for fixes if needed. |

---

## 18. What this spec deliberately does NOT cover

- **Push notifications.** Mobile push for `severity='block'` insights is **Phase 5** scope. Phase 4 covers in-app banner + email only.
- **Cross-project pattern detection.** The "we've seen this before" alerts are **Phase 6** (`IrisHistorian` + `firm_memory`). Phase 4's `home.portfolio_top3` is parallel-projects, not cross-project memory.
- **The chat surface.** The `/iris` route stays as the chat fallback (per Pillar 1 of the IRIS Nativeness Plan: "Workflows beat chat. Chat is the fallback."). Phase 4 does not redesign the chat — it makes chat the rare path because the slot + brief surface what the user would have asked.
- **The drafted-action commit path.** When a user clicks `Accept` on an insight with `action_jsonb` populated, the executor that runs is a **Phase 2** specialist. This spec consumes the executor; doesn't redesign it.
- **Multi-tenancy beyond the soft pilot.** Acceptance metrics are measured on the soft-pilot cohort only. Lap 6 broadens.

---

## 19. Update to other docs

- `docs/audits/INDEX.md` → add this spec under "Specs / Plans" + note ADR-022 inline.
- `SiteSync_90_Day_Tracker.xlsx` → add **`Lap 5 — Phase 4`** sheet with the 45 day-rows from §16.
- `IRIS_NATIVENESS_PLAN_2026-05-08.md` §7 (Phase 4) — link to this spec where today it has only a paragraph.
- `LAP_2_ACCEPTANCE_GATE_SPEC` — no edit; that gate already closed (Phase 4 is post-Lap-2).
- `SCHEDULED_INSIGHTS_SPEC` — no edit; this spec extends without modifying.

---

## 20. Open questions for Walker

1. **Brief delivery — email + banner only at launch, or also Slack DM for opted-in pilots?** Slack DM might be where Brad Cameron actually reads things. Cost: 1 day to wire to Slack-by-Salesforce MCP.
2. **Frequency pref — should `low` mean "weekly digest only" or "daily but capped 1/page"?** This spec assumes the former; revisit if pilot data suggests otherwise.
3. **Auto-disable threshold — 70% over 7 days with 50-impression floor.** Confirm or tune at Phase 4 W3 design review.
4. **Owner-portal slot — does the owner's company see insights computed by their GC, or do they get a separate generator set?** This spec assumes shared-tenant generators with persona='owner_rep' filtering. Owner-rep persona behavior is set in Phase 1; Phase 4 inherits.
5. **`reports.weekly_summary_ready` is LLM-synth — does the auto-drafted weekly report itself live as a `drafted_action` or as a separate `iris_reports` artifact?** Recommend `drafted_action` to reuse the inbox approval flow; revisit if reports turn out to be qualitatively different from RFI/submittal drafts.

---

*End of spec. ~5,200 words. Phase 4 opens for build at Lap 5 kickoff (T-180, 2026-11-17).*
