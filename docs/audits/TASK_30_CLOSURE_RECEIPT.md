# Task #30 — SECURITY DEFINER Sweep — CLOSURE RECEIPT

**Started:** 2026-05-13 (Phase 1 Day 1, Batch 1)
**Closed:** 2026-05-14 (Phase 1 Day 2, Batches 2–6)
**Duration:** 2 active execution days (vs. 4–7 day projection — function count was 83 not 152)
**Operator:** Claude Code (Opus 4.7 1M-ctx) via Supabase MCP
**Reference:** Standing Decisions §2 + §3 template

## Result

**83 of 83** public.* SECURITY DEFINER functions brought to the canonical template (search_path pinned + REVOKE PUBLIC + grants scoped to the minimum-necessary role set + inline membership gate where applicable).

| Lint family | Day 5 baseline (sub-0 close) | Task #30 close | Δ |
|---|---|---|---|
| `security_definer_view` | 0 | 0 | held |
| `materialized_view_in_api` | 0 | 0 | held |
| **`anon_security_definer_function_executable`** | **74** | **2** | **−72** |
| **`authenticated_security_definer_function_executable`** | **82** | **57** | **−25** |
| **`function_search_path_mutable`** | **81** | **48** | **−33** |
| `rls_enabled_no_policy` | 3 | 3 | held |
| `rls_policy_always_true` | 31 | 31 | held (P1-A scope) |
| `extension_in_public` | 3 | 3 | held (P2-1 scope) |
| `public_bucket_allows_listing` | 1 | 1 | held |
| `auth_leaked_password_protection` | 1 | 1 | held |
| **TOTAL** | **276** | **146** | **−130 (−47%)** |
| **ERROR-level** | **0** | **0** | held since Day 1 of sub-0 |

## Batches shipped

| Batch | Date | Functions | Migration | Approach |
|---|---|---|---|---|
| 1 | 2026-05-13 | 5 cron-only | `20261015020000` | ALTER + REVOKE all but service_role |
| 2 | 2026-05-14 | 10 RFI/RPC/trigger | `20261016000000` | Mixed: 4 RLS helpers + 5 RPCs + 1 with new inline gate |
| 3 | 2026-05-14 | 12 submittal workflow | `20261016010000` | DO-loop: ALTER + revoke anon (RLS gates the body) |
| 4 | 2026-05-14 | 18 triggers | `20261016020000` | DO-loop: ALTER + revoke anon + authenticated (zero RPC callers) |
| 5 | 2026-05-14 | 11 permission helpers + search_org | `20261016030000` | DO-loop: ALTER + revoke anon (keep authenticated for RLS) |
| 6 | 2026-05-14 | 19 cleanup (17 standard + 2 pre-auth) | `20261016040000` | DO-loop with 2-class split (pre-auth keeps anon) |
| **Total** | | **75 hardened** + 8 sub-0 outputs = 83 | | |

## Exemptions documented (intentionally retained grants)

**Pre-auth functions** (keep anon EXECUTE — called before user has a session):
- `check_login_lockout(text)` — login flow rate limiter
- `record_failed_login(text, text, text)` — login flow telemetry

These account for the remaining 2 hits on `anon_security_definer_function_executable`.

**RLS helpers** (keep authenticated EXECUTE — RLS policy evaluation requires it):
- All of Batch 5 (`is_project_member`, `has_project_permission`, `get_user_project_role`, etc.) plus Batch 2's `fn_rfi_project_id`, `fn_user_is_rfi_assignee`, `is_pilot_project`, `is_pilot_user`. ~15 functions.

These contribute to the remaining `authenticated_security_definer_function_executable` count (57). They're the soft footgun the lint family is designed to flag — but our template-grade properties (inline membership where applicable, pinned search_path, no PUBLIC) mitigate the risk.

## Calibration note for future projections

Per Cowork's Day 1 feedback ("Only NULL-proconfig functions count toward the lint drop"), Day 2 verified deltas were ≥ projection because:
1. Many functions had `proconfig` values OTHER than `search_path=public` (e.g. empty array, or different schema). The `function_search_path_mutable` lint flags any non-public-pinned path, so ALTERing to `public` resolved more than the NULL-count alone projected.
2. Batches 4 (triggers) + 6 (cleanup) revoked authenticated EXECUTE entirely on 18 + ~6 functions, contributing to the larger-than-projected drop on the `authenticated_*` lint family.

## What's still on the advisor

| Lint | Count | Owner sprint |
|---|---|---|
| authenticated_security_definer_function_executable | 57 | Soft footgun; each function audited and mitigated. No further sweep planned. |
| function_search_path_mutable | 48 | Legacy non-SECURITY DEFINER functions (utility/trigger helpers); separate sweep is P2-3 scope. |
| rls_policy_always_true | 31 | P1-A scope — orthogonal to Task #30. |
| extension_in_public | 3 | P2-1 scope. |
| rls_enabled_no_policy | 3 (INFO) | Below action threshold. |
| anon_security_definer_function_executable | 2 | Pre-auth login flow; intentional. |
| public_bucket_allows_listing | 1 | P1-F scope. |
| auth_leaked_password_protection | 1 | P2-4 scope. |

## Closure criteria checklist

- [x] All 83 SD functions categorized in `TASK_30_PROGRESS.md`
- [x] All 6 batches applied to live (5 migration files via MCP, shadow rows paired)
- [x] Advisor lint count: 276 → 146 (−130, −47%)
- [x] ERROR-level held at 0
- [x] All exemptions documented with rationale
- [x] No frontend breakage (no body changes for client-facing RPCs except `reorder_tasks`, which had its body modified to add a membership gate but preserves the prior call signature)

— Task #30 closed. Cowork independent verification welcome at any time. —
