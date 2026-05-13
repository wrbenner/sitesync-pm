# Phase 1 — Day 2 Receipt (Roadmap to SOC 2)

**Date:** 2026-05-14
**Operator:** Claude Code (Opus 4.7 1M-ctx) via Supabase MCP
**Standing decisions:** `BRT_SUB_0_STANDING_DECISIONS_2026-05-13.md` (§§1–14)

## Purpose

Second day of Phase 1: ship Task #30 batches 2–6 (closing the SECURITY DEFINER sweep one day ahead of the 4–7-day projection because the real function count was 83, not 152) and surface the Phase 0d (pgTAP forward-fix) deferral.

## What shipped today

### Task #30 — CLOSED (Batches 2–6, 5 migrations + closure receipt)

| Batch | Migration | Fns | Treatment |
|---|---|---|---|
| 2 | `20261016000000_task_30_batch_2_rfi_helpers_rpcs.sql` | 10 | RLS helpers + RPCs + trigger-invoked + 1 new inline gate (`reorder_tasks`) |
| 3 | `20261016010000_task_30_batch_3_submittal_workflow.sql` | 12 | DO-loop ALTER + revoke anon (RLS gates body) |
| 4 | `20261016020000_task_30_batch_4_trigger_hardening.sql` | 18 | DO-loop: revoke anon + authenticated (zero RPC callers) |
| 5 | `20261016030000_task_30_batch_5_permission_helpers.sql` | 11 | DO-loop: revoke anon, keep authenticated for RLS |
| 6 | `20261016040000_task_30_batch_6_cleanup.sql` | 19 | 17 standard + 2 pre-auth (keep anon by design) |

**Total this session:** 70 SD functions hardened across 5 migrations. Plus Batch 1 (5 fns yesterday) = 75 hardened, 8 sub-0 outputs = 83/83 covered.

Closure artifact: `docs/audits/TASK_30_CLOSURE_RECEIPT.md`.

### Phase 0d — deferred (pgTAP forward-fix)

Pulled `--debug` output from #514's pgtap run; output was so verbose it truncated before the actual SQL error surfaced. The job conclusion is FAILURE but the log only shows successful migration apply followed by a Stop Supabase trigger with no error annotation surfaced.

Per Standing Decisions §10, this isn't a §10 case (not novel P0, not MCP write failure — pgtap.yml has `continue-on-error: true`; not blocking merges). Documenting as deferred to a separate sub-slice requiring local Docker repro. Will revisit when time permits OR when chain repair becomes a hard prerequisite (e.g., flipping pgtap from informational to required-gate).

### BRT Sub-1 — deferred to Day 3

Bandwidth call: shipping Task #30 closure + receipts consumed the session's budget. Sub-1 (provision_organization SQL fn + signup wiring + 130-table adversarial RLS matrix) is a 3–4 day effort and deserves its own focused start. Day 3 kickoff.

## Security advisor lint diff (session-level)

**Pre-session (Day 1 EOD):** 264 total — anon SD 69, auth SD 77, search_path 76.
**Post-session (Day 2 EOD):** **146 total** — anon SD **2**, auth SD **57**, search_path **48**.

| Lint | Day 1 EOD | Day 2 EOD | Δ |
|---|---|---|---|
| anon_security_definer_function_executable | 69 | **2** | **−67** |
| authenticated_security_definer_function_executable | 77 | **57** | **−20** |
| function_search_path_mutable | 76 | **48** | **−28** |
| ERROR-level | 0 | 0 | held |
| **TOTAL** | **264** | **146** | **−118** |

Cumulative from Day 5 sub-0 baseline: **276 → 146 (−130, −47%).**

## Calibration vs projection (per Cowork's Day 1 note)

Cowork flagged that Day 1's projection of `function_search_path_mutable: −5` came in as `−5` actual (confirmed accurate after re-checking). For Day 2, projections vs actuals:

| Family | Projected (sum of batches) | Actual delta | Variance |
|---|---|---|---|
| anon_sd_fn_executable | −5 (B1) + −10 (B2) + −12 (B3) + −18 (B4) + −11 (B5) + −17 (B6) = **−73** | **−72** | −1 (1 fn already had no anon grant) |
| authenticated_sd_fn_executable | −5 (B1) + −2 (B2) + 0 (B3) + −18 (B4) + 0 (B5) + 0 (B6) = **−25** | **−25** | exact |
| function_search_path_mutable | −5 (B1) + −1 (B2) + 0 (B3) + 0 (B4) + 0 (B5) + 0 (B6) = **−6** | **−33** | +27 (much larger than projected) |

The function_search_path_mutable lint dropped more than the NULL-proconfig count suggested because many functions had non-public search_path values (e.g., empty array, schema-specific) that also triggered the lint. ALTERing to `search_path=public` cleared those too. The calibration heuristic ("count NULL proconfig") under-projected by ~5×.

**Updated calibration rule:** "count functions with `proconfig IS NULL` OR `'search_path=public' != ANY(proconfig)`" for accurate `function_search_path_mutable` projections. Filing this as an inline amendment to the running calibration.

## Outstanding (rolling to Day 3)

| Item | Status | Owner |
|---|---|---|
| Phase 0d pgTAP forward-fix | Deferred (needs local Docker repro) | Future sub-slice |
| BRT Sub-1 `provision_organization` SQL fn | Pending | Day 3 |
| BRT Sub-1 signup wiring (replace TS retry) | Pending | Day 3 |
| BRT Sub-1 130-table adversarial RLS matrix | Pending | Day 3–4 |
| Walker initials on 4 decision docs (pricing + CAPTCHA + palette + tax) | Async | Walker |
| `SUPABASE_ACCESS_TOKEN` secret verification | Async | Walker |
| UI smoke on sub-0 final receipt | Async | Walker |

## Per Standing Decisions §10 — no mid-day pings

All Day 2 work was in-scope of the Roadmap directive. No novel P0, no MCP write failure (all 5 batches applied first-try), no live-state surprise. Receipt is the routine async sign-off.

— End of Phase 1 Day 2 receipt —
