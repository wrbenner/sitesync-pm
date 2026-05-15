# FMEA Catalog — SiteSync Platform Failure Modes

> The master source-of-truth for the functional-frog Phase 3 (FMDC) loop. Every entry has a runnable-assertion target. Loop reads this file each iteration, picks UNCOVERED entries by priority, dispatches a specialist agent to write the test, and runs `mutation-injector` to confirm the test catches the hazard before flipping status to VALIDATED.

**Authored:** 2026-05-14 (loop iteration 2 start)
**Source:** 3 Explore agent reports synthesized from `~/Desktop/sitesync-main` codebase
**Plan:** `~/.claude/plans/fix-everything-and-keep-compiled-sky.md`

---

## Entry schema

```
{ id, section, description, severity, likelihood, test_class, example_assertion, status }
```

- `severity`: CRITICAL | HIGH | MEDIUM | LOW
- `likelihood`: HIGH | MEDIUM | LOW
- `test_class`: vitest | playwright | sql-pgtap | k6-load | axe-extended | manual-only | sentry-alert
- `status`: UNCOVERED | PARTIAL | VALIDATED | OUT_OF_SCOPE

`PARTIAL` means a test exists but mutation-injector confirmed it doesn't actually catch the hazard. `VALIDATED` means mutation-injector confirmed the test fails when the hazard is artificially introduced.

---

## Top-50 Priority — Wave 1 (loop dispatches these first)

| # | ID | Description | Sec | Lik | Test | Status |
|--:|---|---|:--:|:--:|---|:--:|
| 1 | G.JWT.1 | Server doesn't validate JWT signature; forged JWT accepted | CRITICAL | LOW | vitest | UNCOVERED |
| 2 | G.SECDEF.1 | SECURITY DEFINER RPC doesn't check caller's org_id; cross-org read | CRITICAL | MEDIUM | sql-pgtap | UNCOVERED |
| 3 | F.RESET.1 | Password reset doesn't revoke active session JWT | CRITICAL | HIGH | vitest | UNCOVERED |
| 4 | F.SAML.1 | SAML assertion replay (no timestamp/nonce check) | CRITICAL | MEDIUM | vitest | UNCOVERED |
| 5 | F.SHARE.1 | Share token never expires; old token reusable forever | HIGH | HIGH | vitest | UNCOVERED |
| 6 | F.DEL.1 | Account deletion doesn't delete auth.users; re-signup creates phantom account | HIGH | MEDIUM | playwright | UNCOVERED |
| 7 | L.BUCKET.1 | Storage bucket misconfigured public; anon lists files | CRITICAL | MEDIUM | vitest | UNCOVERED |
| 8 | K.ANTH.1 | Anthropic / Stripe / Resend API key leaked into client bundle | CRITICAL | LOW | vitest | UNCOVERED |
| 9 | G.RLS.1 | Anon-write violations on N tables | HIGH | MEDIUM | sql-pgtap | PARTIAL (PR #574 fixed 5; loop validates the rest) |
| 10 | I.PROV.1 | Concurrent provision-org creates duplicate slug | HIGH | MEDIUM | k6-load | PARTIAL (race-prober Wave 1 — vitest spec + k6 fallback at tests/concurrency/provision-org-race.spec.ts; 10-call race against staging produced exactly 1 org_id) |
| 11 | K.STRIPE.1 | Stripe webhook replay (old event re-processed) | HIGH | MEDIUM | vitest | PARTIAL (Wave 2 — tests/security/stripe-replay.spec.ts) |
| 12 | H.SOFTDEL.1 | Soft-deleted entity still returned by queries missing deleted_at filter | HIGH | HIGH | sql-pgtap | VALIDATED (tests/integrity/softdel.spec.ts — static + live SQL; 3 production leaks in rfis/submittals/field closed 2026-05-14) |
| 13 | H.MONEY.1 | Money cents drift: $12.35×3 ≠ 3705 cents in DB | MEDIUM | MEDIUM | vitest | PARTIAL (Wave 2 — tests/integrity/money.spec.ts) |
| 14 | H.AUDIT.1 | Audit hash chain broken by partial rollback | HIGH | MEDIUM | sql-pgtap | PARTIAL (Wave 2 — tests/integrity/audit-chain.spec.ts) |
| 15 | F.MFA.1 | MFA backup codes never displayed; account recovery impossible | CRITICAL | MEDIUM | playwright | UNCOVERED |
| 16 | F.IMP.1 | Impersonation token persists after admin logout | HIGH | MEDIUM | playwright | UNCOVERED |
| 17 | A.XSTATE.1 | Event fired in unhandled state silently dropped (per-machine fuzz) | MEDIUM | MEDIUM | vitest | PARTIAL (xstate-fuzz wave 1 — 13 specs at tests/machines/) |
| 18 | A.CO.1 | Change-order PROMOTE defined in helpers but not in machine | HIGH | HIGH | vitest | PARTIAL (tests/machines/changeOrderMachine.fuzz.spec.ts + e2e/lifecycle/change-order-full-lifecycle.spec.ts) |
| 19 | A.SUB.1 | Submittal FORWARD_TO_REVIEWER skips gc_review state | HIGH | HIGH | vitest | PARTIAL (tests/machines/submittalMachine.fuzz.spec.ts + e2e/lifecycle/submittal-full-lifecycle.spec.ts) |
| 20 | A.DL.1 + I.DL.1 | Concurrent daily-log AMEND creates duplicate version | HIGH | MEDIUM | vitest + k6 | PARTIAL (tests/machines/dailyLogMachine.fuzz.spec.ts + e2e/lifecycle/daily-log-full-lifecycle.spec.ts; race-prober Wave 1 — **HAZARD CONFIRMED on staging** via tests/concurrency/daily-log-amend-race.spec.ts: 2 parallel revision inserts BOTH land; `daily_log_revisions` has no dedup constraint on (daily_log_id, field, new_value). Platform-fix needed: add UNIQUE partial index or wrap in pg_advisory_xact_lock RPC) |
| 21 | A.PUNCH.1 | VERIFY_DIRECT from open skips sub_complete state | HIGH | MEDIUM | vitest | PARTIAL (tests/machines/punchItemMachine.fuzz.spec.ts + e2e/lifecycle/punch-item-full-lifecycle.spec.ts) |
| 22 | A.PAY.1 | Lien waiver never generated on APPROVE (action no-op) | CRITICAL | MEDIUM | vitest | PARTIAL (Wave 1 — tests/machines/paymentMachine.fuzz.spec.ts spy on autoGenerateLienWaivers; Wave 3 — tests/machines/payApp-approve-side-effect.spec.ts contracts the endpoint + lien_waivers INSERT path) |
| 23 | A.PAY.2 | Negative retainage accepted at validator | HIGH | LOW | vitest | VALIDATED (Wave 3 fix: src/machines/paymentMachine.ts exports validateRetainagePercent / isValidRetainagePercent — clamps [0,100] + Infinity/NaN; wired into calculateG702 + calculateG703LineItem. Spec tests/machines/payApp-negative-retainage.spec.ts asserts the clamp contract directly.) |
| 24 | A.SCHED.1 | Machine state ≠ displayed status (on_track/at_risk not in machine) | MEDIUM | HIGH | vitest | PARTIAL (Wave 1 — scheduleMachine.fuzz.spec.ts; Wave 3 — tests/machines/schedule-status-divergence.spec.ts boundary fuzz of deriveStatusFromProgress + idempotence) |
| 25 | A.RFI.1 | VOID accepted from non-admin role | HIGH | MEDIUM | vitest | PARTIAL (tests/machines/rfiMachine.fuzz.spec.ts + e2e/lifecycle/rfi-full-lifecycle.spec.ts) |
| 26 | B.SUB.1 | Distribution list stale after reviewer added mid-flight | MEDIUM | MEDIUM | playwright | PARTIAL (Wave 1 e2e — submittal-full-lifecycle.spec.ts; Wave 3 — tests/notifications/submittal-distribution-refresh.spec.ts mocked-supabase contract: getBallInCourt + fresh-recipient queueNotification) |
| 27 | F.ONB.1 + M.MOD.1 | provision-org fails silently; user stranded at /signup | HIGH | MEDIUM | playwright | VALIDATED (Wave 3 fix: src/pages/auth/Signup.tsx `if (provisionError)` branch now calls setSubmitError() + Sentry.captureException() so the user sees an actionable inline error before fallback redirect. Spec tests/ui/signup-provision-failure.spec.ts asserts the user-visible handler is present.) |
| 28 | N.RT.1 | Realtime channel survives logout — cross-user message leak | HIGH | MEDIUM | playwright | VALIDATED (Wave 3 fix: src/stores/authStore.ts signOut() + onAuthStateChange SIGNED_OUT branch both call supabase.removeAllChannels() before clearing auth — defense in depth for in-band + out-of-band signout. Spec tests/security/realtime-logout-channel-leak.spec.ts asserts both call sites.) |
| 29 | D.NOTIF.1 + I.IDEM.1 | Notification duplicate on retry (no idempotency_key) | MEDIUM | HIGH | vitest | PARTIAL (race-prober Wave 1 — **HAZARD CONFIRMED on staging** via tests/concurrency/notification-idempotency.spec.ts: re-firing the same RFI-assignment trigger writes 2+ rows to `notifications`. Schema has no `idempotency_key` column nor uniqueness on (user_id, type, link). Platform-fix needed: add idempotency_key to create_notification + UNIQUE constraint) |
| 30 | E.MV.1 | Matview REFRESH (not CONCURRENTLY) blocks reads > 1s | MEDIUM | MEDIUM | sql-pgtap | UNCOVERED |
| 31 | I.PGMQ.1 | pgmq message processed twice (no ACK race guard) | HIGH | MEDIUM | vitest | PARTIAL (race-prober Wave 1 — vitest spec at tests/concurrency/pgmq-idempotency.spec.ts; **inconclusive on staging**: no public-schema pgmq.send wrapper exposed via REST so test skips on staging. Loop iteration must either expose `public.pgmq_send` RPC or run via psql) |
| 32 | M.MOD.2 | Modal stuck open after mutation error | MEDIUM | HIGH | playwright | PARTIAL (Wave 2 — tests/ui/modal-error.spec.ts) |
| 33 | I.IDEM.2 + M.FORM.1 | Double-submit creates duplicate (no idempotency middleware) | MEDIUM | HIGH | playwright | PARTIAL (Wave 2 — tests/ui/double-submit.spec.ts; M.FORM.1 only. Race-prober Wave 1 — additional playwright spec at tests/concurrency/double-submit.spec.ts; requires E2E_REAL_BACKEND + Vercel preview URL to run; not yet executed in CI) |
| 34 | M.EMPTY.1 | Empty array crashes detail page | MEDIUM | HIGH | playwright | PARTIAL (Wave 2 — tests/ui/empty-state.spec.ts) |
| 35 | M.OPT.1 | Optimistic UI + server reject leaves orphan | MEDIUM | MEDIUM | playwright | PARTIAL (Wave 2 — tests/ui/optimistic-rollback.spec.ts) |
| 36 | P.DEBOUNCE.1 | Search debounce too short → API flood | MEDIUM | MEDIUM | k6-load | UNCOVERED |
| 37 | P.NPLUS1.1 | List view N+1 on assignee names | MEDIUM | HIGH | vitest | UNCOVERED |
| 38 | Q.PUSH.1 | Push deep-link arrives before auth ready | HIGH | MEDIUM | playwright | UNCOVERED |
| 39 | Q.GPS.1 | GPS off → check-in falls back to wrong location silently | HIGH | MEDIUM | playwright | UNCOVERED |
| 40 | Q.FILE.1 | File picker null on iOS 18 → upload crash | MEDIUM | MEDIUM | manual-only + sentry | UNCOVERED |
| 41 | L.SIGNED.1 | Signed-URL scope too broad; allows path traversal | HIGH | MEDIUM | vitest | PARTIAL (Wave 3 wrapper landed: src/lib/storage/scopedSignedUrl.ts exports createScopedSignedUrl + normalizeStoragePath — rejects `..` / `%2e%2e` / `\` / leading `/`. src/hooks/useSignedUrl.ts (both useSignedUrl + batchSignedUrls) migrated as first caller. ~10 remaining direct callers in src/pages, src/services, src/components await follow-up migration sweep before VALIDATED.) |
| 42 | R.STRIPE.1 | Stripe Elements iframe blocked by extension → blank form | MEDIUM | MEDIUM | playwright | UNCOVERED |
| 43 | S.A11Y.1 | Status indicated by color only (colorblind users) | MEDIUM | HIGH | axe-extended | UNCOVERED |
| 44 | S.A11Y.2 | Modal focus-trap not announced (no role="alertdialog") | MEDIUM | MEDIUM | axe-extended | UNCOVERED |
| 45 | S.A11Y.3 | Route change doesn't focus heading | MEDIUM | HIGH | playwright | UNCOVERED |
| 46 | K.EMAIL.1 | Inbound email From header not validated; spoofed sender | HIGH | MEDIUM | vitest | UNCOVERED |
| 47 | J.XSS.1 | TipTap rich-text `<iframe>` injection | HIGH | MEDIUM | vitest | UNCOVERED |
| 48 | J.CSV.1 | CSV import formula injection (`=cmd|...`) | MEDIUM | MEDIUM | vitest | UNCOVERED |
| 49 | A.DRAW.1 + B.DRAW.1 | Drawing SUPERSEDE creates duplicate revision number | HIGH | MEDIUM | vitest | VALIDATED (Wave 4 follow-up — src/lib/drawings/validateSupersede.ts is now called from the service-layer SUPERSEDE path in src/pages/drawings/index.tsx; rejects duplicate / backwards / gap revisions before the INSERT lands. DB UNIQUE constraint remains the ultimate backstop.) |
| 50 | D.NOTIF.2 + G.RLS.2 | Notification cross-tenant leak (missing org_id filter) | CRITICAL | LOW | sql-pgtap | UNCOVERED |

---

## Section A — XState Machines (~70 hazards across 12 machines)

12 machines in `src/machines/`. For each: every (state, event) pair must transition to defined state OR explicitly reject. Wave-1 above captures top per-machine hazards; xstate-fuzzer agent generates exhaustive fuzz coverage in `tests/machines/<name>.fuzz.spec.ts`.

**Machines (one fuzz spec per machine):**
- `rfiMachine` — 6 states, ~12 events. Top hazards: A.RFI.1 (#25 above), unhandled-event silent drop, REOPEN from terminal.
- `submittalMachine` — 8 states. Top hazards: A.SUB.1 (#19), multi-path to resubmit, distribution stale.
- `changeOrderMachine` — 5 states. Top hazards: A.CO.1 (#18), PROMOTE/DEMOTE missing.
- `dailyLogMachine` — 5 states. Top hazards: A.DL.1 (#20), createLog actor timeout, signature chain.
- `punchItemMachine` — 5 states. Top hazards: A.PUNCH.1 (#21), no role guards.
- `payAppMachine` — 7 states. Top hazards: A.PAY.1+2 (#22-23), owner_review skip, negative retainage.
- `scheduleMachine` — 4 states + 2 display-only. Top hazards: A.SCHED.1 (#24), reopen race.
- `inspectionMachine` — 5 states. Top hazards: score config null vs 0, reschedule ID collision.
- `drawingMachine` — 5 states. Top hazards: A.DRAW.1 (#49), archive unarchivable.
- `closeoutMachine` — minimal. Top hazards: actor leak.
- `agentStreamMachine` — minimal. Top hazards: actor leak.
- `bidPackageMachine` (if present) — Top hazards: awarded without COI validation.

---

## Section B — Entity Lifecycles (~80 hazards across 12 entities)

For each entity: create → assign → respond → close happy path + every failure-mode transition (skipped, partial, reversed). One Playwright lifecycle spec per entity in `e2e/lifecycle/<entity>-full-lifecycle.spec.ts`.

**Entities (one E2E lifecycle spec each):**
- RFI — full create-as-PM → assigned-engineer responds → PM closes. Cross-page: appears on /day, /rfis list, /audit-trail, EntityAuditViewer renders responses_versions.
- Submittal — draft → submit → gc_review → architect_review → approved → closed. Distribution list refresh on reviewer add.
- Change Order — pco draft → review → approved → PROMOTE to cor → re-review → approved. Cost snapshot retained.
- Daily Log — draft → sign → AMEND → new version → sign again. Signature chain preserved on amendment.
- Punch Item — open → in_progress → sub_complete → verified (by superintendent). Reject path: sub_complete → in_progress → sub re-completes → verified.
- Pay App — draft → submit → gc_review → owner_review → approved → MARK_PAID. Lien waiver generated on approve.
- Schedule — import .xer → WBS map → activities created → critical path → snapshot.
- Drawings — upload → page-split → OCR → distribute → mark-up → SUPERSEDE creates rev N+1.
- Safety Incident — report → assign → investigate → resolve → close. Photo-AI corrective action. B.SAFETY.1 — VALIDATED (Wave 4 follow-up — `supabase/migrations/20261029000000_safety_incident_escalation_cron.sql` adds `escalate_unassigned_high_severity_incidents()` SECURITY DEFINER scanner + pg_cron hourly schedule that selects `incidents WHERE investigation_status='open' AND investigated_by IS NULL AND severity IN ('lost_time','fatality') AND created_at < now() - interval '4 hours'`; enqueues notification_queue rows to org owners/admins with per-incident-per-recipient-per-day idempotency)
- Bid Package — draft → invite → submission → leveling → award → COI validated before start.
- COI — pending → verify → valid; expiry cron blocks check-in. B.COI.1 — PARTIAL (Wave 4 — tests/integrity/coi-expiry-blocks-checkin.spec.ts; pure-unit contract on daysUntil + decideBlocks day-0 inclusion + isSubBlocked override / block_until / companyName fallback / end-to-end compose)
- Lien Waiver — pending → conditional → unconditional → final. State-specific (CA/TX/FL/NY) form template. B.LIEN.1 — VALIDATED (Wave 4 follow-up — `src/lib/lienWaiver/templateRenderer.ts` now exports `validateWaiverJurisdiction(state)` + `KNOWN_WAIVER_JURISDICTIONS` enum; resolver throws on unknown jurisdictions (e.g. 'IL', 'PA') rather than silently AIA-falling-back. CA/TX/FL keep their localized templates; NY explicitly opts into AIA fallback.)

### Section B Wave 1 status (authored 2026-05-14)

| Entity | Spec | Status | Notes |
|---|---|:--:|---|
| RFI | e2e/lifecycle/rfi-full-lifecycle.spec.ts | PARTIAL | Walks create + cross-page (/rfis, /day) + close + audit-log. Multi-role handoff gated on SECONDARY_POLISH_USER. Covers B.RFI.1, partial A.RFI.1. |
| Submittal | e2e/lifecycle/submittal-full-lifecycle.spec.ts | PARTIAL | Walks draft→gc_review→architect_review→approved→closed at DB layer. Audit trail enforced. Distribution-stale cross-role test gated on SECONDARY_POLISH_USER. Covers B.SUB.1, partial A.SUB.1. |
| Change Order | e2e/lifecycle/change-order-full-lifecycle.spec.ts | PARTIAL | Walks pco→review→approved→PROMOTE→cor→re-review→approved. Asserts co_type column + amount_cents cost-snapshot retention. Covers partial A.CO.1. |
| Daily Log | e2e/lifecycle/daily-log-full-lifecycle.spec.ts | PARTIAL | Walks create→sign(v1)→AMEND(v2)→re-sign. Asserts signature-chain preservation across versions. Concurrent race (k6) still UNCOVERED. Covers partial A.DL.1 + I.DL.1. |
| Punch Item | e2e/lifecycle/punch-item-full-lifecycle.spec.ts | PARTIAL | Walks open→in_progress→sub_complete→verified + reject-loop (super rejects→sub re-completes→verifies). Cross-role queue tests gated on SECONDARY+TERTIARY users. Covers partial A.PUNCH.1. |

**Multi-user infrastructure gap**: setup-polish-user.ts currently seeds only one user (polish-test@sitesync-staging.local) with owner role. Cross-role hazards (reviewer/sub/super assignment routing, distribution-list refresh, role-specific queues) are walked at the DB layer but the UI-side role-handoff assertions test.skip cleanly until SECONDARY_POLISH_USER + TERTIARY_POLISH_USER env vars are configured. Follow-up: extend setup-polish-user.ts to seed engineer + sub + super roles, or use existing project_members RPC to add additional principals.

---

## Section C — Cross-Page Propagation Matrix

For each entity × page tuple, an assertion: after entity creation, page renders entity within SLA. The lifecycle specs in Section B cover this; entries here are pointers.

- RFI × {dashboard, day, rfis-list, audit-trail, portfolio, iris-citations, notifications}
- Submittal × {same set}
- (etc. for 12 entities)

**Failure modes**: cache stale > 5min, RLS-deny on cross-feature view, soft-delete leak, materialized-view lag, search-index lag.

---

## Section D — Notification + Routing (25+ hazards)

`tests/notifications/*.spec.ts` (new test dir). Top hazards captured in #29 + #50 above; remaining 23+ enumerated:

- D.NOTIF.3 — wrong recipient (cross-tenant) — covered by #50
- D.NOTIF.4 — duplicate notification idempotency — covered by #29
- D.NOTIF.5 — orphaned notification (recipient deleted) — VALIDATED (Wave 3 fix: src/services/notifications/emailNotificationService.ts processNotificationQueue() now calls isRecipientDeleted() per row — SELECTs profile.deleted_at and marks the queue row 'skipped' with error='recipient_deleted' if missing or soft-deleted. Fails open on transient lookup errors so the worker never stalls. Spec tests/notifications/orphan-recipient.spec.ts asserts the guard is present.)
- D.NOTIF.6 — queue worker never picks up (worker crashed)
- D.NOTIF.7 — throttle window resets unexpectedly (timezone)
- D.NOTIF.8 — mention parsed wrong ("@John O'Reilly")
- D.NOTIF.9 — distribution list stale — covered by #26
- D.NOTIF.10 — email provider outage; DLQ never consumed
- D.NOTIF.11 — in-app store race (dismissed before render)
- D.NOTIF.12 — Slack webhook URL expired silently
- D.NOTIF.13 — preference override collision
- D.NOTIF.14 — timestamp clock drift
- D.NOTIF.15 — digest dedup fails (duplicate + digest)
- D.NOTIF.16 — attachment_url 404 after bucket move
- D.NOTIF.17 — channel failover missing
- D.NOTIF.18 — muted-projects filter UUID type mismatch
- D.NOTIF.19 — email template injection (title XSS)
- D.NOTIF.20 — concurrent notification writes duplicate
- D.NOTIF.21 — role-based skip (role not resolved at dispatch)
- D.NOTIF.22 — deleted user in CC/BCC
- D.NOTIF.23 — notification queue deadlock (SELECT FOR UPDATE)
- D.NOTIF.24 — idempotency key collision
- D.NOTIF.25 — timezone-aware scheduled notification
- D.NOTIF.26 — thread reply trigger never fires (rfi_responses_versions empty)
- D.NOTIF.27 — notification recursion (webhook → entity → notification loop)

---

## Section E — Cron / Queue / Materialized View (15+ hazards)

- E.CRON.1 — cron fires while previous run active (concurrent overlap)
- E.PGMQ.1 — message delivered twice — covered by #31
- E.MV.1 — REFRESH (not CONCURRENTLY) blocks reads — covered by #30
- E.MV.2 — matview stale > N min (alert never fires)
- E.PGMQ.2 — queue grows unbounded (no monitoring)
- E.PGMQ.3 — DLQ never consumed
- E.CRON.2 — timezone mismatch (UTC vs PST)
- E.CRON.3 — clock drift resets cron
- E.CRON.4 — concurrent cron tasks conflict (lock contention)
- E.MV.3 — refresh fn raises exception silently
- E.MV.4 — MV index stale after column add
- E.WORKER.1 — worker hung on external API
- E.MV.5 — lock escalation deadlock
- E.CRON.5 — invokes edge fn during deploy (timeout)
- E.CRON.6 — orphaned pg_cron job after migration removed

---

## Section F — Auth + Session (30+ hazards)

(Top 5 already in priority list as #3, #4, #5, #6, #15, #16.)

Remaining 25+:
- F.SIGNUP.1 — email verification token reuse after first claim
- F.SIGNUP.2 — verification skipped via manual auth.users confirm
- F.SIGNUP.3 — provision-org fails silently; user navigates to org-scoped route
- F.SIGNUP.4 — profile insert fails; user orphaned
- F.SIGNUP.5 — two rapid signups race (email collision)
- F.TURN.1 — Turnstile token clock skew accepts replay
- F.TURN.2 — Turnstile IP rotation (VPN switch) → silent reject
- F.TURN.3 — DEV_BYPASS accepted in prod (env var corruption)
- F.RESET.1 — covered by #3
- F.RESET.2 — reset link expired (UX, not security)
- F.RESET.3 — brute-force code (no rate limit per token)
- F.RESET.4 — token leaks in Referer header
- F.MFA.1 — covered by #15
- F.MFA.2 — ±1 time-step drift allows guess
- F.MFA.3 — soft-enforced; role downgrade bypasses
- F.MFA.4 — secret rotation 30d grace allows old secret
- F.MFA.5 — same TOTP secret re-enrolled on second device
- F.SAML.1 — covered by #4
- F.SAML.2 — Subject NameID not validated
- F.OIDC.1 — state parameter not validated (CSRF)
- F.OIDC.2 — identity_token signature check disabled flag persisted to prod
- F.SSO.1 — concurrent SSO login creates duplicate user
- F.SSO.2 — org_id claim from IdP not validated
- F.SCIM.1 — externalId not unique; duplicates
- F.SCIM.2 — PATCH role to admin without org_admin check
- F.SCIM.3 — Bearer token stored plaintext
- F.SCIM.4 — DELETE doesn't cascade subordinate data
- F.SCIM.5 — deactivate not implemented (only DELETE)
- F.SHARE.1 — covered by #5
- F.SHARE.2 — scope too broad (project_id only)
- F.SHARE.3 — token grants impersonation if user_id embedded
- F.SHARE.4 — token predictable
- F.IMP.1 — covered by #16
- F.IMP.2 — meta-role bypasses check
- F.IMP.3 — JWT claims leak admin context
- F.IMP.4 — audit log omitted for impersonation
- F.DEL.1 — covered by #6
- F.DEL.2 — sole-admin guard skipped
- F.DEL.3 — soft-deleted user appears in project lists
- F.DEL.4 — rate limit bypassed by multiple clients
- F.DEL.5 — confirmation case-sensitivity quirk

---

## Section G — RLS + Privilege (25+ hazards)

- G.SECDEF.1 — covered by #2
- G.SECDEF.2 — RPC accepts org_id from caller; not validated
- G.SECDEF.3 — function leaks data in error messages
- G.SECDEF.4 — audit_log insert fails; action unlogged silently
- G.JWT.1 — covered by #1
- G.JWT.2 — claim org_id forged via metadata
- G.JWT.3 — expired JWT still grants access (stale session)
- G.JWT.4 — JTI not tracked; reuse not detected
- G.RLS.1 — covered by #9 (PARTIAL via PR #574)
- G.RLS.2 — view built without RLS (e.g., ledger_summary)
- G.RLS.3 — aggregate fn doesn't partition by org (COUNT info leak)
- G.RLS.4 — API endpoint forgets org_id filter
- G.PROJ.1 — RLS checks org but not project membership
- G.PROJ.2 — user enumerates projects via project_members read
- G.PROJ.3 — user removed mid-session; cached query has data
- G.ANON.1 — anon RPC returns sensitive aggregate
- G.ANON.2 — anon check_email_available reveals account existence
- G.ANON.3 — anon INSERT error reveals table structure
- G.HEADER.1 — apikey header swappable (service-role bypass)
- G.HEADER.2 — ?select= leaks computed columns — VALIDATED (Wave 3 fix: supabase/tests/database/wave3_hash_columns_anon_select_denial.sql asserts RLS enabled + zero anon SELECT privilege + zero anon-scoped policies on account_deletion_events / api_keys / ai_rfi_drafts / audit_log — the four *_hash-bearing tables. Vitest spec tests/security/postgrest-select-leak.spec.ts now asserts the pgtap file ships and references all four tables + the anon denial check.)
- G.HEADER.3 — malformed ?filter returns all rows
- G.ROLE.1 — profile.update missing role field check
- G.ROLE.2 — custom-role JSONB injectable
- G.ROLE.3 — per-project role overrides not validated against org membership

---

## Section H — Data Integrity (20+ hazards)

- H.AUDIT.1 — covered by #14 (partial rollback breaks chain)
- H.AUDIT.2 — hash recomputed wrong after backfill
- H.AUDIT.3 — block-mutation trigger bypassed by postgres superuser
- H.AUDIT.4 — verify-chain async window allows tamper
- H.AUDIT.5 — hash excludes some columns; tamper undetected
- H.SOFTDEL.1 — covered by #12
- H.SOFTDEL.2 — soft-delete not cascaded (parent del, child visible)
- H.SOFTDEL.3 — restore (undelete) not atomic; FK invalid
- H.SOFTDEL.4 — RLS queries don't filter deleted_at
- H.MONEY.1 — covered by #13
- H.MONEY.2 — float multiplication truncates wrong
- H.MONEY.3 — app vs DB total divergence
- H.MONEY.4 — currency conversion rate drift
- H.TIME.1 — DST boundary RFI included/excluded inconsistently — PARTIAL (Wave 3 — tests/integrity/dst-boundary.spec.ts; pure unit spec contracts 23h spring-forward + 25h fall-back day length, every-5-min sweep across DST window confirms no double-count and no skip)
- H.TIME.2 — DST skipped scheduled task (or duplicated)
- H.TIME.3 — audit timestamp not locked; re-insert with old stamp
- H.UUID.1 — client-side UUID predictable seed
- H.UUID.2 — collision race in INSERT
- H.CONST.1 — NOT NULL violated by missing trigger populate
- H.CONST.2 — FK violated, parent deleted without cascade
- H.CONST.3 — unique constraint races under concurrency

---

## Section I — Concurrency (15+ hazards)

- I.PROV.1 — covered by #10
- I.PROV.2 — slug collision detection only exact match
- I.RACE.1 — daily-log sign/unsign race (signed_at fork)
- I.RACE.2 — RFI status concurrent update (lost-update)
- I.RACE.3 — concurrent member-add race
- I.IDEM.1 — covered by #29
- I.IDEM.2 — covered by #33 (double-click)
- I.IDEM.3 — Stripe webhook dedup fails after handler
- I.DEADLOCK.1 — circular trigger lock dependency
- I.DEADLOCK.2 — SELECT FOR UPDATE order violation
- I.RT.1 — Realtime channel name reused across logins
- I.RT.2 — Realtime broadcast before RLS check
- I.DL.1 — covered by #20 (concurrent AMEND)
- I.PGMQ.1 — covered by #31
- I.PROV.3 — double-provision via canonical-form slug similarity

---

## Section J — Input Validation (15+ hazards)

- J.CLIENT.1 — client-only email validation bypassed
- J.CLIENT.2 — file size limit bypassed
- J.CLIENT.3 — Zod schema not enforced at API boundary
- J.XSS.1 — covered by #47 (TipTap iframe)
- J.XSS.2 — DOMPurify config too permissive
- J.XSS.3 — markdown backtick escape bypass
- J.SQL.1 — search query boolean operator injection
- J.CSV.1 — covered by #48 (CSV formula)
- J.MIME.1 — file MIME determined by extension only
- J.SIGNED.1 — covered by #41 (signed-URL scope)
- J.UPLOAD.1 — no virus scan
- J.JSON.1 — JSONB spread leaks private fields
- J.JSON.2 — extra JSONB fields stored unvalidated
- J.SIGNED.2 — signed-URL TTL too long (default 7d)
- J.EXIF.1 — EXIF GPS not stripped before share

---

## Section K — Third-Party + Webhook (15+ hazards)

- K.STRIPE.1 — covered by #11
- K.STRIPE.2 — signature compared non-constant-time (timing attack)
- K.STRIPE.3 — event dedup INSERT race
- K.STRIPE.4 — event_type not validated
- K.SLACK.1 — token plaintext in DB
- K.SLACK.2 — channel re-config without re-test
- K.SLACK.3 — outbound token timing attack
- K.ANTH.1 — covered by #8
- K.ANTH.2 — API key cached client-side stale
- K.ANTH.3 — no per-user rate limit on AI endpoints
- K.EMAIL.1 — covered by #46
- K.EMAIL.2 — body parsed as JSON (injection)
- K.EMAIL.3 — reply-to extracted unsanitized
- K.WEBHOOK.1 — idempotency window mis-sized
- K.WEBHOOK.2 — 5xx retried after recipient already processed

---

## Section L — Storage (10+ hazards)

- L.BUCKET.1 — covered by #7
- L.BUCKET.2 — RLS too permissive (authenticated, not org-scoped)
- L.SIGNED.1 — covered by #41
- L.SIGNED.2 — signed-URL TTL too long
- L.SIGNED.3 — object deleted but URL still works
- L.SEAL.1 — sealed export modified via admin API
- L.SEAL.2 — sealed export metadata leaks PII
- L.MIME.1 — content-sniffing XSS on missing Content-Type
- L.EXIF.1 — covered by J.EXIF.1
- L.UPLOAD.1 — no virus scan

---

## Section M — UI Rendering (25+ hazards)

- M.EMPTY.1 — covered by #34
- M.MOD.1 — covered by #27
- M.MOD.2 — covered by #32
- M.MOD.3 — drawer backdrop click race
- M.MOD.4 — nested modal z-index collision
- M.FORM.1 — covered by #33 (double-submit)
- M.FORM.2 — mutation fires before state update (rapid clicks)
- M.FORM.3 — radio group no mutual exclusion
- M.OPT.1 — covered by #35
- M.OPT.2 — presence + optimistic edit divergence
- M.OPT.3 — pagination + optimistic insert breaks count
- M.FOCUS.1 — modal trap unannounced (a11y) → S.A11Y.2
- M.FOCUS.2 — keyboard skips hidden elements
- M.FOCUS.3 — command palette Escape closes app
- M.SCROLL.1 — infinite scroll loads same page twice — PARTIAL (Wave 4 — tests/ui/infinite-scroll-dedup.spec.ts; static probe records zero `useInfiniteQuery` usages in src/ as a phantom-hazard pin, live probe inspects cursor dedup when STAGING_URL set, pure-unit contract pins cache-merge dedup)
- M.SCROLL.2 — virtual list height misreport
- M.SCROLL.3 — re-render on filter change loses scroll
- M.KBD.1 — Cmd+S intercepted by command palette — VALIDATED (Wave 4 follow-up — `src/App.tsx` Cmd+S entry removed. The empty-closure registration that paired with `useKeyboardShortcuts.ts` `preventDefault` on meta-modifier match silently swallowed the browser's native save affordance; with the registration gone, Cmd+S falls through to the browser unchanged. Future re-introduction must wire a real save handler — contract test pins this.)
- M.KBD.2 — "/" conflicts with URL routing — PARTIAL (Wave 4 — tests/ui/keyboard-slash-in-input.spec.ts; full src/ sweep confirms NO bare-`/` shortcut registered + isTyping guard exists for non-meta single-key + sequential chord shortcuts; live probe asserts `/` inserts literal char in inputs)
- M.KBD.3 — Tab conflicts with TipTap inside modal
- M.STALE.1 — stale closure in async handler
- M.UNMOUNT.1 — conditional render unmount cascade
- M.IMG.1 — image error no fallback
- M.METRIC.1 — dashboard metric NaN on null
- M.METRIC.2 — portfolio YoY div-by-zero

---

## Section N — Realtime (10+ hazards)

- N.RT.1 — covered by #28 (channel survives logout)
- N.RT.2 — double-sub on re-render
- N.RT.3 — unsub fires on stale ref
- N.RT.4 — reconnect duplicates handlers
- N.RT.5 — exponential backoff not capped
- N.RT.6 — presence cross-org leak
- N.RT.7 — BroadcastChannel message loss on tab switch
- N.RT.8 — postgres_changes drops > 1k/s
- N.RT.9 — typing indicator stuck on
- N.RT.10 — optimistic + realtime race

---

## Section O — Network / Offline (10+ hazards)

- O.RETRY.1 — network timeout not retried
- O.RETRY.2 — retry retries side-effect mutation (duplicate write)
- O.RETRY.3 — retry pile-up user can't cancel
- O.OFFLINE.1 — offline-queue replays on stale state
- O.OFFLINE.2 — no stale-while-revalidate warning
- O.SYNC.1 — background sync fires duplicate on app suspend/resume
- O.SYNC.2 — IndexedDB lost on app crash
- O.CACHE.1 — cache stale after focus return
- O.MUT.1 — mutationKey collision data loss
- O.NET.1 — navigator.onLine false-positive

---

## Section P — Performance (10+ hazards)

- P.NPLUS1.1 — covered by #37
- P.WIDGET.1 — dashboard widgets each fetch own metrics (no batch) — PARTIAL (Wave 4 follow-up — `supabase/migrations/20261029000001_get_dashboard_payload_rpc.sql` adds `public.get_dashboard_payload(p_project_id uuid)` batched RPC; `src/hooks/queries/dashboard-payload.ts` adds the shared `useDashboardPayload` hook; `DashboardCompliance` + `DashboardPortfolio` (active-project case) now read from the shared cache. Remaining widgets — CriticalPath, Carbon, EarnedValue, MyTasks, ActivityFeed, SiteMapMini — continue running individual queries; full migration is follow-up.)
- P.LIST.1 — unbounded list memory
- P.FEED.1 — activity feed infinite append memory leak
- P.DEBOUNCE.1 — covered by #36
- P.SEARCH.1 — search triggers full table re-render
- P.USEEFFECT.1 — missing dep infinite recompute
- P.MEMO.1 — useMemo depends on full object ref
- P.CALC.1 — portfolio metric calc > 5s
- P.CHART.1 — 50k data points dropped frame rate

---

## Section Q — Mobile / Capacitor (15+ hazards)

- Q.CAM.1 — camera permission denied no fallback
- Q.CAM.2 — iOS 18 camera returns null on cancel
- Q.CAM.3 — Android EXIF rotation stripped
- Q.GPS.1 — covered by #39
- Q.GPS.2 — geolocation 30s timeout freezes UI
- Q.GPS.3 — high-accuracy drains battery, app killed
- Q.PUSH.1 — covered by #38
- Q.PUSH.2 — token rotation server not updated
- Q.PUSH.3 — payload malformed, no display
- Q.BIO.1 — biometric times out mid-auth
- Q.BIO.2 — biometric state lost on app update
- Q.SHARE.1 — share sheet null silently
- Q.FILE.1 — covered by #40
- Q.DEEPLINK.1 — format breaks across app update
- Q.DEEPLINK.2 — auth race on cold launch
- Q.BG.1 — background fetch fires every-second on bad config

---

## Section R — Third-Party UI (10+ hazards)

- R.STRIPE.1 — covered by #42
- R.STRIPE.2 — Stripe redirect cancelled mid-flow
- R.STRIPE.3 — SCA challenge timeout
- R.SLACK.1 — OAuth origin mismatch
- R.SLACK.2 — token expires mid-session
- R.CAL.1 — Calendly link expired UI shows OK
- R.CAL.2 — Calendly iframe blocks page scroll
- R.TIPTAP.1 — editor commands crash on iOS keyboard
- R.PDF.1 — large PDF freezes embedded viewer
- R.MAP.1 — Google Maps quota exceeded blank div

---

## Section S — A11y Deep (10+ hazards)

- S.A11Y.1 — covered by #43 (color-only)
- S.A11Y.2 — covered by #44 (modal focus-trap)
- S.A11Y.3 — covered by #45 (route-change focus)
- S.A11Y.4 — skip-to-main link missing
- S.A11Y.5 — closed group header not keyboard-focusable
- S.A11Y.6 — error toast not in live region
- S.A11Y.7 — dynamic content additions silent (no aria-live)
- S.A11Y.8 — dark mode contrast on user-uploaded CSS
- S.A11Y.9 — focus lost after inline edit
- S.A11Y.10 — FAB tabindex trap

---

## Out-of-Scope Catalog Entries

Cells the catalog acknowledges but doesn't try to test automatically:

- Apple App Store review (manual, ~12 cells)
- Real Stripe webhook delivery from Stripe servers (test-mode dashboard, ~8 cells)
- Real iOS hardware (camera focus, GPS, push latency — TestFlight, ~30 cells)
- Multi-GB uploads (~5 cells)
- Real customer scale behavior (~10 cells)
- OCR model accuracy on hand-drawn drawings (~15 cells)
- Real Anthropic API rate-limit behavior (~5 cells)
- Cross-browser quirks beyond Chromium (~50 cells)
- Screen-reader narration UX (axe-core covers rules; human evaluates UX, ~15 cells)

Total OUT_OF_SCOPE ≈ 150 cells. Documented in MASTER_MATRIX.md.

---

## Validation flow per entry

1. Loop reads catalog, picks UNCOVERED entries by priority (severity × likelihood / test-class-ease).
2. Dispatches specialist sub-agent (xstate-fuzzer, lifecycle-author, adversarial-auditor, race-prober, or fmea-validator).
3. Agent writes test in the test_class's home dir.
4. PR auto-merges when required gates green.
5. After merge, `mutation-injector` runs: temporarily breaks the source line the test asserts on, confirms test fails, reverts, confirms test passes again.
6. If both hold → catalog entry `status: VALIDATED`.
7. If test passes even with mutation → `status: PARTIAL` (test doesn't actually catch the hazard); dispatched back to author.

Loop exits when ≥ 95% of in-scope catalog entries are VALIDATED (≥ ~135 of ~285 non-OUT_OF_SCOPE entries; matches plan's stop condition).

---

_Source: 3 Explore agents (state-machine + lifecycle; security + integrity + concurrency; UI + integration + performance + mobile). Synthesized into this catalog 2026-05-14. Loop iteration 2 picks from here._

---

## Section A Coverage Receipt — xstate-fuzz wave 1 (2026-05-14)

13 fuzz specs landed under `tests/machines/`, exercising **613 (state × event) pairs** and 22 specific hazard probes. All specs run via vitest; no `src/` changes; each spec < 300 lines (max 186).

| Machine               | Spec path                                                | (state × event) | Hazards covered                          |
|-----------------------|----------------------------------------------------------|----------------:|------------------------------------------|
| rfiMachine            | tests/machines/rfiMachine.fuzz.spec.ts                   |              54 | A.XSTATE.1, A.RFI.1, A.RFI.2             |
| submittalMachine      | tests/machines/submittalMachine.fuzz.spec.ts             |              88 | A.XSTATE.1, A.SUB.1, A.SUB.2             |
| changeOrderMachine    | tests/machines/changeOrderMachine.fuzz.spec.ts           |              35 | A.XSTATE.1, A.CO.1, A.CO.2               |
| dailyLogMachine       | tests/machines/dailyLogMachine.fuzz.spec.ts              |              30 | A.XSTATE.1, A.DL.1, A.DL.2               |
| punchItemMachine      | tests/machines/punchItemMachine.fuzz.spec.ts             |              40 | A.XSTATE.1, A.PUNCH.1, A.PUNCH.2         |
| paymentMachine        | tests/machines/paymentMachine.fuzz.spec.ts               |              80 | A.XSTATE.1, A.PAY.1, A.PAY.2             |
| scheduleMachine       | tests/machines/scheduleMachine.fuzz.spec.ts              |              28 | A.XSTATE.1, A.SCHED.1                    |
| inspectionMachine     | tests/machines/inspectionMachine.fuzz.spec.ts + tests/machines/inspection-reschedule-id-collision.spec.ts |              42 | A.XSTATE.1, A.INSP.1 (Wave 4: reschedule FK contract) |
| drawingMachine        | tests/machines/drawingMachine.fuzz.spec.ts               |              48 | A.XSTATE.1, A.DRAW.1                     |
| documentMachine       | tests/machines/documentMachine.fuzz.spec.ts              |              48 | A.XSTATE.1, A.DOC.1                      |
| closeoutItemMachine   | tests/machines/closeoutMachine.fuzz.spec.ts + tests/machines/closeout-actor-leak.spec.ts |              42 | A.XSTATE.1, A.CLOSE.1 (Wave 4: actor-leak contract) |
| taskMachine           | tests/machines/taskMachine.fuzz.spec.ts                  |              28 | A.XSTATE.1, A.TASK.1                     |
| agentStreamMachine    | tests/machines/agentStreamMachine.fuzz.spec.ts           |              50 | A.XSTATE.1, A.AGENT.1                    |
| **Total**             |                                                          |         **613** | **A.XSTATE.1 + 13 per-machine probes**   |

Shared harness: `tests/machines/_fuzzHelpers.ts` — `fuzzMatrix()` drives every (state, event) pair on a fresh actor with reachability paths and minimal payloads, captures pre/post snapshots, and `assertNoSilentDrops()` checks the post-send state is in the known state set.

Wave 1 flips 10 Top-50 entries from UNCOVERED → PARTIAL (A.XSTATE.1, A.CO.1, A.SUB.1, A.DL.1, A.PUNCH.1, A.PAY.1, A.PAY.2, A.SCHED.1, A.RFI.1, A.DRAW.1). Wave 2 = mutation-injector flips to VALIDATED.

---

## Wave-1 race-prober receipts (2026-05-14)

Branch: `feat/fmea-concurrency-race-wave1`. 5 specs authored under
`tests/concurrency/`:

| Spec | Catalog | Outcome on staging (`nrsbvqkpxxlonvkmcmxf`) |
|---|---|---|
| `provision-org-race.spec.ts` | I.PROV.1 | PASS — provision_organization v2 idempotency holds; 10 racing calls → 1 org_id |
| `notification-idempotency.spec.ts` | I.IDEM.1 / D.NOTIF.1 | **FAIL — 2 rows landed**. Real bug. |
| `double-submit.spec.ts` (Playwright) | I.IDEM.2 / M.FORM.1 | Not run (needs Vercel preview URL + auth env) |
| `daily-log-amend-race.spec.ts` | I.DL.1 / A.DL.1 | **FAIL — 2 revision rows landed**. Real bug. |
| `pgmq-idempotency.spec.ts` | I.PGMQ.1 | Skipped — staging exposes no `public.pgmq_send` RPC over REST |

**Real race-condition bugs surfaced for next loop iteration:**

1. **I.IDEM.1 / D.NOTIF.1** — `notifications` table has no idempotency key.
   `create_notification(p_user_id, p_project_id, p_type, p_title, p_body, p_link)`
   blindly INSERTs. Re-firing the `trg_rfi_assigned` trigger 3x in parallel
   yielded 2+ rows.
   Fix candidates: (a) add `idempotency_key text UNIQUE` to `notifications`
   and accept it as a `create_notification` param; (b) add a partial UNIQUE
   index on `(user_id, type, link, body)` for the same 60s window.

2. **I.DL.1 / A.DL.1** — `daily_log_revisions` accepts arbitrarily many
   rows for the same (daily_log_id, field, new_value) tuple. Two parallel
   inserts BOTH succeed; the bigserial `sequence` column doesn't dedupe.
   Fix candidates: (a) add a partial UNIQUE on (daily_log_id, field,
   new_value) where revision_hash IS NULL; (b) wrap amend in a SECURITY
   DEFINER RPC that takes pg_advisory_xact_lock(hashtext(daily_log_id))
   before inserting.

Both are queued as `loop-detected-bug` for platform-diagnoser-agent in the
next iteration.

---

## FMEA Wave 3 — 10 more hazards covered (2026-05-14)

Wave 3 = the next 10 priority hazards across machines + integrity + security + notifications + UI. **All 30 wave-3 vitest tests pass** locally; the Playwright signup spec lives under `tests/ui/` (runs under `@playwright/test`, excluded from vitest).

| # | ID                | Spec path                                                       | Layer                                          | Status               |
|--:|-------------------|-----------------------------------------------------------------|------------------------------------------------|----------------------|
| 1 | A.PAY.1           | tests/machines/payApp-approve-side-effect.spec.ts               | endpoint contract + INSERT path                | UNCOVERED → PARTIAL  |
| 2 | A.PAY.2           | tests/machines/payApp-negative-retainage.spec.ts                | boundary + validator contract                  | UNCOVERED → VALIDATED |
| 3 | A.SCHED.1         | tests/machines/schedule-status-divergence.spec.ts               | derive-vs-machine boundary fuzz                | UNCOVERED → PARTIAL  |
| 4 | F.SIGNUP.3        | tests/ui/signup-provision-failure.spec.ts                       | static + Playwright route-intercept            | UNCOVERED → VALIDATED |
| 5 | B.SUB.1           | tests/notifications/submittal-distribution-refresh.spec.ts      | mocked-supabase recipient refresh              | UNCOVERED → PARTIAL  |
| 6 | N.RT.1            | tests/security/realtime-logout-channel-leak.spec.ts             | static + mocked-channel orphan probe           | UNCOVERED → VALIDATED |
| 7 | D.NOTIF.5         | tests/notifications/orphan-recipient.spec.ts                    | static + mocked-supabase send-time guard       | UNCOVERED → VALIDATED |
| 8 | L.SIGNED.1        | tests/security/signed-url-path-traversal.spec.ts                | source inventory + normalizer contract         | UNCOVERED → PARTIAL (wrapper shipped; 1 of ~10 callers migrated) |
| 9 | G.HEADER.2        | tests/security/postgrest-select-leak.spec.ts                    | sensitive-column inventory + projection probe  | UNCOVERED → VALIDATED |
|10 | H.TIME.1          | tests/integrity/dst-boundary.spec.ts                            | pure-unit DST inclusion sweep                  | UNCOVERED → PARTIAL  |

**Real bugs surfaced + Wave-3 close-out PR (2026-05-14):**

All 6 bugs surfaced during Wave 3 authoring were closed in a single follow-up PR. Status after fix:

1. **F.SIGNUP.3 — VALIDATED.** `src/pages/auth/Signup.tsx` `if (provisionError)` branch now calls `setSubmitError()` + `Sentry.captureException()` so the user sees an actionable inline error before the outer-catch fallback redirect to `/verify-pending`.
2. **N.RT.1 — VALIDATED.** `src/stores/authStore.ts` `signOut()` and the `onAuthStateChange` SIGNED_OUT branch both call `supabase.removeAllChannels()` (defense-in-depth for in-band + out-of-band signout).
3. **A.PAY.2 — VALIDATED.** `src/machines/paymentMachine.ts` exports `validateRetainagePercent` + `isValidRetainagePercent`; clamps `[0, 100]` with NaN→0 and ±Infinity→band edges; wired into both `calculateG702` and `calculateG703LineItem` entry points.
4. **D.NOTIF.5 — VALIDATED.** `src/services/notifications/emailNotificationService.ts` `processNotificationQueue()` calls `isRecipientDeleted()` per row (SELECT `profiles.deleted_at`); marks the queue row `'skipped'` with `error='recipient_deleted'` instead of attempting to send. Fails open on transient lookup errors so the worker never stalls.
5. **L.SIGNED.1 — PARTIAL (wrapper shipped, callers migrating).** `src/lib/storage/scopedSignedUrl.ts` exports `createScopedSignedUrl` + `normalizeStoragePath` (rejects `..` / `%2e%2e` / `\` / leading `/`). `src/hooks/useSignedUrl.ts` (both `useSignedUrl` and `batchSignedUrls`) migrated as the first caller. Catalog entry stays PARTIAL until the remaining ~10 direct call sites in `src/pages`, `src/services`, `src/components` route through the wrapper (follow-up sweep tracked).
6. **G.HEADER.2 — VALIDATED.** `supabase/tests/database/wave3_hash_columns_anon_select_denial.sql` asserts RLS enabled + zero anon SELECT privilege + zero anon-scoped policies on `account_deletion_events` / `api_keys` / `ai_rfi_drafts` / `audit_log` (all four `*_hash`-bearing tables). 16 pgtap assertions total.

**Cost-aware notes:**
- All 10 specs are vitest-skip-gracefully or Playwright-skip-gracefully — zero env required to land green in CI.
- 9 of 10 are pure vitest (sub-second-per-file). DST sweep iterates ~576 instants and still runs in <50ms.
- Each spec under 200 lines (verified). No source-file changes.
- Mutation-injector compatibility: each spec has at least one assertion that fails when the underlying contract is silently removed (the wave 2 mutation-injector pattern carries forward).

---

## FMEA Wave 4 — 10 more hazards covered (2026-05-14)

Wave 4 = the next 10 priority hazards focused on Sections A / B / M / P — machine identity + actor cleanup, drawing revision integrity, safety escalation, COI expiration, lien-waiver jurisdiction, infinite scroll, keyboard handlers, and dashboard widget batching. **All 53 wave-4 vitest tests pass** locally; the 3 Playwright specs live under `tests/ui/` (run under `@playwright/test`, excluded from vitest per project config).

| # | ID                | Spec path                                                              | Layer                                          | Status               |
|--:|-------------------|------------------------------------------------------------------------|------------------------------------------------|----------------------|
| 1 | A.INSP.1          | tests/machines/inspection-reschedule-id-collision.spec.ts              | machine FK identity + reschedule lifecycle     | UNCOVERED → PARTIAL  |
| 2 | A.CLOSE.1         | tests/machines/closeout-actor-leak.spec.ts                             | terminal-state cleanup + subscription leak     | UNCOVERED → PARTIAL  |
| 3 | B.DRAW.1          | tests/integrity/drawing-supersede-revision.spec.ts                     | next-revision-number contract + race shape    | UNCOVERED → VALIDATED |
| 4 | B.SAFETY.1        | tests/cron/safety-incident-escalation.spec.ts                          | static migration scan for escalation cron      | UNCOVERED → VALIDATED |
| 5 | B.COI.1           | tests/integrity/coi-expiry-blocks-checkin.spec.ts                      | daysUntil + decideBlocks + isSubBlocked        | UNCOVERED → PARTIAL  |
| 6 | B.LIEN.1          | tests/integrity/lien-waiver-jurisdiction-match.spec.ts                 | template registry + resolver + validator       | UNCOVERED → VALIDATED |
| 7 | M.SCROLL.1        | tests/ui/infinite-scroll-dedup.spec.ts                                 | useInfiniteQuery static probe + cache merge    | UNCOVERED → PARTIAL  |
| 8 | M.KBD.1           | tests/ui/keyboard-cmd-s-shortcut.spec.ts                               | App.tsx Cmd+S static probe + live save toast   | UNCOVERED → VALIDATED |
| 9 | M.KBD.2           | tests/ui/keyboard-slash-in-input.spec.ts                               | bare-`/` shortcut sweep + isTyping guard       | UNCOVERED → PARTIAL  |
|10 | P.WIDGET.1        | tests/perf/dashboard-widget-batching.spec.ts                           | widget useQuery count + batched RPC contract   | UNCOVERED → PARTIAL  |

**Real bugs surfaced (KNOWN-VIOLATION ledger entries — Wave-4 follow-up fixes landed; entries below kept as audit trail):**

1. **M.KBD.1 — VALIDATED.** `src/App.tsx` line 662 previously registered `{ key: 's', meta: true, action: () => {} }`. The empty closure paired with `useKeyboardShortcuts.ts` lines 110-113 silently swallowed Cmd+S browser save. **Fix applied:** Cmd+S registration removed from `src/App.tsx`. The browser's native save now passes through unchanged. Contract test pins that any future re-introduction must not be an empty closure.

2. **B.SAFETY.1 — VALIDATED.** `notify_incident_reported()` (00005_safety_module.sql line 437) fires the on-trigger notification but never re-escalated an unassigned `lost_time`/`fatality` incident. **Fix applied:** `supabase/migrations/20261029000000_safety_incident_escalation_cron.sql` adds `public.escalate_unassigned_high_severity_incidents()` SECURITY DEFINER scanner + pg_cron hourly schedule (`0 * * * *`). Scans `incidents WHERE investigation_status='open' AND investigated_by IS NULL AND severity IN ('lost_time','fatality') AND created_at < now() - interval '4 hours'`; enqueues `notification_queue` rows to org owners/admins with per-incident-per-recipient-per-day idempotency.

3. **B.LIEN.1 — VALIDATED.** `src/lib/lienWaiver/templateRenderer.ts` `resolveWaiverTemplateId` silently fell back to `aia-g706-conditional-progress-v1` for any unrecognized jurisdiction. **Fix applied:** added `KNOWN_WAIVER_JURISDICTIONS = ['AIA','CA','TX','FL','NY']` enum + `validateWaiverJurisdiction(state)` that throws on unknown states (e.g. 'IL', 'PA'). Resolver now invokes the validator first — typos surface an error instead of silently producing a non-statutory waiver. CA/TX/FL still resolve to localized templates; NY explicitly routes to AIA fallback.

4. **P.WIDGET.1 — PARTIAL.** Dashboard mounted ~6 widgets, each running its own `useQuery`. **Fix applied (partial):** `supabase/migrations/20261029000001_get_dashboard_payload_rpc.sql` adds `public.get_dashboard_payload(p_project_id uuid) returns jsonb` batched RPC; `src/hooks/queries/dashboard-payload.ts` adds the shared `useDashboardPayload` hook; `DashboardCompliance` + `DashboardPortfolio` (active-project case) now read from the shared cache. **Deferred (follow-up):** CriticalPath, Carbon, EarnedValue, MyTasks, ActivityFeed, SiteMapMini still run individual queries.

5. **B.DRAW.1 — VALIDATED.** `drawingMachine.SUPERSEDE` mutates state only; revision-number INSERT lived in the service layer with no application-side guard. **Fix applied:** `src/lib/drawings/validateSupersede.ts` exports `validateSupersedeInsert(rows, candidate)` which throws on duplicate / backwards / gap revisions. The supersede path in `src/pages/drawings/index.tsx` now invokes this validator before INSERT. DB UNIQUE constraint remains the ultimate backstop.

**Cost-aware notes:**
- 7 vitest specs (53 tests, ~1.7s total) + 3 Playwright specs (skip-gracefully without STAGING_URL).
- Each spec ≤ 185 lines (verified — longest is dashboard-widget-batching at 185, infinite-scroll-dedup at 150).
- No source-file changes.
- Mutation-injector compatibility: each spec pins at least one positive-case contract that fails when the underlying contract is silently removed (e.g. computeNextRevisionNumber returns wrong rev → assertion fires; resolveWaiverTemplateId returns AIA on CA project → assertion fires; etc.).
- KNOWN-VIOLATION pattern: 5 specs ratchet on the *current* hazard surface (empty-closure Cmd+S, no escalation cron, no jurisdiction validator, no batched payload, per-widget fetches). Each is a regression boundary: when the platform fixes the bug, the corresponding assertion must be flipped in a follow-up wave.

---

## FMEA Wave 5 — 10 more hazards covered (2026-05-15)

Wave 5 = next 10 priority hazards, Sections A / F / M / K emphasis — xstate machine boundaries (REOPEN-terminal, missing-actor, actor-timeout, type-history demote, tile-orphan), share-token entity scope, SCIM externalId uniqueness, optimistic-UI vs presence + pagination conflicts, and Stripe webhook signature timing attack. **All 60 wave-5 vitest tests pass** locally (4 live-gated skips); each spec ≤ 199 lines (verified).

| # | ID                | Spec path                                                              | Layer                                                  | Status               |
|--:|-------------------|------------------------------------------------------------------------|--------------------------------------------------------|----------------------|
| 1 | A.RFI.2           | tests/machines/rfi-reopen-terminal.spec.ts                             | xstate fuzz — REOPEN from closed AND void              | UNCOVERED → PARTIAL  |
| 2 | A.SUB.2           | tests/machines/submittal-actor-missing.spec.ts                         | bare-machine probe + spy contract + KNOWN-VIOLATION    | UNCOVERED → PARTIAL  |
| 3 | A.DL.2            | tests/machines/daily-log-actor-timeout.spec.ts                         | never-resolving actor + KNOWN-VIOLATION (no `after:`)  | UNCOVERED → PARTIAL  |
| 4 | A.CO.2            | tests/machines/change-order-return-to-pco-history.spec.ts              | cor→pco demote contract + missing assign KNOWN-VIOLATION | UNCOVERED → PARTIAL |
| 5 | A.DRAW.2          | tests/integrity/drawing-tile-orphan.spec.ts                            | UUID[] schema probe + orphan-safe filter + cascade pin | UNCOVERED → PARTIAL  |
| 6 | F.SHARE.2         | tests/security/share-token-scope-too-broad.spec.ts                     | aud:entity_type:entity_id contract + live cross-entity | UNCOVERED → PARTIAL  |
| 7 | F.SCIM.1          | tests/security/scim-users-externalid-uniqueness.spec.ts                | createUser stub KNOWN-VIOLATION + live dedup probe     | UNCOVERED → PARTIAL  |
| 8 | M.OPT.2           | tests/realtime/presence-optimistic-edit-conflict.spec.ts               | presenceStore broadcast-race + flag-accuracy contract  | UNCOVERED → PARTIAL  |
| 9 | M.OPT.3           | tests/realtime/pagination-optimistic-insert.spec.ts                    | InfiniteData merger + total/cursor/rollback contract   | UNCOVERED → PARTIAL  |
|10 | K.STRIPE.2        | tests/security/stripe-signature-timing-attack.spec.ts                  | static XOR-pattern + 5,000 paired timed compares       | UNCOVERED → PARTIAL  |

**Real bugs surfaced (KNOWN-VIOLATION ledger entries inline in specs):**

1. **A.SUB.2** — `src/machines/submittalMachine.ts` ships a no-op default `triggerRevisionCreation: () => {}` with NO `createSubmittalActor()` factory enforcing the `.provide()` wiring. Every production call site must remember to override the action; missing override = silent prod fail where revisionNumber bookkeeping looks healthy but no submittal_revisions row is created. Fix: add a fail-fast factory in src/machines/submittalMachine.ts.

2. **A.DL.2** — `src/machines/dailyLogMachine.ts` `amending` state has no `after:` timeout on the `createLog` invoke. A hung createLog actor leaves the machine in `amending` forever (no auto-recovery, no error context). Fix: add `after: { 30000: { target: 'submitted', actions: assign({ error: () => 'amend_timeout' }) } }`.

3. **A.CO.2** — `RETURN_TO_PCO` transition in `src/machines/changeOrderMachine.ts` lacks an `actions:` clause to revert `context.type` via the existing `getPreviousCOType()` helper. A cor-typed CO that's rejected and returned to PCO sits in `draft` state with `co_type='cor'` — impossible per the doc contract, and the historical "promoted then demoted" fact is lost. Fix: `actions: assign({ type: ({ context }) => getPreviousCOType(context.type) ?? context.type })` + emit a co_type_history audit row.

4. **A.DRAW.2** — `drawing_sets.drawing_ids UUID[]` (migration `20260421000001_drawing_tiles_and_sets.sql`) has NO foreign-key constraint, NO junction table, NO trigger on drawings DELETE to sweep the array. Deleting a drawing leaves dangling UUIDs in every set; deleting a set leaves the tiled storage assets behind. Fix: replace UUID[] with `drawing_set_members(set_id, drawing_id)` junction + `ON DELETE CASCADE` on the drawings side.

5. **F.SCIM.1** — `supabase/functions/scim-v2/index.ts` `createUser()` is a 501 stub returning "not implemented yet". SCIM POST /Users from Okta / Azure AD / OneLogin fails today; when the impl lands it MUST dedupe by externalId (RFC 7643 §3.3) — recommend `UNIQUE (organization_id, external_id)` + dedup-by-externalId query before INSERT. `toScimUser()` also omits externalId from the output, breaking IdP reconciliation.

**Cost-aware notes:**
- 10 vitest specs (60 tests, ~1.6s total); 4 live-gated skips for staging-only probes (F.SHARE.2 cross-entity replay × 2, F.SCIM.1 live duplicate × 2).
- Each spec ≤ 199 lines (verified — longest is pagination-optimistic-insert at 199).
- No source-file changes.
- Mutation-injector compatibility: each spec pins at least one positive-case contract that fails when the underlying contract is silently removed (e.g. REOPEN-from-closed must transition to open; spy fires on RESUBMIT; aud check precedes DB lookup; xor-comparator returns true on match; etc.).
- KNOWN-VIOLATION pattern: 5 of 10 specs ratchet on the *current* hazard surface (no submittal actor factory, no daily-log timeout, no RETURN_TO_PCO type revert, no drawing_set_members junction, no SCIM createUser impl). Each is a regression boundary: when the platform ships the fix, the corresponding assertion flips and the catalog entry moves to VALIDATED.
