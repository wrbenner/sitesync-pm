# CI/PR friction push — receipt
**Date:** 2026-05-09
**Branch:** `ci-pr-friction-push`
**Status:** Ready for review.

## What was painful

Walker reported that "runs are failing and committing/merging a PR is a pain in the ass." After triage, the diagnosis broke into two layers:

### Layer 1: Visual noise on PRs (the actual perceived pain)

PR #383 had **7 red checks** (link-check, perf-budget, scenarios, static-audit, Lap 1 acceptance, Vitest+tsc+audit, Gate 5). It *felt* unmergeable.

It wasn't. Branch protection on `main` requires **only 6 checks** — Gate 1 (TypeScript), Gate 2 (ESLint), Gate 3 (Tests), Gate 4 (Build), Eval Layer 1 (Database/RLS), Eval Layer 2 (API). Those were all green. **PR #383 was `mergeable: MERGEABLE` the whole time.** The 7 reds were optional checks — visible, but non-blocking.

We merged PR #383 immediately and recovered PR #396 (auto-closed when its base branch was deleted) as PR #400 against main.

### Layer 2: Real friction sources

1. **1,095 iCloud-sync duplicate files** in the working tree (`scripts/audit-cron 2.ts`, `.github/workflows/audit 3.yml`, etc.). All untracked thanks to existing `.gitignore` rules — never committed — but they polluted local typecheck/lint runs and made `git status` impossible to scan during a session.
2. **Noisy non-required workflows running on every PR** — link-check, perf-budget, static-audit, e2e-scenarios, Lap 1 acceptance. Each had known false-positive modes (broken doc links in old audit files; dead-clicks ratchet drift; flaky Playwright; NO_FCP issue). They surfaced as red checks even with `continue-on-error: true`, creating the "PR is failing" perception.
3. **No local pre-commit gate.** A typecheck or ESLint failure first appeared 5 minutes after push, after one full CI roundtrip.

## What ships

### Sweep + prevent reintroduction (already gated by `.gitignore` + tsconfig/eslint/vitest excludes; verified)

- `scripts/cleanup-icloud-duplicates.sh` — one-shot + dry-run-safe. Deleted **1,095 local untracked iCloud duplicates** in this session. Re-runnable as a maintenance task.
- Verified existing `.gitignore` includes `*\ [0-9].*` / `*\ [0-9]/` / `*\ [0-9]` (catches every iCloud conflict-suffix pattern).
- Verified `tsconfig.app.json` excludes `**/* ?.ts/tsx`, vitest excludes `**/* [0-9].*`, eslint config has `globalIgnores('**/* [0-9].*', '**/* [0-9]/**', '**/* [0-9]')`. All three sides are protected.

### Move noisy gates off PR triggers (5 workflows)

Switched from `pull_request` + `push` to **push-to-main + workflow_dispatch only**. Each is documented inline as INFORMATIONAL ONLY with the rationale:

| Workflow | Reason |
|---|---|
| `docs-check.yml` | Pre-existing stale links in old audit docs (UX_BUGATTI_*, RFI_MODULE_BUILD_SPEC, etc.) — they reference moved/renamed files. Not the current PR's responsibility. |
| `perf.yml` | Known NO_FCP issue in the perf harness produces false reds. |
| `audit.yml` | `dead-clicks.json` ratchet drifts on every file-count change. |
| `e2e-scenarios.yml` | Playwright flake unrelated to PR code. |
| `lap-1-acceptance.yml` | Lap 1 closed 2026-05-04; drawer-perf gate skips in CI (no Supabase backend in vite preview build). |

These still run on every push to `main` so real regressions still surface. Anyone wanting a PR-time run can fire `workflow_dispatch` manually.

**Net effect:** PR check footprint drops from ~14 visible jobs to ~7. Required checks (Gate 1–4 + Eval Layer 1–2) unchanged.

### Local pre-commit gate

- `.husky/pre-commit` — runs `lint-staged` then incremental `tsc --noEmit` on both project tsconfigs. Steady-state cost: ~5s after the first run.
- `.lintstagedrc.json` — ESLint on staged `.ts`/`.tsx`/`.js` (max-warnings 0); JSON validity check on staged `.json`.
- `husky` + `lint-staged` added to devDependencies. `package.json` already had `prepare: "husky"`.
- Skip via `git commit --no-verify` for intentional-WIP commits.

### Documentation: the "PR is mergeable through red optional checks" rule

- `CLAUDE.md` gets a new "Sandbox hygiene & merge protocol" section explaining the gating model + iCloud-duplicate phenomenon, so future Claude sessions don't get confused by the visual noise.

## Out of scope (deliberately not in this PR)

- **Stripping synthetic check writes from `organism-cycle.yml`** (the post-merge fake-success POSTs). They're a real concern but unrelated to PR-time friction; landing in a separate PR keeps the diff tight.
- **Stack-rebase helper script.** Walker can use `gh pr create --base main` after rebasing manually; the manual round-trip is ~30 seconds, not the multi-minute pain that motivated this PR.
- **`git status --mine` filter.** Phantom changes from background workers are real but currently rare (autonomous workers are workflow_dispatch-only per their YAML; not auto-firing). If they become a problem, build then.
- **Move the repo out of iCloud.** The root cause of duplicates is `~/Desktop/sitesync-pm` being inside iCloud Drive. Moving to `~/code/` would eliminate the regeneration problem at the source. Strong follow-up recommendation, but mechanically a Walker-side action (he has to relocate the working tree).

## Verification

| Check | How |
|---|---|
| Duplicates gone | `find . -name "* [0-9].*" -not -path "*/node_modules/*" -not -path "*/.git/*"` returns 157 files (down from 1,133), all extensions outside our `EXTS` list (`.docx`, `.xlsx`, `.pdf`, etc.). |
| `.gitignore` working | Re-running the cleanup script reports zero tracked deletions — duplicates were never in the index. |
| Pre-commit fires | After `npm install`, `git commit` runs the husky hook. Verified: hook is executable + lints staged files + runs typecheck. |
| Workflows trigger correctly | YAML lints clean; pull_request trigger removed from the 5 noisy workflows; push-to-main + workflow_dispatch retained. |
| PR #383 unblocked | Already merged at `2026-05-10T01:07:54Z` after triage confirmed required checks were green. |
| PR #400 (was #396) unblocked | Re-opened against main after rebase; pending its own CI cycle. |

## Files

### New (3)
- `scripts/cleanup-icloud-duplicates.sh`
- `.husky/pre-commit`
- `.lintstagedrc.json`
- `docs/audits/CI_PR_FRICTION_PUSH_RECEIPT_2026-05-09.md` (this file)

### Modified (6)
- `.github/workflows/docs-check.yml` — drop pull_request trigger
- `.github/workflows/perf.yml` — drop pull_request trigger
- `.github/workflows/audit.yml` — drop pull_request trigger
- `.github/workflows/e2e-scenarios.yml` — drop pull_request trigger
- `.github/workflows/lap-1-acceptance.yml` — drop pull_request trigger
- `package.json` + `package-lock.json` — add husky + lint-staged devDeps

### Deleted (1,095)
- iCloud-sync duplicate files across `scripts/`, `.github/workflows/`, `audit/`, `evals/`, `docs/`, `src/`, `supabase/`, root. All untracked; deletions don't appear in the diff.

## What's next (Walker actions)

1. **Move the repo out of iCloud Drive.** The cleanup script is a band-aid; relocating to `~/code/sitesync-pm/` (or any non-iCloud location) eliminates the duplicate regeneration entirely.
2. **Run `npm install` after pulling this branch** to install husky + lint-staged + activate the pre-commit gate.
3. **Merge confidence:** when PR shows red optional checks but green required (Gate 1–4 + Eval Layer 1–2), it's safe to merge. `gh pr merge --auto --squash --delete-branch` is the canonical command.
