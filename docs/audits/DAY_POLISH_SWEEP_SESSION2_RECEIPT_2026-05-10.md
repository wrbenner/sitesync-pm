# Polish Sweep Session 2 Receipt — 2026-05-10

## What changed

**Commit:** `51853cd` on branch `auto/polish-20260510-0023` (PR #399)

**Files changed:** 28 (e2e/_helpers.ts + 27 page-N-*.spec.ts)

**Change:** All 31 `page.goto('#/route')` calls across the full e2e suite changed to
`page.goto('#/route', { waitUntil: 'domcontentloaded' })`.

## Root cause diagnosed and fixed

Every `page-N-*.spec.ts` spec was timing out at 90 s. The cause was that
`page.goto()` defaults to `waitUntil: 'load'`, which waits for the browser's
`load` event. In acceptance mode (`VITE_ACCEPTANCE_MODE=true`), the app makes
continuous Supabase network requests that all fail (placeholder URL), delaying
the `load` event by up to 30 s per navigation. With two gotos per test — one
in `signIn()` (navigates to `#/day` to detect bypass mode, then `#/login`) and
one in the spec itself — the accumulated delay exceeded the 90 s Playwright
default timeout.

Switching to `waitUntil: 'domcontentloaded'` resolves immediately once the
HTML is parsed. The existing `waitLoad()` and `settle()` helpers already handle
data-readiness gating (watching for Loading... text, aria-busy, skeleton
elements, and a final networkidle sip).

## Affected files

- `e2e/_helpers.ts` — signIn() has 2 goto calls, both patched
- 27 spec files — 1 goto call each (some have 2, e.g. page-3-rfis, page-4-daily-log, page-21-reports), 29 total across specs
- Total patched call sites: 31

## Quality floors (confirmed unchanged)

- tsc errors: 0
- as any count: 68 (floor: 69)
- Math.random in prod src: 0
- ESLint errors: 0

## What's next

- Run the full page-e2e sweep against the live app with real credentials to
  generate screenshots for all 28 pages × 3 viewports
- Triage screenshots for remaining polish issues (Safety tab scroll, iPad icon
  rail sizing, etc. — already fixed in earlier commits on this branch)
- Lap 2 Day 31: IRIS telemetry migration must land
