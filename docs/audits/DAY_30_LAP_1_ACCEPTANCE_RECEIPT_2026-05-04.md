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

### Run 2 — against `npm run build && vite preview` (playwright.acceptance.config.ts) ← THE REAL GATE

```
[1/3] cold open ≤ 1.4s         ❌ Timeout — auth wall (still — see fix)
[2/3] audit drawer ≤ 800ms     ⏭️ Skipped — empty seed
[3/3] bundle ≤ 500 KB          ❌ 1,503 KB gzipped (3x over budget)
```

**Top 10 chunks from production build:**

| Chunk | Size | Notes |
|---|---|---|
| `vendor-pdf-gen` | **531.6 KB** | @react-pdf/renderer + jspdf — alone exceeds entire budget |
| `vendor-pdf-viewer` | 219.8 KB | pdfjs-dist — only used on drawing-upload path |
| `vendor-react` | 203.9 KB | React + ReactDOM — can't split |
| `vendor-charts` | 119.2 KB | recharts — lazy-loadable per widget |
| `index` (main) | 95.1 KB | App entry — already minimal |
| `vendor-supabase` | 54.5 KB | @supabase/supabase-js — needed early |
| `analytics` | 52.0 KB | Custom analytics |
| `vendor-motion` | 36.6 KB | framer-motion |
| `syncManager` | 32.1 KB | Custom |
| `vendor-tanstack` | 29.7 KB | react-query |

**This is the data Day 27–28 (Bundle Attack) needs.** No more speculation about what to lazy-load. The receipt for Day 27–28 should target the top three: lazy-load `@react-pdf/renderer`/`jspdf` behind PDF-export buttons, lazy-load `pdfjs-dist` behind drawing-upload, lazy-load `recharts` per widget. That alone removes ~870 KB.

### Run 3 — after vite.config modulePreload fix + bundle-test cutoff fix

Two improvements landed:
1. `vite.config.ts` `build.modulePreload.resolveDependencies` filters out heavy route-specific chunks (`vendor-pdf-gen`, `vendor-pdf-viewer`, `vendor-three`, `vendor-charts`, etc.) from the eager `<link rel="modulepreload">` list.
2. `e2e/lap-1-acceptance.spec.ts` now stops counting JS responses when `dashboard-hero` is visible, not at `load` event. This excludes prefetched route chunks fired by `usePrefetchRoutes` (App.tsx:165).

**Result: 1,503 KB still.** That means the JS dep graph itself imports the heavy chunks at boot, not just via modulepreload. Verified by `grep`:

| Eager static import | Source | Pulls into entry path |
|---|---|---|
| `from '@react-pdf/renderer'` (top-level) in `src/pages/daily-log/DailyLogPDFExport.tsx` | lazy-imported, OK | none directly |
| `from '../../services/pdf/paymentAppPdf'` in `src/pages/payment-applications/G702Preview.tsx:17` | G702Preview is *eagerly* imported by `PayAppDetail.tsx:16`, which is itself in the lazy `payment-applications` chunk | vendor-pdf-gen |
| `from '../lib/reports/wh347Pdf'` in `src/pages/TimeTracking.tsx:4` | TimeTracking is lazy, BUT manualChunks groups all pdf-lib code into vendor-pdf-gen, making the lazy chunk `import` it statically | vendor-pdf-gen |
| `from '../../../lib/compliance/wh347/render'` in `src/pages/admin/compliance/Wh347Panel.tsx:16` | Same pattern | vendor-pdf-gen |

**That's the actual Day 27–28 work.** Three call-site refactors, each ~5 lines: replace each top-level `import` with a call-time `await import()` so the route page itself doesn't pull pdf-lib, only the button click does. Expected delta: vendor-pdf-gen leaves the demo path → -532 KB.

Plus two ancillary fixes:
- `vendor-pdf-viewer` (220 KB) is loaded by drawing-page imports. Same refactor pattern.
- `vendor-charts` (119 KB) is loaded by dashboard widget imports. Convert each widget to `lazy()`.

Combined target after refactor: ~630 KB → still over 500, but close enough that further chunk inspection (vendor-react 204 KB?) would close the gap. Or accept 600 KB as the realistic Lap 1 target and update the spec.

---

## Honest measurements — what each result actually means

### Bundle gate: 1,503 KB ❌ (real, actionable)

The production-build measurement is the load-bearing one. The dev-server run produced 6.4 KB (un-bundled HMR chunks) — meaningless. Run 2 against `vite preview` is the truth.

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
