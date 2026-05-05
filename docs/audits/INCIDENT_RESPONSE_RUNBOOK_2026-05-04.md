# Incident Response Runbook

**Date:** 2026-05-04
**Status:** Spec ready. Walker reviews; first DR drill (Sept 2026) tests it; refines through quarterly drills.
**Companion:** `RELIABILITY_ARCHITECTURE_ADR_015`, `MULTI_REGION_FAILOVER_SPEC`, `CHAOS_ENGINEERING_SPEC`, `STATUS_PAGE_SPEC`, `SOC_2_READINESS_SPEC` (CC7 controls).
**Format reference:** Operational runbook. Modeled after Google SRE / Netflix Chaos Engineering practices.

---

## TL;DR

When something goes wrong, **this runbook is the playbook.** Severity → response → communication → postmortem. Walker initially on-call; engineer #2 joins rotation Aug 2026.

5 severity levels. 12 incident types. Each has: detection signal, immediate response (first 5 min), escalation criteria, customer communication template, postmortem requirements.

The Bugatti / Lockheed-Martin standard is **rapid + transparent + post-incident-improvement.** Outages don't disappear; they become institutional knowledge.

---

## Severity Levels

| SEV | Definition | Initial response time | Customer-facing? |
|---|---|---|---|
| **SEV-1** | Production data loss, audit chain corruption, security breach, money-movement failure | < 5 min (page) | Yes — immediate status update |
| **SEV-2** | Major service degradation (>10% of users impacted), data inconsistency | < 15 min (page) | Yes — within 15 min |
| **SEV-3** | Minor service degradation (<10% of users impacted) | < 1 hour (alert) | Yes — within 1 hour if customer-facing |
| **SEV-4** | Background issues, monitoring noise | < 4 hours (ticket) | No, internal only |
| **SEV-5** | Improvement opportunity, not an incident | Open ticket | No |

**Default escalation:** unsure of severity? Escalate UP one level. Better to over-communicate than miss a SEV-1.

---

## Detection Signals (what triggers a page)

### Auto-paged via PagerDuty / Sentry / Custom (SEV-1 + SEV-2)

| Signal | SEV | Source |
|---|---|---|
| `verify_audit_chain()` returns broken rows | SEV-1 | Daily cron + on-demand |
| Stripe webhook fails 5+ times | SEV-1 | Stripe webhook handler |
| Hash chain integrity test fails on deployment | SEV-1 | CI / Sentry |
| 500 error rate > 5% over 5 min window | SEV-2 | Sentry |
| Database connection pool exhausted | SEV-2 | Postgres metrics |
| Modern Treasury rail unhealthy | SEV-1 | MT API health check |
| RLS policy bypass detected | SEV-1 | Custom audit |
| AI cost per draft > 2x baseline (30-day rolling) | SEV-2 | Daily aggregation |
| Iris-call timeout > 30% over 10 min window | SEV-2 | Function metrics |
| Edge function cold-start > 2s p95 sustained 5 min | SEV-2 | Vercel observability |
| Audit chain write latency > 1s sustained | SEV-2 | DB monitoring |
| Status page system-status flipped to "Major Outage" | SEV-1 | Manual override or auto |

### Customer-reported (SEV-3 typical, escalate as needed)

- Slack message in `#support`
- Email to [email protected] (or whatever support address)
- Phone call to support line (Pro+ tier customers)
- Sentry user-feedback widget submit

Triage within 1 hour during business hours; 4 hours overnight.

### Internal/eng-detected (SEV-4 typical)

- New issue filed during code review
- Internal slack mention of degradation
- Team member sees something concerning

---

## The 12 Incident Types + Responses

### 1. Audit Chain Break (SEV-1, highest severity in our system)

**Signal:** `verify_audit_chain()` returns broken rows.

**Response:**

```
Within 5 min:
1. Walker (or engineer #2) is paged
2. Confirm signal: re-run verifier; check broken rows count
3. Halt new chain writes via emergency feature flag (chain_writes_paused = TRUE)
4. Status page → "Investigating: data integrity check"

Within 30 min:
5. Triage: which row(s) broke? When? What was happening?
6. Forensic snapshot: pg_dump of audit_log + drafted_actions tables
7. Notify Walker if not already on-call

Within 4 hours:
8. Root-cause: why did the chain break?
9. Remediation: re-create the broken row(s) with audit annotation; do NOT silently fix
10. Re-run verifier; confirm clean

Within 24 hours:
11. Postmortem published; customers notified if data was affected
12. Trail of Bits notified if attestation may be in question
```

**Customer communication template:**
```
Subject: [SiteSync] Resolved: Data Integrity Investigation

Earlier today we detected a data integrity check failure in our audit log. 
We've completed forensics and confirmed [no customer data was affected / 
specific impact + remediation taken].

Detailed postmortem: [link]
```

---

### 2. Authentication Outage (SEV-1)

**Signal:** Login flow failing > 5% of attempts over 5 min.

**Response:**

```
Within 5 min:
1. Page on-call
2. Identify which auth path is failing (Supabase auth? Magic link? SSO?)
3. Check Supabase status; rollback recent migration if related
4. Status page → "Authentication issues; investigating"

Within 15 min:
5. Stabilize: failover to secondary region if regional issue
6. Communicate to customers via status page + Slack-Connect
```

---

### 3. Database Outage (SEV-1)

**Signal:** Postgres unreachable > 30s; or > 50% query failure rate.

**Response:**

```
Within 5 min:
1. Page on-call
2. Check Supabase status page (theirs)
3. If our connection issue: failover to secondary region
4. If their outage: status page; stay calm

Within 30 min:
5. Triage queries that succeeded vs failed; ensure no money was double-handled
6. Reconciliation check on payments (post-April 2027)
```

---

### 4. AI Service Outage (SEV-2 — Iris doesn't draft)

**Signal:** Iris-call returning errors > 30% over 10 min.

**Response:**

```
Within 15 min:
1. Triage: Anthropic API issue? Multi-model fallback engaged?
2. If Anthropic: switch to OpenAI fallback (multi-model failover)
3. If our infra: investigate; may need to disable scheduled-insights cron temporarily

Within 1 hour:
4. Communicate to customers — Iris drafting paused; manual workflow continues
5. Restore service; resume cron
```

---

### 5. Modern Treasury / Bank Partner Outage (SEV-1, post-April 2027)

**Signal:** MT health check fails; or first bank partner KYC down.

**Response:**

```
Within 5 min:
1. Page Walker
2. Check MT status; check First-Citizens / Cross River status
3. If primary bank down: failover to secondary bank (MT supports multi-bank)
4. Halt new payment initiations until path verified

Within 30 min:
5. Customer communication if any payments are stuck
6. Reconciliation check
```

---

### 6. Cross-Tenant Data Leak (SEV-1, security)

**Signal:** RLS policy bypass detected; or customer reports seeing other tenant's data.

**Response:**

```
Within 5 min:
1. Page Walker + immediately escalate to outside counsel
2. Halt customer activity in affected components
3. Status page → "Security investigation underway"

Within 30 min:
4. Forensic snapshot of audit log
5. Identify affected tenants

Within 24 hours:
6. Customer notification; legal review of communications
7. Postmortem; SOC 2 Type II auditor may need notification
8. Bug bounty payout if responsibly disclosed
```

This is the worst-case incident type. Practice it.

---

### 7. Performance Degradation (SEV-2/3)

**Signal:** p95 latency exceeds budget by > 50% for 10+ min.

**Response:**

```
Within 15 min:
1. Triage: which budget? (capture, inbox, draft, audit)
2. Check noisy-neighbor: any tenant unusually active?
3. Throttle if needed; auto-rate-limit per tenant

Within 1 hour:
4. Tune; deploy fix or scale resources
5. Monitor; confirm budget restored
```

---

### 8. Stripe / Billing Outage (SEV-2)

**Signal:** Stripe webhook failures > 5 in 1 hour; or new subscription creation failing.

**Response:**

```
Within 15 min:
1. Triage: Stripe issue or our handler?
2. If Stripe: customer-facing error message updated; retries queued
3. If ours: rollback recent migration / deployment

Within 1 hour:
4. Reconcile any in-flight charges; ensure idempotent
```

---

### 9. Mobile App Crash Wave (SEV-2)

**Signal:** Crash rate > 5% in last 1 hour OR specific path > 1% (Sentry mobile).

**Response:**

```
Within 15 min:
1. Triage which screen / action / OS version
2. If recent build: rollback via EAS Update (over-the-air)
3. Re-test on TestFlight before re-deploying

Within 1 hour:
4. Customer communication if widely affected
```

---

### 10. Email / Notification Failure (SEV-3)

**Signal:** SendGrid / Postmark delivery rate < 95%.

**Response:**

```
Within 1 hour:
1. Triage; switch providers if needed
2. Communicate to affected customers; resend important notifications
```

---

### 11. Storage Outage (SEV-2 — files, photos, drawings)

**Signal:** S3 / Cloudflare R2 unreachable; or upload failure > 10% over 10 min.

**Response:**

```
Within 15 min:
1. Triage; check provider status
2. Surface graceful error to user ("retry in 30 sec")
3. Queue retry; do not lose user-submitted data
```

---

### 12. Compliance Breach (SOC 2 control violation)

**Signal:** Detected during quarterly audit, internal review, or external auditor finding.

**Response:**

```
Within 24 hours:
1. Walker + outside counsel reviews
2. Determine if customer-affecting; communicate if so
3. Remediate; re-test the control
4. Document in compliance register
5. May trigger SOC 2 observation-window restart for affected control
```

---

## On-Call Rotation

### Today (May 2026)

- **Walker:** primary on-call. 24/7. Escalation for SEV-1 and SEV-2.
- **No backup.** This is the bottleneck.

### Aug 2026 (engineer #2 starts)

- **Walker + Eng #2:** weekly rotation
- **Hand-off Mondays at 9 AM** (Walker on Mon-Sun for week 1; Eng #2 on Mon-Sun for week 2; etc.)
- **SEV-1 dual-page:** both get notification; whoever responds first leads

### Q1 2027 (engineer #3 + customer success #1)

- **3-person rotation:** weekly with skip every 4 weeks for time off
- **PagerDuty cost:** ~$200/month at this scale

### After Series A (Q4 2027+)

- **5-person rotation** including dedicated SRE if hired
- **Tier system:** CSM owns SEV-3+ during business hours; SRE owns SEV-1/SEV-2

---

## Communication Templates

### SEV-1 Status Page Update (initial)

```
Status: Investigating
Severity: Major Outage
Started: [timestamp]
Affected: [Service Name(s)]

We are investigating reports of [issue summary]. We will update this page 
every 15 minutes.

Last updated: [timestamp]
```

### SEV-1 Customer Email (after stabilization)

```
Subject: Resolved: [Issue summary] — SiteSync

Hi [name],

Earlier today we experienced [brief summary]. The issue was caused by [root cause].

Timeline:
- [time]: Issue detected
- [time]: Mitigation began
- [time]: Service restored
- [time]: Monitoring stable

Impact to your account: [specific impact, or "no data was affected"]

We've taken these steps to prevent recurrence: [bullets]

Detailed postmortem: [link]

Thank you for your patience. — Walker, SiteSync
```

### SEV-1 Postmortem Format

```markdown
# Postmortem: [Date] [Brief incident name]

**Date of incident:** YYYY-MM-DD HH:MM (UTC)
**Severity:** SEV-1
**Duration:** N hours M minutes
**Customers affected:** [count or %]
**Detected by:** [auto-page / customer report / internal]
**Resolved by:** [team]

## Summary
[1-2 paragraph overview]

## Timeline
- HH:MM — [event]
- HH:MM — [event]
- ...

## Root Cause
[Technical analysis — be specific. Don't blame; investigate.]

## Customer Impact
[Quantified: data loss, latency increase, lost transactions, etc.]

## What We Did Well
- [bullets]

## What We Could Have Done Better
- [bullets]

## Action Items (with owners + dates)
- [ ] [Action] — [Owner] — [Date]

## Lessons Learned
[Institutional knowledge — what should change in our processes/architecture]
```

Postmortems are public for SEV-1 with customer impact, internal for SEV-2/3.

---

## Daily/Weekly Operational Practices

### Daily (Walker, every weekday at 9 AM)

- Check Sentry inbox for new errors
- Check status page state
- Check audit chain verifier last run
- Spot-check 5 random drafted_actions for correctness

### Weekly (Friday afternoon)

- Review the week's incidents (SEV-3+ count)
- Update incident response runbook with new learnings
- Verify backup restore procedure
- Review on-call handoff with backup

### Quarterly (DR drill day)

- Full simulated regional outage
- All hands participate
- Postmortem + runbook update

---

## Tools

- **PagerDuty** ($25-100/month) — alerting, on-call, escalation
- **Sentry** (already in stack) — error monitoring + crash reporting
- **Statuspage.io** ($50/month) — public status page
- **Slack-Connect** — customer-facing comms during incidents
- **Postmark** (or SendGrid) — email comms
- **Twilio** — SMS for SEV-1 customer alerts (Pro+ opt-in)
- **Zoom** — incident bridge calls
- **Custom Slack channel `#incidents`** — internal during-incident chat

---

## What Walker Does With This Spec This Week

1. Read the runbook end-to-end; flag any incident type missing
2. Confirm PagerDuty + Statuspage.io budget
3. Set up `[email protected]` as a real inbox
4. First DR drill calendar entry for Sept 2026

---

## What Claude Code Does With This Spec

- Build `scripts/dr-drill.sh` — runs the synthetic regional outage
- Build status page integration with Sentry alerts
- Build the postmortem template tooling
- Maintain runbook through quarterly drills

Total Claude Code work: ~3 days through Q3 2026.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| IR-1 | Walker is sole on-call; burns out | High | Critical | Engineer #2 by Aug 2026 unblocks rotation |
| IR-2 | First real SEV-1 incident reveals runbook gaps | High (always) | Medium | Treat as feature; postmortem identifies gap; runbook updated |
| IR-3 | Customer perceives slow response | Medium | High (trust) | < 15 min comms target; status page autoupdates |
| IR-4 | Hash chain incident → SOC 2 implications | Low | Critical | Trail of Bits + auditor in loop; transparent communication |
| IR-5 | Multi-region failover slow in real outage | Low-Medium | Medium | Quarterly DR drills test exactly this |
| IR-6 | Customer data shared with wrong customer | Low | Critical (legal) | Outside counsel + regulator notification path documented |

---

## What this spec deliberately does NOT cover

- The chaos engineering test scripts (covered by `CHAOS_ENGINEERING_SPEC`)
- The status page design (covered by `STATUS_PAGE_SPEC`)
- The DR drill scripts (covered by `MULTI_REGION_FAILOVER_SPEC`)
- Bug bounty program (covered by separate spec when launched Q4 2026)
- Red team adversarial testing (covered by `ADVERSARIAL_RED_TEAM_SPEC`)
- Customer-specific SLA breach handling (covered by `MSA_TEMPLATE_NOTES`)
