# Polish Receipt — 2026-05-18

**Branch:** `auto/polish-20260518-2233`  
**PR:** #666  
**Sweep:** 84/84 page-e2e specs passing (3 viewports × 28 pages)

---

## What Changed

### 1. `src/App.tsx` — ProfileGate bypass

**Bug:** `/profile`, `/help`, `/admin/*` are account-level routes that have no concept of an active project. They were showing the ProjectGate "Create Your First Project" screen when `projectId` was null (i.e., always in dev-bypass mode, and for any new user before they create a project).

**Fix:** Extended the ProjectGate exclusion list in **both** the mobile layout and desktop layout code paths:
```
Before: ['portfolio', 'settings']
After:  ['portfolio', 'settings', 'profile', 'help', 'admin']
```

**Verified:** Re-ran `page-28-profile.spec.ts` — all 3 viewports now show "Your Profile" content instead of ProjectGate.

### 2. `e2e/page-{3,4,5}.spec.ts` — signIn dev-bypass

**Bug:** Three specs (RFIs, Daily Log, Punch List) defined their own `signIn()` that unconditionally navigated to `#/login` and tried to fill the Supabase login form. In `VITE_DEV_BYPASS=true` mode there is no login form — the app redirects immediately to dashboard. All 9 tests (3 × 3 viewports) timed out at 90s.

**Fix:** Replaced all three inline `signIn` functions with the dev-bypass-aware pattern already used in `e2e/_helpers.ts`:
1. Navigate to `#/dashboard`
2. Wait for DOM content
3. If URL does not contain `/login`, dev bypass is active — return early
4. Otherwise fall through to real auth (placeholder fallbacks for form field variants)

**Verified:** 9/9 now pass (35s total, down from 270s timeout).

### 3. `package-lock.json` — engines realignment

Node engines field updated from `>=20` to `^22.13.0` per `.nvmrc` policy.

---

## Quality Floor

| Metric | Floor | Actual |
|--------|-------|--------|
| tsErrors | 0 | **0** ✓ |
| eslintErrors | 0 | **0** ✓ |
| anyCount | 69 | **68** ✓ |
| e2e page-e2e pass | n/a | **84/84** ✓ |

---

## Deferred / Not Actionable

- **9 workflow specs (page-3/4/5)** timeout was the only actionable failure. Remaining 75 specs were already passing.
- **PermissionGate disabled buttons** on procurement/admin pages in dev-bypass mode: these are correct behavior (`DEV_BYPASS_ROLE = 'viewer'`, enforced by test). Not a bug.
- **"Not set" fields on profile**: correct — no real user data in dev-bypass mode.
- **ProjectGate on all project-level pages** (schedule, budget, RFIs, etc.): correct — requires a project to be selected. Only account-level pages should bypass.

---

## What's Next

- Lap 2 Day 31: IRIS telemetry migration (`IRIS_TELEMETRY_SPEC_2026-05-04.md`)
- Lap 2 Day 31: drawer-gate seed (carried over from Lap 1)
