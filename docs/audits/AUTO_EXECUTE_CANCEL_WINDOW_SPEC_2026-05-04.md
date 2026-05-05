# Auto-Execute Cancel Window UX Spec — Lap 3 Days 66-67

**Date:** 2026-05-04
**Status:** Spec ready. Implementation Days 66-67 (~June 14-15, 2026 tight calendar).
**Companion:** `HARDENED_EXECUTORS_SPEC` (Days 61-65, defines what's being cancelled), `LAP_3_ACCEPTANCE_GATE_SPEC` (Day 90 Gate 4 measures cancel rate).
**Format reference:** `IRIS_CITATIONS_SPEC_2026-05-04.md`. UX + telemetry + edge cases.

---

## TL;DR

Auto-execute fires only when (a) confidence ≥ 0.92, (b) eligibility predicates pass, (c) feature flag on, (d) daily cap not exceeded, AND (e) **a 60-second human cancel window has elapsed without intervention.**

This spec covers: the cancel-window UI (mobile + desktop + email + SMS), the cancel signal mechanics (atomic, idempotent, race-safe), the post-cancel UX (draft reverts to inbox), and the telemetry that feeds Gate 4 zero-cancel verification.

The cancel window is **the trust mechanism.** Without it, auto-execute violates Eleven Never #1 ("Iris drafts; never acts without human approval"). With it, auto-execute is "act with human approval, where approval is defined as not-objecting-within-60-seconds."

---

## The Pattern (and Why It Works)

Construction PMs are mobile-first, glance-driven users. They don't sit at a desk waiting for approval modals. The 60-second window is calibrated for:

- **Push notification** arrives on phone within 1-2 seconds of draft entering eligibility
- **Glance + decide** in 5-15 seconds
- **Action (cancel)** takes 1 tap if needed
- **Inaction** = the system proceeds; no cognitive load if everything looks right

The 60-second budget breaks down:
- 5s: notification delivery latency variance
- 10s: PM glances at phone screen
- 30s: PM reads the draft + decides
- 15s: PM acts if needed (or doesn't)

Below 30s feels rushed. Above 90s feels indefinite. **60s is the calibrated sweet spot.**

---

## Surfaces (where the window lives)

### 1. Mobile push notification (primary surface)

When a draft enters auto-execute eligibility:

```
┌─────────────────────────────────────┐
│ SiteSync                  ⚪ now  │
│                                     │
│ Iris will send RFI #42 follow-up   │
│ to [Architect Name] in 0:60        │
│                                     │
│ [Tap to review]    [Cancel]        │
└─────────────────────────────────────┘
```

- **Title:** SiteSync (always)
- **Subtitle:** action + entity + recipient/target in plain language
- **Countdown:** updates in real time on iOS Live Activity / Android notification
- **Two actions:** "Review" (opens app to draft detail) + "Cancel" (one-tap abort)

### 2. In-app banner (when app is open)

If the user is in the app when a draft enters eligibility, a top-banner appears:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⏱️  Iris will send RFI #42 follow-up in 0:48                       │
│      [Review draft]   [Cancel]                                       │
└─────────────────────────────────────────────────────────────────────┘
```

- Banner doesn't block the rest of the UI
- Countdown ticks
- Banner dismisses when window ends OR action is taken
- Multiple concurrent eligible drafts → stacked banners (max 3 visible; "and 2 more" link)

### 3. Email (fallback for users without push)

If push is not granted (org policy or user preference), email arrives within 5s of draft entering eligibility:

```
Subject: Iris will send: RFI #42 follow-up at 2:14:36 PM
Reply with CANCEL to abort.

You have 60 seconds before this draft fires.

------- Draft preview -------
To: [Architect Email]
Subject: Following up on RFI #42

[Draft body...]
-----------------------------

Cancel: https://sitesync.com/cancel/<token>?signed=...
Review: https://sitesync.com/drafts/<draftId>

This is a system message. Email replies with "CANCEL" abort the draft.
```

- Cancel link is one-time-use, signed JWT, expires at +60s
- Reply-to-cancel: Postmark/SendGrid inbound parsing handles "CANCEL" replies
- Email is async — slower delivery → reduces effective window. Hard truth: email users get 30-50s effective; we display this in their preference settings

### 4. SMS (fallback fallback)

For users without push AND without reliable email (rare; mostly older supers in remote markets):

```
SiteSync: Iris will send RFI #42 follow-up in 60s.
Reply STOP to cancel.
```

Twilio inbound to handle reply.

### 5. Desktop browser notification (when web app is open)

Standard `Notification` API:

```
┌─────────────────────────────────────┐
│ 🔔 SiteSync                         │
│                                     │
│ Iris will send RFI #42 follow-up   │
│ in 0:54.                            │
│                                     │
│ [Cancel]                            │
└─────────────────────────────────────┘
```

---

## Cancel signal mechanics

### Atomicity

The cancel signal is **atomic with the executor's status flag**:

```sql
-- Pseudocode for the cancel RPC
BEGIN;
  UPDATE executor_runs
    SET was_human_cancelled = TRUE,
        status = 'cancelled',
        completed_at = NOW()
    WHERE id = $execId
      AND status = 'pending'
      AND scheduled_at + INTERVAL '60 seconds' > NOW();
  
  -- If we updated zero rows, the window already expired or
  -- something else cancelled. Return appropriate error.
  IF NOT FOUND THEN
    ROLLBACK;
    RETURN 'window_expired_or_already_terminated';
  END IF;
  
  -- Update the underlying draft to remain in 'pending' state
  UPDATE drafted_actions
    SET status = 'pending',
        decision_note = NULL
    WHERE id = (SELECT drafted_action_id FROM executor_runs WHERE id = $execId);
  
  -- Audit chain row
  INSERT INTO audit_log (entity_type, entity_id, action, ...)
  VALUES ('drafted_action', drafted_action_id, 'auto_execute_cancelled', ...);
COMMIT;
```

### Idempotency

Cancel signal received twice (e.g., user clicks Cancel + push notification action both fire) — second call is no-op. Returns `already_cancelled` without error.

### Race condition: cancel arrives during execution

If cancel arrives **after** the executor has begun running but **before** completion:
- Executor checks `cancelToken.aborted` at safe checkpoints (before each external call)
- If aborted between checkpoints: rollback fires; system state restored
- If aborted post-final-side-effect (e.g., email already sent): cannot un-send; show user "Cancelled too late — RFI follow-up already sent. To withdraw, ___."

The "cannot un-send" case is rare (email send is the only side effect that's truly irreversible in our 3 executors). For RFI: send the apology / withdrawal email manually. For daily log: revert by deleting the record + adding audit row. For punch item: re-assign or unassign.

### Race condition: window expired while user was deciding

User taps Cancel at second 61 (after window). The signal arrives but `scheduled_at + 60s` is in the past. The DB CHECK constraint blocks the update; user sees: "Cancel arrived after the window. The draft was [executed/sent]." UI offers: "Withdraw it" → fires withdraw workflow.

---

## Per-user preferences

Each user can configure their cancel-window experience:

```typescript
interface CancelWindowPreferences {
  cancelChannels: {
    push: boolean        // default: true if push permission granted
    email: boolean       // default: true
    sms: boolean         // default: false (opt-in)
  }
  
  pauseOverrides: {
    // User can globally pause auto-execute opt-in temporarily
    pausedUntil: ISODate | null
    pauseReason: string | null  // "vacation", "demo prep", etc.
  }
  
  showWindowDurationInUI: boolean  // default: true (helpful)
                                    // false = "in transit" only (less anxiety)
}
```

Stored in `user_preferences.cancel_window` (JSON column).

---

## Telemetry (feeds Gate 4)

Every cancel-window event is logged. The Lap 3 gate looks for **zero cancels in 7 days** post-opt-in. This view tracks:

```sql
CREATE VIEW cancel_window_metrics AS
SELECT
  organization_id,
  executor_name,
  DATE(scheduled_at) AS metric_date,
  COUNT(*) AS total_eligible_runs,
  COUNT(*) FILTER (WHERE was_human_cancelled = TRUE) AS cancel_count,
  COUNT(*) FILTER (WHERE was_auto_executed = TRUE) AS executed_count,
  AVG(EXTRACT(EPOCH FROM (completed_at - scheduled_at))) FILTER (
    WHERE was_human_cancelled = TRUE
  ) AS avg_seconds_to_cancel,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE was_human_cancelled = TRUE) / NULLIF(COUNT(*), 0),
    2
  ) AS cancel_rate_pct
FROM executor_runs
GROUP BY 1, 2, 3;
```

If cancel rate > 0% in any 7-day window → Gate 4 reset.

---

## Edge cases

### App background / phone locked

If the user's phone is locked: push notification still fires; cancel from the lock-screen action works. iOS Live Activity / Android notification keeps the countdown visible without unlocking.

### App in airplane mode / no network

Push notification queues until network restores. If 60s passes without delivery: executor runs (per the original plan). When network restores: user sees a "this just happened in the background" notification.

This is expected: PM is on a slab in the cellular dead zone; we can't ask them to keep their phone in service. The 60-second window assumes network availability; without it, default-fire is the right behavior.

### Multiple drafts entering eligibility simultaneously

Each gets its own 60s window + own cancel signal. Independent. No batching.

UI displays them stacked: "3 drafts about to fire (all from Brad pilot)." User can tap a single "Cancel all" if needed (we provide; ~5% expected use).

### Walker is on stage demoing while a draft fires

Worst-case scenario: live demo at AGC convention; draft fires mid-demo. Demo rehearsal playbook (per `DEMO_REHEARSAL_PLAYBOOK_SPEC`) mitigates by:
- Demo environment uses dedicated `is_demo = TRUE` flag on org
- Auto-execute is hard-disabled when `is_demo = TRUE`
- Drafts shown in inbox normally during demo

### User opts in mid-window for the first time

User toggles auto-execute ON for the first time. There's a draft already in the inbox at confidence 0.94. Does the cancel-window timer start now (and the draft fires in 60s)?

**Answer: NO.** Toggle-on doesn't retroactively eligibilize existing drafts. New drafts created post-toggle are eligible. Existing drafts continue normal approval flow.

---

## Dark patterns we explicitly avoid

The cancel-window must not feel coercive. Dark patterns we reject:

- ❌ Hiding the cancel button until 50s elapse (forces the user to stare at the timer)
- ❌ Cancel button at low contrast / behind a "..." menu
- ❌ Pre-checked "Don't show again" that disables future cancel windows
- ❌ Email "this is your last chance" subject lines
- ❌ "Iris will be disappointed if you cancel" (real example from another product)

The cancel button is **always visible, always one tap, always equally weighted with Review.**

---

## Walker's testing protocol (Day 67)

Day 67 is FRIDAY before opt-in starts Day 68. Walker tests every surface in the field:

- [ ] **iOS push:** trigger an eligible draft; verify push arrives in < 5s; tap Cancel from lock screen; verify abort
- [ ] **iOS in-app banner:** trigger draft while app is open; verify banner; tap Cancel; verify abort
- [ ] **Android push:** same as iOS
- [ ] **Email:** disable push; trigger draft; verify email; click cancel link; verify abort
- [ ] **Email reply:** trigger draft; reply to email with "CANCEL"; verify abort
- [ ] **SMS:** opt into SMS; trigger draft; reply STOP; verify abort
- [ ] **Desktop:** open web app; trigger draft; verify desktop notification; click Cancel; verify abort
- [ ] **Race condition:** trigger draft; wait 59 seconds; tap Cancel; verify either abort (won race) or "too late" message (lost race) — both acceptable
- [ ] **Network off:** airplane mode; trigger draft; let timer expire; verify executor ran; restore network; verify "this happened" notification arrives
- [ ] **Multiple drafts:** trigger 3 eligible drafts simultaneously; verify 3 separate windows; cancel one + let two fire

Each test pass logged to `docs/audits/cancel-window-test-runs/2026-06-15.md` per the Bugatti standard. (planned)

---

## Performance budgets

| Operation | Budget |
|---|---|
| Cancel signal RPC roundtrip | < 200ms p95 |
| Push notification delivery (mobile) | < 5s p95 |
| Email delivery | < 30s p95 |
| SMS delivery | < 10s p95 |
| Desktop notification fire | < 100ms |
| Cancel button → abort confirmed | < 500ms p95 |

CI fails if any budget regresses by > 20%.

---

## File-by-file changelog

| Path | Change |
|---|---|
| `supabase/migrations/20260614010000_cancel_window_view.sql` | NEW — `cancel_window_metrics` view |
| `supabase/migrations/20260614010001_user_cancel_prefs.sql` | NEW — `user_preferences.cancel_window` JSON column |
| `supabase/functions/cancel-executor-run/index.ts` | NEW — atomic cancel RPC |
| `supabase/functions/cancel-by-email-reply/index.ts` | NEW — Postmark inbound webhook |
| `supabase/functions/cancel-by-sms-reply/index.ts` | NEW — Twilio inbound webhook |
| `src/components/iris/AutoExecuteCancelBanner.tsx` | NEW — in-app banner with countdown |
| `src/components/iris/AutoExecuteToggle.tsx` | EDIT — add channel preferences (planned) |
| `src/hooks/useCancelExecutor.ts` | NEW |
| `mobile/src/lib/push-notifications.ts` | EDIT — add cancel-window notification format |
| `mobile/src/lib/live-activities.ts` | NEW — iOS Live Activity for countdown |
| `e2e/cancel-window.spec.ts` | NEW — full E2E for all 5 surfaces |
| `docs/audits/INDEX.md` | EDIT |

---

## Acceptance criteria for this spec to be "shipped"

1. All 5 cancel surfaces implemented + tested in Walker's protocol
2. Cancel signal is atomic + idempotent + race-safe
3. Cancel rate is queryable via `cancel_window_metrics` view
4. Edge case behaviors documented (background, network-off, multiple drafts) and tested
5. Walker's Day 67 testing protocol runs cleanly
6. Day 68 opt-in begins; first eligible draft fires under the protocol

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CW-1 | Push notification delivery slow (> 30s); user can't cancel in time | Low-Medium | Medium | Email + SMS fallbacks; per-user preference for "extend window if push delivery > Xs" — defer to Lap 4 |
| CW-2 | Cancel signal arrives mid-execution; rollback partial | Low | High (data integrity) | Cancel-token checkpoints in executor; transactional rollback; tested adversarially |
| CW-3 | User cancels then immediately approves the draft normally; race | Low | Low | Idempotent cancel + idempotent approve; whichever wins the optimistic lock wins |
| CW-4 | User accidentally cancels during demo / important moment | Low | Low | Demo flag disables auto-execute; user can re-trigger via normal approval |
| CW-5 | Email cancel link replayed (token reuse) | Low | Low | One-time-use tokens; signed JWTs with expiry |
| CW-6 | SMS cost blowup (high volume) | Low | Low | SMS opt-in only; per-org daily SMS cap |
| CW-7 | iOS Live Activity fails to update countdown | Low | Low | Push notification fallback; Live Activity is enhancement |

---

## What this spec deliberately does NOT cover

- The executor logic itself (covered by `HARDENED_EXECUTORS_SPEC`)
- The opt-in toggle UX (covered by AutoExecuteToggle component, defined in HARDENED_EXECUTORS_SPEC)
- Voice cancel ("Hey Iris, cancel that") — Lap 4+
- Cancel via Apple Watch — Q3 2027
- Cancel-window analytics dashboard — Walker queries the view directly until Lap 4
