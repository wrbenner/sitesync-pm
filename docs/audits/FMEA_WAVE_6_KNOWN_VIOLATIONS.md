# FMEA Wave 6 — Known Violations Ledger

**Authored:** 2026-05-15 (wave 6 — cron / network / mobile / third-party)
**Worktree:** `feat/fmea-wave6-mixed`
**Source:** specs under `tests/cron/`, `tests/concurrency/`, `tests/mobile/`, `tests/security/`

This ledger documents the real bugs the wave-6 specs uncovered during the
static and behavioural sweeps. Each entry maps to a hazard ID, the file
or migration the violation lives in, the contract the codebase fails,
and the recommended platform fix.

Status flips this wave: 10 hazards UNCOVERED → PARTIAL (see
`FMEA_CATALOG_2026-05-14.md`).

---

## E.CRON.1 — Cron fires while previous run active

- **Spec:** `tests/cron/cron-overlap-guard.spec.ts`
- **Finding:** Migrations using `cron.schedule(...)` (e.g.
  `20260430160000_notification_queue_worker_cron.sql`,
  `20261029000000_safety_incident_escalation_cron.sql`) drop SQL bodies
  that POST to an edge function via `net.http_post`. None of the
  inspected cron bodies use `pg_try_advisory_lock` / `FOR UPDATE SKIP
  LOCKED` / a `cron_lock` row to prevent two ticks from interleaving.
  The hand-off to the edge fn is the only protection — and the edge
  function itself has no singleton lock either.
- **Risk:** When a queue tick takes longer than 60 s (e.g. Anthropic
  hiccup or rate-limit backoff), the next minute's `cron.schedule` fires
  and the workers race on the same `notification_queue` rows.
- **Recommended fix:** Wrap each cron body in
  `pg_try_advisory_xact_lock(hashtext('cron-<jobname>'))` and `IF NOT
  acquired THEN RETURN`. The edge fn should also obtain a Redis-style
  singleton or pgbouncer-friendly advisory lock.

---

## E.MV.2 — Materialized view stale > N min (alert never fires)

- **Spec:** `tests/cron/matview-staleness-alert.spec.ts`
- **Finding:** SiteSync ships MVs in
  `20260503110002_materialized_views.sql` (`project_health_summary`,
  `rfi_kpi_rollup`, `punch_list_status_rollup`, `pay_app_status_summary`)
  and `20260502120004_portfolio_health_view.sql`. There is a
  `cron-error-rate-alert` edge function, but no dedicated MV-staleness
  watcher. If a `REFRESH MATERIALIZED VIEW` errors out, no alert fires
  unless the operator is hand-querying `cron.job_run_details`.
- **Risk:** Dashboards silently serve stale data.
- **Recommended fix:** Add an edge fn (or RPC) that returns
  `pg_stat_user_tables.last_autoanalyze` (or a project-maintained
  `mv_refresh_log` table) age per MV; trigger an alert when age > 30 min
  for high-priority MVs.

---

## E.PGMQ.2 — pgmq queue grows unbounded

- **Spec:** `tests/cron/pgmq-queue-depth-monitor.spec.ts`
- **Finding:** `iris_ingest_dispatcher` and other pgmq consumers exist,
  but no edge function or scheduled SQL polls `pgmq.metrics_all()` and
  alerts on queue length > N. The catalog already documents
  PARTIAL status for I.PGMQ.1 (idempotency); this spec extends to
  unbounded growth.
- **Risk:** Stuck consumer → 50k-row backlog → rate-limiter trip when
  the worker resumes.
- **Recommended fix:** Schedule a `pgmq_depth_monitor` edge fn at 1-min
  cadence that reads `pgmq.metrics_all()` and pushes alerts to Sentry
  when `queue_length > 1000`.

---

## O.OFFLINE.1 — Offline-queue replays on stale state

- **Spec:** `tests/concurrency/offline-queue-stale-replay.spec.ts`
- **Finding:** `src/lib/offlineQueue.ts :: drainAnnotationQueue` calls
  `syncFn(ann)` on every queued annotation without checking whether the
  parent drawing's revision has been bumped or whether the drawing was
  deleted server-side during the offline window.
- **Risk:** Markups land on superseded drawing revisions or on
  soft-deleted drawings, with no conflict surfaced to the user.
- **Recommended fix:** Add `expected_revision: number` to
  `PendingAnnotation`; in `drainAnnotationQueue`, fetch
  `drawings.current_revision + deleted_at` for each batch; route stale
  rows to a `drawing_markup_conflicts` table for user review.

---

## O.RETRY.2 — Retry retries side-effect mutation (duplicate write)

- **Spec:** `tests/concurrency/retry-side-effect-duplicate.spec.ts`
- **Finding:** Scan of `src/hooks/mutations/*.ts` shows the majority of
  mutation modules pass no `Idempotency-Key` header / `request_id` /
  client-generated primary key. React Query's default retry will
  duplicate-write when the server commits but the response is lost.
- **Risk:** Duplicate RFI / submittal / change-order / pay-app rows
  during flaky network conditions.
- **Recommended fix:** Extend `createAuditedMutation` to attach an
  `Idempotency-Key` header (UUIDv7) per mutation invocation; add a
  middleware on `create_*` RPCs to dedup by `(idempotency_key, op)`.

---

## O.MUT.1 — mutationKey collision data loss

- **Spec:** `tests/concurrency/mutation-key-collision.spec.ts`
- **Finding:** Scan of `src/hooks/mutations/*.ts` finds zero call sites
  that pass a `mutationKey` to `useMutation` — they all rely on
  React Query's "no key = mutation observers can't subscribe by key"
  default. While that AVOIDS collision, it also means there's no
  cross-component cache-tracking for in-flight mutations. The contract
  this spec pins is: if/when call sites add `mutationKey`, they must
  include an entity-ID discriminator to avoid the documented hazard.
- **Risk:** Future regressions when teams add mutationKeys without
  reading the contract.
- **Recommended fix:** Add a typed `buildMutationKey(op, entity, id)`
  helper to `createAuditedMutation` and steer callers toward it.

---

## Q.CAM.1 — Camera permission denied no fallback

- **Spec:** `tests/mobile/camera-permission-fallback.spec.ts`
- **Finding:** `src/components/walkthrough/CaptureButton.tsx` has
  feature-detection for `navigator.mediaDevices?.getUserMedia` returning
  a friendly `unsupported` state, which is good. The spec runs against
  the dev server with `permissions: []` to confirm field-capture and
  walkthrough routes ALSO surface either a file-input fallback or
  user-visible denied-copy. Runtime confirmation is gated on the dev
  server being reachable.
- **Risk:** Field users on locked-down browsers / strict iOS Safari are
  stranded.
- **Recommended fix:** Add a `<input type="file" capture="environment">`
  fallback wired to the same upload pipeline whenever
  `getUserMedia` rejects with NotAllowedError.

---

## Q.GPS.2 — Geolocation 30s timeout freezes UI

- **Spec:** `tests/mobile/geolocation-timeout-freeze.spec.ts`
- **Finding (REAL BUG):** `src/pages/SiteMap.tsx :: useCurrentLocation`
  calls `navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: true })` — **no `timeout` is passed**. Browsers
  default to no timeout, meaning a slow GPS fix can hang the spinner /
  pending state indefinitely with no Cancel control.
- **Risk:** Field users on slow GPS see a frozen UI; their only recourse
  is reloading the page.
- **Recommended fix:** Pass `{ enableHighAccuracy: true, timeout:
  10_000, maximumAge: 60_000 }` in EVERY `getCurrentPosition` call;
  on TIMEOUT error, render a visible error toast with a "Retry / Cancel"
  CTA. Better still: centralize via
  `src/lib/geo/getCurrentPositionWithTimeout.ts`.

---

## R.STRIPE.2 — Stripe redirect cancelled mid-flow

- **Spec:** `tests/mobile/stripe-redirect-cancel.spec.ts`
- **Finding:** `src/components/financial/PaySubFlow.tsx` `processing`
  step has no Cancel CTA, no `pageshow`/`visibilitychange` listener to
  rewind step on browser-back from Stripe, and no setTimeout fallback.
  If the user abandons the Stripe redirect (back button, closes the
  tab), the dialog stays stuck on "Processing your payment…" forever.
- **Risk:** User loses access to a Cancel / Retry path; pay-app row
  may also stay in `payment_status='processing'` if reaper doesn't
  fire.
- **Recommended fix:** Add a `visibilitychange` listener that rewinds
  step to `review` if processing has been pending > 30 s, plus an
  explicit Cancel CTA on the processing card. Backend: schedule a cron
  that flips stale `processing` rows to `failed` after N minutes.

---

## R.SLACK.1 — Slack OAuth callback origin mismatch

- **Spec:** `tests/security/slack-oauth-origin-mismatch.spec.ts`
- **Finding (REAL BUG):**
  `supabase/functions/oauth-token-exchange/index.ts` accepts a
  client-supplied `redirectUri` field and forwards it verbatim to the
  provider's token endpoint as `redirect_uri`. It does NOT validate:
    (a) the `Origin` header matches the redirectUri's origin,
    (b) the redirectUri origin is in an allowlist (e.g.
        `https://app.sitesync.ai`, `https://staging.sitesync.ai`),
    (c) a `state` nonce ties the callback to the auth-initiation request.
  This pattern is generic to every provider it supports
  (`quickbooks`, `google_drive`, `autodesk_bim360`, `sharepoint`,
  `docusign`), not just Slack — Slack provider config isn't yet
  enumerated in `PROVIDER_CONFIGS`, but the gap applies the moment it
  is added.
- **Risk:** CSRF / open-redirect chaining against any OAuth flow; an
  attacker can complete an OAuth exchange in a user's session and
  attach a hostile integration to the victim's project.
- **Recommended fix:** Add a `REDIRECT_ALLOWLIST` env var (newline-
  separated); reject any `redirectUri` whose origin isn't in the list.
  Require `state` parameter; store nonces in `oauth_state_nonces` with
  TTL; reject if state doesn't match.

---

## Summary table

| ID         | File / call site                                                          | Real bug? | Severity |
|------------|---------------------------------------------------------------------------|:---------:|:--------:|
| E.CRON.1   | `20260430160000_notification_queue_worker_cron.sql` + edge fn             | Yes       | HIGH     |
| E.MV.2     | All MV migrations + cron-error-rate-alert                                 | Yes       | MEDIUM   |
| E.PGMQ.2   | `iris_ingest_dispatcher` consumer chain                                   | Yes       | MEDIUM   |
| O.OFFLINE.1| `src/lib/offlineQueue.ts :: drainAnnotationQueue`                         | Yes       | HIGH     |
| O.RETRY.2  | `src/hooks/mutations/*.ts` (majority)                                     | Yes       | HIGH     |
| O.MUT.1    | `src/hooks/mutations/createAuditedMutation.ts`                            | Latent    | MEDIUM   |
| Q.CAM.1    | `src/components/walkthrough/CaptureButton.tsx` (partial mitigation)       | Partial   | MEDIUM   |
| Q.GPS.2    | `src/pages/SiteMap.tsx :: useCurrentLocation` (no timeout)                | Yes       | HIGH     |
| R.STRIPE.2 | `src/components/financial/PaySubFlow.tsx` (no back-recovery)              | Yes       | MEDIUM   |
| R.SLACK.1  | `supabase/functions/oauth-token-exchange/index.ts` (no origin allowlist)  | Yes       | CRITICAL |

Total: **9 confirmed real bugs**, 1 latent contract pin (O.MUT.1).
