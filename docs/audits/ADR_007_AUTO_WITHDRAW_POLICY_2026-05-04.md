# ADR-007 — Auto-Withdraw Policy for Stale Drafts

**Date:** 2026-05-04
**Status:** Accepted
**Decider:** Walker
**Related:** `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` (where the withdraw mechanism lives), `IRIS_TELEMETRY_SPEC_2026-05-04.md` (telemetry on withdraws), `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` (withdraws excluded from acceptance-rate denominator)

---

## Decision

When the underlying state of a draft's primary entity changes between the moment Iris drafted the action and the moment a user reviews it, **the draft is auto-withdrawn (status flips to `'rejected'` with `decision_note='[withdrawn by system] <reason>'`), NOT auto-updated, NOT left stale.**

The user opens the inbox to find the draft no longer there (or visible in a "system-withdrawn" filter), with a one-line explanation if they look.

---

## Why withdraw, not update or stay-stale

Three options were on the table:

| Option | What happens | Pros | Cons |
|---|---|---|---|
| **Stay stale** | Draft remains in inbox; user reviews based on outdated facts | Simple. No new code paths. | Highest trust risk. PM approves a draft that's no longer relevant; embarrassed in front of architect/sub. The "Iris is asking me about an RFI I already answered" failure mode. |
| **Auto-update** | Cron re-runs detector when underlying state changes; draft text/citations rewritten in place | User experience: draft "self-corrects." Feels magical when it works. | Audit-trail nightmare: which version did the user actually see when they hit approve? We just changed the artifact mid-decision. The hash chain has to record the rewrite, and the user might not realize the draft they read 30s ago is different now. |
| **Auto-withdraw (chosen)** | Draft flips to `'rejected'` with system note; new draft (if still warranted) appears via the next cron tick | Audit chain stays clean — each draft is one stable artifact, reviewed or not. The "draft stale → withdrawn → fresh draft" lifecycle is legible. User trust preserved: Iris never asks about a thing that no longer matters. | The user might see "Draft X" in the morning email-style summary that's gone by the time they open the inbox. Marginal UX cost. |

Auto-withdraw matches Eleven Never #1: "Ship Iris that acts without human approval." A draft that mutates after the user started reading it is a soft form of acting without approval. We don't do it.

---

## When auto-withdraw fires (per detector kind)

From `SCHEDULED_INSIGHTS_SPEC` § Phase 4 — locked here as the policy:

| Detector | Withdraw if... |
|---|---|
| `cascade` | The triggering RFI moved out of `'open'` (answered, voided, withdrawn by user) |
| `aging` | The aged entity moved out of its aged state (RFI answered, daily log filed, submittal stamped) |
| `variance` | The variance was reconciled (budget item updated to actuals match estimate, schedule re-baselined) |
| `staffing` | The staffing gap was closed (crew assigned to the activity, or required-hours updated to match available crew) |
| `weather` | The weather window passed without action (forecast date is now in the past) |

Every other action_type follows the same pattern: define "still-relevant" as a SQL predicate on the underlying entity; cron worker checks; if false → withdraw.

---

## Mechanics

### Existing function `withdrawDraft` is the only path

Already exists in `src/services/iris/draftAction.ts`. The cron worker invokes it with a structured reason:

```ts
await withdrawDraft(draft.id, `state-change: ${detector} no longer applies (${specificReason})`)
```

Where `specificReason` includes the entity-specific "what changed" — e.g., `"RFI #42 status changed open→answered at 2026-06-15T14:30:00Z"`.

### The decision_note format is structured

```
[withdrawn by system] state-change: <detector> no longer applies (<specificReason>)
```

Telemetry queries (per `LAP_2_ACCEPTANCE_GATE_SPEC` and `IRIS_TELEMETRY_SPEC`) recognize the `[withdrawn by system]` prefix and exclude these rows from the acceptance-rate calculation. Walker's standup feed surfaces high withdraw counts as a leading indicator that the cron tick interval (currently 15 min) may be too slow.

### Race condition handling

If a user is mid-decision when withdraw fires:
- The withdraw RPC includes `WHERE status = 'pending'` — only pending drafts are withdrawn
- If the user's approve mutation lands first (status → 'approved'), withdraw is a no-op
- If withdraw lands first (status → 'rejected'), the user's approve mutation fails with a clear error message: "This draft was withdrawn because the underlying [entity] was [updated/answered]. The draft is no longer applicable."

The race is resolvable in the user's favor (they keep their approval) when the user wins the race. When the system wins, the user gets a clear explanation.

---

## What the user sees

### Default

Withdrawn drafts disappear from the inbox immediately. No notification. Walker's data shows that ~5% of drafts withdraw on average; surfacing each one would be noise.

### Filter UI (post-Lap 2)

A "View system-withdrawn drafts" toggle in the inbox shows the withdrawn rows with their reasons. Useful for:
- Debugging "why didn't I see that draft from this morning?"
- Auditing the cron's behavior
- Discovering edge cases where the detector withdrew prematurely

This filter is **not in Lap 2 scope.** Lap 2 ships withdraw silently. Filter UI is a Lap 3 quality-of-life feature.

### High-confidence drafts that withdraw frequently

If a `cascade` draft for an RFI gets created at 8 AM, the user starts reading at 8:30, the architect responds at 8:32, and the draft withdraws at 8:33 — that's a degraded experience. The user reads three sentences of a draft that vanishes on them. The pilot will surface these.

Mitigation in Lap 2: cron tick is 15 min, so the worst case is the user sees a draft up to 15 min stale. Tighter than that requires a real-time supabase subscription on the underlying entity, which is Lap 3+.

---

## Telemetry

Three queries Walker's daily 5:30 PM standup feed surfaces:

```sql
-- 1. Withdraw rate by detector (target: < 10%)
SELECT
  detector_kind,
  COUNT(*) FILTER (WHERE decision_note LIKE '[withdrawn by system]%') * 100.0
    / NULLIF(COUNT(*), 0) AS withdraw_pct
FROM drafted_actions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 2 DESC;

-- 2. Withdraws that happened mid-decision (race-condition class)
-- These are the worst kind because the user actively engaged then lost it.
SELECT
  id, action_type,
  first_viewed_at,
  decided_at,
  decision_note
FROM drafted_actions
WHERE decision_note LIKE '[withdrawn by system]%'
  AND first_viewed_at IS NOT NULL
  AND first_viewed_at < decided_at
  AND decided_at > NOW() - INTERVAL '24 hours';

-- 3. Time from create to withdraw (informs the "how stale is too stale" question)
SELECT
  action_type,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (decided_at - created_at))
  ) AS median_seconds_until_withdraw,
  COUNT(*)
FROM drafted_actions
WHERE decision_note LIKE '[withdrawn by system]%'
  AND decided_at > NOW() - INTERVAL '7 days'
GROUP BY 1;
```

If query 2 returns > 0 rows in a single day, Walker investigates. That's an "Iris asked me about something then yanked it" moment — the most trust-eroding pattern.

---

## Edge cases — explicit decisions

| Case | Decision |
|---|---|
| User edits the draft (Cmd+E), then state changes mid-edit | Edit transitions the draft to `'pending_edit'` (a new status — added in companion migration). System does NOT auto-withdraw `'pending_edit'` drafts; the user gets to finish their edit. If they approve, normal flow. If they cancel, status returns to `'pending'` and the next cron sweep may withdraw. |
| Multiple state changes — RFI goes open → answered → re-opened | Cron sweeps every 15 min. At each sweep, the predicate is re-evaluated. If currently open again, no withdraw. (The user saw a brief "answered" status and then it flipped back.) |
| Draft for entity that gets deleted | Withdraw fires. Reason: `state-change: <detector> no longer applies (entity deleted)`. The draft's `related_resource_id` becomes a dangling reference. Migration adds `ON DELETE CASCADE` on the draft → entity link where applicable; for the entity types that don't FK back, the dangling ref is acceptable (the draft is now archival history). |
| User rejected the draft, then state reverts to "still relevant" | A new draft would be created at the next cron tick (no dedupe hit because the prior was rejected, not approved). User sees a fresh draft. |
| User approved the draft, then state changes such that the action no longer applies | Approve already executed; nothing to withdraw. The audit chain shows the approval. The downstream effects (e.g., RFI follow-up email already sent) are real. This is the "human approved" boundary — once crossed, nothing auto-reverses. |

---

## Migration

```sql
-- Migration: 20260504060000_pending_edit_status.sql
-- Adds the 'pending_edit' status used by the edge case above.

ALTER TABLE drafted_actions
  DROP CONSTRAINT drafted_actions_status_check;

ALTER TABLE drafted_actions
  ADD CONSTRAINT drafted_actions_status_check
  CHECK (status IN ('pending', 'pending_edit', 'approved', 'rejected', 'executed', 'failed'));

-- Auto-withdraw RPC is just a wrapper around the existing withdrawDraft;
-- this exposes it as SQL-callable so the cron worker (Deno) can invoke it.
CREATE OR REPLACE FUNCTION withdraw_draft(
  p_draft_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE drafted_actions
    SET status = 'rejected',
        decision_note = '[withdrawn by system] ' || p_reason,
        decided_at = NOW()
    WHERE id = p_draft_id
      AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
```

---

## Test plan

Covered in `SCHEDULED_INSIGHTS_SPEC` test plan, but mirrored here for completeness:

- `withdraw_draft` is a no-op when status is anything but `'pending'`
- Mid-edit drafts (status `'pending_edit'`) are not touched by withdraw sweep
- A rejected draft + restored state produces a new draft on the next cron tick (dedupe doesn't block)
- Race: user approves at T, withdraw fires at T+1ms — user wins, status='approved'
- Race: withdraw fires at T, user's approve at T+1ms — system wins, user sees the rejection error

---

## Update to other docs

- `INDEX.md` → add ADR-007
- `SCHEDULED_INSIGHTS_SPEC` already references this ADR; no edit needed
- `IRIS_TELEMETRY_SPEC` already references the `[withdrawn by system]` prefix; no edit needed
- `LAP_2_ACCEPTANCE_GATE_SPEC` already excludes withdraws from the rate denominator; no edit needed
- `SiteSync_90_Day_Tracker.xlsx` → "Decisions" sheet → new row 13:

| # | Date | Title | Decider | Considered | Rationale |
|---|---|---|---|---|---|
| 13 | 2026-05-04 | Auto-withdraw stale drafts; never auto-update; never leave stale | Walker | Stay-stale (PM sees outdated draft); auto-update (mutates artifact under user's eyes) | Stale drafts erode trust the moment they're approved against the wrong reality. Auto-update violates the "Iris drafts; never acts without approval" principle by silently modifying the artifact mid-decision. Withdraw + new draft is the cleanest audit story. |

---

## Consequences

### Positive

- Audit chain stays clean: each draft is one immutable artifact + one decision
- User trust preserved: Iris never asks about something that no longer matters
- Telemetry tells us when the cron interval is too slow (high mid-decision withdraw rate)
- Eleven Never #1 honored: Iris doesn't act (or modify in-flight drafts) without approval

### Negative

- ~5% of drafts will silently disappear from the inbox between morning email and inbox-open. Most users won't notice; some will look for "the draft I saw earlier." The Lap 3 filter UI addresses this.
- Mid-decision withdraws (race condition) are the worst experience; we mitigate with status checks, but they will happen at ~0.1% rate.

### Neutral

- The 15-minute cron tick is a deliberate trade-off: tighter intervals mean fewer stale drafts but higher LLM cost and infra load. 15 min is the Lap 2 setting; tunable later.
