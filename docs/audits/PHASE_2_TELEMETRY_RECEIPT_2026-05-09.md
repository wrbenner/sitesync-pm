# Phase 2 Telemetry — Receipt

**Date:** 2026-05-09
**Theme:** Page-event telemetry substrate + 5-page wiring
**Status:** Shipped (substrate + helper + 5 pages + 11 tests). Migration awaits apply + db-types regen.
**Plan:** `~/.claude/plans/1-build-the-spec-snappy-starfish.md` (Phase 2 revision approved 2026-05-09)

---

## What shipped

A new `iris_telemetry` page-event substrate, a `track()` fire-and-forget helper, and 12 events instrumented across the 5 hottest pages. **Phase 2A (`drafted_actions` telemetry wiring) was found to be already shipped** — the IrisApprovalGate's inline `recordDecisionTelemetry()` and `useRecordDraftView` hook already wire the matview-source RPCs. This receipt covers Phase 2B (the actual remaining work) plus a small audit of Phase 2A's existing coverage.

### Phase 2A — already shipped (audit only; 1 small test added)

| Surface | Status | Source |
|---|---|---|
| `useInboxSession` provider + hook | ✅ shipped | `src/hooks/useInboxSession.ts` |
| `useRecordDraftView` (IntersectionObserver → `record_draft_view` RPC) | ✅ shipped | `src/hooks/useRecordDraftView.ts` (4 tests) |
| `recordDecisionTelemetry` (inline in IrisApprovalGate) | ✅ shipped | `src/components/iris/IrisApprovalGate.tsx:32-51` |
| `detectDecisionMethod(event)` keyboard-vs-mouse derivation | ✅ shipped (cleaner than my plan's global-listener idea — uses `event.detail === 0` for keyboard) |
| Synthetic-id guard for non-uuid drafts | ✅ shipped (skips RPC for `synthetic:...` ids) |
| `useInboxSession` test coverage | ❌ → ✅ **added this PR** (`src/hooks/__tests__/useInboxSession.test.tsx`, 3 tests) |
| `recordDecisionTelemetry` test coverage | ❌ still missing — flagged as follow-on (deferred per polish-only mandate; existing visible-button tests cover regression risk) |
| `required_edits` flag | ⚠️ hardcoded `false` per code comment — awaits Lap 3 inline edit panel; not a defect |

**Result:** Phase 2A's matview wiring is complete. The Lap-2 acceptance gate (`lap_2_gate_metrics_daily`) will populate as soon as soft-pilot users approve drafts via `/iris/inbox`. No new wiring needed here.

### Phase 2B — page-event substrate (new this PR)

**Migration** — `supabase/migrations/20260509000000_iris_telemetry.sql` (~120 LOC):
- New `iris_telemetry` table (`id`, `project_id`, `user_id`, `event_name`, `details jsonb`, `created_at`)
- 2 indexes: `(project_id, event_name, created_at DESC)` and `(user_id, created_at DESC)`
- RLS: blocks ALL direct INSERT/UPDATE/DELETE; project members can SELECT their project's rows
- One SECURITY DEFINER RPC `record_event(p_project_id, p_event_name, p_details)`: membership-checked, length-validated; the only writer
- 12mo retention per ADR-008 (cron purge in a follow-on)

**Helper** — `src/lib/telemetry/track.ts` (~85 LOC):
- `track(eventName, details?)` — fire-and-forget; never throws
- Reads `projectId` from `useProjectStore.getState().activeProjectId`
- Skips silently when no project (warns once per session in dev)
- Skips silently when Supabase isn't configured (test/preview builds)
- Catches both `{ error }` (Postgrest error) and `.catch()` (network reject) paths
- One localized `as unknown as` cast for the `record_event` RPC name (the cast vanishes once `npm run db-types:write` runs post-migration-apply)

**Tests** — `src/lib/telemetry/__tests__/track.test.ts` (8 tests, all green):
- Calls `record_event` with correct shape
- Defaults `details` to `{}`
- Skips when no project context (no throw)
- Swallows Postgrest errors (no throw)
- Swallows promise rejections (no throw)
- Handles all 5 page namespaces correctly
- Passes through the active project id unchanged
- Warns at most once per session for the no-project case

**Page wiring** — 12 events across 5 pages:

| Page | Events | Wired in |
|---|---|---|
| `/day` | `day.opened`, `day.lane_clicked`, `day.item_navigated` | `src/pages/day/index.tsx` (mount useEffect + `handleRowClick` + `handleIrisClick`) |
| `/rfis` | `rfi.opened`, `rfi.status_changed`, `rfi.deleted`, `rfi.ai_draft_requested` | `src/pages/RFIs.tsx` (mount + `handleStatusChange` + `handleDeleteRFI` + `handleAIDraft`) |
| `/submittals` | `submittal.opened`, `submittal.tab_switched`, `submittal.created` | `src/pages/submittals/index.tsx` (mount + `handleTabChange` wrapper + `onCreated` callback) |
| `/daily-log` | `dailylog.opened`, `dailylog.date_changed`, `dailylog.log_submitted` | `src/pages/daily-log/index.tsx` (mount + ChevronLeft/Right + `handleSubmit` + `handleApprove`) |
| `/iris/inbox` | `iris.opened`, `iris.tab_switched`, `iris.suggestion_filtered` | `src/pages/iris/IrisInboxPage.tsx` (mount + `handleSetTab` wrapper + `handleSetKindFilter` wrapper). Approve/reject are NOT instrumented here — already covered by Phase 2A's `record_draft_decision` RPC |

**Page-Card updates** — Telemetry field on each of the 5 cards rewritten from `⚠️ none emitted` to a one-line list of the events with provenance.

---

## Concrete numbers

- **1** migration: `20260509000000_iris_telemetry.sql` (~120 LOC) — table + 2 indexes + RLS + 1 SECURITY DEFINER RPC
- **1** new helper: `src/lib/telemetry/track.ts` (~85 LOC, fire-and-forget, never throws)
- **2** new test files: `useInboxSession.test.tsx` (3 tests), `track.test.ts` (8 tests). 11 tests total, all green.
- **5** page files modified: Day, RFIs, Submittals, Daily Log, Iris Inbox
- **12** events instrumented across the 5 pages (Day 3, RFIs 4, Submittals 3, Daily Log 3, Iris Inbox 3 — Inbox would have been 4 but accept/reject is covered by Phase 2A's `record_draft_decision` RPC)
- **5** Page Cards updated (Telemetry field)
- **0** changes to `src/lib/vitals.ts` (unrelated — that's Sentry/PostHog Core Web Vitals)
- **0** new dependencies
- **Typecheck:** EXIT=0 (full project, with `NODE_OPTIONS=--max-old-space-size=8192` per the known database.ts heap issue)
- **Tests:** 11/11 pass on the new files

---

## Verification (post-merge)

```bash
# Migration applies cleanly
npx supabase db reset && npx supabase db push   # against staging

# Regenerate database.ts (per CLAUDE.md sprint invariant 1)
npm run db-types:write   # commit the diff in this PR before merge

# Local smoke per page (after page-load):
#   select event_name, count(*)
#   from iris_telemetry
#   where project_id = '<avery-oaks-uuid>'
#     and created_at > now() - interval '1 hour'
#   group by event_name;
# Expected events to appear: day.opened, day.lane_clicked, rfi.opened,
# rfi.status_changed, submittal.opened, submittal.tab_switched,
# dailylog.opened, dailylog.date_changed, iris.opened, iris.tab_switched.

# RLS smoke: as user A in project X, query
#   select * from iris_telemetry where project_id = '<project Y>';
# Expected: 0 rows.

# Direct insert blocked:
#   insert into iris_telemetry (project_id, event_name) values ('<x>', 'test');
# Expected: blocked by RLS policy iris_telemetry_no_direct_write_insert.
```

---

## Open questions / punch-list candidates

These are not defects in this PR — they're known follow-ons surfaced by the work.

1. **`recordDecisionTelemetry` lacks unit tests.** The inline function in `IrisApprovalGate.tsx` has no direct test coverage (the existing `IrisApprovalGate.test.tsx` only covers visible-button behavior). The existing function has shipped since the IRIS_CITATIONS Day 38 receipt. Recommend: ~3 tests covering keyboard-vs-mouse derivation + synthetic-id skip + post-approve order in a follow-on.

2. **`db-types:write` regen pending.** This PR includes a migration that adds `iris_telemetry` (table) + `record_event` (function). The `track.ts` helper uses one localized `as unknown as` cast on the supabase client because `database.ts` doesn't yet know about the new RPC. Run `npm run db-types:write` post-apply and commit the diff before merge. Per CLAUDE.md sprint invariant 1.

3. **More events worth instrumenting** (deliberately omitted from this PR for scope discipline; sub-50 LOC each):
   - `day.type_filtered` (TypeFilterChips selection)
   - `rfi.view_mode_switched` (table/kanban/calendar toggle)
   - `submittal.view_mode_changed`, `submittal.bulk_action_invoked`
   - `dailylog.entry_added`, `dailylog.entry_deleted`
   - `iris.citation_opened` (requires instrumenting `useOpenCitationPanel` hook)

4. **PostHog/Sentry parallel emission.** Default no — soft pilot reads `iris_telemetry` directly via Supabase. If Walker wants PostHog dashboards day-1 without writing matviews, add a 5-line `posthog.capture(eventName, details)` line to `track()`. Trivial follow-on.

5. **Bundling/debouncing of high-rate events.** If `day.lane_clicked` rate exceeds ~1/sec sustained, batch via a 250ms debounce. Not relevant at current usage.

6. **Retention purge cron.** ADR-008 requires 12mo retention (24mo for soft-pilot). Add a `pg_cron` schedule that deletes `WHERE created_at < now() - interval '12 months' AND project_id NOT IN (soft pilot orgs)` and a separate one for soft-pilot orgs. Sub-30-LOC migration.

7. **`required_edits` for inbox decisions** stays hardcoded `false` per the existing IrisApprovalGate comment — awaits the Lap 3 inline edit panel. Not a defect.

---

## What's next (sequencing)

1. Walker reviews this receipt + the 5 Page Cards → flips `Status: Draft` → `Status: Reviewed`
2. Walker applies the migration to staging, runs `npm run db-types:write`, commits the regenerated `database.ts`, merges
3. Walker hits each of the 5 pages on staging with the soft pilot's projectId; verifies the matching `iris_telemetry` rows land
4. Lap-2 acceptance gate (`lap_2_gate_metrics_daily`) becomes informative as the soft pilot generates approval volume
5. Punch-list items #1, #3, #4, #6 land as separate follow-on PRs as priorities allow
