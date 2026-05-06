# Lap 3 Acceptance Gate Spec

**Date:** 2026-05-04
**Status:** Spec ready. Lap 3 kicks off ~June 9 (post-Lap-2-gate); Day 90 gate runs ~July 8 (tight) or ~Aug 1 (per original 90-day plan).
**Companion:** `HARDENED_EXECUTORS_SPEC` (Days 61-65), `AUTO_EXECUTE_CANCEL_WINDOW_SPEC` (Days 66-67), `DEMO_REHEARSAL_PLAYBOOK` (Days 73-77), `PRICING_DECISION_DOC` (Day 80), `SALES_DECK_v1` (Day 78), `FIRST_CONTRACT_PLAYBOOK` (Days 82-87).
**Format reference:** `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`. Same architecture: programmatic gates + qualitative gate + failure-mode tree + CI workflow.

---

## TL;DR — the four gates

| # | Gate | Threshold | Source | Failure-mode |
|---|---|---|---|---|
| 1 | **Signed contract count** | ≥ 1 | Stripe / contract management | Hard fail. Cannot move on. |
| 2 | **Contracts in legal review** | ≥ 2 additional | Sales pipeline | Hard fail. |
| 3 | **Demo flawless run-rate** | 4 consecutive successful runs against external audience | `demo_runs` log | Hard fail. |
| 4 | **Auto-execute opt-in active** | ≥ 1 GC has at least 1 executor type running on opt-in auto-execute with confidence ≥ 0.92, zero human cancels in 7 days | `lap_3_gate_metrics_daily` | Hard fail. |
| 5 | **"The team takes a weekend off without paging anyone"** | A real weekend, observed | The Slack #incidents and #pages channels | Hard fail. The most-undervalued one. |

A "pass" is **all five gates green simultaneously**, on a date inside the Lap 3 window, with at least 7 trailing days for gate 4 + the actual weekend off for gate 5.

---

## The Lap 3 window (and why dates matter)

- **Lap 3 kickoff:** Day 61 of the 90-day plan = ~June 9, 2026 (post-Lap-2-gate)
- **Day 90 of plan:** ~July 8, 2026 (tight calendar, with the 7-day pre-flight) OR ~Aug 1, 2026 (original plan calendar)
- **Reverse-Engineered T-270 hard date:** August 1, 2026 = Lap 3 acceptance gate per the milestones doc
- **23-day slack** between projected Day 90 (July 8) and the hard date (Aug 1) — same shape as Lap 2 slack window

---

## Gate 1 — Signed contract count (≥ 1)

### Counting rule

A "signed contract" counts toward the 1 if all hold:

1. Master Services Agreement signed by both parties (SiteSync + GC; not pilot agreement)
2. First invoice issued (proves billing system works end-to-end)
3. First payment received in our bank account (proves money flows actually clear)
4. Customer is actively using the product post-signing for at least 7 days
5. Project value ≥ ARR threshold (we agree: $30K minimum ACV — anything below is a "pilot continuation" not a real contract)

Pilot agreements (Brad Cameron / Carleton soft pilot) do NOT count. Letter-of-intent, term sheet, or "verbal yes" do NOT count. Only money-in-bank-and-usage counts.

### Why "1" not "3" or higher

The North Star + tracker say one contract by Day 90. The Reverse-Engineered Milestones say T-270 (~Aug 1) = first signed contract. **One paid GC is the proof point Lap 3 promises.** Three reference customers come Q3 (Oct 31, 2026 per T-180). We don't aim past the gate's stated bar.

---

## Gate 2 — Contracts in legal review (≥ 2 additional)

### Counting rule

A contract counts if all hold:

1. SiteSync has sent its standard MSA to the prospect's counsel
2. Prospect has acknowledged receipt + assigned counsel
3. At least one round of redline has been exchanged
4. Prospect has not pulled out (no rejection email)

The 2 are above the 1 from Gate 1. So the math at gate-pass is: **3 active legal-review processes** (1 closed, 2 in progress). This is the leading indicator — one closed deal could be a fluke; three in motion means we have a sales motion, not a single relationship.

### Why this gate matters

A founder who closed one contract via personal connection isn't a venture-fundable company. A founder with one closed + two in motion has a **repeatable funnel.** Investors at the seed close conversation will ask. Have the answer.

---

## Gate 3 — Demo flawless run-rate (≥ 4 external runs)

### Counting rule

A "demo run" counts if all hold:

1. The audience is **external** (not Walker, not engineer #2, not the soft-pilot customer who's seen it 50 times)
2. The demo runs the full 12-second sequence (Iris Inbox + RFI Detail + Daily Log AutoDraft) without a hiccup, error, or "let me restart that"
3. The audience is recorded as observing (asynchronous video shares don't count — has to be live with reactions)
4. Walker logs the run in `docs/sales/demo-runs/<date>-<audience>.md` within 24 hours

A "successful run" means: no error states visible; no "give me one second"; no fall-back to backup environment; no "this would normally show X." The demo just runs.

The 4 must be **consecutive.** A single failed run resets the count to zero. This forces real reliability discipline.

### Why "4 consecutive" not just "4 total"

The Field Manual is explicit: "demo runs flawlessly 4 times in a row externally." The "in a row" is the test of whether the demo is robust or merely-could-work-on-good-days. Lockheed Martin standard says: weapon fires reliably, not just sometimes.

### Failure modes

- Demo crashes mid-run → reset count + write 24-hour postmortem + fix before next run
- Audience asks a question we can't answer → not a fail, but log it and incorporate the answer
- Demo runs but feels weak → not a programmatic fail, but trigger demo-rehearsal extra-block
- Demo runs but external audience doesn't engage emotionally → flag in the log; voice/UX work

---

## Gate 4 — Auto-execute opt-in active (≥ 1 GC, ≥ 7 days, zero cancels)

### Counting rule

Gate 4 verifies the "draft → act" transition is real, not just shipped behind a flag. A GC must have:

1. Opted in to auto-execute on **at least one** of the 3 hardened executors (RFI response routing, daily log compilation, punch item assignment — per `HARDENED_EXECUTORS_SPEC`)
2. Auto-execute has fired at least 5 times in production over 7 trailing days
3. Confidence threshold ≥ 0.92 enforced
4. **Zero** human cancellations within the 60-second cancel window
5. Zero auto-execute incidents (rollbacks, customer complaints, audit-chain anomalies)

Any one cancel within the window resets the 7-day clock to day-zero. Zero-tolerance.

### Why zero cancels

Per Eleven Never #1: "Iris drafts; never acts without human approval." Auto-execute is the carefully-scoped exception, fired only at confidence ≥ 0.92 with a 60-second human cancel window. **If a human cancels, the system was wrong** — not "marginally wrong" or "edge-case wrong" but wrong in a way the user actively reversed.

A single cancel during the gate window means our 0.92 threshold is too low or our executor selection is too aggressive. Tune and restart the 7-day clock.

---

## Gate 5 — "The team takes a weekend off without paging anyone"

This is the gate. The other four are infrastructure for this one.

### What counts

- A consecutive **48-hour window** (Sat 0:00 to Sun 24:00, local time)
- During which **zero pages, zero incidents, zero customer-impacting outages, zero "I have to ship a fix overnight"** happen
- Walker, engineer #2 (when hired), and any other team member can fully unplug — phone in another room, laptop closed
- Customer activity continues during the window (real customers using the product Saturday + Sunday)

### What doesn't count

- A weekend with NO customer activity (week 1 of pilot, before first paid GC). Has to be a weekend where the system is doing real work and we don't have to babysit.
- A weekend where Walker checks Slack "just to see" — that's working, even if nothing was wrong.
- A weekend where someone outside the team (a customer, a vendor) reaches out and Walker has to respond — that's still operating; a weekend off includes auto-responder for reasonable lead time.

### Why this is the most-undervalued gate

Lap 1 was internal subtraction — Walker on weekends to fix things. Lap 2 pilot — Walker on weekends because pilot demands it. **Lap 3 ends with Walker NOT on weekends.** That's the proof the system is robust enough to run without him. That's the foundation for Series A, for hiring, for every program in the post-Lap-3 roadmap.

If we hit Day 90 and Walker can't take a weekend off, **Lap 3 didn't really pass**, even if gates 1-4 all hit threshold. That's the Bugatti standard: it's not done until it operates without the founder's babysitting.

---

## Failure-mode tree

```
                         All 5 gates green?
                              /        \
                           YES          NO
                            |            |
                       PASS Day 90    Which gate failed?
                                      /  |  |  |  \
                                     1   2  3  4   5
                                     |   |  |  |   |
                                     |   |  |  |   └── HARD STOP. Lap 3 fails. Walker cannot
                                     |   |  |  |       take a weekend off. Lap 3 work isn't done.
                                     |   |  |  |       Continue executing for additional 14 days;
                                     |   |  |  |       fix root cause. Re-attempt gate.
                                     |   |  |  |
                                     |   |  |  └── Auto-execute had a cancel. Tune confidence threshold
                                     |   |  |       up to 0.95; reset 7-day clock. Or descope: only
                                     |   |  |       1 executor in production for Day 90; expand Q3.
                                     |   |  |
                                     |   |  └── Demo can't hit 4 in a row. Demo rehearsal block 5
                                     |   |       (50 more reps); ship the missing reliability fix;
                                     |   |       slip Day 90 by 7-14 days.
                                     |   |
                                     |   └── 2 in legal review not happening. Lap 3 turns into
                                     |       sales motion: pitch 5 prospects in 14 days; hard
                                     |       fail if no movement.
                                     |
                                     └── Zero contracts. Means: pilot didn't convert, OR Brad's contract
                                          is in slow legal cycle. If pilot didn't convert: hard fail; Lap 3
                                          fails. If Brad's contract just slow: extend Day 90 by 14 days
                                          one time; if still no signature, hard fail.
```

---

## Diagnostic metrics (not gated)

| Metric | Source | Healthy range |
|---|---|---|
| Active demo prospects | Sales pipeline | 5+ in active conversations |
| Reference customer commitment count | Verbal yes captured | 2-3 by Day 90 (Reverse-Engineered says by Oct 31) |
| AI cost per active project | `lap_3_gate_metrics_daily` | < $50/month |
| Customer support tickets per active customer | Pylon | < 2/week |
| Auto-execute cancel rate | `drafted_actions` | 0% over Day-90 7-day window |
| Walker hours/week (instrumented via calendar) | Walker self-report | < 70/week trending toward 50 |

---

## CI workflow

New file: `.github/workflows/lap-3-acceptance.yml`. Mirrors the Lap 2 pattern.

```yaml
name: Lap 3 Acceptance Gate

on:
  schedule:
    - cron: '0 18 * * *'  # daily at 18:00 UTC
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - 'docs/audits/LAP_3_ACCEPTANCE_GATE_SPEC_2026-05-04.md'
      - 'supabase/migrations/*lap_3_gate*'

jobs:
  acceptance-gate:
    name: Lap 3 acceptance
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      
      - name: Refresh metrics view
        run: |
          psql "$STAGING_DB_URL" -c \
            "REFRESH MATERIALIZED VIEW CONCURRENTLY lap_3_gate_metrics_daily;"
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}

      - name: Read gate metrics
        id: metrics
        run: |
          ROW=$(psql "$STAGING_DB_URL" -t -A -F'|' -c "
            SELECT signed_contracts, contracts_in_legal,
                   demo_consecutive_pass_count,
                   auto_exec_active_gcs, auto_exec_cancel_count_7d
              FROM lap_3_gate_metrics_daily
              WHERE metric_date = CURRENT_DATE;
          ")
          IFS='|' read -r SIGNED LEGAL DEMO AE_GCS AE_CANCELS <<< "$ROW"
          echo "signed=$SIGNED" >> $GITHUB_OUTPUT
          echo "legal=$LEGAL" >> $GITHUB_OUTPUT
          echo "demo=$DEMO" >> $GITHUB_OUTPUT
          echo "ae_gcs=$AE_GCS" >> $GITHUB_OUTPUT
          echo "ae_cancels=$AE_CANCELS" >> $GITHUB_OUTPUT
          echo "[Lap 3 Gate] Signed: $SIGNED  Legal: $LEGAL  Demo: $DEMO  AE-GCs: $AE_GCS  AE-Cancels: $AE_CANCELS"
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}

      - name: Assert thresholds
        run: |
          SIGNED=${{ steps.metrics.outputs.signed }}
          LEGAL=${{ steps.metrics.outputs.legal }}
          DEMO=${{ steps.metrics.outputs.demo }}
          AE_GCS=${{ steps.metrics.outputs.ae_gcs }}
          AE_CANCELS=${{ steps.metrics.outputs.ae_cancels }}

          FAIL=0
          [[ $SIGNED -lt 1 ]] && { echo "::error::Signed contracts $SIGNED < 1"; FAIL=1; }
          [[ $LEGAL -lt 2 ]] && { echo "::error::Contracts in legal $LEGAL < 2"; FAIL=1; }
          [[ $DEMO -lt 4 ]] && { echo "::error::Demo consecutive pass $DEMO < 4"; FAIL=1; }
          [[ $AE_GCS -lt 1 ]] && { echo "::error::Auto-execute active GCs $AE_GCS < 1"; FAIL=1; }
          [[ $AE_CANCELS -ne 0 ]] && { echo "::error::Auto-execute cancels in 7d: $AE_CANCELS (must be 0)"; FAIL=1; }
          exit $FAIL
```

Gate 5 (weekend-off) is NOT in CI — it's observed, not measured. Walker writes a Day 90 receipt confirming the 48-hour window happened.

---

## Migration: lap_3_gate_metrics_daily

```sql
-- Migration: 20260609010000_lap_3_gate_metrics.sql
-- Apply at start of Lap 3 (June 9, 2026).

CREATE MATERIALIZED VIEW lap_3_gate_metrics_daily AS
WITH signed AS (
  SELECT COUNT(*) AS n
    FROM contracts
    WHERE signed_at IS NOT NULL
      AND first_invoice_at IS NOT NULL
      AND first_payment_received_at IS NOT NULL
      AND active_use_days >= 7
      AND annual_contract_value_cents >= 3000000  -- $30K
),
in_legal AS (
  SELECT COUNT(*) AS n
    FROM contracts
    WHERE legal_review_started_at IS NOT NULL
      AND signed_at IS NULL
      AND withdrawn_at IS NULL
),
demo AS (
  -- Calculate consecutive successful demos.
  -- A demo "fails" by being absent (gap) or being a non-success run.
  WITH ordered AS (
    SELECT id, run_at, was_successful,
           ROW_NUMBER() OVER (ORDER BY run_at DESC) AS rn
      FROM demo_runs
      WHERE audience_type = 'external'
  ),
  consecutive AS (
    SELECT MIN(rn) - 1 AS first_fail
      FROM ordered
      WHERE was_successful = FALSE
  )
  SELECT COALESCE(
    (SELECT first_fail FROM consecutive),
    (SELECT COUNT(*) FROM ordered)
  ) AS n
),
auto_exec AS (
  SELECT
    COUNT(DISTINCT da.project_id) AS active_gcs,
    COUNT(*) FILTER (
      WHERE da.decision_method IS NOT NULL  -- a human cancel
        AND da.decided_at >= NOW() - INTERVAL '7 days'
        AND da.was_auto_executed = TRUE
    ) AS cancel_count_7d
  FROM drafted_actions da
  WHERE da.was_auto_executed = TRUE
    AND da.executed_at >= NOW() - INTERVAL '7 days'
)
SELECT
  CURRENT_DATE AS metric_date,
  signed.n AS signed_contracts,
  in_legal.n AS contracts_in_legal,
  demo.n AS demo_consecutive_pass_count,
  auto_exec.active_gcs AS auto_exec_active_gcs,
  auto_exec.cancel_count_7d AS auto_exec_cancel_count_7d
FROM signed, in_legal, demo, auto_exec;

CREATE UNIQUE INDEX idx_lap_3_gate_metrics_daily_date
  ON lap_3_gate_metrics_daily(metric_date);

SELECT cron.schedule(
  'refresh-lap-3-gate-metrics',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY lap_3_gate_metrics_daily$$
);
```

Sister tables that need to exist:

```sql
-- Migration: 20260609010001_contracts_table.sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  msa_url TEXT,
  msa_template_version TEXT,
  legal_review_started_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signed_by_email TEXT,
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,
  annual_contract_value_cents BIGINT NOT NULL,
  first_invoice_at TIMESTAMPTZ,
  first_payment_received_at TIMESTAMPTZ,
  active_use_days INTEGER GENERATED ALWAYS AS (
    GREATEST(0, EXTRACT(DAY FROM (NOW() - signed_at)))::INTEGER
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: 20260609010002_demo_runs_table.sql
CREATE TABLE demo_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audience_type TEXT CHECK (audience_type IN ('internal', 'pilot', 'external')),
  audience_name TEXT,
  was_successful BOOLEAN NOT NULL,
  failure_note TEXT,
  presenter_user_id UUID REFERENCES auth.users(id),
  duration_seconds INTEGER,
  recorded_url TEXT
);
```

---

## Test plan for the gate

Before Day 90, run a synthetic dry-run:

1. Insert: 1 signed contract + 2 in-legal + 5 successful external demos consecutive + 1 auto-execute GC with 0 cancels in 7 days
2. Run gate workflow → expect PASS
3. Insert: 1 cancel into auto-execute → expect FAIL (cancels = 1)
4. Insert: a single failed demo at the front of demo_runs → expect FAIL (consecutive count drops)
5. Withdraw a contract → expect FAIL on Gate 1 or Gate 2 depending which

These dry runs land in `e2e/lap-3-gate.spec.ts`. (planned)

---

## Day-by-day mapping to tracker

| Tracker day | Activity |
|---|---|
| Day 61-65 | Hardened executors design + 3 coded behind flags (per `HARDENED_EXECUTORS_SPEC`) |
| Day 66-67 | 60-second cancel-window UX (per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`) |
| Day 68 | Auto-execute opt-in turned ON for 1 RFI type at pilot customer |
| Day 69 | Monitor; 0 incidents required to proceed |
| Day 70 | Auto-execute extended to daily log compilation |
| Day 71 | Auto-execute extended to punch item assignment |
| Day 72 | FRIDAY — pilot has 100% auto-execute coverage on 3 types; zero cancels |
| Day 73-77 | Demo rehearsal × 200 (per `DEMO_REHEARSAL_PLAYBOOK`) |
| Day 78 | Hard-launch landing page live + 3 reference customers commit |
| Day 80 | Pricing finalized (per `PRICING_DECISION_DOC`) |
| Day 82-86 | Pitch prospects 2/3/4 + first contract close push |
| Day 87 | First contract signed |
| Day 89 | Hard launch — press, LinkedIn, Twitter, demo video |
| Day 90 | LAP 3 ACCEPTANCE GATE — programmatic + qualitative + the weekend off |

---

## Acceptance criteria for this spec to be "shipped"

1. Migration applied (lap_3_gate_metrics_daily + contracts + demo_runs)
2. CI workflow `.github/workflows/lap-3-acceptance.yml` lives in repo
3. Synthetic dry-run e2e/lap-3-gate.spec.ts passes
4. Walker has acknowledged the 5 gates as the bar (no negotiation post-Lap-2)

---

## What this spec deliberately does NOT cover

- The hardened executors themselves (covered by `HARDENED_EXECUTORS_SPEC`)
- The cancel-window UX (covered by `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`)
- The demo rehearsal mechanics (covered by `DEMO_REHEARSAL_PLAYBOOK`)
- Pricing decision (covered by `PRICING_DECISION_DOC` + ADR-012)
- Sales motion / first contract close (covered by `FIRST_CONTRACT_PLAYBOOK`)
- Marketing site (covered by `MARKETING_SITE_REWRITE_SPEC`)

This spec is the **target** Lap 3 work points at. Companion specs cover the **how**.
