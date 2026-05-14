# IRIS Ingest Trigger Fix Receipt — 2026-05-14

**Branch:** `fix/iris-ingest-trigger-column-drift`
**Scope:** Two real production write-path bugs in the iris-ingest trigger layer, surfaced by the BRT scale-test harness on 2026-05-14.
**Severity:** P0 — every real production write on `rfis`, `daily_logs`, `punch_items`, `submittals`, `documents`, and `change_orders` was tripping 42703 (`column does not exist`) inside trigger code. Customer-visible behavior was masked only because no recent user-driven write had reached this surface after the schema drift.

---

## Migrations included

### 1. `supabase/migrations/20261020000000_fix_iris_ingest_trigger_column_name.sql`

Already in the repo (authored earlier, never applied to either project). Replaces four trigger functions to fix `projects.org_id` → `projects.organization_id`:

| Function | Before (broken) | After (fixed) |
|---|---|---|
| `public.documents_iris_ingest_trigger()` | `SELECT org_id FROM public.projects WHERE id = NEW.project_id` | `SELECT organization_id FROM public.projects WHERE id = NEW.project_id` |
| `public.rfis_iris_ingest_trigger()` | same broken SELECT | same fix |
| `public.daily_logs_iris_ingest_trigger()` | same broken SELECT | same fix (but `NEW.narrative` still wrong — see migration 2) |
| `public.change_orders_iris_ingest_trigger()` | same broken SELECT | same fix |

The pgmq payload field passed to `iris_enqueue_ingest` stays `org_id` — only the source-of-truth read changes. Worker contracts are unaffected.

**Verification against staging (`nrsbvqkpxxlonvkmcmxf`):**
```sql
-- Confirm projects.organization_id exists and projects.org_id doesn't
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='projects' AND column_name IN ('organization_id','org_id');
-- Expected: only organization_id present
```

### 2. `supabase/migrations/20261022000000_fix_daily_logs_iris_summary.sql`

New. Renamed from a draft titled `_fix_iris_narrative_and_search_dirty_definer.sql` — the SECURITY DEFINER block was trimmed before merge (see Bug 3 retraction below).

Replaces `public.daily_logs_iris_ingest_trigger()` again, this time fixing the trigger body's reference to `NEW.narrative`:

| Body reference | Before | After |
|---|---|---|
| Hash input field | `coalesce(NEW.narrative, '')` | `coalesce(NEW.summary, '')` |

**Verification against staging:**
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='daily_logs' AND column_name IN ('narrative','summary');
-- Expected: only summary present (narrative absent)
```

Migration 20261020 SET the function's body once; this migration overwrites it with the body that uses `NEW.summary`. The order is correct: 20261020 fires first (chronological), then 20261022 supersedes the daily_logs body.

---

## Bug 3 retraction

An earlier draft of the second migration also re-declared `public.fn_mark_search_dirty()` with `SECURITY DEFINER`. The motivation was a 42501 RLS rejection observed when inserting `punch_items` / `submittals` from a scale-test owner token — the trace pointed at `INSERT INTO search_index_dirty_flags`.

**Verification disproved the hypothesis:**
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'fn_mark_search_dirty';
-- Result: prosecdef = true
```

`fn_mark_search_dirty` is ALREADY `SECURITY DEFINER` in production. The SECDEF re-declaration was dropped from `20261022000000` before merge.

The actual root cause of the 42501 on `search_index_dirty_flags` is a downstream investigation item — likely the function-owner role doesn't have BYPASSRLS, OR `search_index_dirty_flags` has a restrictive policy I haven't read. Documented as a follow-up in the BATTLE_TEST_RECEIPT, not in this PR.

---

## Companion script changes (Phase 0.5 of the battle-test mission)

This PR also lands hybrid CLI reconcile patches on `scripts/scale-test/*` so the runbook commands work as written:

- `mint-vu-tokens.ts`: adds `--owners-only` (plural) alias for `--owner-only`; adds `--throttle <req/s>` alias for `--rate-ms <ms>`; emits runbook-shape NDJSON `{userId, orgId, projectId, accessToken, role, email, expiresAt}` when the output path ends in `.ndjson` or `--ndjson` is set; defaults fixture/out paths.
- `seed-projects.ts`: defaults `--fixture` and `--out` to `ops/scale-test-fixtures.ndjson`; upgrades the blocklist guard to hard-fail when `SCALE_TEST_PROD_BLOCKLIST` is empty.
- `seed-storage.ts`: defaults `--fixture` to `ops/scale-test-fixtures.ndjson`; raises `--per-project` default to 9 (matches incident-shape); adds the hard-fail blocklist guard.
- `teardown.ts`: adds the hard-fail blocklist guard with `--i-know-this-is-blocklisted` opt-in for incident-cleanup runs.
- `run.ts` (k6): auto-detects token-file shape — accepts both the legacy JSON `{tokens: [...]}` and the runbook NDJSON one-line-per-token. `accessToken` field is honored as an alias for `jwt`.

These edits are co-located with the trigger fix so the same PR review covers the full incident-response surface.

---

## Blast radius if not fixed

Every real production INSERT or UPDATE on `rfis`, `daily_logs`, `punch_items`, `submittals`, `documents`, or `change_orders` trips inside the iris trigger:

- **rfis / documents / change_orders / daily_logs (column-name bug):** PGSQL 42703 inside the SELECT against `projects` — the entire INSERT/UPDATE statement is aborted by the trigger.
- **daily_logs (narrative bug):** PGSQL 42703 reading `NEW.narrative` inside the md5 hash — same effect.

End-user impact: cannot create RFIs, daily logs, punch items, submittals, change orders, or upload documents. Customer-facing 500s on every relevant POST/PATCH. Pre-July-1 beta launch with this on the trunk would be a Day-0 outage.

---

## Verification plan after `supabase db push --linked` to staging

```sql
-- Trigger bodies updated correctly:
SELECT proname, prosrc FROM pg_proc
WHERE proname IN ('rfis_iris_ingest_trigger','daily_logs_iris_ingest_trigger','documents_iris_ingest_trigger','change_orders_iris_ingest_trigger');
-- Each prosrc must contain "organization_id" and NOT contain "org_id"
-- daily_logs_iris_ingest_trigger must contain "NEW.summary" and NOT contain "NEW.narrative"

-- End-to-end: an INSERT against rfis under a scale-test token now succeeds:
-- (Performed via run.ts smoke profile — see BATTLE_TEST_RECEIPT_2026-05-14.md)
```

---

## Standing Decisions touched

- **§4 (shadow-row pairing):** Not applicable — these migrations land via `supabase db push --linked`, not via MCP `apply_migration`. No shadow-INSERT needed.
- **§1 intent (typecheck-green):** Verified locally before opening this PR (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json` → no errors).
- **§6 intent (tracker update):** Not yet — Phase 5 of the battle-test mission hasn't completed. Pending the BATTLE_TEST_RECEIPT.
