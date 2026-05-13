# supabase/tests/database — pgTAP test suite

SQL-level integration tests for migrations, RLS policies, and SECURITY DEFINER functions. Introduced as part of BRT subsystem 0 preflight (Day 0) so cross-tenant fixtures can be written in pure SQL and run automatically in CI.

This suite **complements** the TypeScript RLS tests under `tests/iris-evals/kb-retrieval/rls-leakage.test.ts` — it does not replace them. Use pgTAP for:

- Function-level assertions (e.g. SECURITY DEFINER function throws 42501 on cross-tenant call).
- Policy presence/shape (e.g. `pg_policies.qual` matches expected predicate).
- Privilege grants (e.g. `has_table_privilege('anon', 'matview', 'SELECT') = false`).
- Two-JWT functional tests that exercise the policy as a specific tenant would.

Use TypeScript tests for everything that needs the supabase-js client (REST/RLS-via-PostgREST behavior).

## Running locally

```bash
supabase db reset --linked   # rebuild local DB from migrations + seed
supabase test db             # run every supabase/tests/database/*.sql
```

`supabase test db` discovers files in lexical order. Number files with a leading `NNN_` prefix (e.g. `001_foo.sql`) when ordering matters, or use the convention below.

## File naming convention

| Prefix | Scope |
|--------|-------|
| `000_smoke.sql` | Harness verification (must always pass) |
| `p0a_…sql` | P0-A: matview lockdown + RPC wrappers |
| `p0b_…sql` | P0-B: SECURITY INVOKER views |
| `p0c_…sql` | P0-C: `search_project` membership guard |
| `p0d_…sql` | P0-D: `write_audit_entry` membership guard |
| `p0f_…sql` | P0-F: storage bucket project-scoped policies |
| `p1{x}_…sql` | P1 follow-ups (post-Day-5 cleanup) |

## Test skeleton

```sql
BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(<N>);   -- exact number of assertions below

-- Setup (seed fixtures, set GUC, switch role) — all rolled back at the end.
INSERT INTO ... ;
SELECT set_config('request.jwt.claim.sub', '<user-A-uuid>', true);

-- Assertions
SELECT ok( … , 'description' );
SELECT throws_ok( $$ SELECT public.search_project(…) $$, '42501', 'access_denied', 'cross-tenant search rejected' );

SELECT * FROM finish();

ROLLBACK;
```

Always:

- **`ROLLBACK` at the end.** Tests must be idempotent.
- **`SET LOCAL search_path = extensions, public;`** — pgTAP helpers live in `extensions`.
- **Set `plan(N)` to the exact count** — pgTAP fails if the actual count differs.

## Two-JWT pattern (mimicking PostgREST RLS context)

```sql
-- Become user-A
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SET LOCAL role authenticated;
-- … assertions …

-- Become user-B
RESET role;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
SET LOCAL role authenticated;
-- … assertions …
```

`RESET role;` is needed before switching because the JWT claim is read inside policies after the role swap. If a test mixes roles, reset between each.

## CI

`.github/workflows/pgtap.yml` runs this suite on every PR that touches `supabase/migrations/**` or `supabase/tests/database/**`. The job runs `supabase db reset` against a fresh ephemeral Postgres + applies all migrations, then `supabase test db`. Adds ~30s to those PRs.
