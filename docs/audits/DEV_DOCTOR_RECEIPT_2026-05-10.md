# Dev Doctor (PR δ) — receipt
**Date:** 2026-05-10
**Branch:** `dev-doctor`
**Status:** Ready for review.

## Goal

When something feels weird in the dev environment, **one command** tells you what's wrong and how to fix it. The closing chapter of the perfect-velocity push.

## What ships

### `scripts/doctor.ts` + `npm run doctor`

Runs 7 checks (8 when on a feature branch with an open PR) covering every common failure mode in this repo's dev loop:

| # | Check | What it verifies |
|---|---|---|
| 1 | Repo NOT in iCloud Drive | If true, prints `bash scripts/relocate-out-of-icloud.sh` (the actual fix; cleanup is just a band-aid) |
| 2 | Husky pre-commit hook installed | `.husky/pre-commit` exists + executable. Auto-fix: `npm install` (re-runs `prepare`). |
| 3 | lint-staged config present | `.lintstagedrc.json` exists. |
| 4 | No iCloud duplicates in working tree | `find -name "* [0-9].*"` returns zero. Auto-fix: cleanup script. |
| 5 | Branch protection on `main` sane | Reads `gh api repos/.../protection` — expect ≥6 required checks (Gate 1-4 + Eval Layer 1-2). |
| 6 | Stale auto/* branches ≤ 5 | Runs the sweep script in `--dry-run` mode. Suggests sweep when count is high. |
| 7 | Pre-commit incremental cache warm | Checks for `node_modules/.tmp/tsconfig.{app,node}.tsbuildinfo`. If missing, first pre-commit will be ~30s. Suggests `npm run typecheck`. |
| 8* | Current PR's required checks | When on a feature branch with an open PR, reports failed required checks. |

### Modes

- `npm run doctor` — full diagnostic, exits 1 on any red
- `npm run doctor:fix` — runs safe auto-fixes (only `npm install` and `chmod` are deemed safe; everything else printed-not-run)
- `tsx scripts/doctor.ts --json` — machine-readable output for CI / piping
- `tsx scripts/doctor.ts --quiet` — only print red checks (good for `postinstall` hint)

### Smoke test from this branch (in iCloud)

```
[doctor] dev-environment diagnostic:

  ✗ Repo NOT in iCloud Drive: Repo is at ~/Desktop/sitesync-pm — iCloud will regenerate * N.ext duplicates
      fix: bash scripts/relocate-out-of-icloud.sh
  ✓ Husky pre-commit hook installed: .husky/pre-commit present + executable
  ✓ lint-staged config present: .lintstagedrc.json found
  ✗ No iCloud duplicates in working tree: 157 duplicates polluting working tree
      fix: bash scripts/cleanup-icloud-duplicates.sh
  ✓ Branch protection on main: 6 required status checks configured
  ✓ Stale auto/* branches: Zero stale auto-worker branches
  ✓ Pre-commit incremental cache warm: tsbuildinfo cache present (pre-commit will run fast)

[doctor] 2 of 7 checks need attention. Run with --fix for safe auto-fixes.
```

The 2 reds are exactly the items requiring Walker's manual action: relocate the repo out of iCloud, then re-run cleanup.

### CLAUDE.md update

Adds "When something feels weird, run `npm run doctor` first" to the sandbox-hygiene section.

## Files

| Path | Status |
|---|---|
| `scripts/doctor.ts` | New |
| `package.json` | + `doctor` and `doctor:fix` npm scripts |
| `CLAUDE.md` | Sandbox-hygiene section gets the doctor pointer |
| `docs/audits/DEV_DOCTOR_RECEIPT_2026-05-10.md` | This file |
| `docs/audits/INDEX.md` | Add receipt row |

## Verification

| Check | Method | Expected |
|---|---|---|
| Doctor runs | `npm run doctor` | Reports 7-8 checks with green/red status |
| Auto-fix safety | `npm run doctor:fix` | Only runs `npm install` / `chmod`; prints (doesn't run) destructive fixes |
| JSON mode | `tsx scripts/doctor.ts --json` | Valid JSON output |
| Quiet mode | `tsx scripts/doctor.ts --quiet` | Only red checks print |
| Exit code | `npm run doctor && echo OK` | Exits 0 only when all green |

## Perfect-velocity push: complete

After PRs α / β / γ / δ all land, the loop looks like this:

| Stage | Time | Action |
|---|---|---|
| Code | — | Edit files |
| Pre-commit | ~5s | Husky catches Gate 1/2 failures locally |
| Push + PR + auto-merge | ~5s of attention | `bash scripts/ship.sh "title"` |
| CI runs | ~3 min wall (background) | All required checks run; auto-merge fires when green |
| Done | — | Branch deleted, main updated |

Total commit-to-merged when nothing's broken: **~3 min wall time, ~10s of attention.** That's the floor we can reach without changing the GitHub Actions runner.

If something feels weird at any point: `npm run doctor`. If it tells you to relocate the repo out of iCloud: that's a one-time Walker action that eliminates the duplicate-regeneration problem at the source.

## Anti-goals (deliberate)

- Doctor does NOT auto-fix destructive things (relocate, sweep). Walker decides + runs.
- Doctor does NOT check for things outside the dev loop (deployment, db migrations applied, etc.). Scope is the local-to-merged path.
- Doctor does NOT run on every commit (would be too slow). It's an on-demand diagnostic.
