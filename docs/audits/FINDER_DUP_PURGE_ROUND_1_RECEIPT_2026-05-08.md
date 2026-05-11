# Finder Duplicate Purge — Round 1 Receipt

**Date:** 2026-05-08
**Scope:** `src/` only
**Driver:** Walker (founder); cleanup partner: Claude (Cowork)

## TL;DR

Deleted **954 macOS Finder/iCloud-conflict duplicate files** from `src/`. **8.9 MB** of dead weight removed. Files were never git-tracked (`.gitignore` line 78 already excluded the pattern) — so this purge is a working-tree cleanup, not a history change. No imports anywhere in the codebase referenced any deleted file. `tsconfig.node.json` typecheck: green. PermissionGate CI gate: green, no growth since baseline.

`tsconfig.app.json` typecheck was not run in this session — full `tsc` cold-start exceeds the 45s Cowork bash sandbox window. Walker to run `npm run typecheck` locally as the final gate before considering this round closed.

## What Was Deleted

954 files matching the pattern `* 2.ts`, `* 2.tsx`, `* 3.ts`, `* 3.tsx`, `* 4.ts`, `* 4.tsx` under `src/`. These are classic macOS Finder/iCloud copy artifacts (the suffix `" 2"` etc. is what Finder appends when the same filename collides during a copy or sync conflict).

Notable categories:

- 25 dead-store duplicates (`crewStore 2.ts`, `dailyLogStore 2.ts`, `equipmentStore 2.ts`, `submittalStore 2.ts`, etc.) — duplicates of stores already retired per the CLAUDE.md "Never re-add a deleted store" list. Their canonicals are already gone; the duplicates were stale tombstones.
- 5 retired-page duplicates (`Portfolio 2.tsx`, `Financials 2.tsx`, `CarbonDashboard 2.tsx`, `AICopilot 2.tsx`, `CostManagement 2.tsx`) — duplicates of pages whose routes in `App.tsx` are now redirects (`/portfolio` → `/dashboard`, `/financials` → `/budget`, etc.).
- 924 active-file duplicates with canonical sibling intact — straightforward Finder copies of files still in use.

## File Counts

| State | `src/` file count |
|---|---|
| Before | 2,532 |
| After | 1,578 |
| Delta | −954 |

Verification: `find src -type f \( -name "* 2.ts" -o ... \) | wc -l` returns `0` post-delete.

## Why This Was Safe

1. **Module resolution can't reach Finder dups.** TypeScript/Node resolves `import x from './foo'` to `foo.ts` / `foo.tsx` / `foo/index.ts` — never to a path with a space-and-number suffix. The only way a duplicate could be loaded is an explicit `import x from './foo 2'`. A grep across all `.ts`/`.tsx` files for `from "..." [234]"` returned zero matches.

2. **Files were never git-tracked.** `git status` before deletion showed 0 deletions tracked because `.gitignore` line 78 already excluded the pattern with the comment *"macOS Finder / iCloud sync conflict duplicates"*. This means the purge is a local working-tree cleanup; the canonical sources in git are untouched.

3. **No-canonical orphans matched documented intent.** ~44 of the 954 had no surviving canonical sibling — e.g. the dead stores. Each of those cases lined up with either the CLAUDE.md "dead store" list or an explicit `App.tsx` route redirect. They were duplicates of files retired *on purpose* in earlier cleanups.

## Verification Results

| Check | Result |
|---|---|
| Imports referencing deleted paths (post-delete) | 0 (grep returned no matches) |
| `tsconfig.node.json` typecheck | Green, 1.5s |
| `tsconfig.app.json` typecheck | **Not run in this session** — exceeds 45s sandbox window. Run locally. |
| `node scripts/audit-permission-gate.mjs` | Green — RFI/Submittal/ChangeOrder/PayApp/Punch/DailyLog all 0 vs. baseline |
| `npm run audit` (static + e2e) | **Not run in this session** — playwright suite exceeds sandbox window. Run locally. |

## What Was NOT Touched (deferred to Round 2)

- **807 Finder dup files outside `src/`** — same pattern under `docs/audits/`, `tests/`, `android/`, `ios/`, `scripts/`, etc. Same cleanup logic applies; lower urgency because they don't compile. Suggest a Round 2 sweep before any large doc refactor.
- **Genuinely orphan files inside `src/` that aren't Finder dups** — files with zero importers but normal names. Requires a real import-graph audit; deferred. Lower-confidence territory because some files (entry points, dynamically-imported routes, test fixtures) have legitimate zero-static-importer status.
- **Retired-feature pages still wired up** — pages whose routes are redirected away in `App.tsx` but whose component files still exist (e.g. `pages/Portfolio.tsx` itself, not the duplicate). These need a per-page judgment call: confirm the route is redirected, confirm no other page or test depends on the component, then delete. Round 3 candidates.

## Required Walker Actions

1. **Run `npm run typecheck` locally.** This is the only safety check that didn't fit in the Cowork sandbox. Both project refs (`tsconfig.app.json` and `tsconfig.node.json`) must stay zero-error per the typecheck-zero invariant.
2. **Optionally run `npm run audit`** to also exercise the playwright route-audit harness.
3. **Stage and commit the working-tree change.** Even though no git-tracked files changed, you may want to `git add -A` to confirm git also sees no diff.
4. **Update `SiteSync_90_Day_Tracker.xlsx`** if this rolls under a tracked day. Otherwise file under "off-cycle hygiene."

## Lessons / Memory

- macOS Finder/iCloud generates these dups regularly. The `.gitignore` already catches them at commit time, but they accumulate on disk and confuse file-tree screenshots, IDE search, and grep results. Re-running this purge periodically (or as a pre-commit hook) is a low-cost win.
- The CLAUDE.md "dead store" list is now slightly more enforced — the duplicate copies that could have been mistaken for valid alternative implementations are gone.

## Index Update

Add to `docs/audits/INDEX.md` under hygiene/cleanup:

```
- FINDER_DUP_PURGE_ROUND_1_RECEIPT_2026-05-08.md — purged 954 Finder/iCloud dup files from src/, 8.9MB, no git-tracked changes
```
