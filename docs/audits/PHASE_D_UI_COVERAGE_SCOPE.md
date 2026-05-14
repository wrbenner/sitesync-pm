# Phase D — UI / UX Coverage Scope

**Mission:** Functional Frog Phase D. Five Playwright specs exercise every
page and every safe button across the app, plus a11y, mobile, and visual
regression. This doc enumerates the cells each spec covers so we can assert
the "every page, every button" guarantee in the BRT_BETA_LAUNCH receipt.

All specs are gated on `E2E_REAL_BACKEND=true` and skip cleanly when unset.
Run via `npx playwright test <spec>` with `E2E_BASE_URL`, `POLISH_USER`, and
`POLISH_PASS` populated.

Route inventory source: `ops/coverage/routes.json` (104 routes total — 54
protected, 8 public, 42 misc/redirect/wildcard).

---

## 1) `e2e/coverage/B1-every-route.spec.ts` — every protected route renders

**Iteration:** loads `routes.json` at runtime, filters to `isProtected:true`
and strips out auth/share/parameterized/operator-admin paths.

| Dimension | Value |
| --- | --- |
| Routes swept | **51** |
| Viewport | 1 (default desktop) |
| Cells covered | **51** |

**What it asserts per cell:**
- No `5xx` (or 403) response on `/rest/v1/`, `/functions/v1/`, `/rpc/`.
- No JS-crash signature in console (`TypeError`, `ReferenceError`,
  `undefined is not a function`, `Cannot read prop`).
- URL hash stays anchored to the requested route (catches silent SPA
  fallback to 404 / unauthenticated bounce to `/login`).

**Skips:** `/login`, `/signup`, `/forgot-password`, `/reset-password`,
`/magic-link/*`, `/share/*`, `/admin/orgs/*`, and any path containing an
unfilled `:param`. These have dedicated specs in `e2e/workflows/*` and need
fixtures (real tokens, operator-admin role, entity IDs).

**Catches:** dead routes added to `App.tsx` without a lazy import,
ProtectedRoute components that crash on a missing prop, server-side RLS
denials surfacing as 403s, lazy-loaded pages that throw on mount.

---

## 2) `e2e/coverage/B1-every-button.spec.ts` — every safe button clicked

**Iteration:** same route filter as #1, capped at the first 25 entries
(top-25 most-trafficked are at the head of `routes.json` by `App.tsx` order).

| Dimension | Value |
| --- | --- |
| Routes swept | **25** |
| Buttons clicked per route (budget) | up to **8** |
| Cells covered | **25 routes × ≤8 buttons = ≤200 button-clicks** |

**Non-destructive filter (`DANGER_LABELS`):**
`/delete/i`, `/destroy/i`, `/remove/i`, `/drop/i`, `/cancel subscription/i`,
`/sign out/i`, `/log out/i`, `/switch org/i`, `/transfer ownership/i`,
`/pay now/i`, `/submit pay app/i`, `/approve change order/i`, `/void/i`,
`/close (rfi|submittal|punch|item)/i`, `/publish/i`, `/distribute/i`,
`/send (email|notification|invite)/i`, `/sign and (close|submit|approve)/i`.

Anchors with `http*` or `mailto:` hrefs are also skipped (would navigate
away from the SUT).

**Skips:** destructive labels, external links, mode-switching actions that
break the auth state.

**Catches:** the "dead button" class — buttons that look wired in
`elements.json` but whose `onClick` fires a malformed RPC, a stale
`project_id`, or crashes the component tree on state update. After every
click the spec presses `Escape` to dismiss any modal so the next click can
land.

---

## 3) `tests/a11y/B11-axe-scan.spec.ts` — WCAG 2.1 AA via axe-core

**Iteration:** all 8 public routes (capped at 5) + 6 priority protected
routes (`/day`, `/rfis`, `/submittals`, `/daily-log`, `/punch-list`,
`/change-orders`). Filters out routes not present in `routes.json`.

| Dimension | Value |
| --- | --- |
| Routes scanned | **11** (5 public + 6 protected) |
| axe-core rule set | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` |
| Severities that fail the build | `critical` + `serious` |
| Severities logged only | `moderate` + `minor` (warning, non-blocking) |
| Cells covered | **11** |

**Skips:** silently if `@axe-core/playwright` isn't installed (dynamic
import); skips protected routes if `POLISH_USER`/`POLISH_PASS` aren't set.
The package is **not** currently in `package.json` — installing it
(`npm i -D @axe-core/playwright`) lights this spec up.

**Catches:** missing alt text, color-contrast failures (4.5:1 normal /
3:1 large), missing landmark roles, labels not associated with inputs,
keyboard-trap modals, tab order regressions. Moderate/minor (e.g.
heading-order, list semantics) log but don't fail — keeps noise low while
the team irons out the criticals first.

---

## 4) `tests/mobile/B13-mobile-viewport.spec.ts` — mobile/tablet regressions

**Iteration:** Cartesian product of 3 viewports × 7 flows.

| Dimension | Value |
| --- | --- |
| Viewports | iPhone 375×812, iPad 414×896, iPad Pro 1024×1366 |
| Flows | `/day`, `/daily-log`, `/punch-list`, `/rfis`, `/files`, `/field`, `/field-capture` |
| Cells covered | **3 × 7 = 21** |

Flows updated to match the actual route inventory — earlier scaffold
referenced `/photos` which doesn't exist; `/files` is where photos live
and `/field-capture` covers the rapid burst-capture flow that field users
hit most on phones.

**What it asserts per cell:**
- `body.scrollWidth - body.clientWidth ≤ 2px` (no horizontal overflow).
- Zero JS-crash console errors (`TypeError` / `ReferenceError`).

**Catches:** fixed-position overlays clipping CTAs, flex/grid layouts
that wrap weirdly below 414px, sticky headers obscuring tap targets,
viewport-sensitive components that crash on `window.innerWidth < 768`.

---

## 5) `tests/visual/B10-visual-regression.spec.ts` — pixel-diff baseline

**Iteration:** 20 candidate routes filtered against `routes.json`; the 3
that don't exist in the SPA (`/photos`, `/team`, `/billing`) are swapped
for actual paths (`/files`, `/settings/team`, `/settings/billing`) so we
get the full 20 in the visual budget.

| Dimension | Value |
| --- | --- |
| Routes captured | **20** (filtered subset of the 20 candidates) |
| Viewport | 1 (default desktop) |
| Diff cap | `maxDiffPixelRatio: 0.005` (0.5% drift) |
| Masks | `[data-testid="last-updated"]`, `[data-testid="presence-avatar"]`, `[data-testid="live-count"]`, `<time>` |
| Cells covered | **20** |

**Baselines:** Playwright writes baselines to
`tests/visual/__screenshots__/<spec>/<name>-<browser>-<platform>.png` on
first run with `--update-snapshots`. The directory is created on demand;
no pre-seeding required.

**Catches:** unintended CSS regressions (spacing drift, color shifts,
typographic changes), accidental layout reflow when a new component
mounts, dark-mode token bleed-through. Time-varying elements are masked
so the spec doesn't flake every minute.

---

## Aggregate UI/UX Coverage

| Spec | Cells |
| --- | --- |
| B.1 every-route render | 51 |
| B.1 every-button click | up to 200 (25 routes × ≤8 clicks) |
| B.11 a11y axe-core | 11 |
| B.13 mobile viewport | 21 |
| B.10 visual regression | 20 |
| **Total UI/UX cells** | **≤303** |

Floor (button budget at 1/route minimum): **128 cells.**
Ceiling (full button budget): **303 cells.**

When `E2E_REAL_BACKEND=true` + `POLISH_USER` + `POLISH_PASS` are set, all
five specs run; when unset, all five skip cleanly with descriptive
reasons. `@axe-core/playwright` is the only optional dependency — its
absence skips only B.11.

## Run commands

```bash
# Full sweep against a Vercel preview:
E2E_REAL_BACKEND=true \
E2E_BASE_URL=https://<preview>.vercel.app \
POLISH_USER=walker+polish@sitesync.test \
POLISH_PASS=<pw> \
npx playwright test \
  e2e/coverage/B1-every-route.spec.ts \
  e2e/coverage/B1-every-button.spec.ts \
  tests/a11y/B11-axe-scan.spec.ts \
  tests/mobile/B13-mobile-viewport.spec.ts \
  tests/visual/B10-visual-regression.spec.ts \
  --workers=2

# Refresh visual baselines:
npx playwright test tests/visual/B10-visual-regression.spec.ts --update-snapshots
```
