# Push Notifications Spec

**Date:** 2026-05-04
**Status:** Spec ready. Implementation parallel with iOS/Android app builds (Aug 2026).
**Companion:** `IOS_APP_SPEC`, `ANDROID_APP_SPEC`, `AUTO_EXECUTE_CANCEL_WINDOW_SPEC` (the cancel-window timer is the most-prominent push use case)
**Format reference:** Standard mobile-platform notification spec.

---

## TL;DR

5 notification types. Per-user channel preferences. Quiet hours. Action-buttons-from-notification (cancel without opening app). Localized for English + Spanish (US-Spanish primarily, per `BUGATTI_LAUNCH_ROADMAP` Program 3.7 bilingual).

The cancel-window countdown is the highest-stakes notification (per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`); the other 4 types support normal workflow. Must be reliable, deduplicated, and respectful of quiet hours.

---

## The 5 Notification Types

### 1. Auto-execute cancel-window (highest stakes)

**Trigger:** A draft enters auto-execute eligibility (confidence ≥ 0.92, feature flag on, daily cap not exceeded).

**Push content:**
- Title: "SiteSync"
- Body: "Iris will send [draft action] in 0:60"
- Actions: [Cancel] [Review]

**Behavior:**
- iOS: Live Activity countdown updates every 10 seconds
- Android: Foreground Service notification with countdown
- One push per draft; no batching (each draft gets its own window)

**Quiet hours:** OVERRIDES quiet hours (this is action-required; not interruptive enough to skip)

### 2. New draft in inbox

**Trigger:** Iris creates a new draft (any confidence; not just auto-eligible).

**Push content:**
- Title: "SiteSync"
- Body: "[Iris drafted: [action type]]" — e.g., "Iris drafted an RFI follow-up to [architect name]"
- Actions: [Approve] [Reject] [Open]

**Behavior:**
- iOS: standard notification with action buttons from lock screen
- Android: notification channel "New Drafts" — user can disable
- Batched if > 3 in 5 minutes (single notification: "Iris drafted 5 new actions")

**Quiet hours:** RESPECTS quiet hours (sent silently if in quiet hours; user sees on next check)

### 3. Daily standup reminder

**Trigger:** Daily at 5:25 PM project local time.

**Push content:**
- Title: "SiteSync"
- Body: "Daily standup in 5 minutes — [N] drafts decided today"
- Actions: [Open Inbox]

**Behavior:**
- Per-user opt-in (off by default)
- Deduplicated per project per day
- iOS: respects Do Not Disturb

**Quiet hours:** OVERRIDES (it's the start of the standup window; user expects it)

### 4. Payment settlement (post-April 2027 launch of Embedded Payments)

**Trigger:** ACH push completes; sub's account funded.

**Push content:**
- Title: "SiteSync"
- Body: "Payment to [sub] cleared — [$X] for [pay app description]"
- Actions: [View Receipt]

**Behavior:**
- Sent to GC's PM + Sub's primary contact
- Includes link to receipt PDF + audit chain row

**Quiet hours:** RESPECTS (informational, not action-required)

### 5. Critical incident (rare)

**Trigger:** SEV-1 incident affecting customer's data integrity (audit chain break, RLS bypass detected, cyber incident).

**Push content:**
- Title: "SiteSync"
- Body: "Important: Please review your account at [link]"
- Actions: [Open]

**Behavior:**
- Bypasses quiet hours, focus modes, etc.
- Sent only when SEV-1 incident response runbook (per `INCIDENT_RESPONSE_RUNBOOK`) requires customer notification
- Rare; should fire < 1x/year ideally

**Quiet hours:** OVERRIDES (mandatory)

---

## Per-User Preferences

```typescript
interface PushPreferences {
  channels: {
    autoExecuteCancel: boolean    // default: TRUE (always recommended)
    newDraft: boolean             // default: TRUE
    standupReminder: boolean       // default: FALSE (opt-in)
    paymentSettlement: boolean    // default: TRUE
    criticalIncident: boolean     // default: TRUE (cannot be disabled)
  }
  quietHours: {
    enabled: boolean
    startTime: string  // "22:00"
    endTime: string    // "07:00"
    timezone: string   // IANA TZ, auto-detected
  }
  language: 'en' | 'es'  // matches in-app language preference
  perOrgOverrides: Record<string, Partial<PushPreferences>>  // user can have different prefs per org
}
```

Stored in `user_preferences.push` (jsonb column). Synced across devices.

---

## Localization (English + Spanish at GA)

All 5 notification types localized:

```json
{
  "auto_execute_cancel": {
    "en": "Iris will send {{action}} in {{time}}",
    "es": "Iris enviará {{action}} en {{time}}"
  },
  "new_draft": {
    "en": "Iris drafted a {{actionType}} for {{recipient}}",
    "es": "Iris redactó un {{actionType}} para {{recipient}}"
  },
  "standup_reminder": {
    "en": "Daily standup in 5 minutes — {{count}} drafts decided today",
    "es": "Reunión diaria en 5 minutos — {{count}} borradores decididos hoy"
  },
  "payment_settlement": {
    "en": "Payment to {{sub}} cleared — {{amount}}",
    "es": "Pago a {{sub}} liquidado — {{amount}}"
  },
  "critical_incident": {
    "en": "Important: Please review your account at {{link}}",
    "es": "Importante: Por favor revise su cuenta en {{link}}"
  }
}
```

Spanish reviewed by a bilingual super in Walker's network (per `BUGATTI_LAUNCH_ROADMAP` Program 3.7) — construction-specific Spanish vernacular matters.

---

## Action-from-Notification Mechanics

iOS + Android both support action buttons. When user taps:

- **[Cancel]** on auto-execute cancel notification: fires `cancel_executor_run` RPC; notification dismisses; no app open required
- **[Approve]** on new-draft notification: fires `approve_draft` RPC; notification updates to "Approved ✓"; auto-dismisses in 3 sec
- **[Reject]** on new-draft notification: fires `reject_draft` RPC with default reason; same behavior
- **[Open]** on any notification: opens app, deep-links to relevant screen
- **[View Receipt]** on payment notification: opens receipt PDF in browser

For [Approve] / [Reject] without opening app: requires the auth token in the device keychain. If expired, app opens to re-auth.

---

## Reliability + Backoff

Push notifications are best-effort. Our system handles failure:

- **iOS APNs delivery failure:** retry 3 times with exponential backoff
- **Android FCM delivery failure:** retry 3 times
- **Token invalid:** mark user's token as stale; re-issue on next app open

If notification fails to deliver after 3 retries: logged in `notification_failures` table; user's other channels (email + SMS if configured) are tried as fallback.

---

## Telemetry

Per `IRIS_TELEMETRY_SPEC` framework, every notification event logged:

```sql
CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  device_platform TEXT NOT NULL,  -- 'ios', 'android'
  
  -- Lifecycle
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,  -- when device confirms receipt
  opened_at TIMESTAMPTZ,
  action_taken TEXT,  -- 'cancel', 'approve', 'reject', 'open', 'dismissed'
  action_taken_at TIMESTAMPTZ,
  
  -- Outcome
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'failed', 'expired'))
);

CREATE INDEX idx_notification_events_user
  ON notification_events(user_id, scheduled_at);

CREATE INDEX idx_notification_events_type
  ON notification_events(notification_type, scheduled_at);
```

Walker can answer: "What % of notifications get opened?" "What % of cancels fire from notification vs in-app?" "Are users disabling certain types more than others?"

---

## Edge Cases

### User has notification permission denied

We can't send push; gracefully fall back:
- Email (if email opted-in)
- SMS (if SMS opted-in)
- In-app banner on next open

### User has multiple devices

Token registered per device. Each device receives its own push. User's "open" event fires from one device; others auto-dismiss.

### User signs out while notification is queued

Token deactivated; queued notification fails to deliver; logged.

### Notification arrives while phone is in airplane mode

Queued by APNs/FCM; delivered when phone is back online (typical 5 min delay).

### App is killed by OS

Background push wakes the app long enough to update local state; user sees notification.

---

## What Walker Does With This Spec

1. Confirm push notification design matches expectations
2. Identify the bilingual super in network for Spanish localization review
3. Set up Apple Push Certificates + Firebase project (engineer #2 handles)

---

## What Claude Code (engineer #2) Does

- Set up `@react-native-firebase/messaging` for cross-platform push (~1 day)
- Set up notification channels (Android) and categories (iOS) (~1 day)
- Set up local-language strings + i18next/react-intl for the 5 types (~1 day)
- Build the per-user preferences UI (~2 days)
- Build the action-from-notification handlers (~2 days)
- Set up `notification_events` telemetry (~1 day)

Total engineer #2 work: ~8 days.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| PN-1 | APNs / FCM delivery delays > 5s | Medium | Low (action-from-notification still works on next open) | Standard backoff + retry |
| PN-2 | User disables all notifications | Medium | Low | Email + SMS fallback per user preferences |
| PN-3 | Spanish translations have construction-vernacular errors | Medium | Low | Bilingual super reviews before GA |
| PN-4 | iOS Live Activities require iOS 16.1+; older devices | Medium | Low | Fallback to standard notification on older OS |
| PN-5 | Action-from-notification fails (auth expired) | Medium | Low | App opens to re-auth; user proceeds |
| PN-6 | Critical incident notification spam from a bug | Low | High (trust) | Rate-limit by type per user; max 1/hour for incidents |

---

## What this spec deliberately does NOT cover

- Email notifications (covered by `MARKETING_SITE_REWRITE_SPEC` for transactional emails; here we just fall back)
- SMS notifications (Twilio integration; covered separately)
- In-app banner notifications (web app native; rendered by React)
- Watch / Android Auto / Wear OS (year 2)
- Per-org notification policy override (year 2)
