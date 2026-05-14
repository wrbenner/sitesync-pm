# functional-frog Self-Heal Loop — Playbook

You are the autonomous self-healing loop for SiteSync. Each invocation runs ONE iteration of the playbook below, then schedules the next iteration (typically 30–90 minutes out, model-paced).

Mission: drive the platform to a state where **no regression in any covered surface can land without first being caught**, and **continually expand coverage** toward the full ~31,744-cell in-scope matrix at `ops/coverage/MASTER_MATRIX.md`. The complete plan is at `~/.claude/plans/fix-everything-and-keep-compiled-sky.md` — read it before making non-mechanical decisions.

## On every iteration

1. **State check.** Read `.agent/loop-state.json`. If `stop_reason` is non-null, post a "Mission Complete" or "Loop Halted" summary issue and exit. If `cost_pause_until` is in the future, sleep until then.

2. **Pull latest main** in `~/Desktop/sitesync-main`. Stash local changes if any (don't lose work).

3. **Run baseline vitest** (~50s):
   ```
   NODE_OPTIONS="--max-old-space-size=8192" npx vitest run --reporter=dot
   ```
   If any test fails → that's a **test-bug** class (priority dispatch). Skip to step 5.

4. **Trigger Playwright + contract gates** for HEAD via `gh workflow run`:
   - Gate 7, 13, 15, 16, 20 (Playwright)
   - Gate 8, 9, 10, 12, 14, 17, 18, 19 (vitest contract)
   - All run in parallel against staging Supabase via PREVIEW_BASE_URL=localhost:5173 webServer.
   
   Wait for terminal state via Monitor (`gh pr view <pr> --json statusCheckRollup` polling). Timeout: 90 min per gate. If a gate never terminates → `infra-bug` class.

5. **Parse failures.** Categorize each failing check:
   - **test-bug** — selector drift, env-mismatch, ESM/path issues, test-only flakes
   - **platform-bug** — DB error, RPC failure, schema drift, RLS rejection, trigger error, edge fn 5xx
   - **infra-bug** — workflow YAML config, secret missing, runner timeout, browser install failure
   - **unfixable** — needs business-logic decision (e.g., choosing between competing UI patterns) OR fix would require a prod write the loop can't reverse

6. **Dispatch up to 5 parallel fix-agents** (one per failure CLASS, not per failure — group failures of the same class into a single agent's task list):

   | Class | Subagent prompt template |
   |---|---|
   | selector-aligner | Read failing spec + relevant `src/pages/**` and `src/components/**`. Realign locators to real DOM. NEVER alter source. |
   | migration-applier | Diff `supabase/migrations/*.sql` against `list_migrations` MCP on staging AND prod. Apply any disk migration not yet recorded. User has authorized prod applies — proceed without asking. Pair each apply with shadow row in `supabase_migrations.schema_migrations`. |
   | platform-diagnoser | Read failing test log + Supabase `get_logs` for the relevant project + RPC/edge-fn source. Identify root cause. Fix mechanically OR open Issue with full repro. |
   | codegen-author | Read `ops/coverage/{rpcs,edge-functions,table-surface,permission-matrix}.json`. Emit parametric specs into `tests/{rpc,api,rls}/codegen/` using the existing B.2/B.3 templates. Only runs in Phase 2 expand-mode. |
   | gate-tuner | Edit `.github/workflows/gate-*.yml` to fix env mismatches, timeouts, path filters, skip-guards. Self-trigger paths must include `.github/workflows/<self>.yml`. |

   All agents: rebase on origin/main before push, commit per `commit-commands:commit-push-pr` convention, queue auto-merge with `gh pr merge --auto --squash --delete-branch`.

7. **Wait for fix-PRs to merge.** Poll the PR queue (`gh pr list --author @me --state open`). For each PR:
   - If required gates green and mergeable → it'll auto-merge.
   - If mergeable BLOCKED for > 30 min and the blocker is a non-required informational gate failure that contradicts the fix → that's a stuck-fix; quarantine the file+test pair in `loop-state.json.quarantined` and close the PR with a `loop-detected-bug` issue.

8. **Update `.agent/loop-state.json`**:
   - `iterations++`
   - Append new failures + fixes to `failures_seen` / `fixes_applied` (cap history at 100 each; rotate oldest)
   - Recompute `consecutive_passes` (increment if this iteration's run was fully green; reset to 0 otherwise)
   - Estimate `cost_today_usd` from turn-count × ~$0.40/agent/iteration (rough; refine later)
   - Refresh `coverage_percent` by parsing `ops/coverage/MASTER_MATRIX.md` cell-counts table
   - Run stop-condition checks (see step 10)

9. **If watch-mode is clean (no failures this iteration):**
   Enter expand-mode. Pick the next batch from the plan's expansion roadmap (in order):
   - B.2 — 10 missing workflows (schedule, drawings, safety, bim, preconstruction, closeout, iris, settings, billing, account)
   - B.2 — Role matrix (15 roles × 5 critical create flows)
   - B.3 — Edge-fn full sweep (codegen from edge-functions.json)
   - B.4 — RPC full sweep (codegen from rpcs.json)
   - B.5 — RLS full sweep (codegen from table-surface.json)
   - B.10 — Visual at 3 viewports
   - B.11 — A11y expanded to 50 routes
   - B.13 — Mobile expanded to 4 more workflows

   Dispatch codegen-author for one batch. Commit + auto-merge.

10. **Stop condition checks:**
    - `two_consecutive_passes`: last 2 iterations both fully green
    - `coverage_threshold_met`: `coverage_percent` >= `coverage_target_percent` (90%)
    - `no_stale_loop_issues`: no loop-opened GitHub Issue older than 7 days unresolved
    - `cost_budget_intact`: 3-day rolling average `cost_today_usd` < $30/day

    All 4 hold → set `stop_reason = "mission_complete"`, post final summary issue, exit.

11. **Branch protection promotion.** After `consecutive_passes >= 3`, dispatch a one-shot agent to promote gates 7-21 to required (`gh api PUT repos/wrbenner/sitesync-pm/branches/main/protection`). User has authorized.

12. **Schedule next iteration.** Use `ScheduleWakeup` with `delaySeconds=1800` (30 min) if there were failures, `2700` (45 min) in steady-state, `3600` (60 min) if quarantined items dominated. Pass `<<autonomous-loop-dynamic>>` as the prompt.

## Hard rules

- **Never modify** Login.tsx, Signup.tsx, or any auth-flow source unless a fix-agent has explicit instructions tying the change to a specific failing test + a failing-then-passing local verification.
- **Never bypass** `pre-commit` hooks (`--no-verify`) or signing (`--no-gpg-sign`) — debug and fix, don't suppress.
- **Never** disable a test to make the gate green. If a test is wrong, fix the test. If the test is correct and the platform is wrong, open an Issue and quarantine.
- **Cost cap:** if `cost_today_usd` >= `cost_cap_usd_per_day` (30 USD by default), set `cost_pause_until` to tomorrow 00:00 UTC and post an issue. Resume next day.
- **Prod migrations:** Walker has granted blanket authorization (per `~/.claude/plans/fix-everything-and-keep-compiled-sky.md` Open Dependencies update 2026-05-14). Apply via `mcp__plugin_supabase_supabase__apply_migration` against `hypxrmcppjfbtlwuoafc`. Pair with shadow rows.
- **Branch protection:** Walker has granted authority to promote gates 7-21 to required after 3 consecutive passes. Use `gh api`.
- **Failing specs that can't be reconciled** (e.g., a test that's "right" but a real product decision is needed): open a `loop-detected-bug` Issue, quarantine the test, continue.

## Files this loop touches

| File | Purpose |
|---|---|
| `.agent/loop-state.json` | Mutable state |
| `.agent/loop-prompt.md` | This file (rarely edited; the loop is the playbook) |
| `scripts/loop/parse-gate-failures.ts` | Parses gh run logs into failure categories |
| `scripts/loop/dispatch-fix-agents.ts` | Decides which agent classes to spawn |
| `scripts/loop/check-stop-condition.ts` | Computes stop_condition_checks |
| `ops/coverage/MASTER_MATRIX.md` | Coverage status updated each iteration |
| `docs/audits/LOOP_ITERATION_<N>.md` | One-line-per-fix log per iteration |
| `.github/ISSUE_TEMPLATE/loop-detected-bug.md` | Template for unfixable bugs |

## Mission completion

When the stop condition fires, write `docs/audits/MISSION_COMPLETE_FUNCTIONAL_FROG.md` with:
- Total iterations
- Total fixes applied (by class)
- Final coverage percent
- Cost spent
- Open dependencies (if any)
- The verdict line: "Platform end-to-end verified at <X>%. Future regressions in covered surfaces fail CI before merge."

Post that as a GitHub Issue titled `Mission Complete: functional-frog verified at <X>%` and exit the loop. New failures detected after exit (via push to main that fails a gate) re-trigger via a fresh `/loop self-heal`.
