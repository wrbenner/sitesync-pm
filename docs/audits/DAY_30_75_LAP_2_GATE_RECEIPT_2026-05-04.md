# Day 30.75 — Lap 2 Acceptance Gate Wired

**Date:** 2026-05-04
**Window:** Pre-flight, Day 30.5 (telemetry) → Day 31 kickoff.
**Spec:** `docs/audits/LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`
**Depends on:** `DAY_30_5_IRIS_TELEMETRY_RECEIPT_2026-05-04.md` — telemetry columns + matview must already exist.
**Why this is Day 30.75:** the gate spec called the workflow "scaffolded" but no file existed. With the telemetry migration landed, the workflow can read the matview — closing the loop in one continuous pre-flight push.

---

## What shipped

### 1 SQL migration (`supabase/migrations/20260504010001_audit_incidents.sql`, 124 lines)

- **`audit_incidents` table** — append-only incident log keyed on `id`, with `severity`, `category` (8 values incl. `chain_break`, `rls_leak`, `unauthorized_decision`, `ghost_approval`, `key_leak`, `webhook_replay`, `rate_limit_breach`, `other`), `description`, `context jsonb`, `related_project_id`, and resolution columns. **Resolution annotates rather than deletes** — the audit chain can't tolerate retroactive disappearance.
- **3 indexes** — open-incidents (partial, severity), category, project.
- **RLS** — admin-of-related-org SELECT/UPDATE for project-scoped incidents; INSERT/DELETE service-role only (no policy → FORCE RLS denies authenticated callers). Global incidents are service-role-visible only — humans see them through the gate workflow's SQL output.
- **`lap_2_open_incident_count()` SECURITY DEFINER** — single-call helper that returns the unresolved high/critical count. The gate workflow uses this exact function name.

### 2 Telemetry matview tightened (`20260504010000_drafted_actions_telemetry.sql`)

The original matview followed the telemetry spec verbatim. The gate spec adds tighter counting rules; updated **before merge** (no migration drift):

- **Gate 1 (count)**: now requires `first_viewed_at IS NOT NULL`. Ghost approvals (decision flipped without a view event) no longer inflate the count.
- **Gate 2 (rate)**: numerator matches Gate 1; denominator excludes auto-withdrawn drafts (`decision_note LIKE '[withdrawn by system]%'`) but counts aged-out auto-rejections per spec.
- **Gate 3 (latency)**: outlier exclusion at 30 minutes — drafts where `time_to_decide_ms > 30 * 60 * 1000` are dropped from the average and median (bias-correction per spec § Outliers).
- **New diagnostic columns** the workflow reads:
  - `ghost_approval_count` — security-incident class signal for Gate 4
  - `long_decision_count` — outliers excluded from the average
  - `aged_out_count` — soft-rejections that count against rate
  - `auto_withdrawn_count` — excluded from rate, surfaced as health metric
- All threshold semantics updated: `approved_today` now requires `first_viewed_at` too.

### 3 CI workflow (`.github/workflows/lap-2-acceptance.yml`, 205 lines)

- **Triggers**: cron daily 18:00 UTC; `workflow_dispatch` for the Day 60 ceremony; push to main when telemetry-touching paths change.
- **Steps** in order: install psql/bc → refresh matview → read 5 metrics in one round-trip → verify audit chain → check open incidents → assert thresholds → emit artifact.
- **Threshold assertion** uses `bc -l` for decimal comparisons. Soft-fail band [90, 120s] emits `::warning::` and exits 0. Hard fails emit `::error::` and exit 1.
- **Security**: all dynamic inputs are step outputs / secrets, accessed via `env:` → `$VAR` in shell — no `github.event.*` fields reach a `run:` block, so the command-injection class doesn't apply.
- **Artifact**: `lap-2-gate-report` always uploaded (incl. on failure) with the matview row + the last 50 incidents. 30-day retention.

### 4 Threshold logic — single source of truth (`scripts/lap-2-gate-thresholds.ts`, 96 lines)

`evaluateLap2Gate(metrics)` is a pure function returning `{ verdict: 'pass' | 'soft-fail' | 'hard-fail', failures, warnings }`. The bash workflow and the TS dry-run script must agree; the constants block (`approvedMin: 100`, `rateMinPct: 70`, `latencySoftMaxSec: 90`, `latencyHardMaxSec: 120`) is the cross-reference. A unit test asserts the constants — drift is detectable in CI.

### 5 Dev-side gate scripts (`scripts/check-lap-2-gate.ts` + `scripts/seed-lap-2-gate-dry-run.ts`, 444 lines)

- `check-lap-2-gate.ts` — TS twin of the bash gate, callable from `npx tsx`. Reads the same matview + incidents + chain function via supabase-js. Supports `--json`, `--expect=<verdict>` for asserted dry runs.
- `seed-lap-2-gate-dry-run.ts` — reproduces all 7 spec scenarios:
  - `baseline-pass`, `soft-fail-90s`, `hard-fail-130s`, `one-incident`, `short-volume`, `resolved-hundred`, `ghost-approval`, plus a `reset` option.
  - Owns a deterministic id space (`b0020000-…`). `reset` only deletes that namespace; never touches real data.
  - Idempotent (`upsert(..., { onConflict: 'id' })`). Re-running a scenario clears the prior synthetic state first.
  - Resolves the pilot org by `--pilot-org-slug=<slug>` (default matches the matview placeholder `soft-pilot-gc-tbd`); fails loudly if the org/project/member chain doesn't resolve.

### 6 Threshold unit tests (`scripts/__tests__/lap-2-gate-thresholds.test.ts`, 119 lines, 15 tests)

Covers all 7 spec scenarios plus boundary tests (rate at exactly 70.00%, latency at exactly 90s, latency at 90.01s), NULL rate handling, multi-failure aggregation (6 simultaneous failures), and the constant-cross-reference assertion. **15/15 green.**

---

## Verification

- `npm run typecheck` — **0 errors** on `tsconfig.app.json` + `tsconfig.node.json`. Bugatti gate holds.
- `npx vitest run scripts/__tests__/lap-2-gate-thresholds.test.ts` — 15/15 passing.
- Combined session test count (Day 30.5 + Day 30.75): **27 new green tests, 0 regressions** in the existing 8 telemetry-adjacent tests.

---

## Failure-mode coverage

The gate workflow fails-closed on any of:

| Mode | Source | Exit |
|---|---|---|
| `STAGING_DB_URL` secret missing | refresh step | 1 |
| Matview row missing for `CURRENT_DATE` | read step | 1 |
| Audit chain has any broken row | verify step | 1 |
| ≥1 unresolved high/critical incident | incident step | 1 |
| `approved_count < 100` | assert step | 1 |
| `acceptance_rate < 70%` | assert step | 1 |
| `avg_time_to_approve > 120s` | assert step | 1 |
| `avg_time_to_approve` in [90, 120s] | assert step | 0 + warning |
| `ghost_approval_count > 0` | assert step | 1 |
| All gates green | assert step | 0 |

The qualitative Gate 5 ("I don't want to go back") is **not** in CI by design — the spec is explicit that it must be captured manually by Walker in a `#pilot-quotes` channel. CI passing is necessary but not sufficient for Day 60 close.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/migrations/20260504010001_audit_incidents.sql` | NEW | 124 |
| `supabase/migrations/20260504010000_drafted_actions_telemetry.sql` | EDIT — gate-tightened matview | +60 net |
| `.github/workflows/lap-2-acceptance.yml` | NEW | 205 |
| `scripts/lap-2-gate-thresholds.ts` | NEW | 96 |
| `scripts/check-lap-2-gate.ts` | NEW | 136 |
| `scripts/seed-lap-2-gate-dry-run.ts` | NEW | 308 |
| `scripts/__tests__/lap-2-gate-thresholds.test.ts` | NEW (15 tests) | 119 |
| `docs/audits/INDEX.md` | EDIT — gate spec status, day row | +1 |
| `docs/audits/DAY_30_75_LAP_2_GATE_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new:** ~990 lines + 15 unit tests. Combined with Day 30.5: ~1,650 lines / 19 tests over the full pre-flight pre-Day-31 push.

---

## What's now possible

- **Day 60 ceremony is scriptable.** Walker runs `npx tsx scripts/check-lap-2-gate.ts --json` against staging — gets a verdict + a structured failure list — and the same evaluation path runs nightly in CI.
- **Gate logic has offline coverage.** 15 unit tests prove every spec boundary case. Threshold drift between bash workflow and TS twin is detectable: change one constant and the cross-reference test fails.
- **Pilot dry-run rehearsal is one command per scenario.** Walker can rehearse the full failure-mode tree on staging before any real customer data lands.

---

## What this receipt does NOT cover (deferred)

- **Real pilot org slug.** The matview hard-codes `soft-pilot-gc-tbd`; once the soft-pilot GC is recruited (`SOFT_PILOT_PLAYBOOK`), one `CREATE OR REPLACE MATERIALIZED VIEW` swaps the slug.
- **Anonymization cron** (ADR-008). Lands with `SCHEDULED_INSIGHTS_SPEC` infrastructure. The earliest pilot row is < 60 days old at Lap 2 close, so the 12-month deadline cannot fire mid-Lap-2.
- **`pilot_user_ids` table** for excluding Walker's own decisions from the gate count. Lands with `SOFT_PILOT_PLAYBOOK`.
- **Slack `#pilot-quotes` channel** for Gate 5 capture. Walker-side setup, not in code.
- **Gate dry-run e2e against an ephemeral DB.** The seed + check scripts are the building blocks; a CI job that spins them up against a Postgres test container is a Lap 2 Week 5 add-on.

---

## Next session pickup

The pre-flight is now load-bearing for Day 31 — both telemetry AND the gate read against it are wired. Recommended next blocker, in priority order:

1. **`SCHEDULED_INSIGHTS_SPEC` implementation** (Days 31–35). The cron infrastructure that produces the drafts the gate measures.
2. **`IRIS_CITATIONS_SPEC` implementation** (Days 38–41). Clickable citations + side panel + auto-reject.
3. **`IRIS_VOICE_GUIDE_SPEC` implementation** (Days 43–49). 150-draft hand-edit corpus → `style.ts` + linter.
4. **`SOFT_PILOT_PLAYBOOK` execution** (Days 50–60). Pilot agreement, onboarding, daily standup.

The gate workflow itself can run today against staging — the only missing piece is `STAGING_DB_URL` secret in the GitHub repo settings.
