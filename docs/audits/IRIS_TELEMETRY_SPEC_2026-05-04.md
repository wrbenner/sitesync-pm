# Iris Telemetry Spec — Lap 2 Gate Instrumentation

**Date:** 2026-05-04
**Status:** Spec ready for execution. Migration must land before Lap 2 Day 31.
**Blocks:** Lap 2 acceptance gate (Day 60). Lap 2 Days 31+ (cron-generated drafts must already carry telemetry on first insert).
**Reading order:** This spec → `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md` (which queries the columns this spec adds).
**Format reference:** Modeled after `MONEY_CENTS_AUDIT_2026-05-01.md` (4-phase plan + DB column list + test plan).

---

## TL;DR

The Day 60 Lap 2 gate measures four things:
1. ≥ 100 drafts approved at the soft-pilot GC
2. ≥ 70% acceptance rate
3. ≤ 90s average time-to-approve
4. Zero security/audit incidents

**None of (1)–(3) are measurable today.** The `drafted_actions` table records `created_at`, `decided_at`, and `status` — that gets you (1) and a crude version of (2), but (3) is impossible because no event marks when the user actually *saw* the draft. "Approved 8 hours after creation because the user opened the inbox at 8 AM" is a different story from "approved 8 hours after creation because the user took 8 hours to decide." Average time-to-approve must be measured from `first_viewed_at`, not `created_at`.

This spec adds 6 telemetry columns + 1 client-side hook + 1 daily aggregation materialized view + 1 CI assertion + 1 ADR (telemetry retention/privacy). Total work: 1 author-day + the migration deploy.

---

## Why this spec exists (not in the tracker as its own row)

The Lap 2 — Watch tracker doesn't allocate a day to telemetry — it assumes the columns exist. They don't. If we ship scheduled-insights on Day 31 and the cron writes 50 drafts overnight, those rows are forever uninstrumented. Lap 2 acceptance gate then has to either (a) rely on partial data (drafts created Day 35+ have telemetry; Days 31–34 don't), or (b) backfill, which is impossible because the events being measured already happened.

**Therefore: the migration must land BEFORE Day 31.** Recommended: Day 30.5, between the Lap 1 acceptance receipt and Lap 2 kickoff.

---

## Phase 1 — DB migration

### New columns on `drafted_actions`

```sql
-- Migration: 20260504010000_drafted_actions_telemetry.sql

ALTER TABLE drafted_actions
  -- When the user first rendered this draft on screen.
  -- Set by client when the draft card scrolls into view.
  ADD COLUMN first_viewed_at  TIMESTAMPTZ,

  -- Total render-into-view count. Increments every time the draft
  -- is scrolled into view in the inbox (deduped per session by client).
  -- Useful for "user keeps coming back to this draft" diagnostic.
  ADD COLUMN viewed_count      INTEGER NOT NULL DEFAULT 0,

  -- Who decided this draft (NULL until decided).
  -- Mirrors auth.uid() at decision time.
  -- decided_by may already exist on the table — verify before adding;
  -- if present and named differently, alias in the materialized view.
  ADD COLUMN viewer_user_id    UUID REFERENCES auth.users(id),

  -- How the user interacted to decide.
  ADD COLUMN decision_method   TEXT
    CHECK (decision_method IN ('keyboard', 'mouse', 'voice', 'unknown'))
    DEFAULT 'unknown',

  -- True if user used the edit-then-approve flow (Cmd+E).
  -- A draft accepted with edits is qualitatively different from a
  -- draft accepted as-is. Counts as "approved" for the rate but is
  -- broken out in the dashboard.
  ADD COLUMN required_edits    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Stable client session ID for the inbox session in which this
  -- draft was decided. Lets us answer "how many drafts did the user
  -- decide in one sitting" without joining to a sessions table.
  ADD COLUMN inbox_session_id  UUID;

-- Generated columns for derived metrics. PostgreSQL stores these so
-- the materialized view doesn't recompute on every refresh.
ALTER TABLE drafted_actions
  ADD COLUMN time_to_first_view_ms INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN first_viewed_at IS NULL OR created_at IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (first_viewed_at - created_at)) * 1000)::INTEGER
    END
  ) STORED,

  ADD COLUMN time_to_decide_ms INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN decided_at IS NULL OR first_viewed_at IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (decided_at - first_viewed_at)) * 1000)::INTEGER
    END
  ) STORED;
```

### Indexes

```sql
-- Lap 2 gate query is "drafts decided in window 60d"; index supports it
CREATE INDEX idx_drafted_actions_decided_at_status
  ON drafted_actions(decided_at, status)
  WHERE decided_at IS NOT NULL;

-- Daily-aggregation view groups by viewer_user_id + day
CREATE INDEX idx_drafted_actions_viewer_decided
  ON drafted_actions(viewer_user_id, decided_at)
  WHERE viewer_user_id IS NOT NULL;

-- Inbox-session lookup for "how long did this session take"
CREATE INDEX idx_drafted_actions_inbox_session
  ON drafted_actions(inbox_session_id)
  WHERE inbox_session_id IS NOT NULL;
```

### RLS policies (additive — existing policies remain)

The new columns are server-writable (cron sets `created_at`; client RPCs set `first_viewed_at`, `viewed_count`, `decision_method`, `inbox_session_id`, `viewer_user_id`, `required_edits`). RLS-wise:

```sql
-- Existing read policy already allows users to see drafts in their
-- projects. New columns inherit. No new SELECT policy needed.

-- New UPDATE policy for the recordView/recordDecision RPCs.
-- The RPCs run as SECURITY DEFINER so the user-facing path goes
-- through them, not direct UPDATE. Direct UPDATE on these columns
-- is blocked.
CREATE POLICY "Block direct telemetry update by users"
  ON drafted_actions
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- This policy is intentionally restrictive. The recordView and
-- recordDecision RPCs (defined below) are the only path that can
-- update telemetry columns. They use SECURITY DEFINER + project_id
-- membership checks.
```

### RPCs (the only client write path)

```sql
-- Set first_viewed_at the first time a draft enters the viewport.
-- Idempotent: if already set, only increments viewed_count.
CREATE OR REPLACE FUNCTION record_draft_view(
  p_draft_id UUID,
  p_session_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_project_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  -- Verify caller has access to the draft's project.
  SELECT project_id INTO v_project_id
    FROM drafted_actions
    WHERE id = p_draft_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  -- Membership check (mirrors RLS for SELECT).
  IF NOT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = v_project_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  UPDATE drafted_actions
    SET first_viewed_at = COALESCE(first_viewed_at, NOW()),
        viewed_count = viewed_count + 1,
        inbox_session_id = COALESCE(inbox_session_id, p_session_id)
    WHERE id = p_draft_id;
END;
$$;

-- Stamp decision metadata at approve/reject time. Called from the
-- existing approve/reject mutation. NOT a replacement for the
-- mutation — augments it.
CREATE OR REPLACE FUNCTION record_draft_decision(
  p_draft_id UUID,
  p_decision_method TEXT,
  p_required_edits BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  IF p_decision_method NOT IN ('keyboard', 'mouse', 'voice', 'unknown') THEN
    RAISE EXCEPTION 'Invalid decision_method';
  END IF;

  UPDATE drafted_actions
    SET viewer_user_id = v_user_id,
        decision_method = p_decision_method,
        required_edits = p_required_edits
    WHERE id = p_draft_id
      AND status IN ('approved', 'rejected');
END;
$$;
```

### Backfill

Existing rows (Lap 1 dev seed): leave `first_viewed_at`, `viewed_count`, `viewer_user_id`, `inbox_session_id` NULL. `decision_method` defaults to `'unknown'`. `required_edits` defaults to `FALSE`. **No backfill query needed** — Lap 2 gate window starts Day 31; pre-Day-31 rows are explicitly excluded from the metrics view.

---

## Phase 2 — Client instrumentation

### Hook: `useRecordDraftView`

New file: `src/hooks/useRecordDraftView.ts`. Fires the `record_draft_view` RPC when a draft card scrolls into the viewport, deduped per session.

```ts
// Sketch — full impl in the spec's companion PR.
export function useRecordDraftView(draftId: string): RefCallback<HTMLElement> {
  const sessionId = useInboxSession();      // stable per inbox open
  const recordedRef = useRef(new Set<string>());

  return useCallback((el) => {
    if (!el) return;
    const key = `${sessionId}:${draftId}`;
    if (recordedRef.current.has(key)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          recordedRef.current.add(key);
          supabase.rpc('record_draft_view', {
            p_draft_id: draftId,
            p_session_id: sessionId,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
  }, [draftId, sessionId]);
}
```

Wire it in `IrisInboxPage.tsx` and any other surface that renders draft cards (currently: `IrisApprovalGate.tsx`, `IrisSuggestionCard.tsx` — verify in the implementation PR).

### Hook: `useInboxSession`

New file: `src/hooks/useInboxSession.ts`. Returns a stable UUID for the current inbox-page mount. Reset on full page reload but persists across re-renders.

```ts
export function useInboxSession(): string {
  const [sessionId] = useState(() => crypto.randomUUID());
  return sessionId;
}
```

### Decision instrumentation

Existing approve/reject mutation in `useIrisDrafts.ts` (verified file exists) wraps both the status update and a follow-up `supabase.rpc('record_draft_decision', { ... })` call. The mutation accepts a `decisionMethod` argument set by `IrisApprovalGate.tsx`:

- Keyboard shortcut handler (Cmd+Enter, Cmd+R, Cmd+E) → `'keyboard'`
- Click on Approve/Reject button → `'mouse'`
- (Future, Lap 3+) Voice action → `'voice'`

`IrisApprovalGate.tsx` also tracks an `editsApplied` boolean — set true if the user opened the inline edit panel and modified the payload before approving. Passed as `requiredEdits` to the mutation.

---

## Phase 3 — Daily aggregation snapshot

### Materialized view: `lap_2_gate_metrics_daily`

Refreshed hourly via pg_cron (one of the first uses of the new cron infrastructure being designed in `SCHEDULED_INSIGHTS_SPEC`).

```sql
CREATE MATERIALIZED VIEW lap_2_gate_metrics_daily AS
WITH window_start AS (
  -- Lap 2 starts 2026-06-04 (Day 31 of the 90-day plan, assuming
  -- Lap 1 ended 2026-05-04). Adjust if the kickoff date shifts.
  SELECT '2026-06-04 00:00:00+00'::TIMESTAMPTZ AS lap_2_start
),
pilot_org AS (
  -- The soft-pilot GC's organization_id. To be filled in once the
  -- pilot GC is recruited (see SOFT_PILOT_PLAYBOOK).
  -- Until then, this view returns zeros.
  SELECT id AS org_id FROM organizations WHERE slug = 'soft-pilot-gc-tbd'
),
decided_in_window AS (
  SELECT da.*
    FROM drafted_actions da
    JOIN projects p ON p.id = da.project_id
    JOIN pilot_org po ON po.org_id = p.organization_id
    JOIN window_start ws ON da.decided_at >= ws.lap_2_start
   WHERE da.status IN ('approved', 'rejected', 'executed')
     AND da.decided_at IS NOT NULL
)
SELECT
  CURRENT_DATE AS metric_date,

  -- Gate metric 1: count of approved drafts since Lap 2 start
  COUNT(*) FILTER (WHERE status IN ('approved', 'executed')) AS approved_count,

  -- Gate metric 2: acceptance rate
  -- Numerator: approved (incl. executed and edit-then-approve)
  -- Denominator: approved + rejected (excludes still-pending and withdrawn)
  CASE
    WHEN COUNT(*) FILTER (WHERE status IN ('approved', 'executed', 'rejected')) = 0
      THEN NULL
    ELSE
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE status IN ('approved', 'executed'))
        / COUNT(*) FILTER (WHERE status IN ('approved', 'executed', 'rejected')),
        2
      )
  END AS acceptance_rate_pct,

  -- Gate metric 3: average time-to-approve in seconds
  -- Measured from first_viewed_at to decided_at.
  -- NULL-safe: drafts without first_viewed_at are excluded.
  ROUND(
    AVG(time_to_decide_ms / 1000.0) FILTER (
      WHERE status IN ('approved', 'executed')
        AND time_to_decide_ms IS NOT NULL
    )::NUMERIC,
    1
  ) AS avg_time_to_approve_sec,

  -- Diagnostic breakdowns (not gated, but visible in dashboard)
  COUNT(*) FILTER (WHERE required_edits) AS approved_with_edits_count,
  COUNT(*) FILTER (WHERE decision_method = 'keyboard') AS keyboard_decisions,
  COUNT(*) FILTER (WHERE decision_method = 'mouse') AS mouse_decisions,

  -- Median time-to-approve as a sanity check on the average
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY time_to_decide_ms / 1000.0
  ) FILTER (
    WHERE status IN ('approved', 'executed')
      AND time_to_decide_ms IS NOT NULL
  )::NUMERIC(10, 1) AS median_time_to_approve_sec,

  -- Volume per day (helpful for the "pilot week" daily target of ≥15)
  COUNT(*) FILTER (WHERE decided_at::DATE = CURRENT_DATE) AS approved_today
FROM decided_in_window;

CREATE UNIQUE INDEX idx_lap_2_gate_metrics_daily_date
  ON lap_2_gate_metrics_daily(metric_date);
```

### Refresh job

```sql
-- Refresh every hour; pg_cron entry. Will be installed via the
-- cron infrastructure migration (see SCHEDULED_INSIGHTS_SPEC).
SELECT cron.schedule(
  'refresh-lap-2-gate-metrics',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY lap_2_gate_metrics_daily$$
);
```

---

## Phase 4 — CI assertion

New file: `.github/workflows/lap-2-acceptance.yml` (full spec lives in `LAP_2_ACCEPTANCE_GATE_SPEC`). The CI job's gate-assertion step queries the materialized view and fails if any metric falls below threshold:

```bash
# Pseudo: full SQL in lap-2-acceptance.yml
psql $STAGING_DB_URL -c "
  SELECT CASE
    WHEN approved_count < 100 THEN 'FAIL: count'
    WHEN acceptance_rate_pct < 70 THEN 'FAIL: rate'
    WHEN avg_time_to_approve_sec > 90 THEN 'FAIL: latency'
    ELSE 'PASS'
  END AS gate_status
  FROM lap_2_gate_metrics_daily
  WHERE metric_date = CURRENT_DATE;
" -t -A | grep -q '^PASS$'
```

The CI job runs on a schedule (daily at 18:00 UTC after the pilot's local 5 PM) AND on demand via `workflow_dispatch` so Walker can run the gate manually at the end of Day 60.

---

## Phase 5 — Privacy & ADR-008 (new)

The telemetry rows include `viewer_user_id`. RLS policies prevent a user from seeing other users' viewed drafts (existing policy on `drafted_actions` already enforces project-membership scope). For the soft pilot specifically:

- **Retention.** Telemetry columns retained 12 months post-decision. Beyond 12 months, `viewer_user_id` is nulled, decision_method is set to `'unknown'`, and `inbox_session_id` is nulled. Counts and time-to-decide stay (anonymized).
- **Pilot agreement clause.** The soft-pilot pilot agreement (see `SOFT_PILOT_PLAYBOOK`) must include a sentence: "SiteSync collects timestamps and decision metadata for each Iris draft you review. We use this to measure product fit; we do not sell or share. Aggregated metrics may appear in case studies; individual interactions never will."
- **GDPR-style erasure.** A pilot user requesting erasure removes `viewer_user_id` from all their telemetry rows. The decision (approve/reject) and the timestamps stay for the audit chain (legal-defensibility requirement).

This becomes ADR-008 (Telemetry Retention & Privacy). Drafted alongside this spec; locked before Lap 2 Day 31.

---

## Test plan

### Unit (Vitest)

- `useRecordDraftView` fires `record_draft_view` exactly once per `(draftId, sessionId)` pair even if the draft scrolls in and out of view 10 times
- `useInboxSession` returns a stable UUID across re-renders
- `IrisApprovalGate` passes `decisionMethod: 'keyboard'` when Cmd+Enter is pressed and `'mouse'` when the button is clicked
- `IrisApprovalGate` sets `requiredEdits: true` when the user opened the edit panel before approving

### Integration (Postgres)

- `record_draft_view` RPC is idempotent (call 5 times, `viewed_count` = 5, `first_viewed_at` doesn't change)
- `record_draft_view` fails if the caller is not a project member
- `record_draft_decision` rejects invalid `decision_method` values
- Direct UPDATE on telemetry columns from a `authenticated` role fails (the restrictive policy holds)
- `time_to_decide_ms` and `time_to_first_view_ms` generated columns produce expected values

### E2E (Playwright)

- Open Iris inbox, scroll to a draft → query DB → `first_viewed_at` is set, `viewed_count` = 1
- Approve a draft via Cmd+Enter → query DB → `decision_method` = 'keyboard', `required_edits` = false
- Edit-then-approve a draft → `decision_method` matches input method, `required_edits` = true
- Refresh `lap_2_gate_metrics_daily` → row count and acceptance rate match a hand-computed truth from a known seed

### Property test

Generate 1000 random draft lifecycle traces (created → viewed → decided), apply via the RPCs, query the materialized view, assert that:
- `approved_count + rejected_count` ≤ total drafts
- `acceptance_rate_pct` is in [0, 100]
- `avg_time_to_approve_sec` ≥ 0

---

## File-by-file changelog

| Path | Change | Touched by |
|---|---|---|
| `supabase/migrations/20260504010000_drafted_actions_telemetry.sql` | NEW — columns, indexes, generated cols, RLS, RPCs, materialized view | One PR |
| `src/hooks/useRecordDraftView.ts` | NEW — IntersectionObserver hook | One PR |
| `src/hooks/useInboxSession.ts` | NEW — stable session UUID | One PR |
| `src/hooks/useIrisDrafts.ts` | EDIT — pass `decisionMethod` and `requiredEdits` to the mutation; call `record_draft_decision` after status update | One PR |
| `src/components/iris/IrisApprovalGate.tsx` | EDIT — wire `useRecordDraftView` ref to card root; track `editsApplied` state; pass to mutation; thread keyboard-vs-mouse signal | One PR |
| `src/pages/iris/IrisInboxPage.tsx` | EDIT — provide `useInboxSession` context | One PR |
| `src/types/database.ts` | REGEN — `npm run db-types:write` after migration applies | One PR |
| `.github/workflows/lap-2-acceptance.yml` | NEW — gate assertion job (defined in companion spec) | Companion PR |
| `docs/audits/INDEX.md` | EDIT — add this spec to the Specs table; add ADR-008 row | One PR |

---

## Acceptance criteria for this spec to be considered "shipped"

1. Migration applies cleanly to staging Supabase project; rollback verified
2. `npm run typecheck` is green after the regenerated `database.ts` lands
3. The 6 unit tests + 4 integration tests + 4 E2E tests above all pass in CI
4. A manual end-to-end smoke run shows `lap_2_gate_metrics_daily` returning sensible numbers from a 10-draft seed
5. ADR-008 (Telemetry Retention & Privacy) is committed alongside the migration

---

## What this spec deliberately does NOT cover (deferred to companion specs)

- The gate's CI workflow file (covered by `LAP_2_ACCEPTANCE_GATE_SPEC`)
- The cron infrastructure that schedules the materialized-view refresh (covered by `SCHEDULED_INSIGHTS_SPEC`; this spec assumes pg_cron is available, per ADR-003)
- The pilot user agreement and consent flow (covered by `SOFT_PILOT_PLAYBOOK`)
- The dashboard UI that surfaces these metrics for Walker mid-pilot (out of scope for Lap 2; Walker queries the view manually for the daily 5:30 PM standup until Lap 3)

---

## Appendix — why these column choices

**Why `first_viewed_at` over `last_viewed_at`?** "Time-to-approve" measures the user's decision latency. The first time they laid eyes on it is the start of that clock. `last_viewed_at` would be a different metric (recency of attention) — useful for dashboard, not for the gate.

**Why `viewed_count` and not just a boolean?** When the gate is healthy, viewed_count = 1 or 2. When it's pathological, viewed_count = 8 (user keeps scrolling past, doesn't approve, doesn't reject). That signal — "ambivalence" — is the leading indicator of gate failure. Worth keeping cheap.

**Why generated columns for `time_to_*_ms` instead of computing in the view?** Two reasons. First, generated columns are stored once and indexed; the view recomputes each refresh. Second, future analytics queries (cohort analysis, regression-by-day, etc.) will hit `time_to_decide_ms` directly. Pre-computing once keeps every query fast.

**Why a separate `inbox_session_id` instead of leaning on the audit log's session?** The audit log is per-RPC-call. An "inbox session" is the user's mental session — they open the inbox, decide a few drafts, leave. That mental boundary is the right unit for "how long does an Iris review take in practice" — and it's not visible to the audit log without this column.

**Why an explicit `decision_method` instead of inferring from headers?** The Cmd+Enter / button-click distinction is product-meaningful. Power users who hit keyboard shortcuts have qualitatively different acceptance rates than first-time users who mouse-click. Capturing this lets us answer "is voice (Lap 3) actually faster than keyboard?" with data, not anecdote.
