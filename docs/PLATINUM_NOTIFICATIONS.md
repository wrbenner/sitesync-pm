# PLATINUM · Notifications

Per-user preferences, DND windows with proper DST handling, digest aggregation, and a critical-tier bypass that respects user opt-out.

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| Preferences | `src/lib/notifications/preferences.ts` | `shouldDeliver`, `isInDnd`, `getLocalHourMinute`, `defaultPreferences`. |
| Digest | `src/lib/notifications/digest.ts` | `digest()`, `renderDigestText()` — groups by entity_type, excludes critical. |
| Channels | `src/lib/notifications/channels.ts` | `CHANNEL_META` registry. |
| Types | `src/types/notifications.ts` | `NotificationEvent`, `UserNotificationPreferences`, `DeliveryDecision`, `Digest`. |
| Persistence | `supabase/migrations/20260503120001_notification_preferences.sql` | `notification_preferences` (one row per user). |
| Pages | `src/pages/notifications/InboxPage.tsx`, `PreferencesPage.tsx` | Read-only inbox + matrix editor. |
| Edge function | `supabase/functions/digest-flusher/index.ts` | Cron-driven digest dispatcher. |

## Critical-tier bypass

By spec, `severity === 'critical'` ALWAYS bypasses DND, unless the user explicitly opts out via `bypass_dnd_for_critical: false`. The default value is `true` (DND respected for non-critical, ignored for critical).

This is encoded in `shouldDeliver`:

```ts
if (inDnd && event.severity === 'critical' && prefs.bypass_dnd_for_critical) {
  return { deliver: true, channel: pickChannel(matrix, 'critical'), reason: 'Critical event bypasses DND' }
}
```

Critical events also NEVER enter the digest queue (`digest()` filters them out and surfaces only `critical_count`).

## DST handling

DND windows are HH:MM in IANA timezone. `getLocalHourMinute()` uses `Intl.DateTimeFormat` with `formatToParts` to extract the user's local hour, NOT `Date.toLocaleString` string-math. This handles spring-forward / fall-back correctly.

Tested boundaries:
- US spring-forward 2026-03-08 02:00 → 03:00 CDT
- US fall-back 2026-11-01 02:00 → 01:00 CST

## Wiring required (existing files)

- `src/App.tsx`: register routes `/notifications/inbox` and `/notifications/preferences`.
- Notification queue insertion (e.g., `services/notifications.ts` if it exists, or wherever `notification_queue` rows are created): before insert, call `shouldDeliver(event, prefs, now)`. If the channel is `'digest'`, set the queue row's `channel: 'digest'` and `sent_at: null` so `digest-flusher` picks it up. If the channel is `'none'`, skip insert entirely.
- Cron: schedule `digest-flusher` to run every 5 minutes (see Cron Entries below).

## Failure modes addressed

| Mode | Mitigation |
| --- | --- |
| Critical alert silenced by DND | Default `bypass_dnd_for_critical: true`; user must explicitly opt out. |
| DST spring-forward / fall-back | `Intl.DateTimeFormat` + `formatToParts` (no string-math). |
| Bad timezone string | `getLocalHourMinute` returns `-1`; `isInDnd` returns `false` (fail open: deliver). |
| All-channels-disabled spam | `shouldDeliver` returns `{ deliver: false, channel: 'none' }` rather than queueing. |
| Digest flooding inbox | Critical events bypass digest. Per-event-type matrix lets the user demote noisy event types to digest-only. |

## Failure modes deferred

| Mode | Reason / how to address later |
| --- | --- |
| Per-project preferences | Single user-level row only. Add a `project_overrides` jsonb column when needed. |
| Snooze ("mute for 4 hours") | Not in this wave. Add a `snoozed_until` timestamp column. |
| Channel-level rate-limiting | Push provider should handle this; flusher could too if abuse appears. |

## Cron entries to add

Append to `supabase/migrations/<latest>_cron.sql` (or whichever cron-config migration the project uses):

```sql
SELECT cron.schedule(
  'digest-flusher-5min',
  '*/5 * * * *',
  $$ SELECT net.http_post(
       url:='<EDGE_FUNCTIONS_URL>/digest-flusher',
       headers:='{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
     ); $$
);
```

## Conventions adopted

- Pure preferences logic in `lib/`; the inbox page reads from supabase.
- IANA timezones (no UTC-offset numbers).
- Default = sane (`bypass_dnd_for_critical: true`, `suggestion_frequency: 'occasional'`).

## Known limitations

- The inbox page reads from the existing `notifications` table — schema is owned by another wave; this page only renders rows.
- Push channel ("push") doesn't have a transport adapter wired here; the edge function listening to `notification_queue` row events handles that.
