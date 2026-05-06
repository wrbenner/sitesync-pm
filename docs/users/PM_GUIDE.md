# Project Manager Guide

You orchestrate the project. SiteSync gives you one inbox of ball-in-court items and one screen for the project's financial state. The rest is filtering on the same data.

## Your home is The Conversation

The Conversation is the inbox of everything waiting on a person. Per [docs/THE_FIVE.md](../THE_FIVE.md), it is the union of:

- RFIs awaiting your response
- Submittals awaiting your review
- Change orders pending sign-off
- Punch items needing your routing
- Meeting follow-ups

Each retains its dedicated route (e.g., `/rfis`) and contractual numbering. The Conversation is a filter, not a replacement.

## Daily rhythm

### Morning

1. Open the dashboard at [src/pages/dashboard/index.tsx](../../src/pages/dashboard/index.tsx). The risk score per project is computed by [src/lib/riskEngine.ts](../../src/lib/riskEngine.ts).
2. Open The Conversation. Sort by ball-in-court SLA. The SLA calculator is [src/lib/slaCalculator.ts](../../src/lib/slaCalculator.ts); see [docs/SLA_ESCALATION.md](../SLA_ESCALATION.md) for escalation rules.
3. Iris will surface up to three suggestions per entity per the policy in [src/lib/iris/suggestPolicy.ts](../../src/lib/iris/suggestPolicy.ts):
   - "RFI awaiting response > 5 days — Iris drafted a response, review?"
   - "Punch item open > 7 days — Iris drafted a follow-up to the sub"
   - "CO over $50k without a quote — Iris suggested asking the sub for backup"

   You accept, modify, or reject. Iris does not act on its own; the approval flow writes to the drafted_actions audit table per [supabase/migrations/20260427000010_drafted_actions.sql](../../supabase/migrations/20260427000010_drafted_actions.sql).

### Mid-day

4. Review yesterday's daily log if you didn't end-of-day it. The log auto-draft pipeline is in [src/lib/dailyLogDrafting/index.ts](../../src/lib/dailyLogDrafting/index.ts).
5. Triage walk-through captures from the super into the punch list. The capture queue is [src/pages/walkthrough/SessionView.tsx](../../src/pages/walkthrough/SessionView.tsx); approval routes captures into `punch_items` rows.

### End of week

6. Run the pay-app pre-submission audit. The five checks are in [src/pages/payment-applications/auditChecks.ts](../../src/pages/payment-applications/auditChecks.ts):
   - All subs have non-pending lien waivers for the period
   - All subs have COI active for the period
   - G702 header total reconciles to G703 line totals (≤ $1 drift)
   - No SOV line bills > 100% of scheduled value
   - Retainage math is consistent
7. Review the schedule integrity report at [src/lib/schedule/integrityCheck.ts](../../src/lib/schedule/integrityCheck.ts). Issues with status `unanalyzed` are not red — they mean we haven't seen logic yet, not that logic is bad.

## Pay applications

The pay-app detail page is at [src/pages/payment-applications/PayAppDetail.tsx](../../src/pages/payment-applications/PayAppDetail.tsx). Components:

- G702 preview: [src/pages/payment-applications/G702Preview.tsx](../../src/pages/payment-applications/G702Preview.tsx)
- SOV editor: [src/pages/payment-applications/SOVEditor.tsx](../../src/pages/payment-applications/SOVEditor.tsx)
- Lien waiver panel: [src/pages/payment-applications/LienWaiverPanel.tsx](../../src/pages/payment-applications/LienWaiverPanel.tsx)
- Pre-submission audit: [src/pages/payment-applications/PreSubmissionAudit.tsx](../../src/pages/payment-applications/PreSubmissionAudit.tsx)

The pre-submission audit is **not yet mounted** in PayAppDetail.tsx per the [STATUS.md](../STATUS.md) wiring backlog. Until that mount lands, run the audit by calling [supabase/functions/payapp-audit/index.ts](../../supabase/functions/payapp-audit/index.ts) directly.

### Money discipline

All AIA arithmetic uses round-half-to-even on integer cents per [docs/PLATINUM_FINANCIAL.md](../PLATINUM_FINANCIAL.md). The audited calculator is [src/lib/payApp/g702Audited.ts](../../src/lib/payApp/g702Audited.ts). Per HONEST_STATE.md, parts of the legacy billing UI use floats — the audited calculator is the source of truth for any disputed number.

### Schedule-vs-pay-app reconciliation

The reconciler is [src/lib/reconciliation/scheduleVsPayApp.ts](../../src/lib/reconciliation/scheduleVsPayApp.ts). Default thresholds:

| Variance | Status |
| --- | --- |
| < 5pp | OK |
| 5–10pp | Minor (warning) |
| 10–20pp | Material (blocks pay-app submission) |
| ≥ 20pp | Critical (blocks always) |

Persisted in [supabase/migrations/20260501120000_pay_app_reconciliation.sql](../../supabase/migrations/20260501120000_pay_app_reconciliation.sql); recompute via [supabase/functions/payapp-reconciliation/index.ts](../../supabase/functions/payapp-reconciliation/index.ts).

## Owner pay-app preview

You can share a read-only pay-app view with the owner without requiring an account. The flow:

1. From the pay-app detail page, click "Share with owner".
2. A magic-link URL is generated (token in URL, hash in DB) per [supabase/migrations/20260501100000_magic_link_tokens.sql](../../supabase/migrations/20260501100000_magic_link_tokens.sql) and [supabase/migrations/20260501120002_payapp_owner_previews.sql](../../supabase/migrations/20260501120002_payapp_owner_previews.sql).
3. Owner opens the link; the page is [src/pages/share/OwnerPayAppPreview.tsx](../../src/pages/share/OwnerPayAppPreview.tsx); validation is [supabase/functions/owner-payapp-preview/index.ts](../../supabase/functions/owner-payapp-preview/index.ts).
4. Token expires 24h after first access.

The public route registration is **pending wiring** per [STATUS.md](../STATUS.md).

## Change orders

The CO auto-drafter generates a CO from a sequence of related events (RFI clarifications, scope-change patterns) per [src/lib/coAutoDraft/index.ts](../../src/lib/coAutoDraft/index.ts). Cost estimation is [src/lib/coAutoDraft/costEstimator.ts](../../src/lib/coAutoDraft/costEstimator.ts); scope-change pattern detection is [src/lib/coAutoDraft/scopeChangePatterns.ts](../../src/lib/coAutoDraft/scopeChangePatterns.ts). Source-RFI linkage is per [supabase/migrations/20260430140000_co_source_rfi.sql](../../supabase/migrations/20260430140000_co_source_rfi.sql) and the auto-CO toggle per [supabase/migrations/20260430140001_auto_co_settings.sql](../../supabase/migrations/20260430140001_auto_co_settings.sql).

## Notifications

Configure your preferences at [src/pages/notifications/PreferencesPage.tsx](../../src/pages/notifications/PreferencesPage.tsx). You can:

- Set DND windows in your timezone (DST handled per [docs/PLATINUM_NOTIFICATIONS.md](../PLATINUM_NOTIFICATIONS.md))
- Allow critical alerts to bypass DND (default on)
- Per-event-type channel matrix (in-app, email, push, digest)

The pure preferences logic is [src/lib/notifications/preferences.ts](../../src/lib/notifications/preferences.ts). The inbox is [src/pages/notifications/InboxPage.tsx](../../src/pages/notifications/InboxPage.tsx). Both pages are pending route registration in [STATUS.md](../STATUS.md).

## Reports

The reports surface generates:

- Monthly owner report: [supabase/functions/monthly-report-generator/index.ts](../../supabase/functions/monthly-report-generator/index.ts) backed by [src/lib/documentGen/monthlyReport.ts](../../src/lib/documentGen/monthlyReport.ts)
- Owner weekly digest: [supabase/functions/owner-weekly-digest/index.ts](../../supabase/functions/owner-weekly-digest/index.ts) backed by [src/lib/documentGen/ownerWeeklyDigest.ts](../../src/lib/documentGen/ownerWeeklyDigest.ts)
- Meeting minutes: [supabase/functions/meeting-minutes-generator/index.ts](../../supabase/functions/meeting-minutes-generator/index.ts) backed by [src/lib/documentGen/meetingMinutes.ts](../../src/lib/documentGen/meetingMinutes.ts)
- Closeout package: [supabase/functions/closeout-package-generator/index.ts](../../supabase/functions/closeout-package-generator/index.ts) backed by [src/lib/documentGen/closeoutPackage.ts](../../src/lib/documentGen/closeoutPackage.ts)

Each generated document carries a SHA-256 content hash so a download two months later proves identical to the original — see [src/lib/documentGen/snapshot.ts](../../src/lib/documentGen/snapshot.ts).
