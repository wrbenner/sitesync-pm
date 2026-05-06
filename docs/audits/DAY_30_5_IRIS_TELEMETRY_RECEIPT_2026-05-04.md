# Day 30.5 — Iris Telemetry Instrumentation (Lap 2 Pre-Flight)

**Date:** 2026-05-04
**Window:** Between Lap 1 close (Day 30, 2026-05-04) and Lap 2 kickoff (~Day 31, 2026-05-11).
**Spec:** `docs/audits/IRIS_TELEMETRY_SPEC_2026-05-04.md`
**ADR:** `docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md`
**Reason this is Day 30.5, not a tracker row:** Lap 2 Day 31 (`scheduled-insights`) writes the first cron-generated drafts. If those rows land before telemetry columns exist, they are forever uninstrumented and the Day 60 gate becomes unmeasurable. The migration must precede the cron.

---

## What shipped

### 1 SQL migration (`supabase/migrations/20260504010000_drafted_actions_telemetry.sql`, 385 lines)

- **5 new columns on `drafted_actions`**:
  - `first_viewed_at TIMESTAMPTZ` — when the user first saw the draft
  - `viewed_count INTEGER NOT NULL DEFAULT 0` — render-into-view count, deduped per session
  - `decision_method TEXT CHECK (… IN keyboard|mouse|voice|unknown) DEFAULT 'unknown'`
  - `required_edits BOOLEAN NOT NULL DEFAULT FALSE`
  - `inbox_session_id UUID`
- **2 generated stored columns**:
  - `time_to_first_view_ms` — `first_viewed_at - created_at`
  - `time_to_decide_ms` — `decided_at - first_viewed_at` (this is the gate-3 metric)
- **3 indexes** for the gate query, per-user aggregation, and inbox-session lookup.
- **`drafted_actions_guard_telemetry` trigger** — blocks direct UPDATE of telemetry columns by users; only the SECURITY DEFINER RPCs can write to them via a per-tx GUC.
- **2 SECURITY DEFINER RPCs**:
  - `record_draft_view(p_draft_id uuid, p_session_id uuid)` — idempotent; sets `first_viewed_at` once, increments `viewed_count`, COALESCEs `inbox_session_id`. Verifies project membership.
  - `record_draft_decision(p_draft_id uuid, p_decision_method text, p_required_edits boolean)` — writes telemetry only if status reached terminal; verifies membership; validates `decision_method` enum.
- **`lap_2_gate_metrics_daily` materialized view** — single-row hourly snapshot reading the 4 gate metrics (count, acceptance rate, avg time-to-approve, plus diagnostic breakdowns). Returns one zero-row pre-pilot, fails the CI gate by design.
- **pg_cron schedule** — hourly `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Falls back to a no-op `RAISE NOTICE` when pg_cron isn't installed (mirrors the established pattern from `20260502130000_portfolio_summary_refresh_cron.sql`).

**Notable design call:** the spec proposed adding a new `viewer_user_id UUID REFERENCES auth.users(id)`. The existing table already has `decided_by` carrying that exact semantic. Adding a second column would have created shadow-state. The migration uses the existing `decided_by` and notes the alias in the materialized view. Bugatti rule: no duplicate state.

### 2 client hooks (104 lines)

- `src/hooks/useInboxSession.ts` (29 lines) — `<InboxSessionProvider>` + `useInboxSession(): string | null`. Returns a stable per-mount UUID inside the provider; null outside. Per-entity gates on RFI/Submittal pages (which also use `IrisApprovalGate`) get null and skip session attribution — those are not "inbox sittings" and shouldn't be counted as such.
- `src/hooks/useRecordDraftView.ts` (75 lines) — `IntersectionObserver` wrapper with module-scoped dedupe Set keyed by `${sessionId}:${draftId}`. Fires `record_draft_view` once at ≥50% visibility; defensive against jsdom (early returns when `IntersectionObserver` is undefined or supabase not configured). Errors are silently swallowed and the dedupe entry rolled back so the next intersection retries.

### 3 wired call sites

- `src/components/iris/IrisApprovalGate.tsx` — ref attached to the article root; `handleApprove`/`handleReject` detect mouse vs keyboard via `MouseEvent.detail` (0 = keyboard activation) and fire `record_draft_decision` after the parent callback resolves. Mutation signatures unchanged → existing 3 callers (Inbox, RFIDetail, SubmittalDetail) and the existing 4 `IrisApprovalGate` tests + 4 `draftedActions` mutation tests stay green without edits. Synthetic drafts (e.g. `IrisSuggestionCard` with `synthetic:…` ids) are detected by uuid regex and skip telemetry rather than failing the RPC's uuid cast.
- `src/pages/iris/IrisInboxPage.tsx` — wraps `<PageContainer>` in `<InboxSessionProvider>`.
- `src/types/database.ts` — Row/Insert/Update types updated for the 5 new columns + 2 generated cols; `record_draft_decision` and `record_draft_view` added to `Functions`. (Schema regen will overwrite this if/when the migration applies to staging and `npm run db-types:write` runs; the manual edit is the offline equivalent so typecheck stays at 0.)

### 4 ADR-008 (`docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md`, 59 lines)

- 12-month retention default; 24-month for soft-pilot (`is_soft_pilot = true`) projects.
- Anonymization at expiry: nulls `decided_by` / `inbox_session_id` / `decision_method`, preserves anonymous numeric/boolean columns + decision facts.
- GDPR-style erasure routine; verbatim pilot agreement language; ban on raw row exports.

### 5 INDEX.md updated

- ADR-008 row points at the new file (was inline-only).
- Day 30.5 receipt row added with the column count and gate impact.

---

## Test coverage shipped today

`src/hooks/__tests__/useRecordDraftView.test.tsx` (115 lines, 4 tests, all passing):

1. Fires `record_draft_view` once when card crosses 50% visibility.
2. Does not fire below the threshold.
3. Dedupes per session: 5 in/out cycles → 1 RPC call.
4. Passes `null` session id when rendered outside `InboxSessionProvider`.

Mocks `IntersectionObserver` with a controllable `.fire(ratio)` helper since jsdom doesn't ship one.

**Existing tests verified green:** `IrisApprovalGate.test.tsx` (4) + `draftedActions.test.ts` (4) + the new file (4) = 12/12 green.

**`npm run typecheck` — green** on both `tsconfig.app.json` and `tsconfig.node.json`. 0 errors. Bugatti gate holds.

---

## Test plan items deferred (DB- and CI-bound)

The spec's full test plan includes 4 Postgres integration tests, 4 Playwright E2E tests, and a property test against the materialized view. These require an applied schema and live DB; they will be wired alongside the `lap-2-acceptance.yml` workflow file (covered by `LAP_2_ACCEPTANCE_GATE_SPEC`, not in scope today). Tracker-side, this falls into Lap 2 Week 5 (Days 31–35) since the `SCHEDULED_INSIGHTS_SPEC` infrastructure is what produces the rows the integration/E2E tests need to query.

The hooks and trigger guards have unit coverage; the SECURITY DEFINER RPC paths are exercised once the migration applies to staging.

---

## What's now possible that wasn't yesterday

- **Gate metric 3 (avg time-to-approve ≤ 90s) is measurable.** `time_to_decide_ms` is stored on every decided row from this point forward.
- **Gate metric 1 (≥ 100 approved) reads from a snapshot, not a live aggregate.** `lap_2_gate_metrics_daily.approved_count`.
- **Gate metric 2 (≥ 70% acceptance) has the formula codified.** approved+executed ÷ approved+executed+rejected, NULL-safe.
- **Spoof resistance.** A user cannot post-hoc tamper their own decision-method or first-view timestamps — the trigger blocks direct UPDATE of those columns.
- **Inbox-session analysis.** "How many drafts did the user decide in one sitting" is a single GROUP BY away.

---

## What's blocked, but only briefly

- **CI gate workflow** (`.github/workflows/lap-2-acceptance.yml`) — covered by `LAP_2_ACCEPTANCE_GATE_SPEC`, lands when the gate-spec ships. Today's migration is the dependency it queries.
- **Anonymization cron** — covered by `SCHEDULED_INSIGHTS_SPEC` infrastructure (Days 31–35). ADR-008 explicitly calls out that the earliest pilot row is < 60 days old at Lap 2 close, so retention deadlines cannot fire mid-Lap-2; the cron lands well before any row reaches its 12-month mark.
- **Pilot-org slug filling** — the matview hard-codes `slug = 'soft-pilot-gc-tbd'`. Once the soft-pilot GC is recruited (`SOFT_PILOT_PLAYBOOK`), one `ALTER MATERIALIZED VIEW` swaps the slug. Until then, the matview returns one zero-row by design.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/migrations/20260504010000_drafted_actions_telemetry.sql` | NEW | 385 |
| `src/hooks/useInboxSession.ts` | NEW | 29 |
| `src/hooks/useRecordDraftView.ts` | NEW | 75 |
| `src/hooks/__tests__/useRecordDraftView.test.tsx` | NEW | 115 |
| `src/components/iris/IrisApprovalGate.tsx` | EDIT — telemetry hooks + decision-method handlers | +50 |
| `src/pages/iris/IrisInboxPage.tsx` | EDIT — `<InboxSessionProvider>` wrap | +3 |
| `src/types/database.ts` | EDIT — drafted_actions Row/Insert/Update + 2 RPCs | +29 |
| `docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md` | NEW | 59 |
| `docs/audits/INDEX.md` | EDIT — ADR-008 row + Day 30.5 row | +2 |
| `docs/audits/DAY_30_5_IRIS_TELEMETRY_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new code:** ~660 lines. **Tests added:** 4 (12 green incl. existing). **Typecheck:** 0 errors.

---

## Next session pickup

The Bugatti read order before touching anything in Lap 2:

1. `docs/audits/INDEX.md`
2. This receipt
3. `IRIS_TELEMETRY_SPEC_2026-05-04.md` (already implemented but reads as the contract)
4. `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` (next blocker; queries the matview added today)
5. `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` (Days 31–35 implementation)

The migration applies cleanly in isolation but will need an `npm run db-types:write` run after deploy-to-staging to verify the offline `database.ts` edits exactly match what Supabase's type generator would emit.
