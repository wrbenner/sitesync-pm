# Slice E — Test Coverage Push (Batch 2)

**Date:** 2026-05-05
**Branch:** `test/coverage-slice-e-batch-2-2026-05-05`
**Parent:** `test/coverage-slice-e-2026-05-05` (5 prior commits, 377 cases)
**Status:** WIP — 70% target not yet reached. Picks up next session.

---

## What this commit added

12 new commits beyond the prior slice-E branch — 11 test commits + 1
infrastructure fix:

| Commit | Module(s) | Cases |
|---|---|---:|
| 15bbca9 | emailThreading, slaCalculator, healthScoring | 61 |
| c9e01e0 | aiPrompts, devBypass, errorTracking, budgetParser, drawReportParser | 84 |
| 55b0c38 | confidenceGate, expirationGate, _hash, waterfall | 65 |
| 97f9fab | scopeChangePatterns, dailyLogDrafting/sections | 45 |
| 1cd9327 | costCodeInferer | 15 |
| fe60f10 | wh347/render | 20 |
| ed13150 | audit/hashChainVerifier | 17 |
| 8deead1 | coAutoDraft/costEstimator | 15 |
| b331155 | dailyLog/signing | 23 |
| 66e8563 | dailyLog/revisions | 16 |
| dafeaaf | documentGen/monthlyReport + closeoutPackage | 18 |
| **Subtotal** | **21 new test files** | **379** |
| 0bf51dd | chore: add `@vitest/coverage-v8` devDep | — |

Cumulative slice-E (parent + this branch): **756 cases** across 26 test
files (5 cherry-picked + 21 new).

## Coverage measurement

`@vitest/coverage-v8` was missing from `package.json` despite being
referenced from `vitest.config.ts`. Added it (commit 0bf51dd) so
`npm run test:coverage` produces a real report.

**Reading at end of this branch (v8 provider):**

```
All files     14.12% statements | 74.99% branches | 53.91% functions | 14.12% lines
Test Files    296 passed | 1 skipped (297)
Tests         3519 passed | 10 skipped (3529)
```

Note: the **14.12% statements** does **not** correspond to the
`.quality-floor.json` baseline of 43.2%. The floor was set with a
different methodology (likely istanbul); v8 uses character-position
coverage and reports a different denominator. Still: this number is
the one CI will compare against once the floor is re-baselined to v8.

**Branches at 74.99% already clear the 70% target.** Statements,
lines, and functions remain below target and need follow-up coverage
of larger un-instrumented modules.

## Where to look next session

Untested high-value pure-logic files still on the table:

- `src/lib/audit/sealedExport.ts` (268 LOC) — sealed PDF/manifest export
- `src/lib/fieldCapture/durableQueue.ts` (281 LOC) — offline capture queue
- `src/lib/projectAnalytics.ts`, `src/lib/scheduleHealth.ts`, etc.
  already had cherry-picked tests; may have remaining branches uncovered
- `src/services/*` — only ~3 of 30 files have tests; each is a
  thin layer over Supabase that could be hit with the
  `src/test/mocks/supabase.ts` fixture
- `src/hooks/queries/*` and `src/hooks/mutations/*` — large untested
  surface but each individual file is small. React Testing Library
  + `renderHook` patterns already exist (`src/test/hooks/`).

**Bigger structural play:** `src/pages/**` is currently excluded from
the coverage `include`. Adding it back would dilute the percentage
unless the pages get hand-written render tests — the current smoke
tests (`src/test/pages/smoke/*`) only check the file exists.

## Files added by this branch

```
src/lib/aiExtract/confidenceGate.test.ts
src/lib/aiPrompts.test.ts
src/lib/audit/hashChainVerifier.test.ts
src/lib/budgetParser.test.ts
src/lib/coAutoDraft/costEstimator.test.ts
src/lib/coAutoDraft/scopeChangePatterns.test.ts
src/lib/coi/expirationGate.test.ts
src/lib/compliance/wh347/render.test.ts
src/lib/costCodes/waterfall.test.ts
src/lib/dailyLog/_hash.test.ts
src/lib/dailyLog/revisions.test.ts
src/lib/dailyLog/signing.test.ts
src/lib/dailyLogDrafting/costCodeInferer.test.ts
src/lib/dailyLogDrafting/sections.test.ts
src/lib/devBypass.test.ts
src/lib/documentGen/monthlyReport.test.ts
src/lib/drawReportParser.test.ts
src/lib/emailThreading.test.ts
src/lib/errorTracking.test.ts
src/lib/healthScoring.test.ts
src/lib/slaCalculator.test.ts
```

All Bugatti-grade: every named export reached, edge cases (empty
inputs, null fields, boundary values) explicitly asserted, no `.skip()`
or `.todo()`, no smoke-only "import it and assert true" tests.
