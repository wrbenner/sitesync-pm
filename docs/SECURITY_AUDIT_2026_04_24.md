# Security Audit — 2026-04-24

**Scope:** RLS coverage on the 18 migrations landed on 2026-04-24
(`20260424000001` through `20260424000018`), plus a grep-style scan of
`src/lib/*.ts`, `src/stores/*.ts`, and `index.html` for hardcoded
secrets, plus a pass over `supabase/functions/*/index.ts` to confirm
every edge function authenticates its caller.

**Auditor:** W3-8 session (SiteSync Sprint Zero agent)
**Patch migration:** `supabase/migrations/20260424000019_rls_audit_patches.sql`

---

## 1. RLS coverage — new tables

| #  | Migration                                | Table(s)                  | RLS | SEL | INS | UPD | DEL | Notes                                                          |
|---:|------------------------------------------|---------------------------|:---:|:---:|:---:|:---:|:---:|----------------------------------------------------------------|
|  1 | 20260424000001_site_check_ins            | site_check_ins            |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by `role IN ('owner','admin')`                    |
|  2 | 20260424000002_crew_checkins             | crew_checkins             |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
|  3 | 20260424000003_risk_predictions          | risk_predictions          |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
|  4 | 20260424000004_subcontractor_ratings     | subcontractor_ratings     |  ✓  | ✓  | ✓  | ✓  | ✓  | Update + delete gated by owner/admin                           |
|  5 | 20260424000005_material_prices           | material_prices           |  ✓  | ✓  | —  | —  | —  | **Intentional:** platform-owned reference data, writes only via service role |
|  6 | 20260424000006_profiles_onboarding_prefs | *(ALTER TABLE only)*      | n/a | n/a | n/a | n/a | n/a | Adds columns to existing `profiles` table — existing RLS covers them |
|  7 | 20260424000007_prequalifications         | prequalifications         |  ✓  | ✓  | ✓  | ✓  | ✓  | Update + delete gated by owner/admin                           |
|  8 | 20260424000008_communication_logs        | communication_logs        |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
|  9 | 20260424000009_timesheets                | timesheets                |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
| 10 | 20260424000010_crew_schedules            | crew_schedules            |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
| 11 | 20260424000011_estimating_items          | estimating_items          |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
| 12 | 20260424000012_estimate_rollups          | estimate_rollups          |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
| 13 | 20260424000013_bid_submissions           | bid_submissions           |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
| 14 | 20260424000014_financial_periods         | financial_periods         |  ✓  | ✓  | ✓  | ✓  | ✓  | Update + delete gated by owner/admin — period close is a privileged action |
| 15 | 20260424000015_retainage_entries         | retainage_entries         |  ✓  | ✓  | ✓  | ✓  | ✓  | Update + delete gated by owner/admin                           |
| 16 | 20260424000016_agent_tasks               | agent_tasks               |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete = owner-only; update = owner OR project admin/owner     |
| 17 | 20260424000017_integration_connections   | integration_connections   |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |
| 18 | 20260424000018_integration_sync_jobs     | integration_sync_jobs     |  ✓  | ✓  | ✓  | ✓  | ✓  | Delete gated by owner/admin                                    |

### Findings — RLS

- **No tables are missing RLS or missing any of the four CRUD policies
  where one is expected.** The only table without INSERT / UPDATE /
  DELETE policies is `material_prices`, which is correct by design — a
  code comment in the migration explicitly documents it as
  service-role-ingested reference data.
- Most `FOR UPDATE` policies are written with `USING` only, no explicit
  `WITH CHECK`. PostgreSQL's default behavior is to reuse `USING` as
  `WITH CHECK` when the latter is omitted, so this is semantically
  complete — the new row must still satisfy the USING expression.
  The patch migration re-issues the `site_check_ins` UPDATE policy with
  an explicit `WITH CHECK` as a worked example of the defense-in-depth
  pattern; the other tables rely on the PostgreSQL default, which is
  acceptable but worth documenting.
- **Patch migration adds `FORCE ROW LEVEL SECURITY` on every new
  table.** Default `ENABLE ROW LEVEL SECURITY` does not apply to the
  table owner; `FORCE` does. `service_role` still bypasses via its
  `BYPASSRLS` grant, which is the intended behavior for the ingestion
  pipelines on `material_prices` and for edge-function writes on
  tables like `risk_predictions`, `integration_sync_jobs`, etc.

### Finding — minor: cross-project row movement

Because most UPDATE policies gate on `project_id IN (SELECT … FROM
project_members WHERE user_id = auth.uid())`, a user who is a member of
*two* projects can technically update a row to move it between those
projects (the UPDATE still passes the project-membership check for the
new `project_id`). This is the same pattern used across the entire
codebase and matches the product's multi-project membership model. No
fix recommended — the attack requires the user to already be a member
of both projects, and the audit trail records the mutation.

---

## 2. Client-side hardcoded secrets

### Method

```
ug -niE "(api[_-]?key|secret|token|\\bsk_[a-zA-Z0-9]{10,}|\\bpk_[a-zA-Z0-9]{10,}|xoxb-|xoxp-|ghp_|eyJ[A-Za-z0-9]{20,})" \
   src/lib/*.ts src/stores/*.ts index.html
```

### Findings

| File                       | Finding                                                                 | Status |
|----------------------------|-------------------------------------------------------------------------|--------|
| `src/lib/supabase.ts:11`   | Hardcoded JWT `VITE_SUPABASE_ANON_KEY` fallback string                  | **FIXED** — removed fallback; throws if env var missing |
| `src/lib/resumableUpload.ts:16-18` | Same hardcoded Supabase anon-key fallback used as TUS apikey header | **FIXED** — removed fallback |
| `src/lib/liveblocks.ts:6`  | `pk_dev_placeholder_not_active` fallback — inert placeholder, Liveblocks *public* key | Accepted — string is a documented inert placeholder, not a real key |
| `src/lib/aiService.ts`     | Reads `VITE_AI_API_KEY` from `import.meta.env`; no fallback             | Clean |
| `src/lib/weather.ts`       | Reads `VITE_OPENWEATHER_API_KEY` from `import.meta.env`; no fallback    | Clean |
| `src/lib/encryption.ts`    | Calls `vault.create_secret` / `vault.read_secret` RPCs — no keys in source | Clean |
| `src/lib/webhooks.ts`      | Accepts `secret` as a function parameter; no hardcoded value            | Clean |
| `index.html`               | No tokens, secrets, or API keys found                                    | Clean |
| `src/lib/env.ts`           | Zod schema; declares VITE_* names only                                  | Clean |

### Background on the Supabase anon key

The Supabase anon JWT is **designed to be public** — it is embedded in
every client bundle. RLS policies on the database enforce access
control; the anon key alone cannot bypass RLS. That said, keeping a
hardcoded fallback inside `src/lib/` was still a problem because:

1. It hid a silent misconfiguration — if `VITE_SUPABASE_ANON_KEY` was
   not injected at build time, the client would connect to the
   hardcoded project (probably the dev/staging one) and "work", making
   the missing env-var invisible until a read / write hit the wrong
   database.
2. Every copy of the JWT in source is an extra place to rotate when
   the project key is revoked.

Fix: both `src/lib/supabase.ts` and `src/lib/resumableUpload.ts` now
read from `import.meta.env` with no fallback. `src/lib/supabase.ts`
throws a descriptive error at client-creation time if either
`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, which is
the correct "fail loudly" posture for a shared client.

---

## 3. Edge function authentication

Every file under `supabase/functions/*/index.ts` was checked against
three valid authentication patterns:

1. **Explicit `authenticateRequest` / `authenticateCron` from
   `shared/auth.ts`** — the standard pattern.
2. **Custom webhook signature verification** — correct for inbound
   webhooks (Stripe, generic webhooks).
3. **Runtime JWT enforcement** (`verify_jwt = true` in
   `supabase/config.toml`, the default) — for functions that don't
   need custom authorization logic beyond "must be signed in".

### Summary

| Function                         | Pattern                                                  | Verdict |
|----------------------------------|----------------------------------------------------------|---------|
| 39 functions (the bulk)          | `authenticateRequest` from `shared/auth.ts`              | ✓       |
| `stripe-webhook`                 | HMAC signature via `stripe-signature` header             | ✓       |
| `webhook-receiver`               | HMAC SHA-256 via `x-webhook-signature` header            | ✓       |
| `ai-insights`, `generate-benchmarks` | `Bearer ${CRON_SECRET}` — fail-closed if env unset   | ✓       |
| `organism-cycle`                 | `Bearer ${ORGANISM_SECRET}` — fail-closed               | ✓       |
| `agent-orchestrator`, `voice-extract` | Read `Authorization` header → pass to supabase-js client → `verifyProjectMembership` | ✓       |
| `api-v1`                         | `authenticateApiKey` from `shared/apiAuth.ts` (API-key auth for the public REST API) | ✓       |
| `extract-schedule-pdf`, `extract-draw-report`, `classify-drawing` | `verify_jwt = false` in config.toml; accept `user_token` in request body, use it as Bearer against Supabase REST. Documented ES256 workaround. | ✓       |
| `parse-ifc`                      | Relies on runtime `verify_jwt = true` only; no additional authorization in-handler | ⚠ see below |

### Finding — parse-ifc

`parse-ifc` has no in-handler authorization. It is still protected by
the Edge Runtime's default `verify_jwt = true`, so only
authenticated users can invoke it. However, if a `model_id` is passed,
it uses `SUPABASE_SERVICE_ROLE_KEY` to insert rows into `bim_elements`
without verifying that the authenticated user is a member of the
project owning that model. A malicious signed-in user who knows a
`model_id` from another organization could inject entities into that
other org's BIM model.

**Recommendation (out of scope for this patch migration):** add a
`verifyProjectMembership` (or an equivalent `model_id → project_id`
lookup + check) before the service-role insert. Not fixed here because
the task's scope limits edits to the patch migration, the audit doc,
and `src/lib/*.ts`.

---

## 4. Patch migration summary

File: `supabase/migrations/20260424000019_rls_audit_patches.sql`

The audit surfaced no tables that outright lack RLS. The patch is
therefore additive / defense-in-depth:

- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (idempotent re-assertion)
  on every new data table
- `ALTER TABLE … FORCE ROW LEVEL SECURITY` on every new data table —
  closes the "table owner bypasses RLS" default
- On `site_check_ins`, re-issues the four policies under
  `DROP POLICY IF EXISTS` + `CREATE POLICY`, with the UPDATE policy
  upgraded to include an explicit `WITH CHECK` clause as a worked
  example of the defense-in-depth pattern

The migration is idempotent and safe to re-run. It does not touch the
columns-only migration (`20260424000006_profiles_onboarding_prefs`)
because that one does not create a new table.

---

## 5. Follow-ups (out of scope for this session)

- **parse-ifc** authorization gap described above.
- Consider upgrading every `FOR UPDATE` policy in the 2026-04-24 batch
  to have an explicit `WITH CHECK` matching `USING`, purely for
  documentation clarity. Current behavior is safe via the PostgreSQL
  default but the code reads more clearly with both clauses present.
- `src/lib/liveblocks.ts` falls back to a `pk_dev_placeholder_not_active`
  string when `VITE_LIVEBLOCKS_PUBLIC_KEY` is unset. Consider following
  the same "throw if missing" pattern we adopted for Supabase for
  consistency, though the practical risk is low because the Liveblocks
  public key is intentionally public.

---

## 6. tsc status

The full-project `tsc --noEmit` remains at the same pre-existing error
count (Supabase v2 type widening across ~4400 call sites, as
documented in previous session notes). No new errors introduced by
this session — the only non-SQL edits were
`src/lib/supabase.ts` (tightened env handling) and
`src/lib/resumableUpload.ts` (removed hardcoded fallback), neither of
which changes any public type signature.
