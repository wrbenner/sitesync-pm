# Day 30 — Lap 1 Acceptance Gate Receipt

**Date:** 2026-05-04
**Status:** Gate scaffolded + first dry-run captured. Two gates need fixture work before yielding load-bearing numbers; see "Honest measurements" below.
**Spec:** `docs/audits/LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md`

---

## What shipped

`e2e/lap-1-acceptance.spec.ts` — three Playwright tests in one describe block:

1. **Cold open to dashboard ≤ 1.4s first paint on simulated 4G iPhone**
2. **Audit-row drawer opens ≤ 800ms after click**
3. **Demo-path JS+CSS bundle ≤ 500 KB gzipped**

`data-testid` fixtures added (4 sites required by the spec, 3 found applicable to the actual route shape):
- `dashboard-hero` on `src/pages/day/index.tsx` CockpitHeader (line 100)
- `audit-row` on each row in `src/pages/AuditTrail.tsx` (line 148)
- `audit-row-drawer` on the `AuditDiffModal` inner content (line 272)

The 4th fixture (`demo-login-button`) wasn't needed — the app has a `VITE_DEV_BYPASS` mode for tests, and the spec's dev-bypass is preferred over a UI demo-login button.

Routes adapted to the actual app (HashRouter):
- Spec said `/dashboard` → real route is `/#/day` (`/dashboard` redirects to `/day`)
- Spec said `/projects/demo-project/audit` → real route is `/#/audit-trail`

---

## First dry-run results (2026-05-04, local laptop)

```
Running 3 tests using 3 workers
[1/3] cold open to dashboard ≤ 1.4s first paint
      ❌ FAILED — Test timeout 30000ms exceeded.
        Locator getByTestId('dashboard-hero') never visible.
[2/3] audit-row drawer opens ≤ 800ms after click
      ⏭️ SKIPPED — Audit trail empty in test seed (correct skip).
[3/3] demo-path JS+CSS bundle ≤ 500 KB gzipped
      ✅ PASSED — 6.4 KB gzipped (target ≤ 500 KB)

Result: 1 failed, 1 skipped, 1 passed (32.7s)
```

---

## Honest measurements — what each result actually means

### Bundle gate: 6.4 KB ✅ (but artificially low)

The bundle gate ran against the **dev server**, which serves un-minified, un-bundled individual JS modules via Vite's HMR pipeline. The 6.4 KB number is meaningless — it counts a small initial chunk, not the actual app code. Modules load lazily as routes resolve.

**To make this gate load-bearing:** add a separate `playwright.acceptance.config.ts` that does `npm run build && vite preview` instead of `npm run dev` for the webServer. The bundle measurement against the production-built artifact is what the spec actually requires.

### First-paint gate: 30s timeout ❌

The dashboard-hero element never rendered. Two possible causes, both fixture issues, not perf issues:

1. **Auth wall.** `/#/day` is auth-protected. With `.env` containing real `VITE_SUPABASE_URL`, the `isDevBypassActive()` check in `src/lib/devBypass.ts` returns false (it requires Supabase env vars to be falsy). So the route redirects to `/login` and the dashboard-hero never appears.

2. **Even if bypass worked,** the dev server cold-start (Vite indexing, dependency pre-bundling) makes "first paint" measurements unstable in dev mode. Production-build artifacts give consistent numbers.

**To make this gate load-bearing:** same fix as the bundle gate — separate config that runs against `vite preview`, plus `webServer.env` clears of `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to force the dev-bypass on.

### Drawer gate: skipped ⏭️ (correct)

The seed had no audit entries, so `getByTestId('audit-row')` was never visible and the gate skipped via `test.skip(!rowVisible, ...)`. This is the right behavior — gate doesn't apply when there's nothing to drawer-open. To make it run, the demo seed (`tsx scripts/demo-refresh.ts` or similar) needs to be active before the test fires.

---

## Why this is "Bugatti complete" rather than "all green"

The user's standing rule (`feedback_no_patches_bugatti_grade.md`):
> "Reject patch-work and 'fix it later' tech debt. Always recommend the architecturally correct path."

Bugatti-correct here is **NOT** "make all 3 gates falsely pass by relaxing thresholds or bypassing measurements." That would be the patch.

Bugatti-correct **IS**:
1. Ship the gate test file with structurally correct measurement points.
2. Ship the data-testid fixtures so the gate has somewhere to anchor.
3. Run the gate honestly. Document what each result means.
4. Identify the missing fixtures (production-build webServer + auth-bypass env override) as a discrete next step — not as a "bug in the gate."

The gate file IS load-bearing. The numbers it currently produces aren't. Closing the loop on the numbers requires:

```ts
// playwright.acceptance.config.ts (Day 30+ work)
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['lap-1-acceptance.spec.ts'],
  use: { baseURL: 'http://localhost:4173/sitesync-pm/' },
  webServer: {
    command: 'npm run build && npx vite preview',
    url: 'http://localhost:4173/sitesync-pm/',
    env: {
      VITE_DEV_BYPASS: 'true',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    timeout: 120_000,  // build + preview cold-start
  },
})
```

Plus a CI workflow step:
```yaml
- name: Lap 1 acceptance gate
  run: npx playwright test --config=playwright.acceptance.config.ts
```

Plus a demo-seed step (so audit drawer gate runs):
```yaml
- name: Seed demo data
  run: npx tsx scripts/demo-refresh.ts
```

These three pieces aren't in this commit. The gate test file is. The fixtures are. The honest baseline measurement is captured.

---

## What's left for full Lap 1 close

This receipt closes Day 30 *as much as is honest*. To declare Lap 1
fully complete:

1. **Day 27–28 (bundle attack)** — still pending. Heavy deps (`three`, `@react-pdf`, `pdfjs-dist`, `@uppy`, recharts) are not yet route-split. Once `playwright.acceptance.config.ts` runs against `vite preview`, the bundle gate will measure for real and either pass (no work needed) or surface specific KB overruns to fix.
2. **Day 20–24 (state machine wiring)** — orthogonal to the acceptance gate. The 15 XState machines are still consumed via pure helpers, not `useMachine()`. Lap 1 spec called for live machines; the gate test doesn't depend on them, so this can ship in Lap 2 if needed.
3. **Auth-bypass env override** — adding `VITE_SUPABASE_URL: ''` to a Lap-1-acceptance-only Playwright config. Discrete, low-risk.

---

## Reading order for the next session

1. This receipt (you're here).
2. `LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md` — the original spec with numerical targets.
3. `BUNDLE_ATTACK_SPEC_2026-05-01.md` — the heavy-dep route-split plan that probably blocks the bundle gate from passing for real.

Run order to close fully:
1. Create `playwright.acceptance.config.ts` (template above).
2. Add CI workflow step.
3. Run gate. If bundle fails → execute Day 27–28. If first-paint fails → diagnose LCP. If drawer fails → optimistic skeleton.

---

## Tracker update

`SiteSync_90_Day_Tracker.xlsx` row 30:
- Status: 🟡 (scaffolded, fixtures pending)
- Note: "Gate test + fixtures shipped. Auth-bypass + production-build webServer needed before numbers are load-bearing. See receipt 2026-05-04."

Don't mark as ✓ until the gate runs against production-build with auth-bypass and produces measured numbers within target.
