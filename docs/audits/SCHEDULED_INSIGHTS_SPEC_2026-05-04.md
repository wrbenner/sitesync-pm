# Scheduled Insights Spec — Lap 2 Days 31–35

**Date:** 2026-05-04
**Status:** Spec ready. Includes ADR-003 (cron tech) inline. Blocks Lap 2 Week 5.
**Companion:** `IRIS_TELEMETRY_SPEC_2026-05-04.md` (telemetry must land first), `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` (this spec produces the drafts the gate measures).
**Format reference:** `MONEY_CENTS_AUDIT_2026-05-01.md`.

---

## TL;DR

Today: 5 insight detectors compute deterministic insights from project data (`src/services/iris/insights.ts`). They never call `draftAction()`. Drafts only exist when a user manually triggers them.

Lap 2 Week 5 turns this around: a hybrid cron pipeline runs every 15 minutes per project, computes insights, promotes the high-confidence ones to `drafted_actions`, and lets the existing approval gate take over. The user opens the inbox in the morning and finds 3 drafts that arrived overnight.

This spec covers: the cron architecture (ADR-003), per-project fan-out, rate-limiting on the iris-call chokepoint, promotion criteria, idempotency, withdraw-on-state-change, and detector ordering.

---

## ADR-003 — Cron Architecture

**Decision:** Three-tier hybrid: **pg_cron heartbeat → pgmq queue → edge function workers (short jobs) + external workers (long/heavy)**.

### The three tiers

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1 — pg_cron heartbeat                                     │
│  Wakes the system on a schedule. Does no actual work.           │
│  Just enqueues "check insights for project X" jobs.             │
│  Runs in-DB; transactional; no external dependencies.           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ enqueues
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2 — pgmq queue                                            │
│  Postgres-native message queue. Survives restarts.              │
│  Each job has a project_id + detector_kind + scheduled_for.     │
│  Visible in DB; debuggable with SQL.                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ workers pull from
                           ▼
┌──────────────────────────────────┬──────────────────────────────┐
│  TIER 3a — Edge function workers │  TIER 3b — External workers  │
│  ─────────────────────────────── │  ──────────────────────────  │
│  Short jobs (< 30s).             │  Long, heavy, mission-       │
│  Detector compute + draft        │  critical jobs (> 30s).      │
│  promotion + withdraw checks.    │  Post-pilot: PDF generation, │
│  Stateless; horizontal scale.    │  large data exports,         │
│  60s edge-fn timeout — well       │  Procore importer worker.   │
│  inside.                         │  Render/Fly worker process.  │
│                                  │  In Lap 2: optional (no       │
│  Lap 2 uses ONLY 3a.             │  long jobs yet).             │
└──────────────────────────────────┴──────────────────────────────┘
```

### Why this and not alternatives

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Pure pg_cron (no queue, fn called inline) | Simplest. Atomic with DB. | pg_cron blocks. 100 projects × 5 detectors = 500 sequential calls per tick = 25-min runtime in 15-min window = drift-into-failure. | Rejected |
| Pure Supabase scheduled fns | Native to platform. | No queueing semantics. Retry on failure = manual. No visibility into backlog. | Rejected |
| External pinger only (Render/Vercel cron) | Vendor-portable. | Adds external dependency. Ping → API → DB round-trips. Loses transactional atomicity. | Rejected as primary; kept as Tier 3b for the long-haul jobs |
| **Hybrid (chosen)** | Heartbeat is reliable + transactional. Queue gives backlog visibility + retry semantics. Edge fns scale horizontally for short work. External workers exist for the day we need them. | More moving parts. | **Chosen.** Each piece does one job well; failure modes are isolated. |

### Why pgmq (not pg-boss, not Redis, not SQS)

- *In-DB.* Same Postgres instance; no second backing store; consistent backups.
- *Visible.* `SELECT * FROM pgmq.q_insights;` shows the queue state.
- *Already in Supabase ecosystem.* No new vendor relationship.
- *Survives restarts.* Postgres durability == queue durability.

If Lap 3 or later needs cross-DB coordination, swap pgmq → SQS without changing the producer/consumer contracts.

### What's locked vs. tunable

**Locked:** Three-tier architecture. pg_cron as heartbeat. pgmq as queue. Edge functions as Tier 3a workers. External workers (Tier 3b) provisioned but optional in Lap 2.

**Tunable:** Heartbeat interval (15 min default; can drop to 5 min if backlog stays empty), worker concurrency (1 edge-fn worker per detector kind in Lap 2; can shard by project_id_hash later), queue max age before alerting (1 hour default).

### Rollback plan

If the hybrid fails in pilot: fall back to pg_cron-only, fired at 06:00 local for each pilot project, calling the detectors inline. Loses parallelism but preserves correctness. Document in receipt; do NOT skip the gate to avoid documenting.

---

## Phase 1 — Heartbeat (pg_cron)

### Migration

```sql
-- Migration: 20260504020000_scheduled_insights_heartbeat.sql

-- Enable pg_cron and pgmq if not already.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- The queue.
SELECT pgmq.create('insights_jobs');

-- Heartbeat: every 15 min, enqueue one job per active pilot project per detector.
-- We start with pilot projects only. Expanding to "all projects" is a Lap 3
-- change tied to the cost model.
CREATE OR REPLACE FUNCTION enqueue_insights_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_project_id UUID;
  v_detector TEXT;
BEGIN
  -- One job per (pilot_project, detector_kind).
  FOR v_project_id IN
    SELECT p.id
      FROM projects p
      JOIN organizations o ON o.id = p.organization_id
      WHERE o.is_soft_pilot = TRUE  -- column added by SOFT_PILOT_PLAYBOOK migration
        AND p.status = 'active'
  LOOP
    FOR v_detector IN
      VALUES ('cascade'), ('aging'), ('variance'), ('staffing'), ('weather')
    LOOP
      PERFORM pgmq.send(
        'insights_jobs',
        jsonb_build_object(
          'project_id', v_project_id,
          'detector_kind', v_detector,
          'scheduled_for', NOW(),
          'attempt', 1
        )
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Schedule: every 15 min. Aligned to :00, :15, :30, :45.
SELECT cron.schedule(
  'insights-heartbeat',
  '*/15 * * * *',
  $$SELECT enqueue_insights_jobs();$$
);
```

### Why per-(project × detector) and not per-project

A failed cascade detector for project X shouldn't block aging for the same project. Per-(project × detector) queue items isolate failures. The fan-out for a single pilot org with one project is 5 jobs every 15 min = 20 jobs/hour = 480/day. Trivial load on pgmq.

For 100 GCs × 3 projects × 5 detectors × 4 ticks/hr = 6,000 jobs/hr — also fine for pgmq, but worth re-measuring before opening Lap 3 broadly.

---

## Phase 2 — Worker (edge function)

### New edge function: `supabase/functions/scheduled-insights-worker/`

A stateless worker that pulls one job from the queue, runs the detector, decides whether to promote, and writes (or doesn't) to `drafted_actions`. Triggered by an external pinger or by a `pg_cron`-driven HTTP call (configurable; we'll start with the latter).

### Skeleton

```ts
// supabase/functions/scheduled-insights-worker/index.ts
import { authenticateCron, errorResponse } from '../shared/auth.ts'
import { runDetector } from './detectors.ts'
import { promoteIfEligible } from './promote.ts'
import { withdrawStaleDrafts } from './withdraw.ts'

Deno.serve(async (req) => {
  const supabase = authenticateCron(req)  // existing CRON_SECRET pattern
  if (!supabase) return errorResponse('unauthorized', 401)

  // Pull up to N jobs at once. N=10 is a safe starting concurrency for Lap 2.
  const { data: jobs } = await supabase.rpc('pgmq_read', {
    queue_name: 'insights_jobs',
    vt: 60,    // visibility timeout: 60s before another worker can grab it
    qty: 10,
  })

  if (!jobs?.length) return new Response('no jobs', { status: 200 })

  const results = await Promise.allSettled(jobs.map(processJob))

  // Ack succeeded; return failed to the queue with backoff.
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const result = results[i]
    if (result.status === 'fulfilled') {
      await supabase.rpc('pgmq_delete', { queue_name: 'insights_jobs', msg_id: job.msg_id })
    } else {
      // pgmq automatically re-queues after vt expires.
      // Increment attempt; abandon after attempt > 3.
      const attempt = (job.message.attempt ?? 1) + 1
      if (attempt > 3) {
        await logAbandonedJob(supabase, job, result.reason)
        await supabase.rpc('pgmq_archive', { queue_name: 'insights_jobs', msg_id: job.msg_id })
      } else {
        await supabase.rpc('pgmq_set_vt', {
          queue_name: 'insights_jobs',
          msg_id: job.msg_id,
          vt: Math.min(900, 60 * 2 ** attempt),  // exponential backoff to 15 min
        })
      }
    }
  }

  return Response.json({ processed: jobs.length, succeeded: results.filter(r => r.status === 'fulfilled').length })
})

async function processJob(job: any) {
  const { project_id, detector_kind } = job.message
  // 1. Run the detector. Pure function, no side effects yet.
  const insights = await runDetector(detector_kind, project_id)
  // 2. For each high-confidence insight, check eligibility + promote.
  for (const insight of insights) {
    await promoteIfEligible(insight, project_id)
  }
  // 3. Withdraw any drafts whose underlying state has shifted.
  await withdrawStaleDrafts(project_id, detector_kind)
}
```

### Why pull-N-at-once

Edge functions are billed per-invocation. Pulling 10 jobs per invocation is 10× more efficient than 1-job-per-invocation. The 60s timeout is the ceiling: 10 jobs × 5s budget each = 50s, leaves 10s slack.

If 10 jobs × 5s isn't enough as detectors get richer, drop to 5 jobs and double the worker concurrency by hitting the worker URL twice from pg_cron.

---

## Phase 3 — Promotion criteria

A computed insight becomes a `drafted_action` if and only if **all** of the following hold:

```
∧  insight.severity ∈ {'high', 'critical'}
∧  insight.confidence ≥ 0.7
∧  no drafted_action exists with same (kind, primary_entity_id, project_id) created in the last 24h
∧  the underlying entity is still in a state where the action makes sense
       (e.g., RFI is still 'open'; not already 'answered')
∧  the project has not exceeded its daily draft budget (default: 50 drafts/day, soft-fail logged)
∧  no audit incident is currently open at severity ≥ 'high'
       (drafts are paused project-wide while we triage)
```

### Why these specific gates

- **Severity floor.** "Medium" insights are interesting but not actionable; surfacing them as drafts trains the user to ignore drafts. Lap 3 may add a "low-confidence inbox" — Lap 2 stays disciplined.
- **0.7 confidence.** Below 0.7, the insight is more often wrong than right; rejecting drafts erodes trust faster than missing them does.
- **24h dedupe.** A user who rejected an "RFI cascade" draft for RFI #42 yesterday should not be re-asked today. The 24h window resets the next morning, which matches the daily-rhythm of construction PM work.
- **Underlying-state check.** Prevents stale drafts (the "Iris is asking me about an RFI I already answered" failure mode that would tank trust).
- **Per-project daily cap.** Stops a runaway detector from filling the inbox with 200 drafts.
- **Pause-on-incident.** If the audit chain has an integrity issue, we stop creating new chained rows until it's resolved.

### Promotion implementation

New file: `supabase/functions/scheduled-insights-worker/promote.ts`. Idempotent SQL-side check via the dedupe index defined below.

```sql
-- Migration: 20260504020001_drafted_action_dedupe.sql
CREATE TABLE drafted_action_dedupe (
  -- Composite key prevents duplicate drafts within the dedupe window
  insight_kind     TEXT NOT NULL,
  primary_entity_id UUID NOT NULL,
  project_id        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  drafted_action_id UUID REFERENCES drafted_actions(id) ON DELETE CASCADE,
  PRIMARY KEY (insight_kind, primary_entity_id, project_id, created_at)
);

CREATE INDEX idx_drafted_action_dedupe_lookup
  ON drafted_action_dedupe(insight_kind, primary_entity_id, project_id)
  WHERE created_at > NOW() - INTERVAL '24 hours';

-- The promotion RPC is idempotent: returns existing draft if one exists in window.
CREATE OR REPLACE FUNCTION promote_insight_to_draft(
  p_insight JSONB,
  p_project_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_draft_id UUID;
  v_new_draft_id UUID;
BEGIN
  -- Dedupe lookup.
  SELECT drafted_action_id INTO v_existing_draft_id
    FROM drafted_action_dedupe
    WHERE insight_kind = p_insight->>'kind'
      AND primary_entity_id = (p_insight->>'primaryEntityId')::UUID
      AND project_id = p_project_id
      AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT 1;

  IF v_existing_draft_id IS NOT NULL THEN
    RETURN v_existing_draft_id;  -- dedupe hit; do nothing
  END IF;

  -- Insert into drafted_actions; insert dedupe row in same txn.
  INSERT INTO drafted_actions (
    project_id, action_type, title, summary, payload,
    citations, confidence, drafted_by, draft_reason
  ) VALUES (
    p_project_id,
    (p_insight->>'actionType')::TEXT,
    p_insight->>'title',
    p_insight->>'summary',
    p_insight->'payload',
    p_insight->'citations',
    (p_insight->>'confidence')::NUMERIC,
    'iris-scheduled-insights',
    p_insight->>'reason'
  ) RETURNING id INTO v_new_draft_id;

  INSERT INTO drafted_action_dedupe (
    insight_kind, primary_entity_id, project_id, drafted_action_id
  ) VALUES (
    p_insight->>'kind',
    (p_insight->>'primaryEntityId')::UUID,
    p_project_id,
    v_new_draft_id
  );

  RETURN v_new_draft_id;
END;
$$;
```

---

## Phase 4 — Withdraw on state change

Drafts go stale fast in construction. If the cron drafts an "RFI follow-up" at 8 AM and the architect responds at 9 AM, the draft is moot by 10 AM when the user sees it.

### Withdraw rule

For each detector kind, define the "still-relevant" predicate:

| Detector | Withdraw if... |
|---|---|
| cascade | The underlying RFI moved out of `'open'` |
| aging | The aging entity moved out of its aged state (RFI answered, daily log filed, submittal stamped) |
| variance | The variance was reconciled (budget item updated, schedule re-baselined) |
| staffing | The staffing gap was closed (crew assigned, headcount updated) |
| weather | The weather window passed (forecast date is now in the past with no action) |

### Implementation

In each worker invocation, after running the detector + promotion, scan the open drafts for that (project, detector) and check the still-relevant predicate. If false → call `withdrawDraft()` (already exists in `src/services/iris/draftAction.ts`).

```ts
// supabase/functions/scheduled-insights-worker/withdraw.ts
export async function withdrawStaleDrafts(projectId: string, detector: string) {
  const { data: openDrafts } = await supabase
    .from('drafted_actions')
    .select('id, related_resource_id, action_type')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .eq('drafted_by', 'iris-scheduled-insights')
    .filter('payload->>insightKind', 'eq', detector)

  for (const draft of openDrafts ?? []) {
    if (await isStillRelevant(draft, detector) === false) {
      await supabase.rpc('withdraw_draft', {
        p_draft_id: draft.id,
        p_reason: `state-change: ${detector} no longer applies`,
      })
    }
  }
}
```

`isStillRelevant` queries the underlying entity table; small per-detector function.

---

## Phase 5 — Detector ordering and budget

### Order of activation

Days 31–35 of Lap 2 each ship one detector wired through the full pipeline:

1. **Day 31** — Aging (simplest, highest volume). RFIs aged > 5 days drafted as a follow-up. Pure SQL over `rfis.due_date`.
2. **Day 32** — Cascade (highest value, most complex). Phase X delays trigger downstream activity drafts. Joins `schedule_phases` × `rfis` × `submittals`.
3. **Day 33** — Variance. Budget actuals vs. estimate; weekly snapshot triggers a draft if variance exceeds threshold.
4. **Day 34** — Staffing. Required-hours-today vs. crew-size mismatch.
5. **Day 35** — Weather. Outdoor activity scheduled into a precip forecast.

Order rationale: aging first because it produces dependable volume and lets us tune the inbox UX on a fast feedback loop. Cascade is the wow-factor demo but the gnarliest to QA. Weather last because the forecast API is its own dependency and adds a failure mode we don't want compounding with the others.

### Per-project rate limit

Default: 50 drafts/day/project. Above this, the worker logs `audit_incidents` (severity='medium', category='budget_exceeded') and stops promoting until midnight UTC. Tunable per project via `projects.max_drafts_per_day` column (added in this migration; default 50).

### LLM call budget

The detectors above are *deterministic* (no LLM call). They produce structured insight objects. The LLM call happens during promotion when we ask iris-call to write the actual draft prose (RFI follow-up text, daily log narrative, etc.).

Budget: 1 LLM call per promoted insight. With 50 drafts/day/project cap and 1 pilot project = 50 calls/day = ~$5/day at current Claude pricing. Trivial during pilot. Re-budget at Lap 3 broad rollout.

---

## Phase 6 — Observability

### What goes into the dashboard (queries below; UI is whatever we have time for)

```sql
-- Job throughput last hour
SELECT
  message->>'detector_kind' AS detector,
  COUNT(*) AS jobs_processed
FROM pgmq.q_insights
WHERE archived_at > NOW() - INTERVAL '1 hour'
GROUP BY 1;

-- Backlog
SELECT COUNT(*) FROM pgmq.q_insights;

-- Promotion rate (insights computed → drafts created)
SELECT
  detector_kind,
  COUNT(*) FILTER (WHERE was_promoted) AS promoted,
  COUNT(*) AS computed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE was_promoted) / COUNT(*), 1) AS pct
FROM scheduled_insights_log
WHERE computed_at > NOW() - INTERVAL '24 hours'
GROUP BY 1;
```

`scheduled_insights_log` is a new table (this migration) that records every detector run — useful for diagnostics, retention 30 days.

### Alerts

- Backlog > 100 jobs for > 30 min → page Walker
- Job failure rate > 20% over 1 hour → page Walker
- LLM call latency p95 > 8s → log warning (the iris-call chokepoint may be saturated)
- audit_incidents row inserted → slack notification + page if severity ≥ 'high'

---

## Test plan

### Unit (Vitest)

- Each detector returns the expected `IrisInsight[]` for a hand-crafted project state
- `promote_insight_to_draft` RPC is idempotent: 5 calls within 24h with same input → 1 row in `drafted_actions`, 1 row in `drafted_action_dedupe`
- `isStillRelevant` returns false when the underlying entity moved past the trigger state
- Worker exponential backoff: attempts 1, 2, 3 produce vt of 120, 240, 480 seconds

### Integration (Postgres)

- pg_cron heartbeat enqueues exactly 5 jobs per active pilot project per tick
- A poison-pill job (one that throws on `runDetector`) is abandoned after 3 attempts and lands in the archive
- A draft promoted at T1 is auto-withdrawn at T2 when the underlying RFI status changes
- Per-project daily cap actually halts promotion after 50 drafts

### E2E (Playwright + staging)

- Seed a project with an RFI 6 days overdue → wait 16 min → assert a "follow-up" draft appears in the inbox
- Seed the same RFI but mark it answered before the cron tick → assert no draft is created
- Seed an open draft, then update the RFI status to 'answered' → wait 16 min → assert draft is withdrawn

### Gate dry-run (load)

- Synthetic load: 100 projects × 5 detectors over 1 hour = 2,000 jobs. Measure p95 worker latency. Expected < 8s. If higher, increase worker concurrency.

---

## File-by-file changelog

| Path | Change |
|---|---|
| `supabase/migrations/20260504020000_scheduled_insights_heartbeat.sql` | NEW — pg_cron + pgmq + heartbeat fn |
| `supabase/migrations/20260504020001_drafted_action_dedupe.sql` | NEW — dedupe table + promote RPC |
| `supabase/migrations/20260504020002_scheduled_insights_log.sql` | NEW — observability log table + retention policy |
| `supabase/functions/scheduled-insights-worker/index.ts` | NEW — worker entry |
| `supabase/functions/scheduled-insights-worker/detectors.ts` | NEW — adapter that calls into existing `src/services/iris/insights.ts` from Deno |
| `supabase/functions/scheduled-insights-worker/promote.ts` | NEW — eligibility + RPC call |
| `supabase/functions/scheduled-insights-worker/withdraw.ts` | NEW — stale-draft sweep |
| `supabase/functions/scheduled-insights-worker/predicates.ts` | NEW — "still relevant" per detector |
| `src/services/iris/insights.ts` | EDIT — extract detector-callable adapter so Deno worker can re-use the code |
| `e2e/scheduled-insights.spec.ts` | NEW — E2E tests above |
| `docs/audits/INDEX.md` | EDIT — add this spec + ADR-003 |

---

## Acceptance criteria for this spec to be considered "shipped"

1. All four migrations apply cleanly to staging
2. pg_cron + pgmq extensions enabled in production
3. Worker edge function deployed
4. The 3 integration tests + 3 E2E tests pass
5. Synthetic load test passes (p95 < 8s at 2,000 jobs/hour)
6. Aging detector is end-to-end live in pilot environment
7. ADR-003 committed
8. Backlog dashboard query reproduces a sensible result on staging

---

## Day-by-day mapping to the tracker

| Tracker day | What ships |
|---|---|
| Day 31 | Migrations applied; heartbeat live; worker scaffold; **aging** detector promoting drafts |
| Day 32 | **Cascade** detector wired |
| Day 33 | **Variance** detector wired |
| Day 34 | E2E test (planted RFI > 5 days → draft in inbox in < 16 min) passes |
| Day 35 | FRIDAY: Walker reviews 30 drafts; rates 1–5; drives Day 36 prompt-tuning work |

---

## What this spec deliberately does NOT cover

- The text generation step that turns a structured insight into PM-readable draft prose. This is the existing `templates.ts` + iris-call call path; this spec consumes it but doesn't redesign it. Voice work in `IRIS_VOICE_GUIDE_SPEC` shapes the output.
- The citations attached to each draft. `IRIS_CITATIONS_SPEC` covers the rendering and resolver; this spec just attaches them to the payload.
- The user-facing "I want fewer of these" preference UI. Lap 3.
- Long-running detectors that need Tier 3b (external workers). All Lap 2 detectors are short.
- Multi-tenancy beyond pilot. We only fan out to `is_soft_pilot=TRUE` orgs in Lap 2.
