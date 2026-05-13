# BRT Sub-0 — Day 0 Receipt (Preflight)

**Date:** 2026-05-12
**Branch:** `brt/sub-0-day-0-preflight`
**Operator:** Claude (Opus 4.7 1M-ctx) via Supabase MCP (project `hypxrmcppjfbtlwuoafc` / "ss pm")
**Reviewer / merge approver:** walker@sitesyncai.com
**Linked plan:** `~/.claude/plans/wise-finding-hippo.md`
**Linked specs:** `BRT_SUBSYSTEM_0_P0_SPRINT_2026-05-12.md`, `STAGE_1_FOUNDATION_AUDIT_2026-05-12.md`, `STAGE_2_SCALE_AUDIT_2026-05-12.md` (in `/sitesync-pm`)

## Purpose

Day 0 prepares the ground for the 5-day P0 hardening sprint:

1. Reconcile live Supabase project against repo migrations. Confirmed: the Stage 2 audit's 7-matview / 8-bucket cross-tenant findings exactly match live state, and the repo declares 5 of 7 matviews and 6 of 14 buckets. Sync migration brings the repo up to authoritative parity.
2. Stand up the pgTAP harness so Days 2–3 cross-tenant fixtures can be written in pure SQL and run in CI.

## Deliverables landed in this PR

| Path | Purpose |
|------|---------|
| `supabase/migrations/20261012000000_p0_preflight_pgtap.sql` | Installs pgTAP into `extensions` schema, idempotent |
| `supabase/migrations/20261012000001_p0_preflight_sync.sql` | Declares the 2 missing matviews + 8 missing buckets (with their currently-broken cross-tenant policies, faithfully) — Day 3b will replace the policies |
| `supabase/tests/database/000_smoke.sql` | Two-assertion smoke test proving the harness is wired |
| `supabase/tests/database/README.md` | Test conventions: skeleton, two-JWT pattern, naming, CI |
| `.github/workflows/pgtap.yml` | New CI workflow: `supabase start` → `supabase test db` on PRs touching migrations or SQL tests |

## Live-state inventory (captured 2026-05-12 via Supabase MCP `execute_sql`)

### 1. Materialized views — 7 found

```
matviewname               | populated | size
--------------------------|-----------|-----------
lap_2_gate_metrics_daily  | t         | 8 KB
pay_app_status_summary    | t         | 8 KB
project_health_summary    | t         | 8 KB
project_metrics           | t         | 8 KB
punch_list_status_rollup  | t         | 8 KB
rfi_kpi_rollup            | t         | 8 KB
submittals_log_mv         | t         | 8 KB
```

**Effective SELECT permission (P0-A blast radius):**

```
matviewname               | anon_select | authenticated_select
--------------------------|-------------|---------------------
lap_2_gate_metrics_daily  | true        | true
pay_app_status_summary    | true        | true
project_health_summary    | true        | true
project_metrics           | true        | true
punch_list_status_rollup  | true        | true
rfi_kpi_rollup            | true        | true
submittals_log_mv         | true        | true
```

→ All 7 are readable by `anon` (unauthenticated!) and `authenticated`. No per-table `GRANT` rows; access comes via `PUBLIC` role default. Day 2 fix uses `REVOKE SELECT FROM PUBLIC, anon, authenticated` to drop the inherited permission.

**Repo state:** `supabase/migrations/20260503110002_materialized_views.sql` declares 5: `project_health_summary`, `pay_app_status_summary`, `project_metrics`, `punch_list_status_rollup`, `rfi_kpi_rollup`. **Missing from repo:** `submittals_log_mv`, `lap_2_gate_metrics_daily`. **Sync'd in this PR** via DDL captured from `pg_get_viewdef()` against live.

### 2. Storage buckets — 14 found

```
bucket                | public | size_limit  | mime_allowlist | repo state
----------------------|--------|-------------|----------------|-----------
attachments           | false  | 100 MB      | (none)         | missing
avatars               | TRUE   | (none)      | (none)         | declared
daily-log-photos      | false  |  50 MB      | (none)         | missing
daily-log-signatures  | false  |  10 MB      | (none)         | missing
documents             | false  | 100 MB      | (none)         | missing
drawings              | false  | (none)      | (none)         | declared
exports               | false  | (none)      | (none)         | declared
field-captures        | false  | (none)      | (none)         | declared
project-files         | false  | 500 MB      | (none)         | declared
punch-list-photos     | TRUE   |  50 MB      | (none)         | missing ⚠
reports               | false  | 100 MB      | (none)         | missing
safety-photos         | false  |  50 MB      | (none)         | missing
sealed-exports        | false  |  10 MB      | text/html,pdf  | declared
submittal-specs       | false  | 100 MB      | (none)         | missing
```

→ 14 live buckets, 6 declared in repo, **8 missing** — and they exactly match the audit's P0-F set. All 8 are **sync'd in this PR** via `INSERT … ON CONFLICT (id) DO NOTHING`.

→ ⚠ `punch-list-photos` is `public=true` — that's a P0-F adjacent issue (construction site imagery should not be world-readable via CDN). Flagged in migration comment; flip to false in a follow-up slice once Walker confirms no public consumers (and audits the existing 0 objects in the bucket — none currently).

→ ⚠ `avatars` is `public=true` AND has no per-user-scoped policy on listing — that's audit P1-F (avatar enumeration). Out of P0 scope; documented for a P1 sprint.

### 3. Storage object folder structure (Day 3b gate check)

```
bucket            | object_count | top-level folder pattern
------------------|--------------|--------------------------
daily-log-photos  | 45           | <project_id UUID>
documents         | 21           | <project_id UUID>
field-captures    | 2            | <project_id UUID>
project-files     | 6026         | <project_id UUID> × 3, plus 'submittals' literal
(other 10)        | 0            | empty
```

→ **Day 3b gate: GREEN.** Of the 8 cross-tenant buckets the audit flags, 6 are empty and 2 (`daily-log-photos`, `documents`) populate with `<bucket>/<project_id>/<file>` exactly. Walker's "6 currently-empty buckets" note matches live. Day 3b policies can apply the `(storage.foldername(name))[1] = project_id::text` predicate without breaking existing access.

→ The `project-files/submittals/...` path family is outside the P0-F set (project-files already has correctly-scoped policies) but worth noting for a future audit slice — those objects can't be reached under the current `project_files_*` policies and are likely orphaned.

### 4. SECURITY DEFINER views in `public` — 6 found

```
view_name                       | owner    | reloptions
--------------------------------|----------|-----------
executor_daily_counts           | postgres | (none)
iris_ingest_queue_depth         | postgres | (none)
iris_kb_health_daily            | postgres | (none)
iris_kb_retrieval_p95_1h        | postgres | (none)
iris_kb_source_coverage_7d      | postgres | (none)
org_executor_cancel_rate_7d     | postgres | (none)
```

→ Matches audit P0-B exactly. Owner = `postgres` + `reloptions IS NULL` means these run with postgres privileges and bypass RLS on their underlying tables. Day 1 PM migration sets `security_invoker = true` on all 6. View definitions captured for fallback planning; underlying tables are `executor_runs`, `iris_kb_telemetry`, `iris_kb_chunks`, `organizations`, `pgmq.q_iris_ingest` — all of which have RLS appropriate for user-scoped consumption.

→ **Risk to track on Day 1:** the `iris_ingest_queue_depth` view selects from `pgmq.q_iris_ingest` which has no user-facing RLS (it's a queue, not application data). Under SECURITY INVOKER, regular users will see 0 rows. That's correct security posture but breaks if Walker's queue-depth dashboard is wired to a user-token call. Mitigation if needed: route the dashboard through a SECURITY DEFINER **function** that explicitly checks for an admin role rather than recreating the bypass.

### 5. Storage policies on `storage.objects` — 28 total

The cross-tenant-leak policies (P0-F set):

```
policyname                              | cmd | predicate
----------------------------------------|-----|-------------------------------------------
storage_attachments_access              | ALL | bucket_id = 'attachments' AND auth.uid() IS NOT NULL
storage_daily_log_photos_access         | ALL | bucket_id = 'daily-log-photos' AND auth.uid() IS NOT NULL
storage_daily_log_signatures_access     | ALL | bucket_id = 'daily-log-signatures' AND auth.uid() IS NOT NULL
storage_documents_access                | ALL | bucket_id = 'documents' AND auth.uid() IS NOT NULL
storage_punch_list_photos_access        | ALL | bucket_id = 'punch-list-photos' AND auth.uid() IS NOT NULL
storage_reports_access                  | ALL | bucket_id = 'reports' AND auth.uid() IS NOT NULL
storage_safety_photos_access            | ALL | bucket_id = 'safety-photos' AND auth.uid() IS NOT NULL
storage_submittal_specs_access          | ALL | bucket_id = 'submittal-specs' AND auth.uid() IS NOT NULL
```

→ Faithfully declared in sync migration so Day 3b can drop+replace cleanly on both fresh resets and live.

The already-correctly-scoped policies (`drawings_*`, `exports_*`, `field_captures_*`, `project_files_*` — each split into SELECT/INSERT/UPDATE/DELETE with `EXISTS (SELECT 1 FROM project_members …)` predicates) match the pattern Day 3b will apply to the 8 above. No changes needed there.

## pgTAP harness — smoke verification

After this PR merges to `main`, the `pgtap.yml` workflow will fire on the next migration-touching PR. Local verification command:

```bash
cd /Users/walkerbenner/Desktop/sitesync-main
supabase start
supabase test db
supabase stop --no-backup
```

Expected output for `000_smoke.sql`:

```
ok 1 - pgtap extension is installed
ok 2 - extensions.plan() helper is callable
1..2
```

→ CI run on this PR will produce the binding result; pasted below at merge.

```
<pgtap.yml CI run output — to be pasted at PR merge>
```

## Open items / hand-off to Day 1

1. **Operator (next session):** Day 1 morning — inspect `supabase/functions/iris-call/index.ts` for the supabase client used to write `iris_call_idempotency` (P0-E verification). Inspect grant on `verify_audit_chain` (P1-D).
2. **Walker:** when convenient, toggle "Leaked Password Protection" on in Supabase Auth dashboard (P2-4). Not a blocker.
3. **Operator (next session):** Day 1 afternoon — branch `brt/sub-0-day-1-verifications`, migration `20261012010000_p0b_security_invoker_views.sql` setting `security_invoker=true` on all 6 SD views. Pre/post manual smoke of Walker's Iris dashboards.

## Exit criteria for Day 0

- [x] pgTAP migration applies cleanly (idempotent install).
- [x] Sync migration declares the 2 missing matviews + 8 missing buckets with their broken policies (faithful reproduction).
- [x] `000_smoke.sql` written; will be verified by the new CI workflow when this PR's checks run.
- [x] Live inventory captured: matviews, buckets, SD views, policies, folder structure.
- [x] Day 3b gate question answered (GREEN — populated buckets use project_id at folder level 1).
- [ ] CI green on this PR (pgtap.yml + existing checks).
- [ ] Merged to `main`.

## Sign-off

| Role | Name | Date |
|------|------|------|
| Operator | Claude (Opus 4.7 1M-ctx) | 2026-05-12 |
| Reviewer / merge approver | walker@sitesyncai.com | _pending_ |
