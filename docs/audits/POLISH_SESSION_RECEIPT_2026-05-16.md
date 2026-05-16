# Polish Session Receipt — 2026-05-16

**Branch:** `auto/polish-20260515-2355`  
**PR:** #624  
**Commit:** `ff7bcd9b`  
**Files changed:** 4 (+29/-20)

---

## What Changed

### iPad layout fix (`src/App.tsx`)
`isMobile` breakpoint raised from `768px` → `1024px`. iPad (1024×1366 viewport) was landing on the desktop layout (full sidebar, no bottom nav) because the old threshold classified it as a "tablet" outside either layout's intended range. Now iPad uses `MobileLayout` (collapsible sidebar, bottom tab bar, Iris FAB). Removed the dead `isTablet` variable.

### Sidebar em-dash guard (`src/components/Sidebar.tsx`)
`UserStrip` component now validates `full_name` with `/\w/.test(rawName)` before displaying. When Supabase returns the placeholder `'—'` (em-dash) for unset profiles, the sidebar name slot now shows empty rather than the sentinel character. Safety-net breakpoint in `Sidebar.tsx` also updated to `1024px` to stay consistent with App.tsx.

### Budget over-display (`src/pages/budget/BudgetKPIs.tsx`)
KPI card: `remaining < 0 ? 'OVER BUDGET' : 'REMAINING'`. Value shows `Math.abs(remaining)` — no more raw negative dollar amounts in KPIs.

### Ledger over-display (`src/pages/ledger/index.tsx`)
BigNumber label: `budgetRemaining < 0 ? 'Over by' : 'Remaining'`. Value: `formatCurrency(Math.abs(budgetRemaining))`. `overBudget` prop wired for red coloring.

---

## Punch List Audit

Audited all items from `POLISH_PUNCH_LIST.md` (generated 2026-04-27) against current source. Only the 4 items above needed code changes. All other items (15 remaining) were already fixed in earlier PRs or the baseline redesign:

- FAB/bottom nav occlusion → `MobileLayout` 164px bottom padding (pre-existing)
- OfflineBanner "Never synced" during cache → suppressed during caching (pre-existing)
- User profile `?` glyph → initials fallback chain (pre-existing)
- Safety tab scroller clips → `overflowX: auto` (pre-existing)
- Closeout empty state / `%` unit / DeleteAccountDialog scroll → all pre-existing

---

## Quality Floor

| Metric | Floor | Actual |
|--------|-------|--------|
| `tsErrors` | 0 | **0 ✅** |
| `anyCount` (CI methodology) | 69 | **69 ✅** |
| `tsIgnoreComments` | 0 | **0 ✅** |
| `mockCount` | 12 | **7 ✅** (under = improvement) |
| `eslintErrors` | 0 | 8 ⚠️ pre-existing in test files (PR #616) |

---

## What Was Deferred / Not Done

- **Playwright sweep:** Remote execution environment has no Supabase instance; `localhost:54321` not reachable. E2e screenshot capture impossible.
- **ESLint 8 errors:** Pre-existing in `tests/mobile/camera-permission-fallback.spec.ts`, `tests/mobile/stripe-redirect-cancel.spec.ts`, `tests/security/bundle-secret-scan.spec.ts`. Not introduced by this session. Covered by PR #616.

---

## Next Session

- Merge PR #616 (ESLint test-file errors) when CI is green
- Merge PR #624 (this session) when CI is green
- If Playwright can be run (local dev environment), re-sweep iPad viewports to confirm the `1024px` fix resolves the critical punch list items visually
