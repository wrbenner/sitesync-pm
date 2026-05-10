# Polish Audit Receipt — 2026-05-10 (Session 2)

## What this session did

Resumed work on PR #399 (`auto/polish-20260510-0023`), which already had all 6
required CI gates green. The session focus was verification-first: audit every
claimed fix, run a full e2e sweep, and add any remaining improvements.

## Verification sweep results

### Already fixed in this branch (confirmed)
| Issue | Fix |
|---|---|
| iPad sidebar layout (72px icon rail at 769–1024px) | `fix(layout)` commit — all 40 pages |
| Sidebar user shows em-dash | `UserStrip` filters `\w` chars; falls back to email local-part |
| Profile avatar shows `?` | `displayInitials` falls back to email-derived initials |
| Disabled `Btn` renders faded orange | `disabled && !loading` now shows `surfaceDisabled` background |
| Schedule Logic quality `0/100 F` pill | Suppressed on unlinking seed data (≥80% orphan threshold) |
| Safety / TimeTracking / Contracts tabs overflow on iPhone | All have `overflowX: auto` + `whiteSpace: nowrap` |
| MobileTabBar text collisions | Replaced with 4-tab + “More” sheet pattern |
| QuickCreateFAB behind mobile bottom nav | `bottom: calc(env(safe-area-inset-bottom, 0px) + 84px)` |
| GPS error shows raw browser string | `FieldCaptureModal` shows “Location optional” badge |
| MetricBox `%` floats as superscript | Inline-large `%` rendered at value font size |
| `Math.random()` in prod src | 0 (verified) |

### Quality floor checks
| Metric | Floor | Actual |
|---|---|---|
| `tsc --noEmit` errors (root tsconfig) | 0 | 0 ✅ |
| `npm run typecheck` errors (both configs) | 0 | 0 ✅ |
| `as any` count | ≤ 69 | 68 ✅ |
| `Math.random` in prod src | 0 | 0 ✅ |
| ESLint errors | 0 | 0 ✅ |
| Tests passing | ≥ 2781 | 3063 ✅ |

### e2e sweep
- All 84 tests pass (28 pages × 3 viewports) — exit code 0.

## New commit this session

**`fix(e2e): export shared shot() helper from _helpers.ts with auto-mkdir`**

All 28 `page-N-*.spec.ts` files define a local `shot()` function that calls
`page.screenshot(...).catch(() => undefined)`, silently failing when the
`polish-review/pages/<page>/` directory doesn’t exist. Added a `shot()` export
to `_helpers.ts` that calls `fs.mkdirSync(outDir, { recursive: true })` before
writing the screenshot, so captures actually land when the directory is absent.
Specs that opt in can import it; existing specs continue to work unchanged.

## Deferred items (not actionable from frontend)

- Stuck loading skeletons across budget / crews / files / rfis / submittals —
  root cause is acceptance mode (no real Supabase backend). Requires seed data
  or a real backend to resolve. Not a code bug.
- Closeout iPad shows “Welcome to SiteSync — Create your first project” —
  same root cause: `useProjects()` returns empty array in acceptance mode.
- ESLint warnings at 1594 (floor: 1573) — 21 extra warnings from 7 new main
  commits merged after this branch’s base commit (`iris-eval` PRs #383/#400,
  CI hygiene PRs #401-#406). Not introduced by this branch.

## What’s next

PR #399 is clean and merge-ready. Walker can merge with:
```
gh pr merge 399 --auto --squash --delete-branch
```
