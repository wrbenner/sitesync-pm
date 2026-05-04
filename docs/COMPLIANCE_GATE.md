# Compliance Gate (Tab C)

**Goal:** prevent the embarrassing pay-app rejection. The story this kills:

> GC submits Pay App #6 for $412k. Owner rejects 3 days later — two subs missing
> lien waivers, one's COI expired mid-period. 100%-preventable.

This doc is the system map and the wiring guide.

---

## Surface area

| Layer       | File                                                                  | Purpose                                                                  |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Logic       | `src/pages/payment-applications/auditChecks.ts`                       | Pure functional rules (5 checks). Deterministic, no I/O.                 |
| Logic       | `src/lib/coi/expirationGate.ts`                                       | Pure helpers for COI reminders + check-in block evaluation.              |
| UI          | `src/pages/payment-applications/PreSubmissionAudit.tsx`               | Pre-submit checklist with Fix-link buttons + override flow.              |
| UI          | `src/components/insurance/CoiBlockBanner.tsx`                         | Red banner shown when a sub's COI lapsed and crew check-in is blocked.   |
| UI          | `src/components/inspection/InspectionFlow.tsx`                        | 2-tap inspector flow: Pass / Fail-with-photo / verbal fallback.          |
| Edge fn     | `supabase/functions/payapp-audit/index.ts`                            | Server-side mirror — authoritative gate for the `submitted` transition.  |
| Edge fn     | `supabase/functions/coi-expiration-watcher/index.ts`                  | Daily 6am cron; sends 14/7/3/1-day reminders + creates blocks at day 0.  |
| Migration   | `supabase/migrations/20260429020000_payapp_audit_overrides.sql`       | `payapp_audit_runs` + `payapp_audit_overrides`.                          |
| Migration   | `supabase/migrations/20260429020001_coi_check_in_block.sql`           | `coi_check_in_blocks`, `coi_expiration_alerts`, COI reminder columns.    |
| Tests       | `src/pages/payment-applications/__tests__/auditChecks.test.ts`        | 16 cases covering all 5 rules + name matching + summary aggregation.     |

---

## The five checks

| ID                          | Trigger                                                       | Fix link                                       |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `lien_waivers_present`      | Sub has billed work this period but no non-pending waiver     | `/payment-applications?tab=lien_waivers&app=…` |
| `coi_active_for_period`     | Sub has billed work but no verified COI covering the period   | `/insurance?app=…`                             |
| `g702_g703_reconcile`       | Sum of G703 line totals ≠ G702 header total (>$1 drift)       | `/payment-applications?app=…&edit=g703`        |
| `sov_percent_under_100`     | Any SOV line bills > 100% of scheduled value                  | `/payment-applications?app=…&edit=g703`        |
| `retainage_math_correct`    | `total_completed × retainage_percent` ≠ `retainage_amount`    | `/payment-applications?app=…&edit=g702`        |

The Submit button stays disabled until all five pass — OR the PM checks
"I accept these gaps", types a reason ≥ 12 characters, and the override is
written to `payapp_audit_overrides` with the failed check ids and the user.

---

## COI gate flow

```
T-14d ─────── T-7d ─── T-3d ─ T-1d ─── T0 (expiry) ───→
   │            │       │      │         │
   │            │       │      │         └─ coi_check_in_blocks row inserted by cron
   │            │       │      │            UI: CoiBlockBanner replaces the check-in CTA
   │            │       │      │
   └─ reminder emails (4 thresholds, deduped via reminder_thresholds_sent[])
```

Every reminder writes a `coi_expiration_alerts` row even if no email could be
sent — so the PM has a paper trail. If `RESEND_API_KEY` / `send-email` is
unavailable, alerts are still logged with `delivery_status = 'no_email_configured'`.

The block clears the moment a new verified cert is uploaded (handled by the
existing insurance upload flow; it should null-out the block via the cleanup
trigger added in a follow-up — see "Wiring Required" below).

---

## Wiring Required (for the user to do later)

These are the integration points this tab intentionally did **not** touch
(file boundaries — Tab C only adds files, never edits existing ones):

1. **`src/pages/payment-applications/index.tsx`** — import and mount
   `PreSubmissionAudit` inside the pay-app detail view, replacing the existing
   "Submit to Owner" button. Pass it `AuditInput` built from `usePayAppSOV` +
   `useLienWaivers` + `useInsuranceCertificates`. On submit, POST to
   `/functions/v1/payapp-audit` with `{ payment_application_id, override? }`.
   - Suggested mount point: just above the existing `WorkflowTimeline` in
     `PayAppDetail.tsx` (~ line 80).

2. **`src/pages/site/check-in.tsx`** (or whichever route hosts crew check-in)
   — render `CoiBlockBanner` at the top, gated on
   `useQuery(['coi-blocks', projectId])`. The banner is a no-op when the
   `blocks` array doesn't include the current sub — drop it into the page
   unconditionally.
   - The Tab boundaries forbid touching the existing check-in route.

3. **`src/App.tsx`** — register the new edge function endpoints in any
   global API client config (currently each page calls `supabase.functions.invoke`
   directly, so likely no change is needed).

4. **`supabase/config.toml` (or pg_cron migration)** — schedule
   `coi-expiration-watcher` to run daily at 6am UTC. The existing
   `insurance-alerts` cron is the template (see `supabase/migrations` for the
   pg_cron schedule pattern).

5. **`useInspectionFlow` integration** — `InspectionFlow.tsx` accepts a
   prop-driven `onComplete(result)` and `onCapturePhoto()`. The page that
   hosts inspections (likely a future `src/pages/inspections/` route) needs
   to wire those to:
   - punch_items insert (on fail)
   - daily_log_entries insert (always)
   - send-notification edge function (on fail, to the spec-section sub)
   - photo upload to storage (on Fail-with-photo)

---

## Known limitations / Failure modes deferred

1. **Sub identity is name-based, not id-based.** `lien_waivers` stores
   `contractor_name` as text — no FK to a subs table. We use case-insensitive
   substring matching (`namesMatch`) to bridge. A follow-up should add
   `subcontractor_id uuid` to `lien_waivers` + `payment_line_items` and switch
   to id-based matching. The current heuristic is documented in tests
   (see `auditChecks.test.ts > namesMatch`).

2. **Verbal evidence 24h follow-up prompt is not auto-scheduled.** The spec
   says inspections logged with `evidence: 'verbal'` should prompt the super
   for a follow-up photo within 24h. The current implementation marks the
   evidence verbal but does not yet enqueue a reminder. A follow-up should
   add a row to a `pending_evidence_followups` table + a daily cron that
   surfaces them in the daily-log "needs attention" lane.

3. **Email delivery falls back to the notifications table only.** If
   `send-email` is not configured (no `RESEND_API_KEY`), reminders log to
   `coi_expiration_alerts` with `delivery_status = 'no_email_configured'` and
   write a notifications row, but no SMS / push fallback is implemented.

4. **The check-in block does not auto-clear on cert upload.** The existing
   COI upload flow needs a trigger or RPC call to set `block_until = now()`
   on the matching block row. Documented in "Wiring Required" #2 above; the
   table has the column ready (`block_until`).

5. **`payapp-audit` edge function uses a name-based contractor aggregation
   off of `lien_waivers`.** If no waivers have been generated yet, the
   contractors-with-billed-work-this-period list will be empty and the
   lien-waiver / COI checks will trivially pass. The UI-side check uses the
   richer `AuditInput` shape that the host page is responsible for building
   (see Wiring Required #1) so the gate is enforced end-to-end on the
   client. Server-side hardening to query a contracts/subcontracts table
   directly is a follow-up.

6. **Override reason length is enforced at 12 chars.** The DB CHECK
   constraint, the service-layer validator (`validateOverrideReason`), and
   the React component all share this number. Bumping the floor is one
   line in three places.

---

## Conventions adopted

For future tabs that touch this surface:

- **Pure logic in lib/, side-effecting code in services/.** All audit rules
  and COI helpers are pure functions. No Supabase imports, no React.
- **Result<T> for service-layer validators.** `validateOverrideReason`
  returns the project's standard `{ data, error }` Result so callers can
  surface `userMessage` directly to the UI without swallowing context.
- **Shared `created_via` + `source_drafted_action_id` columns on every audit
  table.** Mirrors the project's existing audit-log conventions and lets
  Iris execute audited actions later without schema churn.
- **Idempotent migrations only.** Every CREATE has IF NOT EXISTS, every
  ALTER ADD COLUMN has IF NOT EXISTS, every RLS policy is wrapped in
  DROP IF EXISTS / CREATE.
- **Stable `CheckId` enum.** UI fix-link routing keys off these strings,
  so don't rename them — add new ones and migrate old ones.
