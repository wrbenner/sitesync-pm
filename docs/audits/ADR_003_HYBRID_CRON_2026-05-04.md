# ADR-003 — Hybrid Cron Architecture for Scheduled Insights

**Status:** Accepted
**Date:** 2026-05-04
**Supersedes:** None
**Companion to:** `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` (this ADR was inline; promoted to standalone for citation by future specs)
**Implementation:**
- `supabase/migrations/20260504020000_scheduled_insights_heartbeat.sql`
- `supabase/migrations/20260504020001_drafted_action_dedupe.sql`
- `supabase/migrations/20260504020002_scheduled_insights_log.sql`
- `supabase/functions/scheduled-insights-worker/index.ts`

## Context

The Lap 2 promise: a user opens the Iris inbox in the morning and finds 3 well-cited drafts that arrived overnight. That requires 5 detector kinds running every 15 minutes per pilot project, with backlog visibility, retry semantics, idempotency, and graceful degradation under failure.

Three architectural shapes were on the table.

## Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Pure pg_cron, inline call** | Simplest. Atomic with DB. | pg_cron blocks the worker. 100 projects × 5 detectors = 500 sequential calls per tick = 25-min runtime in 15-min window. Drift-into-failure under load. | Rejected |
| **Pure Supabase Scheduled Functions** | Native to platform. | No queueing. Retry on failure is manual. No backlog visibility. No way to ack-then-process distinct from invoke. | Rejected |
| **External pinger (Render/Vercel cron) only** | Vendor-portable. | Adds an external dependency. Ping → API → DB round-trip. Loses transactional atomicity. Blast radius if the pinger fails. | Rejected as primary |
| **Hybrid: pg_cron + pgmq + edge fns** | Heartbeat is reliable + transactional. Queue gives backlog + retry semantics. Edge fns scale horizontally. External workers exist for the day we need them (Tier 3b). | More moving parts. New extension dependency (pgmq). | **Accepted** |

## Decision

**Three-tier hybrid:**

```
┌────────────────────────────────────────────────────────────────────┐
│  TIER 1 — pg_cron heartbeat                                        │
│  Wakes the system. Does no work itself. Enqueues N jobs every 15m. │
│  In-DB; transactional; no external deps.                           │
│  Implementation: enqueue_insights_jobs() + cron.schedule.          │
└──────────────────────────┬─────────────────────────────────────────┘
                           ▼ enqueues into
┌────────────────────────────────────────────────────────────────────┐
│  TIER 2 — pgmq queue (insights_jobs)                               │
│  Each job: { project_id, detector_kind, scheduled_for, attempt }.  │
│  Postgres-native; survives restarts; debuggable with SQL.          │
└──────────────────────────┬─────────────────────────────────────────┘
                           ▼ workers pull from
┌────────────────────────────────────┬───────────────────────────────┐
│ TIER 3a — Edge function workers    │ TIER 3b — External workers    │
│ ──────────────────────────────────│ ──────────────────────────────│
│ Short jobs (< 30s).                │ Long, heavy jobs.             │
│ Detectors + promotion + withdraw.  │ NOT used in Lap 2.            │
│ 60s timeout; pull-N-at-once.       │ Reserved for Lap 3 (PDF gen,  │
│ Stateless; horizontally scalable.  │ Procore importer, etc.).      │
└────────────────────────────────────┴───────────────────────────────┘
```

## Why pgmq specifically

- **In-DB.** Same Postgres instance — backups, snapshots, and disaster-recovery already cover the queue. No second backing store to operate.
- **Visible.** `SELECT * FROM pgmq.q_insights_jobs;` shows the live queue state. Diagnostics are SQL queries.
- **Already in the Supabase ecosystem.** No new vendor relationship; no new auth model.
- **Survives restarts.** Postgres durability == queue durability.
- **Portable.** The producer/consumer contract (jsonb message; visibility timeout; ack/archive) is the same shape SQS exposes. If Lap 3+ needs cross-DB coordination, swap to SQS without touching the heartbeat or the worker.

## What's locked, what's tunable

**Locked:**
- Three-tier shape.
- pg_cron as heartbeat.
- pgmq as queue.
- Edge functions as Tier 3a workers.
- Tier 3b reserved but unused in Lap 2.
- Per-(project × detector) job grain. Failure isolation lives at this grain — a broken cascade detector for project X must not block aging for the same project.

**Tunable:**
- Heartbeat interval — 15 min default; can drop to 5 min if the backlog stays empty.
- Worker invoke interval — 5 min default (more frequent than heartbeat so jobs are picked up shortly after enqueue).
- Worker batch size — 10 jobs/invocation default (`SCHEDULED_INSIGHTS_BATCH` env).
- Visibility timeout — 60s default (`SCHEDULED_INSIGHTS_VT` env).
- Backoff schedule — 2^attempt minutes, capped at 15 min.
- Max attempts — 3, then archive + abandon.
- Per-project daily cap — `projects.max_drafts_per_day` (default 50).

## Failure modes & rollback

| Failure | Detection | Mitigation |
|---|---|---|
| pg_cron not installed | Migration NOTICE on apply | Heartbeat schedule no-ops; admin enables extension; re-apply migration |
| pgmq not installed | Heartbeat returns 0 | Enqueue function silently skips; admin enables extension |
| Worker timeout | Edge fn 504 | Job stays on queue; vt expires; another invoke picks it up; max 3 attempts |
| Detector throws | logRun outcome='failed' | Job retried with exponential backoff; abandoned after attempt 3 |
| Backlog > 100 for > 30 min | Spec § Phase 6 alert (deferred to dashboard) | Walker scales batch size or invoke frequency |
| LLM rate-limit during promotion | Promotion RPC RAISES | Caught by worker; logged; retried |
| Audit incident open at severity ≥ high | promote_insight_to_draft RPC returns NULL | Pause-on-incident: no new drafts created; existing drafts continue normally |
| Worker spawns ghost approvals | matview Gate-4 signal `ghost_approval_count > 0` | Lap 2 acceptance gate hard-fails; Walker triages |

**Hard rollback plan:** if the hybrid fails in pilot, fall back to pg_cron-only firing the detectors inline at 06:00 local for each pilot project. Loses parallelism but preserves correctness. Document the fallback in a Day-N receipt; do NOT skip the gate to avoid documenting.

## Consequences

**Positive.**
- Pilot users see drafts populate without manual `/iris/inbox` traffic.
- Backlog is observable in real time (`SELECT count(*) FROM pgmq.q_insights_jobs;`).
- Retry semantics are uniform across detectors — no ad-hoc per-detector recovery code.
- Idempotency is enforced by the promotion RPC, not by the worker — drift-proof.
- Adding cascade/variance/staffing/weather is dropping a function into the worker's `DETECTORS` map; the queue contract is unchanged.

**Negative.**
- Three new extensions to enable (pg_cron, pg_net, pgmq) — admin pre-apply step.
- Edge fns are billed per-invocation; pulling N jobs per call is essential to keep cost under control.
- Worker logs to `scheduled_insights_log` even on failure paths; retention prune (30 days) is a separate cron the migrations install.

**Tradeoff accepted:** the cost of the architecture (three extensions, two cron schedules, one queue) is the floor under everything that depends on cron-driven drafts. The Lap 1 gate proved infrastructure-first works for bytes; this ADR brings the same discipline to time-driven content.

## References

- `docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` — full spec
- `supabase/migrations/20260430160000_notification_queue_worker_cron.sql` — sibling pattern for a different queue
- `supabase/functions/scheduled-insights-worker/index.ts` — Tier 3a worker
- `docs/audits/IRIS_TELEMETRY_SPEC_2026-05-04.md` — the gate metrics this architecture feeds
- `docs/audits/ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` — withdraw-on-state-change policy this architecture enforces
