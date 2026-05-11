# IRIS Phase 6 — Cross-Project Memory + Firm Playbook (Spec)

**Date:** 2026-05-08
**Author:** Walker (with Claude as engineering partner)
**Status:** Draft. Target window: **Lap 6 (~Mar–Apr 2027), T-60 → T-0.** **DO NOT BUILD UNTIL T-195 audit-chain certification ships (Oct 15 2026).** This spec exists in-tree pre-emptively so the schema is reviewed long before code lands; it is **not** a Lap 2/3 deliverable.
**Reading order:** `IRIS_NATIVENESS_PLAN_2026-05-08.md` § 7 Phase 6 → this spec → ADR-021 stub (cross-project anonymization protocol).
**Companion docs:** `ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`, `ADR_008_TELEMETRY_RETENTION_2026-05-04.md`, `ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md`, `IRIS_TELEMETRY_SPEC_2026-05-04.md`, `IRIS_CITATIONS_SPEC_2026-05-04.md`, `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`.
**Format reference:** `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md`, `IRIS_CITATIONS_SPEC_2026-05-04.md`, `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md`.

---

## 1. Status

**Draft. Target Lap 6 (~Mar–Apr 2027). DO NOT START until T-195 audit-chain certification (Oct 15 2026) is closed.**

The spec is being written **10 months before the build window** for one reason only: cross-project memory is the **36-month moat**, and the schema design has to be right the first time. Schema mistakes here cascade into every closed project's pattern history, and we cannot retroactively re-extract patterns from projects that were already closed under a wrong shape.

By the time Phase 6 opens, this document will have been reviewed by:
- The Phase 0 / Lap 2 cohort (today's Walker + Claude, this draft).
- Engineer #2 (hired in Phase 1, Lap 3).
- The audit firm running the T-195 certification.
- Legal review on the anonymization protocol (ADR-021), at the latest before Phase 7 cross-firm aggregates open.

The build window is **~30 engineering days** (one engineer-month). It includes: schema migration, closeout extractor, IrisHistorian sub-agent, lessons-learned capture UX, anonymization layer, eval harness, telemetry, and the nightly cross-project leak inspector.

---

## 2. Why This Is the 36-Month Moat

The single hardest thing for Procore — or any incumbent — to copy is **36 months of accumulated firm-level memory**. Every other pillar in the IRIS plan is a **feature**: citations, voice tuning, specialist sub-agents, per-page coverage, voice capture. Procore's copilot team can ship feature-parity on each of those in a single sprint if they choose to. They cannot ship 36 months of compounding pattern-memory unless they were already 36 months into an architecture that captures it.

This is the **Suffolk MAX class**. The thesis: *the fifth project at a firm runs measurably smarter than the first project at the same firm, because the platform remembers what the first four projects taught it.* That memory is not a model fine-tune. It is a structured per-tenant pattern store that:

1. Captures lessons explicitly (human-authored at closeout).
2. Extracts patterns implicitly (RFI clusters, CO causes, schedule slips, submittal rejection rates by sub).
3. Surfaces those patterns at the moments they're useful — through the IrisHistorian sub-agent, **never as raw retrieval, always as cited historical signal**.

Every other AI-PM platform that ships in 2026 will be able to point at a single project's data. SiteSync — by Apr 2027 — will be the only one that can say "on your last three hospital projects, MEP-coordination RFIs spiked 30 days before substantial completion; today is Day-32." That sentence is the moat.

The business case: **a Suffolk-class firm signs SiteSync because no competitor can match the 5th-project compounding effect.** Walker's North Star, restated: every project should make the next project cheaper to run.

---

## 3. The Deliberate Sequencing

Phase 6 is **deliberately last** among the IRIS phases that close before T-0 launch. The reasons are strategic, not technical:

| Constraint | Why |
|---|---|
| **Ships AFTER T-195 audit-chain certification (Oct 15 2026)** | The audit chain is the trust substrate. A cross-project memory layer without an audited foundation is a liability event waiting to happen. The audit firm sees the closeout-extractor write path before any patterns persist. |
| **Pre-cert: do NOT market it. Do NOT expose schema. Do NOT telegraph in pilot UX.** | Cross-project memory is the one feature Procore could feature-match in a single quarter if telegraphed early. Any pre-cert demo that shows "we remember your last project" gives them the product spec for free. The firm_memory_alpha feature flag stays off for everyone except Walker's dev account. |
| **Post-cert: lead with the moat in T-180 → T-150 marketing.** | Once the audit-chain cert exists and the schema has been validated by an external firm, the moat is structurally defensible. T-180 (Nov 2026) marketing pivot leans hard on "the only PM platform that gets smarter with every project." |
| **No cross-tenant aggregates in Phase 6.** | Cross-firm aggregation (e.g., "across all hospital GCs in our system, the median MEP RFI count at Day -30 is...") is **explicitly Phase 7+** and gated behind ADR-021. Phase 6 is per-tenant only. |

Restated bluntly: **the goal of Phase 6 is to make the launch narrative true, not to make a feature-parity claim.** If competitors can read this spec they cannot beat it without 36 months of customer data they don't have. That asymmetry is the entire game.

---

## 4. `firm_memory` Schema (DDL)

Three new tables. Per-tenant. RLS-enforced. Indexed for the IrisHistorian query pattern (point-lookup on tenant + pattern_type + currency window).

### 4.1 `firm_memory_patterns` — durable per-tenant pattern layer

```sql
-- Migration: 20270315010000_firm_memory_patterns.sql

CREATE TABLE firm_memory_patterns (
  pattern_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES organizations(id),
  pattern_type          TEXT NOT NULL CHECK (pattern_type IN (
    'rfi_category_spike',
    'rfi_response_latency',
    'co_cause_cluster',
    'co_size_distribution',
    'schedule_slip_pattern',
    'submittal_rejection_rate',
    'submittal_turnaround',
    'safety_incident_cluster',
    'weather_impact_correlation',
    'sub_performance',
    'closeout_punchlist_drag'
  )),
  pattern_summary       TEXT NOT NULL, -- Human-readable, IrisHistorian quotes from this verbatim
  pattern_payload       JSONB NOT NULL, -- Structured numeric facts: percentiles, counts, etc.
  supporting_project_ids UUID[] NOT NULL, -- Origin projects; anonymized in IrisHistorian UI
  confidence_score      NUMERIC(4,3) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  observation_count     INTEGER NOT NULL CHECK (observation_count >= 1),
  first_observed_at     TIMESTAMPTZ NOT NULL,
  last_observed_at      TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at            TIMESTAMPTZ -- NULL = active; set when superseded or stale
);

-- RLS: SELECT only by users in the tenant.
ALTER TABLE firm_memory_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY firm_memory_patterns_tenant_select ON firm_memory_patterns
  FOR SELECT USING (
    tenant_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT/UPDATE only by service-role (closeout extractor) — no human writes.
-- DELETE forbidden; use retired_at.

CREATE INDEX idx_firm_memory_patterns_tenant_type
  ON firm_memory_patterns(tenant_id, pattern_type)
  WHERE retired_at IS NULL;

CREATE INDEX idx_firm_memory_patterns_supporting_projects
  ON firm_memory_patterns USING GIN (supporting_project_ids);
```

### 4.2 `firm_memory_lessons` — explicit human-authored lessons

```sql
CREATE TABLE firm_memory_lessons (
  lesson_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES organizations(id),
  project_id     UUID NOT NULL REFERENCES projects(id), -- Origin project
  authored_by    UUID NOT NULL REFERENCES auth.users(id),
  title          TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 200),
  body_md        TEXT NOT NULL CHECK (length(body_md) BETWEEN 20 AND 8000),
  tags           TEXT[] NOT NULL DEFAULT '{}', -- Free-form, normalized lowercase
  severity       TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retire_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 years')
);

ALTER TABLE firm_memory_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY firm_memory_lessons_tenant_select ON firm_memory_lessons
  FOR SELECT USING (
    tenant_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY firm_memory_lessons_pm_insert ON firm_memory_lessons
  FOR INSERT WITH CHECK (
    authored_by = auth.uid()
    AND tenant_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('pm', 'super', 'owner_rep')
    )
  );

CREATE INDEX idx_firm_memory_lessons_tenant_tags
  ON firm_memory_lessons(tenant_id) INCLUDE (tags);
```

**Lessons are highest-trust signal.** When IrisHistorian answers a question and a lesson matches the topic, the lesson is cited *first*, ahead of any extracted pattern. Human-authored beats machine-extracted, always.

### 4.3 `firm_memory_aggregates` — read-optimized rollups (matview)

```sql
CREATE MATERIALIZED VIEW firm_memory_aggregates AS
SELECT
  p.tenant_id,
  p.pattern_type,
  COUNT(*)                         AS pattern_count,
  AVG(p.confidence_score)          AS mean_confidence,
  AVG(p.observation_count)         AS mean_observations,
  MAX(p.last_observed_at)          AS most_recent_observation,
  -- Median time-to-respond per RFI category, mean CO size by trade, etc.
  -- Computed from pattern_payload->'percentiles' across the tenant's history.
  jsonb_object_agg(
    p.pattern_type,
    jsonb_build_object(
      'p50', percentile_cont(0.5) WITHIN GROUP (ORDER BY (p.pattern_payload->>'value')::numeric),
      'p90', percentile_cont(0.9) WITHIN GROUP (ORDER BY (p.pattern_payload->>'value')::numeric)
    )
  ) AS percentiles
FROM firm_memory_patterns p
WHERE p.retired_at IS NULL
GROUP BY p.tenant_id, p.pattern_type;

CREATE UNIQUE INDEX idx_firm_memory_aggregates_tenant_type
  ON firm_memory_aggregates(tenant_id, pattern_type);

-- Refreshed nightly by scheduled-insights worker (per ADR-003 hybrid cron).
-- pg_cron entry:
SELECT cron.schedule(
  'refresh_firm_memory_aggregates',
  '15 4 * * *', -- 04:15 UTC daily
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY firm_memory_aggregates$$
);
```

### 4.4 What is **NOT** in this schema (Phase 7+ work, OUT OF SCOPE)

- **No cross-tenant table.** No `industry_memory_patterns`. No "all hospital GCs in our system" view. **Reserved for Phase 7+ with explicit ADR-021 anonymization protocol and legal sign-off.**
- **No de-anonymized sub data.** Subcontractor identities live on the project's existing tables; firm_memory references them by ID per-tenant only.
- **No model fine-tuning data dump.** firm_memory is structured rows, not a training set.

---

## 5. Project Closeout Extractor

**Trigger:** `projects.status` transitions to `'substantially_complete'` or `'closed'`. A row is enqueued in `pgmq.firm_memory_extraction_jobs` (the queue lives alongside the existing scheduled-insights queue, per ADR-003).

**Worker:** edge function `firm-memory-closeout-worker` (per ADR-003 pattern). Per-job runtime budget: 5 minutes. Idempotency key: `(project_id, schema_version)`.

**Pipeline stages:**

1. **RFI cluster extraction.** Cluster the project's RFIs by topic (BERTopic-class clustering on the question text + spec section reference). Output: `{cluster_label, count, median_age_to_response, owner_response_rate, cited_spec_sections[]}`. Each cluster with ≥3 RFIs becomes a candidate pattern of type `rfi_category_spike` or `rfi_response_latency`.

2. **CO cause clustering.** Group COs by cause code + narrative similarity. Output per cluster: `{cause_label, total_value_cents, count, source_RFI_ids[]}`. Each cluster with ≥2 COs becomes a candidate pattern of type `co_cause_cluster` or `co_size_distribution`.

3. **Daily-log rolling stats.** Compute headcount variance, weather-day rate, safety-incident cadence, and work-completion narrative density. Output: `schedule_slip_pattern` candidates where actual progress lagged scheduled progress by >5%.

4. **Schedule history slip patterns.** Walk the project's schedule baseline + actual history. Identify activities that slipped. For each slip, attach root-cause inference (weather / sub no-show / RFI block / submittal block / scope change) using the existing detector logic. Output: `schedule_slip_pattern` patterns.

5. **Photo time-delta analysis.** For each rough-in milestone (MEP rough, drywall, finishes), compute the time delta between scheduled-completion and photo-evidence-of-completion. Output: feeds the `schedule_slip_pattern` payload.

6. **Submittal rejection clustering.** Group submittals by submitting sub. Compute rejection rate. Each sub with rejection rate ≥30% becomes a `submittal_rejection_rate` pattern, with the supporting submittal IDs.

7. **Lessons-learned merge.** Read the `firm_memory_lessons` rows authored during the closeout session (see § 6). They are NOT extracted patterns — they are first-class human signal — but the extractor cross-references them so the IrisHistorian can quote a lesson alongside a pattern when the topic matches.

**Per-tenant only.** No cross-firm aggregation. The extractor never reads outside `tenant_id = $project.tenant_id`.

**Idempotency.** Re-running the extractor on an already-closed project produces zero net new rows. Each pattern is keyed by `(tenant_id, pattern_type, payload_hash)`. If a row already exists with the same hash, the extractor updates `last_observed_at` and increments `observation_count`; it does not duplicate. Tested by the long-running test in § 12.

**Confidence score gating.** A candidate pattern is written to `firm_memory_patterns` only if:
- `observation_count ≥ 2` (at least one prior project observed the same pattern), OR
- `confidence_score ≥ 0.75` based on within-project signal strength (e.g., rejection-rate clusters with ≥10 submittals get a 0.85 floor).

This prevents the early-pilot problem of "we have 1 closed project, every random correlation looks like a pattern."

---

## 6. Lessons-Learned UX

At project closeout, the PM is offered a **structured prompt session** — voluntary, but heavily nudged. 10 questions, ~15 minutes. The output is one or more `firm_memory_lessons` rows, tagged and severity-graded.

### 6.1 The 10-question script

1. *What surprised you? (Cost, schedule, or quality.)*
2. *What would you do differently if you ran this project again from Day 1?*
3. *Which subcontractor over-performed? Which under-performed? Why?*
4. *Which RFI category spiked late, and could it have been pre-empted?*
5. *Was there a moment the schedule lost its grip? When, and what triggered it?*
6. *Which design discipline gave you the most coordination friction?*
7. *Which spec section was the most-cited source of disputes?*
8. *What did the owner expect that you didn't catch in pre-construction?*
9. *Was there a safety call that the team got right? One they got wrong?*
10. *Looking at the closeout punch list — what's the systemic root cause of the largest cluster?*

Each answer becomes a candidate `firm_memory_lessons` row. The PM tags + severity-grades each before save (low/medium/high/critical). The IrisDrafter can pre-fill suggested tags and severity from the answer text; the PM confirms or overrides.

### 6.2 Why this matters

Lessons are the **highest-trust signal in firm_memory.** When the IrisHistorian fires an alert, a matching lesson is cited *first* (with author + project context), ahead of any extracted pattern. The pattern store says "the data shows X"; the lesson store says "Walker, in 2026, on the Tower B project, said: 'we should have caught the curtain-wall coordination issue at 60% design.'" The human voice always wins.

### 6.3 Capture timing

The structured prompt is offered when the project transitions to `'substantially_complete'` and again at `'closed'` (in case the PM skipped the first pass). It can also be triggered ad-hoc from the project settings page. Lessons authored mid-project are valid and indexed the same way; they just inherit `captured_at` of write-time, not closeout-time.

---

## 7. IrisHistorian — Cross-Project Sub-Agent

**Parallel to the Phase 2 specialists.** Sits alongside IrisDrafter, IrisMoneyAgent, IrisScheduleAgent, IrisCodeAgent. Routed by IrisRouter when the user's intent or the proactive trigger calls for historical context.

### 7.1 Service contract

```typescript
// src/services/iris/agents/historian.ts

interface IrisHistorianRequest {
  context: IrisContext;                   // From Context Fabric (Phase 1)
  trigger: 'milestone' | 'weekly_digest' | 'manual_query' | 'router_route';
  scope: {
    pattern_types?: PatternType[];        // Filter; default: all
    similar_projects_only?: boolean;      // Match by project_type + size
    timeframe_days?: number;              // Default: lifetime of tenant
  };
  query?: string;                         // Free-form for manual_query trigger
}

interface IrisHistorianResponse {
  alerts: HistorianAlert[];
  cited_patterns: PatternId[];
  cited_lessons: LessonId[];
  framing: 'historical_signal';           // ALWAYS this. NEVER 'prediction'.
  latency_ms: number;
}

interface HistorianAlert {
  alert_id: string;
  pattern_or_lesson_ref: { kind: 'pattern' | 'lesson', id: string };
  message: string;                        // Cites supporting projects by anonymized label
  severity: 'info' | 'warn' | 'critical';
  cta: { label: string, action: string }; // e.g., "Investigate MEP RFI count"
}
```

### 7.2 Example alerts (illustrative)

- *"On your last 3 hospital projects, MEP coordination RFIs spiked 30 days before substantial completion. Today is Day -32. Current MEP RFI count is 3. Median was 18. **Investigate.** [Source: Project A, Project B, Project C — see references]"*

- *"Your CO log on this project is at $412K. On 4 prior similar projects, median CO at this stage was $640K. **Within range.** [Source: Project D, Project E, Project F, Project G]"*

- *"Sub Acme Corp had a 60% submittal rejection rate on Tower 1 (Project H). Current submittal log on this project shows 3 from them ungraded. **Pre-flight before they sit in queue.**"*

- *"At 70% completion last project (Project I), the punch list spiked from 12 to 84 items in 2 weeks. Today is 71%. Punch list count is 18. Lessons from Walker (2026): 'we under-staffed QC on rough-in inspection.' **Confirm QC staffing.**"*

### 7.3 Always cite sources

Every alert must include:
- The supporting `pattern_id`s and `lesson_id`s.
- Anonymized project labels in the user-visible string ("Project A", "Project B").
- A click-to-reveal that maps anonymized labels back to project names (visible to users in the same tenant).

### 7.4 Always frame as historical signal, never prediction

The system prompt for the IrisHistorian sub-agent ends with the immutable directive:

> You are a historian. You report what your firm has observed before. You do NOT predict. Use phrases like "median was X," "in N prior projects," "your firm's history shows." NEVER use phrases like "this will happen," "expect," "forecast," or "predict."

This is enforced by the voice linter (per `IRIS_VOICE_GUIDE_SPEC`) with `historian_no_prediction.ts` rules: any output containing "will happen", "expect to see", "predict", "forecast" is auto-rejected and re-prompted.

### 7.5 Triggers

The IrisHistorian fires on:
- **Schedule milestones.** Project crosses `Day -90`, `Day -60`, `Day -30`, `Day -14` from substantial completion. Each milestone runs a HistorianQuery against patterns relevant to that lifecycle stage.
- **Weekly digest.** The Phase 4 ambient layer's weekly digest includes a "your firm's history" block from IrisHistorian.
- **Manual query.** PM clicks "What does my history say about this?" on any RFI / CO / submittal / schedule activity.
- **Router routing.** IrisRouter (Phase 2) detects intent that warrants historical context and delegates.

### 7.6 Latency budget

- **P50 ≤ 2s.** Pre-cached pattern lookups + lesson keyword match.
- **P95 ≤ 6s.** End-to-end including LLM synthesis of the alert message.
- **P99 ≤ 10s.** Allowable cold-start for milestone-trigger queries that haven't been pre-warmed.

---

## 8. Anonymization Layer

### 8.1 Within-tenant — anonymize for cognitive distance

Even within a single tenant, IrisHistorian outputs render supporting projects as "Project A," "Project B," "Project C" rather than their full names. The reason is **cognitive distance**: the PM reading the alert should focus on the pattern, not on whether they remember the personal politics of Project A. A click on "Project A" reveals the actual project name (and only to users with access to that project).

This is a UX pattern, not a permission boundary. RLS already enforces project-level access. The anonymization is for clarity, not isolation.

### 8.2 Cross-tenant — explicitly OUT OF SCOPE for Phase 6

No cross-tenant aggregation is exposed in Phase 6. Period. The `firm_memory_aggregates` matview joins only within `tenant_id`. The IrisHistorian queries only within `tenant_id`. The closeout extractor reads only within `tenant_id`.

Cross-tenant aggregation (industry benchmarks, "all hospital GCs in our system see X median CO"...) is **Phase 7+ work** and gated behind ADR-021. It requires:
- Differential-privacy noise injection on every aggregate.
- Tenant cohort size floor (minimum N=10 contributing tenants per query).
- Two-engineer review on every new cross-tenant query.
- Legal sign-off (counsel review for industry-data licensing implications).
- Explicit per-tenant opt-in via the pilot/customer agreement.

None of this is implemented in Phase 6.

### 8.3 Anonymization tests — 50-case suite

A test suite ships with the schema migration. 50 cases verify no PII leak from one project to another's surface within a tenant. Examples:

- Subcontractor names from Project A do not appear in IrisHistorian alerts surfaced on Project B unless the user has access to both projects.
- Owner names, owner-rep names, dollar values, and architect names follow the same rule.
- Lessons authored on Project A are surfaced on Project B only with author + project context shown, and only to users in the tenant.
- A test simulates "user in tenant T1 queries firm_memory" — the result set must contain zero rows from any other tenant.

The 50 cases are codified in `__tests__/iris/firm_memory.anonymization.test.ts`.

### 8.4 Nightly cross-project leak inspector

A cron job (`firm_memory_leak_inspector`, runs at 02:00 UTC daily) walks every IrisHistorian-rendered alert produced in the last 24 hours and verifies, for each alert, that:
1. All cited project IDs belong to the same tenant as the receiving user.
2. No alert string contains a verbatim non-tenant project name, sub name, or owner name (regex check against a per-tenant index of forbidden strings outside the user's project access).
3. The anonymized labels ("Project A," "Project B") map cleanly back to within-tenant project IDs.

If any check fails, the inspector:
- Writes a `cross_project_leak_event` row to the audit log.
- Pages Walker (post-cert: pages the on-call engineer).
- Auto-disables the IrisHistorian for the affected tenant pending review.

**The build fails if the inspector reports any leak.** This is enforced as a CI gate after Phase 6 ships (see § 11).

---

## 9. Two-Engineer Review on Cross-Tenant Aggregates

**Pre-cert (today through T-195):** No cross-tenant aggregates exist. No review needed because there's nothing to review. The schema, the extractor, and the IrisHistorian are all per-tenant only.

**Post-cert (Phase 7+):** Every new cross-firm aggregate query must pass:
- **Two-engineer review.** Both engineers sign off in the PR. The review checks: aggregate semantics, differential-privacy noise floor, cohort size floor, query construction (no JOINs that could leak per-tenant rows), and unit tests covering the leak surface.
- **Legal sign-off.** Counsel reviews the customer-facing language and the industry-data licensing posture before the query reaches production.
- **Per-tenant opt-in.** Every contributing tenant has explicitly opted in via their customer agreement. Tenants who have not opted in are excluded from the cohort entirely.

The process and template for cross-tenant review is documented in **ADR-021 — Cross-Project Memory Anonymization Protocol** (stub today; full document at Phase 7 open).

---

## 10. Eval / Acceptance

### 10.1 Goldens

- **30 closeout fixtures.** Each is a synthetic project (RFIs, COs, daily logs, schedule history, submittals) representative of a closed project. Each has a hand-graded "expected pattern extraction" output. The closeout extractor must match the expected output with ≥0.85 F1 on pattern_type identification, ≥0.80 on confidence_score within ±0.10.
- **20 historian alert fixtures.** Each is a synthetic ongoing project plus a tenant-history of patterns + lessons. Each fixture has a hand-graded expected outcome: "alert should fire" / "alert should not fire" / "alert should fire and cite [specific patterns]." The IrisHistorian must match: ≥0.90 fire/no-fire correctness; ≥0.85 citation correctness on fire cases.

### 10.2 Pilot validation

- **≥3 closed projects in firm_memory across the pilot cohort.** Until at least 3 projects close at pilot tenants, the IrisHistorian is feature-flagged off. Below 3 projects, the moat narrative is unprovable.
- **User-rated usefulness ≥60% on historian alerts.** Each fired alert has a "useful / not useful" thumbs in the UI. Aggregate ≥60% on the pilot cohort over the first 30 days post-launch is the gate.
- **No cross-project leak events** across the 30-day window after Phase 6 ships.

### 10.3 Acceptance gate (consolidated, see § 14)

| Criterion | Threshold |
|---|---|
| Closed projects in firm_memory across pilot | ≥3 |
| Historian alerts fired across pilot | ≥10 |
| User-rated usefulness on alerts | ≥60% |
| Anonymization inspector — consecutive clean days | ≥30 |
| Goldens F1 on closeout pattern extraction | ≥0.85 |
| Goldens correctness on historian fire/no-fire | ≥0.90 |

---

## 11. Telemetry

The IrisHistorian and closeout extractor write to the existing telemetry surface (per `IRIS_TELEMETRY_SPEC`), with new columns in `iris_sessions`:

```sql
ALTER TABLE iris_sessions
  ADD COLUMN historian_alert_id      UUID,
  ADD COLUMN historian_useful_rating TEXT CHECK (historian_useful_rating IN ('useful','not_useful','unrated')),
  ADD COLUMN cited_pattern_ids       UUID[] DEFAULT '{}',
  ADD COLUMN cited_lesson_ids        UUID[] DEFAULT '{}';
```

Aggregated metrics (matview, refreshed nightly):

| Metric | Definition |
|---|---|
| `firm_memory_patterns_count` | Active patterns per tenant per pattern_type |
| `lessons_count` | `firm_memory_lessons` rows per tenant |
| `historian_alerts_fired_total` | Total alerts fired per tenant per pattern_type per 30d |
| `historian_alert_useful_rate` | Fraction marked `useful` of those rated |
| `pattern_match_rate` | Per-pattern-type accuracy: pattern said X; later observed → match rate |
| `closeout_extractor_jobs_total` | Closeout extractor runs (success / fail / retry) |
| `cross_project_leak_events_total` | Should be 0; any non-zero is a P0 incident |

The **anonymization audit metric** is special: it's emitted by the nightly leak inspector (§ 8.4) and any non-zero count fails the build per the CI gate.

---

## 12. Test Plan

| Layer | Coverage |
|---|---|
| **Unit** | Each pattern extractor stage (RFI cluster, CO cluster, daily-log stats, schedule slip, photo time-delta, submittal rejection). Idempotency: re-running on closed project produces zero new rows. RLS: each table's policy verified against 6+ user/role combinations. |
| **Integration** | Closeout trigger → pgmq enqueue → worker → patterns written → IrisHistorian alert fires on next milestone trigger. End-to-end on a synthetic 12-month project. |
| **Anonymization** | 50-case suite (§ 8.3). Plus the automated nightly inspector (§ 8.4). |
| **Permission** | 30-case RLS suite. Each case asserts that user U in tenant T1, project P1 cannot see firm_memory rows for tenant T2 or for projects in T1 that U is not a member of. |
| **Long-running simulation** | Simulate a 12-month firm with 8 closed projects. Verify pattern accumulation (counts grow), pattern decay (`retired_at` set on superseded patterns), and lesson retention (5-year `retire_at`). Run on CI weekly; runtime budget 20 minutes. |
| **Voice linter** | `historian_no_prediction.ts` rule. 30 test cases of forbidden phrasing. 100% block rate required. |
| **Latency** | P95 IrisHistorian round-trip ≤ 6s on the goldens fixture set. |

---

## 13. Failure Modes

| Failure mode | Mitigation |
|---|---|
| **Pattern extractor produces noisy patterns.** Closeout on a single weird project floods firm_memory with low-signal rows. | `confidence_score ≥ 0.75` floor + `observation_count ≥ 2` gate (§ 5). Patterns that don't recur stay invisible until they recur. Goldens regression catches over-emission. |
| **IrisHistorian fires too eagerly.** Users dismiss alerts at high rate; trust collapses. | Per-pattern-type dismissal-rate auto-disable: if a pattern_type's dismissal rate exceeds 70% over 30 days, IrisHistorian stops firing on that pattern_type for that tenant. Logged. Walker reviewed. |
| **Anonymization mistake** — sub name from Project A leaks into alert on Project B. | Two-engineer review on every closeout-extractor change touching the alert-rendering path. Nightly inspector (§ 8.4). 50-case anonymization test suite. **A leak event is a reputation event.** Treat as P0 incident. |
| **"We've seen this before" wrong-but-confident.** Historian asserts a pattern that turns out to be wrong; PM relied on it. | Always frame as historical signal, never prediction (§ 7.4). Voice-linter enforced. UI labels alerts "your firm's history says…" not "you should…" Cited sources always visible. |
| **Pre-cert leak in pilot UX.** Demo accidentally surfaces firm_memory before audit-chain cert. | Feature flag `firm_memory_alpha`. Off for everyone except `walker@sitesyncai.com`. Flag check enforced at the IrisRouter level so the UI cannot accidentally render historian output. |
| **Procore feature-matches cross-project memory.** They ship a "remembers your last project" feature in Q4 2026 or Q1 2027. | The schema is the easy part; **the patterns are the moat.** Procore can ship the feature; they cannot ship 36 months of compounding tenant patterns. The launch narrative leans into this asymmetry: "our customers' fifth project runs smarter than their first because we've been compounding their data for 36 months." |
| **Cross-firm aggregate temptation.** Engineering or product proposes a quick "industry benchmark" feature. | ADR-021 hard-blocks until Phase 7 with the full review process. The ADR is the answer to every "can we just…" question. |
| **A pilot tenant invokes right-to-erasure mid-Phase-6.** Their lessons + patterns must come out without breaking the audit chain. | Lessons: anonymize `authored_by`, preserve content. Patterns: redact `supporting_project_ids` for that tenant's projects. Update extractor to skip those projects on re-runs. Audit chain extends with an erasure-event row, never broken. (Same pattern as ADR-008 GDPR routine.) |

---

## 14. Acceptance Gate

Phase 6 is **closed** when ALL of the following are true (CI workflow `phase-6-acceptance.yml`, mirroring `lap-2-acceptance.yml`):

1. **≥3 closed projects in firm_memory across pilot cohort.** Verified by query against `firm_memory_patterns.supporting_project_ids` distinct count where tenant_id is in pilot.
2. **≥10 historian alerts fired across pilot cohort, ≥60% rated useful.** Verified by `historian_alerts_fired_total` and `historian_alert_useful_rate` aggregated over 30-day window.
3. **Anonymization inspector clean for ≥30 consecutive days.** Verified by `cross_project_leak_events_total = 0` over the window.
4. **Goldens regression clean.** 30 closeout + 20 historian fixtures pass at the thresholds in § 10.1.
5. **Latency budget met.** IrisHistorian P95 ≤ 6s over 14 consecutive days.
6. **T-0 launch narrative demonstrably true.** Walker can show, on a recorded demo to the audit firm + investor cohort, a pilot tenant's IrisHistorian firing a useful alert grounded in ≥3 prior projects' compounded data.

---

## 15. Cross-References

**Depends on (must be shipped before Phase 6 opens):**
- **Phase 0** (citations) — IrisHistorian alerts cite specific patterns and lessons as sources; the citation side panel is the surface.
- **Phase 1** (Context Fabric) — IrisHistorian reads `IrisContext.who.tenant_id` and `IrisContext.where.project_id` from the fabric.
- **Phase 2** (specialist sub-agent pattern + IrisRouter) — IrisHistorian is a Phase-2-pattern specialist sub-agent, parallel to Drafter/Money/Schedule/Code.
- **Phase 3** (pgvector + ingestion) — closeout extractor reads project KB chunks for RFI/CO clustering signal.
- **Phase 4** (insights table + ambient layer) — IrisHistorian alerts plumb through the same `iris_insights` rendering as Phase-4 per-page insights.
- **T-195 audit-chain certification** — non-negotiable. Phase 6 cannot open until this ships.

**Inputs to:**
- **Phase 7** (cross-firm aggregates with full anonymization protocol) — Phase 6 establishes the per-tenant pattern store; Phase 7 layers cross-tenant queries on top under ADR-021.
- **T-0 launch narrative** — "the only PM platform that gets smarter with every project."
- **Sales / marketing T-180 → T-150** — battlecards lean on the moat.

**ADRs created by this spec:**
- **ADR-021 — Cross-Project Memory Anonymization Protocol.** Stub at Phase 6 open; full document at Phase 7 open. Companion to ADR-006 (data isolation) and ADR-008 (retention).

---

## 16. Day-by-Day Breakdown (~30 days, Lap 6)

Per Lap-3-tracker-style format. Days are sequential engineer-days; calendar slip allowed.

| Day | Title | Deliverable |
|---|---|---|
| 1 | Schema migration: `firm_memory_patterns` | DDL shipped, RLS verified, 30-case permission suite green |
| 2 | Schema migration: `firm_memory_lessons` | DDL shipped, INSERT policy on PM/super/owner_rep only |
| 3 | Schema migration: `firm_memory_aggregates` matview + cron | Refresh runs nightly, percentiles stable |
| 4 | Closeout extractor — RFI cluster stage | Unit tests + 5 closeout fixtures pass on RFI clusters |
| 5 | Closeout extractor — CO cluster stage | Unit tests + 5 closeout fixtures pass on CO clusters |
| 6 | Closeout extractor — daily-log + schedule slip stages | 5 closeout fixtures pass on slip patterns |
| 7 | Closeout extractor — photo time-delta + submittal rejection | Last 5 closeout fixtures pass; F1 ≥ 0.85 on pattern-type ID |
| 8 | Closeout extractor — idempotency guarantee + payload_hash | Long-running test: re-run on same project produces zero net rows |
| 9 | pgmq queue + worker plumbing | Edge fn `firm-memory-closeout-worker` deployed, ADR-003 pattern |
| 10 | Lessons-learned UX — capture form | 10-question structured prompt, severity + tags, draft → save |
| 11 | Lessons-learned UX — author + project context display | Lesson card renders with author, project, captured_at |
| 12 | IrisHistorian sub-agent — service skeleton | `services/iris/agents/historian.ts` + Router integration |
| 13 | IrisHistorian — milestone trigger | Day -90 / -60 / -30 / -14 schedule milestones fire historian queries |
| 14 | IrisHistorian — manual_query trigger | "What does my history say?" button on RFI/CO/submittal pages |
| 15 | IrisHistorian — weekly digest integration | Phase-4 ambient layer's weekly digest includes historian block |
| 16 | IrisHistorian — alert message synthesis (LLM) | Voice-linter `historian_no_prediction.ts` rule + 30 test cases |
| 17 | IrisHistorian — citations to patterns + lessons | Side-panel renders cited pattern/lesson with source projects (anonymized) |
| 18 | Anonymization layer — within-tenant project labels | "Project A/B/C" rendering; click-to-reveal mapped to tenant access |
| 19 | Anonymization tests — 50-case suite | All 50 pass; CI gate added |
| 20 | Cross-project leak inspector — nightly cron | `firm_memory_leak_inspector` deployed; pages on any leak |
| 21 | Goldens — 30 closeout fixtures | F1 ≥ 0.85 on pattern_type ID; confidence within ±0.10 |
| 22 | Goldens — 20 historian alert fixtures | ≥0.90 fire/no-fire correctness; ≥0.85 citation correctness |
| 23 | Telemetry columns + matview | `iris_sessions` extended; aggregated metrics matview |
| 24 | Feature flag `firm_memory_alpha` + Phase-6 acceptance CI | `phase-6-acceptance.yml` workflow; flag default OFF |
| 25 | Long-running simulation — 12-month synthetic firm, 8 closed projects | Pattern accumulation + decay verified; 20-min CI runtime |
| 26 | Latency optimization — P95 ≤ 6s end-to-end | Pre-warm pattern caches; batched lookups; LLM call budget |
| 27 | Pilot rollout — Walker's dev account first, then Brad Cameron at Nexus | feature flag flipped on, 1 closed project in firm_memory |
| 28 | Pilot rollout — second pilot tenant + Carleton | 2nd, 3rd closed projects extracted |
| 29 | 30-day acceptance window opens — alerts fire, ratings collected | First historian alerts in production |
| 30 | Phase 6 acceptance review — gate criteria checked | If all 6 gates green: Phase 6 closed. ADR-021 stub committed for Phase 7. |

**Calendar window: Mar–Apr 2027.** **Strict prerequisite: T-195 audit-chain certification (Oct 15 2026) closed.**

---

## 17. Risks Specific to Phase 6

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Pre-cert leak in pilot UX.** A demo or accidental flag flip surfaces firm_memory features before audit-chain cert. | Low | Strategic blow — gives Procore the spec | Feature flag `firm_memory_alpha` enforced at IrisRouter. Flag is OFF for every non-Walker account. CI test asserts the flag is OFF in production config until Phase 6 opens. |
| 2 | **Procore feature-matches cross-project memory in their copilot.** They announce "remembers your last project" at Groundbreak 2026 (T-165, Nov 2026). | Medium | Narrative parity claim | The schema is the easy part; the patterns are the moat. Ship 36 months of compounding patterns in pilot tenants' data; the asymmetry is unphotocopiable. T-180 → T-150 marketing leans into "we've been compounding for 36 months." |
| 3 | **Cross-firm aggregate temptation.** Engineering or product proposes a quick "industry benchmark" feature mid-Phase-6. | Medium | Privacy / legal exposure | ADR-021 hard-blocks. Process documented; "no" is a one-line response. Phase 7+ only. |
| 4 | **Pilot tenant doesn't close 3 projects in time for acceptance gate.** Lap 6 opens with only 1–2 closed projects. | Medium | Acceptance gate misses; launch narrative un-provable | Recruit a third pilot during Phase 5 specifically for "we have a project closing in March 2027." Soft-pilot playbook update. |
| 5 | **Schema mistake in Phase 6 — patterns extracted under wrong shape; can't re-extract from already-closed projects.** | Low | Permanent data loss | This spec exists 10 months early specifically to give engineering, legal, and audit cohorts the schema for review. Validate before any extractor code lands. |
| 6 | **Anonymization mistake — verbal sub name leaks across project boundary in alert text.** | Low | Reputation event | Two-engineer review on alert-rendering path. Nightly inspector. 50-case test suite. **Treat any leak as P0 incident.** |
| 7 | **Historian fires too eagerly — pilot rates alerts useful <60%.** | Medium | Acceptance gate misses | Per-pattern-type dismissal-rate auto-disable. Goldens-driven calibration. Voice-linter enforces "historical signal" framing. |
| 8 | **Lessons capture has zero adoption — PMs skip the 10-question script.** | Medium | Lessons store stays empty; pattern store is sole source | Heavy nudge in closeout flow + small reward (the next project's IrisHistorian feels noticeably smarter when lessons exist). Track capture rate; aim ≥60% of closed projects have ≥1 lesson. |

---

*End of spec. Phase 6 builds in Lap 6. Lead with the moat. Don't telegraph.*
