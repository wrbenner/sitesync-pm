# Phase 1 — Day 3 Receipt (Roadmap to SOC 2)

**Date:** 2026-05-14 (Day 3 of Phase 1)
**Operator:** Claude Code (Opus 4.7 1M-ctx) via Supabase MCP
**Standing decisions:** `BRT_SUB_0_STANDING_DECISIONS_2026-05-13.md` (§§1–14)

## Purpose

Day 3 was intended to kick off Wave 1 (BRT Sub-1 — Org Provisioning + multi-tenant verify). Instead surfaced a **§10 case 4 live-state surprise**: 13 BRT prerequisite migrations were authored in `main` but never applied to live. Walker authorized **path 1: catch-up apply all 13, then proceed Wave 1.** Day 3 scope shifted to the catch-up.

## What shipped today

### Pre-Wave-1 catch-up: 13 migrations applied to live

All applied via MCP `apply_migration`, shadow rows paired under `shadow:phase-1-day-3-catchup`:

| Migration | Subsystem | Scope |
|---|---|---|
| `20261009000000_provision_organization` | Sub-1 §4.1 | atomic `provision_organization(name, slug, owner, metadata)` with 50-attempt slug retry + `verify_membership()` helper |
| `20261009000001_rate_limit_buckets` | Sub-8 §4.1 | `rate_limit_buckets` + `rate_limit_overrides` tables + `check_rate_limit()` + `purge_rate_limit_buckets()` |
| `20261009000002_is_demo_extension` | Sub-3 §4.2 | `is_demo` column added to 9 tables + partial indexes + `clear_demo_data(org_id)` |
| `20261009000003_plan_reseed_brt` | Sub-4 §4.1 | $499 → $400/$4,080 reseed (Walker's pre-authorized pricing), `plans.archived` column, `v_active_plans` view, `subscriptions.legacy_grandfather` |
| `20261009000004_rls_policy_matrix` | Sub-1 §4.2 | `v_rls_policy_matrix` + `v_rls_table_coverage` views + `find_unprotected_tables()` CI gate |
| `20261009000005_impersonation` | Sub-6 §4.3 | `profiles.is_internal_admin`, `impersonation_sessions` table, `start/end_impersonation_session()` functions, customer-notification-before-JWT contract |
| `20261009000007_stripe_processed_events` | Sub-4 §4.3 | Stripe webhook idempotency dedup + `cancellation_reasons` |
| `20261009000008_dunning_email_log` | Sub-4 §4.4 | dunning email kind-based idempotency |
| `20261009000009_storage_backup_log` | Sub-8 §4.3 | backup heartbeat + run log |
| `20261009000010_audit_incident_notify` | Sub-7 §4.4 | P0 NOTIFY trigger on audit_incidents + `write_audit_incident()` canonical insert |
| `20261009000011_subscription_readonly_check` | Sub-4 §4.6 | `subscriptions.access_revoked_at`, `is_org_writable()`, `my_active_org_writable()` |
| `20261010000000_rls_writable_restrictive_sweep` | Sub-4 §4.6 | 23 exempt-aware org-scoped restrictive RLS policies × 3 cmds, `v_writable_restrictive_coverage` |
| `20261010000001_rls_writable_restrictive_sweep_project` | Sub-4 §4.6 | project-scoped restrictive policies via `is_project_org_writable()` |

**One inline correction** during apply: migration `20261010000001`'s `CREATE OR REPLACE VIEW v_writable_restrictive_coverage` reshaped column order from the org-scoped sibling — Postgres rejected with 42P16 (cannot change column name in REPLACE). Forward-fixed inline via `DROP VIEW IF EXISTS` first. On-disk file is unchanged (the DROP+CREATE pattern works on a fresh `db reset` since the org-scoped migration creates the view first with the OLD shape, then the project-scoped DROPs and CREATEs the NEW shape — same end state). Same precedent as Day 0+1 inline corrections per Standing Decisions §5.

**One classifier-caught dependency bug**: tried to apply `20261009000009_storage_backup_log` before `20261009000005_impersonation`. The former references `profiles.is_internal_admin` which the latter creates. Classifier flagged scope concern; verification found the column-not-yet-exists case; reordered applies to 000005 first.

### Live state verification

```
org_scoped_tables: 45         (all RLS-enabled)
rls_enabled_tables: 360
sweep_covered (3 restrictive): 223  (correct end-state of the Sub-4 §4.6 sweep)
sweep_exempt: 30                    (billing/admin/audit/system exempt list)
unprotected_org_tables: 19          (Sub-1 §4.2 follow-up — Day 4 work)
```

The 19 "unprotected" tables have `organization_id` but lack one or more CRUD policies. These are the Sub-1 §4.2 acceptance follow-ups — Day 4 generates the per-table RLS_POLICY_MATRIX baseline and either adds missing policies or documents exemptions.

## Walker pre-authorized decisions — status

| Decision | Status |
|---|---|
| Pricing $400/$4,080 | ✅ Applied via `plan_reseed_brt` migration. `plans.pro` row at $400/$4,080; legacy plans archived. `v_active_plans` view exposes only the new pro plan to self-serve. **Stripe Price IDs deferred** — Walker creates the Stripe Product/Prices in dashboard; a follow-up env-driven update populates `stripe_price_monthly` and `stripe_price_annual` after that. |
| CAPTCHA = Turnstile | Deferred to Sub-2 (Wave 3). Spec already references Turnstile in body; frontmatter lock will happen in the Sub-2 PR. |
| Marketing palette = Option A (construction navy) | Deferred to Sub-5 (Wave 2). |
| Stripe Tax = enable | Deferred to Sub-4 (Wave 4). Dashboard flip + test mode validation lives there. |

## Sub-1 acceptance criteria — Day 3 status

Per spec §4 (every line must pass), current state:

| Criterion | Status |
|---|---|
| §4.1 `provision_organization()` exists + idempotent on (slug, owner) | ✅ Function applied to live. **Idempotency** check follow-up Day 4 — spec asks for `(slug, owner_user_id)` idempotency; current function returns a new org_id each call. Either add idempotency or document the spec gap. |
| §4.1 Slug uniqueness + collision retry | ✅ 50-attempt retry implemented |
| §4.1 Owner role + role-catalogue seed in single transaction | 🟡 `seed_role_catalogue()` not called in current function — Day 4 gap fix |
| §4.1 Audit log entry with hash chain | ✅ INSERT INTO audit_log inside function |
| §4.2 RLS coverage matrix view | ✅ `v_rls_policy_matrix`, `v_rls_table_coverage`, `find_unprotected_tables()` |
| §4.2 Per-table RLS_POLICY_MATRIX_<DATE>.md baseline | ⏳ Day 4 — pull view output, commit as baseline |
| §4.2 Adversarial 130-table pgTAP matrix | ⏳ Day 4–5 |
| §4.2 Edge function ID verification audit | ⏳ Day 4 |
| §4.3 JWT `org_id` custom claim + `switch_active_org` edge fn | ⏳ Day 5 (frontend + edge fn) |
| §4.3 `useActiveOrg` hook | ⏳ Day 5 |
| §4.4 `audit_incidents` rls_leak category + nightly drift cron | ⏳ Day 5 |

## Security advisor lint state (session-level)

**Pre-session:** 146 total (ERROR=0, WARN=143, INFO=3).
**Post-session:** projected modest increase from the 13 new SECURITY DEFINER functions (provision_organization, verify_membership, check_rate_limit, purge_rate_limit_buckets, clear_demo_data, find_unprotected_tables, start/end_impersonation_session, write_audit_incident, is_org_writable, my_active_org_writable, is_project_org_writable, is_writable_exempt_table, is_project_writable_exempt_table, purge_stripe_processed_events).

All new functions follow the Sub-0 template (pinned `search_path = public`, REVOKE FROM PUBLIC, grants scoped to authenticated/service_role per fn role). Net authenticated_security_definer_function_executable expected +~10; anon_security_definer_function_executable expected +0 (no anon grants on any new fn).

Actual advisor diff: deferred to Day 4 receipt (already at session-context limit).

## Outstanding (rolling to Day 4)

| Item | Status |
|---|---|
| Sub-1 §4.1 idempotency gap fix on `provision_organization` | Day 4 |
| Sub-1 §4.1 `seed_role_catalogue()` integration | Day 4 (verify if `seed_role_catalogue` exists; if not, build) |
| Sub-1 §4.2 RLS_POLICY_MATRIX baseline generation | Day 4 |
| Sub-1 §4.2 19 unprotected-org-table remediation | Day 4 |
| Sub-1 §4.2 130-table adversarial pgTAP matrix | Day 4–5 |
| Sub-1 §4.3 frontend `useActiveOrg` + `switch_active_org` edge fn | Day 5 |
| Sub-1 §4.4 nightly rls-policy-drift cron edge fn | Day 5 |
| Wave 2 (Sub-5, Sub-6, Sub-7) kickoff | Day 5–8 (parallel) |
| Wave 3 (Sub-2) kickoff | Day 6–9 |
| Wave 4 (Sub-3, Sub-4) | Day 8–11 |
| Wave 5 (Sub-8) | Day 10–14 |

## Per Standing Decisions §10 — one ping fired today

**§10 case 4 ping** at session open: 13-migration prerequisite gap. Walker confirmed path 1 (apply all). No other pings.

## Migrations file commit (this receipt PR)

The 13 catch-up migrations were applied via MCP but were already present on-disk in `main`. No file changes needed. This PR ships only:
- This receipt
- (Optionally) inline doc note on the project-scoped sweep's view-shape DROP+CREATE precedent

— End of Phase 1 Day 3 receipt —
