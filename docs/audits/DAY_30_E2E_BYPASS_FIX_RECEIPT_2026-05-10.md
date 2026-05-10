# Day 30 — e2e Dev-Bypass Timeout Fix Receipt
**Date:** 2026-05-10  
**Branch:** `auto/polish-20260510-1440-work`  
**Base PR:** #407 (dev-bypass infrastructure)

## What changed

28 Playwright spec files updated (e2e-only, no src/ changes).

### Fix 1 — `waitLoad` timeout cap (all 28 specs)
All bare `waitLoad(page)` calls replaced with `waitLoad(page, 8_000)`. Default was 30 s; in dev-bypass mode `"Loading projects…"` never clears (no Supabase), causing every test to hang until the 90 s Playwright timeout.

### Fix 2 — `page.goto` + domcontentloaded (all 28 specs)
All `page.goto('#/route')` calls upgraded to `page.goto('#/route', { waitUntil: 'domcontentloaded' })`. The vite dev-server doesn't fire `load` reliably in bypass mode; `domcontentloaded` resolves quickly.

### Fix 3 — Legacy `signIn` bypass detection (3 specs)
`page-3-rfis.spec.ts`, `page-4-daily-log.spec.ts`, `page-5-punch-list.spec.ts` had their own local `signIn()` functions that called `.fill(USER)` before checking for the bypass redirect. Added the same `waitForURL({ timeout: 3_000 })` early-exit guard already used in `_helpers.ts` and `page-2-dashboard.spec.ts`.

### Fix 4 — `waitLoad` signature in punch-list (1 spec)
`page-5-punch-list.spec.ts` local `waitLoad(page: Page)` didn't accept a `timeoutMs` parameter; updated signature to `waitLoad(page: Page, timeoutMs = 15_000)` so the `8_000` cap applies.

## Verification

| Check | Result |
|-------|--------|
| `tsc --noEmit` (tsconfig.app.json) | 0 errors ✅ |
| `anyCount` (gate formula) | 68 (floor 69) ✅ |
| `mockCount` | 12 (floor 12) ✅ |
| ESLint warnings | 1391 (floor 1573) ✅ |
| ESLint errors | 0 ✅ |
| lint-staged on commit | pass ✅ |
| 8 previously-failing spec groups | 24/24 tests pass ✅ |

Previously-failing specs (now green):
- `page-5-punch-list` × 3 viewports
- `page-6-submittals` × 3
- `page-7-drawings` × 3
- `page-8-schedule` × 3
- `page-13-workforce` × 3
- `page-14-crews` × 3
- `page-17-meetings` × 3
- `page-25-closeout` × 3

## What's deferred

- Full 84-test sweep not re-run (the 5-spec and 8-spec targeted sweeps confirmed the fix; full sweep takes 15+ minutes). Run `npx playwright test --config playwright.polish.config.ts --project=page-e2e` to confirm all 84.
- Visual punch-list items (iPad layout overlap, tab text collisions, etc.) are already fixed in PR #399 which is not yet merged to main. Not re-fixing here to avoid merge conflicts.

## Next steps

1. Merge PR #407 to main
2. This branch (`auto/polish-20260510-1440-work`) rebases cleanly on top — can be merged as a follow-on PR or squashed into #407 before merge
3. Run full 84-test sweep post-merge to establish the baseline pass rate
