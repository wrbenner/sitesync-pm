# Polish Sweep Receipt — 2026-05-15

**Branch:** `auto/polish-20260515-2024`  
**PR:** #623 — `fix(polish): Math.random cleanup + DEV_BYPASS useProjects fix + stale e2e signIn fix`  
**Session type:** Autonomous polish sweep (unattended overnight)

---

## What was done

### E2E sweep result

| Metric | Before | After |
|--------|--------|-------|
| page-e2e tests passing | 71 / 84 | **84 / 84** |
| page-e2e tests failing | 13 | **0** |
| Suite duration | ~25 min | **5.5 min** |

### Fix 1 — Math.random dead fallback removal (6 source files)

Removed `else { Math.random() }` branches from crypto-guarded code paths in:
- `src/lib/emailThreading.ts`
- `src/lib/realtime/presenceChannel.ts`
- `src/lib/fieldCapture/durableQueue.ts` (two sites)
- `src/lib/apiTokens/index.ts`
- `src/lib/observability/langfuse.ts`
- `src/lib/webhooks/index.ts`

All were `if (crypto?.getRandomValues)` guards written for pre-Node-18/pre-2020-browser runtimes. The `.nvmrc` pins Node 22.13.0; every supported browser ships Web Crypto. The else-branch was unreachable dead code.

3 remaining `Math.random` hits are in `IntelligenceGraph.tsx` — force-directed physics, intentional non-cryptographic use, left in place.

### Fix 2 — useProjects hangs in DEV_BYPASS mode

`VITE_DEV_BYPASS=true` sets the Supabase URL to `http://dev-bypass.invalid`. Chromium does not fast-fail on that hostname; TCP connect just hangs. `useProjects()` stayed `isLoading: true` indefinitely → all pages behind `ProjectGate` timed out in Playwright.

Fix: detect `isDevBypassActive()` in the `queryFn`, return `[]` immediately, set `retry: false` + `staleTime: Infinity`.

Previously failing: page-13-workforce × 3, page-14-crews iPhone.

### Fix 3 — Stale signIn placeholder in 3 specs

The magic-link-first login redesign renamed the email `<input placeholder>` from `"you@company.com"` to `"Email"`. Three specs had inline `signIn` functions using the old string: page-3-rfis, page-4-daily-log, page-5-punch-list.

Fix: navigate to `#/dashboard` first (DEV_BYPASS short-circuit), try `"Email"` placeholder, fall back to `"you@company.com"`, handle the password-toggle button for magic-link-first flow.

Previously failing: page-3-rfis × 3, page-4-daily-log × 3, page-5-punch-list × 3.

### Fix 4 — Quality floor mockCount tightened

`.quality-floor.json` `mockCount` updated **12 → 3** to lock in the Math.random reduction. The `_v13_changelog` had documented this reduction in a previous commit but the numeric value had not been applied. Immune-gate will now reject any future increase above 3.

---

## Quality floor state (post-PR)

| Metric | Floor |
|--------|-------|
| tsErrors | 0 |
| eslintErrors | 0 |
| anyCount | 69 |
| mockCount | **3** (was 12) |
| eslintWarnings | ≤ 1573 |
| bundleSizeKB | ≤ 3500 |

---

## What was NOT changed

- No new features
- No migrations
- No dependency bumps
- No PermissionGate changes (viewer role in DEV_BYPASS is intentional)
- No store additions or mergers
- No force-push, no `--no-verify`

---

## Items already fixed in main (no action needed)

The POLISH_PUNCH_LIST.md items were triaged. All were already addressed in the codebase:

| Item | Status |
|------|--------|
| iPad sidebar overlap | Fixed — CSS Grid `gridTemplateColumns: '252px minmax(0, 1fr)'` in App.tsx |
| Sidebar em-dash display name | Fixed — `displayName = fullName \|\| derivedFromEmail \|\| 'You'` in Sidebar.tsx |
| Profile '?' avatar | Fixed — `displayInitials` fallback chain in UserProfile.tsx |
| Safety tab overflow | Fixed — `overflowX: 'auto'` + `flexShrink: 0` per tab in safety/index.tsx |

---

---

## Fix 5 — Playwright webServer OOM on cloud runners (v14 floor)

**Added in a second commit on this branch** after the sweep ran end-to-end in the cloud environment.

Root cause: The default Node.js heap (~2 GB) is exhausted by Vite's HMR / module-graph state accumulating across 50+ Playwright page loads in a single process. On memory-constrained cloud containers (typically ~4 GB RAM), the dev server OOM-crashes at test ~51 (page-24-audit-trail desktop), causing 34/84 tests to fail with `ERR_CONNECTION_REFUSED`.

Fix: `playwright.config.ts` now passes `NODE_OPTIONS: '--max-old-space-size=4096'` in `webServerEnv` for both `REAL_BACKEND=true` and DEV_BYPASS modes. The dev server gets a 4 GB heap cap; HMR state accumulation no longer causes a crash before the sweep finishes.

Verified: 84/84 passing in 5.5 minutes (second run, cloud container, DEV_BYPASS mode).

Quality floor bumped to v14. No numeric metrics changed — `anyCount` stays at 69 (the immune-gate grep counts `as any|@ts-ignore|@ts-expect-error`, not just ` as any`; the measured total is 69).

---

## Next session pickup

PR #623 is open; CI was in-progress at session end. If all 6 required gates are green:

```
gh pr merge 623 --auto --squash --delete-branch
```

No further polish work is queued. The e2e floor is now 84/84 (stable in cloud).
