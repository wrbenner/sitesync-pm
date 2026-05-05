# ADR-015 — Reliability Architecture: Multi-Region Active-Active + Chaos Engineering + 4-Nines SLA

**Date:** 2026-05-04
**Status:** Accepted (subject to Walker review)
**Decider:** Walker
**Companion specs:** `MULTI_REGION_FAILOVER_SPEC_2026-05-04.md` (forthcoming this wave), `CHAOS_ENGINEERING_SPEC_2026-05-04.md` (forthcoming this wave), `INCIDENT_RESPONSE_RUNBOOK_2026-05-04.md` (forthcoming this wave), `STATUS_PAGE_SPEC_2026-05-04.md` (forthcoming this wave)
**Format reference:** `ADR_002_AI_STORES_STAY_SEPARATE_2026-05-01.md`

---

## Decision

Adopt **multi-region active-active architecture with chaos engineering in CI and 99.99% SLA (4 nines)** by Q1 2027. Build Q3-Q4 2026; tested via DR drills before launch.

This raises the reliability bar from typical SaaS (99.9% / 3 nines / ~8 hours of acceptable downtime per year) to **defense-grade (99.99% / 4 nines / ~50 minutes of acceptable downtime per year).**

---

## Context

The Bugatti / Lockheed-Martin framing (per `BUGATTI_LAUNCH_ROADMAP_2026-05-04.md` Part 1) raises every quality bar by ~50%:

| Dimension | Typical SaaS | Weapon-grade | SiteSync target |
|---|---|---|---|
| Uptime | 99.9% (3 nines) | 99.99% (4 nines) | 99.99% by Q1 2027 |
| Recovery Time Objective (RTO) | 4 hours | < 1 hour | < 1 hour |
| Recovery Point Objective (RPO) | 1 hour | < 5 minutes | < 5 minutes |
| Multi-region | Active-passive (failover) | Active-active | Active-active |
| Chaos engineering | Quarterly drills | Continuous in CI | CI on every PR |
| Status page | Internal | Public + customer-facing SLA | Public at status.sitesync.com |

The customers we're targeting — mid-market commercial GCs running $100M-$500M projects — cannot tolerate 8 hours of downtime per year. A Saturday at 5 PM with the field super filing a daily log can't be "the system is down for maintenance." 50 minutes/year is the right ceiling.

---

## Architecture

### Today (Lap 1-2)

```
┌─────────────────┐
│  Single-region  │
│  Supabase       │
│  US-East-1      │
└─────────────────┘
        │
        ▼
   ┌────────┐
   │  App   │
   └────────┘
```

Single region. Daily snapshots. ~3 nines if everything is well-tuned.

### Q1 2027 — Active-active

```
┌─────────────────┐         ┌─────────────────┐
│  Supabase       │  Live   │  Supabase       │
│  US-East-1      │  Sync   │  US-West-1      │
│  (Primary)      │ ─────► │  (Standby)      │
└────────┬────────┘         └────────┬────────┘
         │                            │
         │   Multi-region Read /      │
         │   Write Routing            │
         │                            │
         ▼                            ▼
   ┌──────────────────────────────────┐
   │   Cloudflare / Vercel Global Edge │
   │   - DNS-based failover (60s)      │
   │   - Latency-based routing         │
   │   - Edge function deployment       │
   └──────────────────────────────────┘
              │
              ▼
         ┌────────┐
         │  App   │
         └────────┘
```

- **Live read replica** in us-west-1; sync lag < 5s
- **Sticky-write affinity** to primary region; write fails → fail-over write to secondary within 60s
- **DNS-based failover** via Cloudflare; clients re-resolve to healthy region
- **Edge functions** deployed to both regions; routing favors closest

### What's NOT in scope

- Globally-distributed writes (CRDTs, multi-master). Way beyond our scale; year 3+.
- Data residency for non-US customers (year 2; Q4 2027).
- Edge data tier (Cloudflare R2 / Workers KV at the edge for cached reads). Year 2.

---

## Why Active-Active (not Active-Passive)

Active-passive (one region serves all traffic; standby region for failover) is simpler. We chose active-active because:

1. **Real-time failover testing.** Active-active means the standby region serves traffic continuously. We discover issues immediately, not during an outage.
2. **Lower latency for west-coast customers.** Texas / Dallas / California GCs see latency benefits.
3. **No "is the standby actually working" anxiety.** It is, because it's serving production traffic right now.
4. **Procore did active-passive forever; their outages have been multi-hour.** We can do better with modest infrastructure investment.

Trade-off: active-active doubles infrastructure cost (we pay for both regions running). At our scale, this is ~$1-2K/month of incremental cost. Worth it for the reliability claim.

---

## SLA Commitment Strategy

**Internal target:** 99.99% (4 nines) — this is what the architecture is built for.

**External SLA:**
- **Pro tier:** 99.9% (3 nines) — gives us margin against the 4-nines internal target
- **Enterprise tier:** 99.95% (3.5 nines) — earned for Enterprise pricing
- **Custom enterprise:** 99.99% with credits — at additional cost

This is the **standard SaaS pattern** — internal target + lower committed SLA + credits if we miss. Procore's contractual SLA is 99.5%. Ours starts at 99.9%. Differentiation.

### SLA breach credits

- 99.9% breach: 10% monthly fee credit per percentage point below
- 99.95% breach: 15% monthly fee credit per percentage point below
- Capped at 50% monthly fee in any month

These are standard. Not a giveaway; not a punishment.

---

## Chaos Engineering in CI

Every PR + every nightly build runs **chaos tests** that simulate failure:

```yaml
# .github/workflows/chaos.yml (forthcoming)
name: Chaos Engineering

on:
  pull_request:
    paths:
      - 'src/**'
      - 'supabase/migrations/**'
  schedule:
    - cron: '0 0 * * *'  # nightly

jobs:
  chaos-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Test 1 — Kill Supabase primary mid-write
        run: ./chaos/kill-primary-mid-write.sh
        # Expected: app fails over to secondary within 60s
      
      - name: Test 2 — Cloudflare DNS slow propagation
        run: ./chaos/dns-slow.sh
        # Expected: app handles 30-second DNS failure gracefully
      
      - name: Test 3 — Edge function timeout
        run: ./chaos/edge-fn-timeout.sh
        # Expected: app degrades gracefully; fallback path
      
      - name: Test 4 — Iris-call rate-limited
        run: ./chaos/iris-call-rate-limit.sh
        # Expected: queue + backoff; user sees "queued, retrying"
      
      - name: Test 5 — Storage quota exceeded
        run: ./chaos/storage-full.sh
        # Expected: clear error message + retention prompt
      
      - name: Test 6 — Postgres connection pool exhausted
        run: ./chaos/connection-pool-exhausted.sh
        # Expected: connection retry with backoff
      
      - name: Test 7 — Tenant query saturating shared resources
        run: ./chaos/noisy-neighbor.sh
        # Expected: query throttled; other tenants unaffected
      
      - name: Test 8 — Audit chain integrity verification fails
        run: ./chaos/chain-break.sh
        # Expected: page on-call; halt new chain writes; preserve forensics
      
      - name: Test 9 — Stripe webhook fails
        run: ./chaos/stripe-webhook-fail.sh
        # Expected: idempotent retry; no double-charge
      
      - name: Test 10 — Modern Treasury rail fails (post-April 2027)
        run: ./chaos/mt-rail-fail.sh
        # Expected: failover to backup bank within 60s
```

Each test fires for 30 seconds; verifies the system recovers + remains in a good state.

**CI fails the PR if any chaos test fails.** This is the "Lockheed Martin in CI" discipline.

---

## DR Drill Schedule

### Quarterly drills (mandatory)

- **Q3 2026 (Sept):** First drill. Walker leads. Synthetic regional outage; full team participates.
- **Q4 2026 (Dec):** Drill #2. Engineer #2 leads.
- **Q1 2027 (March):** Drill #3. Customer success #1 leads (rotation).
- **Q2 2027 (June, post-launch):** Drill #4. Multi-region failover with real load.

### What each drill exercises

```
Hour 0     — Synthetic alert fires: "primary region unhealthy"
Hour 0:00  — Walker (or rotation) triages within 5 min
Hour 0:05  — Failover decision made
Hour 0:10  — Failover executed (DNS update, traffic shifts)
Hour 0:30  — Verification: all services healthy on secondary
Hour 1:00  — Postmortem write-up begins (within 24 hours)
Hour 24    — Postmortem published; team review
```

Each drill produces:
- A postmortem document (`docs/audits/dr-drill-postmortems/<date>.md`)
- A list of identified gaps (always > 0; no drill is perfect)
- Action items with owners + dates
- Updates to `INCIDENT_RESPONSE_RUNBOOK`

---

## Status Page

**Public, real-time** at status.sitesync.com. Powered by Statuspage.io (or open-source Cachet / Atlassian Statuspage).

### What it shows

```
┌─────────────────────────────────────────────────────────────────┐
│  SiteSync Status                                                 │
│  ─────────────────                                                │
│                                                                   │
│  System: ● Operational                                            │
│                                                                   │
│  Service                  Status        Uptime (90d)              │
│  ─────────────────────────────────────────────────────            │
│  Web App                  ● Operational     99.987%               │
│  Mobile API              ● Operational     99.992%               │
│  Iris (AI)              ● Operational     99.961%               │
│  Embedded Payments       ─ Not yet launched                       │
│  Audit Chain Verifier   ● Operational     100.00%               │
│  Sub Portal             ● Operational     99.989%               │
│                                                                   │
│  Last 90 days: 99.978% uptime ─────────────────────────────       │
│                                                                   │
│  Recent incidents (last 30 days):                                 │
│  • [date]  [duration]  [severity]  [summary] — [postmortem link] │
│                                                                   │
│  Subscribe to status: [email]   [SMS]                            │
└─────────────────────────────────────────────────────────────────┘
```

### What it commits to

- Real-time updates from monitoring (Sentry + custom)
- Incident timeline + final resolution
- Postmortem links (24-hour SLA on incidents > severity-2)
- Subscribe via email or SMS
- Public for everyone — including investors due-diligencing
- 90-day historical uptime

### What it doesn't show

- Customer-specific incidents (those go in customer's dashboard)
- Internal-only metrics (latency by tenant, etc.)

---

## Performance Budgets (per `BUGATTI_LAUNCH_ROADMAP` Part 4 Program 5)

Tightened per the weapon-grade framing:

| Operation | Pro budget | p99 budget |
|---|---|---|
| Capture (photo + GPS + voice) | 1.0s p95 | 2.0s p99 |
| Inbox first paint | 0.6s p95 | 1.2s p99 |
| Iris draft first token | 2.0s p95 | 4.0s p99 |
| PDF export | 3.0s p95 | 6.0s p99 |
| Audit chain row write | 100ms p95 | 250ms p99 |
| Edge function cold start | 500ms p95 | 1.5s p99 |
| Mobile app cold launch | 800ms p95 | 1.5s p99 |

**CI enforces:** every PR runs perf tests; PR that regresses any budget by > 100ms requires explicit owner override + rationale in PR body.

**Per-tenant budget:** noisy tenant cannot degrade quiet tenants. Database query throttling per RLS-derived tenant context.

---

## Cost Implications

Multi-region active-active cost (approximate):

| Item | Single-region cost | Multi-region active-active cost |
|---|---|---|
| Supabase | $X/month | $1.5X (read replica + cross-region traffic) |
| Cloudflare | $0 (free tier) | $20/month (pro plan for advanced routing) |
| Edge functions | $X | $1.5X |
| Monitoring tooling | $200/month | $300/month |
| Status page | $0 | $50/month (Statuspage.io) |
| Chaos engineering tooling | $0 | $0 (custom scripts) |
| **Total incremental** | — | **~$200-500/month** at our scale |

This is rounding error against the value of "we don't go down."

---

## What Walker Does With This Spec This Week

1. Approve or push back on ADR-015
2. Confirm Cloudflare account status (we likely have one; if not, set up)
3. Confirm we own status.sitesync.com subdomain DNS
4. Identify on-call rotation pattern (Walker initially → engineer #2 join after hire)

---

## What Claude Code Does With This Spec

- Build the chaos test suite (`chaos/` directory; ~10 tests; each ~50 lines of bash)
- Build the failover runbook (per `INCIDENT_RESPONSE_RUNBOOK`)
- Configure status page integration with monitoring
- Build the DR drill checklist + postmortem template
- Update CI to run chaos tests on every PR

Total Claude Code work: ~5 days through Q3 2026.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| REL-1 | Multi-region setup more complex than expected | Medium | Medium | Allocate 4 weeks, not 2; engineer #2 owns this with Walker oversight |
| REL-2 | DNS failover slower than 60s in real world | Low-Medium | Medium | Test in DR drills; optimize TTL; pre-warm caches |
| REL-3 | Read replica lag > 5s under load | Medium | Medium | Tune; add monitoring; alert if lag > 10s |
| REL-4 | Chaos test in CI flaky | High initially | Low | Re-run; fix flakiness as it surfaces |
| REL-5 | Status page out of sync with reality | Low | High (trust violation) | Automated from monitoring (Sentry alerts → status page); manual override allowed |
| REL-6 | First DR drill identifies critical gap pre-launch | High (likely!) | Medium | Treat as feature: drill exists to find gaps before customer does |
| REL-7 | 4-nines SLA target unmet at scale | Medium | High | Set 3-nines SLA externally with margin against 4-nines internal target |

---

## What this spec deliberately does NOT cover

- The migration mechanics for active-active setup (covered by `MULTI_REGION_FAILOVER_SPEC` forthcoming)
- The chaos test scripts in detail (covered by `CHAOS_ENGINEERING_SPEC` forthcoming)
- The incident response runbook (covered by `INCIDENT_RESPONSE_RUNBOOK` forthcoming)
- The status page design (covered by `STATUS_PAGE_SPEC` forthcoming)
- Customer-facing SLA contract terms (covered by `MSA_TEMPLATE_NOTES`)
- Disaster recovery for cyber attacks (covered separately as security incident response)
- Backup verification cadence (covered by reliability runbook)
- 5-nines aspiration (year 3+; outside our bar today)
