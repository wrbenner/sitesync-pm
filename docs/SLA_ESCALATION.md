# SLA Escalation

This is the legal-trail engine for "we tried to reach you N times before this RFI killed our slab pour." It runs on a cron, is fully idempotent, and writes every escalation event to `rfi_escalations` so a GC can defend a time-extension claim with a clean audit log.

## The ladder

Days are **business days**, weekends and project-specific holidays excluded.

| Stage             | Trigger                       | Action                                                    |
| ----------------- | ----------------------------- | --------------------------------------------------------- |
| `t_minus_2`       | 1–2 business days before due  | Soft nudge email to assignee + in-app warn pill           |
| `overdue_first`   | 0–2 days past due             | First overdue email + in-app red rail                     |
| `cc_manager`      | 3–6 days past due             | CC the assignee's `parent_contact_id`                     |
| `delay_risk`      | ≥ 7 days past due             | Day-view delay-risk flag + auto-drafted CO narrative      |

Each stage fires **once per RFI** — a `UNIQUE (rfi_id, stage)` index on `rfi_escalations` enforces it. Re-running the cron after a missed run is a no-op for stages that already fired.

## How idempotency works

The escalator queries "what should have escalated by now," not "what's new since last run."

For each open RFI it computes the current ladder stage, then checks `rfi_escalations` for a matching row. If one exists, skip. Otherwise insert one and enqueue the email. The unique index makes the check trivially fast.

If the cron is down for two days, the next run still produces the right state — the same RFI may receive `t_minus_2` and `overdue_first` in the same run if both were missed.

## Schema

* `rfi_escalations` — append-only event log; columns: `rfi_id`, `project_id`, `stage`, `channel`, `recipient_email`, `recipient_user_id`, `notification_queue_id`, `triggered_at`, `acknowledged_at`, `metadata`.
* `rfis.sla_paused_at` — non-null means the clock is frozen. Required `sla_paused_reason` enforces the audit hygiene.
* `rfis.sla_total_pause_seconds` — accumulated pause seconds, applied on resume so the contractual response window is preserved.
* `directory_contacts.escalation_policy` — `gentle` | `standard` | `silent` per recipient. Default `standard`.
* `directory_contacts.parent_contact_id` — used by the `cc_manager` and `delay_risk` stages.
* `project_holidays` — per-project working-calendar override (Texas vs Quebec, etc.).

## Failure modes covered

* **Email service down (Resend/SendGrid 503):** the function only enqueues. Delivery (and exponential backoff retry) is the `notification_queue` processor's job. The audit row is in `rfi_escalations` regardless, so the GC's "we tried" claim doesn't depend on Resend.
* **Recipient email bounces:** `notification_queue.status = 'bounced'` is surfaced inline on the RFI detail (`RfiSlaPanel` component), with a one-tap edit affordance.
* **Architect on vacation (OOO auto-reply):** the inbound email handler (Postmark) detects `Auto-Submitted: auto-replied` and inserts a `pause` row into `rfi_escalations` with a "OOO acknowledged" note. Resume triggers off the first non-OOO reply. *(planned; not yet wired)*
* **GC actively likes the sub:** mute escalation per-relationship by setting `escalation_policy = 'silent'` (in-app only) or `'gentle'` (only the first overdue email).
* **Cron didn't run:** idempotent recovery — see above.
* **Weekend / holiday:** `businessDaysBetween` excludes them, both in the cron and in the on-screen pill.
* **GC overrode SLA:** "Pause clock" button in `RfiSlaPanel` requires a free-text reason and writes a `pause` audit row. "Resume clock" writes a `resume` audit row.
* **Reply came in by email but didn't thread:** Postmark inbound handler matches by `Message-ID` header first, then by RFI-number-in-subject regex fallback. *(planned)*

## Files

```
src/lib/slaCalculator.ts                 — pure SLA math (used by UI + edge fn)
src/components/conversation/SlaTimer.tsx — colored pill for any due-date entity
src/components/conversation/InboxRow.tsx — unified inbox row used by Conversation
src/components/conversation/RfiSlaPanel.tsx — pause/resume + bounce surface
src/pages/conversation/index.tsx         — aggregates RFIs+Submittals+COs+Punch
supabase/functions/sla-escalator/        — the engine
supabase/migrations/20260429010001_rfi_escalations.sql
```

## Cron setup

In `supabase/config.toml` (or the Supabase dashboard), schedule the function every hour:

```toml
[functions.sla-escalator]
schedule = "0 * * * *"   # top of every hour
```

The function is also safe to invoke directly with the service role key for ad-hoc backfills:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/sla-escalator" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

The response is `{ scanned, fired, skipped, errors }` — log it.
