# Platinum Field

> 6:55am. Super in the basement of a 30-story tower coring through the slab.
> No cell signal. Battery at 18%. Glove still on. He needs to capture: photo,
> voice memo, GPS pin, link to drawing M-401. Today's daily log has to be
> perfect for an OSHA inspection that may show up. If anything drops, he
> loses 20 minutes redoing it. If anything is wrong, he loses days defending
> it later.
>
> This is platinum or it's worthless.

Seven subsystems, one promise: **the field can't tell the difference between
a successful capture and a failed one — because failed captures don't exist.**

## The seven

```
┌───────────────────────────────────────────────────────────────────────┐
│ 1. durableQueue                                                       │
│    IndexedDB write before network. Idempotent replays.                │
│    Exponential backoff to 14 days.                                    │
│                                                                       │
│ 2. signing  (SHA-256 chain)                                           │
│    Daily logs sealed by appending to per-project hash chain.          │
│    Tamper any historical row → every later chain_hash breaks.         │
│                                                                       │
│ 3. visionVerify                                                       │
│    Photo's auto-link gets a sanity check from a vision model.         │
│    "Verified / inferred only / mismatch" — never blocks the link.     │
│                                                                       │
│ 4. multi-source weather                                               │
│    NOAA + WeatherAPI + OpenWeather. Reconcile to median + confidence. │
│                                                                       │
│ 5. geofence (no PostGIS)                                              │
│    JSONB polygon, JS point-in-polygon. Multi-region per project.      │
│    50m default tolerance buffer for GPS drift.                        │
│                                                                       │
│ 6. battery-aware capture                                              │
│    <20% → photoMaxDimension=1920, defer non-critical syncs.           │
│                                                                       │
│ 7. revisions  (edit-after-sign)                                       │
│    Signed log = immutable. Edits become daily_log_revisions rows.     │
│    Trigger blocks UPDATE attempts at the DB level.                    │
└───────────────────────────────────────────────────────────────────────┘
```

## Files

```
supabase/migrations/
  20260501110000_site_geofence.sql        site_geofence + audit_chain_checkpoints
  20260501110001_daily_log_revisions.sql  signed fields + revisions + immutability trigger
  20260501110002_check_in_dispute_status.sql  geofence-flag enum

src/lib/dailyLog/
  signing.ts            SHA-256 chain math
  revisions.ts          diff + chain rows for post-sign edits
  _hash.ts              shared SHA-256 helper
  __tests__/signing.test.ts

src/lib/checkIn/
  geofence.ts           JS point-in-polygon + multi-region tolerance buffer
  __tests__/geofence.test.ts

src/lib/weather/
  reconcile.ts          median + mode + divergence flagging
  multiSource.ts        provider façade (real impls in edge fn)
  __tests__/reconcile.test.ts

src/lib/fieldCapture/
  durableQueue.ts       IndexedDB queue + drainOnce + backoff
  visionVerify.ts       prompt + verdict bucketing
  __tests__/durableQueue.test.ts

src/components/field-capture/
  QueueDepthIndicator.tsx   topbar pill — N queued / N pending review
  BatteryAwareMode.tsx      hook + banner

src/components/dailylog/
  SignaturePadHardened.tsx  immutable-warning + chain-hash preview
  RevisionHistory.tsx        per-edit chain visualizer

public/sw-field-capture.js  service worker (background sync hook)

supabase/functions/
  weather-multi-source/index.ts  fetches all 3 providers, runs reconcile
  vision-verify-link/index.ts    runs vision verifier on a media_link

docs/PLATINUM_FIELD.md  (this file)
```

## Bullet-proofing

| Failure mode | Required handling |
| --- | --- |
| User force-quits app mid-upload | Service worker resumes on next open; queue is persistent (IndexedDB before network). |
| Multiple devices, same user | Items keyed by user+device for inspection; sync dedup by content_hash. |
| Phone clock wrong | `client_recorded_at` recorded; server stamps `received_at`; >5min drift surfaces a banner. |
| Battery dies mid-capture | IDB write happens before encode; on next boot the queue retries the encode + upload. |
| Vision verifier rate-limited | Verification runs async; absent verification = "inferred only" — never blocks the link. |
| Weather sources disagree wildly | Median for temp; mode for precipitation; daily log surfaces "weather confidence: low" with the divergence. |
| Geofence too tight | Per-project `tolerance_m` (default 50m). Override per-sub via dispute_meta resolution flow. |
| Sub legitimately offsite (welding shop) | Multi-region polygon: main site + accessory locations. |
| Signed log discovered to have a typo | "Add revision" with required reason; original sealed; revision visible inline. |
| Service worker not registered (Safari) | Fall back to in-tab queue; warn once: "Background sync unavailable — keep this tab open while syncing." |
| Vision model misclassifies a sub | Confidence < 0.7 → "inferred only" verdict; surfaces "please confirm" with one-tap accept/reject. |
| Site polygon never set | `classifyCheckIn` returns `'no_geofence_set'`; check-ins succeed normally with no dispute flag. |

## Tests

`npx vitest run src/lib/dailyLog src/lib/checkIn src/lib/weather src/lib/fieldCapture`

**59 tests passing across 5 suites.**

- 12 signing tests (canonicalization, chain integrity, tamper detection)
- 6 geofence tests (multi-region, tolerance, no-fence default)
- 8 weather reconcile tests (confidence bands, divergence detection)
- 9 durable queue tests (idempotent enqueue, backoff, dequeue)
- 24 from related dailyLogDrafting (pre-existing)

## v1 scope vs deferred

**v1 (this commit):**
- All 5 pure-logic libs + tests
- 3 migrations applied clean
- 4 UI components: QueueDepthIndicator, BatteryAwareMode, SignaturePadHardened, RevisionHistory
- Service worker stub (background-sync wakeup; auth handoff TODO)
- 2 edge functions: weather-multi-source (provider stubs), vision-verify-link (uses existing routeAI)

**Deferred:**
- Real provider implementations for NOAA / WeatherAPI / OpenWeather (key plumbing)
- SW ↔ tab postMessage auth handoff
- "Set site geofence" UI (admin tool — currently set by direct DB write)
- "Inspect queue" sheet behind QueueDepthIndicator tap (currently no-op)
- PDF export embedding chain hash + verification instructions
- Wiring revision edits into the existing signed-log edit form
