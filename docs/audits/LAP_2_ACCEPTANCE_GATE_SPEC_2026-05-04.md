# Lap 2 Acceptance Gate Spec

**Date:** 2026-05-04
**Status:** Spec ready. CI workflow scaffolded. Gate runs nightly during pilot + on-demand for Day 60.
**Blocks:** Day 60 close. The gate cannot fail-closed without the telemetry migration (`IRIS_TELEMETRY_SPEC_2026-05-04.md`) landing first.
**Format reference:** `LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md`. Pattern: programmatic gates + one qualitative gate, all measurable, all fail-closed, with explicit failure-mode tree.

---

## TL;DR — the four gates

| # | Gate | Threshold | Source | Failure-mode |
|---|---|---|---|---|
| 1 | **Approved-draft count** | ≥ 100 in pilot window | `lap_2_gate_metrics_daily.approved_count` | Hard fail. Cannot move on. |
| 2 | **Acceptance rate** | ≥ 70% | `lap_2_gate_metrics_daily.acceptance_rate_pct` | Hard fail. Cannot move on. |
| 3 | **Avg time-to-approve** | ≤ 90s | `lap_2_gate_metrics_daily.avg_time_to_approve_sec` | Soft fail. See § Failure-Mode Tree. |
| 4 | **Security/audit incidents** | 0 | Hash-chain verifier + `audit_incidents` log | Hard fail. Single incident = stop. |
| 5 | **"I don't want to go back"** | Captured, unprompted, from a pilot PM | See § Qualitative Capture | Hard fail. The most important one. |

A "pass" is **all five gates green simultaneously, on a single date inside the pilot window**, with at least 7 trailing days of pilot activity feeding the metrics view.

---

## The pilot window (and why the dates matter)

- **Pilot kickoff:** Day 50 of the 90-day plan. With Lap 2 starting May 11 (post-pre-flight), Day 50 = ~June 30.
- **Pilot Day 1 = window start** for the gate. (Gate metrics ignore drafts created before the pilot starts — those are dev/staging noise.)
- **Pilot length:** 14 days minimum, per Field Manual.
- **Day 60 of the 90-day plan = ~July 10** (post-pre-flight). The gate must pass on a date within ±3 days of Day 60.
- **Hard external date:** July 2 per `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md` (T-300). If the post-pre-flight schedule pushes Day 60 past July 2, **the pre-flight ate the slack and we have a problem**. Escalate to Walker before July 2.

---

## Gate 1 — Approved-draft count (≥ 100)

### Counting rule

A "draft" counts toward the 100 if and only if all of the following hold:

1. `drafted_actions.project_id` belongs to the soft-pilot GC's organization (single org, not "any pilot project")
2. `drafted_actions.created_at` ≥ pilot window start
3. `drafted_actions.status IN ('approved', 'executed')`
4. `drafted_actions.first_viewed_at IS NOT NULL` (a "ghost approval" — a draft that was never viewed but somehow flipped to approved — does not count; this would indicate a security incident anyway)
5. `drafted_actions.viewer_user_id` is a real user, not the system user (the cron's withdraw mechanism uses a system user; those updates are not "approvals")

### Edge cases — explicit decisions

- **Edit-then-approve.** Counts. (`required_edits = TRUE` is broken out in the dashboard for diagnostic.)
- **Auto-withdrawn drafts.** Don't count. Status would be `'rejected'` with `decision_note LIKE '[withdrawn by system]%'`.
- **Drafts decided by Walker, not the pilot user.** Don't count. Walker's user_id is excluded via the `pilot_user_ids` table the playbook populates.
- **Drafts approved post-pilot-window.** Don't count. The window is fixed at pilot-start + 14 days.
- **A single draft that bounces approved → reverted → approved.** Counts once. The `audit_log_hash_chain` is the source of truth; we count by `drafted_actions.id`, not by audit-row count.

### Why 100 specifically?

From the North Star: "100+ production Iris drafts approved." The 100 number is calibrated against:
- ~7 drafts/day × 14 days = 98 drafts; rounding to 100 includes 1 weekend day of activity
- ~15 drafts/day on a normal day × 7 weekdays = 105 (the tracker's Day 57 target is "≥ 15 approved per day")
- The PM mental model: "the bot drafted enough that I felt it"

Below 100 is a pilot that's running but not load-testing the inbox. Above 100 just confirms.

---

## Gate 2 — Acceptance rate (≥ 70%)

### Formula (locked)

```
acceptance_rate_pct = approved_count / (approved_count + rejected_count) * 100
```

Where:
- **approved_count** = drafts with `status IN ('approved', 'executed')` in the pilot window (matches Gate 1)
- **rejected_count** = drafts with `status = 'rejected'` AND `decision_note NOT LIKE '[withdrawn by system]%'` (i.e., user-driven rejections only; system withdrawals don't penalize the rate)

### Explicit decisions

- **Pending drafts don't count.** A draft sitting at `status='pending'` for 8 hours is not acceptance signal. (It is a *separate* signal — see § Diagnostic Metrics — but doesn't enter the gate formula.)
- **Aged-out drafts.** Drafts pending > 72 hours auto-transition to `status='rejected'` with a system note `'[aged out: 72h pending]'`. These DO count against the rate. (Rationale: a draft the user couldn't be bothered to decide IS a soft rejection.)
- **Auto-withdrawn drafts.** Excluded from both numerator and denominator. The user never had a real chance to decide — the underlying state changed and the draft is moot.

### Why 70% specifically?

- Below 50% = bot is wrong more than half the time; product-market fit signal is negative
- 50–70% = bot is useful but the cost of reviewing rejected drafts outweighs the benefit of accepted ones
- 70–80% = real PMF; the bot is a colleague, not a co-pilot
- Above 90% = the user is rubber-stamping; we should worry the human-in-loop has become a formality

70% is the bottom of the "real PMF" band. Aim higher, gate at 70.

---

## Gate 3 — Average time-to-approve (≤ 90s)

### Measurement clock (locked)

```
time_to_decide_ms = decided_at - first_viewed_at
```

Per the telemetry spec, `time_to_decide_ms` is a generated column on `drafted_actions`. The gate query takes `AVG(time_to_decide_ms / 1000.0)` over approved drafts in the pilot window.

### Why first_viewed_at, not created_at?

A draft created at 2 AM by the cron and approved at 9 AM is not a 7-hour decision — it's a 7-second decision the user made when they got to the office. Measuring from `created_at` would conflate "user is slow" with "user wasn't at their desk."

### Outliers

- **Drafts approved > 30 minutes from first view.** Excluded from the average (bias-correction). Likely the user got pulled into a meeting; not "decision latency." Tracked separately as `long_decision_count`.
- **Drafts approved < 1 second from first view.** Likely a misclick or rage-approve. Flagged in the diagnostic dashboard but counted in the average — the user's 1s decision is real signal.
- **The 30-minute and 1-second cutoffs are tunable** and should be reviewed on Day 53 of the pilot (mid-pilot retro).

### Why 90s specifically?

The Field Manual's 12-second demo narrative for the Iris Inbox: "Three pending drafts. Each card: one-sentence summary, fully written action, confidence badge, three citations. He hits Approve, Approve, Approve." Three approvals in ~12 seconds = 4 seconds per approval *during a demo*. In production, with real consequences, multiply by ~20× = 80 seconds. Round up to 90.

Above 90s = user is reading the entire payload because they don't trust the summary. Below 30s is suspicious (rubber-stamping). The healthy band is 30–90s; we gate at the upper bound.

### Soft-fail variant

If average is in [90s, 120s], gate is **soft-fail** (yellow): pilot continues but Day 60 close requires explicit Walker sign-off + a written remediation note (likely "voice + summary tightening" task carried into Lap 3). Above 120s is hard-fail.

---

## Gate 4 — Security/audit incidents (0 tolerance)

### What counts as an incident

Any one of:
1. `verify_audit_chain()` SQL function returns `FALSE` for any row in the pilot window
2. An entry in `audit_incidents` table (new — see § Migration) with `severity IN ('high', 'critical')`
3. A `drafted_action` with `viewer_user_id` set to a user who is NOT in `pilot_user_ids`
4. A `drafted_action` row whose `payload` contains a citation referencing an entity the viewer doesn't have RLS access to (data-leak class)
5. Any LLM key found in a `dist/` build artifact during the pilot window (existing release-time grep; this just continues to be enforced)

### Migration

```sql
-- Migration: 20260504010001_audit_incidents.sql
CREATE TABLE audit_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,  -- 'chain_break', 'rls_leak', 'unauthorized_decision', 'key_leak', 'other'
  description TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE INDEX idx_audit_incidents_detected_severity
  ON audit_incidents(detected_at, severity)
  WHERE resolved_at IS NULL;
```

### Why "zero" and not "≤ N"

Lap 1 nailed the load-bearing infrastructure: hash-chain, RLS, key-grep. Lap 2 doesn't add new attack surface — it adds new content. A single incident in pilot is a regression we caused, and the fix MUST land before we can call the gate passed. This is non-negotiable per Eleven Never #1 ("Ship Iris that acts without human approval") and #5 ("Let LLM keys into the browser bundle").

---

## Gate 5 — "I don't want to go back" (qualitative capture)

This is the gate. The other four are infrastructure for this one.

### What counts

A message — text, voice memo, email, in-person quote relayed by Walker with a timestamp — from a pilot PM (not the technical sponsor, not the super, not Walker) that:

1. Is **unprompted**. Walker did not ask "how's it going" or "would you keep using this." The PM volunteered the sentiment.
2. Conveys the substance of "I don't want to go back to my prior workflow." Exact wording optional. Compatible phrases: "this is my new normal," "how did I work without this," "I'd quit if you took this away," "we're never going back to Procore for this." Any phrase that asserts a one-way preference for SiteSync over the prior status quo, captured spontaneously.
3. Refers to **Iris specifically** or to the SiteSync workflow Iris enables (drafted RFI follow-ups, autoDraft daily logs, etc.). Not "I love your app" — that's an aesthetic compliment, not a workflow commitment.

### How Walker captures it

- **Default:** Slack DMs from the pilot PMs are mirrored to a private channel `#pilot-quotes` (manual paste; no auto-pipe). Each message is timestamped.
- **In-person:** Walker writes the quote down within 10 minutes, photo of the notebook page, posted to `#pilot-quotes` with the witness (which super was there).
- **Voice memo:** PM records and sends; Walker transcribes; original audio kept for the audit chain.

### What doesn't count

- A direct answer to a survey question.
- Walker's own internal narration ("I think they really get it") — that's vibes, not data.
- A LinkedIn post from the GC about being innovative — marketing, not workflow signal.
- A super saying it. Supers will love the field UX; a super loving it is necessary but not sufficient. The PM is the buyer. Without the PM's voice, the gate isn't passed.

### What to do if the PM is enthusiastic but doesn't say the magic phrase

The Bugatti standard is honest. If by Day 13 of the pilot the PM hasn't volunteered something equivalent to "I don't want to go back," **the gate hasn't passed** — and that's important data. It means Iris is useful but not loved. Lap 3 changes shape: less "ship hardened executors," more "find the missing 30% of love." Don't fudge the gate.

---

## Failure-mode tree

What happens when one or more gates fail:

```
                         All 5 gates green?
                              /        \
                           YES          NO
                            |            |
                       PASS Day 60    Which gate failed?
                                      /  |  |  |  \
                                     1   2  3  4   5
                                     |   |  |  |   |
                                     |   |  |  |   └── See § Gate 5 — pilot continues 7 more days; if still not captured, pivot Lap 3 to "find the love"
                                     |   |  |  |
                                     |   |  |  └── HARD STOP. Stop pilot. Triage incident. No Day 60 pass until incident root-caused and fixed.
                                     |   |  |
                                     |   |  └── If 90–120s: soft fail. Pilot continues with daily voice/summary tightening. Walker-signoff required for Day 60 pass.
                                     |   |       If > 120s: hard fail. Pilot continues but Day 60 explicitly fails; Lap 3 absorbs voice + summary work as P0.
                                     |   |
                                     |   └── If 60–70%: pilot continues 7 more days; tighten promotion criteria (raise confidence threshold from 0.7 to 0.8) and re-measure.
                                     |        If < 60%: hard fail. Stop pilot. Iris is not ready. Lap 2 doesn't close.
                                     |
                                     └── If 70–99: pilot is short on volume. Extend pilot to 21 days. If still < 100: hard fail.
                                          If < 70: probably the cron isn't firing. Diagnose first; if the bug fix gets us > 100 in 7 days, gate passes on the new date.
```

Document the failure in a Day 60 receipt regardless of outcome. The receipt format mirrors `DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md` — number-by-number table + what changed + what's deferred to Lap 3.

---

## Diagnostic metrics (not gated, but visible)

These don't enter the gate but are visible in the daily 5:30 PM standup feed. If any of these trends badly, expect a gate to fail soon.

| Metric | Source | Healthy range |
|---|---|---|
| Pending-draft median age | `now() - created_at` for `status='pending'` | < 8 hours |
| Edit-then-approve rate | `required_edits=TRUE` / approved | 10–30% (low = rubber-stamping; high = bot is wrong) |
| Decisions-per-inbox-session | `COUNT(*) GROUP BY inbox_session_id` | 3–8 (low = user opens once per draft; high = batching, healthy) |
| Citation-click-through rate | TBD (depends on citation telemetry from `IRIS_CITATIONS_SPEC`) | 20–50% (low = user trusts summary; high = user mistrusts) |
| Withdraw rate | `decision_note LIKE '[withdrawn by system]%'` / total | < 10% (high = state changes too fast for the cron's 15-min cycle) |

---

## CI workflow

New file: `.github/workflows/lap-2-acceptance.yml`. Mirrors `lap-1-acceptance.yml` structure.

```yaml
name: Lap 2 Acceptance Gate

on:
  schedule:
    # Daily at 18:00 UTC (~1 PM Central, after the pilot's morning rush)
    - cron: '0 18 * * *'
  workflow_dispatch:
    # On-demand for Day 60 close
  push:
    branches: [main]
    paths:
      # Re-run if the gate spec or telemetry-sensitive code changes
      - 'docs/audits/LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md'
      - 'supabase/migrations/*_drafted_actions_telemetry.sql'
      - 'supabase/migrations/*_audit_incidents.sql'
      - 'src/hooks/useRecordDraftView.ts'
      - 'src/components/iris/IrisApprovalGate.tsx'

jobs:
  acceptance-gate:
    name: Lap 2 acceptance
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # Required secrets:
    #   STAGING_DB_URL — read-only Postgres connection string to staging
    #   AUDIT_VERIFIER_TOKEN — bearer for the verify_audit_chain RPC
    steps:
      - uses: actions/checkout@v4

      - name: Refresh metrics view
        run: |
          psql "$STAGING_DB_URL" -c \
            "REFRESH MATERIALIZED VIEW CONCURRENTLY lap_2_gate_metrics_daily;"
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}

      - name: Read gate metrics
        id: metrics
        run: |
          ROW=$(psql "$STAGING_DB_URL" -t -A -F'|' -c "
            SELECT approved_count, acceptance_rate_pct, avg_time_to_approve_sec
              FROM lap_2_gate_metrics_daily
              WHERE metric_date = CURRENT_DATE;
          ")
          IFS='|' read -r COUNT RATE LATENCY <<< "$ROW"
          echo "count=$COUNT" >> $GITHUB_OUTPUT
          echo "rate=$RATE" >> $GITHUB_OUTPUT
          echo "latency=$LATENCY" >> $GITHUB_OUTPUT
          echo "[Lap 2 Gate] Approved: $COUNT  Rate: $RATE%  Latency: ${LATENCY}s"
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}

      - name: Verify audit chain integrity
        # verify_audit_chain returns a TABLE of broken rows. Empty result =
        # chain intact. Pass NULL for start_after to walk the whole chain.
        run: |
          BROKEN=$(psql "$STAGING_DB_URL" -t -A -c \
            "SELECT COUNT(*) FROM verify_audit_chain(NULL);")
          if [ "$BROKEN" != "0" ]; then
            echo "::error::Audit chain has $BROKEN broken rows"
            psql "$STAGING_DB_URL" -c \
              "SELECT * FROM verify_audit_chain(NULL) LIMIT 5;"
            exit 1
          fi
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}

      - name: Check for open incidents
        run: |
          OPEN=$(psql "$STAGING_DB_URL" -t -A -c "
            SELECT COUNT(*) FROM audit_incidents
              WHERE resolved_at IS NULL
                AND severity IN ('high', 'critical');
          ")
          if [ "$OPEN" != "0" ]; then
            echo "::error::$OPEN unresolved high/critical incidents"
            exit 1
          fi
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}

      - name: Assert thresholds
        run: |
          COUNT=${{ steps.metrics.outputs.count }}
          RATE=${{ steps.metrics.outputs.rate }}
          LATENCY=${{ steps.metrics.outputs.latency }}

          FAIL=0
          if (( COUNT < 100 )); then
            echo "::error::Approved count $COUNT < 100"
            FAIL=1
          fi
          if (( $(echo "$RATE < 70" | bc -l) )); then
            echo "::error::Acceptance rate $RATE% < 70%"
            FAIL=1
          fi
          if (( $(echo "$LATENCY > 90" | bc -l) )); then
            if (( $(echo "$LATENCY > 120" | bc -l) )); then
              echo "::error::Avg time-to-approve ${LATENCY}s > 120s (hard fail)"
              FAIL=1
            else
              echo "::warning::Avg time-to-approve ${LATENCY}s in soft-fail band [90, 120]"
            fi
          fi
          exit $FAIL
```

The qualitative gate (Gate 5) is NOT in CI — it can't be. The CI job exits successfully if all four programmatic gates are green. The qualitative gate is captured by Walker in the Day 60 receipt with citations to specific timestamped messages.

---

## Test plan for the gate itself

Before Day 60, run a "gate dry run" with synthetic data on staging:

1. Seed 100 drafts in the pilot org with: 75 approved, 20 rejected, 5 withdrawn → expect rate = 75/(75+20) = 78.9%
2. Set `first_viewed_at` and `decided_at` such that average time-to-decide = 60s → expect gate passes
3. Set average time-to-decide = 100s → expect soft-fail warning, exit 0
4. Set average time-to-decide = 130s → expect hard fail, exit 1
5. Insert one `audit_incidents` row with severity='critical' → expect hard fail
6. Set approved_count = 99 → expect hard fail
7. Resolve the incident, set count = 100 → expect pass

These dry runs land in `e2e/lap-2-gate.spec.ts` and run on every push that touches the gate workflow file. (planned)

---

## File-by-file changelog

| Path | Change |
|---|---|
| `supabase/migrations/20260504010001_audit_incidents.sql` | NEW — incident log table |
| `.github/workflows/lap-2-acceptance.yml` | NEW — gate workflow |
| `e2e/lap-2-gate.spec.ts` | NEW — synthetic gate-runs against staging |
| `scripts/seed-lap-2-gate-dry-run.ts` | NEW — seed script for the 7 scenarios above |
| `docs/audits/INDEX.md` | EDIT — add this spec |

---

## Acceptance criteria for this spec to be considered "shipped"

1. Telemetry migration (companion spec) is applied to staging; columns exist
2. `audit_incidents` migration applied
3. `lap-2-acceptance.yml` workflow lives in `.github/workflows/`
4. The 7-scenario dry run passes (can be triggered via `workflow_dispatch`)
5. Walker has a `#pilot-quotes` Slack channel set up for Gate 5 capture
6. INDEX.md updated

---

## What this spec deliberately does NOT cover

- The pilot org bootstrap (covered by `SOFT_PILOT_PLAYBOOK`)
- The cron infrastructure that refreshes the materialized view (covered by `SCHEDULED_INSIGHTS_SPEC` + ADR-003)
- The Lap 3 gate (separate spec, written when Lap 3 starts)
- Auto-rollback of failed gate runs (deferred — for now Walker reads the CI failure and decides)
