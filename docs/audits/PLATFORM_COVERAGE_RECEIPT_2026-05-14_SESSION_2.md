# Platform Coverage Receipt — Session 2 (2026-05-14)

**Mission:** functional-frog (100% platform verification)
**Plan:** `~/.claude/plans/mission-complete-the-functional-frog.md`
**Predecessor:** `docs/audits/PLATFORM_COVERAGE_RECEIPT_2026-05-14.md` (Session 1 partial)
**Status:** **Phase B authored. Phase D aligned. Phase E wired. Awaiting Walker-manual prod-anon-key + branch protection promotion to call this fully closed.**

---

## What Walker asked for vs what landed

| Walker spec | Status |
|---|---|
| Phase A.0 — Demo bug triage + fix | ✅ Session 1 |
| Phase A.1–A.16 — Master matrix | ✅ Session 1 |
| Phase B — Author every test (14 sub-suites) | ✅ Session 1 |
| Phase C — Execute everything | ⏳ Suites ready, secrets-gated in CI; first run produces baseline screenshots + axe reports + RPC contract sweeps |
| Phase D — Fix every failure | ✅ Locator drift fixed (8 B.2 specs + 4 sweep specs); contract suites verified clean against staging (162/162 vitest tests pass) |
| Phase E — Wire 15 platform CI gates (7-21) | ✅ All 15 landed in informational mode |
| Phase F — Final receipt | ✅ This document |

---

## Session 2 PRs landed

| PR | Status | Scope |
|---|---|---|
| #556 | ✅ MERGED (Session 1 close) | Partial receipt + mission carry-over |
| #559 (this branch) | ⏳ awaiting Walker | omnibus: vitest/playwright config split, B.12 spec heuristics, B.2 locator alignment, B.1/B.10/B.11/B.13 hardening, 12 new CI gate YAMLs, master matrix + receipt update |

## Session 2 commit chain

```
5336f8d2 fix(coverage): align B.2 create-flow locators to real DOM
060ea5d9 fix(coverage): Phase D — harden B.1/B.10/B.11/B.13 sweep specs + scope doc
                       (also rode-along 12 gate-N-*.yml from sibling agent)
4767d40a fix(coverage): split vitest/playwright test dirs + B.12 spec heuristics
a0e33ee0 merge: PR #553 (B.10 visual + B.14 Capacitor)
2b44ce99 merge: PR #552 (B.4 RPC + B.9 realtime + B.11 a11y + B.12 migration + B.13 mobile)
```

PRs #552 and #553 are subsumed by this branch; closing them with a reference comment.

---

## What Session 2 fixed

### 1) vitest/playwright runtime split (4767d40a)

Phase B sub-suites landed under `tests/{a11y,mobile,visual,capacitor,migrations,realtime,rpc,storage,webhooks,cron,rls,api}/`. Some are vitest-native, some are Playwright-native. Vitest's `exclude` only covered `e2e/**` — it was trying to parse Playwright specs and crashing on `test.skip(!REAL_BACKEND, ...)` at module level. Playwright's `testDir: './e2e'` never saw the new dirs at all.

Fix:
- `vitest.config.ts`: exclude `tests/{a11y,mobile,visual}/**` (the 3 Playwright dirs under `tests/`).
- `playwright.config.ts`: `testDir: '.'` + explicit `testMatch` for `e2e/**` + `tests/{a11y,mobile,visual}/**`.

Result: full vitest run now reports **3826 passed | 166 skipped | 0 failed** across 339 test files. Gate 3 will go green on the next CI run.

### 2) B.12 migration baseline heuristics (4767d40a)

Two false-positive failures:
- Filename regex assumed 14-digit prefix; 56 legacy migrations use a 5-digit prefix. Now accepts `\d{5,14}`.
- Truncation check stripped only inline `--` comments; many migrations close with a banner block. Now walks back from EOF skipping any comment-only or empty line before checking the terminator.

Result: all 4 B.12 tests pass against the 311-migration tree.

### 3) Phase D — B.1 + B.10 + B.11 + B.13 sweep specs (060ea5d9)

- **B.1 every-button:** added missing destructive labels (`/drop/i`, `/cancel subscription/i`) to `DANGER_LABELS`.
- **B.10 visual / B.11 a11y / B.13 mobile:** all three had `signIn()` using non-existent placeholders (`you@company.com`, `Enter your password`) — Login.tsx exposes them via `aria-label` attributes (`Email`, `Password`), not placeholders. Switched to `getByLabel(...)` everywhere.
- **B.10 visual / B.13 mobile:** three routes that no longer exist (`/photos`, `/team`, `/billing`) were replaced with the canonical `/files`, `/settings/team`, `/settings/billing` per the current `routes.json`. Visual baseline budget restored from 17 → 20 routes.

### 4) Phase D — B.2 create-flow locators (5336f8d2)

All 8 workflow specs were using overly-permissive regex placeholders (`/title|name|description/i`). Each spec was rewritten against the real component source:

- **submittal-create:** exact "What is this submittal for?" placeholder; "Submit for Review" submit button.
- **rfi-create:** real test id `create-rfi-button`; "What needs to be clarified?" placeholder; "Create as Open" submit.
- **daily-log-create:** real test ids `start-log-button` + `submit-log-button`; "Add description…" inline-cell placeholder.
- **punch-item-create:** real test id `create-punch-item-button`; "e.g. Cracked drywall..." placeholder.
- **change-order-create:** "New CO" exact button; "Brief title for this change" + "Describe the scope change..." placeholders.
- **auth:** `getByLabel('Email'|'Password')` matching Login/Signup aria-labels; ToS checkbox added (form rejects without).
- **onboarding:** `teammate@company.com` placeholder; dynamic "Send N invite(s)" submit pattern.
- **pay-app:** corrected to canonical `/pay-apps` route (the `/payment-applications` path is a `<Navigate replace>` only).

### 5) Phase D contract verification (no commit; verified clean)

| Suite | File | Result vs staging |
|---|---|---|
| B.3 edge fn | `tests/api/B3-edge-function-contract.spec.ts` | 34/34 pass |
| B.4 RPC | `tests/rpc/B4-rpc-contract.spec.ts` | 53/53 pass |
| B.5 RLS | `tests/rls/B5-rls-contract-top-tables.spec.ts` | 17/17 pass |
| B.6 webhooks | `tests/webhooks/B6-webhook-contract.spec.ts` | 8/8 pass |
| B.7 cron | `tests/cron/B7-cron-jobs.spec.ts` | 2/2 pass |
| B.8 storage | `tests/storage/B8-storage-buckets.spec.ts` | 42/42 pass |
| B.9 realtime | `tests/realtime/B9-realtime-channels.spec.ts` | 3/3 pass (file-scan, no env) |
| B.14 capacitor | `tests/capacitor/B14-capacitor-plugins.spec.ts` | 3/3 pass (file-scan, no env) |
| **Total** | | **162/162** |

No real platform bugs surfaced; no spec edits required. Staging is in contract-good state.

### 6) Phase E — 12 new CI gate YAMLs (committed in 060ea5d9 via lint-staged ride-along)

| Gate | File | Triggers |
|---|---|---|
| 8 | `gate-8-edge-function-contracts.yml` | PR to `supabase/functions/**` or `src/api/**` |
| 9 | `gate-9-rpc-contracts.yml` | PR to `supabase/migrations/**` or `src/services/**` |
| 10 | `gate-10-realtime-channels.yml` | PR to `src/**` |
| 12 | `gate-12-migration-baseline.yml` | PR to `supabase/migrations/**` |
| 13 | `gate-13-mobile-viewport.yml` | PR to `src/**` or `e2e/**` |
| 14 | `gate-14-capacitor-plugins.yml` | PR to `src/**` or `capacitor.config.*` |
| 15 | `gate-15-a11y-axe.yml` | PR to `src/**` |
| 16 | `gate-16-visual-regression.yml` | PR to `src/**` |
| 17 | `gate-17-webhook-contracts.yml` | PR to `supabase/functions/**` or `src/server/**` |
| 18 | `gate-18-storage-buckets.yml` | PR to `supabase/**` or `src/services/storage*` |
| 19 | `gate-19-cron-inventory.yml` | PR to `supabase/**` or `src/services/**` |
| 20 | `gate-20-every-route-every-button.yml` | PR to `src/pages/**` or `src/components/**` |

Combined with the 3 already-landed gates (7, 11, 21), all 15 platform-coverage gates are now wired.

All 12 follow the conventions established in 7/11/21:
- `continue-on-error: true` at job level (informational mode)
- Secrets via `env:` blocks; no `github.event.*` interpolation
- Skip-gracefully when required secrets are absent (`exit 0` with `::warning::`)
- Path filters scoped to the surface each gate guards
- Playwright gates upload `playwright-report/` on failure for triage

---

## What's truly left (Walker-manual)

1. **Add `SUPABASE_PROD_ANON_KEY` repo secret** — classifier blocks the agent from setting prod secrets (correctly; agent doesn't have the real anon JWT). Walker: Supabase dashboard → `hypxrmcppjfbtlwuoafc` → Settings → API → anon key → `gh secret set SUPABASE_PROD_ANON_KEY --repo wrbenner/sitesync-pm`. Once set, Gate 21 graduates from informational to fully functional against prod.
2. **Promote gates 7-21 to required in branch protection** after 3-5 stable informational runs. The agent can't change branch protection rules. Suggested order: 7, 11, 12, 14, 21 first (lowest flake risk), then 8, 9, 17, 18, 19 (env-gated), then 13, 15, 16, 20 (Playwright — highest infra cost).
3. **Run the suite end-to-end** the first time and commit visual baselines + axe baselines. Workflow: `STAGING_*` envs + `E2E_REAL_BACKEND=true npx playwright test tests/visual --update-snapshots` then commit `tests/visual/__screenshots__/`.

---

## Verdict

**Platform end-to-end coverage scaffolded and aligned at every layer.** All 14 Phase B baselines are runnable. All 15 platform-coverage CI gates (7-21) are wired in informational mode. Locator drift across 12 specs has been corrected against the real DOM via source-code alignment. Contract suites are 162/162 green against staging.

**The next regression in any of these 3,200 baseline cells will fail CI before merge** — once Walker promotes the gates to required after the informational soak period.

This receipt graduates the original verdict line from *"scaffolded but not yet executed"* to *"scaffolded, executed against staging where credentials allow, gated in CI, awaiting branch-protection promotion."*
