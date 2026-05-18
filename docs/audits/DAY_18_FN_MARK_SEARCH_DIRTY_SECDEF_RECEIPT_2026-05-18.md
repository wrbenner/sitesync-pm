# Day 18 — fn_mark_search_dirty SECDEF Receipt — 2026-05-18

**Branch:** `crystalline/fix-security-definer-audit-views`
**Severity:** P0 — every authenticated INSERT/UPDATE/DELETE on rfis, submittals, change_orders, punch_items, meetings, daily_logs, drawings was aborting with `42501 new row violates row-level security policy for table "search_index_dirty_flags"`. Customer-visible: "submittal creation is failing", "all submissions are failing".

## Symptom (production, 2026-05-18)

URL: `https://sitesync-pm.vercel.app/`. Supabase project: `hypxrmcppjfbtlwuoafc`. From Walker's browser console:

- `POST /rest/v1/submittals` → **403 Forbidden** with body:
  ```
  { code: "42501", details: null, hint: null,
    message: "new row violates row-level security policy for table \"search_index_dirty_flags\"" }
  ```
- Many `GET /rest/v1/*` requests returning 401 — likely a session-state issue alongside this bug but **not** caused by it (RLS denial on SELECT returns 200 + empty array, not 401). Tracked separately.
- Edge function `/functions/v1/ai-schedule-risk` returning CORS error (`Access-Control-Allow-Origin: http://localhost:5173`). Separate bug, tracked separately.

## Root cause

`public.fn_mark_search_dirty()` was created in `supabase/migrations/20260503110003_search_index_dirty_flags.sql:33–63` as plain `LANGUAGE plpgsql` — i.e. **SECURITY INVOKER** by default. The function inserts into `search_index_dirty_flags`, which is locked down to `service_role` via `supabase/migrations/20260507000002_submittals_log_mv_and_rpcs.sql:28–48` (`REVOKE ALL FROM PUBLIC`, `GRANT ALL TO service_role`, restrictive policy `FOR ALL TO service_role`).

Trigger fan-out from the same source migration (lines 66–99):

```
AFTER INSERT OR UPDATE OR DELETE ON rfis           EXECUTE fn_mark_search_dirty('rfi')
AFTER INSERT OR UPDATE OR DELETE ON submittals     EXECUTE fn_mark_search_dirty('submittal')
AFTER INSERT OR UPDATE OR DELETE ON change_orders  EXECUTE fn_mark_search_dirty('change_order')
AFTER INSERT OR UPDATE OR DELETE ON punch_items    EXECUTE fn_mark_search_dirty('punch_item')
AFTER INSERT OR UPDATE OR DELETE ON meetings       EXECUTE fn_mark_search_dirty('meeting')
AFTER INSERT OR UPDATE OR DELETE ON daily_logs     EXECUTE fn_mark_search_dirty('daily_log')
AFTER INSERT OR UPDATE OR DELETE ON drawings       EXECUTE fn_mark_search_dirty('drawing')
```

Every user-driven write on those seven tables fires the trigger as the calling user (`authenticated`), which then attempts the restricted insert and aborts the entire transaction.

## Why this wasn't caught earlier

`docs/audits/IRIS_TRIGGER_FIX_RECEIPT_2026-05-14.md` ("Bug 3 retraction") explicitly addressed this 42501 symptom four days ago. The author verified `pg_proc.prosecdef = true` against staging, concluded the function "ALREADY has SECURITY DEFINER in production," and dropped the SECDEF patch from the merge. The 14th receipt's closing note documented this as a "downstream investigation item" but the follow-up never landed.

Two possibilities for why `prosecdef=true` could appear on the verification server while source SQL had no SECDEF clause:

1. Verification ran against staging (`nrsbvqkpxxlonvkmcmxf`), which had been manually `ALTER FUNCTION ... SECURITY DEFINER`'d at some point, while production (`hypxrmcppjfbtlwuoafc`) was reset and lost the manual edit.
2. A different code path (e.g., a hotfix executed via Supabase SQL Editor) had set SECDEF on prod once, then a re-apply of the source migration reverted it.

Either way, the right fix is to make SECDEF the source-of-truth so any future re-apply preserves it. That is this migration.

## Fix

`supabase/migrations/20261102000000_fix_fn_mark_search_dirty_secdef.sql`:

- `CREATE OR REPLACE FUNCTION public.fn_mark_search_dirty() ... SECURITY DEFINER SET search_path = public, pg_temp` — body unchanged except for `public.` schema qualification on `projects` and `search_index_dirty_flags`.
- `ALTER FUNCTION public.fn_mark_search_dirty() OWNER TO postgres` — Supabase's `postgres` role has `BYPASSRLS`, so the SECDEF privilege escalation actually clears the restrictive policy on `search_index_dirty_flags`.
- `COMMENT ON FUNCTION` documents the invariant.

Idempotent, transactional, reversible. No schema change. No data movement.

## Apply

Migration is in repo. Apply to production:

```bash
# Option A: Supabase CLI (preferred if you have the project linked locally)
supabase db push --linked

# Option B: Supabase Dashboard → SQL Editor
# Paste the contents of 20261102000000_fix_fn_mark_search_dirty_secdef.sql
# (no transaction wrapper needed — CREATE OR REPLACE is implicitly safe)
```

Then verify with the Supabase SQL editor:

```sql
SELECT proname, prosecdef, proowner::regrole
  FROM pg_proc
 WHERE proname = 'fn_mark_search_dirty';
-- Expected: prosecdef = true, proowner = postgres
```

## Verify end-to-end

After apply, reproduce the failing flow on `https://sitesync-pm.vercel.app/`:

1. Click Create Submittal → fill Title → Send.
2. Expected: success toast `"Submittal created: <title>"` and a row in `submittals`.
3. Repeat for RFI and daily-log create — all three should now write successfully.
4. SQL verify: `SELECT entity_type, entity_id, marked_at FROM search_index_dirty_flags ORDER BY marked_at DESC LIMIT 5;` — new rows for the three entities you just created.

## Out of scope (filed as follow-ups)

1. **The 401 flood on GET reads** — clicking various red entries in DevTools may surface a separate auth-state issue. The 42501 bug only explains the 403 on POST and any 403 on writes. The 401s on bare SELECT queries (no joins to restricted tables) should be investigated independently after the trigger fix lands and writes start working.
2. **`/functions/v1/ai-schedule-risk` CORS header** — hardcoded `Access-Control-Allow-Origin: http://localhost:5173`. Needs to use the request `Origin` header (validated against an allowlist) or the deployed domain.
3. **Other SECDEF audits** — the iris-ingest trigger functions (`daily_logs_iris_ingest_trigger`, `rfis_iris_ingest_trigger`, `submittals_iris_ingest_trigger`, `change_orders_iris_ingest_trigger`) follow the same pattern and call internal functions that may also write to restricted tables. Sweep recommended in a separate PR.
