# BRT Subsystem 0 — P0 Hardening Sprint — Final Receipt

**Sprint dates:** 2026-05-12 (Day 0 kickoff) → 2026-05-13 (Day 5 close-out)
**Operator:** Claude Code (Opus 4.7 1M-ctx) via Supabase MCP, with Cowork-side dashboard execution for P0-F storage policies
**Reviewer / verifier:** Walker Benner (Cowork-side independent SQL verification + manual UI smoke per Standing Decisions §8)
**Authoritative references:**
- Sprint spec: `BRT_SUBSYSTEM_0_P0_SPRINT_2026-05-12.md`
- Standing decisions: `BRT_SUB_0_STANDING_DECISIONS_2026-05-13.md`
- Stage 1 audit: `STAGE_1_FOUNDATION_AUDIT_2026-05-12.md`
- Stage 2 audit: `STAGE_2_SCALE_AUDIT_2026-05-12.md`
- Per-day receipts: `BRT_SUB_0_DAY_0_1_COWORK_RECEIPT_2026-05-13.md`, `BRT_SUB_0_DAY_2_RECEIPT_2026-05-13.md`, `BRT_SUB_0_DAY_3_RECEIPT.md`
- Plan: `~/.claude/plans/lucky-watching-bird.md`

## Purpose

Sub-0 of the Beta Readiness Track: close every P0 finding from the
Stage 1 + Stage 2 audits before any further beta-launch work depends
on the security posture. Deliverable: zero ERROR-level Supabase
security advisor lints + functional closure of 9 P0 items.

## Scope completed

### 9 P0 items closed

| ID | Description | Day | Approach |
|---|---|---|---|
| **P0-A** | 7 matviews exposed via PostgREST, bypassed RLS | Day 2 | 6 SECURITY DEFINER wrapper RPCs (5-arg Bugatti for submittals_log_mv; org-arg widening for project_metrics + project_health_summary); REVOKE direct SELECT on all 7; 10 frontend call-site migration |
| **P0-B** | 6 views declared SECURITY DEFINER (or unmarked = DEFINER semantics on Supabase) | Day 1 | `ALTER VIEW ... SET (security_invoker = true)` on all 6 |
| **P0-C** | `search_project()` lacked membership check | Day 3 AM | `CREATE OR REPLACE` in-place; prepended canonical `EXISTS(project_members)` guard + RAISE 42501 |
| **P0-D** | `write_audit_entry()` lacked membership check | Day 3 AM | same in-place pattern as P0-C |
| **P0-E** | `iris_call_idempotency` had RLS on, zero policies → cache writes silently failed | Day 1 | added `iris_call_idempotency_own_row` policy `user_id = (SELECT auth.uid())` |
| **P0-F** | 8 storage buckets had weak ALL-policies (`bucket_id='X' AND auth.uid() IS NOT NULL`) | Day 3 PM | dropped 8 weak policies; created 32 per-command (SELECT/INSERT/UPDATE/DELETE × 8 buckets) project-scoped policies gated by `project_members` via folder-level-1 UUID extraction |
| **P0-G** | `authStore.setCurrentOrg` flipped state without cancelling/clearing query cache or re-tagging Sentry | Day 4 AM | function now async; cancelQueries + clear + setSentryUser(orgId) on real switches; same-org rename remains no-op on cache |
| **P0-H** | signup didn't surface the resolved slug after `provision-org` collision retry | Day 4 PM | captured `slug` from edge-fn response; rendered in success state with collision notice when resolved ≠ typed |
| **P0-I** | signup form missing required Terms/Privacy acceptance | Day 4 PM | required checkbox + `signupSchema.acceptedTerms` + `profiles.terms_accepted_at timestamptz` migration + placeholder /terms /privacy routes |

Plus **P1-D** (verify_audit_chain EXECUTE revoke) was closed alongside Day 1 since it shared the deposition-grade audit infrastructure.

### Sprint counts: 9 P0 + 1 P1 closed across 4 active execution days (Days 0+1, 2, 3, 4) + Day 5 close-out.

## Final security advisor lint state

```
ERROR  0
WARN   273
INFO   3
TOTAL  276
```

| Lint family | Day 0 baseline | Day 5 final | Δ | Level | Disposition |
|---|---|---|---|---|---|
| **security_definer_view** | **6** | **0** | **−6** | ERROR | ✅ **CLOSED** (P0-B, Day 1) |
| **materialized_view_in_api** | **7** | **0** | **−7** | WARN | ✅ **CLOSED** (P0-A, Day 2) |
| anon_security_definer_function_executable | 77 | 74 | −3 | WARN | ✅ Day 1 P1-D (−1) + Day 3 P0-C/D (−2) |
| authenticated_security_definer_function_executable | 77 | 82 | +5 | WARN | ⚠ **Accepted trade-off** — Day 2 wrappers +6 net of Day 1 P1-D −1; Day 3 modify-in-place added 0; inherent cost of `SECURITY DEFINER` wrapper pattern (required to bypass post-Phase-3 REVOKE on matviews) |
| function_search_path_mutable | 83 | 81 | −2 | WARN | ✅ Bonus from Day 3 pinning `search_path=public` on both in-place fixes (originally P2-3 scope) |
| rls_enabled_no_policy | 4 | 3 | −1 | INFO | ✅ Day 1 P0-E closed iris_call_idempotency |
| rls_policy_always_true | 31 | 31 | 0 | WARN | P1-A scope (out of Day 0–5 plan) |
| extension_in_public | 3 | 3 | 0 | WARN | P2-1 scope |
| public_bucket_allows_listing | 1 | 1 | 0 | WARN | P1-F scope |
| auth_leaked_password_protection | 1 | 1 | 0 | WARN | P2-4 scope |

**ERROR-level dropped 6 → 0.** Sprint goal met.

## Migrations applied (live + shadow rows)

| MCP apply version | On-disk version | Name | Day |
|---|---|---|---|
| 20260513133948 | 20261012000000 | p0_preflight_pgtap | Day 0 |
| 20260513134742 | 20261012000001 | p0_preflight_sync | Day 0 |
| 20260513134757 | 20261012010000 | p0e_iris_call_idempotency_policy | Day 1 |
| 20260513134816 | 20261012010001 | p0b_security_invoker_views | Day 1 |
| 20260513134831 | 20261012010002 | p1d_revoke_verify_audit_chain | Day 1 |
| 20260513142756 | 20261013000000 | p0a_matview_wrapper_rpcs | Day 2 |
| 20260513143607 | 20261013000001 | p0a_widen_submittals_log_mv_bugatti | Day 2 |
| 20260513150900 | 20261013000002 | p0a_widen_project_metrics_and_health_summary_org_filter | Day 2 |
| 20260513… | 20261013010000 | p0a_matview_revoke_direct | Day 2 |
| 20260513… | 20261014000000 | p0c_p0d_membership_guards | Day 3 AM |
| (Cowork dashboard apply) | 20261014010000 | p0f_storage_buckets_project_scoped | Day 3 PM |
| 20260513… | 20261015010000 | p0i_terms_accepted_at | Day 4 PM |

All 12 paired (real apply + shadow under future-dated `20261012*–20261015*` versions). `db push --linked` from any fresh checkout is idempotent.

## Frontend changes

PR #508 (Day 2): 10 call sites across 6 files migrated to `.rpc()` wrappers.
PR #511 (Day 4 AM): authStore + sentry + useOrganization atomicity.
PR #512 (Day 4 PM): Signup.tsx checkbox + slug surfacing, schemas/auth.ts acceptedTerms, 2 placeholder legal pages, App.tsx routes.

## Cross-tenant fixture matrix

| Fixture | Day | Status |
|---|---|---|
| `p0b_security_invoker.sql` | Day 1 | ✅ pgTAP green |
| `p0e_idempotency_policy.sql` | Day 1 | ✅ pgTAP green |
| `p1d_verify_audit_chain_revoked.sql` | Day 1 | ✅ pgTAP green |
| `p0c_search_project_cross_tenant.sql` | Day 3 AM | ✅ pgTAP raises 42501 verified |
| `p0d_write_audit_entry_cross_tenant.sql` | Day 3 AM | ✅ pgTAP raises 42501 verified |
| `p0f_storage_cross_tenant.sql` | Day 3 PM | ✅ pgTAP shape verification (4 assertions: 0 weak, 32 new, all authenticated, all project_members gated) |
| `authStore.setCurrentOrg.test.ts` (P0-G) | Day 4 AM | ✅ vitest 3/3 pass |

## PRs merged

| PR | Branch | Day |
|---|---|---|
| #502 | brt/sub-0-day-0-preflight | Day 0 |
| #503 | brt/sub-0-day-1 | Day 1 |
| #506 | brt/sub-0-day-1-hotfix-mcp-apply | Day 1 hotfix |
| #508 | brt/sub-0-day-2-p0a-matview-lockdown | Day 2 |
| #509 | brt/sub-0-day-3-p0c-p0d-p0f | Day 3 |
| #511 | brt/sub-0-day-4-am-p0g-authstore-atomicity | Day 4 AM |
| #512 | brt/sub-0-day-4-pm-p0h-p0i-signup | Day 4 PM |

All auto-merged or admin-merged with documented bypass against the 3 documented pre-existing infra reds per Standing Decisions §7:
- `audit` workflow: `bun install --frozen-lockfile` lockfile drift
- `RLS read-only adversarial`: missing `SUPABASE_DB_URL` secret
- `pgTAP` ephemeral supabase boot at `notification_queue_worker_cron`

These remain on `main` after the sprint and are out of scope for sub-0; they're tracked separately for the Beta Readiness Track's CI hygiene sub-slice.

## Risk + fallback notes

**+5 on `authenticated_security_definer_function_executable`** — accepted per Day 2 sign-off. The lint flags every authenticated-callable SECURITY DEFINER function regardless of inline guards. Our 6 new wrappers all have inline `project_members` EXISTS gates + pinned search_path + REVOKE-from-anon, so the WARN family flags a soft footgun that the template-grade properties mitigate. Direction-of-travel: Task #30 broader SECURITY DEFINER sweep will harden the remaining 76 legacy functions to the same template, after which this WARN family becomes informational rather than actionable.

**Three pre-existing main-branch CI reds** are not sub-0 scope. Sprint admin-merged past them with documented justifications in each PR (see #506 comment for the canonical Day 0+1 framing). Tracking item: ≤2 hours combined work to fix the lockfile + secret + ephemeral-supabase boot issues.

**Day 2 org-filter widening** of `get_project_metrics` + `get_project_health_summary` (+`p_organization_id` arg) is grandfathered as already-shipped; Standing Decisions §6 reverses this default going forward — new wrappers drop the org filter unless multi-org RBAC becomes a customer-driven requirement.

**Placeholder legal pages** at `/terms` + `/privacy` — minimum-viable to unblock P0-I; final legal copy is a separate sub-slice pending review.

**P0-F functional cross-tenant test not exhaustive** — the pgTAP fixture verifies policy shape, not live read/write attempts as user-A against project-B. Functional verification requires seed data (auth.users, projects, project_members) that pgTAP's clean-transaction rollback doesn't trivially support. Walker can spot-check via dashboard/preview.

## What's outstanding (forwarded to subsequent sprints)

| Item | Owner sprint | Notes |
|---|---|---|
| **Task #30** — broader SECURITY DEFINER sweep across remaining 76 legacy functions | P1-G | Sub-0 wrappers + P0-C/D guards establish the canonical template |
| **`rls_policy_always_true`** (31 lints) | P1-A | Not in sub-0 scope |
| **`function_search_path_mutable`** legacy sweep (~80 functions) | P2-3 | New functions pin search_path; legacy sweep is separate |
| **Real legal copy** for `/terms` + `/privacy` | post-sub-0 | Pending legal review |
| **3 main-branch CI infra reds** | Beta Readiness Track CI hygiene sub-slice | ≤2 hours total |
| **Multi-org RBAC `p_organization_id` reintroduction** | Customer-driven (defer per §6) | When/if multi-org becomes a feature requirement |

## Exit criteria checklist

- [x] All 9 P0 items closed (P0-A through P0-I)
- [x] P1-D closed alongside Day 1 (deposition-grade audit infrastructure)
- [x] ERROR-level Supabase security advisor lint count: **6 → 0**
- [x] All cross-tenant pgTAP fixtures green
- [x] P0-G unit test green (`authStore.setCurrentOrg.test.ts` 3/3)
- [x] All migrations paired with shadow rows in `supabase_migrations.schema_migrations`
- [x] All PRs merged to `main`
- [x] Per-day receipts filed for Days 0+1, 2, 3
- [x] This final sprint receipt filed
- [ ] **Walker UI smoke** on Vercel preview / main (Standing Decisions §8):
  - Dashboard + Portfolio + Submittals page render (Day 2 frontend migration)
  - Multi-tab org switch shows no transient mixed-org render (P0-G)
  - Signup form requires ToS checkbox (P0-I) and surfaces resolved slug on success (P0-H)
- [ ] **Walker file-fetch spot-check** on storage buckets (P0-F) — re-load a known daily-log photo
- [ ] **Walker signature below** (PASS or NEEDS REMEDIATION)

---

## Walker Signature Block

```
Sprint:       BRT Subsystem 0 — P0 Hardening
Sign-off date: ____________________
Disposition:   [ ] PASS  [ ] NEEDS REMEDIATION
Signature:     ____________________

Notes (if NEEDS REMEDIATION, specify items):

_____________________________________________________________________

_____________________________________________________________________

_____________________________________________________________________
```

---

🤖 Compiled by Claude Code (Opus 4.7 1M-ctx) via Supabase MCP, 2026-05-13.
End of BRT Subsystem 0 — P0 Hardening Sprint.
